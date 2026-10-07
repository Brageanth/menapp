# Menapp

Planificación de menú semanal + despensa + lista de compras + metas nutricionales + captura de facturas con OCR + biblioteca de recetas + ajuste de recetas con IA.

Ver `AUDITORIA_Y_PLAN.md` para el plan de fases (F0–F11) y el estado actual.

Producción: https://menapp-gules.vercel.app

## Setup

```bash
npm install
vercel link --yes --project menapp   # o: cp .env.local.example .env.local y completar a mano
vercel env pull .env.local --environment=development --yes
npm run dev
```

## Arquitectura

- `src/domain/` — entidades y reglas de negocio, sin imports de Next/Supabase/Dexie.
- `src/data/` — único lugar que toca Supabase/Dexie. `local-db.ts` (IndexedDB), `sync-queue.ts` (cola offline), `repositories/` (lectura local-first + push a Supabase).
- `src/app/` — rutas Next (App Router). `(tabs)/` son las 5 pantallas del bottom nav (Hoy/Semana/Despensa/Recetas/Metas).
