const ALLOWED_ORIGINS = new Set([
  "https://sorucojorge.github.io",
  "http://localhost",
  "http://127.0.0.1",
]);
const CALLBACK_PATTERN = /^weddingCallback_[A-Za-z0-9_]+$/;
const TOKEN_PATTERN = /^[a-f0-9]{36}$/;
const ACTIONS = new Set(["guest", "messages"]);
const POST_ACTIONS = new Set(["rsvp", "song", "message"]);

function jsonp(callback, result, status = 200) {
  const body = `${callback}(${JSON.stringify(result).replace(/</g, "\\u003c")});`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function postMessagePage(requestId, result, status = 200) {
  const data = JSON.stringify({ source: "wedding-api", requestId, result }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.parent.postMessage(${data}, "*");</script></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function getUpstreamUrl(env) {
  if (!env.APPS_SCRIPT_URL) throw new Error("Falta configurar APPS_SCRIPT_URL en el Worker.");
  const endpoint = new URL(env.APPS_SCRIPT_URL);
  if (endpoint.protocol !== "https:" || endpoint.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint.pathname)) {
    throw new Error("APPS_SCRIPT_URL debe ser la URL /macros/s/.../exec de la implementación.");
  }
  return endpoint;
}

async function handleGet(request, env) {
  const parameters = new URL(request.url).searchParams;
  const action = parameters.get("action");
  const callback = parameters.get("callback") || "";
  if (!CALLBACK_PATTERN.test(callback)) return new Response("/* Invalid callback */", { status: 400 });
  if (!ACTIONS.has(action)) return jsonp(callback, { ok: false, error: "Acción no disponible." }, 400);
  if (action === "guest" && !TOKEN_PATTERN.test(parameters.get("token") || "")) {
    return jsonp(callback, { ok: false, error: "Token no válido." }, 400);
  }

  try {
    const upstreamUrl = getUpstreamUrl(env);
    for (const key of ["action", "callback", "token", "_"]) {
      const value = parameters.get(key);
      if (value !== null) upstreamUrl.searchParams.set(key, value);
    }
    const upstream = await fetch(upstreamUrl, { redirect: "follow", cache: "no-store" });
    const body = await upstream.text();
    if (!upstream.ok) return jsonp(callback, { ok: false, error: "El servicio de invitaciones no está disponible." }, 502);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return jsonp(callback, { ok: false, error: "No se pudo consultar el servicio de invitaciones." }, 502);
  }
}

async function handlePost(request, env) {
  let requestId = "";
  try {
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 16384) throw new Error("La solicitud es demasiado larga.");
    const encodedBody = await request.text();
    if (encodedBody.length > 16384) throw new Error("La solicitud es demasiado larga.");
    const parameters = new URLSearchParams(encodedBody);
    const rawPayload = parameters.get("payload") || "{}";
    if (rawPayload.length > 4096) throw new Error("La solicitud es demasiado larga.");
    const payload = JSON.parse(rawPayload);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Solicitud no válida.");
    requestId = typeof payload.requestId === "string" && /^request_[A-Za-z0-9_-]{8,100}$/.test(payload.requestId) ? payload.requestId : "";
    if (!requestId) throw new Error("Identificador de solicitud no válido.");
    if (!POST_ACTIONS.has(payload.action) || !TOKEN_PATTERN.test(payload.token || "")) throw new Error("Solicitud no válida.");

    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) throw new Error("Origen no autorizado.");

    const upstreamUrl = getUpstreamUrl(env);
    const upstreamBody = new URLSearchParams({ payload: rawPayload });
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: upstreamBody.toString(),
      redirect: "follow",
      cache: "no-store",
    });
    const html = await upstream.text();
    if (!upstream.ok) throw new Error("El servicio de invitaciones no pudo guardar la respuesta.");

    // Apps Script returns a small HTML page that posts the result to this form's iframe.
    // Return only that trusted response body, without Google account cookies or framing headers.
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return postMessagePage(requestId, { ok: false, error: error.message || "No se pudo guardar la respuesta." }, requestId ? 200 : 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/" && url.pathname !== "/api") return new Response("No encontrado", { status: 404 });
    if (request.method === "GET") return handleGet(request, env);
    if (request.method === "POST") return handlePost(request, env);
    return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, POST" } });
  },
};