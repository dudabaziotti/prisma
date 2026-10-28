import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Post, avatarUrl } from '../../core/models';

/** Exibe uma publicação do feed. */
@Component({
  selector: 'app-post-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard {
  readonly post = input.required<Post>();
  readonly avatar = computed(() => avatarUrl(this.post().authorAvatar));
}
