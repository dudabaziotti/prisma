import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
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

  constructor() {
    effect(() => {
      const uid = this.targetUid();
      if (!uid || this.isOwn()) return;
      this.other.set(undefined);
      this.users.getProfile(uid).then(
        (p) => this.other.set(p),
        () => this.other.set(null),
      );
    });
  }
}
