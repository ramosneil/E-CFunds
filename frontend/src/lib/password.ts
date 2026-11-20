// Password rule (Neil, 2026-11-13): at least 8 characters with an uppercase letter, a lowercase letter, a number and
// a symbol. The same rule is set in Supabase → Auth → Passwords, so it can't be bypassed. Symbols = the set Supabase
// accepts. Example of a good one: Mamburao#2026 (but make up your own).
export const SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';
const hasSymbol = (p: string) => [...p].some((c) => SYMBOLS.includes(c));

export const PASSWORD_RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'A lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'A number (0–9)', test: (p) => /\d/.test(p) },
  { key: 'sym', label: 'A symbol, like ! @ # $ %', test: hasSymbol },
];

export const meetsRules = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

const COMMON = ['password', 'qwerty', '123456', 'omsc', 'ecfunds', 'admin', 'welcome', 'letmein', 'iloveyou'];

/** 0 = empty, 1 weak, 2 fair, 3 good, 4 strong. Length and variety count; common words and repeats cost points. */
export function strength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  let s = PASSWORD_RULES.filter((r) => r.test(p)).length - 1;   // 0..4
  if (p.length >= 12) s += 1;
  if (p.length >= 16) s += 1;
  const lower = p.toLowerCase();
  if (COMMON.some((w) => lower.includes(w))) s -= 2;
  if (/(.)\1{2,}/.test(p) || /(0123|1234|2345|3456|4567|5678|6789|abcd)/i.test(p)) s -= 1;
  if (!meetsRules(p)) s = Math.min(s, 1);
  return Math.max(1, Math.min(4, s)) as 1 | 2 | 3 | 4;
}

export const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
