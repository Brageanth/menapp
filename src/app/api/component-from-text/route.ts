import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';
import type { Component } from '@/domain/component';

const roleIdSchema = z.enum(['proteina', 'base', 'verdura', 'fruta', 'lacteo', 'grasa', 'salsa', 'bebida', 'postre']);
const mealSlotSchema = z.enum(['D', 'M', 'A', 'O', 'C']);

const componentInputSchema = z.object({
  name: z.string(),
  roles: z.array(roleIdSchema),
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
  ingredients: z.array(z.object({ name: z.string(), quantity: z.number(), unit: z.string() })).nullable(),
  steps: z.array(z.string()).nullable(),
  isCompleteDish: z.boolean().nullable(),
  favorite: z.boolean(),
  notes: z.string().nullable(),
});

const OUTPUT_CONTRACT = `Reglas para completar el JSON:
- "roles": elegí uno o más de [proteina, base, verdura, fruta, lacteo, grasa, salsa, bebida, postre] según corresponda.
- "origin": "simple" salvo que la descripción implique una preparación con pasos/ingredientes propios, en ese caso "preparado" y completá "ingredients" y "steps".
- "weightState": "crudo" salvo que se indique que ya está cocido.
- "macrosBasis": "per100g" salvo que el alimento se mida naturalmente por unidad (ej. un huevo, una fruta entera), en ese caso "perUnit".
- "isTreat": true solo si es evidentemente un gusto/golosina. "favorite": false por defecto.
- "portion": inferí un valor típico realista en la unidad elegida, con un rango mínimo/máximo razonable y un paso de ajuste.
- "macros": valores realistas y coherentes con la base elegida (per100g o perUnit).
- Para "typicalSlots", "flavorProfile", "temperature", "effort", "cookedShelfLifeDays", "batchable", "ingredients", "steps", "isCompleteDish", "notes": devolvé null si no hay información clara para inferirlos (no inventes).
- "typicalSlots", si se infiere, usa valores de [D, M, A, O, C] (desayuno, media mañana, almuerzo, onces, cena).`;

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
  const { description, existing } = (await req.json()) as { description: string; existing?: Component };

  if (!description?.trim()) return Response.json({ error: 'falta la descripción' }, { status: 400 });

  const prompt = existing ? buildEditPrompt(description, existing) : buildCreatePrompt(description);

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: componentInputSchema }),
    messages: [{ role: 'user', content: prompt }],
  });

  await logAiUsage('component-from-text', result.usage);
  return Response.json(result.output);
}
