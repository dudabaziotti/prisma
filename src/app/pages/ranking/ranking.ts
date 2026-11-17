import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { RankingPeriod, RankingRow } from '../../core/models';
import { PERIOD_LABELS, POINTS, RankingService, periodRange, rankingCsv } from '../../core/ranking.service';

/** Relatório "Ranking semanal" (RF13): quem mais participou no período, com exportação em CSV e impressão. */
@Component({
  selector: 'app-ranking',
  imports: [DatePipe, RouterLink],
  templateUrl: './ranking.html',
  styleUrl: './ranking.scss',
})
export class RankingPage {
  private readonly service = inject(RankingService);
  readonly uid = inject(AuthService).uid;

  readonly points = POINTS;
  readonly periods = Object.entries(PERIOD_LABELS) as [RankingPeriod, string][];
  readonly period = signal<RankingPeriod>('semana-atual');
  readonly periodLabel = computed(() => PERIOD_LABELS[this.period()]);
  readonly range = computed(() => periodRange(this.period(), this.generatedAt() ?? new Date()));
  readonly rows = signal<RankingRow[] | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly generatedAt = signal<Date | null>(null);

  readonly totals = computed(() => {
    const rows = this.rows() ?? [];
    return {
      people: rows.length,
      posts: rows.reduce((s, r) => s + r.posts, 0),
      comments: rows.reduce((s, r) => s + r.comments, 0),
      likes: rows.reduce((s, r) => s + r.likesReceived, 0),
    };
  });

  readonly csvHref = computed(() => 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + rankingCsv(this.rows() ?? [])));
  readonly csvName = computed(() => `ranking-prisma-${this.period()}.csv`);
  /** Fim do período para exibir (o fim real é exclusivo). */
  readonly rangeEnd = computed(() => new Date(Math.min(this.range().end.getTime() - 1, (this.generatedAt() ?? new Date()).getTime())));

  constructor() {
    void this.generate();
  }

  select(period: string): void {
    this.period.set(period as RankingPeriod);
    void this.generate();
  }

  async generate(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const now = new Date();
    try {
      const rows = await this.service.generate(this.period(), now);
      this.generatedAt.set(now);
      this.rows.set(rows);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  print(): void {
    window.print();
  }
}
