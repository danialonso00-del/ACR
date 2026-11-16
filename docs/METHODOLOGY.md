# Metodologia analítica

Document de referència de la demostració «ARC · Intel·ligència de Residus». Descriu com es calculen les xifres que mostra l'aplicació i les respostes de l'assistent. Totes les fórmules s'executen en codi (`src/lib/analytics`). Regles de qualitat: versió `QR-1.0 (2026-11-04)`.

## Abast i flux de residus

L'aplicació treballa amb caracteritzacions de la **fracció orgànica (FORM)** de circuits de servei públic publicades al SDR de l'ARC. No equipara els impropis dins la FORM amb la fracció resta ni amb el rebuig de planta. El camp de flux (`FORM`, `RESTA`, `REBUIG`) existeix al model de dades, però només FORM té font; RESTA i REBUIG apareixen desactivats («sense font») fins que l'ARC en faciliti dades específiques, i es mantindran separats en taxonomies i mètriques.

## Massa de referència (denominador)

Per a cada mostra: **massa de referència = pes total pesat + pèrdues** («Pes Total» + «Pes Pèrdues» de l'exportació del SDR). Quan el balanç tanca coincideix amb la massa declarada («Pes FORM caracteritzada»). S'ha verificat que aquest és el denominador que fa servir la font: el percentatge d'impropis recalculat reprodueix el «% Total Impureses» en 15.063 de 15.063 mostres (anys 2006 i 2019–2026). Si el pes total no consta, s'usa la massa declarada.

## Percentatge per categoria i factors correctors

`pp categoria = 100 × kg categoria × factor corrector / massa de referència`. Els factors correctors venen de la font (per exemple, paper i cartró 0,66 i bosses de plàstic 0,54 en anys recents; tots 1,00 el 2006). Si un factor no consta s'aplica 1,00 i es marca (regla Q11).

`% impropis = Σ categories d'impropi`. `% pèrdues = 100 × pèrdues / referència`. `% FV = 100 × poda / referència`. `% FORM = 100 − impropis − pèrdues − FV` (la FORM és la resta per diferència, com a la font). Les parts són excloents i comparteixen denominador, per això es poden apilar al 100 %.

## Categories d'impropi

Vidre; paper i cartró; plàstics, mixtos i films; bosses de plàstic; metalls fèrrics; metalls no fèrrics; tèxtil; tèxtil sanitari; residus especials (perillosos); voluminosos; altres. Als gràfics es mostren 8 grups (metalls fèrrics + no fèrrics, i altres + especials + voluminosos s'agrupen) per mantenir la llegibilitat; les taules conserven les 11 categories.

## Malbaratament alimentari (subestructura)

Els indicadors de malbaratament alimentari (kg i % sobre l'orgànica bruta, residus alimentaris + compostables, presència de FV petita, bosses compostables) es mesuren sobre una subestructura de la mostra. **No se sumen** a la composició i no es barregen amb taules agregades d'altres fonts. El 2006 tots valen 0: es marquen com a probablement no mesurats (regla Q14), no com a zero real.

## Estimadors

- **Mitjana simple per mostra** (per defecte): mitjana dels percentatges de cada mostra. Cada mostra pesa igual.
- **Percentatge per massa caracteritzada**: `100 × Σ kg impropis corregits / Σ massa de referència` sobre mostres vàlides. Les mostres més grans pesen més.
- **Mitjana ponderada per tones recollides**: no disponible. Caldria una font de tones per circuit i període. Cap estimador d'aquesta demo representa la població de residus de Catalunya: són indicadors exploratoris de les mostres caracteritzades, no un indicador oficial ajustat.

## Validesa, representativitat i exclusions

Validació/acceptació (estat del butlletí al SDR) i representativitat són dimensions separades. Una mostra s'analitza si té data de presa de mostra dins el període, composició calculable i cap error bloquejant (massa negativa o nul·la). El protocol de 2022 indica falta de representativitat si una mostra aturada per risc sanitari no arriba a 90 kg; l'exportació no informa de l'aturada ni del motiu, per això les mostres de menys de 90 kg es marquen (Q03) i s'exclouen per defecte (filtre configurable «Mostres < 90 kg»). Totes les exclusions es compten i es mostren amb el motiu.

## Diferències i unitats

Les diferències entre percentatges s'expressen en **punts percentuals (pp)**. La variació relativa s'expressa en %. Nuls, no mesurats i zeros són estats diferents.

## Canvi interanual i cohort estable

Es comparen els darrers 12 mesos fins al final del període amb els 12 anteriors (data de presa de mostra). L'agregat es calcula sobre una **cohort estable**: només circuits presents en tots dos períodes, per evitar que un canvi en quins circuits es mostregen sembli una millora o un empitjorament. També es mostra la variació amb totes les mostres per transparència.

Per circuit es requereixen almenys 3 mostres a cada període. La diferència de mitjanes es calcula amb l'aproximació de Welch i un interval del 95 % aproximat; un canvi és «robust» si l'interval no inclou 0. No hi ha correcció per comparacions múltiples i, amb 3–5 mostres per circuit i any, els intervals són amplis. No es calcula cap interval per a l'agregat, perquè les mostres d'un mateix circuit no són independents.

## Canvis persistents

Per a circuits amb almenys 12 mostres: mediana de les 4 últimes mostres comparada amb la mediana de les 8 anteriors. Es marca si el desplaçament és ≥ max(1 pp, MAD) i almenys 3 de les 4 últimes queden fora de mediana ± MAD. És una regla heurística transparent, no un test formal.

## Anomalies robustes

Per a cada mostra: `z = (x − mediana del circuit) / MAD`, amb un mínim de 0,5 pp per a la MAD, en circuits amb almenys 9 mostres d'historial comparable. Una mostra amb |z| ≥ 3,5 es marca com a atípica. Es classifica com a «possible error de dades» si té incidències de balanç, massa, dates o realineament, i com a «possible incidència operativa» en cas contrari. Una anomalia no és un error: requereix revisió humana amb fotos i observacions.

## Estacionalitat

Mitjanes per mes de presa de mostra i test de Kruskal–Wallis entre mesos amb almenys 5 mostres. Cal un mínim de dos anys de dades. Quan no hi ha cap circuit seleccionat l'anàlisi barreja circuits, i la composició de circuits per mes pot variar (efecte de composició).

## Perfils de composició (clustering exploratori)

Composició completa (FORM, FV, 11 categories, pèrdues), substitució multiplicativa de zeros (0,005 pp), transformació log-ràtio centrada (CLR) i k-means amb k = 4, inicialització k-means++ i llavor fixa 42. Els grups descriuen semblances de composició; no són tipologies oficials ni causes.

## Abans i després d'una intervenció

Per a un circuit i una data documentada: mitjana abans i després en finestres de 6–24 mesos, diferència de Welch amb IC 95 % i un mínim de 3 mostres per finestra. Descriu una associació temporal, no causalitat.

## Atribució territorial i circuits supracomarcals

Cada butlletí declara els municipis del circuit. Es resolen amb el nomenclàtor de l'ICGC per nom normalitzat i una taula explícita d'àlies per a canvis de nom oficials (p. ex. Sant Carles de la Ràpita → la Ràpita). Si tots els municipis són d'una sola comarca, la mostra s'atribueix a la comarca; si són de diverses, el circuit és **supracomarcal** i no es reparteix ni es duplica. La instal·lació de caracterització mai no s'utilitza com a origen del residu. Al mapa, «sense dades» (trama ratllada) es distingeix de «n insuficient» (trama de punts) i dels valors baixos.

## Comparació de circuits o comarques

Es comparen 2–4 entitats en el seu període comú (intersecció de primera i darrera mostra), amb distribució (P25, mediana, P75, extrems), composició, n i cobertura en trimestres. La «cohort estable» conserva només circuits amb mostres a cada any del període comú.

## Identitat dels circuits

Un circuit s'identifica pel nom exacte i l'ens titular informats al SDR. No s'uneixen sèries per noms semblants sense resoldre'n la identitat i la vigència.

## Limitacions generals

- Extracte públic inicial: anys 2006 i 2019–2026. Els anys 2007–2018 no s'han ingerit (es poden afegir amb el job).
- Només butlletins acceptats visibles a la consulta pública.
- Indicador exploratori per massa caracteritzada, no oficial ni ponderat per tones.
- Les sèries llargues travessen canvis de protocol, de factors correctors i de selecció de mostres.
- Les correlacions i diferències temporals no demostren causalitat.
- Les fotografies no permeten inferir pesos; els drets de reutilització no estan confirmats.
