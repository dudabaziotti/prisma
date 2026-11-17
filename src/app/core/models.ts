export interface UserProfile {
  uid: string;
  name: string;
  bio: string;
  interests: string[];
  avatar: string;
  createdAt: Date | null;
}

export interface ProfileChanges {
  name: string;
  bio: string;
  interests: string[];
  avatar: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  subject: string;
  hashtags: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PostInput {
  content: string;
  subject: string;
}

export const AVATARS = [
  'coruja', 'raposa', 'gato', 'coelho', 'pinguim', 'baleia', 'polvo', 'tubarao',
  'esquilo', 'alpaca', 'elefante', 'flamingo', 'papagaio', 'caranguejo', 'sapo',
] as const;

export const DEFAULT_AVATAR = 'coruja';

export function avatarUrl(avatar: string | null | undefined): string {
  return `avatars/${avatar || DEFAULT_AVATAR}.png`;
}

export const SUBJECT_SUGGESTIONS = [
  'Cálculo', 'Álgebra Linear', 'Física', 'Química', 'Programação', 'Estruturas de Dados',
  'Banco de Dados', 'Engenharia de Software', 'Gerência de Projetos', 'Redes de Computadores',
  'Sistemas Operacionais', 'Circuitos Elétricos', 'Estatística', 'Inglês',
];

/** Extrai as hashtags do texto (ex.: "#prova #calculo") em minúsculas e sem repetição. */
export function extractHashtags(text: string): string[] {
  const tags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(tags.map((t) => t.slice(1).toLowerCase()))].slice(0, 20);
}

/** Converte "a, b , c" em ["a", "b", "c"]. */
export function parseInterests(text: string): string[] {
  return [...new Set(text.split(',').map((i) => i.trim()).filter(Boolean))].slice(0, 10);
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  /** Comentário respondido (um nível de resposta). `null` para comentários principais. */
  parentId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const MAX_COMMENT_LENGTH = 1000;


export type TimerStatus = 'idle' | 'running' | 'paused';

export interface RoomTimer {
  status: TimerStatus;
  startedAt: Date | null;
  /** Tempo acumulado antes da última pausa, em milissegundos. */
  elapsedMs: number;
}

export interface Room {
  id: string;
  name: string;
  subject: string;
  ownerId: string;
  ownerName: string;
  timer: RoomTimer;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface RoomInput {
  name: string;
  subject: string;
}

export interface Participant {
  uid: string;
  name: string;
  avatar: string;
  joinedAt: Date | null;
  lastSeen: Date | null;
}

/** Limite de participantes por sala (RNF09). */
export const MAX_PARTICIPANTS = 10;
/** Disciplina do catálogo (RF05): usada para categorizar publicações e salas. */
export interface Subject {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SubjectInput {
  name: string;
  description: string;
}

/** Curtida de uma publicação (RF07). O id do documento é o uid de quem curtiu. */
export interface Like {
  uid: string;
  name: string;
  avatar: string;
  postAuthorId: string;
  createdAt: Date | null;
}

/** Período do relatório de ranking (RF13). */
export type RankingPeriod = 'semana-atual' | 'semana-passada' | '30-dias';

/** Atividade bruta usada para montar o ranking. */
export interface RankingActivity {
  posts: { authorId: string; authorName: string }[];
  comments: { authorId: string; authorName: string }[];
  likes: { uid: string; postAuthorId: string }[];
  names: Record<string, string>;
}

export interface RankingRow {
  position: number;
  uid: string;
  name: string;
  posts: number;
  comments: number;
  likesReceived: number;
  points: number;
}
