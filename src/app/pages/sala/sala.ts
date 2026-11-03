import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { MAX_PARTICIPANTS, avatarUrl } from '../../core/models';
import { POMODORO, formatClock, pomodoroState } from '../../core/pomodoro';
import { HEARTBEAT_MS, RoomService, isActive } from '../../core/room.service';

/**
 * Sala de foco: participantes em tempo real (RF15) e cronômetro Pomodoro sincronizado (RF16).
 * O dono edita (Update), exclui (Delete) e controla o cronômetro.
 */
@Component({
  selector: 'app-sala',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sala.html',
  styleUrl: './sala.scss',
})
export class SalaPage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RoomService);
  private readonly router = inject(Router);

  /** Parâmetro :id da rota. */
  readonly id = input.required<string>();

  readonly room = toSignal(toObservable(this.id).pipe(switchMap((id) => this.service.watchRoom(id))));
  private readonly allParticipants = toSignal(
    toObservable(this.id).pipe(switchMap((id) => this.service.watchParticipants(id))),
    { initialValue: [] },
  );

  /** Relógio local, atualizado 4 vezes por segundo para o cronômetro. */
  readonly now = signal(Date.now());
  readonly participants = computed(() => this.allParticipants().filter((p) => isActive(p, this.now())));
  readonly max = MAX_PARTICIPANTS;
  readonly avatarUrl = avatarUrl;

  readonly isOwner = computed(() => !!this.room() && this.room()!.ownerId === this.auth.uid());
  readonly timer = computed(() => {
    const room = this.room();
    return room ? pomodoroState(room.timer, this.now()) : null;
  });
  readonly clock = computed(() => formatClock(this.timer()?.remainingMs ?? POMODORO.focusMs));
  readonly phaseLabel = computed(() => {
    switch (this.timer()?.phase) {
      case 'focus':
        return 'Foco';
      case 'break':
        return 'Pausa';
      case 'finished':
        return 'Sessão concluída';
      default:
        return 'Aguardando início';
    }
  });

  // Entrada na sala
  readonly joined = signal(false);
  readonly full = signal(false);
  private joining = false;

  // Edição e exclusão (só o dono)
  readonly editing = signal(false);
  readonly confirmingDelete = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly editForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    subject: ['', Validators.maxLength(60)],
  });

  private tick?: ReturnType<typeof setInterval>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private readonly onUnload = () => this.leave();

  constructor() {
    // Entra na sala assim que ela e o perfil estiverem carregados.
    effect(() => {
      const room = this.room();
      const profile = this.auth.profile();
      if (!room || !profile || this.joined() || this.full() || this.joining) return;
      this.joining = true;
      this.service.join(room.id, profile).then(
        (ok) => {
          this.joining = false;
          if (ok) {
            this.joined.set(true);
            this.startHeartbeat(room.id, profile.uid);
          } else {
            this.full.set(true);
          }
        },
        (e) => {
          this.joining = false;
          this.error.set(errorMessage(e));
        },
      );
    });
  }

  ngOnInit(): void {
    this.tick = setInterval(() => this.now.set(Date.now()), 250);
    window.addEventListener('beforeunload', this.onUnload);
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
    window.removeEventListener('beforeunload', this.onUnload);
    this.leave();
  }

  async exit(): Promise<void> {
    await this.router.navigate(['/salas']);
  }

  // ---- Cronômetro ----
  start = () => this.run(() => this.service.startTimer(this.id()));
  pause = () => this.run(() => this.service.pauseTimer(this.room()!));
  resume = () => this.run(() => this.service.resumeTimer(this.room()!));
  reset = () => this.run(() => this.service.resetTimer(this.id()));

  // ---- Edição e exclusão ----
  startEdit(): void {
    const room = this.room();
    if (!room) return;
    this.editForm.setValue({ name: room.name, subject: room.subject });
    this.confirmingDelete.set(false);
    this.editing.set(true);
  }

  async saveEdit(): Promise<void> {
    if (this.editForm.invalid) return;
    await this.run(async () => {
      await this.service.update(this.id(), this.editForm.getRawValue());
      this.editing.set(false);
    });
  }

  async remove(): Promise<void> {
    await this.run(async () => {
      clearInterval(this.heartbeat);
      this.joined.set(false);
      await this.service.remove(this.id());
      await this.router.navigate(['/salas']);
    });
  }

  private startHeartbeat(roomId: string, uid: string): void {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => this.service.heartbeat(roomId, uid).catch(() => undefined), HEARTBEAT_MS);
  }

  private leave(): void {
    clearInterval(this.heartbeat);
    const uid = this.auth.uid();
    if (this.joined() && uid) {
      this.joined.set(false);
      this.service.leave(this.id(), uid).catch(() => undefined);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
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