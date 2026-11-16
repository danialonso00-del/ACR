# Fuentes de datos

Catálogo de fuentes verificado el 4–5/11/2026. El estado vivo está en `src/lib/data/sources.ts` y se muestra en la pantalla **Fonts i qualitat**.

| Fuente | Estado | Uso en la demo |
| --- | --- | --- |
| SDR · consulta pública de caracterizaciones | Verificada | Lista con «mostrar tots»: estado y fecha de aceptación |
| SDR · EXPORTAR (CSV) | Verificada | Fuente principal de microdatos (`public_snapshot`) |
| SDR · ficha de boletín | Verificada (lectura) | Solo enlace oficial; no se usa para ingesta masiva |
| SDR · galería de fotos por boletín | Parcial | Índice limitado + lectura en vivo bajo demanda |
| API pública documentada | Pendiente | No localizada |
| ICGC · WFS divisiones administrativas | Verificada | Mapa de comarcas y nomenclátor municipal |
| Página ARC de datos FORM | Verificada | Contexto |
| Guía SDR 2007 (PDF) | Parcial | Referencia histórica; no indexada |
| Protocolo FORM oct. 2022 (PDF adjunto) | Pendiente | No está en el repositorio; resumen en `docs/knowledge` |
| Cuantificación del desperdicio alimentario | Pendiente | No incorporada (granularidad agregada) |
| estadistiques.arc.cat | Pendiente | HTTP 503 al comprobarla; no se usa ningún endpoint |
| Noticia de la consulta preliminar de mercado 2026 | Verificada | Contexto |

## 1. SDR: consulta pública y EXPORTAR

- URL: `https://sdr.arc.cat/cform/ListCaracteritzacions.do` (sin credenciales).
- Formulario `POST` (observado en el HTML del 04/11/2026): `butlletiAny`, `butlletiPeriode`, `codiComarca` (`00` = todas), `adscritServeiPublic=S`, `posInicial`, `ordre`, `offset`, `mostrarTots=on`. Son pistas observadas, no un contrato.
- **EXPORTAR**: mismo formulario contra `ListCaracteritzacions.do?accio=Exportar`. Devuelve `Content-Type: text/csv` y `Content-Disposition: attachment; filename="caracteritzacions.csv"`.
- Formato: `windows-1252`, separador `;`, sin comillas, CRLF, `;` final en cada línea, decimales con coma y fechas `dd/mm/aaaa`. Son 93 columnas idénticas de 2006 a 2026. Las observaciones libres pueden contener `;`: el parser realinea la fila y la marca (Q09).
- `Núm Butlletí` coincide con el `oid` de la ficha pública (verificado: 31301 = FIGUERES, 30/10/2026). Las filas de la lista y del CSV coinciden 1:1 por año (por ejemplo, 1.712 en 2026 y 981 en 2006).
- La lista pública solo muestra boletines en estado **Acceptat**.
- Datos personales: el CSV incluye matrícula del vehículo y asistentes. **No se copian** al conjunto analítico; solo permanecen en la capa raw local (fuera de git).
- Nota: el brief citaba 259 resultados para 2006 en una consulta de formulario. La captura completa de 2006 con «mostrar tots» y EXPORTAR devuelve **981** boletines. Probablemente se trata de filtros distintos; queda pendiente aclararlo con la ARC.

### Ingesta (job explícito y reanudable)

```
npm run ingest:sdr -- --years 2006,2019-2026      # extracto inicial (9 años, 18 peticiones)
npm run ingest:sdr -- --years 2007-2018           # ampliación posterior
npm run ingest:sdr -- --years 2026 --refresh      # recaptura (historial de revisiones)
npm run build:snapshot
```

- Conector de backend (`src/lib/sdr/http.ts`): lista blanca de host (`sdr.arc.cat`, solo https), peticiones serializadas, intervalo mínimo (`SDR_MIN_INTERVAL_MS`, 2 s por defecto), timeout, hasta 3 reintentos con backoff exponencial (429/5xx/red), límite de tamaño, User-Agent identificativo sin datos personales y cookie de sesión del propio portal.
- Límite de 12 años por ejecución (`--max-years`). Se reanuda año a año: los años ya capturados se saltan salvo con `--refresh`.
- Capa raw inmutable: `data/raw/sdr/<tipo>/<clave>/<sha256>.csv|html`, junto con un manifiesto (`manifest.json`) con URL, método, parámetros, fecha de captura, SHA-256, tamaño, `Content-Type` y estado HTTP. Nunca se sobrescribe un fichero.
- La captura del 04/11/2026 tuvo errores de red transitorios en 2023–2026; una segunda ejecución reanudó solo esos años.

## 2. SDR: fotografías

- Galería: `EditCaracteritzacionsImatges.do?caractId=<id>`. Imagen: `GetImatge.do?imatgeId=<id>&thumbNail=true|false`.
- El servidor responde con un `Content-Type` no estándar (el nombre del fichero). El proxy detecta JPEG, PNG, WebP o GIF por los bytes y rechaza cualquier otro contenido.
- `npm run ingest:photos -- --recent 60 --per-year 3`: indexa (sin descargar imágenes) las galerías de boletines **cargados**, nunca identificadores enumerados. Resultado: 87 galerías comprobadas, 84 con fotos y 1.463 imágenes. Las 3 galerías de 2006 comprobadas no tenían imágenes.
- Visualización: `/api/photo-image/<id>` solo sirve imágenes de galerías conocidas. Las descarga bajo demanda, las cachea por hash (`data/cache/photos`, fuera de git) y espacia las peticiones (`SDR_IMAGE_MIN_INTERVAL_MS`, 250 ms).
- Derechos: consulta pública. **Reutilización, publicación y entrenamiento de modelos no confirmados.** No se redistribuyen imágenes en el repositorio.

## 3. ICGC: divisiones administrativas

- WFS: `https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs`, capas `divisions_administratives_comarques_1000000` y `..._municipis_1000000` (GML 3.2, EPSG:4326; el servicio no ofrece GeoJSON).
- `npm run build:geo` proyecta y simplifica (Douglas–Peucker) a trazados SVG y genera `data/geo/comarques.json` (43 comarcas) y `data/geo/municipis.json` (947 municipios).
- Los códigos de comarca del ICGC coinciden con `codiComarca` del SDR.

## 4. Extractos autorizados

Si la ARC facilita un extracto estructurado o una API, se puede cargar con el importador manual (CSV, XLSX o JSON), en el modo `imported`, sin mezclarlo con el extracto público.
