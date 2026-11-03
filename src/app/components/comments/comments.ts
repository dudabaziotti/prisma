import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CommentService } from '../../core/comment.service';
import { errorMessage } from '../../core/firebase-errors';
import { Comment, MAX_COMMENT_LENGTH, avatarUrl } from '../../core/models';

interface Thread {
  comment: Comment;
  replies: Comment[];
}
@Component({
  selector: 'app-comments',
  imports: [DatePipe, FormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './comments.html',
  styleUrl: './comments.scss',
})
export class Comments {
  private readonly auth = inject(AuthService);
  private readonly service = inject(CommentService);

  readonly postId = input.required<string>();
  readonly postAuthorId = input.required<string>();

  readonly max = MAX_COMMENT_LENGTH;
  readonly avatarUrl = avatarUrl;
  readonly uid = this.auth.uid;

  readonly comments = toSignal(toObservable(this.postId).pipe(switchMap((id) => this.service.watch(id))));

  readonly threads = computed<Thread[]>(() => {
    const list = this.comments() ?? [];
    const ids = new Set(list.filter((c) => !c.parentId).map((c) => c.id));
    const roots = list.filter((c) => !c.parentId || !ids.has(c.parentId));
    return roots.map((comment) => ({ comment, replies: list.filter((c) => c.parentId === comment.id) }));
  });

  // Novo comentário
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly error = signal('');

  // Resposta, edição e exclusão (uma de cada vez)
  readonly replyingTo = signal<string | null>(null);
  readonly replyDraft = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editDraft = signal('');
  readonly confirmingDelete = signal<string | null>(null);
  readonly busy = signal(false);

  canEdit(c: Comment): boolean {
    return c.authorId === this.uid();
  }

  canDelete(c: Comment): boolean {
    return c.authorId === this.uid() || this.postAuthorId() === this.uid();
  }

  valid(text: string): boolean {
    const t = text.trim();
    return t.length > 0 && t.length <= MAX_COMMENT_LENGTH;
  }

    async send(): Promise<void> {
    await this.run(async () => {
      const text = this.draft();
      await this.service.create(this.postId(), this.author(), text);
      if (this.draft() === text) this.draft.set('');
    }, this.sending);
  }

  startReply(c: Comment): void {
    this.cancelAll();
    this.replyingTo.set(c.id);
  }

  async sendReply(parent: Comment): Promise<void> {
    await this.run(async () => {
      await this.service.create(this.postId(), this.author(), this.replyDraft(), parent.id);
      this.cancelAll();
    });
  }

  startEdit(c: Comment): void {
    this.cancelAll();
    this.editingId.set(c.id);
    this.editDraft.set(c.content);
  }

  async saveEdit(c: Comment): Promise<void> {
    await this.run(async () => {
      await this.service.update(this.postId(), c.id, this.editDraft());
      this.cancelAll();
    });
  }

  askDelete(c: Comment): void {
    this.cancelAll();
    this.confirmingDelete.set(c.id);
  }

  async remove(c: Comment): Promise<void> {
    await this.run(async () => {
      await this.service.remove(this.postId(), c.id);
      this.cancelAll();
    });
  }

  cancelAll(): void {
    this.replyingTo.set(null);
    this.replyDraft.set('');
    this.editingId.set(null);
    this.editDraft.set('');
    this.confirmingDelete.set(null);
    this.error.set('');
  }

  private author() {
    const profile = this.auth.profile();
    if (!profile) throw { code: 'unavailable' };
    return profile;
  }

  private async run(action: () => Promise<void>, flag = this.busy): Promise<void> {
    if (flag()) return;
    flag.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      flag.set(false);
    }
  }
}