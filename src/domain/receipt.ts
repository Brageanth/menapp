export type ReceiptStatus = 'pending_upload' | 'pending_ocr' | 'needs_review' | 'confirmed' | 'error';

export type ReceiptItemConfidence = 'alta' | 'media' | 'baja';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  /** Gramos por unidad cuando el ticket da el peso del empaque (ej. 3 latas de 160 g). */
  unitWeight?: number | null;
  confidence: ReceiptItemConfidence;
  expiresAt: string | null;
}

export interface Receipt {
  id: string;
  imagePath: string | null;
  status: ReceiptStatus;
  items: ReceiptItem[];
  createdAt: string;
  error?: string;
}
