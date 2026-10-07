import { db } from './local-db';
import { supabase } from './supabase-client';
import { receiptRepo } from './repositories/receipt-repo';
import type { Receipt, ReceiptItem } from '@/domain/receipt';

async function runOcr(imagePath: string): Promise<ReceiptItem[]> {
  const res = await fetch('/api/ocr-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagePath }),
  });
  if (!res.ok) throw new Error('ocr failed');
  const data = await res.json();
  return data.items as ReceiptItem[];
}

async function uploadAndProcess(id: string, blob: Blob, createdAt: string): Promise<Receipt> {
  const imagePath = `${id}.jpg`;
  const { error } = await supabase.storage.from('receipts').upload(imagePath, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const items = await runOcr(imagePath);
  const receipt: Receipt = { id, imagePath, status: 'needs_review', items, createdAt };
  return receipt;
}

/** Called right after the user takes/picks a photo. Tries the full upload+OCR flow; if offline or it fails, queues the photo for later. */
export async function captureReceipt(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (navigator.onLine) {
    try {
      const receipt = await uploadAndProcess(id, blob, createdAt);
      await receiptRepo.add(receipt);
      return id;
    } catch (err) {
      if (isNetworkError(err)) {
        // genuinely offline mid-request: fall through to queue
      } else {
        await db.receipts.add({
          id,
          imagePath: null,
          status: 'error',
          items: [],
          createdAt,
          error: errorMessage(err),
        });
        return id;
      }
    }
  }

  await db.receipts.add({ id, imagePath: null, status: 'pending_upload', items: [], createdAt });
  await db.pendingPhotos.add({ id, blob, createdAt });
  return id;
}

export async function flushPhotoQueue() {
  const pending = await db.pendingPhotos.orderBy('createdAt').toArray();

  for (const photo of pending) {
    try {
      const receipt = await uploadAndProcess(photo.id, photo.blob, photo.createdAt);
      await receiptRepo.update(receipt);
      await db.pendingPhotos.delete(photo.id);
    } catch (err) {
      if (isNetworkError(err)) {
        // still offline: leave it queued, retry on next flush
        break;
      }
      // service error (e.g. OCR/storage failure): stop retrying, surface it
      await receiptRepo.update({
        id: photo.id,
        imagePath: null,
        status: 'error',
        items: [],
        createdAt: photo.createdAt,
        error: errorMessage(err),
      });
      await db.pendingPhotos.delete(photo.id);
    }
  }
}

function isNetworkError(err: unknown): boolean {
  return !navigator.onLine || (err instanceof TypeError && /fetch|network/i.test(err.message));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Error desconocido';
}

let listenerRegistered = false;

export function registerPhotoQueueListener() {
  if (typeof window === 'undefined' || listenerRegistered) return;
  listenerRegistered = true;
  window.addEventListener('online', () => void flushPhotoQueue());
  void flushPhotoQueue();
}
