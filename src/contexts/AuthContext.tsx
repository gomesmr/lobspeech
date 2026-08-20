import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, testFirestoreConnection } from '../lib/firebase';

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  apiKey: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  generateNewApiKey: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function generateRandomApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'tts_live_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const SUPER_ADMIN_EMAIL = 'gomes.mr@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Enforce strict access control: check if it's the master user
        const userEmail = (currentUser.email || '').toLowerCase().trim();
        const isMaster = userEmail === SUPER_ADMIN_EMAIL.toLowerCase().trim();

        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const existingData = docSnap.data() as UserProfile;
            // Ensure super admin has admin role
            if (isMaster && existingData.role !== 'admin') {
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              setProfile({ ...existingData, role: 'admin' });
            } else {
              setProfile(existingData);
            }
          } else {
            // First time login: create user profile with personal API key
            const newApiKey = generateRandomApiKey();
            const newProfile: UserProfile = {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || (isMaster ? 'Master Admin' : 'Usuário'),
              photoURL: currentUser.photoURL || '',
              apiKey: newApiKey,
              role: isMaster ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error('Erro ao buscar perfil do usuário no Firestore:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  const generateNewApiKey = async (): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    const newApiKey = generateRandomApiKey();
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { apiKey: newApiKey, updatedAt: new Date().toISOString() }, { merge: true });
    setProfile((prev) => (prev ? { ...prev, apiKey: newApiKey } : null));
    return newApiKey;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        generateNewApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
