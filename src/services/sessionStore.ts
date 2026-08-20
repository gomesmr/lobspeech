import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { AudioSession } from '../types';

const LOCAL_CUSTOM_TITLES_KEY = 'tts_custom_titles_map';
const LOCAL_DELETED_SESSIONS_KEY = 'tts_deleted_sessions_set';

export function getLocalCustomTitles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_TITLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalCustomTitle(sessionId: string, title: string): void {
  try {
    const titles = getLocalCustomTitles();
    titles[sessionId] = title;
    localStorage.setItem(LOCAL_CUSTOM_TITLES_KEY, JSON.stringify(titles));
  } catch (err) {
    console.warn('Erro ao salvar título no localStorage:', err);
  }
}

export function getLocalDeletedSessions(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markLocalSessionDeleted(sessionId: string): void {
  try {
    const deleted = getLocalDeletedSessions();
    if (!deleted.includes(sessionId)) {
      deleted.push(sessionId);
      localStorage.setItem(LOCAL_DELETED_SESSIONS_KEY, JSON.stringify(deleted));
    }
  } catch (err) {
    console.warn('Erro ao marcar sessão deletada no localStorage:', err);
  }
}

export async function saveAudioSessionToFirestore(userId: string, session: AudioSession): Promise<void> {
  if (!session?.sessionId) return;
  
  if (session.customTitle) {
    saveLocalCustomTitle(session.sessionId, session.customTitle);
  }

  if (!userId) return;
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', session.sessionId);
    await setDoc(sessionRef, session, { merge: true });
  } catch (err) {
    console.error('Erro ao salvar sessão no Firestore:', err);
  }
}

export async function updateAudioSessionInFirestore(userId: string, sessionId: string, updates: Partial<AudioSession>): Promise<void> {
  if (!sessionId) return;

  if (updates.customTitle) {
    saveLocalCustomTitle(sessionId, updates.customTitle);
  }

  if (!userId) return;
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
    await setDoc(sessionRef, updates, { merge: true });
  } catch (err) {
    console.error('Erro ao atualizar sessão no Firestore:', err);
  }
}

export async function deleteAudioSessionFromFirestore(userId: string, sessionId: string): Promise<void> {
  if (!sessionId) return;

  markLocalSessionDeleted(sessionId);

  if (!userId) return;
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
    await deleteDoc(sessionRef);
  } catch (err) {
    console.error('Erro ao deletar sessão no Firestore:', err);
  }
}

export async function fetchAudioSessionsFromFirestore(userId: string): Promise<AudioSession[]> {
  const localDeleted = getLocalDeletedSessions();
  const localTitles = getLocalCustomTitles();

  if (!userId) return [];
  try {
    const sessionsCol = collection(db, 'users', userId, 'sessions');
    const q = query(sessionsCol, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    const results: AudioSession[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AudioSession;
      if (!localDeleted.includes(data.sessionId)) {
        if (localTitles[data.sessionId]) {
          data.customTitle = localTitles[data.sessionId];
        }
        results.push(data);
      }
    });
    return results;
  } catch (err) {
    console.error('Erro ao recuperar sessões do Firestore:', err);
    return [];
  }
}


