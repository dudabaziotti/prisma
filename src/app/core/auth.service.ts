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
  Unsubscribe,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
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

    const posts = await getDocs(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
    const refs = [...posts.docs.map((d) => d.ref), doc(db, 'users', user.uid)];
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

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
