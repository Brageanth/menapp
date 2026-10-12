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
- `src/app/` — rutas Next (App Router). `(tabs)/` son las 6 pantallas del bottom nav (Hoy/Semana/Despensa/Armar/Componentes/Metas) + pantallas secundarias linkeadas desde ellas (`/lotes` desde Armar/Componentes, `/avisos` desde Hoy/Metas). `api/` son los endpoints server-side (OCR, ajuste de componente con IA, Web Push).
- `src/lib/` — helpers de browser sin estado de dominio (`push-client.ts`: Push API del navegador).
- `public/sw.js` — service worker: cache de shell (producción) + `push`/`notificationclick` para las notificaciones de F8.
