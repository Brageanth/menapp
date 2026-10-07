# Reglas de este proyecto (anulan el CLAUDE.md global solo acá)

- Implementación directa: editar/crear archivos del repo sin pedir confirmación previa ni mostrar el código completo en el chat. El global dice "nunca editar, dame los pasos" — en este repo vale lo contrario.
- Respuesta por tarea: resumen corto de qué se hizo — archivos tocados (1 línea c/u) y por qué, nada de bloques de código salvo que se pida explícitamente ver algo puntual.
- Excepción que sí requiere preguntar antes: acciones irreversibles o de alto impacto — migraciones SQL contra Supabase real, borrar datos, cambios de schema en prod, git push/force, borrar archivos no generados en la sesión.
- Seguir vigentes del global: Caveman Lite en la comunicación, leer `graphify-out/GRAPH_REPORT.md` antes de explorar, correr `/graphify . --update` al terminar una fase que agregue/renombre archivos o cambie imports.
