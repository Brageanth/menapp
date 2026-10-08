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
  ingredients: { name: string; quantity?: number; unit?: string }[];
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
        .map((r) => {
          const ingredientsText = r.ingredients
            .map((i) => (i.quantity != null && i.unit ? `${i.name} (${i.quantity} ${i.unit})` : i.name))
            .join(', ');
          return `- id=${r.id} | slot=${r.slot} | "${r.name}"${r.proteinTag ? ` | proteína: ${r.proteinTag}` : ''}${r.caloriesPerServing ? ` | ${r.caloriesPerServing} kcal/porción` : ''} | ingredientes: ${ingredientsText}`;
        })
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
    'REGLA DURA, siempre activa: nunca asignes la misma receta (ni el mismo plato inventado) en más de un slot del mismo tipo a lo largo de la semana — por ejemplo, no puede haber "salchicha con mostaza" de cena dos días distintos. Si la despensa es limitada y no alcanza para variar entre recetas existentes, inventá variaciones distintas (otra preparación, otra combinación, otro corte) en vez de repetir literalmente el mismo plato. Repetir un plato por falta de variedad en la despensa nunca es una opción válida.',
    rules.prioritizeLibrary && 'Priorizá recetas que ya están en la biblioteca y que el usuario repite seguido.',
    rules.useExpiringFirst && 'Priorizá recetas cuyos ingredientes usen lo que está por vencer en la despensa.',
    rules.varietyFocus && 'Además de la regla dura de no repetir plato, variá también las proteínas principales entre días (no pollo todos los días, por ejemplo).',
    goalsText &&
      `Cada receta tiene kcal por porción listadas en el catálogo cuando se conocen. Elegí, para cada slot, la receta cuyo kcal/porción esté más cerca del presupuesto de ese slot para estas metas: ${goalsText}. Si ninguna receta tiene kcal cargadas para ese slot, elegí igual por las otras reglas.`,
    rules.mode === 'solo-despensa'
      ? 'Modo solo-despensa: priorizá recetas (existentes o inventadas) cuyos ingredientes ya estén cubiertos por las cantidades reales de la despensa actual (comparando cantidad/unidad listada en cada receta contra el stock, no solo el nombre). Si para cumplir la regla dura de no repetir plato la despensa ya no alcanza, está permitido agregar como excepción una receta con 1-2 ingredientes faltantes — esos faltantes van a la lista de compras después. Nunca repitas un plato solo para evitar agregar algo a la lista de compras.'
      : 'Priorizá cubrir cada slot con lo que ya hay en la despensa (comparando cantidad/unidad real, no solo el nombre del ingrediente), pero se permite elegir o inventar recetas aunque falten ingredientes; esos faltantes se agregarán a la lista de compras después.',
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
2. SOLO si ninguna receta de la biblioteca sirve bien para ese slot (o la biblioteca está vacía), inventá una receta nueva, simple y realista para ese slot: devolvé "recipeId": null y "newRecipe" con nombre, ingredientes (nombre/cantidad/unidad), pasos, porciones y tiempo de preparación en minutos.
3. Para proteína principal y calorías/proteína/carbos/grasa por porción de una receta inventada: estimalas siempre con tu mejor cálculo usando los ingredientes y cantidades reales de la receta (son platos de comida casera simple — salchicha con mostaza, arroz con pollo, etc. — totalmente estimables). Devolvé null en esos campos únicamente si el plato es genuinamente inusual o no tenés forma razonable de aproximarlo; null no es una opción por defecto ni para ahorrar esfuerzo, porque estos valores alimentan las barras de progreso de metas nutricionales del usuario y si faltan, esa comida no suma nada ahí.

Si no podés cubrir un slot de ninguna forma, omitilo en vez de forzar algo.`,
      },
    ],
  });

  await logAiUsage('generate-menu', result.usage);
  return Response.json(result.output);
}
