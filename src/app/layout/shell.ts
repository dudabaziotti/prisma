import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { avatarUrl } from '../core/models';
import { NotificationService } from '../core/notification.service';

/** Layout das páginas internas: cabeçalho com navegação e área de conteúdo. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly profile = this.auth.profile;
  readonly avatar = computed(() => avatarUrl(this.profile()?.avatar));
  /** Contador de notificações não lidas no menu (RF12). */
  readonly unread = toSignal(
    toObservable(this.auth.uid).pipe(
      switchMap((uid) => (uid ? this.notifications.watch(uid) : of([]))),
      map((list) => list.filter((n) => !n.read).length),
    ),
    { initialValue: 0 },
  );

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
