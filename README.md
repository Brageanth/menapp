# Menapp

Planificación de menú semanal armada con componentes reutilizables (proteína, base, verdura, salsa…)
+ despensa + lotes preparados + lista de compras + metas nutricionales con presupuesto de gustos +
captura de facturas con OCR + avisos por Web Push + motor de sugerencias + ajuste de componentes con IA.

El sistema anterior (recetas completas + menú semanal sobre `recipes`/`menu_days`) quedó
completamente deprecado y retirado — ver `AUDITORIA_Y_PLAN.md` para el historial de fases (F0–F11)
y el rediseño a componentes.

Producción: https://menapp-gules.vercel.app

## Setup

```bash
npm install
vercel link --yes --project menapp   # o: cp .env.local.example .env.local y completar a mano
vercel env pull .env.local --environment=development --yes
npm run dev
```

`vercel env pull` no trae `SUPABASE_SERVICE_ROLE_KEY` (nunca se sube como secreto de equipo por default) — copiarla a mano desde Supabase Dashboard > Project Settings > API. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`CRON_SECRET` (F8, avisos) sí viven en Vercel env una vez seteadas con `vercel env add`.

## Arquitectura

- `src/domain/` — entidades y reglas de negocio, sin imports de Next/Supabase/Dexie.
- `src/data/` — único lugar que toca Supabase/Dexie. `local-db.ts` (IndexedDB), `sync-queue.ts` (cola offline), `repositories/` (lectura local-first + push a Supabase).
- `src/app/` — rutas Next (App Router). `(tabs)/` son las 6 pantallas del bottom nav (Hoy/Semana/Despensa/Armar/Componentes/Metas) + pantallas secundarias linkeadas desde ellas (`/lotes` desde Armar/Componentes, `/avisos` desde Hoy/Metas). `api/` son los endpoints server-side (OCR, ajuste de componente con IA, sugerir componente con IA, Web Push).
- `src/lib/` — helpers de browser sin estado de dominio (`push-client.ts`: Push API del navegador).
- `public/sw.js` — service worker: cache de shell (producción) + `push`/`notificationclick` para las notificaciones de F8.

## Notas del modelo de componentes

- `Component.typicalSlots?: MealSlot[]` — opcional; `undefined` = sirve para cualquier comida. El
  motor de sugerencias (`suggestComponentsForRole`) descarta un candidato si `typicalSlots` no
  incluye el slot que se está armando (con fallback a mostrar algo si eso deja todo vacío). Sin
  esto, un solo componente "genérico" (ej. huevo) termina sugerido igual para cena que para
  desayuno — pasó en producción, ver commits `c13f5a2`/`13764f4`.
- Los ids de `assembled_meals`/`meal_templates` son deterministas (`"${date}-${slot}"`,
  `"default-${slot}"`) a propósito, para poder hacer upsert por fecha+slot sin duplicar — por eso
  esas dos columnas en Supabase son `text`, no `uuid` (bug real ya corregido, ver commit `c67850e`).
- "Generar menú" invoca IA para crear componentes faltantes por **(rol, comida)**, no por rol
  solo — si ya hay ≥3 candidatos activos compatibles con ese slot, no inventa nada (así que un
  reintento "rápido" sin resultado nuevo casi siempre significa que ya hay suficientes, no que algo
  falló).
