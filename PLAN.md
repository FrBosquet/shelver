# Shelver — Plan del proyecto

Fecha: 9 de octubre de 2026
Estado: base de la fase 1 y guardado, respaldos e historial de la fase 2 implementados. Primer prototipo de plantilla Steam con bloques, estilos compartidos y cambio de formato implementado para probar; otras plataformas y plantillas propias pendientes.

## Objetivo

Crear una webapp local para componer carátulas de videojuegos con assets aportados por el usuario. Cambiar imágenes, textos y posiciones debe producir un resultado reproducible sin regenerar toda la carátula mediante IA.

El usuario podrá guardar, duplicar y modificar proyectos y plantillas, y exportar diseños para pantalla e impresión.

## Decisiones acordadas

- Interfaz orientada primero a escritorio; idioma por definir, sin requisito de español.
- React + TypeScript + Vite para la aplicación; Fabric.js para el lienzo.
- Primera versión sin cuentas ni servidor: archivos procesados en el navegador.
- IndexedDB para guardar proyectos, plantillas e imágenes en ese navegador y dispositivo.
- Respaldo portable que incluya configuración y assets.
- Dos catálogos independientes: plantillas de estilo (Switch, Steam/PC, Xbox y otras) y formatos de estuche (medidas de portada, lomo y trasera).
- Una plantilla define colores, distribución, logos, footer y reglas visuales. El formato del estuche define la geometría; cambiar el tamaño en píxeles no crea una plantilla de estilo.
- El formato puede cambiarse durante la edición: toda la composición ya editada se adapta automáticamente conservando el estilo, el contenido y las modificaciones del usuario.
- Analizar carátulas de referencia antes de definir e implementar las plantillas y sus componentes.
- Componer mediante bloques reutilizables con significado y reglas propias, además de elementos básicos de texto, imagen y forma.
- Colores, tipografías y otras propiedades comunes se definen en estilos compartidos que bloques y elementos referencian, con modificaciones individuales cuando sean necesarias.
- La generación de imágenes será opcional y externa al editor inicialmente.

## Experiencia de uso

1. Elegir un formato de estuche y una plantilla de estilo compatible, o duplicar una plantilla existente.
2. Crear un proyecto y asignarle nombre y plataforma, conservando una copia del formato y del estilo elegidos.
3. Arrastrar assets a slots de fondos, logos, screenshots y clasificación.
4. Completar textos, pies de foto y requisitos.
5. Ajustar bloques, composición, capas y estilos compartidos con vista previa inmediata.
6. Cambiar el formato del estuche en cualquier momento: adaptar automáticamente portada, lomo y trasera conservando el trabajo realizado.
7. Guardar automáticamente, duplicar variantes y exportar PNG, PDF o proyecto completo.

## Primera versión

### Biblioteca local

- Proyectos y plantillas con nombre, miniatura y fecha de modificación.
- Crear, abrir, renombrar, duplicar y eliminar.
- Guardar una composición como plantilla propia.
- Elegir por separado el estilo visual y el formato del estuche al crear un proyecto.
- Copias independientes: editar una copia no altera el original.
- Guardado automático con estado visible y errores claros.

### Editor

- Portada, lomo y trasera según formato.
- Estilo predefinido según plantilla: colores de lomo, posiciones de logos, footer de la trasera y bloques de contenido.
- Bloques configurables para screenshots con pies, requisitos, clasificación, logos y footer legal.
- Edición de estilos compartidos con actualización inmediata de sus referencias y posibilidad de modificaciones individuales.
- Cambio de formato durante la edición, con adaptación automática de bloques y elementos, incluidos los añadidos o modificados por el usuario.
- Zoom y desplazamiento independientes del tamaño del diseño.
- Importar imágenes; mover, escalar, rotar y ordenar elementos.
- Encaje de imagen, recorte y punto focal sin deformar proporciones.
- Textos editables y panel de posición, tamaño, tipografía, color y opacidad.
- Capas con visibilidad y bloqueo; guías y alineación.
- Deshacer y rehacer durante la sesión.
- Avisos de assets pendientes, baja resolución y textos desbordados.

### Exportación y respaldo

- PNG sin guías a la resolución elegida.
- PDF con tamaño físico explícito, incorporando el render a la resolución seleccionada.
- `.coverproject`: paquete ZIP con manifiesto JSON versionado y assets incluidos.
- Importar un proyecto en otro navegador sin rutas ni enlaces externos.
- Exportar e importar plantillas con sus bloques, reglas, estilos compartidos y assets fijos.
- Incluir en los respaldos las definiciones y dependencias utilizadas por el proyecto, incluidas fuentes personalizadas si las incorpora, para conservar sus referencias y apariencia al restaurarlo.
- Guardado local y respaldo son funciones diferentes: IndexedDB no sincroniza dispositivos.

## Formatos de estuche y plantillas de estilo

Son conceptos distintos y serán datos versionados independientes del estado interno de Fabric.js. El motor combina la geometría del formato con las reglas visuales de la plantilla para crear la composición del lienzo.

### Formato del estuche

- Identificador, nombre y versión del formato.
- Dimensiones en milímetros para impresión o píxeles para formatos digitales.
- Tamaño y posición de las caras de portada y trasera, y anchura del lomo.
- Sangrado, líneas de corte y márgenes seguros.

El formato no define colores, logos ni distribución del contenido. Las dimensiones de cada estuche se verificarán antes de ofrecerlo para impresión. Los valores del formato digital actual y del JSON de la conversación anterior son provisionales, no medidas válidas de impresión.

### Plantilla de estilo

Cada plantilla define:

- Identificador, nombre, versión, plataforma y formatos compatibles.
- Colores de fondo, lomo y franjas; tipografías y estilos de texto.
- Distribución de contenido por cara y lomo, con posiciones y anclajes relativos a esos paneles.
- Posiciones para logos de plataforma, juego, desarrollador y editor, conservando sus proporciones.
- Footer de la trasera y zonas para información legal, clasificación y otros datos.
- Elementos fijos y bloqueables, como franjas y marcas de plataforma.
- Slots editables de imágenes y textos con encaje y estilos por defecto.
- Bloques reutilizables: screenshots con pies, clasificación y requisitos.
- Campos opcionales y obligatorios.

La plantilla no fija las medidas del estuche ni la resolución de exportación. El contenido del juego y sus assets también se mantienen separados del estilo. La compatibilidad describe los paneles y capacidades que requiere la plantilla; no vincula un estilo a un único tamaño o generación de consola.

### Adaptación de una composición ya editada

Ejemplo de aceptación: elegir el estilo Xbox, componer una carátula y cambiar después el formato del estuche. Todos los bloques y elementos deben ajustarse automáticamente sin perder el estilo Xbox, los assets, los textos ni las modificaciones realizadas.

- Asociar cada bloque y elemento a su panel, con anclajes, posiciones relativas, márgenes y reglas de tamaño; incluir estas reglas al añadir elementos propios.
- Recalcular posiciones y espacios disponibles al cambiar las medidas de portada, trasera o lomo. Las posiciones editadas se conservan como relaciones o ajustes respecto al panel, no solo como coordenadas absolutas en píxeles.
- Mantener las proporciones de logos e imágenes; adaptar encaje y recorte conservando el punto focal elegido.
- Redistribuir textos y bloques de contenido según sus reglas de ancho, espaciado y tamaño tipográfico.
- Mantener el footer anclado al borde inferior de la trasera y adaptar el contenido del lomo a su nueva anchura.
- Adaptar también la distribución interna de los bloques compuestos. Un grupo necesita reglas de composición, además de mover o escalar su contenedor.
- Mostrar los conflictos que no puedan resolverse dentro de las restricciones, como un texto desbordado, sin eliminar contenido ni deformar imágenes. La revisión visual complementa la adaptación automática.
- Permitir deshacer y rehacer el cambio de formato completo; guardar el nuevo formato y la composición resultante juntos.

### Estilos compartidos y referencias

Cada plantilla define un sistema de estilos común: colores por función (fondo, lomo, texto, acento), estilos tipográficos (título, cuerpo, pie, texto legal), espaciados, bordes, fondos y degradados.

Los bloques y elementos referencian esos estilos mediante identificadores estables. Por ejemplo, todos los pies de screenshot referencian `screenshot.caption`; cambiar la fuente o el color de ese estilo actualiza todos sus usuarios. Las referencias se mantienen durante la edición, sin convertirse únicamente en valores copiados al crear los elementos.

El proyecto conserva su propia copia de las definiciones compartidas de la plantilla. Un bloque o elemento puede sobrescribir propiedades concretas; las restantes siguen heredándose. Si un pie tiene un color individual, conserva ese color y sigue recibiendo los cambios de fuente del estilo compartido. El editor debe mostrar qué propiedades son heredadas y permitir restablecerlas.

Guardar, duplicar, cambiar el formato y exportar/importar deben preservar definiciones, referencias y modificaciones individuales. Editar los estilos compartidos de un proyecto no altera otros proyectos ni la plantilla de origen.

### Catálogo inicial de estilos

1. Nintendo Switch: lomo rojo y distribución predefinida para logos, textos y footer de la trasera.
2. Steam/PC: cabecera de marca azul oscuro, lomo configurable (incluidos azul oscuro y amarillo en la referencia aportada), y distribución predefinida para logos, textos y footer; primera composición de referencia con Chants of Sennaar.
3. Xbox: estilo y distribución propios de plataforma, con posiciones para logos y footer; concretar sus reglas visuales durante el diseño.
4. Estilo genérico personalizable; PlayStation después del flujo inicial.

La primera entrega de este catálogo debe incluir estilos visibles y reutilizables; tres lienzos con distintos tamaños o nombres de plataforma no cumplen ese objetivo. Los logos de plataforma serán SVGs reales en una biblioteca común disponible para todas las carátulas, independiente de plantillas y formatos, con identificadores estables, procedencia documentada y archivos incluidos en los respaldos. No se sustituirán por texto con una fuente parecida. El primer catálogo incluye el logo completo y el símbolo de Steam en blanco y negro; Switch y Xbox se incorporarán después. Los logos particulares de cada juego o editor podrán aportarse como assets propios.

### Catálogo de formatos

Formatos de estuche para Switch, cajas PC personalizadas, Xbox y formatos configurables, con sus medidas validadas por separado. El estilo Steam/PC puede usarse en una caja personalizada sin asumir una caja física oficial de Steam. Los assets digitales de la biblioteca de Steam podrán añadirse como formatos independientes.

## Análisis de referencias y catálogo de bloques

Antes de implementar los estilos, analizar con el usuario carátulas de referencia: portada, lomo y trasera. Para cada referencia, identificar elementos, agrupaciones, jerarquía tipográfica, colores compartidos, posiciones de logos, footer, proporciones y reglas de alineación. Distinguir las reglas de plataforma de las decisiones particulares del juego y de la geometría del estuche.

El resultado será un inventario de componentes y una especificación de cada plantilla: qué bloques contiene, sus campos editables, assets necesarios, estilos referenciados y comportamiento al cambiar de formato. Las referencias disponibles determinarán y ampliarán el catálogo; los siguientes bloques son candidatos iniciales:

- Fila o cuadrícula de screenshots con pies y fondos o degradados regulables.
- Bloque de requisitos con etiquetas y valores, como SO y Procesador.
- Bloque de clasificación con PEGI y descriptores dentro de un marco común.
- Conjunto de logos con alineación, espaciado y proporciones coordinadas.
- Footer legal con textos, logos y otros campos identificados en las referencias.
- Bloque de lomo con fondo, título y marcas de plataforma.
- Cita de prensa con atribución, tabla de prestaciones e idiomas y código de barras opcional, observados en la referencia Steam.

Cada bloque es una unidad configurable y reutilizable con campos, hijos y reglas de distribución propias. Puede contener textos, imágenes, formas, fondos y degradados. Sus componentes internos deben permanecer editables y adaptarse juntos; no se guardará únicamente como una imagen aplanada ni como un grupo sin reglas.

Primera referencia analizada: [Steam/PC — Chants of Sennaar](docs/references/steam-chants-of-sennaar.md). Documenta los bloques de portada, lomo y trasera, estilos compartidos propuestos, datos reutilizados entre caras y reglas de adaptación. El JPEG completo está disponible como referencia visual; los assets y fuentes individuales todavía no se han aportado.

## Reglas visuales de Chants of Sennaar

- Pies de screenshot sobre textura o continuidad de la imagen, con degradado regulable para mantener legibilidad.
- Encabezados de requisitos como SO y Procesador en negrita.
- PEGI y descriptores en un marco blanco común y con alturas visuales coherentes.
- Logo real de Rundisc aportado por el usuario.
- Logos e iconos conservan sus proporciones.
- Estas reglas se pueden ajustar y guardar en plantillas.

## Arquitectura

| Componente | Responsabilidad |
| --- | --- |
| React + TypeScript | Biblioteca, paneles e interacción |
| Vite | Desarrollo local y compilación |
| Fabric.js | Render, selección y transformación |
| Modelo de dominio | Formatos, plantillas de estilo y proyectos independientes del lienzo |
| Motor de composición | Resolver estilos referenciados y distribuir bloques y elementos según el formato |
| IndexedDB | Datos, blobs y migraciones |
| pdf-lib | PDF con tamaño físico controlado |
| fflate | Paquetes ZIP portables |

La misma composición servirá para vista previa y exportación. Se esperará a cargar imágenes y fuentes antes de exportar.

Para imprimir: `px = mm / 25.4 × dpi`. DPI y zoom de pantalla son independientes. El PDF inicial usará una composición rasterizada en RGB, adecuada para impresión doméstica; PDF vectorial, CMYK y preimpresión profesional quedan para futuras versiones.

### Modelo de datos

- `Format`: geometría del estuche, dimensiones, paneles, sangrado y márgenes; identificador y versión independientes del estilo.
- `Template`: sistema de estilos compartidos, bloques, distribución por panel, slots, elementos fijos y compatibilidad con formatos.
- `StyleSheet` / `StyleRef`: definiciones compartidas de colores, tipografías y otras propiedades, y referencias estables desde bloques y elementos.
- `LayoutRule`: panel, anclajes, posiciones relativas, márgenes, restricciones de tamaño y reglas de encaje o distribución.
- `Block`: tipo de componente, campos, elementos o bloques hijos, referencias de estilo, modificaciones individuales y reglas de distribución interna.
- `Project`: referencias al formato y a la plantilla de origen con sus versiones, copias de sus definiciones, estilos compartidos propios, bloques editados, datos del juego y referencias a assets. Conservar tanto las reglas como la composición resuelta.
- `Asset`: identificador estable, blob, nombre, tipo y metadatos; imágenes y, cuando se incorporen, fuentes personalizadas.
- `Element`: imagen, texto, forma u otro elemento básico con referencias de estilo, modificaciones individuales, reglas de adaptación y orden.
- `ProjectPackage`: versión del esquema, manifiesto, definiciones de formato, plantilla, bloques y estilos utilizadas, y archivos necesarios para restaurarlos.

El prototipo Steam usa el esquema de proyecto 2 con una definición de diseño versionada: bloques por panel, estilos compartidos, contenido enlazado, slots de imágenes, modificaciones individuales y posiciones relativas. Conserva esa definición junto a los elementos resueltos que usa Fabric para la vista previa y la exportación. Los proyectos y respaldos del esquema 1 siguen siendo compatibles. El starter libre conserva su modelo básico; tipos de bloques arbitrarios, fuentes personalizadas y plantillas propias siguen pendientes. Actualizar un formato o una plantilla no cambiará silenciosamente proyectos existentes. Las copias pueden compartir blobs inmutables; sustituir un asset en una copia no alterará la otra. El borrado de assets comprobará si siguen referenciados.

## Fases de implementación

### 1. Base y primera composición

- Inicializar el proyecto y fijar versiones compatibles de dependencias.
- Definir el esquema versionado de proyectos y plantillas.
- Montar biblioteca básica y editor con plantilla genérica PC/Steam.
- Importar imágenes, editar textos y transformar objetos.
- Exportar PNG coherente con la vista previa.

Criterio de finalización: montar una carátula con assets del usuario sin generación de imágenes.

### 2. Guardado y reutilización

- [x] IndexedDB para proyectos y assets, guardado automático y recuperación tras recargar, con estados de guardado, errores y reintento.
- [x] Duplicación independiente de proyectos. Duplicación de plantillas pendiente del editor de plantillas.
- [x] Importación/exportación de `.coverproject` con todos los assets referenciados por la composición, validación y restauración como copia independiente.
- [x] Deshacer y rehacer durante la sesión, con historial por proyecto y guardado automático de los cambios restaurados.

Criterio de finalización: cerrar y reabrir conserva el trabajo; el respaldo se restaura en un navegador sin datos previos.

### 3. Plantillas y composición

- [x] Analizar la primera carátula Steam y definir su inventario de bloques, estilos y reglas. Ampliar con referencias de Switch y Xbox.
- [x] Separar en el prototipo Steam la definición del estilo y la geometría del estuche, con controles independientes y compatibilidad con los proyectos guardados.
- [x] Incorporar colores, fuentes y estilos de texto compartidos, referencias y modificaciones individuales, con restablecimiento de la herencia.
- [x] Implementar los bloques de la referencia Steam con campos, listas y slots editables. Ampliar después a componentes y agrupaciones arbitrarios.
- [x] Añadir el primer estilo Steam/PC con lomo configurable, posiciones para logos, galería, requisitos, clasificación y footer. Añadir Switch y Xbox tras analizar sus referencias.
- [x] Biblioteca compartida de SVGs con logo y símbolo Steam en blanco y negro, disponible en cualquier editor. Cabecera y lomo usan logos reales con contraste automático, encaje proporcional, funcionamiento sin conexión y respaldo portable. Ampliar con otras plataformas.
- [x] Cambiar el formato del prototipo durante la edición y adaptar bloques y elementos propios, conservando contenido y modificaciones, con guardado y deshacer/rehacer. Revisar layouts extremos y refinar reglas de distribución con el usuario.
- Capas, bloqueos, guías y controles de encaje.
- Guardado, duplicación y exportación/importación de plantillas propias con sus bloques, estilos y dependencias.

Criterio de finalización: crear carátulas con estilos Switch, Steam/PC y Xbox definidos a partir de referencias, editar sus bloques y estilos compartidos, cambiar después el formato conservando todo el trabajo y restaurar el resultado desde un respaldo. Reutilizar una plantilla para varios juegos conservando sus reglas visuales.

### 4. Impresión y acabado

- Validar medidas físicas y ampliar el catálogo de formatos de estuche, por separado del catálogo de estilos.
- PDF a tamaño real, sangrado y marcas de corte opcionales.
- Comprobaciones de resolución, desbordamientos y contenido pendiente.
- Navegación por teclado y revisión del flujo completo.
- Documentación de inicio local, respaldo y restauración.

Criterio de finalización: PNG y PDF coinciden con la composición; el PDF tiene las medidas físicas previstas.

## Validación esencial

- Recargar un proyecto conservando textos e imágenes.
- Duplicar y editar sin modificar el original.
- Exportar e importar en un almacén vacío conservando todos los assets.
- Deshacer y rehacer transformaciones, textos y cambios de assets.
- Comparar vista previa y exportación: fuentes, recortes, degradados y proporciones.
- Verificar lomo rojo de Switch, cabecera azul oscuro y lomo configurable de Steam/PC, posiciones de logos y footer de cada plantilla.
- Cambiar clasificación e identidad del editor y comprobar sus apariciones enlazadas en portada, lomo y trasera, conservando las variantes de presentación de cada slot.
- Componer con estilo Xbox, añadir y modificar elementos propios y cambiar el formato: comprobar posiciones, proporciones, recortes, redistribución de texto, footer y lomo sin perder contenido ni modificaciones. Deshacer y rehacer debe recuperar ambos estados completos.
- Editar un estilo compartido y comprobar que todos sus usuarios se actualizan; una propiedad modificada individualmente se conserva mientras las restantes siguen heredándose. Restablecerla recupera la herencia.
- Editar campos de bloques de screenshots, requisitos, clasificación y logos; comprobar su distribución interna y adaptación como unidades al cambiar el formato.
- Guardar, recargar, duplicar y exportar/importar conservando bloques, reglas, estilos, referencias y modificaciones individuales; verificar independencia entre proyectos y compatibilidad con los respaldos anteriores.
- Comprobar dimensiones del PDF y realizar una impresión al 100 %.
- Comunicar errores de cuota o escritura sin mostrar falsamente un guardado correcto.

## Fuera del alcance inicial

- Cuentas, sincronización y colaboración simultánea.
- Marketplace de plantillas.
- Generación de imágenes integrada y consumo de APIs de IA.
- Importación automática de fichas desde tiendas.
- Historial persistente ilimitado y preimpresión profesional.

## Próximo paso

Probar la primera plantilla Steam con el usuario: cargar assets individuales, revisar sus bloques y estilos y cambiar el formato. Ajustar las reglas a partir de esa prueba, analizar referencias de Switch y Xbox y ampliar el catálogo. La validación de medidas físicas sigue siendo una tarea independiente.

La carátula Steam de Chants of Sennaar está disponible como JPEG aplanado. Para reproducir su composición con elementos editables serán necesarios los assets y fuentes individuales; las medidas físicas del estuche siguen pendientes de validar.
