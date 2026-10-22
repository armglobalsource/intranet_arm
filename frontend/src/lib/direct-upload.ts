import { api } from './api';

// Keep the existing multipart path for small files and local development.
// Large files go to a private Supabase bucket; only metadata crosses Vercel.
export async function directUpload(file: File, purpose: 'avatar' | 'visual-reference' | 'feedback', userId?: number): Promise<string> {
  const { data } = await api.post<{ signedUrl: string; ticket: string }>('/uploads/ticket', {
    purpose, userId, contentType: file.type, size: file.size,
  });
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file);
  const response = await fetch(data.signedUrl, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
  if (!response.ok) throw new Error('No se pudo cargar el archivo. Intenta nuevamente.');
  return data.ticket;
}

export const requiresDirectUpload = (file: File) => process.env.NODE_ENV === 'production' && file.size > 3 * 1024 * 1024;
