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
