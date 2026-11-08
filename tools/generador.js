const guestInput = document.querySelector("#guest-list");
const siteInput = document.querySelector("#site-url");
const results = document.querySelector("#results");
const status = document.querySelector("#status");
const downloadButton = document.querySelector("#download-csv");
let generatedGuests = [];
const tokenStorageKey = "vanesa-mauricio-invitation-tokens";
let savedTokens = {};
try { savedTokens = JSON.parse(localStorage.getItem(tokenStorageKey) || "{}"); } catch { savedTokens = {}; }

function createToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function tokenForName(name) {
	const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
	if (!savedTokens[key]) savedTokens[key] = createToken();
	try { localStorage.setItem(tokenStorageKey, JSON.stringify(savedTokens)); } catch { /* El CSV sirve de copia de respaldo. */ }
	return savedTokens[key];
}

function escapeCsv(value) {
	let text = String(value);
	if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = "'" + text;
	return `"${text.replaceAll('"', '""')}"`;
}

document.querySelector("#generate").addEventListener("click", () => {
	const baseUrl = siteInput.value.trim();
	const rows = guestInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	if (!baseUrl || !URL.canParse(baseUrl)) { status.textContent = "Escribe la dirección completa del sitio publicado."; return; }
	const parsedBase = new URL(baseUrl);
	const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsedBase.hostname);
	if (parsedBase.username || parsedBase.password || (parsedBase.protocol !== "https:" && !(parsedBase.protocol === "http:" && localHost))) {
		status.textContent = "Usa la URL HTTPS de GitHub Pages (HTTP solo está permitido en localhost).";
		return;
	}
	if (!rows.length) { status.textContent = "Agrega al menos una invitación."; return; }
	let parsed;
	try {
		parsed = rows.map((line, index) => {
			const [rawName, rawLimit] = line.split("|");
			const name = rawName.trim();
			const cupos = Number((rawLimit || "1").trim());
			if (!name || name.length > 120 || ![1, 2].includes(cupos)) throw new Error(`Revisa la línea ${index + 1}: usa nombre | 1 o nombre | 2.`);
			return { token: tokenForName(name), name, cupos };
		});
	} catch (error) { status.textContent = error.message; return; }

	generatedGuests = parsed;
	const base = new URL(baseUrl);
	base.search = "";
	base.hash = "";
	results.replaceChildren();
	parsed.forEach((guest) => {
		const inviteUrl = new URL(base.href);
		inviteUrl.searchParams.set("i", guest.token);
		const row = document.createElement("div");
		row.className = "result-row";
		const details = document.createElement("div");
		const name = document.createElement("strong");
		name.textContent = guest.name;
		const link = document.createElement("a");
		link.href = inviteUrl.href;
		link.textContent = inviteUrl.href;
		const limit = document.createElement("small");
		limit.textContent = `${guest.cupos} ${guest.cupos === 1 ? "pase" : "pases"}`;
		details.append(name, link, limit);
		const copy = document.createElement("button");
		copy.type = "button";
		copy.textContent = "Copiar enlace";
		copy.addEventListener("click", async () => {
			try { await navigator.clipboard.writeText(inviteUrl.href); copy.textContent = "Copiado"; }
			catch { status.textContent = "No se pudo copiar automáticamente. Selecciona y copia el enlace."; }
		});
		row.append(details, copy);
		results.append(row);
	});
	downloadButton.disabled = false;
	status.textContent = `${parsed.length} enlaces generados. Descarga el CSV e impórtalo en la pestaña Invitados de Google Sheets.`;
});

downloadButton.addEventListener("click", () => {
	const lines = [["Token", "Nombre", "Cupos"], ...generatedGuests.map(({ token, name, cupos }) => [token, name, cupos])];
	const csv = lines.map((row) => row.map(escapeCsv).join(";")).join("\r\n");
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
	link.download = "invitados.csv";
	link.click();
	URL.revokeObjectURL(link.href);
});
