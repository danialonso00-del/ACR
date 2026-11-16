# Guion de demo (5 minutos)

Preparación: `npm run build && npm run start` → http://localhost:3000. La demo funciona sin conexión salvo las fotografías, que se leen en vivo del SDR. Si no hay red, la app muestra un estado vacío honesto. Para el asistente con modelo, configura `ANTHROPIC_API_KEY` en `.env.local`; sin clave se usan las consultas guiadas.

| Min. | Pantalla | Qué mostrar | Mensaje |
| --- | --- | --- | --- |
| 0:00 | **Visió general** | Titular, KPI con denominador (clic en ⓘ), serie con huecos 2007–2018 visibles, mapa y composición | «15.063 boletines públicos reales, de 2006 y 2019–2026, con cobertura efectiva declarada» |
| 0:45 | Barra superior | Preset «24 m», comarca en el mapa (clic) y circuito en el buscador; la URL conserva los filtros | «Todo comparte el mismo ámbito: KPI, mapa, tabla, exportación e IA» |
| 1:15 | **Patrons i anomalies** | «Què ha canviat?»: cohorte estable, circuitos con cambio robusto (IC 95 %), categorías que más varían | «No es un pico: método, n, incertidumbre y limitaciones en cada hallazgo» |
| 2:00 | **Caracteritzacions** → ficha | Abrir un boletín del circuito: pesadas originales, factores, fórmula visible y reconciliación con el % informado | «El cálculo reproduce el 100 % de los porcentajes oficiales» |
| 2:40 | Pestaña **Fotografies** | Galería del SDR con el tipo de cada foto y el visor ampliado; luego «Qualitat i traçabilitat» (hash y captura) | «Trazabilidad hasta el fichero raw; derechos de las imágenes pendientes» |
| 3:20 | **Assistent IA** | «Quines fraccions expliquen aquest canvi?» → herramientas, evidencias, IDs y «Veure dades» | «La IA consulta herramientas tipadas; separa dato, hipótesis y recomendación» |
| 4:10 | «Afegir a informe» → **Informes** | Dossier con hallazgos, limitaciones y próximos pasos; «Exportar PDF» y CSV | «De la muestra a la decisión, con fuentes» |
| 4:40 | **Fonts i qualitat** | Catálogo de fuentes (verificada, parcial, pendiente), cobertura por año, reglas Q01–Q14 e importador | «Preparado para un extracto autorizado de la ARC» |

Mensajes de cautela: es una demostración tecnológica de MTI, no un servicio oficial. Los indicadores son exploratorios (no están ponderados por toneladas) y la visión artificial es una fase posterior, no operativa.

## Capturas

`docs/screenshots/` (generadas con `node scripts/dev/capture-docs.mjs` sobre un servidor en marcha). Las capturas con fotografías del SDR no se guardan en el repositorio porque los derechos de reutilización no están confirmados.

| Fichero | Pantalla |
| --- | --- |
| `01-visio-general.png` | Visió general (página completa) |
| `02-territori.png` | Territori con la comparación de dos circuitos |
| `03-explorador.png` | Explorador de caracterizaciones |
| `04-fitxa-mostra.png` | Ficha de muestra (composición y fórmula) |
| `06-patrons.png` | Patrons i anomalies |
| `08-assistent.png` | Asistente (consulta guiada con evidencias) |
| `09-informe.png` | Dossier de investigación |
| `10-fonts-qualitat.png` | Fonts i qualitat |
| `11-mobil-visio-general.png` | Visió general a 390 px |
