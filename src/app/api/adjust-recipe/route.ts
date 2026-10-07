import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
});

const adjustmentSchema = z.object({
  summary: z.string(),
  ingredientsDiff: z.object({
    added: z.array(ingredientSchema),
    removed: z.array(z.string()),
    changed: z.array(ingredientSchema),
  }),
  newSteps: z.array(z.string()).nullable(),
});

interface RecipeInput {
  name: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
}

export async function POST(req: Request) {
  const { recipe, instruction } = (await req.json()) as { recipe: RecipeInput; instruction: string };

  if (!instruction || !instruction.trim()) {
    return Response.json({ error: 'falta la instrucción' }, { status: 400 });
  }
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    return Response.json({ error: 'falta la receta' }, { status: 400 });
  }

  const ingredientsList = recipe.ingredients.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n');
  const stepsList = recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: adjustmentSchema }),
    messages: [
      {
        role: 'user',
        content: `Receta actual "${recipe.name}":

Ingredientes:
${ingredientsList}

Pasos:
${stepsList}

El usuario pide este ajuste en lenguaje natural: "${instruction}"

Devolvé SOLO el diff necesario para aplicar ese ajuste, nunca la receta completa reescrita:
- "ingredientsDiff.added": ingredientes nuevos que hay que sumar (nombre, cantidad, unidad).
- "ingredientsDiff.removed": nombres de ingredientes existentes que hay que quitar, exactamente como aparecen arriba.
- "ingredientsDiff.changed": ingredientes existentes cuya cantidad o unidad cambia (nombre exacto + valor nuevo).
- "newSteps": si el ajuste cambia los pasos, la lista completa de pasos nueva; si los pasos no cambian, null.
- "summary": una frase corta en español describiendo qué cambiaste.

No inventes ingredientes que no tengan sentido con el pedido. Si el pedido es ambiguo, interpretalo de la forma más simple y decilo en el summary.`,
      },
    ],
  });

  await logAiUsage('adjust-recipe', result.usage);
  return Response.json(result.output);
}
