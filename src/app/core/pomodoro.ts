import { environment } from '../../environments/environment';
import { RoomTimer } from './models';

/**
 * Ciclos do Pomodoro (RF16): 25 min de foco e 5 min de pausa, repetidos 4 vezes.
 * O ambiente de testes (environment.e2e.ts) encurta os tempos para os testes não levarem 2 horas.
 */
const custom = (environment as { pomodoro?: { focusMinutes: number; breakMinutes: number } }).pomodoro;

export const POMODORO = {
  focusMs: (custom?.focusMinutes ?? 25) * 60_000,
  breakMs: (custom?.breakMinutes ?? 5) * 60_000,
  cycles: 4,
};

export type PomodoroPhase = 'idle' | 'focus' | 'break' | 'finished';

export interface PomodoroState {
  phase: PomodoroPhase;
  /** Ciclo atual, de 1 a 4. */
  cycle: number;
  remainingMs: number;
  running: boolean;
}

export function elapsedMs(timer: RoomTimer, now: number): number {
  const running = timer.status === 'running' && timer.startedAt ? now - timer.startedAt.getTime() : 0;
  return Math.max(0, timer.elapsedMs + running);
}

/** Calcula fase, ciclo e tempo restante a partir do estado salvo e do horário atual. */
export function pomodoroState(timer: RoomTimer, now: number, config = POMODORO): PomodoroState {
  const elapsed = elapsedMs(timer, now);
  const cycleMs = config.focusMs + config.breakMs;
  const total = cycleMs * config.cycles;

  if (timer.status === 'idle' && elapsed === 0) {
    return { phase: 'idle', cycle: 1, remainingMs: config.focusMs, running: false };
  }
  if (elapsed >= total) {
    return { phase: 'finished', cycle: config.cycles, remainingMs: 0, running: false };
  }
  const index = Math.floor(elapsed / cycleMs);
  const within = elapsed - index * cycleMs;
  const inFocus = within < config.focusMs;
  return {
    phase: inFocus ? 'focus' : 'break',
    cycle: index + 1,
    remainingMs: inFocus ? config.focusMs - within : cycleMs - within,
    running: timer.status === 'running',
  };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}