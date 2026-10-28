import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { Post, PostInput, avatarUrl } from '../../core/models';
import { PostService } from '../../core/post.service';
import { PostForm } from '../post-form/post-form';

/** Exibe uma publicação. O autor pode editá-la ou excluí-la. */
@Component({
  selector: 'app-post-card',
  imports: [DatePipe, RouterLink, PostForm],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard {
  private readonly auth = inject(AuthService);
  private readonly posts = inject(PostService);

  readonly post = input.required<Post>();

  readonly isAuthor = computed(() => this.post().authorId === this.auth.uid());
  readonly avatar = computed(() => avatarUrl(this.post().authorAvatar));
  readonly editing = signal(false);
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');

  readonly saveEdit = async (value: PostInput): Promise<void> => {
    await this.posts.update(this.post().id, value);
    this.editing.set(false);
  };

  async remove(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');
    try {
      await this.posts.remove(this.post().id);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.deleting.set(false);
    }
  }
}
