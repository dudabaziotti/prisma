import { Injectable } from '@angular/core';
import {
  DocumentData,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase';
import { deleteRefs } from './firestore-utils';
import { followId } from './follow.service';
import { JoinResult, MAX_PARTICIPANTS, Participant, Room, RoomInput, UserProfile } from './models';
import { elapsedMs } from './pomodoro';
import { toDate } from './user.service';

/** Participante sem sinal de vida há mais tempo que isso é considerado fora da sala. */
export const PRESENCE_TIMEOUT_MS = 90_000;
export const HEARTBEAT_MS = 30_000;

function toRoom(id: string, data: DocumentData): Room {
  const timer = data['timer'] ?? {};
  return {
    id,
    name: data['name'] ?? '',
    subject: data['subject'] ?? '',
    ownerId: data['ownerId'],
    ownerName: data['ownerName'] ?? '',
    access: data['access'] === 'followers' ? 'followers' : 'public',
    timer: {
      status: timer['status'] ?? 'idle',
      startedAt: toDate(timer['startedAt']),
      elapsedMs: timer['elapsedMs'] ?? 0,
    },
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

export function isActive(p: Participant, now: number): boolean {
  return !p.lastSeen || now - p.lastSeen.getTime() < PRESENCE_TIMEOUT_MS;
}

/**
 * Salas de foco: criar, listar, editar e excluir (CRUD), entrar e sair,
 * participantes em tempo real e cronômetro Pomodoro sincronizado.
 */
@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly rooms = collection(db, 'rooms');

  private participants(roomId: string) {
    return collection(db, 'rooms', roomId, 'participants');
  }

  watchRooms(): Observable<Room[]> {
    return new Observable<Room[]>((subscriber) =>
      onSnapshot(
        query(this.rooms, orderBy('createdAt', 'desc')),
        (snap) => subscriber.next(snap.docs.map((d) => toRoom(d.id, d.data({ serverTimestamps: 'estimate' })))),
        (err) => {
          console.warn('Falha ao carregar salas:', err.code);
          subscriber.next([]);
        },
      ),
    );
  }

  /** Emite `null` quando a sala não existe (ou foi excluída). */
  watchRoom(id: string): Observable<Room | null> {
    return new Observable<Room | null>((subscriber) =>
      onSnapshot(
        doc(this.rooms, id),
        (snap) => subscriber.next(snap.exists() ? toRoom(snap.id, snap.data({ serverTimestamps: 'estimate' })) : null),
        (err) => {
          console.warn('Falha ao carregar a sala:', err.code);
          subscriber.next(null);
        },
      ),
    );
  }

  watchParticipants(roomId: string): Observable<Participant[]> {
    return new Observable<Participant[]>((subscriber) =>
      onSnapshot(
        query(this.participants(roomId), orderBy('joinedAt', 'asc')),
        (snap) =>
          subscriber.next(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              return {
                uid: d.id,
                name: data['name'] ?? '',
                avatar: data['avatar'] ?? '',
                joinedAt: toDate(data['joinedAt']),
                lastSeen: toDate(data['lastSeen']),
              };
            }),
          ),
        () => subscriber.next([]),
      ),
    );
  }

  async create(owner: UserProfile, input: RoomInput): Promise<string> {
    const ref = await addDoc(this.rooms, {
      name: input.name.trim(),
      subject: input.subject.trim(),
      ownerId: owner.uid,
      ownerName: owner.name,
      access: input.access ?? 'public',
      timer: { status: 'idle', startedAt: null, elapsedMs: 0 },
      createdAt: serverTimestamp(),
      updatedAt: null,
    });
    return ref.id;
  }

  async update(id: string, input: RoomInput): Promise<void> {
    await updateDoc(doc(this.rooms, id), {
      name: input.name.trim(),
      subject: input.subject.trim(),
      ...(input.access ? { access: input.access } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  /** Exclui a sala e, antes, a lista de participantes dela. */
  async remove(id: string): Promise<void> {
    const snap = await getDocs(this.participants(id));
    await deleteRefs(snap.docs.map((d) => d.ref));
    await deleteDoc(doc(this.rooms, id));
  }

  /** Só quem segue o dono entra numa sala "só para seguidores" (RF17). O dono sempre entra. */
  async canJoin(room: Room, uid: string): Promise<boolean> {
    if (room.access !== 'followers' || room.ownerId === uid) return true;
    return (await getDoc(doc(db, 'follows', followId(uid, room.ownerId)))).exists();
  }

  /** Entra na sala. Não entra se ela já estiver cheia (RNF09) ou se for só para seguidores (RF17). */
  async join(room: Room, profile: UserProfile): Promise<JoinResult> {
    const roomId = room.id;
    if (!(await this.canJoin(room, profile.uid))) return 'followers-only';
    const snap = await getDocs(this.participants(roomId));
    const now = Date.now();
    const others = snap.docs.filter((d) => {
      if (d.id === profile.uid) return false;
      const lastSeen = toDate(d.data()['lastSeen']);
      return !lastSeen || now - lastSeen.getTime() < PRESENCE_TIMEOUT_MS;
    });
    if (others.length >= MAX_PARTICIPANTS) return 'full';

    await setDoc(doc(this.participants(roomId), profile.uid), {
      uid: profile.uid,
      name: profile.name,
      avatar: profile.avatar,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
    return 'joined';
  }

  async heartbeat(roomId: string, uid: string): Promise<void> {
    await updateDoc(doc(this.participants(roomId), uid), { lastSeen: serverTimestamp() });
  }

  async leave(roomId: string, uid: string): Promise<void> {
    await deleteDoc(doc(this.participants(roomId), uid));
  }

  // ---- Cronômetro (só o dono da sala controla) ----

  async startTimer(roomId: string): Promise<void> {
    await this.setTimer(roomId, { status: 'running', startedAt: serverTimestamp(), elapsedMs: 0 });
  }

  async pauseTimer(room: Room): Promise<void> {
    await this.setTimer(room.id, { status: 'paused', startedAt: null, elapsedMs: elapsedMs(room.timer, Date.now()) });
  }

  async resumeTimer(room: Room): Promise<void> {
    await this.setTimer(room.id, { status: 'running', startedAt: serverTimestamp(), elapsedMs: room.timer.elapsedMs });
  }

  async resetTimer(roomId: string): Promise<void> {
    await this.setTimer(roomId, { status: 'idle', startedAt: null, elapsedMs: 0 });
  }

  private async setTimer(roomId: string, timer: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(this.rooms, roomId), { timer });
  }
}