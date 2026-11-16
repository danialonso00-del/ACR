# Arquitectura y decisiones

## Visión general

```
SDR público (sdr.arc.cat) ──► scripts/ingest (jobs explícitos, backend) ──► data/raw (inmutable, hash + manifiesto)
ICGC WFS ───────────────────► scripts/geo ─────────────────────────────────► data/geo (SVG proyectado, nomenclátor)
                                     │
                                     ▼
                         data/snapshots/<modo>/ (records.json.gz + meta + fotos)
                                     │
               src/lib/data/repository.ts (servidor, caché en memoria, un modo cada vez)
                                     │
      src/lib/analytics (filtros → scope → métricas)  ◄── src/lib/ai/tools.ts (herramientas tipadas)
                │                                            │                  │
     Server Components (páginas)                 /api/assistant (stream NDJSON)  guided.ts (sin modelo)
     + API routes (tabla, export, fotos,                     │
       informes, importador)                         Claude (Messages API, tool use)
```

- **Un único contrato de dominio** (`src/lib/data/types.ts`) para `public_snapshot`, `imported` y `synthetic_demo`. Los componentes consumen el mismo contrato y nunca mezclan modos; el modo activo se muestra siempre en la barra superior.
- **Un único ámbito**: `parseFilters` → `buildScope` alimenta KPI, gráficos, mapa, tabla, exportación, informes y herramientas de IA. Los filtros viven en la URL. Las herramientas de IA anuncian explícitamente cualquier cambio de ámbito (`scopeChange`).
- **Cálculo en código, IA para interpretar**: el modelo no ve la base de datos; solo los resultados agregados de las herramientas, cada uno con su bloque de evidencias.

## Pila y versiones (fijadas en `package-lock.json`)

| Componente | Versión | Motivo |
| --- | --- | --- |
| Node.js | ≥ 20.9 (probado en 24.14) | Requisito de Next 16 |
| Next.js (App Router, Turbopack) | 16.4.5 | Versión estable soportada; `params`/`searchParams` asíncronos |
| React | 19.3.1 | |
| TypeScript | 5.9.3 (estricto, `noUncheckedIndexedAccess`) | Se descartó TS 7.0.2 (publicada el mismo día, port nativo) por riesgo de compatibilidad con el tooling de Next |
| Tailwind CSS | 4.3.4 | Tokens en `globals.css` (`@theme`) |
| Radix UI (`radix-ui`) | 1.8.1 | Primitivas accesibles (Dialog, Popover, Tabs) con el patrón de shadcn/ui escrito en el repo (`src/components/ui`); no se usó el CLI de shadcn para no depender de generación remota |
| ECharts | 6.1.0 | Interacción, zoom, exportación SVG, renderer SVG, tree-shaking |
| TanStack Table | 8.21.3 | Tabla con paginación, orden y columnas gestionadas en servidor (v9 recién publicada; no se adoptó todavía) |
| Zod | 4.6.7 | Validación de filtros, API y entradas de herramientas; JSON Schema de las herramientas |
| @anthropic-ai/sdk | 1.4.0 | Messages API con streaming y herramientas |
| jsPDF + jspdf-autotable | 4.2.1 / 5.0.9 | PDF con texto seleccionable, tablas reales y gráficos vectoriales |
| papaparse / read-excel-file | 5.7.0 / 9.3.14 | Importador CSV/XLSX. Se sustituyó `exceljs` por sus 9 vulnerabilidades moderadas transitivas |
| Vitest / Playwright | 4.1.12 / 1.64.1 | Pruebas unitarias y E2E |
| ESLint | 10.14.0 + eslint-config-next 16.4.5 | |

`npm audit --omit=dev`: 0 vulnerabilidades. Quedan avisos moderados solo en la cadena de desarrollo de ESLint (minimatch).

## Persistencia

La demo usa un **adaptador en memoria** (`repository.ts`) sobre ficheros versionados: 15.063 registros ≈ 5 MB comprimidos que se cargan una vez por proceso. Así la demo es reproducible sin servicios externos y cumple el objetivo de latencia (ver `docs/TESTING.md`). `db/schema.sql` define el destino PostgreSQL para el piloto (versiones de boletín, medidas por fracción, anotaciones de fotos separadas de predicciones, ejecuciones de análisis e informes). PostGIS no es necesario: no hay operaciones espaciales en servidor.

Informes, importaciones, cachés de galería y de imágenes se guardan en `data/runtime` y `data/cache` (fuera de git; escritura atómica de informes). En producción irían a PostgreSQL y a almacenamiento compatible con S3.

## Ingesta

Scripts en TypeScript (`tsx`) en lugar de un worker Python: el volumen (≈ 1,5 MB por año) y los parsers no lo justificaban, y así se mantiene una sola cadena de herramientas. Los jobs son explícitos, reanudables por año, serializados y con límites (ver `docs/DATA_SOURCES.md`). Los procesos largos no corren en peticiones web: la app solo hace lecturas puntuales (galería y miniaturas de un boletín cuando alguien lo consulta), con caché.

## Asistente IA

- Proveedor configurable mediante variables de entorno (`ANTHROPIC_API_KEY`, `ARC_AI_MODEL`, por defecto `claude-opus-5-5`, `ARC_AI_EFFORT=medium`). Los secretos solo se leen en el servidor.
- Bucle manual de streaming con herramientas definidas con Zod → JSON Schema (`eager_input_streaming`). Cada entrada se valida antes de ejecutarse; las inválidas devuelven un `tool_result` de error. Se gestionan `refusal`, `max_tokens` y `pause_turn`.
- Fallback del lado del servidor ante rechazos de seguridad (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); se desactiva con `ARC_AI_FALLBACKS=off`.
- Presupuesto por pregunta: rondas de herramientas, tokens acumulados, tiempo máximo y cancelación desde el cliente (`AbortSignal`).
- El historial es append-only: el cliente devuelve exactamente los mensajes recibidos (incluidos los bloques de pensamiento) para mantener válido el pensamiento preservado.
- Prompt de sistema estable (cacheable); el ámbito se inyecta como contexto de usuario etiquetado.
- RAG mínimo (BM25 por encabezados) sobre `docs/`. El texto recuperado se etiqueta como dato no fiable.
- Sin clave: «Mode demostració sense model connectat». Ejecuta consultas guiadas deterministas sobre las mismas herramientas y nunca simula respuestas de un LLM.

## Seguridad

- Lista blanca de host (`sdr.arc.cat` por https) en todas las peticiones salientes (protección SSRF). Las redirecciones solo se siguen dentro de la lista.
- Proxy de imágenes limitado a IDs presentes en galerías indexadas o leídas; el tipo se detecta por los bytes.
- Validación con Zod en todas las rutas; límites de tamaño (importación de 10 MB y 50.000 filas, historial del asistente de 400 KB, exportación de 20.000 filas).
- Exportaciones CSV con protección contra inyección de fórmulas. El texto externo (observaciones, documentos) se renderiza como texto, nunca como HTML, y el markdown del asistente pasa por un renderizador propio sin HTML.
- Cabeceras: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`.
- Datos personales del CSV (matrícula y asistentes) excluidos del conjunto analítico.
- Sin pantalla de login ficticia. En producción: roles lector, analista y administrador con control de acceso en servidor (ver `docs/PILOT.md`).

## Diseño visual

- Tokens de marca del brief (`#05A64A`) con una escala de verdes derivada (`--g-50` a `--g-900`) y un degradado de marca para acciones, navegación y el asistente. El verde identifica la marca, la acción o una serie única sin carga valorativa (evolución de impropios, barras con n); nunca codifica «resultado favorable». Por eso el mapa sigue en azul.
- Paleta categórica de 8 colores en orden fijo, validada con el validador de paleta (CVD ΔE ≥ 9,1, visión normal ≥ 19,6). El aviso de contraste se compensa con una vista de tabla en cada gráfico.
- Secuencial azul para el mapa, con clases fijas comparables entre filtros. Divergente azul ↔ rojo para cambios en pp (con iconos ▲▼).
- Ningún gráfico usa doble eje: la serie de muestras y la del porcentaje son gráficos separados.
- Inter (autoalojada con `@fontsource`, sin llamadas a Google Fonts). Números tabulares en las tablas.
- Movimiento: entrada escalonada de cada pantalla (solo al navegar, no al cambiar filtros), elevación en tarjetas interactivas, paneles laterales flotantes y, en el asistente, orbe animado, pasos de herramientas con estado, texto en streaming con cursor y composer con foco luminoso. Curvas `ease-out` de 140–520 ms; con `prefers-reduced-motion` todo queda estático.
- Estructura de navegación: barra lateral flotante agrupada (Explora, Intel·ligència, Dades) y un indicador del recorrido «Resum → Territori → Mostra → Fotos → IA → Informe» en las pantallas que lo forman.
- Modo oscuro opcional (conmutador), con prioridad del tema claro.
