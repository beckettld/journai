import { writable, derived, readable } from 'svelte/store';
import { getISOWeek, getYear, parse } from 'date-fns';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

export type SessionMode = 'vent' | 'mentor';

export type SessionState = {
  mode: SessionMode;
  messages: Message[];
  startTime: number;
  durationMinutes: number;
  isActive: boolean;
  currentDate: string; // YYYY-MM-DD
  weekId: string; // YYYY-Www
};

const createSessionStore = () => {
  const initialState: SessionState = {
    mode: 'vent',
    messages: [],
    startTime: 0,
    durationMinutes: 30,
    isActive: false,
    currentDate: new Date().toISOString().split('T')[0],
    weekId: '',
  };

  const { subscribe, set, update } = writable<SessionState>(initialState);

  return {
    subscribe,

    startSession: (mode: SessionMode, durationMinutes: number = mode === 'vent' ? 30 : 60) => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const weekNumber = getISOWeek(now);
      const year = getYear(now);
      const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

      set({
        mode,
        messages: [],
        startTime: Date.now(),
        durationMinutes,
        isActive: true,
        currentDate,
        weekId,
      });
    },

    addMessage: (message: Message) => {
      update((state) => ({
        ...state,
        messages: [...state.messages, { ...message, timestamp: Date.now() }],
      }));
    },

    endSession: () => {
      update((state) => ({
        ...state,
        isActive: false,
      }));
    },

    reset: () => {
      set(initialState);
    },

    setMessages: (messages: Message[]) => {
      update((state) => ({
        ...state,
        messages,
      }));
    },

    restoreSession: (
      mode: SessionMode,
      durationMinutes: number,
      messages: Message[],
      startTime: number
    ) => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const weekNumber = getISOWeek(now);
      const year = getYear(now);
      const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

      set({
        mode,
        messages,
        startTime,
        durationMinutes,
        isActive: true,
        currentDate,
        weekId,
      });
    },
  };
};

export const sessionStore = createSessionStore();

// Create a readable store that ticks every second to force timer updates
const timerTick = readable(0, (set) => {
  const interval = setInterval(() => {
    set(Date.now());
  }, 1000);
  return () => clearInterval(interval);
});

// Derived store for time remaining - updates every second when session is active
export const timeRemaining = derived(
  [sessionStore, timerTick],
  ([$session, $tick]) => {
    if (!$session.isActive) return 0;
    const elapsed = (Date.now() - $session.startTime) / 1000 / 60; // minutes
    const remaining = Math.max(0, $session.durationMinutes - elapsed);
    return remaining;
  }
);

// Derived store for session expired
export const sessionExpired = derived(timeRemaining, ($timeRemaining) => $timeRemaining <= 0);

