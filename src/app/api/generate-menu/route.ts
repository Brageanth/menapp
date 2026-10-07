import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const SLOTS = ['D', 'M', 'A', 'O', 'C'] as const;

const menuSchema = z.object({
  assignments: z.array(
    z.object({
      date: z.string(),
      slot: z.enum(SLOTS),
      recipeId: z.string(),
    })
  ),
});

interface RecipeInput {
  id: string;
  name: string;
  slot: string;
  proteinTag?: string;
  ingredients: { name: string }[];
}

interface InventoryInput {
  name: string;
  quantity: number;
  unit: string;
  expiresAt: string | null;
}

interface RulesInput {
  prioritizeLibrary: boolean;
  useExpiringFirst: boolean;
  varietyFocus: boolean;
  useGoals: boolean;
  includeMidMeals: boolean;
  mode: 'solo-despensa' | 'permitir-compras';
}

export async function POST(req: Request) {
  const { dates, recipes, inventory, rules, goalsSummary } = (await req.json()) as {
    dates: string[];
    recipes: RecipeInput[];
    inventory: InventoryInput[];
    rules: RulesInput;
    goalsSummary: string | null;
  };

  if (!Array.isArray(dates) || dates.length === 0) {
    return Response.json({ error: 'faltan fechas' }, { status: 400 });
  }
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return Response.json({ error: 'la biblioteca de recetas está vacía' }, { status: 400 });
  }

  const slots = rules.includeMidMeals ? SLOTS : (['D', 'A', 'C'] as const);

  const catalog = recipes
    .map((r) => `- id=${r.id} | slot=${r.slot} | "${r.name}"${r.proteinTag ? ` | proteína: ${r.proteinTag}` : ''}`)
    .join('\n');

  const stock = inventory
    .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}${i.expiresAt ? ` (vence ${i.expiresAt})` : ''}`)
    .join('\n');

  const instructions = [
    rules.prioritizeLibrary && 'Priorizá recetas que ya están en la biblioteca y que el usuario repite seguido.',
    rules.useExpiringFirst && 'Priorizá recetas cuyos ingredientes usen lo que está por vencer en la despensa.',
    rules.varietyFocus && 'Evitá repetir la misma receta más de una vez en la semana y variá las proteínas entre días.',
    rules.useGoals && goalsSummary && `Tené en cuenta estas metas nutricionales del hogar: ${goalsSummary}.`,
    rules.mode === 'solo-despensa'
      ? 'Modo solo-despensa: asigná únicamente recetas cuyos ingredientes ya estén cubiertos por la despensa actual.'
      : 'Se permite elegir recetas aunque falten ingredientes; esos faltantes se agregarán a la lista de compras después.',
  ].filter(Boolean).join(' ');

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: menuSchema }),
    messages: [
      {
        role: 'user',
        content: `Armá un menú semanal para estas fechas: ${dates.join(', ')}. Slots a llenar cada día: ${slots.join(', ')}.

Biblioteca de recetas disponible (SOLO podés usar estos id, nunca inventes uno ni elijas un slot distinto al de la receta):
${catalog}

Despensa actual:
${stock || '(vacía)'}

Reglas: ${instructions || 'Sin reglas adicionales, elegí un menú balanceado.'}

Devolvé una asignación por cada combinación de fecha y slot que puedas cubrir con la biblioteca. Si no hay ninguna receta válida para un slot, omitilo en vez de inventar un id.`,
      },
    ],
  });

  return Response.json(result.output);
}
