/**
 * Cantidades con unidad. Todo se guarda en una unidad canónica por dimensión — 'g' (masa), 'ml'
 * (volumen) o 'unidad' (conteo) — para poder sumar "0.2 Kg" + "500 g" sin mirar cómo lo escribió
 * cada quien. Una unidad desconocida (ej. "docena de huevos" mal escrita) queda tal cual y solo
 * se combina con la misma unidad. Entre conteo y masa se puentea con el peso por unidad.
 */
export interface Amount {
  quantity: number;
  unit: string;
}

export type CanonicalUnit = 'g' | 'ml' | 'unidad';
export type UnitKind = 'mass' | 'volume' | 'count' | 'other';

const UNIT_GROUPS: { unit: CanonicalUnit; factor: number; names: string[] }[] = [
  { unit: 'g', factor: 1, names: ['g', 'gr', 'grs', 'gramo', 'gramos'] },
  { unit: 'g', factor: 1000, names: ['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos'] },
  { unit: 'g', factor: 453.592, names: ['lb', 'lbs', 'libra', 'libras'] },
  { unit: 'g', factor: 28.3495, names: ['oz', 'onza', 'onzas'] },
  { unit: 'ml', factor: 1, names: ['ml', 'mililitro', 'mililitros', 'cc'] },
  { unit: 'ml', factor: 1000, names: ['l', 'lt', 'lts', 'litro', 'litros'] },
  {
    unit: 'unidad',
    factor: 1,
    names: [
      'unidad', 'unidades', 'u', 'un', 'und', 'unds', 'ud', 'uds', 'pieza', 'piezas', 'pza', 'pzas',
      'lata', 'latas', 'paquete', 'paquetes', 'bolsa', 'bolsas', 'caja', 'cajas', 'botella', 'botellas',
      'frasco', 'frascos', 'sobre', 'sobres',
    ],
  },
  { unit: 'unidad', factor: 12, names: ['docena', 'docenas'] },
];

const UNIT_LOOKUP = new Map<string, { unit: CanonicalUnit; factor: number }>(
  UNIT_GROUPS.flatMap((g) => g.names.map((n) => [n, { unit: g.unit, factor: g.factor }] as const))
);

function unitKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.$/, '');
}

export function roundAmount(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Misma cantidad expresada en la unidad canónica de su dimensión ("" cuenta como unidades). */
export function canonicalAmount(quantity: number, rawUnit: string): Amount {
  const key = unitKey(rawUnit);
  if (!key) return { quantity: roundAmount(quantity), unit: 'unidad' };
  const known = UNIT_LOOKUP.get(key);
  if (!known) return { quantity: roundAmount(quantity), unit: key };
  return { quantity: roundAmount(quantity * known.factor), unit: known.unit };
}

export function unitKind(unit: string): UnitKind {
  const { unit: canonical } = canonicalAmount(0, unit);
  if (canonical === 'g') return 'mass';
  if (canonical === 'ml') return 'volume';
  if (canonical === 'unidad') return 'count';
  return 'other';
}

/**
 * `amount` expresada en la unidad canónica de `targetUnit` (el resultado de pedir "kg" viene en g),
 * o null si no se pueden comparar. `unitWeightG` (gramos por unidad) puentea unidades ↔ gramos.
 */
export function convertToUnit(amount: Amount, targetUnit: string, unitWeightG?: number | null): number | null {
  const from = canonicalAmount(amount.quantity, amount.unit);
  const target = canonicalAmount(0, targetUnit).unit;
  if (from.unit === target) return from.quantity;
  const weight = unitWeightG && unitWeightG > 0 ? unitWeightG : null;
  if (weight === null) return null;
  if (from.unit === 'unidad' && target === 'g') return roundAmount(from.quantity * weight);
  if (from.unit === 'g' && target === 'unidad') return roundAmount(from.quantity / weight);
  return null;
}

function trimmed(n: number): string {
  return String(Number(n.toFixed(2)));
}

/** "1.5 kg", "200 g", "1 unidad", "3 unidades", "2 L" — la unidad más cómoda de leer. */
export function formatAmount(amount: Amount): string {
  const { quantity, unit } = canonicalAmount(amount.quantity, amount.unit);
  if (unit === 'g') return quantity >= 1000 ? `${trimmed(quantity / 1000)} kg` : `${trimmed(quantity)} g`;
  if (unit === 'ml') return quantity >= 1000 ? `${trimmed(quantity / 1000)} L` : `${trimmed(quantity)} ml`;
  if (unit === 'unidad') return quantity === 1 ? '1 unidad' : `${trimmed(quantity)} unidades`;
  return `${trimmed(quantity)} ${unit}`;
}

/**
 * Descriptores de preparación que no cambian lo que se compra ("cebolla picada", "pechuga de pollo en
 * cubos", "huevo frito"). "rallado", "molida" y "congelado" no están: pan rallado o carne molida SON
 * el producto. Se aplican sobre texto sin acentos y en minúsculas.
 */
const PREPARATION: RegExp[] = [
  /\b(?:en|al|a la)\s+(?:cubos?|cubitos?|trozos?|rodajas?|tiras?|juliana|laminas?|cuadritos?|pedazos?|vapor|plancha|parrilla|horno|sarten|air ?fryer|freidora de aire)\b/g,
  /\b(?:picad|cocid|frit|pelad|desmenuzad|trocead|guisad|asad|hervid|saltead|lavad|cortad|prehech|rebanad)[oa]s?\b/g,
  /(?<!queso )\bfresc[oa]s?\b/g,
  /^tostadas? de /g,
];

/** El producto sin su preparación, conservando mayúsculas y acentos: "Brócoli al vapor" → "Brócoli". */
export function cleanProductName(name: string): string {
  const original = name.trim().normalize('NFC');
  const plain = original.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const removed = new Array<boolean>(original.length).fill(false);
  for (const re of PREPARATION) {
    for (const m of plain.matchAll(re)) {
      for (let i = m.index; i < m.index + m[0].length; i++) removed[i] = true;
    }
  }
  const cleaned = [...original].filter((_, i) => !removed[i]).join('').replace(/\s+/g, ' ').trim();
  return cleaned || original;
}

/** Singular aproximado palabra por palabra, solo para comparar nombres ("camarones" ≈ "camarón"). */
function singularWord(word: string): string {
  if (word.length < 4) return word;
  if (/[nrldz]es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Clave para decidir si dos nombres son el mismo producto: sin acentos, mayúsculas, espacios ni plural. */
export function normalizeItemName(name: string): string {
  return cleanProductName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularWord)
    .join(' ');
}
