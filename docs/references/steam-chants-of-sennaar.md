# Referencia Steam/PC — Chants of Sennaar

Fecha: 9 de octubre de 2026.
Fuente: carátula completa aportada por el usuario en `WhatsApp Image 2026-10-08 at 16.54.14.jpeg`.
Estado: análisis visual y propuesta de componentes; pendiente de contrastar con más referencias antes de implementar el catálogo.

## Qué representa la referencia

De izquierda a derecha: trasera, lomo y portada. El margen blanco exterior y las marcas de corte pertenecen a la presentación para impresión. No son elementos del estilo Steam ni permiten deducir medidas físicas del estuche.

El lomo de esta composición es amarillo, con marcas negras. La cabecera Steam de portada es azul oscuro y se funde con la ilustración; la zona técnica y legal de la trasera también usa un fondo muy oscuro. El lomo debe tener un color configurable, incluido el azul oscuro comentado previamente, sin obligar a que coincida con el fondo técnico o con la cabecera.

Una única referencia muestra decisiones de esta composición, no todas las reglas posibles de Steam. Las fuentes exactas, los colores originales y la separación entre capas no pueden identificarse con certeza en el JPEG aplanado.

## Inventario de bloques observados

| Zona | Bloque | Campos y componentes | Regla de composición propuesta |
| --- | --- | --- | --- |
| Portada | Ilustración principal | Asset, encaje, recorte, punto focal | Cubrir el panel conservando proporciones; recalcular el recorte al cambiar de estuche. |
| Portada superior | Cabecera de plataforma | Logo Steam, fondo y transición con la ilustración | Anclar arriba; conservar proporciones del logo y controlar altura, margen y degradado. |
| Portada | Identidad del juego | Logo gráfico del título | Colocar dentro de la zona superior de la ilustración con anclaje y tamaño relativos. |
| Portada inferior | Marcas de esquina | PEGI a la izquierda y logo Focus a la derecha | Anclar a las esquinas inferiores con márgenes comunes; dimensionar cada marca sin deformarla. |
| Lomo | Identidad vertical | Fondo configurable, marca Steam arriba, título del juego en el centro y editor abajo | Distribuir los tres slots en el eje del lomo; configurar orientación y adaptar a su anchura. |
| Trasera superior | Presentación del juego | Fondo ilustrado, titular y sinopsis | Texto alineado a la izquierda sobre el arte; ajustar ancho, líneas y legibilidad. |
| Trasera central | Galería de screenshots | Tres imágenes, cada una con su pie | Distribuir celdas con separación uniforme; compartir encaje, altura de imagen y estilo de pie. |
| Trasera, bajo la galería | Cita de prensa | Cita y atribución | Mantener ambos campos juntos y centrados; adaptar líneas y espaciado. |
| Trasera inferior | Requisitos PC | Dos columnas: mínimos y recomendados, con encabezados y pares etiqueta/valor | Coordinar columnas y filas; etiquetas destacadas, valores editables y separadores comunes. |
| Trasera inferior | Prestaciones e idiomas | Cinco celdas con icono y texto: jugador, mando, logros, nube e idiomas | Gestionar una lista editable, repartir el ancho y redistribuir según el espacio. |
| Footer trasero | Clasificación y descriptores | PEGI 7, violencia y lenguaje dentro de un marco blanco común | Un bloque con lista de descriptores; armonizar alturas visuales, márgenes y separación. |
| Footer trasero | Editor e información legal | Logo Focus y texto legal | Agrupar logo y texto con estilos y espaciado propios. |
| Footer trasero | Código de barras | Gráfico y numeración | Slot opcional sobre fondo claro, conservando proporciones y espacio alrededor. |

La zona técnica y legal inferior es además un contenedor común: fondo oscuro, padding y distribución vertical de requisitos, prestaciones y footer. Sus hijos mantienen sus campos y reglas internas. La presencia de un código de barras no exige decidir todavía si se importará como asset o se generará desde un valor.

Los pies de screenshot están sobre el fondo cálido de la composición, sin tarjetas blancas individuales. La plantilla debe poder usar continuidad del fondo, textura o un degradado regulable. No se puede afirmar a partir del JPEG qué capas se utilizaron para conseguirlo.

## Datos compartidos y contenido del juego

Separar tres niveles:

- **Estilo de plantilla:** estructura de cabecera, lomo y footer, estilos tipográficos, fondos, bordes, espaciados y reglas de distribución.
- **Contenido del proyecto:** ilustraciones, screenshots y pies, titular, sinopsis, cita, requisitos, prestaciones, idiomas, logos, clasificación y datos legales.
- **Formato del estuche:** geometría de las tres caras, sangrado y márgenes de impresión.

Compartir datos mediante referencias entre sus apariciones:

- El logo o identidad del juego aparece en portada y lomo; cada instancia tiene su encaje y orientación.
- Steam aparece en cabecera y lomo; puede usar variantes claras u oscuras del asset de marca.
- Focus aparece en portada, lomo y trasera; las instancias referencian la misma identidad del editor con variantes cuando proceda.
- La clasificación PEGI aparece en portada y trasera; cambiar el dato de clasificación debe actualizar ambas. Los descriptores se muestran en el bloque trasero.
- El nombre, desarrollador y editor usados en los datos legales deben poder referenciar los datos del proyecto.

El texto legal menciona Rundisc, pero no se identifica un logo independiente de Rundisc en esta referencia. El requisito anterior de admitir ese logo se mantiene como posibilidad de contenido, no como elemento observado aquí.

Los screenshots, la ilustración, el título gráfico y la paleta amarilla pertenecen a esta composición del juego. La plantilla Steam debe permitir sustituirlos al reutilizarla para otro juego.

## Estilos compartidos propuestos

Los nombres siguientes son una propuesta de roles, no una API ya implementada.

| Referencia | Usuarios y propiedades |
| --- | --- |
| `color.brandSurface` | Fondo de cabecera Steam; azul oscuro configurable. |
| `color.spine` / `color.onSpine` | Fondo y marcas del lomo; amarillo y negro en esta referencia, con configuración independiente. |
| `color.technicalSurface` / `color.onTechnical` | Contenedor técnico/legal y sus textos e iconos; oscuro y claro en esta referencia. |
| `color.onArtwork` | Textos sobre el fondo ilustrado; negro en esta referencia. |
| `font.heading`, `font.body`, `font.technical` | Familias por función: titulares y cuerpo con serif, información técnica con tipografía estrecha sin serif según su apariencia; identificar las fuentes antes de reproducirlas. |
| `text.backHeadline`, `text.synopsis` | Tamaño, peso, interlineado y alineación de la presentación. |
| `screenshot.caption` | Estilo común de los tres pies, centrados y destacados. |
| `review.quote` / `review.attribution` | Jerarquía de la cita y su atribución. |
| `requirements.heading`, `requirements.label`, `requirements.value` | Jerarquía compartida de ambas columnas; etiquetas destacadas respecto a los valores. |
| `features.label`, `legal.body` | Textos de prestaciones y texto legal. |
| `spacing.panelInset`, `spacing.blockGap`, `spacing.cellGap` | Márgenes y separaciones comunes, adaptables al formato. |
| `border.technical`, `surface.ratingGroup` | Separadores de requisitos/prestaciones y marco blanco de clasificación. |
| `surface.platformTransition`, `surface.captionBackdrop` | Degradados, texturas o fondos con dirección, colores y opacidad configurables. |

Cada elemento o bloque conserva referencias a estos estilos. Las modificaciones individuales solo sobrescriben las propiedades elegidas; el resto continúa heredándose. Cambiar `screenshot.caption` actualiza los tres pies salvo sus propiedades sobrescritas. Cambiar el color del lomo actualiza también los elementos que lo referencien sin modificar el fondo de la trasera.

Los logos gráficos son assets, no textos que deban reconstruirse buscando una fuente parecida. Su tamaño, encaje, orientación y variantes sí pertenecen a la configuración de cada slot.

## Adaptación al cambiar de estuche

- Portada: recalcular el recorte del arte y las zonas de cabecera y título; mantener PEGI y editor anclados abajo.
- Lomo: distribuir plataforma, título y editor dentro del nuevo ancho y alto, conservando orientación y proporciones. Avisar cuando la anchura no permita un resultado legible.
- Trasera: reservar el espacio del contenedor técnico/legal inferior y redistribuir presentación, galería y cita en el resto del panel.
- Galería: recalcular columnas, tamaños y pies como un conjunto; permitir redistribución sin perder ninguna imagen o texto.
- Requisitos: redistribuir las columnas según sus restricciones; ajustar líneas sin descoordinar etiquetas y valores.
- Prestaciones: adaptar celdas y filas manteniendo cada icono unido a su texto.
- Footer: redistribuir clasificación, editor/legal y código de barras, conservando el marco común y los márgenes.
- Conservar todas las modificaciones del usuario mediante relaciones con el panel y las reglas del bloque, incluidas las de elementos añadidos.

El resultado debe seguir siendo editable, guardable y portable. El cambio de formato se deshace y rehace como una operación completa. Los conflictos de espacio se muestran sin eliminar contenido ni deformar assets.

## Alcance del material disponible

El JPEG sirve para analizar la composición completa. Para reproducirla con componentes editables harán falta los assets individuales: ilustraciones, tres screenshots, logos, iconos y fuentes correspondientes. Esta referencia no permite recuperar fielmente sus capas originales ni confirmar medidas de impresión.

La siguiente revisión debe concretar variantes de lomo, cabecera y footer, bloques opcionales y reglas tipográficas a partir de esta referencia y otras carátulas aportadas. Los colores exactos y las fuentes permanecen pendientes de especificar.
