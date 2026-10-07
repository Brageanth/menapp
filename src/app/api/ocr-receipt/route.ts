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

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: itemsSchema }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Este es un ticket de compra de supermercado. Extraé cada producto comprado con su cantidad, unidad (kg, g, unidades, L, etc.) y tu nivel de confianza en la lectura. No inventes productos que no estén en la foto.',
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
