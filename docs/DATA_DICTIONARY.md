# Diccionario de datos

Contrato común a los tres modos (`public_snapshot`, `imported`, `synthetic_demo`): `src/lib/data/types.ts`. Ningún campo se da por disponible sin haberlo comprobado en origen. Las ausencias son `null`, distintas de `0`.

## Characterization (una muestra / boletín)

| Campo | Origen SDR (columna del CSV) | Notas |
| --- | --- | --- |
| `id` | Núm Butlletí | = `oid` de la ficha pública |
| `mode` | — | `public_snapshot` \| `imported` \| `synthetic_demo` |
| `stream` | — | `FORM` (RESTA y REBUIG reservados) |
| `protocolVersion` | derivado de la fecha de muestra | `FORM oct-2022` desde 2022-10-01; antes, «no identificada» |
| `circuitKey` | Circuit + Ens Local Titular | identidad exacta (nombre + titular normalizados) |
| `circuitName`, `titular` | Circuit, Ens Local Titular Recollida | |
| `municipalities[]` | Municipi/s (separados por comas) | `{raw, code, name, comarcaCode}` resueltos con el ICGC |
| `comarcaCode`, `municipalityCode`, `attribution` | derivados | `municipal`, `comarcal`, `supracomarcal` o `unresolved` |
| `company`, `facility`, `lot` | Empresa caracteritzadora, Instal·lació, Lot | la instalación no es el origen del residuo |
| `collectionType`, `formType` | Tipus recollida, Tipus FORM | |
| `bulletinYear`, `bulletinQuarter` | Any, Periode | periodo declarado (≠ fecha de muestra) |
| `dates.reception` | Dia Recepció | fecha local (sin zona horaria) |
| `dates.sampling` | Data Presa Mostres | **fecha de muestreo**: eje de todos los periodos |
| `dates.characterization` | Data Caracterització | |
| `dates.presentation` | Data Presentació | |
| `dates.acceptance` | lista pública (Data accept.) | |
| `status` | lista pública (Estat) | siempre «Acceptat» en la consulta pública |
| `dischargedKg` | Quantitat descarregada | kg del lote descargado |
| `sampleKg` | Pes FORM caracteritzada | masa declarada |
| `totalWeighedKg`, `lossesKg` | Pes Total, Pes Pèrdues | |
| `formKg`, `fvKg` | Pes FORM, Pes PODA | |
| `improper[k].kg` / `.factor` / `.pctReported` | Pes X / Factor corrector X / % X | k ∈ 11 categorías |
| `improperKgReported` | Pes Total Impropis | sin factores |
| `pctReported.{form,fv,impropis,perdues,total}` | % FORM, % FV, % Total Impureses, % Pèrdues, % Total | |
| `food.{wasteKg,wastePct,foodCompostablePct}` | Total malbaratament (kg), Malbaratament sobre l'orgànica bruta (%), Residus alimentaris + compostables (%) | subestructura: no se suma |
| `compostableBagsPct` | Presència de bosses compostables (%) | |
| `observations.*` | Observacions caracterització, Observacions altres residus | texto no fiable: se muestra como dato |
| `derived.referenceKg` | calculado | pes total + pèrdues |
| `derived.correctedImproperKg` | calculado | Σ kg × factor |
| `derived.impropisPct` | calculado | reproduce % Total Impureses (15.063/15.063) |
| `derived.composition` | calculado | pp por categoría + FORM, FV y pérdidas |
| `quality[]` | reglas Q01–Q14 | `{code, severity, ruleVersion, detail}` |
| `source` | captura | snapshot, fichero raw, SHA-256, línea, URL oficial, versión del parser, hash de fila, fecha de captura |
| `revisions[]` | ingesta | cambios entre capturas (campos modificados) |

No se copian: `Matrícula Vehicle` ni `Assistents a la caracterització` (datos personales).

## Categorías (clave → etiqueta)

`vidre` Vidre · `paper` Paper i cartró · `plastic` Plàstics, mixtos i films · `bosses` Bosses de plàstic · `metallFerric` Metalls fèrrics · `metallNoFerric` Metalls no fèrrics · `textil` Tèxtil · `textilSanitari` Tèxtil sanitari · `especials` Residus especials (perillosos) · `voluminosos` Voluminosos · `altres` Altres.

## Reglas de calidad (QR-1.0)

| Código | Severidad | Regla |
| --- | --- | --- |
| Q01 | error | Masa de muestra ausente o ≤ 0 |
| Q02 | error | Masa negativa |
| Q03 | aviso | Muestra < 90 kg (representatividad; motivo de la parada desconocido) |
| Q04 | aviso | Balance no cerrado: total + pérdidas − masa declarada fuera de tolerancia (0,5 kg o 0,5 %) |
| Q05 | aviso | % recalculado ≠ % informado (> 0,1 pp) |
| Q06 | info | Pérdidas > 5 % (umbral de la demo) |
| Q07 | aviso | Sin fecha de toma de muestra |
| Q08 | info | Municipio no resuelto con el ICGC |
| Q09 | info | Fila realineada (observaciones con `;`) |
| Q10 | info | % total + % pérdidas ≠ 100 |
| Q11 | info | Factor corrector no informado (se aplica 1,00) |
| Q12 | aviso | Orden de fechas incoherente |
| Q13 | aviso | Suma de categorías ≠ total de impropios informado |
| Q14 | info | Indicador a 0 o factor a 1,00 en todo el año (probablemente no medido) |

Ningún valor se corrige automáticamente; las reglas solo marcan.

## PhotoRecord

`bulletinId`, `imageId`, `order`, `typeCode`/`typeLabel` (tipo asignado en el SDR), `kind` (`lot`, `identificacio`, `mostra`, `organica`, `impropi`, `incidencia` o `desconegut`), `thumbUrl`, `fullUrl`, `capturedAt`, `rights`, `sha256` (al cachear).

## Otras entidades del modelo objetivo

El esquema PostgreSQL de referencia (`db/schema.sql`) incluye además `SourceSnapshot`, `Circuit`, `CircuitMunicipality` (ponderación solo con fuente), `FractionMeasurement`, `QualityIssue`, `AnalysisRun`, `Insight/Report` y `ContextDataset`.
