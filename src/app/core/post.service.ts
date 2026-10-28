import { Injectable } from '@angular/core';
import {
  Query,
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase';
import { Post, PostInput, UserProfile, extractHashtags } from './models';
import { toDate } from './user.service';

/** Publicações: criar, listar no feed, editar e excluir (CRUD completo). */
@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly posts = collection(db, 'posts');

  /** Feed em ordem cronológica, da mais recente para a mais antiga (RF06). */
  watchFeed(): Observable<Post[]> {
    return this.watch(query(this.posts, orderBy('createdAt', 'desc'), limit(100)));
  }

  watchByAuthor(uid: string): Observable<Post[]> {
    return this.watch(query(this.posts, where('authorId', '==', uid), orderBy('createdAt', 'desc')));
  }

  async create(author: UserProfile, input: PostInput): Promise<void> {
    await addDoc(this.posts, {
      authorId: author.uid,
      authorName: author.name,
      authorAvatar: author.avatar,
      content: input.content.trim(),
      subject: input.subject.trim(),
      hashtags: extractHashtags(input.content),
      createdAt: serverTimestamp(),
      updatedAt: null,
    });
  }

  async update(id: string, input: PostInput): Promise<void> {
    await updateDoc(doc(this.posts, id), {
      content: input.content.trim(),
      subject: input.subject.trim(),
      hashtags: extractHashtags(input.content),
      updatedAt: serverTimestamp(),
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.posts, id));
  }

  private watch(q: Query): Observable<Post[]> {
    return new Observable<Post[]>((subscriber) =>
      onSnapshot(
        q,
        (snap) =>
          subscriber.next(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              // Publicações antigas (projeto anterior) guardavam o autor em `author`.
              const legacy = data['author'] ?? {};
              return {
                id: d.id,
                authorId: data['authorId'] ?? legacy.uid ?? '',
                authorName: data['authorName'] ?? legacy.name ?? '',
                authorAvatar: data['authorAvatar'] ?? '',
                content: data['content'] ?? '',
                subject: data['subject'] ?? '',
                hashtags: data['hashtags'] ?? [],
                createdAt: toDate(data['createdAt']),
                updatedAt: toDate(data['updatedAt']),
              };
            }),
          ),
        (err) => {
          console.warn('Falha ao carregar publicações:', err.code);
          subscriber.next([]);
        },
      ),
    );
  }
}
