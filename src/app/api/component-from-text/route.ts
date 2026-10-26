import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';
import { guardAi } from '@/data/ai-guard';
import type { Component } from '@/domain/component';

const roleIdSchema = z.enum(['proteina', 'base', 'verdura', 'fruta', 'lacteo', 'grasa', 'bebida', 'postre']);
const mealSlotSchema = z.enum(['D', 'M', 'A', 'O', 'C']);

const componentInputSchema = z.object({
  name: z.string(),
  roles: z.array(roleIdSchema),
  contributesRoles: z.array(roleIdSchema).nullable(),
  origin: z.enum(['simple', 'preparado']),
  unit: z.string(),
  portion: z.object({ typical: z.number(), min: z.number(), max: z.number(), step: z.number() }),
  weightState: z.enum(['crudo', 'cocido']),
  macrosBasis: z.enum(['per100g', 'perUnit']),
  macros: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }),
  isTreat: z.boolean(),
  typicalSlots: z.array(mealSlotSchema).nullable(),
  flavorProfile: z.array(z.string()).nullable(),
  temperature: z.enum(['frio', 'caliente', 'ambiente']).nullable(),
  effort: z.enum(['bajo', 'medio', 'alto']).nullable(),
  cookedShelfLifeDays: z.number().nullable(),
  batchable: z.boolean().nullable(),
  shoppingName: z.string().nullable(),
  ingredients: z.array(z.object({ name: z.string(), quantity: z.number(), unit: z.string() })).nullable(),
  steps: z.array(z.string()).nullable(),
  isCompleteDish: z.boolean().nullable(),
  favorite: z.boolean(),
  notes: z.string().nullable(),
});

const OUTPUT_CONTRACT = `Reglas para completar el JSON:
- "roles": SOLO los roles para los que este componente tiene sentido como elección propia, de entrada, sin nada más — elegí uno o más de [proteina, base, verdura, fruta, lacteo, grasa, bebida, postre]. Pensalo así: "¿alguien podría armar su comida eligiendo ESTO como su proteína/base/etc., sin agregar nada más para cubrir ese rol?". No existe el concepto de "salsa" suelta: si la descripción es una salsa o aderezo atado a un alimento (ej. "pollo en salsa de queso", "pasta carbonara"), describí el PLATO completo y poné en "roles" el rol del alimento principal (ej. proteina).
- "contributesRoles": null salvo un caso puntual — cuando el componente, ADEMÁS de sus "roles", ya trae otro rol que por eso no hace falta completar aparte (ej. "pasta carbonara" con roles=["proteina"] pero contributesRoles=["base","lacteo","grasa"]: así el sistema no le suma arroz ni otra proteína, pero tampoco lo ofrece como base sola). No repitas en contributesRoles ningún valor que ya esté en "roles". Si el plato trae base y proteína juntas, marcá "isCompleteDish": true.
- "origin": "simple" salvo que la descripción implique una preparación con pasos/ingredientes propios, en ese caso "preparado" y completá "ingredients" y "steps".
- "weightState": "crudo" salvo que se indique que ya está cocido.
- "macrosBasis": "per100g" salvo que el alimento se mida naturalmente por unidad (ej. un huevo, una fruta entera), en ese caso "perUnit".
- Regla de coherencia OBLIGATORIA entre "macrosBasis", "unit" y "portion": si "macrosBasis" es "per100g", "unit" tiene que ser un peso o volumen real (g, ml) y la porción (typical/min/max) tiene que ser una cantidad de ese peso/volumen (normalmente ≥20) — nunca un conteo chico como 1-2. Si "macrosBasis" es "perUnit", "unit" tiene que nombrar la unidad contable (unidad, huevo, taza, rebanada...) y la porción es un conteo de esas unidades (típicamente 1-6) — y los macros son los de 1 unidad completa, no de 100g.
- "isTreat": true solo si es evidentemente un gusto/golosina. "favorite": false por defecto.
- "portion": inferí un valor típico realista en la unidad elegida, con un rango mínimo/máximo razonable y un paso de ajuste.
- "macros": valores realistas y coherentes con la base elegida (per100g o perUnit).
- "typicalSlots": usá sentido común culinario para decidir en qué comidas tiene sentido este componente, aunque la descripción no lo diga explícitamente — ej. un churrasco/milanesa/guiso no va en D (desayuno) ni M (media mañana); un huevo frito o una fruta sí pueden ir en varias. Usá valores de [D, M, A, O, C] (desayuno, media mañana, almuerzo, onces, cena). Devolvé null SOLO si el componente es realmente versátil para cualquier comida (ej. arroz blanco, una verdura de acompañamiento genérica) — null significa "sin restricción", no "no sé", así que para platos claramente atados a un momento del día siempre elegí los slots que correspondan.
- "shoppingName": solo para origin "simple" cuyo nombre NO es lo que se compra en el súper: poné el producto crudo que hay que comprar, en singular y sin preparación (ej. "huevo frito" → "huevo", "pechuga a la plancha" → "pechuga de pollo", "arroz blanco" → "arroz"). Si lleva varios productos, separalos con coma (ej. "ensalada de lechuga y tomate" → "lechuga, tomate"). null si ya se compra con ese nombre (ej. "banano", "yogur griego") o si es "preparado" (esos se compran por sus ingredientes).
- Para "flavorProfile", "temperature", "effort", "cookedShelfLifeDays", "batchable", "ingredients", "steps", "isCompleteDish", "notes": devolvé null si no hay información clara para inferirlos (no inventes).`;

function buildCreatePrompt(description: string): string {
  return `Convertí esta descripción en lenguaje natural de un componente de comida en un objeto JSON estructurado.

Descripción: "${description}"

${OUTPUT_CONTRACT}`;
}

function buildEditPrompt(description: string, existing: Component): string {
  return `Tenés este componente existente (JSON completo):
${JSON.stringify(existing)}

El usuario pide este cambio en lenguaje natural: "${description}"

Devolvé el componente COMPLETO con el cambio aplicado — no un diff — manteniendo todos los campos que no se mencionan exactamente iguales a los del componente existente.

${OUTPUT_CONTRACT}`;
}

export async function POST(req: Request) {
  const blocked = await guardAi(req);
  if (blocked) return blocked;

  const { description, existing } = (await req.json()) as { description: string; existing?: Component };

  if (!description?.trim()) return Response.json({ error: 'falta la descripción' }, { status: 400 });
  if (description.length > 1000) return Response.json({ error: 'descripción demasiado larga' }, { status: 400 });

  const prompt = existing ? buildEditPrompt(description, existing) : buildCreatePrompt(description);

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    maxOutputTokens: 2000,
    output: Output.object({ schema: componentInputSchema }),
    messages: [{ role: 'user', content: prompt }],
  });

  await logAiUsage('component-from-text', result.usage);
  return Response.json(result.output);
}
