import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';

const schema = z.object({
  name: z.string(),
  unit: z.string(),
  portionTypical: z.number(),
  portionMin: z.number(),
  portionMax: z.number(),
  portionStep: z.number(),
  macrosBasis: z.enum(['per100g', 'perUnit']),
  macros: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }),
});

const ROLE_LABELS: Record<string, string> = {
  proteina: 'proteína',
  base: 'base (carbohidrato principal)',
  verdura: 'verdura',
  fruta: 'fruta',
  lacteo: 'lácteo',
  grasa: 'grasa/extra',
  salsa: 'salsa',
  bebida: 'bebida',
  postre: 'postre',
};

export async function POST(req: Request) {
  const { role, existingNames } = (await req.json()) as { role: string; existingNames: string[] };
  if (!role) return Response.json({ error: 'falta el rol' }, { status: 400 });

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema }),
    messages: [
      {
        role: 'user',
        content: `Proponé un componente simple y común de cocina colombiana/latina para el rol "${ROLE_LABELS[role] ?? role}".
No repitas ninguno de estos nombres ya existentes: ${existingNames.join(', ') || '(ninguno)'}.
Devolvé macros realistas (por 100g, o por unidad si el ingrediente se cuenta por piezas como un huevo) y una porción típica razonable con un rango mínimo/máximo y un paso de ajuste (ej: paso 10g).`,
      },
    ],
  });

  await logAiUsage('adjust-component', result.usage);
  return Response.json(result.output);
}
