const SHEET_NAMES = { guests: "Invitados", rsvp: "Confirmaciones", songs: "Canciones", messages: "Dedicatorias" };

function setupWeddingSheet() {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const definitions = [
		[SHEET_NAMES.guests, ["Token", "Nombre", "Cupos"]],
		[SHEET_NAMES.rsvp, ["Fecha", "Token", "Invitación", "Asistencia", "Personas"]],
		[SHEET_NAMES.songs, ["Fecha", "Token", "Invitación", "Canción"]],
		[SHEET_NAMES.messages, ["Fecha", "Token", "Invitación", "Mensaje", "Estado"]],
	];
	definitions.forEach(([name, headers]) => {
		let sheet = spreadsheet.getSheetByName(name);
		if (!sheet) sheet = spreadsheet.insertSheet(name);
		if (sheet.getLastRow() === 0) { sheet.appendRow(headers); sheet.setFrozenRows(1); }
	});
}

function doGet(event) {
	const parameters = event.parameter || {};
	const callback = parameters.callback || "";
	if (!/^weddingCallback_[A-Za-z0-9_]+$/.test(callback)) return ContentService.createTextOutput("/* Invalid callback */").setMimeType(ContentService.MimeType.JAVASCRIPT);
	let result;
	try {
		if (parameters.action === "guest") {
			const guest = findGuest_(parameters.token);
			result = guest ? { ok: true, name: guest.name, cupos: guest.cupos } : { ok: false };
		} else if (parameters.action === "messages") {
			const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.messages);
			const rows = !sheet || sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
			const messages = rows.filter((row) => String(row[4]).trim().toUpperCase() === "APROBADO").slice(-40).map((row) => ({ nombre: String(row[2]), mensaje: String(row[3]) }));
			result = { ok: true, messages: messages };
		} else result = { ok: false, error: "Acción no disponible." };
	} catch (error) { result = { ok: false, error: "No se pudo consultar la hoja." }; }
	const serialized = JSON.stringify(result).replace(/</g, "\\u003c");
	return ContentService.createTextOutput(callback + "(" + serialized + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(event) {
	let payload = {};
	let result;
	try {
		const rawPayload = String((event.parameter && event.parameter.payload) || "{}");
		if (rawPayload.length > 4096) throw new Error("La solicitud es demasiado larga.");
		const decoded = JSON.parse(rawPayload);
		if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("Solicitud no válida.");
		payload = decoded;
		const guest = findGuest_(payload.token);
		if (!guest) throw new Error("No encontramos esta invitación.");
		if (payload.action === "rsvp") {
			enforceRateLimit_(guest.token, "rsvp", 8, 3600);
			saveRsvp_(guest, payload);
			result = { ok: true };
		} else if (payload.action === "song") {
			enforceRateLimit_(guest.token, "song", 20, 3600);
			const song = String(payload.cancion || "").trim();
			if (!song || song.length > 120) throw new Error("La canción debe tener entre 1 y 120 caracteres.");
			const songsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.songs);
			songsSheet.appendRow([new Date(), guest.token, safeSheetText_(guest.name, 120), safeSheetText_(song, 120)]);
			result = { ok: true };
		} else if (payload.action === "message") {
			enforceRateLimit_(guest.token, "message", 5, 3600);
			const message = String(payload.mensaje || "").trim();
			if (!message || message.length > 280) throw new Error("El mensaje debe tener entre 1 y 280 caracteres.");
			SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.messages).appendRow([new Date(), guest.token, safeSheetText_(guest.name, 120), safeSheetText_(message, 280), "PENDIENTE"]);
			result = { ok: true };
		} else throw new Error("Acción no disponible.");
	} catch (error) { result = { ok: false, error: error.message || "No se pudo guardar la respuesta." }; }
	const message = JSON.stringify({ source: "wedding-api", requestId: String(payload.requestId || ""), result: result }).replace(/</g, "\\u003c");
	return HtmlService.createHtmlOutput("<script>window.parent.postMessage(" + message + ", '*');</script>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function findGuest_(token) {
	if (typeof token !== "string" || !/^[a-f0-9]{36}$/.test(token)) return null;
	const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.guests);
	if (!sheet || sheet.getLastRow() < 2) return null;
	const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
	const row = rows.find((item) => String(item[0]) === token);
	if (!row) return null;
	const cupos = Number(row[2]);
	if (!String(row[1]).trim() || !Number.isInteger(cupos) || cupos < 1 || cupos > 2) return null;
	return { token: String(row[0]), name: String(row[1]), cupos: cupos };
}

function saveRsvp_(guest, payload) {
	const attendance = payload.asistencia === "yes" ? "Sí" : payload.asistencia === "no" ? "No" : "";
	const count = attendance === "Sí" ? Number(payload.cantidad) : 0;
	if (!attendance || !Number.isInteger(count) || count < 0 || count > guest.cupos || (attendance === "Sí" && count < 1)) throw new Error("La cantidad de asistentes no coincide con los pases de esta invitación.");
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(SHEET_NAMES.rsvp);
	const values = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
	const existingIndex = values.findIndex((row) => String(row[0]) === guest.token);
	const rowValues = [new Date(), guest.token, safeSheetText_(guest.name, 120), attendance, count];
	if (existingIndex < 0) sheet.appendRow(rowValues);
	else sheet.getRange(existingIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
}

function safeSheetText_(value, maxLength) {
	const text = String(value || "").trim().slice(0, maxLength);
	return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? "'" + text : text;
}

function enforceRateLimit_(token, action, maxRequests, windowSeconds) {
	const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token + ":" + action);
	const cacheKey = "rate_" + Utilities.base64EncodeWebSafe(digest).slice(0, 32);
	const cache = CacheService.getScriptCache();
	const lock = LockService.getScriptLock();
	lock.waitLock(5000);
	try {
		const count = Number(cache.get(cacheKey) || 0);
		if (count >= maxRequests) throw new Error("Se alcanzó el límite de envíos. Espera un momento y vuelve a intentar.");
		cache.put(cacheKey, String(count + 1), windowSeconds);
	} finally {
		lock.releaseLock();
	}
}
