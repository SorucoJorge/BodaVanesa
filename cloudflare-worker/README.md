# API gateway de la invitación

Este Worker sirve de intermediario entre GitHub Pages y Apps Script. En los envíos POST, Apps Script devuelve JSON y el Worker genera la página de confirmación para el iframe. El navegador se conecta a `workers.dev`; el Worker consulta Apps Script desde el servidor, sin usar la sesión de Google de quien abre la invitación.

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

## Actualizar el formato de respuesta y activar confirmaciones

Para que las confirmaciones se entreguen al navegador, el Worker y Apps Script deben usar el nuevo formato JSON. Actualiza ambos servicios:

1. Copia `apps-script/Code.gs` al editor de Apps Script. Ve a **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**.
2. En Cloudflare, abre el Worker y **Edit code**. Reemplaza el código por el `worker.js` actualizado de esta carpeta y selecciona **Deploy**.

La URL de implementación de Apps Script se mantiene igual; no cambies `APPS_SCRIPT_URL`.

## Activación en el sitio

El sitio ya está configurado con la dirección `workers.dev` en `config.js`. Desde ese momento, consultas y envíos van por el Worker.

El Worker solo reenvía las acciones `guest`, `messages`, `rsvp`, `song` y `message`; valida el formato del token y el callback; y limita las acciones, el formato y tamaño de cada solicitud. La identidad se valida por el token de invitación en Apps Script, que conserva sus límites por invitado.