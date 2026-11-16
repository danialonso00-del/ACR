# Integraciones verificadas y capacidades pendientes para el piloto

## Verificado en esta entrega

- Lectura pública del SDR sin credenciales. Exportación CSV estable de 93 columnas (2006–2026) e identificador de boletín común con la ficha y la galería.
- Ingesta reproducible de 2006 y 2019–2026: 15.063 boletines y 18 capturas raw con hash.
- Reconciliación del cálculo: % de impropios y % por categoría iguales a los informados en el 100 % de las muestras (denominador: peso total + pérdidas, con factores correctores).
- Galerías fotográficas legibles y tipadas: índice de 87 galerías, 84 con fotos y 1.463 imágenes. Descarga anónima de imágenes verificada.
- Geografía oficial ICGC (43 comarcas, 947 municipios). 99,7 % de las muestras atribuidas (43 con municipio no resuelto por posibles cambios de nombre).
- Importador CSV/XLSX/JSON validado con la propia exportación oficial (1.712 filas, 0 rechazadas).
- Asistente: herramientas tipadas, evidencias y modo guiado sin modelo. Bucle LLM probado con un stub del SDK (en esta sesión no había `ANTHROPIC_API_KEY` disponible para una prueba en vivo).

## Pendiente (no se presenta como operativo)

| Capacidad | Estado | Qué falta |
| --- | --- | --- |
| Histórico 2007–2018 | No ingerido | Ejecutar `npm run ingest:sdr -- --years 2007-2018` y revisar los cambios de protocolo |
| Indicador de muestra parada («abortada») | Solo en la ficha HTML | Extracto estructurado o lectura controlada de fichas |
| Ponderación por toneladas | No disponible | Fuente de toneladas por circuit/periodo (estadistiques.arc.cat devolvió 503) |
| Derechos de las fotografías | No confirmados | Autorización de reutilización y entrenamiento |
| Visión artificial | Fase 3, no operativa | Dataset etiquetado, particiones sin fuga y validación por dominio |
| RESTA / REBUIG | Sin fuente | Fuentes específicas; taxonomías separadas |
| Previsión | No ofrecida | Solo si supera un baseline estacional fuera de muestra |
| Persistencia PostgreSQL, roles, auditoría | Esquema definido | Implementación del adaptador, autenticación, roles lector/analista/administrador, logs de auditoría y copias de seguridad |
| Protocolo FORM 2022 completo en RAG | Resumen del brief | PDF original y extracción de texto |

## Producción: retención, permisos y auditoría (propuesta)

- Capa raw inmutable en almacenamiento compatible con S3 con versionado. Retención según el acuerdo con la ARC. Fotos solo con permiso explícito.
- Roles: lector (consulta), analista (informes e importaciones), administrador (fuentes, jobs, reglas). Control de acceso en servidor y límites de exportación.
- Auditoría: ejecuciones de análisis (`analysis_run`), llamadas a herramientas de IA (sin secretos ni imágenes), importaciones y cambios de reglas.
- Copias de seguridad diarias de PostgreSQL. Las capturas raw sirven para reconstruir los snapshots.

## Preguntas para cerrar con la ARC

1. ¿El reto se refiere a FORM, RESTA, REBUIG de planta o a varios flujos?
2. ¿Qué años y campos están completos en la exportación pública? (Observado: las mismas 93 columnas desde 2006, con indicadores de desperdicio a 0 y factores a 1,00 en 2006.)
3. ¿Se pueden obtener datos y fotos mediante un extracto estructurado o una API autorizada (incluido el indicador «abortada»)?
4. ¿Qué derechos de reutilización, publicación y entrenamiento tienen las imágenes?
5. ¿Qué cambios de protocolo, categorías y cálculo se han producido desde 2006 (factores correctores incluidos)?
6. ¿Qué ponderaciones oficiales deben utilizarse y qué fuentes de toneladas por circuito existen?
7. ¿Qué imágenes son anteriores o posteriores al triaje y qué etiquetas y pesadas se pueden vincular?
8. ¿Qué decisión quieren mejorar primero y cómo medirían el éxito del piloto?
9. La consulta de 2006 del brief (259 resultados) frente a la captura completa (981 boletines): ¿qué filtro se usó?
