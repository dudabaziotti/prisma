import { Injectable, computed, signal } from '@angular/core';
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  CollectionReference,
  Query,
  Unsubscribe,
  collection,
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { deleteRefs } from './firestore-utils';
import { DEFAULT_AVATAR, UserProfile } from './models';
import { toProfile } from './user.service';

/**
 * Sessão do usuário: cadastro (Create), login/logout e exclusão de conta (Delete).
 * Também mantém o perfil do usuário logado sempre atualizado em `profile`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null | undefined>(undefined);
  private readonly _profile = signal<UserProfile | null>(null);
  private stopProfile: Unsubscribe | null = null;
  private readonly ready: Promise<void>;

  /** `undefined` enquanto o Firebase ainda verifica a sessão. */
  readonly user = this._user.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly uid = computed(() => this._user()?.uid ?? null);

  constructor() {
    this.ready = new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        this._user.set(user);
        this.listenToProfile(user);
        resolve();
      });
    });
  }

  /** Aguarda a verificação inicial da sessão (usado pelos guards de rota). */
  async currentUser(): Promise<User | null> {
    await this.ready;
    return this._user() ?? null;
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await setDoc(doc(db, 'users', user.uid), {
      name,
      bio: '',
      interests: [],
      avatar: DEFAULT_AVATAR,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async logout(): Promise<void> {
    this.listenToProfile(null);
    await signOut(auth);
  }

  /**
   * Exclui a conta do usuário logado: publicações, perfil e login.
   * O Firebase exige que o usuário confirme a senha antes de excluir a conta.
   */
  async deleteAccount(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user?.email) throw { code: 'auth/requires-recent-login' };

    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

    const uid = user.uid;
    const refsOf = async (q: Query | CollectionReference) => (await getDocs(q)).docs.map((d) => d.ref);

    // A ordem importa: as regras do Firestore conferem o dono de cada documento.
    // 1. Comentários do usuário em qualquer publicação.
    await deleteRefs(await refsOf(query(collectionGroup(db, 'comments'), where('authorId', '==', uid))));
    // 2. Publicações do usuário, cada uma com os comentários de outras pessoas.
    const posts = await refsOf(query(collection(db, 'posts'), where('authorId', '==', uid)));
    for (const post of posts) {
      await deleteRefs(await refsOf(collection(post, 'comments')));
    }
    await deleteRefs(posts);
    // 3. Presença em salas de foco e salas criadas pelo usuário (com os participantes).
    await deleteRefs(await refsOf(query(collectionGroup(db, 'participants'), where('uid', '==', uid))));
    const rooms = await refsOf(query(collection(db, 'rooms'), where('ownerId', '==', uid)));
    for (const room of rooms) {
      await deleteRefs(await refsOf(collection(room, 'participants')));
    }
    await deleteRefs(rooms);
    // 4. Perfil.
    await deleteRefs([doc(db, 'users', uid)]);

    this.listenToProfile(null);
    await deleteUser(user);
  }

  private listenToProfile(user: User | null): void {
    this.stopProfile?.();
    this.stopProfile = null;
    this._profile.set(null);
    if (!user) return;

    this.stopProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => this._profile.set(snap.exists() ? toProfile(snap.id, snap.data()) : null),
      (err) => console.warn('Perfil indisponível:', err.code),
    );
  }
}