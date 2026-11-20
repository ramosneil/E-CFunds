export type ThemeChoice = 'light' | 'dark' | 'system';

export function getTheme(): ThemeChoice {
  try { return (localStorage.getItem('theme') as ThemeChoice) || 'system'; } catch { return 'system'; }
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
