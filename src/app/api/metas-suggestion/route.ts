import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { logAiUsage } from '@/data/log-ai-usage';

const suggestionSchema = z.object({
  suggestion: z.string(),
});

interface MacroInput {
  label: string;
  actual: number;
  target: number;
}

export async function POST(req: Request) {
  const { personLabel, kcalTarget, macros, recipeNames } = (await req.json()) as {
    personLabel: string;
    kcalTarget: number | null;
    macros: MacroInput[];
    recipeNames: string[];
  };

  if (!Array.isArray(macros) || macros.length === 0) {
    return Response.json({ error: 'no hay datos de macros para sugerir nada' }, { status: 400 });
  }

  const gaps = macros
    .filter((m) => m.target - m.actual > 0)
    .map((m) => `${m.label}: le faltan ${Math.round(m.target - m.actual)} g (consumió ${Math.round(m.actual)} de ${Math.round(m.target)} g)`)
    .join('; ');

  if (!gaps) {
    return Response.json({ error: 'ya está cubriendo todas sus metas de hoy' }, { status: 400 });
  }

  const result = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: Output.object({ schema: suggestionSchema }),
    messages: [
      {
        role: 'user',
        content: `Perfil "${personLabel}"${kcalTarget ? `, meta de ${kcalTarget} kcal/día` : ''}. Menú de hoy: ${recipeNames.join(', ') || '(sin recetas asignadas)'}.

Macros que todavía le faltan hoy: ${gaps}.

Sugerí en UNA frase corta (máximo 20 palabras), en español y en tono directo, un agregado simple y realista a una comida de hoy (ej. "agregar un huevo al desayuno") que ayude a cubrir el macro que más falta. No sugieras recetas nuevas ni cambios grandes, solo un agregado chico. No inventes datos que no te di.`,
      },
    ],
  });

  await logAiUsage('metas-suggestion', result.usage);
  return Response.json(result.output);
}
