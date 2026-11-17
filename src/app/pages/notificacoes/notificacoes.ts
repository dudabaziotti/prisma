import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { AppNotification, avatarUrl } from '../../core/models';
import { NotificationService } from '../../core/notification.service';

/** Central de notificações (RF12): listar, marcar como lida e excluir. */
@Component({
  selector: 'app-notificacoes',
  imports: [DatePipe],
  templateUrl: './notificacoes.html',
  styleUrl: './notificacoes.scss',
})
export class NotificacoesPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(NotificationService);
  private readonly router = inject(Router);

  readonly avatarUrl = avatarUrl;
  readonly notifications = toSignal(
    toObservable(this.auth.uid).pipe(switchMap((uid) => (uid ? this.service.watch(uid) : of([])))),
  );
  readonly unread = computed(() => (this.notifications() ?? []).filter((n) => !n.read).length);
  readonly confirmingClear = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  message(n: AppNotification): string {
    switch (n.type) {
      case 'like':
        return 'curtiu sua publicação';
      case 'comment':
        return 'comentou na sua publicação';
      case 'reply':
        return 'respondeu ao seu comentário';
      default:
        return 'começou a seguir você';
    }
  }

  /** Abrir a notificação: marca como lida e vai para o perfil de quem fez a ação. */
  async open(n: AppNotification): Promise<void> {
    if (!n.read) await this.service.markRead(n.id).catch(() => undefined);
    await this.router.navigate(['/perfil', n.actorId]);
  }

  markRead = (n: AppNotification) => this.run(() => this.service.markRead(n.id));
  remove = (n: AppNotification) => this.run(() => this.service.remove(n.id));
  markAllRead = () => this.run(() => this.service.markAllRead(this.auth.uid()!));

  async clear(): Promise<void> {
    await this.run(async () => {
      await this.service.clear(this.auth.uid()!);
      this.confirmingClear.set(false);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy() || !this.auth.uid()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
