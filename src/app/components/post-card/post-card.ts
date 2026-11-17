import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { Post, PostInput, avatarUrl } from '../../core/models';
import { LikeService } from '../../core/like.service';
import { PostService } from '../../core/post.service';
import { Comments } from '../comments/comments';
import { PostForm } from '../post-form/post-form';

/** Exibe uma publicação. O autor pode editá-la ou excluí-la. */
@Component({
  selector: 'app-post-card',
  imports: [DatePipe, RouterLink, PostForm, Comments],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard {
  private readonly auth = inject(AuthService);
  private readonly posts = inject(PostService);
  private readonly likeService = inject(LikeService);

  readonly post = input.required<Post>();

  readonly isAuthor = computed(() => this.post().authorId === this.auth.uid());
  readonly avatar = computed(() => avatarUrl(this.post().authorAvatar));
  readonly editing = signal(false);
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);
  readonly showComments = signal(false);

  // Curtidas (RF07)
  readonly likes = toSignal(
    toObservable(this.post).pipe(
      map((p) => p.id),
      distinctUntilChanged(),
      switchMap((id) => this.likeService.watch(id)),
    ),
    { initialValue: [] },
  );
  readonly liked = computed(() => this.likes().some((l) => l.uid === this.auth.uid()));
  readonly showLikes = signal(false);
  readonly liking = signal(false);
  readonly error = signal('');

  readonly saveEdit = async (value: PostInput): Promise<void> => {
    await this.posts.update(this.post().id, value);
    this.editing.set(false);
  };

  async toggleLike(): Promise<void> {
    const me = this.auth.profile();
    if (!me || this.liking()) return;
    this.liking.set(true);
    this.error.set('');
    try {
      if (this.liked()) await this.likeService.unlike(this.post().id, me.uid);
      else await this.likeService.like(this.post().id, this.post().authorId, me);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.liking.set(false);
    }
  }

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
