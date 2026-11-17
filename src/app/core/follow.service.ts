import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase';
import { Follow, UserProfile } from './models';
import { toDate } from './user.service';

export const followId = (followerId: string, followedId: string) => `${followerId}_${followedId}`;

/**
 * Seguidores (RF09): seguir (Create), listar seguidores e quem eu sigo (Read),
 * atualizar nome e avatar quando o perfil muda (Update), deixar de seguir e remover
 * um seguidor (Delete). O vínculo também libera o feed "Seguindo" (RF10) e as
 * salas só para seguidores (RF17).
 */
@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly follows = collection(db, 'follows');

  /** Quem segue o usuário. */
  watchFollowers(uid: string): Observable<Follow[]> {
    return this.watch('followedId', uid);
  }

  /** Quem o usuário segue. */
  watchFollowing(uid: string): Observable<Follow[]> {
    return this.watch('followerId', uid);
  }

  async follow(me: UserProfile, target: UserProfile): Promise<void> {
    if (me.uid === target.uid) return;
    await setDoc(doc(this.follows, followId(me.uid, target.uid)), {
      followerId: me.uid,
      followerName: me.name,
      followerAvatar: me.avatar,
      followedId: target.uid,
      followedName: target.name,
      followedAvatar: target.avatar,
      createdAt: serverTimestamp(),
    });
  }

  /** Deixar de seguir (quem segue) ou remover um seguidor (quem é seguido). */
  async unfollow(followerId: string, followedId: string): Promise<void> {
    await deleteDoc(doc(this.follows, followId(followerId, followedId)));
  }

  private watch(field: 'followerId' | 'followedId', uid: string): Observable<Follow[]> {
    return new Observable<Follow[]>((subscriber) =>
      onSnapshot(
        query(this.follows, where(field, '==', uid)),
        (snap) =>
          subscriber.next(
            snap.docs
              .map((d) => {
                const data = d.data({ serverTimestamps: 'estimate' });
                return {
                  id: d.id,
                  followerId: data['followerId'],
                  followerName: data['followerName'] ?? '',
                  followerAvatar: data['followerAvatar'] ?? '',
                  followedId: data['followedId'],
                  followedName: data['followedName'] ?? '',
                  followedAvatar: data['followedAvatar'] ?? '',
                  createdAt: toDate(data['createdAt']),
                };
              })
              .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
          ),
        () => subscriber.next([]),
      ),
    );
  }
}
