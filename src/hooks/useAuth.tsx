import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SiteSettings } from '../types';
import { db, withTimeout } from '../lib/db';
import { doc, getDoc, setDoc, onSnapshot } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';

interface AuthContextType {
  user: any | null;
  profile: User | null;
  siteSettings: SiteSettings | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  siteSettings: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Site Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSiteSettings({ id: snap.id, ...snap.data() } as SiteSettings);
      }
    });
    return () => unsub();
  }, []);

  const fetchProfile = async () => {
    const mockUsername = safeStorage.getItem('mock_auth_username');
    const mockPassword = safeStorage.getItem('mock_auth_password');
    if (!mockUsername) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', mockUsername.toLowerCase());
      const userDocSnap = await withTimeout(getDoc(userDocRef));

      if (userDocSnap.exists()) {
        const uData = userDocSnap.data() as User;
        if (mockPassword && uData.password === mockPassword) {
          setUser({ uid: uData.id, email: uData.email, displayName: uData.name });
          setProfile(uData);
        } else {
          console.warn("Security Hardening Alert: Unauthorized access or stale credentials. Cleared session.");
          safeStorage.removeItem('mock_auth_username');
          safeStorage.removeItem('mock_auth_password');
          setUser(null);
          setProfile(null);
        }
      } else {
        // If the profile does not exist in Firestore, only bootstrap if it's admin with correct password
        if (mockUsername.toLowerCase() === 'admin' && mockPassword === '123456') {
          const initialUser: User = {
            id: 'admin',
            email: 'admin@system.local',
            name: 'مدیریت کل',
            isAdmin: true,
            username: 'admin',
            password: '123456',
            createdAt: new Date().toISOString()
          };
          await withTimeout(setDoc(userDocRef, initialUser)).catch(e => console.warn(e));
          setUser({ uid: initialUser.id, email: initialUser.email, displayName: initialUser.name });
          setProfile(initialUser);
        } else {
          safeStorage.removeItem('mock_auth_username');
          safeStorage.removeItem('mock_auth_password');
          setUser(null);
          setProfile(null);
        }
      }
    } catch (err) {
      console.error("Error reading auth profile from Firestore:", err);
      // Fallback local memory representation if Firestore offline/blocked on initial load
      const isAdmin = mockUsername.toLowerCase() === 'admin';
      
      let offlineUsers: Record<string, any> = {};
      try {
        const offlineUsersJson = safeStorage.getItem('offline_users');
        if (offlineUsersJson) {
          offlineUsers = JSON.parse(offlineUsersJson);
        }
      } catch (e) {}

      const cachedUser = offlineUsers[mockUsername.toLowerCase()];
      if (cachedUser && mockPassword && cachedUser.password === mockPassword) {
        setUser({ uid: cachedUser.id, email: cachedUser.email, displayName: cachedUser.name });
        setProfile(cachedUser);
      } else if (isAdmin && mockPassword === '123456') {
        const fallbackProfile: User = {
          id: 'admin',
          email: 'admin@system.local',
          name: 'مدیریت کل',
          isAdmin: true,
          username: 'admin',
          password: '123456',
          createdAt: new Date().toISOString()
        };
        setUser({ uid: 'admin', email: fallbackProfile.email, displayName: fallbackProfile.name });
        setProfile(fallbackProfile);
      } else {
        safeStorage.removeItem('mock_auth_username');
        safeStorage.removeItem('mock_auth_password');
        setUser(null);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    const handleAuthChange = () => {
      fetchProfile();
    };

    window.addEventListener('auth-state-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-state-change', handleAuthChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, siteSettings, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
