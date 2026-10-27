import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/data/supabase-server';
import { logAiUsage } from '@/data/log-ai-usage';
import { guardAi } from '@/data/ai-guard';

const itemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string(),
      unitWeight: z.number().nullable(),
      confidence: z.enum(['alta', 'media', 'baja']),
      expiresAt: z.string().nullable(),
    })
  ),
});

const MAX_PHOTOS = 4;

export async function POST(req: Request) {
  const blocked = await guardAi(req);
  if (blocked) return blocked;

  const body = (await req.json()) as { imagePath?: string; imagePaths?: string[] };
  const imagePaths = body.imagePaths ?? (body.imagePath ? [body.imagePath] : []);
  if (imagePaths.length === 0) {
    return Response.json({ error: 'falta imagePaths' }, { status: 400 });
  }
  if (imagePaths.length > MAX_PHOTOS) {
    return Response.json({ error: `máximo ${MAX_PHOTOS} fotos` }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const signed = await Promise.all(imagePaths.map((path) => supabase.storage.from('receipts').createSignedUrl(path, 60)));
  if (signed.some(({ error, data }) => error || !data)) {
    return Response.json({ error: 'no se pudo leer la foto' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    maxOutputTokens: 4000,
    output: Output.object({ schema: itemsSchema }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Esto es una compra de supermercado: ${imagePaths.length === 1 ? 'una foto' : `${imagePaths.length} fotos`}. Pueden ser partes del mismo ticket, o fotos de los empaques de los productos para ayudarte a leer mejor. Extraé cada producto comprado con su cantidad, unidad y tu nivel de confianza en la lectura. No inventes productos que no estén en las fotos, y si una misma línea sale en dos fotos (ticket cortado en partes) contala una sola vez.

Nombre: los tickets abrevian ("QSO DBL CRM", "PCHG POLLO"). Escribí el nombre completo y natural del producto en español, como se compraría ("Queso Doble Crema", "Pechuga de pollo"), sin marca salvo que sea parte de lo que lo distingue. Si una foto muestra el empaque, usá el nombre de ahí. Si no podés descifrar una abreviatura, poné tu mejor lectura con confianza "baja".

Cantidad y unidad: usá siempre "g" (productos que se compran por peso), "ml" (líquidos) o "unidad" (cosas que se cuentan). Convertí kg a g y L a ml (1.2 kg → quantity 1200, unit "g"). Si el ticket da el peso del empaque ("Camarones 500 g"), la cantidad es el peso total comprado (500 g, o 1000 g si compró 2). Para cosas que se cuentan pero el ticket indica cuánto pesa cada una (3 latas de atún de 160 g → quantity 3, unit "unidad", unitWeight 160), poné ese peso en "unitWeight" en gramos; si no hay un peso por unidad claro, unitWeight es null. Un mismo producto repetido en el ticket va en un solo ítem con la cantidad sumada.

Para cada producto, sugerí también una fecha de vencimiento ("expiresAt", formato YYYY-MM-DD). Si el ticket muestra una fecha de compra, usá esa como punto de partida; si no, usá hoy (${today}). A partir de esa fecha, sumá la vida útil típica de ese producto sin abrir (ej: lácteos frescos ~7-10 días, carne/pescado fresco ~2-4 días, verduras/frutas frescas ~5-10 días, pan ~4-6 días, productos secos/enlatados/congelados varios meses). Si el producto no tiene una fecha de vencimiento razonable (ej. productos de limpieza), usá null.`,
          },
          ...signed.map(({ data }) => ({
            type: 'file' as const,
            data: { type: 'url' as const, url: new URL(data!.signedUrl) },
            mediaType: 'image/jpeg',
          })),
        ],
      },
    ],
  });

  await logAiUsage('ocr', result.usage);
  return Response.json(result.output);
}
