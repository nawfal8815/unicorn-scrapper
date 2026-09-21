import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  async function signInWithGoogle() {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message);
      }
    }
  }

  async function signOutUser() {
    await firebaseSignOut(auth);
  }

  async function getIdToken(forceRefresh = false) {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }

  const value = { user, initializing, authError, signInWithGoogle, signOutUser, getIdToken };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
