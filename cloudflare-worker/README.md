# API gateway de la invitación

Este Worker sirve de intermediario entre GitHub Pages y Apps Script. El navegador se conecta a `workers.dev`; el Worker consulta Apps Script desde el servidor, sin usar la sesión de Google de quien abre la invitación.

## Publicación desde Cloudflare

1. Inicia sesión en Cloudflare y abre **Workers & Pages**.
2. Selecciona **Create application** y luego **Create Worker**. Ponle un nombre como `boda-vanesa-api`.
3. Abre **Edit code**, reemplaza el ejemplo por el contenido de `worker.js` y selecciona **Deploy**.
4. En el Worker, abre **Settings → Variables and Secrets → Add**. Añade una variable de texto:
   - Name: `APPS_SCRIPT_URL`
   - Value: la URL de implementación que aparece en `config.js`, con formato `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`.

   No uses una URL con `/u/3/` ni una URL `script.googleusercontent.com/macros/echo`.
5. Guarda la variable y vuelve a seleccionar **Deploy**.
6. Copia la dirección pública del Worker, con formato `https://boda-vanesa-api.TU-SUBDOMINIO.workers.dev`.

Cloudflare explica dónde crear el Worker en su [guía del panel](https://developers.cloudflare.com/workers/get-started/dashboard/) y dónde añadir variables en [Variables de entorno](https://developers.cloudflare.com/workers/configuration/environment-variables/).

## Activación en el sitio

El sitio mantiene Apps Script como respaldo hasta activar el gateway. Cuando tengas la dirección `workers.dev`, colócala como `apiGatewayUrl` en `config.js` (sin una barra final), y publica los cambios del repositorio. Desde ese momento, consultas y envíos irán por el Worker.

El Worker solo reenvía las acciones `guest`, `messages`, `rsvp`, `song` y `message`; valida el formato del token y el callback; y limita las acciones, el formato y tamaño de cada solicitud. La identidad se valida por el token de invitación en Apps Script, que conserva sus límites por invitado.