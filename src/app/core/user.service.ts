import { Injectable } from '@angular/core';
import { updateProfile } from 'firebase/auth';
import {
  DocumentData,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ProfileChanges, UserProfile } from './models';

export function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  return value instanceof Date ? value : null;
}

export function toProfile(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    name: data['name'] ?? '',
    bio: data['bio'] ?? '',
    interests: data['interests'] ?? [],
    avatar: data['avatar'] ?? '',
    createdAt: toDate(data['createdAt']),
  };
}

/** Perfil do usuário: visualizar (Read) e editar (Update). */
@Injectable({ providedIn: 'root' })
export class UserService {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? toProfile(snap.id, snap.data()) : null;
  }

  async updateProfile(uid: string, changes: ProfileChanges): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { ...changes, updatedAt: serverTimestamp() });

    if (auth.currentUser?.uid === uid) {
      await updateProfile(auth.currentUser, { displayName: changes.name });
    }

    // As publicações guardam nome e avatar do autor; atualiza para refletir o novo perfil.
    const posts = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)));
    for (let i = 0; i < posts.docs.length; i += 400) {
      const batch = writeBatch(db);
      posts.docs.slice(i, i + 400).forEach((d) =>
        batch.update(d.ref, { authorName: changes.name, authorAvatar: changes.avatar }),
      );
      await batch.commit();
    }
  }
}
