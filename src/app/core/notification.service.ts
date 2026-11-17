import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
import { deleteRefs, updateRefs } from './firestore-utils';
import { AppNotification, MAX_NOTIFICATIONS, NotificationInput, NotificationType, UserProfile } from './models';
import { toDate } from './user.service';

const TYPES: NotificationType[] = ['like', 'comment', 'reply', 'follow'];

/** Corta o texto para caber na notificação. */
export function excerptOf(text: string, max = 80): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/**
 * Notificações (RF12): criadas quando alguém curte, comenta ou responde uma publicação
 * ou começa a seguir o usuário (Create); listadas em tempo real (Read); marcadas como
 * lidas (Update); excluídas uma a uma ou todas de uma vez (Delete).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifications = collection(db, 'notifications');

  watch(uid: string): Observable<AppNotification[]> {
    const q = query(this.notifications, where('recipientId', '==', uid), orderBy('createdAt', 'desc'), limit(MAX_NOTIFICATIONS));
    return new Observable<AppNotification[]>((subscriber) =>
      onSnapshot(
        q,
        (snap) =>
          subscriber.next(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              return {
                id: d.id,
                recipientId: data['recipientId'],
                actorId: data['actorId'],
                actorName: data['actorName'] ?? '',
                actorAvatar: data['actorAvatar'] ?? '',
                type: TYPES.includes(data['type']) ? data['type'] : 'like',
                postId: data['postId'] ?? null,
                excerpt: data['excerpt'] ?? '',
                read: data['read'] === true,
                createdAt: toDate(data['createdAt']),
              };
            }),
          ),
        () => subscriber.next([]),
      ),
    );
  }

  /**
   * Cria a notificação para outra pessoa. Não notifica a si mesmo. Uma falha aqui
   * não pode desfazer a ação principal (curtir, comentar, seguir), então só registra o erro.
   */
  async notify(actor: UserProfile, input: NotificationInput): Promise<void> {
    if (!input.recipientId || input.recipientId === actor.uid) return;
    try {
      await addDoc(this.notifications, {
        recipientId: input.recipientId,
        actorId: actor.uid,
        actorName: actor.name,
        actorAvatar: actor.avatar,
        type: input.type,
        postId: input.postId ?? null,
        excerpt: excerptOf(input.excerpt ?? ''),
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Notificação não enviada:', e);
    }
  }

  async markRead(id: string): Promise<void> {
    await updateDoc(doc(this.notifications, id), { read: true });
  }

  async markAllRead(uid: string): Promise<void> {
    const snap = await getDocs(query(this.notifications, where('recipientId', '==', uid), where('read', '==', false)));
    await updateRefs(snap.docs.map((d) => d.ref), { read: true });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.notifications, id));
  }

  async clear(uid: string): Promise<void> {
    const snap = await getDocs(query(this.notifications, where('recipientId', '==', uid)));
    await deleteRefs(snap.docs.map((d) => d.ref));
  }
}
