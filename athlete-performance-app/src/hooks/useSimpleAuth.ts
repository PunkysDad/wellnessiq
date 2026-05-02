import { useState, useEffect } from 'react';

// Simple mock user for development
interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  sport: string;
  position: string;
  tier: string;
}

interface UseSimpleAuthReturn {
  user: MockUser | null;
  initializing: boolean;
  signIn: () => void;
  signOut: () => void;
}

export function useSimpleAuth(): UseSimpleAuthReturn {
  const [user, setUser] = useState<MockUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      // Auto sign-in with mock user for development
      const mockUser: MockUser = {
        uid: 'dev-user-123',
        email: 'dev@gameiq.app',
        displayName: 'Dev Athlete',
        photoURL: 'https://via.placeholder.com/150',
        sport: 'Basketball',
        position: 'Point Guard', 
        tier: 'premium' // Give dev user premium access
      };
      
      setUser(mockUser);
      setInitializing(false);
      
      console.log('Mock user auto-signed in:', mockUser);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const signIn = () => {
    const mockUser: MockUser = {
      uid: 'dev-user-123',
      email: 'dev@gameiq.app', 
      displayName: 'Dev Athlete',
      photoURL: 'https://via.placeholder.com/150',
      sport: 'Basketball',
      position: 'Point Guard',
      tier: 'premium'
    };
    
    setUser(mockUser);
    console.log('Mock user signed in');
  };

  const signOut = () => {
    setUser(null);
    console.log('Mock user signed out');
  };

  return {
    user,
    initializing,
    signIn,
    signOut
  };
}