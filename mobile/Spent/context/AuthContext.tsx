import React, { createContext, useContext, useState } from 'react';

export interface CheckInResult {
  location: string;
  category: string;
  visited: boolean;
  amount: number;
  timestamp: Date;
}

interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  checkInResults: CheckInResult[];
  addCheckInResult: (result: CheckInResult) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  checkInResults: [],
  addCheckInResult: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checkInResults, setCheckInResults] = useState<CheckInResult[]>([]);

  const addCheckInResult = (result: CheckInResult) => {
    setCheckInResults(prev => [...prev, result]);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, checkInResults, addCheckInResult }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
