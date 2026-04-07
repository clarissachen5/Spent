import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, setDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { app } from '../src/config/firebase';
import { API_BASE_URL } from '../constants/config';
import { startLocationTracking } from '../services/LocationTracker';

export interface CheckInResult {
  location: string;
  category: string;
  visited: boolean;
  amount?: number;
  timestamp: Date;
}

export interface SpendingEstimate {
  date: string;
  event: string;
  low:    { amount: number; description: string };
  medium: { amount: number; description: string };
  high:   { amount: number; description: string };
}

export interface DetectedLocation {
  id: string;
  google_place_id: string;
  place_name: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  arrived_at: string;
  flashcard_shown: boolean;
  created_at: string;
}

interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
  checkInResults: CheckInResult[];
  addCheckInResult: (result: CheckInResult) => void;
  predictions: SpendingEstimate[];
  mergePredictions: (incoming: SpendingEstimate[]) => void;
  predictionsLoaded: boolean;
  pendingLocations: DetectedLocation[];
  markLocationShown: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
  checkInResults: [],
  addCheckInResult: () => {},
  predictions: [],
  mergePredictions: () => {},
  predictionsLoaded: false,
  pendingLocations: [],
  markLocationShown: async () => {},
});

// Stable Firestore doc ID for a spending estimate (no '/' allowed in IDs)
function estimateDocId(date: string, event: string): string {
  return `${date}__${event.replace(/\//g, '-')}`.slice(0, 500);
}

function getEventDate(ev: any): string {
  return ev.start?.date?.split('T')[0] ?? ev.start?.dateTime?.split('T')[0] ?? '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [predictions, setPredictions] = useState<SpendingEstimate[]>([]);
  const [predictionsLoaded, setPredictionsLoaded] = useState(false);
  const [pendingLocations, setPendingLocations] = useState<DetectedLocation[]>([]);

  // Start background location tracking and fetch pending flashcards on launch
  useEffect(() => {
    startLocationTracking().catch(console.error);
    fetchPendingLocations();
  }, []);

  async function fetchPendingLocations() {
    try {
      const db = getFirestore(app);
      const snap = await getDocs(collection(db, 'detected_locations'));
      const locations: DetectedLocation[] = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<DetectedLocation, 'id'>) }))
        .filter(l => !l.flashcard_shown);
      setPendingLocations(locations);
    } catch (e) {
      // Firestore unavailable — CheckInModal falls back to hardcoded locations
    }
  }

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
    // Fire-and-forget save to Firestore
    (async () => {
      try {
        const db = getFirestore(app);
        await addDoc(collection(db, 'check_ins'), {
          location:  result.location,
          category:  result.category,
          visited:   result.visited,
          amount:    result.amount ?? null,
          timestamp: result.timestamp.toISOString(),
        });
      } catch (e) {
        console.warn('[Firestore] check-in save failed:', e);
      }
    })();
  };

  const mergePredictions = (incoming: SpendingEstimate[]) => {
    setPredictions(prev => {
      const map = new Map(prev.map(p => [`${p.date}|${p.event}`, p]));
      incoming.forEach(p => map.set(`${p.date}|${p.event}`, p));
      return Array.from(map.values());
    });
  };

  const markLocationShown = async (id: string) => {
    try {
      const db = getFirestore(app);
      await setDoc(doc(db, 'detected_locations', id), { flashcard_shown: true }, { merge: true });
    } catch {
      // best effort
    }
    setPendingLocations(prev => prev.filter(l => l.id !== id));
  };

  // Sync predictions and check-ins from Firestore, then process calendar via Ollama
  useEffect(() => {
    if (!token) return;

    const syncOnLogin = async () => {
      const db = getFirestore(app);

      // 1. Load saved predictions and check-ins from Firestore
      const [analysesSnap, checkInsSnap] = await Promise.all([
        getDocs(collection(db, 'spending_analyses')),
        getDocs(collection(db, 'check_ins')),
      ]);

      const loadedPredictions: SpendingEstimate[] = [];
      analysesSnap.forEach(d => {
        const data = d.data();
        if (data.date && data.event) {
          loadedPredictions.push({
            date:   data.date,
            event:  data.event,
            low:    data.low,
            medium: data.medium,
            high:   data.high,
          });
        }
      });
      if (loadedPredictions.length > 0) mergePredictions(loadedPredictions);
      console.log('[Firestore] loaded', loadedPredictions.length, 'saved predictions');

      const loadedCheckIns: CheckInResult[] = [];
      checkInsSnap.forEach(d => {
        const data = d.data();
        loadedCheckIns.push({
          location:  data.location,
          category:  data.category,
          visited:   data.visited,
          amount:    data.amount ?? undefined,
          timestamp: new Date(data.timestamp),
        });
      });
      if (loadedCheckIns.length > 0) setCheckInResults(loadedCheckIns);
      console.log('[Firestore] loaded', loadedCheckIns.length, 'check-ins');

      // Ungate the UI — calendar can display while Ollama fills in the rest
      setPredictionsLoaded(true);

      // 2. Background: fetch all months and send uncovered events to Ollama
      const fetchMonthItems = async (y: number, m: number): Promise<any[]> => {
        const start = new Date(y, m, 1);
        const end   = new Date(y, m + 1, 0, 23, 59, 59);
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
          `?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}` +
          `&singleEvents=true&orderBy=startTime&maxResults=500`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
      };

      const processItems = async (items: any[], coveredKeys: Set<string>) => {
        const uncovered = items
          .map(ev => ({ title: ev.summary ?? 'Untitled', date: getEventDate(ev) }))
          .filter(e => e.date && !coveredKeys.has(`${e.date}|${e.title}`));

        if (uncovered.length === 0) return;

        console.log('[Ollama] processing', uncovered.length, 'uncovered events');
        const BATCH = 20;
        for (let i = 0; i < uncovered.length; i += BATCH) {
          const batch = uncovered.slice(i, i + BATCH);
          try {
            const res = await fetch(`${API_BASE_URL}/ollama/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ events: batch }),
            });
            if (!res.ok) continue;
            const analysis = await res.json();
            let estimates: SpendingEstimate[] = [];
            try {
              if (analysis.parsed_estimates) {
                estimates = JSON.parse(analysis.parsed_estimates).estimates ?? [];
              } else {
                const match = analysis.raw_response?.match(/\{[\s\S]*\}/);
                if (match) estimates = JSON.parse(match[0]).estimates ?? [];
              }
            } catch (_) {}
            if (estimates.length > 0) {
              mergePredictions(estimates);
              estimates.forEach(p => coveredKeys.add(`${p.date}|${p.event}`));
              const savedAt = new Date().toISOString();
              await Promise.all(estimates.map(p =>
                setDoc(doc(db, 'spending_analyses', estimateDocId(p.date, p.event)), {
                  date:       p.date,
                  event:      p.event,
                  low:        p.low,
                  medium:     p.medium,
                  high:       p.high,
                  created_at: savedAt,
                })
              ));
              console.log('[Ollama] saved batch of', estimates.length, 'predictions');
            }
          } catch (_) {}
        }
      };

      const coveredKeys = new Set(loadedPredictions.map(p => `${p.date}|${p.event}`));
      const now          = new Date();
      const currentYear  = now.getFullYear();
      const currentMonth = now.getMonth();

      (async () => {
        // Current month first, then ±6 months
        const offsets = [0, ...Array.from({ length: 12 }, (_, i) => i < 6 ? -(i + 1) : (i - 5))];
        const allCalendarKeys = new Set<string>();

        for (const offset of offsets) {
          const d = new Date(currentYear, currentMonth + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth();
          try {
            const items = await fetchMonthItems(y, m);
            console.log('[Calendar] sync month', y, m + 1, ':', items.length, 'events');
            items.forEach((ev: any) => {
              const date  = getEventDate(ev);
              const title = ev.summary ?? 'Untitled';
              if (date) allCalendarKeys.add(`${date}|${title}`);
            });
            await processItems(items, coveredKeys);
          } catch (e) {
            console.warn('[Calendar sync] month failed:', y, m + 1, e);
          }
        }

        // Delete spending_analyses for events no longer in Google Calendar
        const syncStart = new Date(currentYear, currentMonth - 6, 1).toISOString().split('T')[0];
        const syncEnd   = new Date(currentYear, currentMonth + 7, 0).toISOString().split('T')[0];

        const stale = analysesSnap.docs.filter(d => {
          const data = d.data();
          if (!data.date || !data.event) return false;
          if (data.date < syncStart || data.date > syncEnd) return false;
          return !allCalendarKeys.has(`${data.date}|${data.event}`);
        });

        if (stale.length > 0) {
          await Promise.all(stale.map(d => deleteDoc(d.ref)));
          const staleKeys = new Set(stale.map(d => `${d.data().date}|${d.data().event}`));
          setPredictions(prev => prev.filter(p => !staleKeys.has(`${p.date}|${p.event}`)));
          console.log('[Firestore] deleted', stale.length, 'stale predictions');
        }

        console.log('[Calendar sync] background sync complete');
      })();
    };

    syncOnLogin();
  }, [token]);

  const logout = () => {
    setToken(null as any);
    setCheckInResults([]);
    setPredictions([]);
    setPredictionsLoaded(false);
    setPendingLocations([]);
  };

  return (
    <AuthContext.Provider value={{
      token, setToken, logout,
      checkInResults, addCheckInResult,
      predictions, mergePredictions, predictionsLoaded,
      pendingLocations, markLocationShown,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
