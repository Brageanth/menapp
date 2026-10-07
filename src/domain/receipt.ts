export type ReceiptStatus = 'pending_upload' | 'pending_ocr' | 'needs_review' | 'confirmed' | 'error';

export type ReceiptItemConfidence = 'alta' | 'media' | 'baja';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  confidence: ReceiptItemConfidence;
}

export interface Receipt {
  id: string;
  imagePath: string | null;
  status: ReceiptStatus;
  items: ReceiptItem[];
  createdAt: string;
  error?: string;
}
