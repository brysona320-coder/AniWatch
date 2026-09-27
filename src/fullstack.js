import { api } from "./client-api.js";

const state = {
  user: null,
  config: null,
  currentAnime: null,
  currentMedia: null,
  currentSources: [],
  lists: [],
  progressTimer: 0,
  introSkippedFor: "",
  outroSkippedFor: ""
};

const $ = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function toast(message, kind = "info") {
  let region = $("#app-toasts");
  if (!region) {
    region = document.createElement("div");
    region.id = "app-toasts";
    region.className = "app-toasts";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const item = document.createElement("div");
  item.className = "app-toast " + kind;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 4000);
}

async function optionalMe() {
  try {
    state.user = (await api("/auth/me")).user;
  } catch (error) {
    if (error.status !== 401) console.warn(error);
    state.user = null;
  }
}

function injectShell() {
  const actions = $(".header-actions");
  if (actions && !$("#account-button")) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "account-button";
    button.className = "account-button";
    button.textContent = "Account";
    actions.append(button);
  }

  if ($("#account-dialog")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="account-dialog" class="account-dialog" aria-labelledby="account-title">
      <button type="button" class="dialog-close" id="account-close" aria-label="Close account">×</button>
      <div class="account-shell">
        <aside class="account-nav">
          <h2 id="account-title">AniWatch account</h2>
          <button type="button" data-account-page="profile">Profile</button>
          <button type="button" data-account-page="appearance">Appearance</button>
          <button type="button" data-account-page="player">Player</button>
          <button type="button" data-account-page="lists">Lists</button>
          <button type="button" data-account-page="downloads">Downloads</button>
          <button type="button" data-account-page="premium">Premium</button>
          <button type="button" id="account-logout" hidden>Log out</button>
        </aside>
        <section class="account-content">
          <div id="auth-view">
            <div class="auth-tabs">
              <button type="button" data-auth-mode="login" class="active">Log in</button>
              <button type="button" data-auth-mode="signup">Sign up</button>
            </div>
            <form id="auth-form">
              <label id="display-name-row" hidden>Display name
                <input id="auth-display-name" maxlength="60" autocomplete="nickname">
              </label>
              <label>Email
                <input id="auth-email" type="email" required autocomplete="email">
              </label>
              <label>Password
                <input id="auth-password" type="password" minlength="8" required autocomplete="current-password">
              </label>
              <button type="submit" class="primary-action" id="auth-submit">Log in</button>
              <p class="form-message" id="auth-message"></p>
            </form>
          </div>

          <div id="account-view" hidden>
            <section data-account-panel="profile">
              <h3>Profile</h3>
              <div class="profile-card">
                <img id="profile-avatar" class="profile-avatar" alt="">
                <div>
                  <strong id="profile-name"></strong>
                  <span id="profile-email"></span>
                </div>
              </div>
              <form id="profile-form">
                <label>Display name<input id="profile-display-name" maxlength="60" required></label>
                <label>Avatar<input id="profile-avatar-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
                <label>Default audio
                  <select id="profile-audio"><option value="japanese">Japanese</option><option value="english">English dub</option></select>
                </label>
                <label>Default subtitles
                  <select id="profile-subtitle"><option value="english">English</option><option value="none">Off</option></select>
                </label>
                <button type="submit" class="primary-action">Save profile</button>
              </form>
            </section>

            <section data-account-panel="appearance" hidden>
              <h3>Theme & interface</h3>
              <form id="appearance-form">
                <label>Theme
                  <select id="appearance-theme"><option value="DARK">Dark</option><option value="LIGHT">Light</option><option value="CUSTOM">Custom</option></select>
                </label>
                <label>Accent color<input id="appearance-accent" type="color"></label>
                <label>Layout density
                  <select id="appearance-density"><option value="COMPACT">Compact</option><option value="COMFORTABLE">Comfortable</option><option value="SPACIOUS">Spacious</option></select>
                </label>
                <button type="submit" class="primary-action">Save appearance</button>
              </form>
            </section>

            <section data-account-panel="player" hidden>
              <h3>Player settings</h3>
              <form id="player-settings-form">
                <label>Playback speed
                  <select id="player-speed">
                    <option value="0.5">0.5×</option><option value="0.75">0.75×</option>
                    <option value="1">1×</option><option value="1.25">1.25×</option>
                    <option value="1.5">1.5×</option><option value="2">2×</option>
                  </select>
                </label>
                <label>Subtitle font<input id="subtitle-font" maxlength="80"></label>
                <label>Subtitle color<input id="subtitle-color" type="color"></label>
                <label>Subtitle background<input id="subtitle-background" type="color"></label>
                <label>Subtitle background opacity<input id="subtitle-opacity" type="range" min="0" max="1" step="0.05"></label>
                <label class="check-row"><input id="auto-skip-intro" type="checkbox"> Auto-skip intro</label>
                <label>Intro length (seconds)<input id="intro-seconds" type="number" min="0" max="600"></label>
                <label class="check-row"><input id="auto-skip-outro" type="checkbox"> Auto-skip outro</label>
                <label>Outro length (seconds)<input id="outro-seconds" type="number" min="0" max="600"></label>
                <button type="submit" class="primary-action">Save player settings</button>
                <p class="settings-help">Hotkeys: Space/K play-pause, ←/→ seek 10s, M mute, F fullscreen, [ and ] change speed.</p>
              </form>
            </section>

            <section data-account-panel="lists" hidden>
              <h3>Personalized lists</h3>
              <form id="new-list-form" class="inline-form">
                <input id="new-list-name" placeholder="Custom folder name" maxlength="80" required>
                <select id="new-list-visibility"><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option></select>
                <button type="submit">Create</button>
              </form>
              <div id="lists-manager"></div>
            </section>

            <section data-account-panel="downloads" hidden>
              <h3>Offline downloads</h3>
              <p>Downloads stay on this device in browser storage. Availability depends on the video host allowing the browser to fetch the media.</p>
              <button type="button" id="download-current" class="primary-action" disabled>Download current episode</button>
              <div id="download-progress"></div>
              <div id="downloads-manager"></div>
            </section>

            <section data-account-panel="premium" hidden>
              <h3>Premium</h3>
              <div id="premium-content"></div>
            </section>
          </div>
        </section>
      </div>
    </dialog>
  `);

  const watchInfo = $(".watch-info");
  if (watchInfo && !$("#player-tools")) {
    watchInfo.insertAdjacentHTML("afterbegin", `
      <div id="player-tools" class="player-tools">
        <button type="button" id="speed-cycle">1×</button>
        <button type="button" id="skip-intro">Skip intro</button>
        <button type="button" id="skip-outro">Skip outro</button>
        <button type="button" id="player-download">Download</button>
      </div>
    `);
  }

  const discover = $("#discover");
  if (discover && !$("#ad-header-slot")) {
    discover.insertAdjacentHTML("beforebegin", '<section id="ad-header-slot" class="ad-runtime-slot" hidden></section>');
    discover.insertAdjacentHTML("afterend", '<section id="ad-content-slot" class="ad-runtime-slot ad-runtime-rectangle" hidden></section>');
  }

  const main = $("main");
  if (main && !$("#continue-watching")) {
    main.insertAdjacentHTML("afterbegin", `
      <section id="continue-watching" class="continue-section" hidden>
        <div class="section-heading"><div><span class="section-kicker">YOUR LIBRARY</span><h2>Continue watching<span class="heading-period">.</span></h2></div></div>
        <div id="continue-grid" class="continue-grid"></div>
      </section>
    `);
  }
}

function setAuthMode(mode) {
  const signup = mode === "signup";
  $("#display-name-row").hidden = !signup;
  $("#auth-display-name").required = signup;
  $("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("#auth-submit").textContent = signup ? "Create account" : "Log in";
  $("[data-auth-mode='login']").classList.toggle("active", !signup);
  $("[data-auth-mode='signup']").classList.toggle("active", signup);
  $("#auth-form").dataset.mode = mode;
}

function applyUserTheme() {
  if (!state.user) return;
  const theme = state.user.theme === "LIGHT" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = state.user.density.toLowerCase();
  document.documentElement.style.setProperty("--accent", state.user.accentColor);
  document.documentElement.style.setProperty("--subtitle-color", state.user.subtitleColor);
  document.documentElement.style.setProperty("--subtitle-bg", state.user.subtitleBackground);
  document.documentElement.style.setProperty("--subtitle-opacity", state.user.subtitleOpacity);
  document.documentElement.style.setProperty("--subtitle-font", state.user.subtitleFont);
}

function fillProfile() {
  if (!state.user) return;
  $("#profile-name").textContent = state.user.displayName;
  $("#profile-email").textContent = state.user.email;
  $("#profile-display-name").value = state.user.displayName;
  $("#profile-audio").value = state.user.defaultAudio;
  $("#profile-subtitle").value = state.user.defaultSubtitle;
  $("#appearance-theme").value = state.user.theme;
  $("#appearance-accent").value = state.user.accentColor;
  $("#appearance-density").value = state.user.density;
  $("#player-speed").value = String(state.user.playbackSpeed);
  $("#subtitle-font").value = state.user.subtitleFont;
  $("#subtitle-color").value = state.user.subtitleColor;
  $("#subtitle-background").value = state.user.subtitleBackground;
  $("#subtitle-opacity").value = String(state.user.subtitleOpacity);
  $("#auto-skip-intro").checked = state.user.autoSkipIntro;
  $("#auto-skip-outro").checked = state.user.autoSkipOutro;
  $("#intro-seconds").value = state.user.introSeconds;
  $("#outro-seconds").value = state.user.outroSeconds;
  const avatar = $("#profile-avatar");
  avatar.src = state.user.avatarUrl || "";
  avatar.hidden = !state.user.avatarUrl;
}

function renderAccount() {
  const signedIn = Boolean(state.user);
  $("#auth-view").hidden = signedIn;
  $("#account-view").hidden = !signedIn;
  $("#account-logout").hidden = !signedIn;
  $("#account-button").textContent = signedIn ? state.user.displayName : "Log in";
  if (signedIn) {
    fillProfile();
    applyUserTheme();
    loadLists();
    loadContinueWatching();
    renderPremium();
  }
}

function showAccountPage(name) {
  document.querySelectorAll("[data-account-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== name;
  });
  document.querySelectorAll("[data-account-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.accountPage === name);
  });
  if (name === "downloads") refreshDownloads();
  if (name === "lists") loadLists();
  if (name === "premium") renderPremium();
}

async function loadLists() {
  if (!state.user) return;
  try {
    state.lists = (await api("/lists")).lists;
    renderLists();
  } catch (error) {
    toast(error.message, "error");
  }
}

function selectedAnimePayload() {
  if (!state.currentAnime) return null;
  return {
    mediaKey: state.currentAnime.key,
    provider: state.currentAnime.provider,
    animeId: state.currentAnime.id,
    title: state.currentAnime.title,
    image: state.currentAnime.image || null,
    sourceUrl: state.currentAnime.url || null
  };
}

function renderLists() {
  const root = $("#lists-manager");
  if (!root) return;
  root.replaceChildren();
  for (const list of state.lists) {
    const card = document.createElement("article");
    card.className = "list-manager-card";
    const publicUrl = list.visibility === "PUBLIC"
      ? location.origin + "/?publicList=" + encodeURIComponent(state.user.id + "/" + list.slug)
      : "";
    card.innerHTML = `
      <div class="list-manager-head">
        <div><strong>${escapeHtml(list.name)}</strong><span>${list.items.length} items · ${list.visibility.toLowerCase()}</span></div>
        <div class="list-actions">
          <button type="button" data-add-current>+ Current title</button>
          <button type="button" data-toggle-visibility>${list.visibility === "PUBLIC" ? "Make private" : "Make public"}</button>
          <button type="button" data-delete-list>Delete</button>
        </div>
      </div>
      ${publicUrl ? '<input class="share-url" readonly value="' + escapeHtml(publicUrl) + '">' : ""}
      <div class="list-items">${list.items.map((item) => `
        <div><span>${escapeHtml(item.title)}</span><button type="button" data-remove-item="${encodeURIComponent(item.mediaKey)}">Remove</button></div>
      `).join("") || "<p>No titles yet.</p>"}</div>
    `;
    $("[data-add-current]", card).disabled = !state.currentAnime;
    $("[data-add-current]", card).addEventListener("click", async () => {
      const payload = selectedAnimePayload();
      if (!payload) return toast("Open an anime first.", "error");
      await api("/lists/" + list.id + "/items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast("Added to " + list.name);
      loadLists();
    });
    $("[data-toggle-visibility]", card).addEventListener("click", async () => {
      await api("/lists/" + list.id, {
        method: "PATCH",
        body: JSON.stringify({ visibility: list.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" })
      });
      loadLists();
    });
    $("[data-delete-list]", card).addEventListener("click", async () => {
      if (!confirm("Delete " + list.name + "?")) return;
      await api("/lists/" + list.id, { method: "DELETE" });
      loadLists();
    });
    card.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove-item]");
      if (!button) return;
      await api("/lists/" + list.id + "/items/" + button.dataset.removeItem, { method: "DELETE" });
      loadLists();
    });
    root.append(card);
  }
}

async function renderPremium() {
  const root = $("#premium-content");
  if (!root || !state.config) return;
  if (!state.user) {
    root.innerHTML = "<p>Log in to manage Premium.</p>";
    return;
  }
  if (state.user.isPremium) {
    root.innerHTML = `
      <div class="premium-status active"><strong>Premium active</strong><span>Ads are disabled for this account.</span></div>
      <button type="button" id="cancel-premium">Cancel subscription</button>
    `;
    $("#cancel-premium").addEventListener("click", async () => {
      if (!confirm("Cancel your AniWatch Premium subscription?")) return;
      await api("/paypal/subscription", { method: "DELETE" });
      toast("Subscription cancellation requested.");
      await optionalMe();
      renderAccount();
    });
    return;
  }
  const p = state.config.paypal;
  root.innerHTML = p?.configured
    ? `<div class="premium-status"><strong>${escapeHtml(p.planName)}</strong><span>${escapeHtml(p.currency)} $${Number(p.price).toFixed(2)} / month · ad-free experience</span></div><button type="button" id="start-premium" class="primary-action">Subscribe with PayPal</button>`
    : "<p>Premium checkout is not configured on this deployment yet.</p>";
  $("#start-premium")?.addEventListener("click", async () => {
    const result = await api("/paypal/subscription", { method: "POST" });
    if (!result.approvalUrl) throw new Error("PayPal did not return an approval link.");
    location.href = result.approvalUrl;
  });
}

async function loadContinueWatching() {
  const section = $("#continue-watching");
  const grid = $("#continue-grid");
  if (!state.user) {
    section.hidden = true;
    return;
  }
  try {
    const items = (await api("/progress")).progress;
    section.hidden = !items.length;
    grid.innerHTML = items.map((item) => {
      const percent = item.duration > 0 ? Math.min(100, Math.round(item.position / item.duration * 100)) : 0;
      return `<article class="continue-card"><strong>${escapeHtml(item.animeTitle)}</strong><span>Episode ${escapeHtml(item.episodeNumber || "")}</span><div class="continue-track"><i style="width:${percent}%"></i></div><small>${percent}% watched</small></article>`;
    }).join("");
  } catch (error) {
    if (error.status !== 401) console.warn(error);
  }
}

function mediaKey(detail) {
  return [detail.provider, detail.streamId, detail.episode?.id].map((value) => encodeURIComponent(String(value || ""))).join(":");
}

async function resumeCurrent() {
  if (!state.user || !state.currentMedia) return;
  try {
    const result = await api("/progress/" + encodeURIComponent(state.currentMedia.mediaKey));
    const progress = result.progress;
    if (!progress || progress.completed || progress.position < 5) return;
    const video = $("#watch-video");
    const apply = () => {
      const target = Math.min(progress.position, Math.max(0, (video.duration || progress.duration) - 2));
      if (Number.isFinite(target)) video.currentTime = target;
      toast("Resumed at " + formatTime(target));
    };
    if (video.readyState >= 1) apply();
    else video.addEventListener("loadedmetadata", apply, { once: true });
  } catch (error) {
    if (error.status !== 401) console.warn(error);
  }
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
}

async function saveProgress(force = false) {
  if (!state.user || !state.currentMedia) return;
  const now = Date.now();
  if (!force && now - state.progressTimer < 12000) return;
  state.progressTimer = now;
  const video = $("#watch-video");
  if (!video || !Number.isFinite(video.currentTime)) return;
  const payload = {
    ...state.currentMedia,
    position: video.currentTime || 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    completed: Number.isFinite(video.duration) && video.duration > 0
      ? video.currentTime / video.duration >= 0.95
      : false
  };
  try {
    await api("/progress/" + encodeURIComponent(payload.mediaKey), {
      method: "PUT",
      body: JSON.stringify(payload),
      keepalive: force
    });
  } catch (error) {
    if (error.status !== 401) console.warn("Progress sync failed:", error);
  }
}

function applyPlayerPreferences() {
  const video = $("#watch-video");
  if (!video || !state.user) return;
  video.playbackRate = state.user.playbackSpeed || 1;
  $("#speed-cycle").textContent = video.playbackRate + "×";
}

function playerTick() {
  const video = $("#watch-video");
  if (!video || !state.user || !state.currentMedia || !Number.isFinite(video.duration)) return;
  const key = state.currentMedia.mediaKey;
  if (state.user.autoSkipIntro && state.introSkippedFor !== key && video.currentTime > 0 && video.currentTime < state.user.introSeconds) {
    video.currentTime = Math.min(state.user.introSeconds, video.duration);
    state.introSkippedFor = key;
    toast("Intro skipped");
  }
  if (state.user.autoSkipOutro && state.outroSkippedFor !== key) {
    const cutoff = Math.max(0, video.duration - state.user.outroSeconds);
    if (video.currentTime >= cutoff && video.duration > state.user.outroSeconds + 30) {
      video.currentTime = Math.max(0, video.duration - 1);
      state.outroSkippedFor = key;
      toast("Outro skipped");
    }
  }
}

function cycleSpeed(direction = 1) {
  const video = $("#watch-video");
  if (!video) return;
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let index = speeds.findIndex((speed) => Math.abs(speed - video.playbackRate) < 0.01);
  if (index < 0) index = 2;
  index = (index + direction + speeds.length) % speeds.length;
  video.playbackRate = speeds[index];
  $("#speed-cycle").textContent = speeds[index] + "×";
}

function bindPlayer() {
  const video = $("#watch-video");
  if (!video) return;
  video.addEventListener("timeupdate", () => {
    saveProgress(false);
    playerTick();
  });
  video.addEventListener("pause", () => saveProgress(true));
  video.addEventListener("ended", () => saveProgress(true));
  video.addEventListener("loadedmetadata", applyPlayerPreferences);
  window.addEventListener("pagehide", () => saveProgress(true));

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
    if (!$("#watch-dialog")?.open) return;
    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      video.paused ? video.play() : video.pause();
    } else if (event.key === "ArrowLeft") {
      video.currentTime = Math.max(0, video.currentTime - 10);
    } else if (event.key === "ArrowRight") {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    } else if (event.key.toLowerCase() === "m") {
      video.muted = !video.muted;
    } else if (event.key.toLowerCase() === "f") {
      video.requestFullscreen?.();
    } else if (event.key === "]") {
      cycleSpeed(1);
    } else if (event.key === "[") {
      cycleSpeed(-1);
    }
  });

  $("#speed-cycle")?.addEventListener("click", () => cycleSpeed(1));
  $("#skip-intro")?.addEventListener("click", () => {
    if (!state.user) return toast("Log in to use saved player settings.");
    video.currentTime = Math.min(state.user.introSeconds, video.duration || state.user.introSeconds);
  });
  $("#skip-outro")?.addEventListener("click", () => {
    if (!state.user || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, video.duration - state.user.outroSeconds);
  });
  $("#player-download")?.addEventListener("click", downloadCurrent);
}

function adFrame(key, width, height) {
  if (!key) return "";
  const srcdoc = `<!doctype html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:transparent"><script>atOptions={key:'${String(key).replace(/'/g, "")}',format:'iframe',height:${height},width:${width},params:{}};<\/script><script src="https://www.highperformanceformat.com/${encodeURIComponent(key)}/invoke.js"><\/script></body></html>`;
  return '<iframe title="Advertisement" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer-when-downgrade" width="' + width + '" height="' + height + '" srcdoc="' + escapeHtml(srcdoc) + '"></iframe><span class="ad-runtime-label">Advertisement</span>';
}

function renderAds() {
  const ads = state.config?.ads;
  const header = $("#ad-header-slot");
  const content = $("#ad-content-slot");
  if (!ads?.enabled) {
    if (header) header.hidden = true;
    if (content) content.hidden = true;
    return;
  }
  if (header && ads.headerKey) {
    header.hidden = false;
    header.innerHTML = adFrame(ads.headerKey, 728, 90);
  }
  if (content && ads.rectangleKey) {
    content.hidden = false;
    content.innerHTML = adFrame(ads.rectangleKey, 300, 250);
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (error) {
    console.warn("Service worker registration failed:", error);
  }
}

function swMessage(message) {
  return new Promise(async (resolve, reject) => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active || registration.waiting || registration.installing;
    if (!worker) return reject(new Error("Offline worker is unavailable."));
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data?.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

async function downloadCurrent() {
  if (!state.currentMedia || !state.currentSources.length) {
    return toast("Choose an episode before downloading.", "error");
  }
  const source = state.currentSources[0];
  const meta = {
    id: state.currentMedia.mediaKey,
    title: state.currentMedia.animeTitle,
    episode: state.currentMedia.episodeNumber || state.currentMedia.episodeTitle || "",
    sourceUrl: source.url,
    hls: Boolean(source.hls),
    savedAt: Date.now()
  };
  $("#download-progress").textContent = "Preparing download…";
  try {
    const result = await swMessage({ type: "DOWNLOAD_MEDIA", meta });
    $("#download-progress").textContent = result?.message || "Download saved.";
    toast("Episode available offline.");
    refreshDownloads();
  } catch (error) {
    $("#download-progress").textContent = error.message;
    toast(error.message, "error");
  }
}

async function refreshDownloads() {
  const root = $("#downloads-manager");
  if (!root || !("serviceWorker" in navigator)) return;
  try {
    const result = await swMessage({ type: "LIST_DOWNLOADS" });
    const items = result?.items || [];
    root.innerHTML = items.map((item) => `
      <article class="download-card">
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.episode)}</span></div>
        <div><button type="button" data-offline-play="${escapeHtml(item.id)}">Play offline</button><button type="button" data-offline-delete="${escapeHtml(item.id)}">Delete</button></div>
      </article>
    `).join("") || "<p>No downloaded episodes on this device.</p>";
    root.querySelectorAll("[data-offline-play]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items.find((entry) => entry.id === button.dataset.offlinePlay);
        if (!item) return;
        const video = $("#watch-video");
        $("#watch-dialog").showModal();
        $(".watch-player").hidden = false;
        if (item.hls && window.Hls?.isSupported()) {
          const hls = new window.Hls();
          hls.loadSource(item.sourceUrl);
          hls.attachMedia(video);
        } else {
          video.src = item.sourceUrl;
        }
        video.play().catch(() => {});
      });
    });
    root.querySelectorAll("[data-offline-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        await swMessage({ type: "DELETE_DOWNLOAD", id: button.dataset.offlineDelete });
        refreshDownloads();
      });
    });
  } catch (error) {
    root.textContent = "Offline storage is unavailable: " + error.message;
  }
}

function bindForms() {
  $("#account-button").addEventListener("click", () => {
    $("#account-dialog").showModal();
    if (state.user) showAccountPage("profile");
  });
  $("#account-close").addEventListener("click", () => $("#account-dialog").close());
  $("#account-dialog").addEventListener("click", (event) => {
    if (event.target === $("#account-dialog")) $("#account-dialog").close();
  });
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });
  document.querySelectorAll("[data-account-page]").forEach((button) => {
    button.addEventListener("click", () => showAccountPage(button.dataset.accountPage));
  });

  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const mode = event.currentTarget.dataset.mode || "login";
    $("#auth-message").textContent = "";
    try {
      const body = {
        email: $("#auth-email").value.trim(),
        password: $("#auth-password").value
      };
      if (mode === "signup") body.displayName = $("#auth-display-name").value.trim();
      state.user = (await api("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify(body)
      })).user;
      await loadConfig();
      renderAccount();
      showAccountPage("profile");
      toast(mode === "signup" ? "Account created." : "Logged in.");
    } catch (error) {
      $("#auth-message").textContent = error.message;
    }
  });

  $("#account-logout").addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" });
    state.user = null;
    state.lists = [];
    await loadConfig();
    renderAccount();
    renderAds();
    toast("Logged out.");
  });

  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.user = (await api("/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: $("#profile-display-name").value.trim(),
        defaultAudio: $("#profile-audio").value,
        defaultSubtitle: $("#profile-subtitle").value
      })
    })).user;
    const file = $("#profile-avatar-input").files[0];
    if (file) {
      const form = new FormData();
      form.append("avatar", file);
      state.user.avatarUrl = (await api("/profile/avatar", { method: "PUT", body: form })).avatarUrl;
    }
    renderAccount();
    toast("Profile saved.");
  });

  $("#appearance-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.user = (await api("/profile", {
      method: "PATCH",
      body: JSON.stringify({
        theme: $("#appearance-theme").value,
        accentColor: $("#appearance-accent").value,
        density: $("#appearance-density").value
      })
    })).user;
    applyUserTheme();
    toast("Appearance saved.");
  });

  $("#player-settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.user = (await api("/profile", {
      method: "PATCH",
      body: JSON.stringify({
        playbackSpeed: Number($("#player-speed").value),
        subtitleFont: $("#subtitle-font").value.trim(),
        subtitleColor: $("#subtitle-color").value,
        subtitleBackground: $("#subtitle-background").value,
        subtitleOpacity: Number($("#subtitle-opacity").value),
        autoSkipIntro: $("#auto-skip-intro").checked,
        autoSkipOutro: $("#auto-skip-outro").checked,
        introSeconds: Number($("#intro-seconds").value),
        outroSeconds: Number($("#outro-seconds").value)
      })
    })).user;
    applyUserTheme();
    applyPlayerPreferences();
    toast("Player settings saved.");
  });

  $("#new-list-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/lists", {
      method: "POST",
      body: JSON.stringify({
        name: $("#new-list-name").value.trim(),
        visibility: $("#new-list-visibility").value
      })
    });
    $("#new-list-name").value = "";
    loadLists();
  });
}

async function loadConfig() {
  try {
    state.config = await api("/config");
  } catch (error) {
    console.warn("Runtime config unavailable:", error);
    state.config = { ads: { enabled: false }, paypal: { configured: false } };
  }
}

function bindAppEvents() {
  window.addEventListener("aniwatch:anime-selected", (event) => {
    state.currentAnime = event.detail?.anime || null;
    if (state.user) loadLists();
  });
  window.addEventListener("aniwatch:episode-selected", (event) => {
    const detail = event.detail || {};
    state.currentAnime = detail.anime || state.currentAnime;
    state.currentSources = detail.sources || [];
    state.currentMedia = {
      mediaKey: mediaKey(detail),
      provider: detail.provider || "unknown",
      animeId: String(detail.streamId || detail.anime?.id || "unknown"),
      episodeId: String(detail.episode?.id || "unknown"),
      animeTitle: detail.anime?.title || detail.streamTitle || "Untitled",
      episodeTitle: detail.episode?.title || null,
      episodeNumber: detail.episode?.number == null ? null : String(detail.episode.number)
    };
    state.introSkippedFor = "";
    state.outroSkippedFor = "";
    $("#download-current").disabled = false;
    $("#player-download").disabled = false;
    resumeCurrent();
    applyPlayerPreferences();
  });
}

async function showPublicListFromUrl() {
  const value = new URLSearchParams(location.search).get("publicList");
  if (!value) return;
  const [userId, slug] = value.split("/");
  if (!userId || !slug) return;
  try {
    const { list } = await api("/lists/public/" + encodeURIComponent(userId) + "/" + encodeURIComponent(slug));
    const dialog = $("#account-dialog");
    dialog.showModal();
    $("#auth-view").hidden = true;
    $("#account-view").hidden = false;
    $(".account-nav").hidden = true;
    $(".account-content").innerHTML = `
      <section><h3>${escapeHtml(list.name)}</h3><p>Shared by ${escapeHtml(list.user.displayName)}</p>
      <div class="public-list-grid">${list.items.map((item) => '<article><strong>' + escapeHtml(item.title) + '</strong></article>').join("") || "<p>This list is empty.</p>"}</div></section>
    `;
  } catch (error) {
    toast(error.message, "error");
  }
}

async function init() {
  injectShell();
  setAuthMode("login");
  bindForms();
  bindPlayer();
  bindAppEvents();
  await registerServiceWorker();
  await Promise.all([loadConfig(), optionalMe()]);
  renderAccount();
  renderAds();
  await showPublicListFromUrl();

  const subscription = new URLSearchParams(location.search).get("subscription");
  if (subscription === "success") {
    toast("PayPal approved the subscription. Premium activates when the verified webhook arrives.");
  } else if (subscription === "cancelled") {
    toast("PayPal checkout was cancelled.");
  }
}

init().catch((error) => {
  console.error(error);
  toast("AniWatch account features could not start.", "error");
});
