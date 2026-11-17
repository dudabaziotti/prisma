import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { FollowService } from '../../core/follow.service';
import { NotificationService } from '../../core/notification.service';
import { UserProfile, avatarUrl } from '../../core/models';
import { PostService } from '../../core/post.service';
import { UserService } from '../../core/user.service';
import { PostCard } from '../../components/post-card/post-card';

/** Visualização de perfil (Read). Sem :uid na URL, mostra o perfil do usuário logado. */
@Component({
  selector: 'app-perfil',
  imports: [DatePipe, RouterLink, PostCard],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilPage {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly postService = inject(PostService);
  private readonly followService = inject(FollowService);
  private readonly notifications = inject(NotificationService);

  /** Parâmetro :uid da rota. */
  readonly uid = input<string>();

  readonly targetUid = computed(() => this.uid() || this.auth.uid());
  readonly isOwn = computed(() => this.targetUid() === this.auth.uid());

  /** Perfil de outro usuário: `undefined` carregando, `null` não encontrado. */
  private readonly other = signal<UserProfile | null | undefined>(undefined);
  readonly profile = computed(() => (this.isOwn() ? this.auth.profile() : this.other()));
  readonly notFound = computed(() => !this.isOwn() && this.other() === null);
  readonly avatar = computed(() => avatarUrl(this.profile()?.avatar));

  readonly posts = toSignal(
    toObservable(this.targetUid).pipe(
      switchMap((uid) => (uid ? this.postService.watchByAuthor(uid) : of([]))),
    ),
  );

  // Seguidores (RF09)
  readonly followers = toSignal(
    toObservable(this.targetUid).pipe(switchMap((uid) => (uid ? this.followService.watchFollowers(uid) : of([])))),
    { initialValue: [] },
  );
  readonly following = toSignal(
    toObservable(this.targetUid).pipe(switchMap((uid) => (uid ? this.followService.watchFollowing(uid) : of([])))),
    { initialValue: [] },
  );
  /** O usuário logado segue este perfil. */
  readonly amFollowing = computed(() => this.followers().some((f) => f.followerId === this.auth.uid()));
  /** Este perfil segue o usuário logado. */
  readonly followsMe = computed(() => this.following().some((f) => f.followedId === this.auth.uid()));
  readonly list = signal<'followers' | 'following' | null>(null);
  readonly followBusy = signal(false);
  readonly followError = signal('');
  readonly avatarOf = avatarUrl;

  toggleList(which: 'followers' | 'following'): void {
    this.list.set(this.list() === which ? null : which);
  }

  async toggleFollow(): Promise<void> {
    const me = this.auth.profile();
    const target = this.profile();
    if (!me || !target || this.isOwn()) return;
    await this.runFollow(async () => {
      if (this.amFollowing()) {
        await this.followService.unfollow(me.uid, target.uid);
      } else {
        await this.followService.follow(me, target);
        void this.notifications.notify(me, { recipientId: target.uid, type: 'follow' });
      }
    });
  }

  /** No próprio perfil: remover um seguidor ou deixar de seguir alguém da lista. */
  async removeFollower(followerId: string): Promise<void> {
    const me = this.auth.uid();
    if (me) await this.runFollow(() => this.followService.unfollow(followerId, me));
  }

  async stopFollowing(followedId: string): Promise<void> {
    const me = this.auth.uid();
    if (me) await this.runFollow(() => this.followService.unfollow(me, followedId));
  }

  private async runFollow(action: () => Promise<void>): Promise<void> {
    if (this.followBusy()) return;
    this.followBusy.set(true);
    this.followError.set('');
    try {
      await action();
    } catch (e) {
      this.followError.set(errorMessage(e));
    } finally {
      this.followBusy.set(false);
    }
  }

  constructor() {
    effect(() => {
      const uid = this.targetUid();
      this.list.set(null);
      if (!uid || this.isOwn()) return;
      this.other.set(undefined);
      this.users.getProfile(uid).then(
        (p) => this.other.set(p),
        () => this.other.set(null),
      );
    });
  }
}
