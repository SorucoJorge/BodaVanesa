# Invitación de boda · Vanesa y Mauricio

Invitación estática lista para GitHub Pages. No necesita dependencias ni compilación.

## Personalización

- Fotos del matrimonio civil: ya están guardadas en `assets/photos/` como `1.jpg` a `11.jpg`. La galería detecta esos nombres y omite los que falten.
- Música: al abrir el sobre, el control de la barra superior reproduce `assets/music/photograph.mp3`. El mismo botón permite pausar y reanudar. El archivo debe existir en esa ruta; comprueba que tienes derecho a alojarlo en un sitio público antes de publicarlo.
- Marcos de selfie: `assets/frames/marco-vertical.png` (1028 × 1529) y `assets/frames/marco-horizontal.png` (1536 × 1024). La cámara elige uno según la orientación y guarda el resultado como JPG con las dimensiones nativas del marco. La foto conserva su proporción y se contiene en la abertura transparente; no se estira ni se recorta.
- El álbum compartido apunta al enlace de Google Photos proporcionado. Sus permisos se administran desde Google Photos.
- La cámara solicita permiso y permite descargar una imagen con marco; el navegador no permite guardarla silenciosamente en la galería.
- Revisa los horarios del programa, especialmente las actividades después de medianoche.

## Conectar Google Sheets

1. Crea una hoja de cálculo y abre **Extensiones > Apps Script**.
2. Copia `apps-script/Code.gs` en el editor, guarda y ejecuta `setupWeddingSheet` una vez. Acepta los permisos. Se crean las pestañas `Invitados`, `Confirmaciones`, `Canciones` y `Dedicatorias`.
3. En **Implementar > Nueva implementación**, selecciona **Aplicación web**, ejecuta como tu cuenta y permite el acceso a cualquier persona. La hoja no se publica; el servicio devuelve solo la invitación asociada al token y las dedicatorias aprobadas.
4. Copia la URL terminada en `/exec` en `config.js`, en `appsScriptUrl`.
5. Publica el sitio y abre `tools/generar-invitaciones.html`. Escribe la URL pública y pega una invitación por línea: `Nombre | pases`, con 1 o 2 pases.
6. Genera enlaces y descarga el CSV. Impórtalo en `Invitados` con las columnas `Token`, `Nombre`, `Cupos`. Comparte solo el enlace correspondiente a cada invitación.

Las confirmaciones se actualizan por invitación. Las sugerencias van a la pestaña privada `Canciones` en orden de llegada. Los mensajes del libro quedan como `PENDIENTE`; revisa el contenido y cambia a `APROBADO` en `Dedicatorias` para mostrarlos públicamente.

El generador guarda los tokens en el almacenamiento local del navegador, por nombre, para mantener los enlaces al editar cupos o agregar invitados. Usa el mismo navegador para actualizar la lista. Si cambias un nombre, se genera un token nuevo. Al importar una lista actualizada, reemplaza las filas de invitados anteriores en Sheets en vez de anexar el CSV, y conserva en privado una copia de respaldo.

## Publicar en GitHub Pages con archivos públicos limitados

El workflow `.github/workflows/pages.yml` publica solo los archivos necesarios para la invitación. No publica `tools/`, `apps-script/` ni el README. El repositorio fuente puede seguir siendo público, así que nunca subas hojas exportadas, CSV de invitados, tokens, contraseñas ni copias de respaldo.

1. Sube el proyecto al repositorio de GitHub. El workflow usa la rama `main`; si tu rama principal tiene otro nombre, actualiza ese nombre en el YAML.
2. En **Settings > Pages > Build and deployment**, selecciona **GitHub Actions** como origen.
3. En **Settings > Actions > General**, permite las acciones necesarias para que el workflow publique Pages. Revisa **Actions** y confirma que `Publish wedding invitation` finalizó correctamente.
4. En **Settings > Pages**, abre el enlace del sitio y activa **Enforce HTTPS** cuando aparezca disponible.
5. Prueba la URL pública, incluida la ruta del repositorio, por ejemplo `https://usuario.github.io/nombre-repo/`.

### Generar enlaces únicos de forma privada

Usa el generador desde tu propio XAMPP: `http://localhost/BodaVanesa/tools/generar-invitaciones.html`. Pega la URL pública de GitHub Pages y una invitación por línea (`Nombre | pases`). Descarga el CSV, guárdalo en privado e impórtalo en la pestaña `Invitados`. No publiques ni compartas ese CSV; envía a cada persona únicamente su enlace.

Para mantener los tokens si actualizas la lista, usa el mismo navegador y perfil donde generaste los enlaces o conserva una copia privada del CSV anterior. El generador no envía la lista a un servidor: la procesa en ese navegador.

### Seguridad de datos

- Mantén el archivo de Google Sheets restringido a tu cuenta y a las personas de confianza que administren las confirmaciones. La aplicación web ejecutada como tu cuenta tiene permiso para escribir en esa hoja.
- El enlace `/exec` de Apps Script aparece en `config.js` y es público por diseño; no es una contraseña. No guardes claves ni credenciales en los archivos del sitio.
- Cada enlace de invitación contiene un token privado que permite consultar esa invitación y enviar respuestas. Trátalo como una entrada personal y evita publicarlo en redes o grupos abiertos.
- Revisa los mensajes pendientes antes de marcar `APROBADO`.
- Si modificas `apps-script/Code.gs`, copia la versión actualizada al proyecto de Apps Script y crea una nueva versión en **Deploy > Manage deployments**. Edita el despliegue web existente para apuntarlo a esa versión; su URL se conserva.
## Datos del evento

- Vanesa Jorgina Soruco Alfaro y Mauricio Sarabia Malpartida.
- Viernes 27 de noviembre de 2026, 19:00, Tarija Cercado (`America/La_Paz`).
- Iglesia: [Parroquia Ntra. Sra. del Perpetuo Socorro](https://maps.app.goo.gl/j7eoBXMUaYjf6duv7).
- Recepción: [Calle Lazcano entre Ciro Trigo y Delfín Pinos](https://maps.app.goo.gl/mmvfCWdXpA49h3T57).
- Álbum: [Google Photos](https://photos.app.goo.gl/ubVgjGYdmdxHuKRQ8).
