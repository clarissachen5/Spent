import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, setDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { app } from '../src/config/firebase';
import { API_BASE_URL } from '../constants/config';

export interface UserProfile {
  city: string;
  school: string;
  categories: string[];
  goals: string[];
}

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

interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
  checkInResults: CheckInResult[];
  addCheckInResult: (result: CheckInResult) => void;
  predictions: SpendingEstimate[];
  mergePredictions: (incoming: SpendingEstimate[]) => void;
  predictionsLoaded: boolean;
  userProfile: UserProfile | null;
  profileLoaded: boolean;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
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
  userProfile: null,
  profileLoaded: false,
  saveUserProfile: async () => {},
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stable Firestore doc ID for a spending estimate (no '/' allowed in IDs)
function estimateDocId(date: string, event: string): string {
  return `${date}__${event.replace(/\//g, '-')}`.slice(0, 500);
}

function getEventDate(ev: any): string {
  return ev.start?.date?.split('T')[0] ?? ev.start?.dateTime?.split('T')[0] ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [predictions, setPredictions] = useState<SpendingEstimate[]>([]);
  const [predictionsLoaded, setPredictionsLoaded] = useState(false);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

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

  const saveUserProfile = async (profile: UserProfile) => {
    setUserProfileState(profile);
    const db = getFirestore(app);
    await setDoc(doc(db, 'user_profile', 'profile'), {
      ...profile,
      updated_at: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!token) return;

    const syncOnLogin = async () => {
      const db = getFirestore(app);

      // ── 1. Load saved predictions and check-ins from Firestore ──────────────
      const [analysesSnap, checkInsSnap, profileSnap] = await Promise.all([
        getDocs(collection(db, 'spending_analyses')),
        getDocs(collection(db, 'check_ins')),
        getDocs(collection(db, 'user_profile')),
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

      const profileDoc = profileSnap.docs[0];
      if (profileDoc) {
        const d = profileDoc.data();
        setUserProfileState({
          city:       d.city ?? '',
          school:     d.school ?? '',
          categories: d.categories ?? [],
          goals:      d.goals ?? [],
        });
      }
      setProfileLoaded(true);

      // Ungate the UI immediately — screens can now fetch and display events
      // while Ollama continues populating predictions in the background
      setPredictionsLoaded(true);

      // Covered keys seeded from Firestore — updated as Ollama responds
      const coveredKeys = new Set(loadedPredictions.map(p => `${p.date}|${p.event}`));

      const now          = new Date();
      const currentYear  = now.getFullYear();
      const currentMonth = now.getMonth();
      const todayMs      = now.getTime();

      // ── 2. Fetch full range, sort by proximity to today, run Ollama ─────────
      (async () => {
        const rangeStart = new Date(currentYear, currentMonth - 6, 1);
        const rangeEnd   = new Date(currentYear, currentMonth + 7, 0, 23, 59, 59);

        let allItems: any[] = [];
        try {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
            `?timeMin=${rangeStart.toISOString()}&timeMax=${rangeEnd.toISOString()}` +
            `&singleEvents=true&orderBy=startTime&maxResults=2500`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) throw new Error('Calendar fetch failed');
          const data = await res.json();
          allItems = data.items || [];
          console.log('[Calendar] fetched', allItems.length, 'events in full range');
        } catch (e) {
          console.warn('[Calendar sync] fetch failed:', e);
          return;
        }

        // Build full key set for stale-entry cleanup
        const allCalendarKeys = new Set<string>();
        allItems.forEach((ev: any) => {
          const date  = getEventDate(ev);
          const title = ev.summary ?? 'Untitled';
          if (date) allCalendarKeys.add(`${date}|${title}`);
        });

        // Filter uncovered events and sort closest to today first
        const uncovered = allItems
          .map((ev: any) => ({ title: ev.summary ?? 'Untitled', date: getEventDate(ev) }))
          .filter(e => e.date && !coveredKeys.has(`${e.date}|${e.title}`));

        uncovered.sort((a, b) => {
          const distA = Math.abs(new Date(a.date + 'T12:00:00').getTime() - todayMs);
          const distB = Math.abs(new Date(b.date + 'T12:00:00').getTime() - todayMs);
          return distA - distB;
        });

        console.log('[Ollama] processing', uncovered.length, 'uncovered events by proximity');

        // Send to Ollama in batches of 20, save each batch immediately
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

        // ── Delete spending_analyses entries no longer in Google Calendar ──────
        const syncStart = rangeStart.toISOString().split('T')[0];
        const syncEnd   = rangeEnd.toISOString().split('T')[0];

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

        console.log('[Calendar sync] complete');
      })();
    };

    syncOnLogin();
  }, [token]);

  const logout = () => {
    setToken(null as any);
    setCheckInResults([]);
    setPredictions([]);
    setPredictionsLoaded(false);
    setUserProfileState(null);
    setProfileLoaded(false);
  };

  return (
    <AuthContext.Provider value={{
      token, setToken, logout,
      checkInResults, addCheckInResult,
      predictions, mergePredictions, predictionsLoaded,
      userProfile, profileLoaded, saveUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
