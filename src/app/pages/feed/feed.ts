import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { FollowService } from '../../core/follow.service';
import { PostInput } from '../../core/models';
import { PostService } from '../../core/post.service';
import { PostCard } from '../../components/post-card/post-card';
import { PostForm } from '../../components/post-form/post-form';

export type FeedTab = 'todos' | 'seguindo';

@Component({
  selector: 'app-feed',
  imports: [PostCard, PostForm],
  templateUrl: './feed.html',
  styleUrl: './feed.scss',
})
export class FeedPage {
  private readonly auth = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly followService = inject(FollowService);

  readonly profile = this.auth.profile;
  /** `undefined` enquanto o feed carrega. */
  readonly posts = toSignal(this.postService.watchFeed());

  /** Feed personalizado (RF10): só publicações de quem o usuário segue, mais as próprias. */
  readonly tab = signal<FeedTab>('todos');
  private readonly following = toSignal(
    toObservable(this.auth.uid).pipe(switchMap((uid) => (uid ? this.followService.watchFollowing(uid) : of([])))),
    { initialValue: [] },
  );
  readonly followingCount = computed(() => this.following().length);
  readonly visible = computed(() => {
    const posts = this.posts();
    if (!posts || this.tab() === 'todos') return posts;
    const ids = new Set(this.following().map((f) => f.followedId));
    const me = this.auth.uid();
    return posts.filter((p) => ids.has(p.authorId) || p.authorId === me);
  });

  readonly create = async (value: PostInput): Promise<void> => {
    const author = this.profile();
    if (!author) throw { code: 'unavailable' };
    await this.postService.create(author, value);
  };
}
