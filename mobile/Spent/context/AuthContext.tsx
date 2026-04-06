import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, setDoc, doc, addDoc } from 'firebase/firestore';
import { app } from '../src/config/firebase';
import { API_BASE_URL } from '../constants/config';

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
  storedEventIds: Set<string>;
  addStoredEventIds: (ids: string[]) => void;
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
  storedEventIds: new Set(),
  addStoredEventIds: () => {},
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEventDate(ev: any): string {
  return ev.start?.date?.split('T')[0] ?? ev.start?.dateTime?.split('T')[0] ?? '';
}

async function callOllamaBatch(
  events: { title: string; date: string }[]
): Promise<SpendingEstimate[]> {
  const BATCH = 20;
  const results: SpendingEstimate[] = [];
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
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
      results.push(...estimates);
    } catch (_) {}
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [predictions, setPredictions] = useState<SpendingEstimate[]>([]);
  const [predictionsLoaded, setPredictionsLoaded] = useState(false);
  const [storedEventIds, setStoredEventIds] = useState<Set<string>>(new Set());

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
  };

  const mergePredictions = (incoming: SpendingEstimate[]) => {
    setPredictions(prev => {
      const map = new Map(prev.map(p => [`${p.date}|${p.event}`, p]));
      incoming.forEach(p => map.set(`${p.date}|${p.event}`, p));
      return Array.from(map.values());
    });
  };

  const addStoredEventIds = (ids: string[]) => {
    setStoredEventIds(prev => new Set([...prev, ...ids]));
  };

  useEffect(() => {
    if (!token) return;

    const syncOnLogin = async () => {
      const db = getFirestore(app);

      // ── 1. Load existing data from Firestore ────────────────────────────────
      const [eventsSnap, analysesSnap] = await Promise.all([
        getDocs(collection(db, 'calendar_events')),
        getDocs(collection(db, 'spending_analyses')),
      ]);

      const existingIds = new Set(eventsSnap.docs.map(d => d.id));
      setStoredEventIds(existingIds);
      console.log('[Firestore] loaded', existingIds.size, 'stored event IDs');

      const loadedPredictions: SpendingEstimate[] = [];
      analysesSnap.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.estimates)) loadedPredictions.push(...data.estimates);
      });
      if (loadedPredictions.length > 0) mergePredictions(loadedPredictions);
      console.log('[Firestore] loaded', loadedPredictions.length, 'saved predictions');

      // ── Helper: fetch one month from Google Calendar ─────────────────────
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

      // ── Helper: save + Ollama for a batch of items ───────────────────────
      // coveredKeys is a mutable Set so callers can pass the same ref across calls
      const processItems = async (
        items: any[],
        seenIds: Set<string>,
        coveredKeys: Set<string>,
      ) => {
        // Save new events to Firestore
        const newItems = items.filter(ev => ev.id && !seenIds.has(ev.id));
        if (newItems.length > 0) {
          await Promise.all(newItems.map(ev =>
            setDoc(doc(db, 'calendar_events', ev.id), {
              title:     ev.summary ?? 'Untitled',
              date:      getEventDate(ev),
              startTime: ev.start?.dateTime ?? null,
              endTime:   ev.end?.dateTime ?? null,
              isAllDay:  !!ev.start?.date,
            })
          ));
          newItems.forEach(ev => seenIds.add(ev.id));
          setStoredEventIds(new Set(seenIds));
          console.log('[Firestore] saved', newItems.length, 'new calendar events');
        }

        // Send uncovered events to Ollama
        const uncovered = items
          .map(ev => ({ title: ev.summary ?? 'Untitled', date: getEventDate(ev) }))
          .filter(e => e.date && !coveredKeys.has(`${e.date}|${e.title}`));

        if (uncovered.length > 0) {
          console.log('[Ollama] processing', uncovered.length, 'uncovered events');
          const newEstimates = await callOllamaBatch(uncovered);
          if (newEstimates.length > 0) {
            mergePredictions(newEstimates);
            newEstimates.forEach(p => coveredKeys.add(`${p.date}|${p.event}`));
            await addDoc(collection(db, 'spending_analyses'), {
              estimates:  newEstimates,
              created_at: new Date().toISOString(),
            });
            console.log('[Ollama] saved', newEstimates.length, 'new predictions');
          }
        }
      };

      // Mutable sets shared across all processItems calls
      const seenIds     = new Set(existingIds);
      const coveredKeys = new Set(loadedPredictions.map(p => `${p.date}|${p.event}`));

      const now = new Date();
      const currentYear  = now.getFullYear();
      const currentMonth = now.getMonth();

      // ── 2. Current month first → ungate UI ───────────────────────────────
      try {
        const currentItems = await fetchMonthItems(currentYear, currentMonth);
        console.log('[Calendar] current month: fetched', currentItems.length, 'events');
        await processItems(currentItems, seenIds, coveredKeys);
      } catch (e) {
        console.warn('[Calendar sync] current month failed:', e);
      }

      setPredictionsLoaded(true);

      // ── 3. Remaining months in the background ────────────────────────────
      (async () => {
        const months: { y: number; m: number }[] = [];
        for (let offset = -6; offset <= 6; offset++) {
          if (offset === 0) continue; // already done
          const d = new Date(currentYear, currentMonth + offset, 1);
          months.push({ y: d.getFullYear(), m: d.getMonth() });
        }

        for (const { y, m } of months) {
          try {
            const items = await fetchMonthItems(y, m);
            console.log('[Calendar] bg month', y, m + 1, ':', items.length, 'events');
            await processItems(items, seenIds, coveredKeys);
          } catch (e) {
            console.warn('[Calendar sync] bg month failed:', y, m + 1, e);
          }
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
    setStoredEventIds(new Set());
  };

  return (
    <AuthContext.Provider value={{
      token, setToken, logout,
      checkInResults, addCheckInResult,
      predictions, mergePredictions, predictionsLoaded,
      storedEventIds, addStoredEventIds,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
