# Menapp — Auditoría y plan de fases

Fuente: diseño en Claude Artifact (canvas "Menapp"), set de pantallas vigente `_B`. El grupo "Opción A" (Main, Inventario, Captura, Factura, Receta, CompartirMenu sin sufijo) está marcado "descartada" en el canvas — no se construye.

## Estado actual

- **F0 ✅, F1 ✅, F2 ✅, F3 ✅, F4 ✅, F5 ✅ y F6 ✅ completas.** F7 es la próxima.
- **Deploy:** https://menapp-gules.vercel.app (Vercel Hobby, proyecto `menapp` en la org `brageanth-palencias-projects`). Desplegado en prod con F5.
- **Supabase:** proyecto `menapp` (`gwmsumtqqzgmbtavcfdk`, región us-east-1, org BDP). Schema base + RLS + bucket `receipts` aplicados; tabla `receipts` ampliada con columna `items jsonb` (F5).
- **Repo:** git local en este folder, sin remoto configurado todavía.
- Credenciales reales en `.env.local` (gitignored); plantilla en `.env.local.example`.

## Qué es la app

Planificación de menú semanal + despensa + lista de compras + metas nutricionales (yo/pareja) + captura de facturas con OCR + biblioteca de recetas + ajuste de recetas con IA.

## Decisiones de arquitectura (cerradas)

- **Auth:** 1 solo login por hogar (Supabase Auth, magic link). "Yo"/"Pareja" son 2 filas de datos de metas nutricionales, no 2 cuentas ni roles.
- **Metas nutricionales:** 100% manuales. El usuario ya trae sus macros (nutricionista externo), la app solo las setea. Sin IA, sin upload de foto/PDF para extraerlas.
- **Offline-first:** fundacional, no pulido final. Capa IndexedDB (Dexie) como fuente de verdad local para lecturas; cola de escrituras pendientes que sincroniza contra Supabase cuando hay red. Se construye en F0, todas las fases siguientes lo heredan.
- **Mobile-first:** PWA instalable (manifest + service worker/Workbox), no app nativa. Diseño ya es 390×844.
- **Costo:** mantener en free tier siempre que se pueda.
  - Vercel Hobby (free).
  - Supabase free tier (Postgres + Auth + Storage 1GB).
  - Push notifications: Web Push API nativo del navegador (gratis, sin servicio de terceros).
  - Modelos IA: Claude Haiku (vía Vercel AI Gateway) para las 3 features IA — son llamadas puntuales de bajo volumen (2 personas), no justifican un modelo grande.
  - Sin add-ons de pago (sin Resend pago, sin push pago, sin DB managed de pago).

## Riesgos / rabbit holes a vigilar

- OCR de factura: precisión variable. Fallback manual siempre visible, nunca debe bloquear el flujo.
- Generación de menú con IA en modo "solo lo que tengo": validar que la IA no invente ingredientes fuera de despensa/biblioteca antes de aplicar el resultado.
- Captura de foto de factura offline: se guarda en cola, pero el OCR requiere red — la UI debe mostrar "pendiente de conexión" explícito, nunca fallar en silencio.
- Sync entre los 2 dispositivos del hogar: definir resolución de conflictos (quién gana si ambos editan despensa offline al mismo tiempo) — se resuelve en la fase de cool-down, pero hay que decidirlo ahí, no improvisarlo.

## Stack

- Next.js (App Router) + Vercel, Node runtime.
- Supabase: Auth + Postgres + Storage (fotos de factura).
- Dexie (IndexedDB) para la capa local-first + cola de sync.
- Vercel AI Gateway + AI SDK, modelo Claude Haiku, para OCR, generación de menú y ajuste de receta.
- Web Push API nativo para notificaciones.

## Fases entregables (lanzamientos continuos, cada una usable sola)

Orden fijo por dependencia de datos: F0→F1→F2→F3→F4 (base determinística, sin IA) antes de meter IA en F5/F6/F8.

### F0 — Esqueleto + offline-first base (1–1.5 semanas) ✅
Next.js + Vercel. Auth simple (1 login por hogar). Schema base: `profiles` (datos de metas, no de auth), `inventory_items`, `recipes`, `menu_days`, `shopping_list_items`, `receipts`, `notifications`. PWA: manifest + service worker. Capa Dexie/IndexedDB con cola de escrituras pendientes sincronizando contra Supabase. Bottom nav (Hoy/Semana/Despensa/Recetas/Metas) con datos ya viviendo en esa capa.
No-go: nada de IA.
Entregable: PWA instalable, funciona sin señal, navegable. **Hecho** — deployado, login con magic link probado contra Supabase real.

### F1 — Despensa real (1 semana) ✅
Inventario_B: CRUD completo (nombre, cantidad, unidad, ubicación nevera/alacena, vencimiento) sobre la capa local-first. Tabs Todo/Nevera/Alacena/Por vencer, búsqueda, orden "gastar primero".
Entregable: gestionás tu despensa a mano, offline, sin IA. **Hecho** — agregar/editar/eliminar vía form sheet, probado en browser.
Notas técnicas que importan para fases siguientes: el service worker solo se registra en producción (`NODE_ENV === 'production'`) porque en dev cachea chunks viejos y rompe Fast Refresh; las fechas de vencimiento se parsean a medianoche local (no UTC) para no correrse un día en timezones detrás de UTC — mismo cuidado aplica a cualquier campo de fecha nuevo (recetas, menú).

### F2 — Biblioteca + Receta, sin IA (1 semana) ✅
Biblioteca_B (CRUD receta: slot, tiempo, ingredientes, pasos) + Receta_B (detalle, check local contra despensa, porciones por persona con cantidades fijas).
Entregable: recetario funcional con "te falta X" calculado localmente. **Hecho** — `recipeRepo` sobre Dexie (ya existía desde F0), sheet de alta/edición con ingredientes y pasos dinámicos, detalle con selector de porciones que escala cantidades y recalcula faltantes contra `inventoryRepo` en vivo.
Notas técnicas que importan para fases siguientes: `missingIngredients`/`scaleIngredients` en `domain/recipe.ts` matchean ingrediente↔despensa por nombre normalizado (`toLowerCase`), sin ids compartidos — F4 (lista de compras) y F6 (menú IA) deben reusar ese mismo matching, no inventar otro.

### F3 — Menú semanal manual (1 semana) ✅
Home_B + Semana_B: asignación manual de receta de biblioteca a cada slot (D/M/A/O/C) por día. Resumen de variedad calculado (no repetido, N proteínas distintas).
Entregable: planificás tu semana completa sin IA. **Hecho** — `menuRepo` sobre Dexie (ya existía desde F0), grid semanal con picker por slot (`MenuSlotSheet`), navegación semana anterior/siguiente, resumen de repetidos/proteínas distintas en header; Hoy lee la asignación del día desde la misma capa.
Notas técnicas que importan para fases siguientes: se agregó `proteinTag?: string` opcional a `Recipe` (texto libre, sin taxonomía fija) solo para calcular variedad — F6 (menú IA) puede reusarlo o inferirlo, no inventar otro campo. Fechas como string `YYYY-MM-DD` en hora local (`domain/menu.ts: toDateKey`), mismo cuidado de timezone que F1.

### F4 — Lista de compras derivada (4–5 días) ✅
Compras_B: `menú asignado − inventario = faltantes`, agrupado por categoría (verduras/proteínas/despensa), badge contador en Semana, marcar "ya compré", copiar texto/WhatsApp.
Entregable: cálculo automático, es matemática, no IA. Pantalla crítica offline (uso en el súper). **Hecho** — `deriveShoppingList`/`reconcileShoppingList` en `domain/shopping-list.ts` (agrega ingredientes de la semana por nombre normalizado, mismo matching que F2, resta inventario, categoriza por keywords), `shoppingListRepo` (ya existía desde F0) persiste el estado `purchased` entre refrescos, pantalla `/compras` con copiar texto y link a WhatsApp, badge contador en el header de Semana.
Notas técnicas que importan para fases siguientes: categorización por keywords estáticas (`CATEGORY_KEYWORDS` en `domain/shopping-list.ts`), no hay taxonomía de ingredientes real — si F5/F6 necesitan categorías más precisas, extender esa lista, no inventar otra.

### F5 — Captura + OCR con IA (1.5 semanas) ✅
Captura_B (foto/galería, funciona offline en cola) → Claude Haiku multimodal → `{name, qty, unit, confidence}` → Confirmar_B (estados de confianza, desambiguación, guardar en despensa → actualiza F1).
Entregable: cargar una compra real toma 10 segundos. **Hecho** — `domain/receipt.ts` + `receiptRepo` sobre Dexie (`version(2)`, tabla `receipts`), `src/data/photo-queue.ts` sube la foto comprimida (canvas, máx. 1600px/JPEG 0.75, por el límite de 4.5MB de las Vercel Functions) a Storage y llama `/api/ocr-receipt`; si no hay red, encola el `Blob` en una tabla Dexie aparte (`pendingPhotos`) y reintenta solo al volver la señal. `/api/ocr-receipt` usa `generateText` + `output: Output.object()` (AI SDK 7 — `generateObject` está deprecado) contra `anthropic/claude-haiku-4.5` vía AI Gateway. Pantallas `/despensa/captura` y `/despensa/captura/confirmar` (lista editable con badge de confianza alta/media/baja).
Notas técnicas que importan para fases siguientes: la tabla `receipts` de Supabase ya existía desde F0 sin columna `items` — se agregó por `ALTER TABLE` (`items jsonb default '[]'`), no recrear la tabla. `AI_GATEWAY_API_KEY` no hace falta en Vercel (usa OIDC del proyecto linkeado), sí en local (`.env.local` o `vercel env pull`). `cacheComponents`/`partialPrefetching` se sacaron de `next.config.ts`: la app es 100% client-side/offline-first y esa validación de prerender estático no aporta nada acá, solo bloqueaba el build en pantallas que leen fecha/hooks de URL — no reactivar sin repensar esto. Se arregló además un bug pre-existente de login: `signInWithOtp` no fijaba `emailRedirectTo`, así que el magic link nunca pasaba por un endpoint que llamara `exchangeCodeForSession` y el usuario volvía a `/login` tras tocar el link — ahora hay una ruta `src/app/auth/callback/route.ts` excluida del gate de auth en `proxy.ts`.

### F6 — Generación de menú con IA (1.5 semanas) ✅
Generar_B: toggles (prioriza biblioteca, usa lo que vence, variedad, usar metas, incluir medias nueves, modo solo-despensa/permitir-compras) → Claude Haiku con inventario+biblioteca+reglas → menú de N días asignado a slots → aplica sobre F3.
Entregable: "generar menú" en un clic. **Hecho** — botón "Generar" en el header de Semana abre `GenerarMenuSheet` (toggles + modo), `POST /api/generate-menu` manda el catálogo de recetas (solo id/nombre/slot/proteína/nombres de ingredientes, nunca cantidades reales) y la despensa a Claude Haiku vía AI Gateway (mismo patrón `generateText` + `Output.object()` de F5), devuelve `{date, slot, recipeId}[]`. `domain/menu.ts: sanitizeGeneratedMenu` descarta cualquier asignación cuyo `recipeId` no exista en la biblioteca, cuyo slot no coincida con el de esa receta, o cuya fecha esté fuera de la semana pedida — nunca se aplica un resultado crudo de la IA. El resultado sanitizado se aplica sobre `menuRepo` igual que una asignación manual (F3). Sin conexión el botón queda deshabilitado con aviso explícito, igual que el riesgo ya anotado para F5.
Notas técnicas que importan para fases siguientes: "usar metas" todavía no escala porciones (eso es F7) — solo le pasa un resumen de texto de `profiles` al prompt como contexto, no hace cálculo real.

### F7 — Metas manuales + escalado por persona (4–5 días)
Metas_B: input manual de kcal/proteína/carbos/grasas por perfil (yo/pareja). Escalado real de porciones en Receta_B y en F6 según esas metas.
Entregable: el menú generado respeta metas reales de cada persona.

### F8 — Ajustar receta con IA (1 semana)
AjusteIA_B: texto libre → Claude Haiku devuelve diff de ingredientes/pasos, detecta faltantes y los agrega a la lista de compras, guardar como variante o versión nueva (versionado real de receta).
Entregable: editás una receta por lenguaje natural, con historial.

### F9 — Notificaciones (4–5 días)
Avisos_B: alertas por reglas sobre inventario+lista (comprar hoy, vence pronto, bajo stock), configuración de márgenes y hora diaria, delivery vía Web Push.
Entregable: avisa antes de que algo se dañe o falte.

### F10 — Compartir completo (3–4 días)
Compartir_B: tabs Día/Semana/Receta/Lista, texto plano + abrir WhatsApp.

### F11 — Cool-down: sync fino + costos IA + accesibilidad
Resolución de conflictos de sync entre los 2 dispositivos del hogar, telemetría de costo de las 3 features IA (OCR + generación + ajuste), accesibilidad, performance. Sin features nuevas.

## Nota de mantenimiento

Cuando se empiecen a crear archivos del proyecto: al terminar cada fase que agregue/renombre archivos o cambie imports, correr `/graphify . --update`.
