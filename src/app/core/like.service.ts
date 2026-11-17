import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase';
import { deleteRefs } from './firestore-utils';
import { Like, UserProfile } from './models';
import { toDate } from './user.service';

/**
 * Curtidas (RF07): curtir (Create), ver quantas e quem curtiu (Read), atualizar o nome de quem
 * curtiu quando o perfil muda (Update) e descurtir (Delete). Cada usuário curte uma vez só:
 * o documento da curtida usa o uid como id.
 */
@Injectable({ providedIn: 'root' })
export class LikeService {
  private likes(postId: string) {
    return collection(db, 'posts', postId, 'likes');
  }

  watch(postId: string): Observable<Like[]> {
    return new Observable<Like[]>((subscriber) =>
      onSnapshot(
        this.likes(postId),
        (snap) =>
          subscriber.next(
            snap.docs
              .map((d) => {
                const data = d.data({ serverTimestamps: 'estimate' });
                return {
                  uid: d.id,
                  name: data['name'] ?? '',
                  avatar: data['avatar'] ?? '',
                  postAuthorId: data['postAuthorId'] ?? '',
                  createdAt: toDate(data['createdAt']),
                };
              })
              .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)),
          ),
        () => subscriber.next([]),
      ),
    );
  }

  async like(postId: string, postAuthorId: string, user: UserProfile): Promise<void> {
    await setDoc(doc(this.likes(postId), user.uid), {
      uid: user.uid,
      name: user.name,
      avatar: user.avatar,
      postAuthorId,
      createdAt: serverTimestamp(),
    });
  }

  async unlike(postId: string, uid: string): Promise<void> {
    await deleteDoc(doc(this.likes(postId), uid));
  }

  /** Remove todas as curtidas de uma publicação (usado antes de excluir a publicação). */
  async removeAll(postId: string): Promise<void> {
    const snap = await getDocs(this.likes(postId));
    await deleteRefs(snap.docs.map((d) => d.ref));
  }
}
