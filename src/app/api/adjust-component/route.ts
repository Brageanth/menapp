import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';

const macrosSchema = z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() });

const adjustmentSchema = z.object({
  summary: z.string(),
  nameChange: z.string().nullable(),
  macrosChange: macrosSchema.nullable(),
  portionChange: z.object({ typical: z.number(), min: z.number(), max: z.number(), step: z.number() }).nullable(),
  isTreatChange: z.boolean().nullable(),
});

interface ComponentInput {
  name: string;
  roles: string[];
  unit: string;
  macrosBasis: 'per100g' | 'perUnit';
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  portion: { typical: number; min: number; max: number; step: number };
  isTreat: boolean;
}

export async function POST(req: Request) {
  const { component, instruction } = (await req.json()) as { component: ComponentInput; instruction: string };

  if (!instruction?.trim()) return Response.json({ error: 'falta la instrucción' }, { status: 400 });
  if (!component?.name) return Response.json({ error: 'falta el componente' }, { status: 400 });

  const basisLabel = component.macrosBasis === 'per100g' ? `por 100${component.unit}` : `por ${component.unit}`;

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: adjustmentSchema }),
    messages: [
      {
        role: 'user',
        content: `Componente actual "${component.name}" (roles: ${component.roles.join(', ')}):
Macros ${basisLabel}: ${component.macros.kcal} kcal, ${component.macros.protein}g prot, ${component.macros.carbs}g carb, ${component.macros.fat}g grasa.
Porción: típica ${component.portion.typical}${component.unit}, rango ${component.portion.min}-${component.portion.max}, paso ${component.portion.step}.
Es gusto: ${component.isTreat ? 'sí' : 'no'}.

El usuario pide este cambio en lenguaje natural: "${instruction}"

Devolvé SOLO los campos que cambian (el resto en null):
- "nameChange": nuevo nombre, o null si no cambia.
- "macrosChange": los 4 macros completos con el valor nuevo (${basisLabel}), o null si no cambian.
- "portionChange": los 4 valores de porción completos con el valor nuevo, o null si no cambia.
- "isTreatChange": true/false si cambia si es gusto, o null si no cambia.
- "summary": una frase corta en español describiendo qué cambiaste.

No inventes cambios que no tengan sentido con el pedido. Si el pedido es ambiguo, interpretalo de la forma más simple y decilo en el summary.`,
      },
    ],
  });

  await logAiUsage('adjust-component', result.usage);
  return Response.json(result.output);
}
