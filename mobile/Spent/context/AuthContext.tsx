import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { startLocationTracking } from '../services/LocationTracker';

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
  logout: () => void;
  checkInResults: CheckInResult[];
  addCheckInResult: (result: CheckInResult) => void;
  pendingLocations: DetectedLocation[];
  markLocationShown: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
  checkInResults: [],
  addCheckInResult: () => {},
  pendingLocations: [],
  markLocationShown: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [pendingLocations, setPendingLocations] = useState<DetectedLocation[]>([]);

  // Start location tracking and fetch any pending flashcards when the app loads
  useEffect(() => {
    startLocationTracking().catch(console.error);
    fetchPendingLocations();
  }, []);

  async function fetchPendingLocations() {
    try {
      const resp = await axios.get<DetectedLocation[]>(`${API_BASE_URL}/detected-locations/pending`);
      setPendingLocations(resp.data);
    } catch (e) {
      // Backend unreachable — silently fall back to hardcoded locations in CheckInModal
    }
  }

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
  };

  const markLocationShown = async (id: string) => {
    try {
      await axios.patch(`${API_BASE_URL}/detected-locations/${id}/shown`);
      setPendingLocations(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      // If the request fails, remove from local state anyway so the user isn't stuck
      setPendingLocations(prev => prev.filter(l => l.id !== id));
    }
  };

  const logout = () => {
    setToken(null as any);
    setCheckInResults([]);
    setPendingLocations([]);
  };

  return (
    <AuthContext.Provider
      value={{ token, setToken, logout, checkInResults, addCheckInResult, pendingLocations, markLocationShown }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
