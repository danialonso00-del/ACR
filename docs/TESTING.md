# Pruebas y resultados

Ejecutadas el 06/11/2026 en Windows 11, Node 24.14.1, Intel Core i5-1135G7 (8 hilos) y 16 GB de RAM.

## Comandos

```
npm run typecheck      # tsc --noEmit (estricto)
npm run lint           # ESLint 10 + eslint-config-next
npm run test           # Vitest (unitarias)
npm run build          # build de producción
npm run test:e2e       # Playwright (arranca `next start` en :3210 o usa BASE_URL)
npm run bench          # latencia de filtros y analítica
npm run test:all       # typecheck + lint + test + build
```

## Resultados

| Verificación | Resultado |
| --- | --- |
| Typecheck | OK, 0 errores |
| Lint | 0 errores, 1 aviso esperado (TanStack Table y React Compiler: `incompatible-library`) |
| Unitarias (Vitest) | **39/39** OK |
| Build de producción | OK (22 rutas) |
| E2E (Playwright, contra `next start`) | **5/5** OK |
| `npm audit --omit=dev` | 0 vulnerabilidades |

### Qué cubren

- **Agregaciones**: denominador (peso total + pérdidas) con factores correctores, *fallback* a la masa declarada, composición que suma 100, nulo frente a cero (sin categorías no hay número), balance no cerrado marcado sin corregir, errores bloqueantes y regla de 90 kg configurable. Los estimadores (media por muestra y razón de masas) dan resultados distintos y documentados.
- **Territorio**: atribución municipal, comarcal y supracomarcal. Los circuitos supracomarcales no se reparten ni se cuentan dos veces, y se excluyen con motivo al filtrar por comarca. Normalización de artículos en catalán y aranés.
- **Ingesta**: mapeo de columnas por cabecera, realineado de observaciones con `;`, decimales con coma y fechas locales. El hash de fila es estable (idempotencia), ignora los campos personales y cambia ante una corrección en origen.
- **Filtros**: valores inválidos descartados, ida y vuelta por la URL, periodo por defecto (último bloque contiguo de años cargados), registros sin fecha contados como exclusión.
- **Cambio interanual**: la cohorte estable ignora los circuitos nuevos; con varianza cero no se declara robusto (comportamiento conservador).
- **Seguridad**: inyección CSV, lista blanca de host contra SSRF (incluida la IP de metadatos), detección del tipo de imagen por bytes.
- **IA**: esquemas tipados sin parámetros libres y evidencias en cada número. Una pregunta sin datos devuelve una limitación y nunca una cifra. Se rechazan entradas SQL, campos extra y *path traversal*. Las observaciones se etiquetan como no fiables. El bucle del agente se probó con un SDK simulado: herramientas, historial append-only, entradas inválidas como `tool_result` de error y rechazos como error.
- **E2E**: recorrido completo filtro → circuito (buscador) → explorador → ficha → fotos (o estado vacío) → trazabilidad → pregunta (modo guiado) → «Afegir a informe» → informe → PDF y CSV. Flujo de investigación con dossier, reconciliación API/exportación (mismo número de filas para el mismo ámbito) y ausencia de scroll horizontal a 390 y 768 px en 8 pantallas.

## Reconciliación con la fuente

La ingesta compara el cálculo con los porcentajes publicados: «% Total Impureses» coincide en 15.063/15.063 muestras (±0,1 pp) y los porcentajes por categoría en 165.693/165.693 comprobaciones (±0,02 pp). Ver `docs/COVERAGE.md`.

## Rendimiento

Objetivo del brief: < 300 ms de interacción de filtros sobre el snapshot local.

`npm run bench` (solo cálculo: scope + KPI + serie + cambio interanual + composición + agrupación; 25 repeticiones; 15.063 registros):

| Escenario | n válidas | Mediana | p95 |
| --- | ---: | ---: | ---: |
| Por defecto (2019→, toda Cataluña) | 14.049 | 145 ms | 163 ms |
| Comarca (Vallès Oriental) | 1.082 | 27 ms | 39 ms |
| Un circuito | 31 | 9 ms | 15 ms |
| Todos los años, razón de masas | 15.015 | 164 ms | 186 ms |

Respuesta HTTP completa en producción (`next start`, petición en caliente, render del servidor incluido):

| Ruta | Tiempo |
| --- | ---: |
| `/?comarca=41` | 0,16 s |
| `/?from=2025-01&to=2025-12` | 0,22 s |
| `/territori` | 0,21 s |
| `/caracteritzacions/31301` | 0,14 s |
| `/api/characterizations` (página de 25, toda Cataluña) | 0,25 s |
| `/api/characterizations` (comarca, ordenado) | 0,06 s |
| `/` (toda Cataluña, sin filtros) | 0,50 s |
| `/patrons` (toda Cataluña: clustering k-means + anomalías) | 1,28 s |

Conclusión: los filtros acotados (comarca, periodo, circuito) cumplen el objetivo de < 300 ms en este hardware. La vista sin filtros de toda Cataluña tarda unos 0,5 s y «Patrons» unos 1,3 s por el clustering de 14.000 perfiles. Mejoras previstas: cachear los resultados por ámbito y calcular el clustering bajo demanda. En la primera carga del proceso se suman unos 1–2 s por la descompresión del snapshot.

## No probado en esta sesión

- **Asistente con modelo real**: no había `ANTHROPIC_API_KEY` disponible. El bucle se probó con un SDK simulado; falta una prueba en vivo con clave.
- Revisión con lectores de pantalla reales; la validación WCAG 2.2 AA está pendiente. Se aplicaron foco visible, etiquetas, tablas alternativas, roles ARIA en el mapa y el buscador, y movimiento reducido.
- Navegadores distintos de Chromium.
