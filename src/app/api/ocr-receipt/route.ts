import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/data/supabase-server';

const itemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string(),
      confidence: z.enum(['alta', 'media', 'baja']),
      expiresAt: z.string().nullable(),
    })
  ),
});

export async function POST(req: Request) {
  const { imagePath } = await req.json();
  if (!imagePath) {
    return Response.json({ error: 'falta imagePath' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(imagePath, 60);
  if (error || !data) {
    return Response.json({ error: 'no se pudo leer la foto' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: itemsSchema }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Este es un ticket de compra de supermercado. Extraé cada producto comprado con su cantidad, unidad (kg, g, unidades, L, etc.) y tu nivel de confianza en la lectura. No inventes productos que no estén en la foto.

Para cada producto, sugerí también una fecha de vencimiento ("expiresAt", formato YYYY-MM-DD). Si el ticket muestra una fecha de compra, usá esa como punto de partida; si no, usá hoy (${today}). A partir de esa fecha, sumá la vida útil típica de ese producto sin abrir (ej: lácteos frescos ~7-10 días, carne/pescado fresco ~2-4 días, verduras/frutas frescas ~5-10 días, pan ~4-6 días, productos secos/enlatados/congelados varios meses). Si el producto no tiene una fecha de vencimiento razonable (ej. productos de limpieza), usá null.`,
          },
          {
            type: 'file',
            data: { type: 'url', url: new URL(data.signedUrl) },
            mediaType: 'image/jpeg',
          },
        ],
      },
    ],
  });

  return Response.json(result.output);
}
