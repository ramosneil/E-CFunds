export type ThemeChoice = 'light' | 'dark' | 'system';

// Dark is the default (Neil, 2026-11-24: the app follows the dark welcome page); a saved light/dark choice wins.
export function getTheme(): ThemeChoice {
  try { return (localStorage.getItem('theme') as ThemeChoice) || 'dark'; } catch { return 'dark'; }
}

export function setTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  try { if (t === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', t); } catch { /* private mode */ }
}

export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
