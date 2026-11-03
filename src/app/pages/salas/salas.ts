import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { Room, SUBJECT_SUGGESTIONS } from '../../core/models';
import { RoomService } from '../../core/room.service';

/** Lista as salas de foco (Read) e cria novas (Create). */
@Component({
  selector: 'app-salas',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './salas.html',
  styleUrl: './salas.scss',
})
export class SalasPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RoomService);
  private readonly router = inject(Router);

  readonly rooms = toSignal(this.service.watchRooms());
  readonly profile = this.auth.profile;
  readonly subjects = SUBJECT_SUGGESTIONS;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    subject: ['', Validators.maxLength(60)],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly canCreate = computed(() => (this.value().name?.trim().length ?? 0) >= 2);
  readonly creating = signal(false);
  readonly error = signal('');

  status(room: Room): string {
    switch (room.timer.status) {
      case 'running':
        return 'Em andamento';
      case 'paused':
        return 'Pausada';
      default:
        return 'Aguardando início';
    }
  }

  async create(): Promise<void> {
    const owner = this.profile();
    if (!owner || !this.canCreate() || this.creating()) return;
    this.creating.set(true);
    this.error.set('');
    try {
      const id = await this.service.create(owner, this.form.getRawValue());
      await this.router.navigate(['/salas', id]);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.creating.set(false);
    }
  }
}