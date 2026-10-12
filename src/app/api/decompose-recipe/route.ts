import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';

const macrosSchema = z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() });

const proposedComponentSchema = z.object({
  name: z.string(),
  roles: z.array(z.enum(['proteina', 'base', 'verdura', 'fruta', 'lacteo', 'grasa', 'salsa', 'bebida', 'postre'])),
  unit: z.string(),
  macrosBasis: z.enum(['per100g', 'perUnit']),
  macros: macrosSchema,
  portionTypical: z.number(),
});

const decompositionSchema = z.object({
  decision: z.enum(['separable', 'complete-dish']),
  proposedComponents: z.array(proposedComponentSchema),
  note: z.string(),
});

interface RecipeInput {
  name: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
  caloriesPerServing?: number;
  proteinPerServing?: number;
  carbsPerServing?: number;
  fatPerServing?: number;
  servings: number;
}

export async function POST(req: Request) {
  const { recipe } = (await req.json()) as { recipe: RecipeInput };
  if (!recipe?.name) return Response.json({ error: 'falta la receta' }, { status: 400 });

  const ingredientsList = recipe.ingredients.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n');
  const stepsList = recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: decompositionSchema }),
    messages: [
      {
        role: 'user',
        content: `Receta "${recipe.name}" (${recipe.servings} porciones, ${recipe.caloriesPerServing ?? '?'} kcal/porción):

Ingredientes:
${ingredientsList}

Pasos:
${stepsList}

Decidí cómo migrarla a un sistema de componentes reutilizables:
- "separable": la receta es en realidad una combinación de partes independientes que se usan solas
  en otras comidas (ej. "pollo con arroz y ensalada" → componentes pollo, arroz, ensalada). Proponé
  un componente por cada parte independiente, con sus macros estimados (por 100g o por unidad, lo
  que tenga más sentido) y rol(es) de entre: proteina, base, verdura, fruta, lacteo, grasa, salsa,
  bebida, postre.
- "complete-dish": la receta no se puede separar sin perder sentido (ej. lasaña, sancocho, un
  guiso mezclado). Proponé un único componente que cubra todos los roles relevantes, marcado como
  plato completo.

Repartí los macros totales de la receta entre los componentes propuestos de forma razonable. "note"
es una frase corta en español explicando la decisión.`,
      },
    ],
  });

  await logAiUsage('decompose-recipe', result.usage);
  return Response.json(result.output);
}
