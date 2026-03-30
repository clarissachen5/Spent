import React, { createContext, useContext, useState } from 'react';

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
  setPredictions: (p: SpendingEstimate[]) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
  checkInResults: [],
  addCheckInResult: () => {},
  predictions: [],
  setPredictions: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);
  const [predictions, setPredictions] = useState<SpendingEstimate[]>([]);

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
  };

  const logout = () => {
    setToken(null as any);
    setCheckInResults([]);
    setPredictions([]);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, logout, checkInResults, addCheckInResult, predictions, setPredictions }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
