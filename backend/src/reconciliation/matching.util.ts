/** NFD-decompone, quita diacríticos, minúsculas, recorta y colapsa espacios. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSet(normalized: string): string {
  return normalized.split(' ').filter(Boolean).sort().join(' ');
}

/** Distancia de Levenshtein clásica (DP), O(n*m) — nombres son strings cortos. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Compara dos nombres ya normalizados.
 * 1.0  → match exacto
 * 0.95 → mismas palabras, distinto orden (ej. "Bravo Isidora" vs "Isidora Bravo")
 * resto → similitud de Levenshtein, solo para ranking de candidatos
 */
export function scoreNameMatch(a: string, b: string): number {
  if (a === b) return 1.0;
  if (tokenSet(a) === tokenSet(b)) return 0.95;
  return levenshteinSimilarity(a, b);
}

/**
 * Parsea fechas día-primero (convención chilena), separador "/" o "-".
 * Devuelve YYYY-MM-DD o null si no es una fecha válida.
 */
export function parseChileanDate(raw?: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;

  const dd   = parseInt(match[1], 10);
  const mm   = parseInt(match[2], 10);
  const yyyy = parseInt(match[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

/** Divide un "nombre completo" en firstName/lastName (heurística: primera palabra = nombre, resto = apellido). */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
