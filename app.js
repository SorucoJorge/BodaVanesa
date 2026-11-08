const targetDate = new Date("2026-11-27T19:00:00-04:00");
const apiUrl = window.WEDDING_CONFIG?.appsScriptUrl || "";
const inviteToken = new URLSearchParams(location.search).get("i");
const envelopeScreen = document.querySelector("#envelope-screen");
const envelopeButton = document.querySelector("#music-toggle");
const musicButton = envelopeButton;
const weddingAudio = document.querySelector("#wedding-audio");
let invitationOpened = false;

function setMusicStatus(text) {
  const status = document.querySelector("#music-status");
  if (status) status.textContent = text;
}

function setMusicState(isPlaying, statusText) {
  const icon = document.querySelector("#music-icon");
  musicButton.setAttribute("aria-pressed", String(isPlaying));
  if (icon) icon.textContent = isPlaying ? "❚❚" : "▶";
  if (statusText) setMusicStatus(statusText);
}
function playWeddingSong() {
  setMusicState(false, "Cargando canción…");
  const playback = weddingAudio.play();
  if (playback && typeof playback.then === "function") {
    playback.then(() => setMusicState(true)).catch(() => {
      setMusicState(false, "MP3 no disponible");
      document.querySelector("#envelope-note").textContent = "No se pudo cargar la canción. Comprueba assets/music/photograph.mp3.";
    });
  }
}

function openInvitation() {
  if (invitationOpened) return;
  invitationOpened = true;
  envelopeScreen.classList.add("is-opening");
  envelopeScreen.setAttribute("aria-hidden", "true");
  document.body.classList.add("invitation-open");
  document.querySelector("#topbar-actions").append(envelopeButton);
  envelopeButton.className = "music-toggle music-toggle-header";
  envelopeButton.setAttribute("aria-pressed", "false");
  envelopeButton.innerHTML = '<span class="music-icon" id="music-icon" aria-hidden="true">▶</span><span class="music-status" id="music-status">Photograph · Ed Sheeran</span>';
  setMusicState(false);
  playWeddingSong();
  window.setTimeout(() => envelopeScreen.remove(), 1250);
}

musicButton.addEventListener("click", () => {
  if (!invitationOpened) { openInvitation(); return; }
  if (weddingAudio.paused) playWeddingSong();
  else weddingAudio.pause();
});

weddingAudio.addEventListener("play", () => setMusicState(true));
weddingAudio.addEventListener("pause", () => setMusicState(false));
weddingAudio.addEventListener("ended", () => setMusicState(false));
weddingAudio.addEventListener("error", () => {
  setMusicState(false, "MP3 no disponible");
  document.querySelector("#envelope-note").textContent = "No se encontró assets/music/photograph.mp3.";
});

function showStatus(element, text, isError = false) { element.textContent = text; element.dataset.error = String(isError); }

function apiGet(parameters) {
  return new Promise((resolve, reject) => {
    const callback = `weddingCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(new Error("Tiempo de espera agotado.")), 15000);
    const finish = (error, result) => { window.clearTimeout(timeout); delete window[callback]; script.remove(); error ? reject(error) : resolve(result); };
    window[callback] = (result) => finish(null, result);
    script.onerror = () => finish(new Error("No se pudo cargar Google Apps Script. El navegador o la red podrían estar bloqueando script.google.com; prueba otra red o desactiva temporalmente bloqueadores."));
    script.src = `${apiUrl}?${new URLSearchParams({ ...parameters, callback })}`;
    document.head.append(script);
  });
}

function apiPost(payload) {
  return new Promise((resolve, reject) => {
    const requestId = `request_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement("iframe");
    const form = document.createElement("form");
    const timeout = window.setTimeout(() => finish(new Error("No recibimos la confirmación del servidor. La información podría haberse guardado; revisa antes de volver a enviarla.")), 30000);
    const finish = (error, result) => { window.clearTimeout(timeout); window.removeEventListener("message", onMessage); frame.remove(); form.remove(); error ? reject(error) : resolve(result); };
    const onMessage = (event) => {
      if (event.source !== frame.contentWindow || event.data?.source !== "wedding-api" || event.data?.requestId !== requestId) return;
      finish(null, event.data.result);
    };
    frame.name = requestId;
    frame.hidden = true;
    form.method = "POST";
    form.action = apiUrl;
    form.target = requestId;
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "payload";
    field.value = JSON.stringify({ ...payload, requestId });
    form.append(field);
    window.addEventListener("message", onMessage);
    document.body.append(frame, form);
    form.submit();
  });
}

function updateCountdown() {
  const totalSeconds = Math.max(0, Math.floor((targetDate.getTime() - Date.now()) / 1000));
  const values = { days: Math.floor(totalSeconds / 86400), hours: Math.floor(totalSeconds % 86400 / 3600), minutes: Math.floor(totalSeconds % 3600 / 60), seconds: totalSeconds % 60 };
  Object.entries(values).forEach(([unit, value]) => {
    const node = document.querySelector(`[data-time="${unit}"]`);
    node.textContent = unit === "days" ? String(value).padStart(3, "0") : String(value).padStart(2, "0");
  });
}
updateCountdown();
window.setInterval(updateCountdown, 1000);

const gallery = document.querySelector("#gallery");
const galleryViewer = document.querySelector("#gallery-viewer");
const galleryControls = document.querySelector(".gallery-controls");
const galleryPrevious = document.querySelector("#gallery-prev");
const galleryNext = document.querySelector("#gallery-next");
const galleryFullscreen = document.querySelector("#gallery-fullscreen");
const photoUrls = Array.from({ length: 11 }, (_, index) => `assets/photos/${index + 1}.jpg`);
let loadedPhotos = [];
let currentPhoto = 0;
let activeLayer = 0;
let galleryTimer;
let galleryTransitioning = false;
let queuedGallerySteps = 0;

async function loadGallery() {
  const found = await Promise.all(photoUrls.map((url) => new Promise((resolve) => {
    const image = new Image(); image.onload = () => resolve(url); image.onerror = () => resolve(null); image.src = url;
  })));
  loadedPhotos = found.filter(Boolean);
  gallery.replaceChildren();
  if (!loadedPhotos.length) {
    const empty = document.createElement("div"); empty.className = "gallery-empty";
    empty.setAttribute("aria-label", "No hay fotos disponibles");
    gallery.append(empty); galleryControls.hidden = true; return;
  }
  const firstLayer = document.createElement("img");
  const secondLayer = document.createElement("img");
  firstLayer.className = "gallery-image is-active";
  firstLayer.src = loadedPhotos[0];
  firstLayer.alt = "Recuerdo de Vanesa y Mauricio";
  firstLayer.dataset.layer = "0";
  secondLayer.className = "gallery-image";
  secondLayer.alt = "";
  secondLayer.dataset.layer = "1";
  secondLayer.setAttribute("aria-hidden", "true");
  gallery.append(firstLayer, secondLayer);
  galleryPrevious.disabled = loadedPhotos.length < 2;
  galleryNext.disabled = loadedPhotos.length < 2;
  restartGalleryTimer();
}

function restartGalleryTimer() {
  window.clearInterval(galleryTimer);
  if (loadedPhotos.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    galleryTimer = window.setInterval(() => showGalleryPhoto(1), 5000);
  }
}

async function showGalleryPhoto(direction, queueIfBusy = false) {
  if (loadedPhotos.length < 2) return;
  if (galleryTransitioning) {
    if (queueIfBusy) queuedGallerySteps += direction;
    return;
  }
  galleryTransitioning = true;
  const nextPhoto = (currentPhoto + direction + loadedPhotos.length) % loadedPhotos.length;
  const outgoing = gallery.querySelector(`[data-layer="${activeLayer}"]`);
  const incomingLayer = 1 - activeLayer;
  const incoming = gallery.querySelector(`[data-layer="${incomingLayer}"]`);
  incoming.className = `gallery-image enter-from-${direction > 0 ? "next" : "prev"}`;
  incoming.src = loadedPhotos[nextPhoto];
  incoming.alt = "Recuerdo de Vanesa y Mauricio";
  incoming.removeAttribute("aria-hidden");
  await new Promise((resolve) => window.setTimeout(resolve, 40));
  outgoing.classList.add(direction > 0 ? "leave-to-prev" : "leave-to-next");
  incoming.classList.remove("enter-from-next", "enter-from-prev");
  incoming.classList.add("is-active");
  outgoing.classList.remove("is-active");
  currentPhoto = nextPhoto;
  activeLayer = incomingLayer;
  window.setTimeout(() => {
    outgoing.classList.remove("leave-to-prev", "leave-to-next");
    outgoing.src = "";
    outgoing.alt = "";
    outgoing.setAttribute("aria-hidden", "true");
    galleryTransitioning = false;
    if (queuedGallerySteps) {
      const queuedStep = Math.sign(queuedGallerySteps);
      queuedGallerySteps -= queuedStep;
      showGalleryPhoto(queuedStep);
    }
  }, 720);
}

loadGallery();
galleryPrevious.addEventListener("click", () => { showGalleryPhoto(-1, true); restartGalleryTimer(); });
galleryNext.addEventListener("click", () => { showGalleryPhoto(1, true); restartGalleryTimer(); });

function updateFullscreenControl() {
  const isFullscreen = document.fullscreenElement === galleryViewer || document.webkitFullscreenElement === galleryViewer || galleryViewer.classList.contains("is-fullscreen-fallback");
  galleryFullscreen.textContent = isFullscreen ? "×" : "⛶";
  galleryFullscreen.setAttribute("aria-label", isFullscreen ? "Salir de pantalla completa" : "Abrir carrusel en pantalla completa");
  galleryFullscreen.title = isFullscreen ? "Salir de pantalla completa" : "Pantalla completa";
}

function setGalleryFullscreenFallback(enabled) {
  galleryViewer.classList.toggle("is-fullscreen-fallback", enabled);
  document.body.classList.toggle("gallery-fullscreen-open", enabled);
}

galleryFullscreen.addEventListener("click", async () => {
  try {
    if (galleryViewer.classList.contains("is-fullscreen-fallback")) {
      setGalleryFullscreenFallback(false);
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else document.webkitExitFullscreen?.();
    } else if (galleryViewer.requestFullscreen) {
      await galleryViewer.requestFullscreen();
      if (document.fullscreenElement !== galleryViewer) setGalleryFullscreenFallback(true);
    } else if (galleryViewer.webkitRequestFullscreen) {
      galleryViewer.webkitRequestFullscreen();
      if (document.webkitFullscreenElement !== galleryViewer) setGalleryFullscreenFallback(true);
    } else setGalleryFullscreenFallback(true);
  } catch {
    setGalleryFullscreenFallback(true);
  }
  updateFullscreenControl();
});
document.addEventListener("fullscreenchange", updateFullscreenControl);
document.addEventListener("webkitfullscreenchange", updateFullscreenControl);

const guestName = document.querySelector("#guest-name");
const guestFields = document.querySelector("#guest-form-fields");
const guestLoading = document.querySelector("#guest-loading");
const guestMissing = document.querySelector("#guest-missing");
const attendance = document.querySelector("#attendance");
const partyWrap = document.querySelector("#party-size-wrap");
const partySize = document.querySelector("#party-size");

function showGuest(name, maximum) {
  document.querySelector("#guest-name").value = name;
  const select = document.querySelector("#party-size");
  select.replaceChildren(...Array.from({ length: maximum }, (_, index) => new Option(String(index + 1), String(index + 1))));
  document.querySelector("#guest-loading").hidden = true;
  document.querySelector("#guest-missing").hidden = true;
  document.querySelector("#guest-form-fields").hidden = false;
}

async function loadGuest() {
  const retryButton = document.querySelector("#retry-guest");
  const errorText = document.querySelector("#guest-error-text");
  if (!inviteToken || !apiUrl) {
    guestLoading.hidden = true;
    document.querySelector("#guest-missing").hidden = false;
    retryButton.hidden = true;
    return;
  }
  guestLoading.hidden = false;
  document.querySelector("#guest-missing").hidden = true;
  guestLoading.textContent = "Cargando los datos de esta invitación…";
  retryButton.hidden = true;
  try {
    const result = await apiGet({ action: "guest", token: inviteToken, _: Date.now() });
    if (!result.ok || !result.name || !Number(result.cupos)) throw new Error("No encontramos los datos de esta invitación.");
    showGuest(result.name, Number(result.cupos));
  } catch (error) {
    guestLoading.hidden = true;
    document.querySelector("#guest-missing").hidden = false;
    errorText.textContent = `${error.message || "No se pudieron cargar los datos."} Comprueba tu conexión y vuelve a intentar.`;
    retryButton.hidden = false;
  }
}

document.querySelector("#retry-guest").addEventListener("click", loadGuest);
loadGuest();
attendance.addEventListener("change", () => { partyWrap.hidden = attendance.value !== "yes"; partySize.required = attendance.value === "yes"; });

document.querySelector("#rsvp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#rsvp-status");
  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  if (!apiUrl || !inviteToken) { showStatus(status, "Abre el enlace personalizado para confirmar tu asistencia.", true); return; }
  const formData = new FormData(event.currentTarget);
  const payload = { action: "rsvp", token: inviteToken, asistencia: formData.get("attendance"), cantidad: formData.get("attendance") === "yes" ? Number(formData.get("partySize")) : 0 };
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Enviando…";
  showStatus(status, "Enviando tu confirmación…");
  try {
    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error || "No se pudo guardar la respuesta.");
    showStatus(status, "¡Confirmación enviada correctamente! Gracias por responder.");
  } catch (error) { showStatus(status, error.message || "No se pudo enviar. Intenta de nuevo.", true); }
  finally { submitButton.disabled = false; submitButton.textContent = originalLabel; }
});
const messageInput = document.querySelector("#message");
messageInput.addEventListener("input", () => { document.querySelector("#message-length").textContent = `${messageInput.value.length} / 280`; });

async function loadMessages() {
  if (!apiUrl) return;
  try {
    const result = await apiGet({ action: "messages" });
    if (!result.ok) return;
    const list = document.querySelector("#messages-list");
    list.replaceChildren();
    result.messages.forEach(({ nombre, mensaje }) => {
      const item = document.createElement("article");
      item.className = "guest-message";
      const text = document.createElement("p");
      text.textContent = mensaje;
      const author = document.createElement("span");
      author.textContent = nombre;
      item.append(text, author);
      list.append(item);
    });
  } catch { /* La sección permanece vacía si Sheets no responde. */ }
}
loadMessages();

document.querySelector("#message-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#message-status");
  const message = messageInput.value.trim();
  if (!inviteToken || !apiUrl) { showStatus(status, "Abre el enlace personalizado para dejar tu dedicatoria.", true); return; }
  if (!message) return;
  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Enviando…";
  showStatus(status, "Enviando tu dedicatoria…");
  try {
    const result = await apiPost({ action: "message", token: inviteToken, mensaje: message });
    if (!result.ok) throw new Error(result.error || "No se pudo enviar el mensaje.");
    messageInput.value = "";
    document.querySelector("#message-length").textContent = "0 / 280";
    showStatus(status, "¡Dedicatoria enviada! Quedó pendiente de revisión.");
  } catch (error) { showStatus(status, error.message || "No se pudo enviar. Intenta de nuevo.", true); }
  finally { submitButton.disabled = false; submitButton.textContent = originalLabel; }
});
const songInput = document.querySelector("#song");
document.querySelector("#song-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#song-status");
  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  const song = songInput.value.trim();
  if (!inviteToken || !apiUrl) { showStatus(status, "Abre el enlace personalizado para sugerir una canción.", true); return; }
  if (!song || song.length > 120) return;
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Enviando…";
  showStatus(status, "Enviando tu canción…");
  try {
    const result = await apiPost({ action: "song", token: inviteToken, cancion: song });
    if (!result.ok) throw new Error(result.error || "No se pudo guardar la canción.");
    songInput.value = "";
    showStatus(status, "¡Canción enviada! Puedes sugerir más cuando quieras.");
  } catch (error) { showStatus(status, error.message || "No se pudo enviar. Intenta de nuevo.", true); }
  finally { submitButton.disabled = false; submitButton.textContent = originalLabel; }
});
const cameraDialog = document.querySelector("#camera-dialog");
const cameraVideo = document.querySelector("#camera-video");
const cameraCanvas = document.querySelector("#camera-canvas");
const cameraOverlay = document.querySelector(".camera-overlay");
const takePhotoButton = document.querySelector("#take-photo");
const discardPhotoButton = document.querySelector("#discard-photo");
const downloadPhoto = document.querySelector("#download-photo");
const cameraFrameOverlay = document.querySelector("#camera-frame-overlay");
const previewFrameOverlay = document.querySelector("#frame-preview-overlay");
const cameraStage = document.querySelector(".camera-stage");
const cameraTools = document.querySelector("#camera-tools");
const switchCameraButton = document.querySelector("#switch-camera");
const frameOrientationButton = document.querySelector("#toggle-frame-orientation");
const framePreview = document.querySelector(".frame-inner");
const frameAssetPaths = {
  portrait: "assets/frames/marco-vertical.png",
  landscape: "assets/frames/marco-horizontal.png",
};
const frameOpenings = {
  portrait: { x: .118, y: .21, width: .766, height: .67 },
  landscape: { x: .128, y: .266, width: .744, height: .531 },
};
const frameImageCache = new Map();
let cameraStream;
let capturedPhotoUrl;
let cameraFacingMode = "user";
let frameOrientationMode = "portrait";
let activeFrameOrientation = "portrait";

function getFrameOrientation(width, height) {
  return width > height ? "landscape" : "portrait";
}

function getFrameImage(orientation) {
  if (!frameImageCache.has(orientation)) {
    frameImageCache.set(orientation, (async () => {
      const loadImageElement = (source) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = source;
      });
      try {
        const response = await fetch(frameAssetPaths[orientation], { cache: "force-cache", credentials: "same-origin" });
        if (response.ok) {
          const frameBlob = await response.blob();
          if (window.createImageBitmap) {
            try { return await createImageBitmap(frameBlob); } catch { /* Algunos móviles no decodifican estos PNG con createImageBitmap. */ }
          }
          const imageUrl = URL.createObjectURL(frameBlob);
          try {
            const blobImage = await loadImageElement(imageUrl);
            if (blobImage) return blobImage;
          } finally {
            URL.revokeObjectURL(imageUrl);
          }
        }
      } catch { /* Prueba la ruta local directamente como último fallback. */ }
      const directImage = await loadImageElement(frameAssetPaths[orientation]);
      return directImage?.naturalWidth && directImage?.naturalHeight ? directImage : null;
    })());
  }
  return frameImageCache.get(orientation);
}

function getFrameDimensions(frameImage) {
  return {
    width: frameImage?.width || frameImage?.naturalWidth || 0,
    height: frameImage?.height || frameImage?.naturalHeight || 0,
  };
}

function getSelectedFrameOrientation() {
  return frameOrientationMode;
}

function updateFrameOrientationButton() {
  const labels = { portrait: "Marco: parado", landscape: "Marco: echado" };
  frameOrientationButton.textContent = labels[frameOrientationMode];
  frameOrientationButton.setAttribute("aria-label", "Cambiar orientación del marco. Actual: " + labels[frameOrientationMode].replace("Marco: ", "") + ".");
}

async function setFrameOrientation(orientation) {
  if (!frameAssetPaths[orientation]) return null;
  const frameImage = await getFrameImage(orientation);
  activeFrameOrientation = orientation;
  cameraOverlay.dataset.orientation = orientation;
  cameraOverlay.classList.toggle("has-frame-asset", Boolean(frameImage));
  cameraStage.dataset.frameOrientation = orientation;
  cameraOverlay.hidden = !frameImage;
  cameraFrameOverlay.hidden = !frameImage;
  if (frameImage) cameraFrameOverlay.src = frameAssetPaths[orientation];
  return frameImage;
}

async function setPreviewFrame() {
  const frameImage = await getFrameImage("portrait");
  framePreview.classList.toggle("has-frame-asset", Boolean(frameImage));
  framePreview.dataset.orientation = "portrait";
  framePreview.hidden = !frameImage;
  previewFrameOverlay.hidden = !frameImage;
  if (frameImage) previewFrameOverlay.src = frameAssetPaths.portrait;
}

setPreviewFrame();
updateFrameOrientationButton();

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  cameraVideo.srcObject = null;
}

function handleCameraTrackEnded() {
  if (!cameraStream || !cameraDialog.open) return;
  stopCamera();
  cameraVideo.hidden = false;
  cameraCanvas.hidden = true;
  cameraOverlay.hidden = true;
  takePhotoButton.disabled = false;
  takePhotoButton.textContent = "Reintentar cámara";
  document.querySelector("#camera-help").textContent = "La cámara se desconectó. Pulsa Reintentar cámara para volver a abrirla.";
}

function clearCapturedPhoto() {
  if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
  capturedPhotoUrl = undefined;
  downloadPhoto.removeAttribute("href");
  downloadPhoto.hidden = true;
  discardPhotoButton.hidden = true;
  takePhotoButton.hidden = false;
  takePhotoButton.disabled = true;
  cameraTools.hidden = false;
  takePhotoButton.textContent = "Conectando cámara…";
  cameraVideo.hidden = false;
  cameraCanvas.hidden = true;
  cameraOverlay.hidden = false;
}

function waitForCameraMetadata(video, timeoutMs = 10000) {
  if (video.videoWidth && video.videoHeight) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("La cámara no respondió a tiempo.")), timeoutMs);
    const finish = (error) => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onError);
      error ? reject(error) : resolve();
    };
    const onReady = () => finish();
    const onError = () => finish(new Error("No se pudo leer el video de la cámara."));
    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function getCameraPhotoSource() {
  const videoTrack = cameraStream?.getVideoTracks().find((track) => track.readyState === "live");
  if (videoTrack && "ImageCapture" in window) {
    try {
      const photoBlob = await new ImageCapture(videoTrack).takePhoto();
      if (window.createImageBitmap) return await createImageBitmap(photoBlob);
      const photoUrl = URL.createObjectURL(photoBlob);
      try {
        const photoImage = new Image();
        photoImage.src = photoUrl;
        await photoImage.decode();
        return photoImage;
      } finally {
        URL.revokeObjectURL(photoUrl);
      }
    } catch { /* Algunos dispositivos no admiten ImageCapture; se usa el fotograma del video. */ }
  }
  if (window.createImageBitmap) {
    try { return await createImageBitmap(cameraVideo); } catch { /* Continúa con el elemento de video. */ }
  }
  return cameraVideo;
}

async function startCamera() {
  stopCamera();
  clearCapturedPhoto();
  document.querySelector("#camera-help").textContent = "Solicitando acceso a la cámara…";
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar la cámara. Abre la invitación en HTTPS o en un navegador compatible.");
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: cameraFacingMode } }, audio: false });
    cameraStream.getVideoTracks().forEach((track) => track.addEventListener("ended", handleCameraTrackEnded, { once: true }));
    cameraVideo.muted = true;
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    await waitForCameraMetadata(cameraVideo);
    const orientation = getSelectedFrameOrientation();
    const frameImage = await setFrameOrientation(orientation);
    if (!frameImage) throw new Error(`No se pudo cargar el marco ${orientation}. Revisa los PNG de assets/frames.`);
    if (!cameraStream.getVideoTracks().some((track) => track.readyState === "live")) throw new Error("La cámara se desconectó. Vuelve a intentarlo.");
    takePhotoButton.disabled = false;
    takePhotoButton.textContent = "Tomar foto";
    switchCameraButton.textContent = cameraFacingMode === "user" ? "Usar cámara trasera" : "Usar cámara frontal";
    document.querySelector("#camera-help").textContent = "Centra la foto y pulsa el obturador.";
  } catch (error) {
    stopCamera();
    takePhotoButton.disabled = false;
    takePhotoButton.textContent = "Reintentar cámara";
    document.querySelector("#camera-help").textContent = error.message || "No pudimos abrir la cámara. Revisa el permiso y vuelve a intentarlo.";
  }
}

document.querySelector("#open-camera").addEventListener("click", async () => {
  cameraDialog.showModal();
  await startCamera();
});

switchCameraButton.addEventListener("click", async () => {
  cameraFacingMode = cameraFacingMode === "user" ? "environment" : "user";
  await startCamera();
});

frameOrientationButton.addEventListener("click", async () => {
  frameOrientationMode = frameOrientationMode === "portrait" ? "landscape" : "portrait";
  updateFrameOrientationButton();
  const frameImage = await setFrameOrientation(getSelectedFrameOrientation());
  if (!frameImage) document.querySelector("#camera-help").textContent = "No se pudo cargar este marco. Revisa los PNG de assets/frames.";
});

document.querySelector("#close-camera").addEventListener("click", () => cameraDialog.close());
cameraDialog.addEventListener("click", (event) => { if (event.target === cameraDialog) cameraDialog.close(); });
cameraDialog.addEventListener("close", () => {
  stopCamera();
  clearCapturedPhoto();
});

discardPhotoButton.addEventListener("click", startCamera);

takePhotoButton.addEventListener("click", async () => {
  if (!cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    await startCamera();
    return;
  }

  takePhotoButton.disabled = true;
  document.querySelector("#camera-help").textContent = "Preparando tu foto…";
  try {
  const photoSource = await getCameraPhotoSource();
  const sourceWidth = photoSource.width || photoSource.naturalWidth || photoSource.videoWidth;
  const sourceHeight = photoSource.height || photoSource.naturalHeight || photoSource.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("La cámara no entregó una imagen. Pulsa repetir e inténtalo otra vez.");
  const orientation = activeFrameOrientation;
  const frameImage = await getFrameImage(orientation);
  if (!frameImage) throw new Error(`No se pudo cargar el marco ${orientation}. Revisa los PNG de assets/frames.`);
  const frameDimensions = getFrameDimensions(frameImage);

  cameraCanvas.width = frameDimensions.width;
  cameraCanvas.height = frameDimensions.height;
  if (!cameraCanvas.width || !cameraCanvas.height) throw new Error(`El marco ${orientation} no tiene dimensiones válidas.`);

  const width = cameraCanvas.width;
  const height = cameraCanvas.height;
  const context = cameraCanvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f8f4e9";
  context.fillRect(0, 0, width, height);

  const opening = frameOpenings[orientation];
  const openingX = Math.round(width * opening.x);
  const openingY = Math.round(height * opening.y);
  const openingWidth = Math.round(width * opening.width);
  const openingHeight = Math.round(height * opening.height);

  context.fillStyle = "#f8f4e9";
  context.fillRect(openingX, openingY, openingWidth, openingHeight);
    const openingAspect = openingWidth / openingHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceAspect > openingAspect) {
    cropWidth = sourceHeight * openingAspect;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / openingAspect;
    cropY = (sourceHeight - cropHeight) / 2;
  }
  context.drawImage(photoSource, cropX, cropY, cropWidth, cropHeight, openingX, openingY, openingWidth, openingHeight);
  context.drawImage(frameImage, 0, 0, width, height);
  photoSource.close?.();

  const photoBlob = await new Promise((resolve, reject) => {
    try {
      cameraCanvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("El navegador no pudo exportar la foto. Intenta de nuevo."));
      }, "image/jpeg", .94);
    } catch (error) {
      reject(error);
    }
  });
  if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
  capturedPhotoUrl = URL.createObjectURL(photoBlob);
  downloadPhoto.href = capturedPhotoUrl;
  downloadPhoto.download = `recuerdo-vanesa-mauricio-${orientation}.jpg`;
  downloadPhoto.hidden = false;
  discardPhotoButton.hidden = false;
  takePhotoButton.hidden = true;
  cameraTools.hidden = true;
  stopCamera();
  cameraVideo.hidden = true;
  cameraCanvas.hidden = false;
  cameraOverlay.hidden = true;
  document.querySelector("#camera-help").textContent = "Revisa tu foto. Puedes guardarla o descartarla para repetir.";
  } catch (error) {
    takePhotoButton.disabled = false;
    document.querySelector("#camera-help").textContent = error.name === "SecurityError"
      ? "El navegador bloqueó la exportación de la foto. Reabre la invitación desde localhost o HTTPS e inténtalo otra vez."
      : error.message || "No se pudo tomar la foto. Intenta de nuevo.";
  }
});

