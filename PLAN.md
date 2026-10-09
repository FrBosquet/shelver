# Shelver — Plan del proyecto

Fecha: 9 de octubre de 2026
Estado: base de la fase 1 implementada; guardado local de la fase 2 implementado. Respaldos y deshacer/rehacer pendientes.

## Objetivo

Crear una webapp local para componer carátulas de videojuegos con assets aportados por el usuario. Cambiar imágenes, textos y posiciones debe producir un resultado reproducible sin regenerar toda la carátula mediante IA.

El usuario podrá guardar, duplicar y modificar proyectos y plantillas, y exportar diseños para pantalla e impresión.

## Decisiones acordadas

- Interfaz orientada primero a escritorio; idioma por definir, sin requisito de español.
- React + TypeScript + Vite para la aplicación; Fabric.js para el lienzo.
- Primera versión sin cuentas ni servidor: archivos procesados en el navegador.
- IndexedDB para guardar proyectos, plantillas e imágenes en ese navegador y dispositivo.
- Respaldo portable que incluya configuración y assets.
- Catálogo ampliable: Nintendo Switch, PC/Steam, PlayStation, Xbox y formatos personalizados.
- La generación de imágenes será opcional y externa al editor inicialmente.

## Experiencia de uso

1. Elegir una plantilla o duplicar una existente.
2. Crear un proyecto y asignarle nombre y plataforma.
3. Arrastrar assets a slots de fondos, logos, screenshots y clasificación.
4. Completar textos, pies de foto y requisitos.
5. Ajustar composición, capas y estilos con vista previa inmediata.
6. Guardar automáticamente, duplicar variantes y exportar PNG, PDF o proyecto completo.

## Primera versión

### Biblioteca local

- Proyectos y plantillas con nombre, miniatura y fecha de modificación.
- Crear, abrir, renombrar, duplicar y eliminar.
- Guardar una composición como plantilla propia.
- Copias independientes: editar una copia no altera el original.
- Guardado automático con estado visible y errores claros.

### Editor

- Portada, lomo y trasera según formato.
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
- Exportar e importar plantillas con sus assets fijos.
- Guardado local y respaldo son funciones diferentes: IndexedDB no sincroniza dispositivos.

## Sistema de plantillas

Las plantillas serán datos versionados independientes del estado interno de Fabric.js. El motor convierte esos datos en objetos del lienzo.

Cada plantilla define:

- Identificador, nombre, versión y plataforma.
- Dimensiones en milímetros para impresión o píxeles para formatos digitales.
- Paneles de portada, lomo y trasera.
- Sangrado, líneas de corte y márgenes seguros.
- Elementos fijos y bloqueables, como franjas y marcas de plataforma.
- Slots editables de imágenes y textos con encaje y estilos por defecto.
- Bloques reutilizables: screenshots con pies, clasificación y requisitos.
- Campos opcionales y obligatorios.

Separar formato de caja, composición visual y contenido del juego permitirá reutilizar assets entre formatos. Cada adaptación requerirá revisar recortes y distribución de textos.

### Catálogo inicial

1. PC/Steam: caja física personalizada para trabajar con Chants of Sennaar.
2. Nintendo Switch: portada, lomo y trasera.
3. Formato genérico configurable.
4. PlayStation y Xbox tras validar el flujo inicial.

Las dimensiones de cada caja y lomo se verificarán antes de finalizar su plantilla. El JSON de la conversación anterior contenía medidas ilustrativas, no medidas válidas de impresión.

Una caja física personalizada PC/Steam es distinta de los assets digitales de la biblioteca de Steam. Estos podrán añadirse como formatos independientes; no se asumirá una caja física oficial de Steam.

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
| Modelo de dominio | Proyectos y plantillas independientes del lienzo |
| IndexedDB | Datos, blobs y migraciones |
| pdf-lib | PDF con tamaño físico controlado |
| Utilidad ZIP por elegir | Paquetes portables |

La misma composición servirá para vista previa y exportación. Se esperará a cargar imágenes y fuentes antes de exportar.

Para imprimir: `px = mm / 25.4 × dpi`. DPI y zoom de pantalla son independientes. El PDF inicial usará una composición rasterizada en RGB, adecuada para impresión doméstica; PDF vectorial, CMYK y preimpresión profesional quedan para futuras versiones.

### Modelo de datos

- `Template`: formato, paneles, slots, elementos fijos y reglas.
- `Project`: plantilla de origen, copia de la composición, datos del juego y referencias a assets.
- `Asset`: identificador estable, blob, nombre, tipo y dimensiones.
- `Element`: imagen, texto, forma o grupo con posición, estilo y orden.
- `ProjectPackage`: versión del esquema, manifiesto y archivos.

Actualizar una plantilla no cambiará silenciosamente proyectos existentes. Las copias pueden compartir blobs inmutables; sustituir un asset en una copia no alterará la otra. El borrado de assets comprobará si siguen referenciados.

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
- Duplicación independiente de proyectos y plantillas.
- Importación/exportación de `.coverproject` con todos los assets.
- Deshacer y rehacer durante la sesión.

Criterio de finalización: cerrar y reabrir conserva el trabajo; el respaldo se restaura en un navegador sin datos previos.

### 3. Plantillas y composición

- Validar medidas y añadir Nintendo Switch.
- Bloques de screenshots, degradados, clasificación y requisitos.
- Capas, bloqueos, guías y controles de encaje.
- Edición y exportación de plantillas propias.

Criterio de finalización: reutilizar una plantilla para varios juegos conservando reglas y proporciones.

### 4. Impresión y acabado

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
- Comprobar dimensiones del PDF y realizar una impresión al 100 %.
- Comunicar errores de cuota o escritura sin mostrar falsamente un guardado correcto.

## Fuera del alcance inicial

- Cuentas, sincronización y colaboración simultánea.
- Marketplace de plantillas.
- Generación de imágenes integrada y consumo de APIs de IA.
- Importación automática de fichas desde tiendas.
- Historial persistente ilimitado y preimpresión profesional.

## Próximo paso

Continuar la fase 2 con importación/exportación de `.coverproject` y deshacer/rehacer. Después validar medidas y ajustar la primera plantilla con una carátula real.

Los archivos de la carátula anterior no están disponibles en esta conversación. Para reproducir su composición o utilizar sus imágenes será necesario que el usuario los aporte.
