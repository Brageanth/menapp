# Menapp

Planificación de menú semanal + despensa + lista de compras + metas nutricionales + captura de facturas con OCR + biblioteca de recetas + ajuste de recetas con IA.

Ver `AUDITORIA_Y_PLAN.md` para el plan de fases (F0–F11).

## Setup

```bash
npm install
cp .env.local.example .env.local
# completar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

## Arquitectura

- `src/domain/` — entidades y reglas de negocio, sin imports de Next/Supabase/Dexie.
- `src/data/` — único lugar que toca Supabase/Dexie. `local-db.ts` (IndexedDB), `sync-queue.ts` (cola offline), `repositories/` (lectura local-first + push a Supabase).
- `src/app/` — rutas Next (App Router). `(tabs)/` son las 5 pantallas del bottom nav (Hoy/Semana/Despensa/Recetas/Metas).
