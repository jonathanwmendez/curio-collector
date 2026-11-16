'use client';
import { supabaseBrowser } from './supabase/client';

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not read image')); im.src = src; });
}

function drawScaled(im: HTMLImageElement, max: number) {
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob>((res) => c.toBlob(b => res(b!), 'image/jpeg', q));

/** Resize a picked file: a 1200px JPEG for storage and a base64 copy for Claude. */
export async function prepareImage(source: File | Blob | string) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const im = await loadImg(url);
    const store = await toBlob(drawScaled(im, 1200), 0.82);
    const aiCanvas = drawScaled(im, 1280);
    const aiBase64 = aiCanvas.toDataURL('image/jpeg', 0.86).split(',')[1];
    const preview = URL.createObjectURL(store);
    return { store, aiBase64, preview };
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

export async function uploadPhoto(userId: string, blob: Blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseBrowser().storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function dataUrlToBlob(dataUrl: string) {
  const p = await prepareImage(dataUrl);
  return p.store;
}
