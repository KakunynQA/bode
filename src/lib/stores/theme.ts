import { writable } from 'svelte/store';

type Theme = 'dark' | 'light';

function createThemeStore() {
  const stored = typeof window !== 'undefined'
    ? (localStorage.getItem('bode-theme') as Theme | null)
    : null;
  const initial: Theme = stored ?? 'dark';

  const { subscribe, set, update } = writable<Theme>(initial);

  return {
    subscribe,
    toggle() {
      update((current) => {
        const next: Theme = current === 'dark' ? 'light' : 'dark';
        if (typeof window !== 'undefined') {
          localStorage.setItem('bode-theme', next);
          document.documentElement.classList.toggle('light', next === 'light');
        }
        return next;
      });
    },
    set(value: Theme) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('bode-theme', value);
        document.documentElement.classList.toggle('light', value === 'light');
      }
      set(value);
    },
  };
}

export const theme = createThemeStore();
