# ARC · Intel·ligència de Residus

Brief de producto, investigación de fuentes y especificación de desarrollo para Claude Code en VS Code. Preparado para MTI el 4 de noviembre de 2026.

## 1. Instrucción principal para Claude Code

Desarrolla una plataforma web funcional, visualmente excelente y preparada para evolucionar a producción que permita explorar caracterizaciones de residuos de la Agència de Residus de Catalunya (ARC), encontrar patrones y consultar los resultados mediante IA con evidencias. Debe demostrar el valor de MTI en integración de datos, analítica e inteligencia artificial.

Lee este documento completo. Inspecciona el repositorio y las instrucciones existentes antes de modificarlo. Investiga las fuentes oficiales indicadas y consulta la documentación vigente de las dependencias. Si hay capacidades de diseño, accesibilidad o visualización instaladas, utilízalas cuando aporten valor. Implementa una aplicación navegable con interacciones reales, no una landing page ni una colección de pantallas estáticas. Documenta las decisiones y continúa con alternativas reproducibles si una integración externa falla.

El resultado prioritario es una demo de alta calidad con datos públicos verificables y un recorrido completo: resumen → territorio/circuito → muestra → fotografías → pregunta a la IA → informe. Implementa primero el flujo completo y después amplía las capacidades. No presentes funcionalidades avanzadas como operativas cuando todavía sean prototipos.

## 2. Contexto y alcance correctamente delimitados

MTI se ha reunido con la ARC en el Open Innovation Challenge del Smart City Expo. Según la reunión, disponen de un histórico desde 2006 y realizan separación y pesada manual de muestras, con datos y fotografías asociados. El objetivo solicitado aquí es explotar ese patrimonio de información mediante una plataforma moderna de análisis.

**Distinción esencial:** el PDF entregado es el «Protocol de caracterització de la fracció orgànica procedent de la recollida selectiva dels residus municipals», actualizado en octubre de 2022. Es un protocolo metodológico de FORM, no una ficha del challenge. La fuente pública localizada corresponde a FORM de circuitos públicos. No equiparar impropios dentro de la FORM con toda la fracción resta o con el rechazo de una planta. Preparar un campo de flujo para extender el producto a RESTA y REBUIG si la ARC facilita fuentes específicas. Mantenerlos separados en análisis, taxonomías y métricas.

La noticia oficial de la consulta preliminar de mercado de mayo de 2026 confirma interés en automatizar la caracterización de FORM. Su foco incluye cuantificar impropios y, idealmente, tipos y peso. Esta plataforma ofrece una primera capa de inteligencia sobre el histórico y una base para estudiar visión artificial; no equivale a un sistema físico de caracterización automática.

No atribuir a MTI referencias, resultados, certificaciones ni proyectos de residuos que no estén acreditados. Mostrar «Demostració tecnològica · MTI» de forma discreta, sin aparentar que se trata de un servicio oficial adjudicado a MTI.

## 3. Investigación realizada y enlaces de acceso

### 3.1 Fuente principal encontrada

**Enlace directo a la consulta pública:**

https://sdr.arc.cat/cform/ListCaracteritzacions.do

**Acceso general alternativo:**

https://sdr.arc.cat/sdr/GetLogin.do

Ruta del menú observada actualmente: **Residus → Recollida selectiva → Caracterització → Circuits servei públic → Caracteritzacions**. La guía antigua habla de «Residus → FORM → Caracteritzacions»; usar la navegación actual si difiere. La presencia de un formulario de acceso en la portada no implica que la consulta pública exija autenticación.

**Página oficial que explica el acceso público sin credenciales:**

https://residus.gencat.cat/ca/ambits_dactuacio/recollida_selectiva/residus_municipals/materia_organica_form_-_fv/dades_quantitatives_i_qualitatives_de_la_recollida_selectiva_de_la_form/

Resumen de verificación a 04/11/2026:

| Elemento | Evidencia y estado |
| --- | --- |
| Consulta pública | Abierta sin credenciales; tabla de boletines visibles |
| Histórico 2006 | Consulta del formulario con año 2006 devolvió 259 resultados; es el resultado observado de esa consulta, no un censo certificado ni prueba de continuidad completa |
| Registro antiguo de ejemplo | BOADELLA I LES ESCAULES, cuarto trimestre de 2006, identificador observado 503 |
| Registro reciente de ejemplo | FIGUERES, fecha de caracterización 30/10/2026, identificador observado 31301 |
| Filtros | Año, trimestre, fechas, boletín, circuito, titular, caracterizadora, instalación, lote y comarca |
| Exportación | Botón EXPORTAR presente; formato, columnas y cobertura de la descarga todavía por verificar |
| Fotografía | Galería del boletín 31301 abierta sin credenciales, con 13 imágenes referenciadas y enlaces de descarga; alcance histórico y descarga masiva pendientes de validar |
| API de caracterizaciones | No se ha verificado una API pública documentada para este módulo |
| Exhaustividad del histórico | Pendiente de inventario por año y revisión de cambios metodológicos |

**Ejemplo de boletín público observado:**

https://sdr.arc.cat/cform/EditCaracteritzacions.do?oid=31301&accio=Modificar

Aunque la ruta heredada contiene «Edit» y «Modificar», la consulta anónima abrió el boletín con controles de fotos e impresión. Usarlo únicamente para lectura; no enviar operaciones de modificación.

**Ruta de fotografías enlazada por el botón FOTOS del boletín:**

https://sdr.arc.cat/cform/EditCaracteritzacionsImatges.do?caractId=31301

La ruta se obtuvo del código de navegación del boletín y se abrió sin credenciales: contiene 13 referencias de imágenes con enlaces de visualización y descarga. Se comprobó además la descarga anónima de una imagen referenciada: respuesta HTTP 200 y firma binaria JPEG válida. Esto verifica una galería y un archivo concretos, no toda la cobertura histórica. Validar los archivos y sus condiciones antes de prometer cobertura o construir un dataset de entrenamiento. Obtener los identificadores desde las filas visibles, no enumerar identificadores arbitrarios.

### 3.2 Otras fuentes oficiales

- Guía de uso del entorno público, versión de septiembre de 2007; útil como referencia histórica, no contrato de API:
  https://residus.gencat.cat/web/.content/home/ambits_dactuacio/recollida_selectiva/residus_municipals/materia_organica__form_-_fv/dades_quantitatives_i_qualitatives_de_la_recollida_selectiva_de_la_form/guia_sdr.pdf
- Guía rápida:
  https://residus.gencat.cat/web/.content/home/ambits_dactuacio/recollida_selectiva/residus_municipals/materia_organica__form_-_fv/dades_quantitatives_i_qualitatives_de_la_recollida_selectiva_de_la_form/guia_rapida_sdr.pdf
- Estadísticas municipales de contexto, enlazadas por la ARC:
  https://estadistiques.arc.cat/ARC/
  La herramienta de consulta utilizada tuvo un timeout al abrir este portal. Verificar disponibilidad y formatos; no inventar un endpoint.
- Cuantificación de malbaratamiento alimentario, con tablas anuales agregadas y enlace al SDR:
  https://residus.gencat.cat/ca/ambits_dactuacio/prevencio/malbaratament_alimentari/quantificacio/
- Consulta preliminar de mercado de 2026:
  https://residus.gencat.cat/ca/actualitat/noticies/detall/ac_CPM_caracteritzacio_FORM

Las tablas agregadas de malbaratamiento pueden servir para un primer gráfico real, pero no sustituyen microdatos de muestras y no deben mezclarse con ellos como si tuvieran la misma granularidad. No copiar cifras sin conservar unidad, definición y periodo.

### 3.3 Material adjunto

- `GfHyFhVcQzrpryVQKqCNf1zs.pdf`: protocolo FORM, octubre de 2022. Consultar especialmente apartados 4.7–4.10 y categorías de impropios. El protocolo describe una muestra aproximada de 250 kg, separación, pesadas y reportaje fotográfico. Incluye restricciones de representatividad cuando se detiene el proceso por riesgo sanitario; implementar reglas por versión metodológica.
- `images (5).png`: logo aportado. Verde dominante medido en la imagen: RGB(5,166,74), **#05A64A**. Gris cálido dominante: RGB(176,174,162), **#B0AEA2**. Son valores de esta imagen, no una afirmación sobre un manual corporativo oficial.

Si los adjuntos están disponibles en el proyecto, cópialos a ubicaciones claras como `public/brand/arc-logo.png` y `docs/references/protocol-form-2022.pdf`. Si solo se entrega este MD, continúa con un encabezado tipográfico y los colores documentados; no bloquees el desarrollo ni recrees el logo de forma inexacta.

## 4. Investigación e ingestión que debe hacer la aplicación

Implementar un catálogo de fuentes con estados «Verificada», «Parcial», «Pendiente» y fecha de última comprobación. Mostrar cobertura temporal efectiva en lugar de una etiqueta fija «2006–2026» si no se han cargado todos los años.

Orden de integración:

1. Comprobar si EXPORTAR ofrece datos reutilizables y suficientes. Inspeccionar tipo MIME y contenido; no asumir CSV, XLSX o detalle completo.
2. Si es necesario, completar mediante lectura moderada de boletines públicos y fotografías enlazadas.
3. Si existe una API documentada adecuada, preferirla tras comprobar permisos y cobertura.
4. Incorporar importador manual CSV/XLSX/JSON con mapeo de columnas y vista previa como alternativa robusta.
5. Si un recurso requiere acceso privado o no está disponible, registrar la limitación y permitir un extracto autorizado facilitado por la ARC.

Detalles observados que sirven como pistas, no como contrato estable: el formulario utiliza POST sobre `ListCaracteritzacions.do`; el año aparece como `butlletiAny`; el botón exportar utiliza la misma ruta con `accio=Exportar`. Verificar contra el HTML vigente y no depender de campos ocultos adivinados. Los nombres de rutas de lectura no autorizan escrituras en SDR.

Construir un conector de backend, nunca descargar todo desde el navegador del usuario. Timeouts, límites de concurrencia bajos, reintentos con backoff, caché, identificación del cliente, límites de volumen y reanudación por año. Respetar restricciones publicadas y no sortear autenticación. Un recurso público no implica automáticamente licencia ilimitada para redistribuir fotografías o entrenar modelos: registrar condiciones y confirmar esos usos antes del entrenamiento.

Conservar una capa raw inmutable, hash de fichero, URL de origen, fecha de captura, parámetros, versión de parser y errores. Normalizar decimales con coma, unidades y fechas locales. Ingesta idempotente por identificador de boletín y versión; una corrección en origen debe generar historial. Deduplicar imágenes por hash sin borrar asociaciones entre muestra y foto.

Crear `docs/DATA_SOURCES.md`, `docs/DATA_DICTIONARY.md` y un informe de cobertura por año: muestras, circuitos, campos disponibles, fotos accesibles y errores. No descargar masivamente todo el archivo para arrancar: comenzar con un extracto verificable y ampliar mediante jobs explícitos.

## 5. Producto y experiencia de usuario

Nombre de trabajo: **ARC · Intel·ligència de Residus**. Interfaz principal en catalán, con español e inglés preparados mediante i18n. Formatos locales, zona horaria Europe/Madrid y fechas de muestreo diferenciadas de las fechas de publicación o captura.

Navegación lateral: Visió general, Territori, Caracteritzacions, Patrons i anomalies, Arxiu visual, Assistent IA, Informes, Fonts i qualitat.

Barra superior con periodo, ámbito territorial, circuito, flujo de residuos y estado de datos. Filtros persistentes en URL y opción «Restablir». Todas las métricas, gráficos, mapas, tablas y respuestas de IA deben compartir el mismo ámbito o advertir un cambio explícito.

### A. Visión general

- Titular claro, por ejemplo «De les mostres a les decisions»; debajo, ámbito y actualización.
- KPIs: muestras válidas analizadas, circuitos cubiertos, impropios según definición validada, variación en puntos porcentuales y cobertura fotográfica. Cada tarjeta muestra denominador y acceso a metodología.
- Serie temporal con número de muestras y discontinuidades visibles; no interpolar años sin datos.
- Composición mediante barras apiladas al 100% y evolución por categoría. Usar porcentajes solo cuando las partes compartan denominador y sean excluyentes.
- Panel «Què ha canviat?» con hallazgos calculados y enlace a registros.
- Una tarjeta de calidad: periodo cargado, n, exclusiones, campos ausentes y retraso de actualización.

### B. Territorio y comparación

Mapa 2D de Catalunya con límites verificables, leyenda, filtros y tabla alternativa accesible. La geografía debe proceder de una fuente cartográfica documentada. Evitar una escena 3D decorativa sin utilidad analítica.

Colorear únicamente territorios con atribución válida y suficientes muestras. «Sin datos» debe distinguirse de valor cero. No situar una muestra en la planta y presentarla como si fuera origen del residuo. Un circuito puede servir a varios municipios: modelar relación múltiple y no duplicar su masa en cada municipio. Mostrar «circuito supramunicipal» cuando no exista reparto acreditado.

Comparación de 2–4 circuitos o territorios con periodo común, distribución, categorías, n y cobertura. Posibilidad de cohorte estable de circuitos para evitar interpretar cambios de composición de la muestra como mejoras reales. El sistema de recogida, turismo o población solo deben aparecer si se han incorporado fuentes fiables para esos atributos.

### C. Explorador de caracterizaciones

Tabla con paginación en servidor, búsqueda, orden, selección de columnas y exportación del resultado filtrado. Ficha de muestra con identificador, circuito, titular, instalación, empresa, fecha, flujo, protocolo, estado y URL oficial.

Pestañas: composició, fotografies, observacions, qualitat i traçabilitat. Ver pesadas originales y porcentajes calculados con fórmula visible. Revisar muestras incompletas y diferencias de balance, sin corregir valores automáticamente.

### D. Patrones y anomalías

- Estacionalidad mensual o trimestral cuando la frecuencia lo permita.
- Cambios persistentes por circuito, y no únicamente picos aislados.
- Anomalías robustas respecto al histórico comparable del circuito; separar errores de datos de posibles incidencias operativas.
- Categorías de impropios que más contribuyen al cambio.
- Agrupación exploratoria de perfiles de composición; documentar transformación composicional y tratamiento de ceros si se emplea clustering.
- Evolución antes/después de una intervención si hay fecha documentada y datos suficientes; describir asociación, sin afirmar causalidad automática.

Cada hallazgo debe incluir pregunta, periodo, cohortes, tamaño de muestra, método, magnitud, incertidumbre, limitaciones, tabla subyacente y acciones sugeridas para revisión humana. No publicar hallazgos precalculados sin evidencia.

### E. Archivo visual y laboratorio de visión

Galería asociada a boletines, filtros por fracción, fecha y circuito, visor ampliado y comparación entre muestras. Mostrar fuente, permiso conocido y tipo de foto: lote, identificación, muestra, orgánica, impropio o incidencia. Respetar imágenes ausentes y enlaces rotos; no sustituirlas por fotos de stock.

Fase posterior: etiquetado asistido, búsqueda visual y detección orientativa de materiales. Conservar etiquetas manuales separadas de predicciones, versión del modelo, confianza y revisión. Una fotografía no permite inferir de forma fiable el peso de los materiales sin calibración, protocolo de captura y validación específica. No convertir área de píxeles en kg ni presentar detección visual como pesada certificada.

Para evaluar modelos, separar entrenamiento y prueba por campaña/circuito/tiempo según el uso previsto y eliminar duplicados entre particiones. Medir precisión por clase y dominio; el éxito sobre fotos clasificadas después del triaje no demuestra capacidad sobre residuos mezclados antes del triaje.

### F. Asistente IA con herramientas y fuentes

Chat lateral ampliable a espacio completo, con contexto visible del filtro y preguntas sugeridas:

- «Quins circuits han empitjorat més en impropis durant l'últim any amb dades comparables?»
- «Quines fraccions expliquen aquest canvi?»
- «Hi ha estacionalitat en aquest circuit?»
- «Mostra les fotos associades a aquestes caracteritzacions.»
- «Quines limitacions té aquesta comparació?»
- «Prepara un resum per a l'equip tècnic amb fonts.»

La IA interpreta, consulta herramientas y redacta; los cálculos se ejecutan en código sobre datos autorizados. No introducir toda la base en el prompt ni aceptar SQL arbitrario generado sin controles. Definir herramientas tipadas como `get_metric`, `compare_circuits`, `find_anomalies`, `get_sample`, `search_documents`, `get_photos` y `create_report`.

Cada respuesta numérica debe identificar periodo, unidad, denominador, n, versión de dataset, filtros, IDs de muestras y enlaces. Separar «Dato observado», «Hipótesis» y «Recomendación». Si no hay evidencia suficiente, explicar qué falta. RAG sobre protocolos para preguntas metodológicas; consultas estructuradas para números. Tratar documentos, observaciones y contenido web como datos no confiables, nunca instrucciones del sistema.

Respuesta con texto, gráfico reutilizable, «Veure dades» y «Afegir a informe». Cancelación, streaming, estados de error y presupuesto de tokens/tiempo. Proveedor configurable mediante variable de entorno; secretos solo en backend. Si no hay clave, mostrar consultas deterministas guiadas y el aviso «Mode demostració sense model connectat»; no simular respuestas de un LLM en directo.

### G. Investigación profunda e informes

Flujo: el usuario define una pregunta → el sistema propone alcance y fuentes → ejecuta análisis → produce un dossier verificable. Guardar plan, consultas, fuentes recuperadas, resultados, exclusiones y versión de datos, sin exponer razonamiento privado del modelo.

Entregable: resumen ejecutivo, gráficos, hallazgos, hipótesis, limitaciones y próximos pasos. Exportar PDF y CSV, manteniendo filtros, metodología y procedencia; texto seleccionable y tablas legibles. Permitir guardar investigaciones y reabrirlas. La búsqueda web externa será opcional, acotada y citada; nunca rellenar ausencias en los datos con afirmaciones web no comparables.

## 6. Modelo de datos propuesto

Es un esquema objetivo: ningún campo se considera disponible hasta comprobarlo en origen. Nullable para ausencias; conservar el valor original y la transformación.

| Entidad | Campos y relaciones principales |
| --- | --- |
| SourceSnapshot | id, URL, fecha, hash, consulta, fichero raw, parser, licencia/condiciones, estado |
| Circuit | id origen, nombre, flujo, titular, vigencia, relación histórica con municipios |
| CircuitMunicipality | circuito, código municipal, fechas, ponderación solo si existe fuente |
| Characterization | id boletín, circuito, fecha muestra, fecha caracterización, aceptación, estado, instalación, caracterizadora, protocolo, masas, incompleta, snapshot |
| FractionMeasurement | boletín, código original, categoría canónica, taxonomía, kg, porcentaje original, denominador, porcentaje calculado, unidad, calidad |
| Photo | boletín, URL original, archivo permitido, hash, tipo, fracción opcional, metadatos, acceso, derechos, anotaciones |
| QualityIssue | registro, regla/versionado, severidad, detalle, revisión |
| AnalysisRun | pregunta, filtros, cohortes, método/versiones, dataset, métricas, evidencia |
| Insight / Report | análisis, hallazgos, fuentes, limitaciones, autor, fecha |
| ContextDataset | variable externa, geografía, periodo, fuente, unidad, granularidad |

Taxonomía inicial del protocolo adjunto: vidre; paper i cartró; plàstics, mixtos i films; bosses de plàstic; metalls fèrrics; metalls no fèrrics; tèxtil; tèxtil sanitari; residus perillosos; voluminosos; altres. Mantener por separado FORM, poda/FV, pérdidas y submuestras según su estructura real. No asumir que todas las categorías se midieron desde 2006 ni que suman de la misma manera en cada versión.

## 7. Reglas analíticas y de calidad

1. Definir por versión el denominador oficial de cada indicador. Como indicador exploratorio de masa se puede usar `100 × kg_impropis / kg_mostra_referencia` solo cuando el denominador esté confirmado. No confundirlo con un indicador oficial ajustado.
2. Promedio simple por muestra, porcentaje por masa caracterizada y media ponderada por toneladas recogidas son estimadores distintos. Mostrar nombre y pesos; no afirmar representatividad poblacional a partir de sumar muestras.
3. Para agregado por masa: `100 × suma(kg_impropis) / suma(kg_referencia)` sobre registros válidos y comparables. Si solo hay porcentajes, no inventar las masas ni ponderaciones.
4. No volver a sumar como fracciones excluyentes medidas que pertenezcan a submuestras o subconjuntos, como indicadores alimentarios.
5. Nulos, no medidos y ceros son estados diferentes. Marcar duplicados, kg negativos, divisiones por cero, categorías desconocidas y balances incoherentes; tolerancias configurables.
6. Conservar cambios de protocolos, límites territoriales y circuitos. No unir series por parecido del nombre sin resolver su identidad y vigencia.
7. Diferencias de porcentajes se expresan en puntos porcentuales; variación relativa en %. Etiquetar ambas correctamente.
8. Validación/aceptación y representatividad son dimensiones separadas. Versionar reglas de muestras detenidas por riesgo sanitario; el protocolo 2022 indica falta de representatividad si la parada se produce antes de caracterizar 90 kg en ese supuesto.
9. Umbral de muestras insuficientes configurable y visible. Suprimir rankings concluyentes si no hay tamaño o comparabilidad suficientes. Intervalos de incertidumbre solo con método documentado que respete dependencias por circuito.
10. Cambios de composición del conjunto de circuitos pueden alterar agregados. Ofrecer conjunto comparable estable y explicar exclusiones.
11. Forecast solo como fase posterior, si hay longitud/frecuencia suficiente: baseline estacional, evaluación temporal fuera de muestra y bandas. Si no mejora el baseline, no promocionarlo como predictor útil.
12. El histórico incluye cambios de recogida, metodologías y selección de muestras. Correlaciones sirven para investigar, no para atribuir causas sin diseño adicional.

## 8. Dirección visual: moderna, institucional y muy cuidada

Una herramienta analítica premium, luminosa y de alta densidad bien organizada. Mucho más cercana a un producto SaaS actual que a un portal administrativo antiguo.

Tokens de diseño propuestos:

```css
--arc-green: #05A64A;
--arc-green-dark: #08783C;
--arc-green-tint: #EAF7EF;
--arc-warm-gray: #B0AEA2;
--canvas: #F6F7F4;
--surface: #FFFFFF;
--ink: #1D1D1B;
--muted: #60665F;
--border: #E3E7DF;
--warning: #A86408;
--danger: #BA3B3B;
```

Verde del logo en acentos, selección, líneas clave y botones; validar contraste y usar verde oscuro cuando el verde vivo con texto blanco no alcance legibilidad. El verde no debe codificar a la vez identidad corporativa y resultado favorable de forma ambigua.

Tipografía sugerida: Inter o equivalente sans moderna, números tabulares. Sidebar de unos 240 px, espaciado de 8 px, tarjetas con radios 12–16 px, bordes discretos y sombras leves. Encabezados claros, sin degradados chillones, glassmorphism excesivo ni paneles vacíos gigantes.

Inicio: cabecera con título y estado; banda de KPIs; gráfico temporal ancho y panel de hallazgos; mapa y composición; tabla de muestras recientes. Evitar dashboards compuestos únicamente por tarjetas de números.

Gráficos con tooltip informativo, leyendas seleccionables, zoom temporal, selección conectada con tablas y descarga. Paleta consistente por material, accesible a daltonismo y sin depender solo del color. Preferir barras/líneas a donuts repetidos. Cada visualización tiene título que expresa su pregunta y tabla alternativa.

Animaciones discretas de 150–250 ms, transiciones al filtrar y apertura fluida de paneles, skeletons fieles a la estructura final. Respetar `prefers-reduced-motion`. No simular actividad en tiempo real si los datos son históricos.

Diseño adaptable a 1440, 1280, 768 y 390 px; tablas con desplazamiento controlado, filtros en drawer en móvil. Navegación por teclado, foco visible, etiquetas, contraste y lector de pantalla; objetivo de accesibilidad WCAG 2.2 AA sujeto a validación. Modo oscuro opcional posterior; priorizar excelencia del tema claro.

## 9. Arquitectura y estándares de implementación

Elegir versiones estables y compatibles al iniciar, verificar soporte y seguridad, fijarlas en lockfile y documentarlas. Evitar números de versión «latest» asumidos en este brief.

Propuesta técnica:

- Frontend: Next.js con App Router, React y TypeScript estricto; Tailwind y componentes accesibles shadcn/ui personalizados para esta identidad.
- Visualización: ECharts o alternativa equivalente que soporte interacción, exportación y buen rendimiento. Tabla con TanStack Table. Mapa con MapLibre o SVG geográfico real según escala.
- Backend web: rutas del servidor tipadas y validación de inputs con esquemas. Módulos de dominio independientes de la UI.
- Persistencia: PostgreSQL; PostGIS solo si se necesitan operaciones espaciales. Almacenamiento de ficheros compatible con S3 cuando proceda.
- Analítica/ingesta: worker Python separado si los parsers y análisis lo justifican; procesos largos fuera de peticiones web y del runtime serverless. Jobs con estado, progreso, cancelación y reintento.
- IA: SDK de proveedor con llamadas a herramientas tipadas, control de presupuesto y registro de evidencias. Recuperación documental simple al inicio; vector store solo si mejora la búsqueda.
- Demo local reproducible mediante scripts; Docker Compose para servicios cuando sea necesario. No obligar a contratar una plataforma para abrir la demo.

Organización orientativa: `src/app`, `src/components`, `src/features`, `src/lib/analytics`, `src/lib/data`, `src/lib/ai`, `workers/ingestion`, `data/demo`, `docs`, `tests`. Separar adaptadores públicos, importaciones y fixtures.

Modos de datos explícitos: `public_snapshot`, `imported` y `synthetic_demo`. Los componentes visuales consumen el mismo contrato; nunca mezclar los modos silenciosamente. Mostrar fecha de snapshot y estado de conexión.

Credenciales fuera del cliente y del repositorio. Consultas parametrizadas, permisos por rol si hay cuentas, control de acceso en servidor y límites de exportación. Validar ficheros, tamaño y MIME; prevenir CSV injection en exportaciones y SSRF al recuperar URLs. Texto y documentos externos no deben convertirse en HTML inseguro o instrucciones de IA. Logs sin secretos ni fotos sensibles por defecto.

Roles de producción: lector, analista y administrador; datos de demostración sin login aceptables. No añadir una pantalla de acceso ficticia. Documentar retención, permisos de fotos, auditoría y copia de seguridad para despliegue real.

## 10. Alcance por fases y comportamiento sin conexiones

### Fase 1: demo funcional completa

- Diseño y navegación de las ocho secciones.
- Extracto público pequeño comprobado e importador manual.
- Filtros globales, KPIs consistentes, serie temporal, composición, explorador y ficha.
- Archivo visual si hay fotos verificadas; estado vacío honesto en caso contrario.
- Comparación de circuitos, detección básica de anomalías y metodología visible.
- Asistente conectado si hay clave; herramientas deterministas si no.
- Informe exportable con trazabilidad y datos filtrados.

Si no se pueden obtener suficientes microdatos, crear fixtures sintéticos coherentes y separados, con identificadores y territorios ficticios claramente marcados. No asignar porcentajes inventados a municipios reales. Las cifras públicas reales pueden usarse en un panel agregado independiente. No presentar métricas científicas ni fotografías generadas como resultados reales.

### Fase 2: piloto con la ARC

Ingesta histórica más amplia, revisión del diccionario y fórmulas por su equipo, acceso a fotografías, fuentes complementarias, roles y análisis reproducibles. Verificar cobertura 2006–actualidad y revisiones de protocolos. Acordar criterios de aceptación sobre un conjunto validado por la ARC.

### Fase 3: capacidades avanzadas

Visión artificial evaluada, predicción contrastada, alertas configurables, investigación web acotada y planificación de muestreo basada en incertidumbre. Simulación de mejora como escenario con supuestos editables, nunca ahorro económico o toneladas recuperadas sin fuentes de volumen y costes.

## 11. Validación y criterios de aceptación

Pruebas centradas en errores relevantes:

- Agregaciones con diferentes denominadores, nulos, muestras incompletas y revisiones.
- Circuitos supramunicipales sin doble conteo.
- Ingesta idempotente y conservación de cambios en origen.
- Filtros consistentes entre KPI, tabla, gráfico, mapa, asistente y exportación.
- Respuestas de IA respaldadas por herramientas; pregunta sin datos devuelve limitación, no cifra inventada.
- Inputs maliciosos en documentos no pueden cambiar permisos ni ejecutar consultas arbitrarias.
- Recorrido E2E: filtro → circuito → muestra → foto o estado vacío → pregunta → informe.
- Exportación legible y correcta; estados de carga, errores de fuente y ausencia de clave.

Ejecutar typecheck, lint, build y pruebas apropiadas al flujo. Revisar visualmente escritorio y móvil; corregir texto cortado, contraste, desbordamientos y saltos. Definir un objetivo de interacción inferior a 300 ms para filtros sobre el snapshot local de demo y medirlo indicando tamaño/hardware; no anunciar ese objetivo como rendimiento obtenido antes de medir.

La demo se acepta cuando todos los controles visibles hacen lo que indican, los números se reconcilian con las tablas, las fuentes se pueden abrir, los datos sintéticos se distinguen, no aparecen endpoints inventados y el usuario puede completar el recorrido sin servicios externos obligatorios.

## 12. Entregables de desarrollo

1. Código ejecutable, configuración y lockfile.
2. README con instalación, comandos, variables, modos demo/real y limitaciones.
3. `.env.example` sin secretos y mecanismo claro para configurar el modelo.
4. Catálogo de fuentes, diccionario, fórmulas y evidencia de cobertura.
5. Scripts de ingestión e importador con un extracto o fixtures reproducibles.
6. Pruebas de cálculos y recorrido, con resultados documentados.
7. Capturas de las pantallas principales y demo de cinco minutos descrita.
8. Lista breve de integraciones verificadas y capacidades pendientes para piloto.

Guion de demo: abrir visión general → elegir periodo y circuito → explicar un cambio con datos → consultar las muestras y fotografías → preguntar por las fracciones que lo explican → generar informe con fuentes y limitaciones.

## 13. Preguntas para cerrar con la ARC sin bloquear la demo

- ¿El reto concreto se refiere a FORM, RESTA, REBUIG de planta o varios flujos?
- ¿Qué años y campos están completos en la exportación pública?
- ¿Se pueden obtener datos y fotos por un extracto estructurado o API autorizada?
- ¿Qué derechos de reutilización, publicación y entrenamiento tienen las imágenes?
- ¿Qué cambios de protocolos, categorías y cálculo se produjeron desde 2006?
- ¿Qué ponderaciones oficiales deben utilizarse y qué fuentes de toneladas por circuito existen?
- ¿Qué imágenes son antes/después del triaje y qué etiquetas y pesadas pueden vincularse?
- ¿Qué decisión quieren mejorar primero y cómo medirían el éxito de un piloto?

## 14. Referencias técnicas para verificar al desarrollar

- Next.js App Router e instalación: https://nextjs.org/docs/app/getting-started/installation
- Política de soporte Next.js: https://nextjs.org/support-policy
- shadcn/ui para Next.js: https://ui.shadcn.com/docs/installation/next
- Herramientas con Claude: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview

Estas referencias orientan la implementación. Revalidar documentación, versiones, costes y disponibilidad de modelos al iniciar. La propuesta funcional y de arquitectura de este documento es una recomendación de diseño; no una descripción de funcionalidades actuales del SDR.
