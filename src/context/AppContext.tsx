import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Project, MeasurementPoint, MeasurementReading, AppScreen, MeasurementSession } from '../types';

interface AppContextType {
  user: User | null;
  loading: boolean;
  currentScreen: AppScreen;
  setCurrentScreen: (screen: AppScreen) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  currentMeasurementPoint: MeasurementPoint | null;
  setCurrentMeasurementPoint: (point: MeasurementPoint | null) => void;
  measurementSession: MeasurementSession | null;
  setMeasurementSession: (session: MeasurementSession | null) => void;
  currentPhotoData: string | null;
  setCurrentPhotoData: (data: string | null) => void;
  currentLocationGroupName: string | null;
  setCurrentLocationGroupName: (name: string | null) => void;
  currentLocationCount: number | null;
  setCurrentLocationCount: (count: number | null) => void;
  currentLocationIndex: number;
  setCurrentLocationIndex: (index: number) => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentMeasurementPoint, setCurrentMeasurementPoint] = useState<MeasurementPoint | null>(null);
  const [measurementSession, setMeasurementSession] = useState<MeasurementSession | null>(null);
  const [currentPhotoData, setCurrentPhotoData] = useState<string | null>(null);
  const [currentLocationGroupName, setCurrentLocationGroupName] = useState<string | null>(null);
  const [currentLocationCount, setCurrentLocationCount] = useState<number | null>(null);
  const [currentLocationIndex, setCurrentLocationIndex] = useState<number>(1);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCurrentScreen(session?.user ? 'home' : 'login');
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        setCurrentScreen(session?.user ? 'home' : 'login');
      })();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentScreen('login');
    setCurrentProject(null);
    setCurrentMeasurementPoint(null);
    setMeasurementSession(null);
    setCurrentPhotoData(null);
    setCurrentLocationGroupName(null);
    setCurrentLocationCount(null);
    setCurrentLocationIndex(1);
  };

  const value: AppContextType = {
    user,
    loading,
    currentScreen,
    setCurrentScreen,
    currentProject,
    setCurrentProject,
    currentMeasurementPoint,
    setCurrentMeasurementPoint,
    measurementSession,
    setMeasurementSession,
    currentPhotoData,
    setCurrentPhotoData,
    currentLocationGroupName,
    setCurrentLocationGroupName,
    currentLocationCount,
    setCurrentLocationCount,
    currentLocationIndex,
    setCurrentLocationIndex,
    signOut,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
