import type { Row } from '@/types/ficha';

export function parseSetListEntry(row: Row, raw: string) {
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) return {
      ...data, titulo: data.titulo || '', tonalidad: data.tonalidad || '', cantante: data.cantante || '',
    };
  } catch { /* Legacy person rows stored only the responsible person's name. */ }
  return row.type === 'song'
    ? { titulo: raw, tonalidad: '', cantante: '' }
    : { titulo: row.label, tonalidad: '', cantante: raw };
}
