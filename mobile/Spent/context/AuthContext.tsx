import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { app } from '../src/config/firebase';
import { startLocationTracking, setCurrentUserId } from '../services/LocationTracker';

export interface CheckInResult {
  location: string;
  category: string;
  visited: boolean;
  amount?: number;
  timestamp: Date;
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
  userId: string | null;
  setUserId: (uid: string) => void;
  logout: () => void;
  checkInResults: CheckInResult[];
  addCheckInResult: (result: CheckInResult) => void;
  pendingLocations: DetectedLocation[];
  markLocationShown: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  userId: null,
  setUserId: () => {},
  logout: () => {},
  checkInResults: [],
  addCheckInResult: () => {},
  pendingLocations: [],
  markLocationShown: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [pendingLocations, setPendingLocations] = useState<DetectedLocation[]>([]);

  // Only start location tracking after the user has signed in
  useEffect(() => {
    if (!token || !userId) return;
    startLocationTracking().catch(console.error);
    fetchPendingLocations(userId);
  }, [token, userId]);

  const setUserId = (uid: string) => {
    setCurrentUserId(uid).catch(console.error); // persist to AsyncStorage for background task
    setUserIdState(uid);
  };

  async function fetchPendingLocations(uid: string) {
    try {
      const db = getFirestore(app);
      // Each user's detected locations are stored under users/{uid}/detected_locations
      const q = query(
        collection(db, 'users', uid, 'detected_locations'),
        where('flashcard_shown', '==', false)
      );
      const snapshot = await getDocs(q);
      const locations: DetectedLocation[] = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<DetectedLocation, 'id'>),
      }));
      setPendingLocations(locations);
    } catch (e) {
      console.error('[AuthContext] fetchPendingLocations failed:', e);
      // CheckInModal falls back to hardcoded locations
    }
  }

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
  };

  const markLocationShown = async (id: string) => {
    if (!userId) return;
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', userId, 'detected_locations', id), { flashcard_shown: true });
    } catch {
      // best effort
    }
    setPendingLocations(prev => prev.filter(l => l.id !== id));
  };

  const logout = () => {
    setToken(null as any);
    setUserIdState(null);
    setCheckInResults([]);
    setPendingLocations([]);
  };

  return (
    <AuthContext.Provider
      value={{ token, setToken, userId, setUserId, logout, checkInResults, addCheckInResult, pendingLocations, markLocationShown }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
