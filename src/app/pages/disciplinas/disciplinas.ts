import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { Subject } from '../../core/models';
import { SubjectService, sameSubjectName } from '../../core/subject.service';

/** Catálogo de disciplinas: criar, listar, editar e excluir. Só quem criou edita ou exclui. */
@Component({
  selector: 'app-disciplinas',
  imports: [ReactiveFormsModule],
  templateUrl: './disciplinas.html',
  styleUrl: './disciplinas.scss',
})
export class DisciplinasPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(SubjectService);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly subjects = toSignal(this.service.watchAll());
  readonly uid = this.auth.uid;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    description: ['', Validators.maxLength(200)],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly canCreate = computed(() => (this.value().name?.trim().length ?? 0) >= 2);
  readonly creating = signal(false);
  readonly error = signal('');

  readonly editingId = signal<string | null>(null);
  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    description: ['', Validators.maxLength(200)],
  });
  readonly confirmingDelete = signal<string | null>(null);
  readonly busy = signal(false);
  readonly itemError = signal('');

  private exists(name: string, exceptId?: string): boolean {
    return (this.subjects() ?? []).some((s) => s.id !== exceptId && sameSubjectName(s.name, name));
  }

  async create(): Promise<void> {
    const author = this.auth.profile();
    if (!author || !this.canCreate() || this.creating()) return;
    const input = this.form.getRawValue();
    this.error.set('');
    if (this.exists(input.name)) {
      this.error.set('Já existe uma disciplina com esse nome.');
      return;
    }
    this.creating.set(true);
    try {
      await this.service.create(author, input);
      this.form.reset();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.creating.set(false);
    }
  }

  startEdit(s: Subject): void {
    this.confirmingDelete.set(null);
    this.itemError.set('');
    this.editForm.setValue({ name: s.name, description: s.description });
    this.editingId.set(s.id);
  }

  async saveEdit(s: Subject): Promise<void> {
    if (this.editForm.invalid || this.busy()) return;
    const input = this.editForm.getRawValue();
    this.itemError.set('');
    if (this.exists(input.name, s.id)) {
      this.itemError.set('Já existe uma disciplina com esse nome.');
      return;
    }
    await this.run(async () => {
      await this.service.update(s.id, input);
      this.editingId.set(null);
    });
  }

  askDelete(s: Subject): void {
    this.editingId.set(null);
    this.itemError.set('');
    this.confirmingDelete.set(s.id);
  }

  async remove(s: Subject): Promise<void> {
    await this.run(async () => {
      await this.service.remove(s.id);
      this.confirmingDelete.set(null);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (e) {
      this.itemError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
