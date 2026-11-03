import { Injectable } from '@angular/core';
import { updateProfile } from 'firebase/auth';
import {
  DocumentData,
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { updateRefs } from './firestore-utils';
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

    // Publicações, comentários e salas guardam o nome do autor; atualiza para refletir o novo perfil.
    const author = { authorName: changes.name, authorAvatar: changes.avatar };
    const posts = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)));
    await updateRefs(posts.docs.map((d) => d.ref), author);
    const comments = await getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', uid)));
    await updateRefs(comments.docs.map((d) => d.ref), author);
    const rooms = await getDocs(query(collection(db, 'rooms'), where('ownerId', '==', uid)));
    await updateRefs(rooms.docs.map((d) => d.ref), { ownerName: changes.name });
  }
}