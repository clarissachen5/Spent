import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { app } from '../src/config/firebase';

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
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [predictions, setPredictions] = useState<SpendingEstimate[]>([]);
  const [predictionsLoaded, setPredictionsLoaded] = useState(false);

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
  };

  // Merge incoming predictions, keyed by "date|event" to avoid duplicates
  const mergePredictions = (incoming: SpendingEstimate[]) => {
    setPredictions(prev => {
      const map = new Map(prev.map(p => [`${p.date}|${p.event}`, p]));
      incoming.forEach(p => map.set(`${p.date}|${p.event}`, p));
      return Array.from(map.values());
    });
  };

  // When a token is set (user logs in), load all saved predictions from Firestore
  useEffect(() => {
    if (!token) return;

    const loadFromFirestore = async () => {
      try {
        console.log('[Firestore] loading saved predictions...');
        const db = getFirestore(app);
        const snapshot = await getDocs(collection(db, 'spending_analyses'));
        const all: SpendingEstimate[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (Array.isArray(data.estimates)) {
            all.push(...data.estimates);
          }
        });
        if (all.length > 0) {
          mergePredictions(all);
          console.log('[Firestore] loaded', all.length, 'saved predictions');
        } else {
          console.log('[Firestore] no saved predictions found');
        }
      } catch (e) {
        console.warn('[Firestore] load failed:', e);
      } finally {
        setPredictionsLoaded(true);
      }
    };

    loadFromFirestore();
  }, [token]);

  const logout = () => {
    setToken(null as any);
    setCheckInResults([]);
    setPredictions([]);
    setPredictionsLoaded(false);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, logout, checkInResults, addCheckInResult, predictions, mergePredictions, predictionsLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
