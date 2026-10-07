# Menapp

Planificación de menú semanal + despensa + lista de compras + metas nutricionales + captura de facturas con OCR + biblioteca de recetas + avisos por Web Push + ajuste de recetas con IA.

Ver `AUDITORIA_Y_PLAN.md` para el plan de fases (F0–F11) y el estado actual.

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
- `src/app/` — rutas Next (App Router). `(tabs)/` son las 5 pantallas del bottom nav (Hoy/Semana/Despensa/Recetas/Metas) + pantallas secundarias linkeadas desde ellas (`/avisos` desde Metas). `api/` son los endpoints server-side (OCR, generación de menú, Web Push).
- `src/lib/` — helpers de browser sin estado de dominio (`push-client.ts`: Push API del navegador).
- `public/sw.js` — service worker: cache de shell (producción) + `push`/`notificationclick` para las notificaciones de F8.
