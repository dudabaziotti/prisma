import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UserProfile, avatarUrl } from '../../core/models';
import { UserService } from '../../core/user.service';

/** Visualização de perfil (Read). Sem :uid na URL, mostra o perfil do usuário logado. */
@Component({
  selector: 'app-perfil',
  imports: [DatePipe, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilPage {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);

  /** Parâmetro :uid da rota. */
  readonly uid = input<string>();

  readonly targetUid = computed(() => this.uid() || this.auth.uid());
  readonly isOwn = computed(() => this.targetUid() === this.auth.uid());

  /** Perfil de outro usuário: `undefined` carregando, `null` não encontrado. */
  private readonly other = signal<UserProfile | null | undefined>(undefined);
  readonly profile = computed(() => (this.isOwn() ? this.auth.profile() : this.other()));
  readonly notFound = computed(() => !this.isOwn() && this.other() === null);
  readonly avatar = computed(() => avatarUrl(this.profile()?.avatar));

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
