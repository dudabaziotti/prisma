import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase';
import { deleteRefs } from './firestore-utils';
import { Comment, UserProfile } from './models';
import { toDate } from './user.service';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private comments(postId: string) {
    return collection(db, 'posts', postId, 'comments');
  }

  watch(postId: string): Observable<Comment[]> {
    return new Observable<Comment[]>((subscriber) =>
      onSnapshot(
        query(this.comments(postId), orderBy('createdAt', 'asc')),
        (snap) =>
          subscriber.next(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              return {
                id: d.id,
                postId,
                authorId: data['authorId'],
                authorName: data['authorName'] ?? '',
                authorAvatar: data['authorAvatar'] ?? '',
                content: data['content'] ?? '',
                parentId: data['parentId'] ?? null,
                createdAt: toDate(data['createdAt']),
                updatedAt: toDate(data['updatedAt']),
              };
            }),
          ),
        (err) => {
          console.warn('Falha ao carregar comentários:', err.code);
          subscriber.next([]);
        },
      ),
    );
  }

  async create(postId: string, author: UserProfile, content: string, parentId: string | null = null): Promise<void> {
    await addDoc(this.comments(postId), {
      authorId: author.uid,
      authorName: author.name,
      authorAvatar: author.avatar,
      content: content.trim(),
      parentId,
      createdAt: serverTimestamp(),
      updatedAt: null,
    });
  }

  async update(postId: string, id: string, content: string): Promise<void> {
    await updateDoc(doc(this.comments(postId), id), { content: content.trim(), updatedAt: serverTimestamp() });
  }

  async remove(postId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.comments(postId), id));
  }

  async removeAll(postId: string): Promise<void> {
    const snap = await getDocs(this.comments(postId));
    await deleteRefs(snap.docs.map((d) => d.ref));
  }
}