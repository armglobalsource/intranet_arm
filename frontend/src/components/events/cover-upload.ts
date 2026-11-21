// Subida de la imagen de portada de un evento.
// Antes de subirla se redibuja en el navegador: queda en JPG de hasta 2000 px de ancho,
// pesa poco y pierde los metadatos de la foto (por ejemplo, la ubicación GPS).

import { api } from '@/lib/api';
import { directUpload } from '@/lib/direct-upload';

const MAX_WIDTH = 2000;
const MAX_INPUT = 25 * 1024 * 1024;

export async function prepareCover(file: File): Promise<File> {
  if (!/^image\//.test(file.type)) throw new Error('Elige una imagen (JPG, PNG o WebP).');
  if (file.size > MAX_INPUT) throw new Error('La imagen es muy pesada (máximo 25 MB).');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('No pudimos leer la imagen. Usa JPG, PNG o WebP.'); }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite preparar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('No pudimos preparar la imagen.');
  return new File([blob], 'portada.jpg', { type: 'image/jpeg' });
}

/** Sube la portada y devuelve su URL pública. */
export async function uploadCover(file: File): Promise<string> {
  const cover = await prepareCover(file);
  const ticket = await directUpload(cover, 'event-cover');
  const { data } = await api.post<{ url: string }>('/uploads/event-cover/complete', { ticket });
  return data.url;
}
