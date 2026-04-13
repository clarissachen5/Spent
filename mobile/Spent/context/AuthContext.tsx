import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, setDoc, doc, addDoc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app } from '../src/config/firebase';
import { API_BASE_URL } from '../constants/config';
import { startLocationTracking } from '../services/LocationTracker';

export const USER_ID_KEY = 'spent_user_id';

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
  userId: string | null;
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
  pendingLocations: DetectedLocation[];
  markLocationShown: (id: string) => Promise<void>;
  monthlyBudget: Record<string, number>;
  saveMonthlyBudget: (budget: Record<string, number>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  userId: null,
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
  pendingLocations: [],
  markLocationShown: async () => {},
  monthlyBudget: {},
  saveMonthlyBudget: async () => {},
});

// Stable Firestore doc ID for a spending estimate (no '/' allowed in IDs)
function estimateDocId(date: string, event: string): string {
  return `${date}__${event.replace(/\//g, '-')}`.slice(0, 500);
}

function getEventDate(ev: any): string {
  return ev.start?.date?.split('T')[0] ?? ev.start?.dateTime?.split('T')[0] ?? '';
}

// Returns the root collection path scoped to a user
function userCol(userId: string, name: string) {
  return collection(getFirestore(app), 'users', userId, name);
}

function userDoc(userId: string, ...segments: string[]) {
  return doc(getFirestore(app), 'users', userId, ...segments);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token,        setTokenState]        = useState<string | null>(null);
  const [userId,       setUserId]            = useState<string | null>(null);
  const [checkInResults, setCheckInResults]  = useState<CheckInResult[]>([]);
  const [predictions,  setPredictions]       = useState<SpendingEstimate[]>([]);
  const [predictionsLoaded, setPredictionsLoaded] = useState(false);
  const [userProfile,  setUserProfileState]  = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded]    = useState(false);
  const [pendingLocations, setPendingLocations] = useState<DetectedLocation[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<Record<string, number>>({});

  // Start background location tracking on launch
  useEffect(() => {
    startLocationTracking().catch(console.error);
  }, []);

  // When a token arrives, resolve the Google user ID then fetch user data
  const setToken = (accessToken: string) => {
    setTokenState(accessToken);
    // Fetch Google userinfo to get a stable user ID (the `sub` field)
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(info => {
        if (info.sub) {
          setUserId(info.sub);
          AsyncStorage.setItem(USER_ID_KEY, info.sub).catch(() => {});
        } else {
          console.warn('[AuthContext] userinfo missing sub:', info);
        }
      })
      .catch(e => console.warn('[AuthContext] userinfo fetch failed:', e));
  };

  const mergePredictions = (incoming: SpendingEstimate[]) => {
    setPredictions(prev => {
      const map = new Map(prev.map(p => [`${p.date}|${p.event}`, p]));
      incoming.forEach(p => map.set(`${p.date}|${p.event}`, p));
      return Array.from(map.values());
    });
  };

  // Fetch pending locations for this user
  async function fetchPendingLocations(uid: string) {
    try {
      const q = query(userCol(uid, 'detected_locations'), where('flashcard_shown', '==', false));
      const snapshot = await getDocs(q);
      const locations: DetectedLocation[] = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<DetectedLocation, 'id'>),
      }));
      setPendingLocations(locations);
    } catch (e) {
      // Firestore unavailable — CheckInModal falls back to hardcoded locations
    }
  }

  // Load all user data once userId is resolved
  useEffect(() => {
    if (!userId || !token) return;

    fetchPendingLocations(userId);

    const syncOnLogin = async () => {
      try {
        const budgetDocId = (() => {
          const d = new Date();
          return `${d.getFullYear()}_${d.getMonth()}`;
        })();

        const [analysesSnap, checkInsSnap, profileSnap, budgetSnap] = await Promise.all([
          getDocs(userCol(userId, 'spending_analyses')),
          getDocs(userCol(userId, 'check_ins')),
          getDocs(userCol(userId, 'user_profile')),
          getDocs(userCol(userId, 'monthly_budgets')),
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
        console.log('[Firestore] loaded', loadedPredictions.length, 'predictions for user', userId);

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
        console.log('[Firestore] loaded', loadedCheckIns.length, 'check-ins for user', userId);

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
        const budgetDoc = budgetSnap.docs.find(d => d.id === budgetDocId);
        if (budgetDoc) {
          const { updated_at, ...categories } = budgetDoc.data();
          setMonthlyBudget(categories as Record<string, number>);
        }

        setProfileLoaded(true);
        setPredictionsLoaded(true);

        // Background: fetch Google Calendar, run Ollama on uncovered events, delete stale predictions
        const coveredKeys = new Set(loadedPredictions.map(p => `${p.date}|${p.event}`));
        const now          = new Date();
        const todayMs      = now.getTime();

        (async () => {
          const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          const rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59);

          let allItems: any[] = [];
          try {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
              `?timeMin=${rangeStart.toISOString()}&timeMax=${rangeEnd.toISOString()}` +
              `&singleEvents=true&orderBy=startTime&maxResults=2500`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) throw new Error('Calendar fetch failed');
            const data = await res.json();
            allItems = data.items || [];
            console.log('[Calendar] fetched', allItems.length, 'events');
          } catch (e) {
            console.warn('[Calendar sync] fetch failed:', e);
            return;
          }

          const allCalendarKeys = new Set<string>();
          allItems.forEach((ev: any) => {
            const date  = getEventDate(ev);
            const title = ev.summary ?? 'Untitled';
            if (date) allCalendarKeys.add(`${date}|${title}`);
          });

          const uncovered = allItems
            .map((ev: any) => ({ title: ev.summary ?? 'Untitled', date: getEventDate(ev) }))
            .filter(e => e.date && !coveredKeys.has(`${e.date}|${e.title}`));

          uncovered.sort((a, b) => {
            const distA = Math.abs(new Date(a.date + 'T12:00:00').getTime() - todayMs);
            const distB = Math.abs(new Date(b.date + 'T12:00:00').getTime() - todayMs);
            return distA - distB;
          });

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
                  setDoc(userDoc(userId, 'spending_analyses', estimateDocId(p.date, p.event)), {
                    date: p.date, event: p.event,
                    low: p.low, medium: p.medium, high: p.high,
                    created_at: savedAt,
                  })
                ));
                console.log('[Ollama] saved batch of', estimates.length, 'predictions');
              }
            } catch (_) {}
          }

          // Delete predictions no longer in Google Calendar
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
      } catch (e) {
        console.warn('[syncOnLogin] failed:', e);
        setPredictionsLoaded(true);
      }
    };

    syncOnLogin();
  }, [userId, token]);

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
    (async () => {
      const uid = userId ?? await AsyncStorage.getItem(USER_ID_KEY);
      if (!uid) return;
      try {
        await addDoc(userCol(uid, 'check_ins'), {
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

  const saveUserProfile = async (profile: UserProfile) => {
    setUserProfileState(profile);
    // userId may still be resolving — read from AsyncStorage as fallback
    const uid = userId ?? await AsyncStorage.getItem(USER_ID_KEY);
    if (!uid) {
      console.warn('[AuthContext] saveUserProfile called before userId resolved');
      return;
    }
    await setDoc(userDoc(uid, 'user_profile', 'profile'), {
      ...profile,
      updated_at: new Date().toISOString(),
    });
  };

  const saveMonthlyBudget = async (budget: Record<string, number>) => {
    setMonthlyBudget(budget);
    const uid = userId ?? await AsyncStorage.getItem(USER_ID_KEY);
    if (!uid) return;
    const d = new Date();
    const docId = `${d.getFullYear()}_${d.getMonth()}`;
    await setDoc(userDoc(uid, 'monthly_budgets', docId), {
      ...budget,
      updated_at: new Date().toISOString(),
    });
  };

  const markLocationShown = async (id: string) => {
    if (userId) {
      try {
        await updateDoc(userDoc(userId, 'detected_locations', id), { flashcard_shown: true });
      } catch {
        // best effort
      }
    }
    setPendingLocations(prev => prev.filter(l => l.id !== id));
  };

  const logout = () => {
    setTokenState(null);
    setUserId(null);
    AsyncStorage.removeItem(USER_ID_KEY).catch(() => {});
    setCheckInResults([]);
    setPredictions([]);
    setPredictionsLoaded(false);
    setUserProfileState(null);
    setProfileLoaded(false);
    setPendingLocations([]);
    setMonthlyBudget({});
  };

  return (
    <AuthContext.Provider value={{
      token, userId, setToken, logout,
      checkInResults, addCheckInResult,
      predictions, mergePredictions, predictionsLoaded,
      userProfile, profileLoaded, saveUserProfile,
      pendingLocations, markLocationShown,
      monthlyBudget, saveMonthlyBudget,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
