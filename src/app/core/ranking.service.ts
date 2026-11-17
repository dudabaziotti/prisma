import { Injectable } from '@angular/core';
import { Timestamp, collection, collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { RankingActivity, RankingPeriod, RankingRow } from './models';

/** Pontuação do ranking (RF13). */
export const POINTS = { post: 3, comment: 1, like: 2 } as const;

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  'semana-atual': 'Semana atual',
  'semana-passada': 'Semana passada',
  '30-dias': 'Últimos 30 dias',
};

/** Início e fim (exclusivo) do período. A semana começa na segunda-feira, 00:00. */
export function periodRange(period: RankingPeriod, now = new Date()): { start: Date; end: Date } {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  if (period === 'semana-atual') return { start: monday, end: new Date(now.getTime() + 60_000) };
  if (period === 'semana-passada') {
    const start = new Date(monday);
    start.setDate(start.getDate() - 7);
    return { start, end: monday };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return { start, end: new Date(now.getTime() + 60_000) };
}

/**
 * Monta o ranking: publicação = 3 pontos, comentário = 1 ponto, curtida recebida = 2 pontos.
 * Curtir a própria publicação não conta. Empates dividem a mesma posição.
 */
export function buildRanking(activity: RankingActivity): RankingRow[] {
  const rows = new Map<string, RankingRow>();
  const row = (uid: string, name = '') => {
    let r = rows.get(uid);
    if (!r) {
      r = { position: 0, uid, name: name || activity.names[uid] || 'Usuário', posts: 0, comments: 0, likesReceived: 0, points: 0 };
      rows.set(uid, r);
    }
    return r;
  };
  activity.posts.forEach((p) => row(p.authorId, p.authorName).posts++);
  activity.comments.forEach((c) => row(c.authorId, c.authorName).comments++);
  activity.likes.filter((l) => l.uid !== l.postAuthorId).forEach((l) => row(l.postAuthorId).likesReceived++);

  const list = [...rows.values()];
  list.forEach((r) => (r.points = r.posts * POINTS.post + r.comments * POINTS.comment + r.likesReceived * POINTS.like));
  list.sort((a, b) => b.points - a.points || b.posts - a.posts || a.name.localeCompare(b.name, 'pt-BR'));
  list.forEach((r, i) => (r.position = i > 0 && list[i - 1].points === r.points ? list[i - 1].position : i + 1));
  return list;
}

/** Converte o ranking em CSV (separado por ponto e vírgula, para abrir direto no Excel). */
export function rankingCsv(rows: RankingRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Posição', 'Nome', 'Publicações', 'Comentários', 'Curtidas recebidas', 'Pontos'];
  const lines = rows.map((r) => [r.position, r.name, r.posts, r.comments, r.likesReceived, r.points].map(esc).join(';'));
  return [header.join(';'), ...lines].join('\r\n');
}

/** Relatório de ranking semanal (RF13): busca a atividade do período no Firestore. */
@Injectable({ providedIn: 'root' })
export class RankingService {
  async fetchActivity(start: Date, end: Date): Promise<RankingActivity> {
    const range = [where('createdAt', '>=', Timestamp.fromDate(start)), where('createdAt', '<', Timestamp.fromDate(end))];
    const [posts, comments, likes] = await Promise.all([
      getDocs(query(collection(db, 'posts'), ...range)),
      getDocs(query(collectionGroup(db, 'comments'), ...range)),
      getDocs(query(collectionGroup(db, 'likes'), ...range)),
    ]);
    const activity: RankingActivity = {
      posts: posts.docs.map((d) => ({ authorId: d.get('authorId'), authorName: d.get('authorName') ?? '' })),
      comments: comments.docs.map((d) => ({ authorId: d.get('authorId'), authorName: d.get('authorName') ?? '' })),
      likes: likes.docs.map((d) => ({ uid: d.id, postAuthorId: d.get('postAuthorId') ?? '' })),
      names: {},
    };
    // Quem só recebeu curtidas não aparece nas outras listas: busca o nome no perfil.
    const known = new Set([...activity.posts.map((p) => p.authorId), ...activity.comments.map((c) => c.authorId)]);
    const missing = [...new Set(activity.likes.map((l) => l.postAuthorId))].filter((uid) => uid && !known.has(uid));
    await Promise.all(
      missing.map(async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) activity.names[uid] = snap.get('name');
      }),
    );
    return activity;
  }

  async generate(period: RankingPeriod, now = new Date()): Promise<RankingRow[]> {
    const { start, end } = periodRange(period, now);
    return buildRanking(await this.fetchActivity(start, end));
  }
}
