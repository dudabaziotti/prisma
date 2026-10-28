import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { PostInput } from '../../core/models';
import { PostService } from '../../core/post.service';
import { PostCard } from '../../components/post-card/post-card';
import { PostForm } from '../../components/post-form/post-form';

@Component({
  selector: 'app-feed',
  imports: [PostCard, PostForm],
  templateUrl: './feed.html',
})
export class FeedPage {
  private readonly auth = inject(AuthService);
  private readonly postService = inject(PostService);

  readonly profile = this.auth.profile;
  /** `undefined` enquanto o feed carrega. */
  readonly posts = toSignal(this.postService.watchFeed());

  readonly create = async (value: PostInput): Promise<void> => {
    const author = this.profile();
    if (!author) throw { code: 'unavailable' };
    await this.postService.create(author, value);
  };
}
