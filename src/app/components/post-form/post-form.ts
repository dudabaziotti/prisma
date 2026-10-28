import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '../../core/firebase-errors';
import { PostInput, SUBJECT_SUGGESTIONS } from '../../core/models';

export const MAX_POST_LENGTH = 2000;

/** Formulário usado tanto para criar quanto para editar uma publicação. */
@Component({
  selector: 'app-post-form',
  imports: [ReactiveFormsModule],
  templateUrl: './post-form.html',
  styleUrl: './post-form.scss',
})
export class PostForm implements OnInit {
  /** Valores iniciais (modo edição). */
  readonly initial = input<PostInput | null>(null);
  /** Função que salva a publicação; o formulário mostra o carregamento e os erros. */
  readonly save = input.required<(value: PostInput) => Promise<void>>();
  readonly submitLabel = input('Publicar');
  readonly placeholder = input('Compartilhe um material, uma dúvida ou uma dica de estudo...');
  readonly showCancel = input(false);
  readonly disabled = input(false);
  readonly testPrefix = input('post');
  readonly cancel = output<void>();

  readonly subjects = SUBJECT_SUGGESTIONS;
  readonly max = MAX_POST_LENGTH;
  readonly listId = `disciplinas-${Math.random().toString(36).slice(2, 8)}`;

  readonly form = inject(FormBuilder).nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(MAX_POST_LENGTH)]],
    subject: ['', Validators.maxLength(60)],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly length = computed(() => this.value().content?.length ?? 0);
  readonly canSubmit = computed(() => {
    const content = this.value().content?.trim() ?? '';
    return content.length > 0 && content.length <= MAX_POST_LENGTH && (this.value().subject?.length ?? 0) <= 60;
  });

  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    const initial = this.initial();
    if (initial) this.form.setValue({ content: initial.content, subject: initial.subject });
  }

  async submit(): Promise<void> {
    if (!this.canSubmit() || this.busy() || this.disabled()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.save()(this.form.getRawValue());
      if (!this.initial()) this.form.reset();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
