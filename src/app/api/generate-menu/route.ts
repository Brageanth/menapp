import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';

const SLOTS = ['D', 'M', 'A', 'O', 'C'] as const;

const newRecipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.object({ name: z.string(), quantity: z.number(), unit: z.string() })),
  steps: z.array(z.string()),
  servings: z.number(),
  prepTimeMinutes: z.number(),
  proteinTag: z.string().nullable(),
  caloriesPerServing: z.number().nullable(),
  proteinPerServing: z.number().nullable(),
  carbsPerServing: z.number().nullable(),
  fatPerServing: z.number().nullable(),
});

const assignmentSchema = z.object({
  date: z.string(),
  slot: z.enum(SLOTS),
  /** Receta existente de la biblioteca, o null si trae `newRecipe` inventada. */
  recipeId: z.string().nullable(),
  newRecipe: newRecipeSchema.nullable(),
});

const menuSchema = z.object({
  assignments: z.array(assignmentSchema),
});

interface RecipeInput {
  id: string;
  name: string;
  slot: string;
  proteinTag?: string;
  caloriesPerServing?: number;
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

interface GoalInput {
  personLabel: string;
  kcalTarget: number;
  slotBudgets: Record<string, number>;
}

export async function POST(req: Request) {
  const { dates, recipes, inventory, rules, goals, onlySlot } = (await req.json()) as {
    dates: string[];
    recipes: RecipeInput[];
    inventory: InventoryInput[];
    rules: RulesInput;
    goals: GoalInput[] | null;
    /** Si viene, solo se llena este slot (regenerar un slot puntual en vez de la semana entera). */
    onlySlot?: (typeof SLOTS)[number];
  };

  if (!Array.isArray(dates) || dates.length === 0) {
    return Response.json({ error: 'faltan fechas' }, { status: 400 });
  }

  const slots = onlySlot ? [onlySlot] : rules.includeMidMeals ? SLOTS : (['D', 'A', 'C'] as const);

  const catalog = recipes.length
    ? recipes
        .map(
          (r) =>
            `- id=${r.id} | slot=${r.slot} | "${r.name}"${r.proteinTag ? ` | proteína: ${r.proteinTag}` : ''}${r.caloriesPerServing ? ` | ${r.caloriesPerServing} kcal/porción` : ''}`
        )
        .join('\n')
    : '(vacía — no hay ninguna receta todavía, vas a tener que inventarlas todas)';

  const stock = inventory
    .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}${i.expiresAt ? ` (vence ${i.expiresAt})` : ''}`)
    .join('\n');

  const goalsText =
    rules.useGoals && goals && goals.length > 0
      ? goals
          .map(
            (g) =>
              `${g.personLabel}: ${g.kcalTarget} kcal/día repartidas por slot así — ` +
              Object.entries(g.slotBudgets)
                .map(([slot, kcal]) => `${slot}: ${kcal} kcal`)
                .join(', ')
          )
          .join('; ')
      : null;

  const instructions = [
    rules.prioritizeLibrary && 'Priorizá recetas que ya están en la biblioteca y que el usuario repite seguido.',
    rules.useExpiringFirst && 'Priorizá recetas cuyos ingredientes usen lo que está por vencer en la despensa.',
    rules.varietyFocus && 'Evitá repetir la misma receta más de una vez en la semana y variá las proteínas entre días.',
    goalsText &&
      `Cada receta tiene kcal por porción listadas en el catálogo cuando se conocen. Elegí, para cada slot, la receta cuyo kcal/porción esté más cerca del presupuesto de ese slot para estas metas: ${goalsText}. Si ninguna receta tiene kcal cargadas para ese slot, elegí igual por las otras reglas.`,
    rules.mode === 'solo-despensa'
      ? 'Modo solo-despensa: asigná únicamente recetas (existentes o inventadas) cuyos ingredientes ya estén cubiertos por la despensa actual.'
      : 'Se permite elegir o inventar recetas aunque falten ingredientes; esos faltantes se agregarán a la lista de compras después.',
  ].filter(Boolean).join(' ');

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: menuSchema }),
    messages: [
      {
        role: 'user',
        content: `Armá un menú para estas fechas: ${dates.join(', ')}. Slots a llenar cada día: ${slots.join(', ')}.

Biblioteca de recetas disponible:
${catalog}

Despensa actual:
${stock || '(vacía)'}

Reglas: ${instructions || 'Sin reglas adicionales, elegí un menú balanceado.'}

Para cada combinación de fecha y slot:
1. PRIORIDAD: si hay una receta en la biblioteca que sirve para ese slot y cumple las reglas, usala — devolvé "recipeId" con su id exacto del catálogo y "newRecipe": null. Nunca inventes un id que no esté en el catálogo.
2. SOLO si ninguna receta de la biblioteca sirve bien para ese slot (o la biblioteca está vacía), inventá una receta nueva, simple y realista para ese slot: devolvé "recipeId": null y "newRecipe" con nombre, ingredientes (nombre/cantidad/unidad), pasos, porciones, tiempo de preparación en minutos, y si podés estimar, proteína principal y calorías/proteína/carbos/grasa por porción (o null si no podés estimarlo con confianza). No inventes ingredientes raros o difíciles de conseguir.

Si no podés cubrir un slot de ninguna forma, omitilo en vez de forzar algo.`,
      },
    ],
  });

  await logAiUsage('generate-menu', result.usage);
  return Response.json(result.output);
}
