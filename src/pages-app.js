import { RUNTIME_CONFIG } from "./runtime-config.js";

const state = {
  supabase: null,
  user: null,
  profile: null,
  anime: null,
  media: null,
  sources: [],
  lists: [],
  progressWrite: 0
};

const $ = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function notify(message, error = false) {
  let root = $("#app-toasts");
  if (!root) {
    root = document.createElement("div");
    root.id = "app-toasts";
    root.className = "app-toasts";
    root.setAttribute("aria-live", "polite");
    document.body.append(root);
  }
  const item = document.createElement("div");
  item.className = "app-toast" + (error ? " error" : "");
  item.textContent = message;
  root.append(item);
  setTimeout(() => item.remove(), 4200);
}

function cloudConfigured() {
  return Boolean(
    RUNTIME_CONFIG.supabaseUrl &&
    RUNTIME_CONFIG.supabasePublishableKey &&
    window.supabase?.createClient
  );
}

function createCloudClient() {
  if (!cloudConfigured()) return null;
  return window.supabase.createClient(
    RUNTIME_CONFIG.supabaseUrl,
    RUNTIME_CONFIG.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

function injectUi() {
  const actions = $(".header-actions");
  if (actions && !$("#account-button")) {
    const button = document.createElement("button");
    button.id = "account-button";
    button.type = "button";
    button.className = "account-button";
    button.textContent = "Account";
    actions.append(button);
  }

  if (!$("#account-dialog")) {
    const html = [
      '<dialog id="account-dialog" class="account-dialog" aria-labelledby="account-title">',
      '<button type="button" class="dialog-close" id="account-close" aria-label="Close account">×</button>',
      '<div class="account-shell"><aside class="account-nav">',
      '<h2 id="account-title">AniWatch account</h2>',
      '<button type="button" data-page="profile">Profile</button>',
      '<button type="button" data-page="appearance">Appearance</button>',
      '<button type="button" data-page="player">Player</button>',
      '<button type="button" data-page="lists">Lists</button>',
      '<button type="button" data-page="downloads">Downloads</button>',
      '<button type="button" id="logout-button" hidden>Log out</button>',
      '</aside><section class="account-content">',
      '<div id="cloud-missing" hidden><h3>Cloud sync is not configured</h3>',
      '<p>The GitHub Pages site works without it. Add the Supabase repository variables from the README to enable accounts, synced progress, avatars, and lists.</p></div>',
      '<div id="auth-view"><div class="auth-tabs">',
      '<button type="button" data-auth="login" class="active">Log in</button>',
      '<button type="button" data-auth="signup">Sign up</button></div>',
      '<form id="auth-form"><label id="signup-name-row" hidden>Display name<input id="auth-name" maxlength="60" autocomplete="nickname"></label>',
      '<label>Email<input id="auth-email" type="email" required autocomplete="email"></label>',
      '<label>Password<input id="auth-password" type="password" minlength="8" required autocomplete="current-password"></label>',
      '<button class="primary-action" id="auth-submit" type="submit">Log in</button>',
      '<p id="auth-message" class="form-message"></p></form></div>',
      '<div id="account-view" hidden>',
      '<section data-panel="profile"><h3>Profile</h3><div class="profile-card">',
      '<img id="profile-avatar" class="profile-avatar" alt=""><div><strong id="profile-name"></strong><span id="profile-email"></span></div></div>',
      '<form id="profile-form"><label>Display name<input id="profile-display-name" maxlength="60" required></label>',
      '<label>Avatar<input id="profile-avatar-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>',
      '<label>Default audio<select id="profile-audio"><option value="japanese">Japanese</option><option value="english">English dub</option></select></label>',
      '<label>Default subtitles<select id="profile-subtitle"><option value="english">English</option><option value="none">Off</option></select></label>',
      '<button class="primary-action" type="submit">Save profile</button></form></section>',
      '<section data-panel="appearance" hidden><h3>Theme & interface</h3><form id="appearance-form">',
      '<label>Theme<select id="appearance-theme"><option value="DARK">Dark</option><option value="LIGHT">Light</option><option value="CUSTOM">Custom</option></select></label>',
      '<label>Accent color<input id="appearance-accent" type="color"></label>',
      '<label>Layout density<select id="appearance-density"><option value="COMPACT">Compact</option><option value="COMFORTABLE">Comfortable</option><option value="SPACIOUS">Spacious</option></select></label>',
      '<button class="primary-action" type="submit">Save appearance</button></form></section>',
      '<section data-panel="player" hidden><h3>Player settings</h3><form id="player-settings-form">',
      '<label>Playback speed<select id="player-speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>',
      '<label>Subtitle font<input id="subtitle-font" maxlength="80"></label>',
      '<label>Subtitle color<input id="subtitle-color" type="color"></label>',
      '<label>Subtitle background<input id="subtitle-background" type="color"></label>',
      '<label>Subtitle opacity<input id="subtitle-opacity" type="range" min="0" max="1" step="0.05"></label>',
      '<label class="check-row"><input id="auto-skip-intro" type="checkbox"> Auto-skip intro</label>',
      '<label>Intro length<input id="intro-seconds" type="number" min="0" max="600"></label>',
      '<label class="check-row"><input id="auto-skip-outro" type="checkbox"> Auto-skip outro</label>',
      '<label>Outro length<input id="outro-seconds" type="number" min="0" max="600"></label>',
      '<button class="primary-action" type="submit">Save player settings</button>',
      '<p class="settings-help">Hotkeys: Space/K play-pause, ←/→ seek 10s, M mute, F fullscreen, [ and ] change speed.</p></form></section>',
      '<section data-panel="lists" hidden><h3>Personalized lists</h3>',
      '<form id="new-list-form" class="inline-form"><input id="new-list-name" placeholder="Custom folder name" maxlength="80" required>',
      '<select id="new-list-visibility"><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option></select>',
      '<button type="submit">Create</button></form><div id="lists-manager"></div></section>',
      '<section data-panel="downloads" hidden><h3>Offline downloads</h3>',
      '<p>Downloads stay on this device in browser storage and require the media host to allow browser caching.</p>',
      '<button id="download-current" class="primary-action" type="button" disabled>Download current episode</button>',
      '<div id="download-progress"></div><div id="downloads-manager"></div></section>',
      '</div></section></div></dialog>'
    ].join("");
    document.body.insertAdjacentHTML("beforeend", html);
  }

  if ($(".watch-info") && !$("#player-tools")) {
    $(".watch-info").insertAdjacentHTML(
      "afterbegin",
      '<div id="player-tools" class="player-tools"><button type="button" id="speed-cycle">1×</button><button type="button" id="skip-intro">Skip intro</button><button type="button" id="skip-outro">Skip outro</button><button type="button" id="player-download" disabled>Download</button></div>'
    );
  }

  const discover = $("#discover");
  if (discover && !$("#ad-header-slot")) {
    discover.insertAdjacentHTML("beforebegin", '<section id="ad-header-slot" class="ad-runtime-slot" hidden></section>');
    discover.insertAdjacentHTML("afterend", '<section id="ad-content-slot" class="ad-runtime-slot ad-runtime-rectangle" hidden></section>');
  }

  if ($("main") && !$("#continue-watching")) {
    $("main").insertAdjacentHTML(
      "afterbegin",
      '<section id="continue-watching" class="continue-section" hidden><div class="section-heading"><div><span class="section-kicker">YOUR LIBRARY</span><h2>Continue watching<span class="heading-period">.</span></h2></div></div><div id="continue-grid" class="continue-grid"></div></section>'
    );
  }
}

function setAuthMode(mode) {
  const signup = mode === "signup";
  $("#signup-name-row").hidden = !signup;
  $("#auth-name").required = signup;
  $("#auth-submit").textContent = signup ? "Create account" : "Log in";
  $("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("#auth-form").dataset.mode = mode;
  $("[data-auth='login']").classList.toggle("active", !signup);
  $("[data-auth='signup']").classList.toggle("active", signup);
}

function showPanel(name) {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === name);
  });
  if (name === "lists") loadLists();
  if (name === "downloads") refreshDownloads();
}

function applyProfileTheme() {
  if (!state.profile) return;
  document.documentElement.dataset.theme = state.profile.theme === "LIGHT" ? "light" : "dark";
  document.documentElement.dataset.density = String(state.profile.density || "COMFORTABLE").toLowerCase();
  document.documentElement.style.setProperty("--accent", state.profile.accent_color || "#8b5cf6");
  document.documentElement.style.setProperty("--subtitle-color", state.profile.subtitle_color || "#ffffff");
  document.documentElement.style.setProperty("--subtitle-bg", state.profile.subtitle_background || "#000000");
  document.documentElement.style.setProperty("--subtitle-opacity", String(state.profile.subtitle_opacity ?? 0.75));
  document.documentElement.style.setProperty("--subtitle-font", state.profile.subtitle_font || "DM Sans");
}

function avatarUrl() {
  if (!state.profile?.avatar_path || !state.supabase) return "";
  return state.supabase.storage.from("avatars").getPublicUrl(state.profile.avatar_path).data?.publicUrl || "";
}

function fillProfileForm() {
  if (!state.user || !state.profile) return;
  $("#profile-name").textContent = state.profile.display_name || "Anime Fan";
  $("#profile-email").textContent = state.user.email || "";
  $("#profile-display-name").value = state.profile.display_name || "";
  $("#profile-audio").value = state.profile.default_audio || "japanese";
  $("#profile-subtitle").value = state.profile.default_subtitle || "english";
  $("#appearance-theme").value = state.profile.theme || "DARK";
  $("#appearance-accent").value = state.profile.accent_color || "#8b5cf6";
  $("#appearance-density").value = state.profile.density || "COMFORTABLE";
  $("#player-speed").value = String(state.profile.playback_speed || 1);
  $("#subtitle-font").value = state.profile.subtitle_font || "DM Sans";
  $("#subtitle-color").value = state.profile.subtitle_color || "#ffffff";
  $("#subtitle-background").value = state.profile.subtitle_background || "#000000";
  $("#subtitle-opacity").value = String(state.profile.subtitle_opacity ?? 0.75);
  $("#auto-skip-intro").checked = Boolean(state.profile.auto_skip_intro);
  $("#auto-skip-outro").checked = Boolean(state.profile.auto_skip_outro);
  $("#intro-seconds").value = state.profile.intro_seconds ?? 90;
  $("#outro-seconds").value = state.profile.outro_seconds ?? 90;
  const image = $("#profile-avatar");
  image.src = avatarUrl();
  image.hidden = !image.src;
}

async function loadProfile() {
  if (!state.user) return;
  const result = await state.supabase.from("profiles").select("*").eq("id", state.user.id).single();
  if (result.error) throw result.error;
  state.profile = result.data;
}

async function refreshSession() {
  if (!state.supabase) {
    state.user = null;
    state.profile = null;
    renderAccount();
    return;
  }
  const result = await state.supabase.auth.getUser();
  state.user = result.error ? null : result.data.user;
  state.profile = null;
  if (state.user) await loadProfile();
  renderAccount();
}

function renderAccount() {
  const configured = Boolean(state.supabase);
  const signedIn = Boolean(configured && state.user && state.profile);
  $("#cloud-missing").hidden = configured;
  $("#auth-view").hidden = !configured || signedIn;
  $("#account-view").hidden = !signedIn;
  $("#logout-button").hidden = !signedIn;
  $("#account-button").textContent = signedIn ? state.profile.display_name : configured ? "Log in" : "Cloud setup";
  if (signedIn) {
    fillProfileForm();
    applyProfileTheme();
    loadLists();
    loadContinueWatching();
  } else {
    $("#continue-watching").hidden = true;
  }
  renderAds();
}

async function updateProfile(values) {
  const result = await state.supabase.from("profiles").update(values).eq("id", state.user.id).select("*").single();
  if (result.error) throw result.error;
  state.profile = result.data;
}

async function uploadAvatar(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error("Avatar must be 2 MB or smaller.");
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP, or GIF avatar.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const path = state.user.id + "/avatar-" + Date.now() + "." + ext;
  const uploaded = await state.supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploaded.error) throw uploaded.error;
  const old = state.profile.avatar_path;
  await updateProfile({ avatar_path: path });
  if (old && old !== path) state.supabase.storage.from("avatars").remove([old]).catch(() => {});
}

function slugify(value) {
  return String(value).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "list";
}

async function uniqueSlug(name) {
  const base = slugify(name);
  let candidate = base;
  for (let n = 2; n < 1000; n += 1) {
    const result = await state.supabase.from("watch_lists").select("id").eq("user_id", state.user.id).eq("slug", candidate).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return candidate;
    candidate = base + "-" + n;
  }
  return base + "-" + Date.now();
}

async function loadLists() {
  if (!state.user) return;
  const result = await state.supabase.from("watch_lists").select("*,list_items(*)").eq("user_id", state.user.id).order("updated_at", { ascending: false });
  if (result.error) {
    console.warn(result.error);
    return;
  }
  state.lists = result.data || [];
  renderLists();
}

function selectedAnimePayload() {
  if (!state.anime) return null;
  return {
    media_key: state.anime.key,
    provider: state.anime.provider,
    anime_id: String(state.anime.id),
    title: state.anime.title,
    image: state.anime.image || null,
    source_url: state.anime.url || null
  };
}

function renderLists() {
  const root = $("#lists-manager");
  if (!root) return;
  root.replaceChildren();
  for (const list of state.lists) {
    const items = [...(list.list_items || [])].sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    const card = document.createElement("article");
    card.className = "list-manager-card";
    const publicUrl = list.visibility === "PUBLIC"
      ? location.origin + location.pathname + "?publicList=" + encodeURIComponent(state.user.id + "/" + list.slug)
      : "";
    card.innerHTML =
      '<div class="list-manager-head"><div><strong>' + escapeHtml(list.name) + '</strong><span>' +
      items.length + ' items · ' + escapeHtml(String(list.visibility).toLowerCase()) +
      '</span></div><div class="list-actions"><button type="button" data-add>+ Current title</button><button type="button" data-visibility>' +
      (list.visibility === "PUBLIC" ? "Make private" : "Make public") +
      '</button><button type="button" data-delete>Delete</button></div></div>' +
      (publicUrl ? '<input class="share-url" readonly value="' + escapeHtml(publicUrl) + '">' : "") +
      '<div class="list-items">' +
      (items.length ? items.map((item) =>
        '<div><span>' + escapeHtml(item.title) + '</span><button type="button" data-remove="' +
        encodeURIComponent(item.media_key) + '">Remove</button></div>'
      ).join("") : "<p>No titles yet.</p>") +
      "</div>";
    const add = $("[data-add]", card);
    add.disabled = !state.anime;
    add.addEventListener("click", async () => {
      const payload = selectedAnimePayload();
      if (!payload) return notify("Open an anime first.", true);
      const result = await state.supabase.from("list_items").upsert({ ...payload, list_id: list.id }, { onConflict: "list_id,media_key" });
      if (result.error) return notify(result.error.message, true);
      notify("Added to " + list.name);
      loadLists();
    });
    $("[data-visibility]", card).addEventListener("click", async () => {
      const result = await state.supabase.from("watch_lists").update({ visibility: list.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" }).eq("id", list.id).eq("user_id", state.user.id);
      if (result.error) return notify(result.error.message, true);
      loadLists();
    });
    $("[data-delete]", card).addEventListener("click", async () => {
      if (!confirm("Delete " + list.name + "?")) return;
      const result = await state.supabase.from("watch_lists").delete().eq("id", list.id).eq("user_id", state.user.id);
      if (result.error) return notify(result.error.message, true);
      loadLists();
    });
    card.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      const key = decodeURIComponent(button.dataset.remove);
      const result = await state.supabase.from("list_items").delete().eq("list_id", list.id).eq("media_key", key);
      if (result.error) return notify(result.error.message, true);
      loadLists();
    });
    root.append(card);
  }
}

async function loadContinueWatching() {
  if (!state.user) return;
  const result = await state.supabase.from("watch_progress").select("*").eq("user_id", state.user.id).eq("completed", false).order("updated_at", { ascending: false }).limit(50);
  if (result.error) return console.warn(result.error);
  const items = result.data || [];
  $("#continue-watching").hidden = !items.length;
  $("#continue-grid").innerHTML = items.map((item) => {
    const percent = item.duration > 0 ? Math.min(100, Math.round(item.position / item.duration * 100)) : 0;
    return '<article class="continue-card"><strong>' + escapeHtml(item.anime_title) + '</strong><span>Episode ' +
      escapeHtml(item.episode_number || "") + '</span><div class="continue-track"><i style="width:' + percent +
      '%"></i></div><small>' + percent + '% watched</small></article>';
  }).join("");
}

function mediaKey(detail) {
  return [detail.provider, detail.streamId, detail.episode?.id].map((value) => encodeURIComponent(String(value || ""))).join(":");
}

async function resumeCurrent() {
  if (!state.user || !state.media) return;
  const result = await state.supabase.from("watch_progress").select("position,duration,completed").eq("user_id", state.user.id).eq("media_key", state.media.media_key).maybeSingle();
  if (result.error || !result.data || result.data.completed || result.data.position < 5) return;
  const saved = result.data;
  const video = $("#watch-video");
  const apply = () => {
    const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : saved.duration;
    const target = Math.min(saved.position, Math.max(0, max - 2));
    if (Number.isFinite(target)) video.currentTime = target;
  };
  if (video.readyState >= 1) apply();
  else video.addEventListener("loadedmetadata", apply, { once: true });
}

async function saveProgress(force = false) {
  if (!state.user || !state.media) return;
  if (!force && Date.now() - state.progressWrite < 12000) return;
  state.progressWrite = Date.now();
  const video = $("#watch-video");
  if (!video || !Number.isFinite(video.currentTime)) return;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const result = await state.supabase.from("watch_progress").upsert({
    ...state.media,
    user_id: state.user.id,
    position: video.currentTime || 0,
    duration,
    completed: duration > 0 ? video.currentTime / duration >= 0.95 : false
  }, { onConflict: "user_id,media_key" });
  if (result.error) console.warn("Progress sync failed", result.error);
}

function applyPlayerPreferences() {
  if (!state.profile) return;
  const video = $("#watch-video");
  video.playbackRate = state.profile.playback_speed || 1;
  $("#speed-cycle").textContent = video.playbackRate + "×";
}

function cycleSpeed(direction) {
  const video = $("#watch-video");
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
    if (!state.profile || !state.media || !Number.isFinite(video.duration)) return;
    if (state.profile.auto_skip_intro && video.currentTime > 0 && video.currentTime < state.profile.intro_seconds) {
      video.currentTime = Math.min(state.profile.intro_seconds, video.duration);
    }
    if (state.profile.auto_skip_outro && video.duration > state.profile.outro_seconds + 30 && video.currentTime >= video.duration - state.profile.outro_seconds) {
      video.currentTime = Math.max(0, video.duration - 1);
    }
  });
  video.addEventListener("pause", () => saveProgress(true));
  video.addEventListener("ended", () => saveProgress(true));
  video.addEventListener("loadedmetadata", applyPlayerPreferences);
  window.addEventListener("pagehide", () => saveProgress(true));
  document.addEventListener("keydown", (event) => {
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (!$("#watch-dialog")?.open) return;
    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      video.paused ? video.play() : video.pause();
    } else if (event.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 10);
    else if (event.key === "ArrowRight") video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    else if (event.key.toLowerCase() === "m") video.muted = !video.muted;
    else if (event.key.toLowerCase() === "f") video.requestFullscreen?.();
    else if (event.key === "]") cycleSpeed(1);
    else if (event.key === "[") cycleSpeed(-1);
  });
  $("#speed-cycle").addEventListener("click", () => cycleSpeed(1));
  $("#skip-intro").addEventListener("click", () => {
    if (state.profile) video.currentTime = Math.min(state.profile.intro_seconds, video.duration || state.profile.intro_seconds);
  });
  $("#skip-outro").addEventListener("click", () => {
    if (state.profile && Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.duration - state.profile.outro_seconds);
  });
  $("#player-download").addEventListener("click", downloadCurrent);
}

function adFrame(key, width, height) {
  const clean = String(key || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) return "";
  const options = JSON.stringify({
    key: clean,
    format: "iframe",
    height,
    width,
    params: {}
  });
  const srcdoc =
    '<!doctype html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:transparent">' +
    "<script>atOptions=" + options + ";<\\/script>" +
    '<script src="https://www.highperformanceformat.com/' +
    encodeURIComponent(clean) +
    '/invoke.js"><\\/script></body></html>';
  return (
    '<iframe title="Advertisement" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer-when-downgrade" width="' +
    width +
    '" height="' +
    height +
    '" srcdoc="' +
    escapeHtml(srcdoc) +
    '"></iframe><span class="ad-runtime-label">Advertisement</span>'
  );
}

function renderAds() {
  const ads = RUNTIME_CONFIG.ads || {};
  const header = $("#ad-header-slot");
  const content = $("#ad-content-slot");
  if (header) {
    header.hidden = !ads.headerKey;
    if (!header.hidden) header.innerHTML = adFrame(ads.headerKey, 728, 90);
  }
  if (content) {
    content.hidden = !ads.rectangleKey;
    if (!content.hidden) content.innerHTML = adFrame(ads.rectangleKey, 300, 250);
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

function swMessage(message) {
  return new Promise(async (resolve, reject) => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active || registration.waiting || registration.installing;
    if (!worker) return reject(new Error("Offline worker is unavailable."));
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => event.data?.error ? reject(new Error(event.data.error)) : resolve(event.data);
    worker.postMessage(message, [channel.port2]);
  });
}

async function downloadCurrent() {
  if (!state.media || !state.sources.length) return notify("Choose an episode before downloading.", true);
  const source = state.sources[0];
  const meta = {
    id: state.media.media_key,
    title: state.media.anime_title,
    episode: state.media.episode_number || state.media.episode_title || "",
    sourceUrl: source.url,
    hls: Boolean(source.hls),
    savedAt: Date.now()
  };
  $("#download-progress").textContent = "Preparing download…";
  try {
    const result = await swMessage({ type: "DOWNLOAD_MEDIA", meta });
    $("#download-progress").textContent = result?.message || "Download saved.";
    refreshDownloads();
  } catch (error) {
    $("#download-progress").textContent = error.message;
    notify(error.message, true);
  }
}

async function refreshDownloads() {
  const root = $("#downloads-manager");
  if (!root || !("serviceWorker" in navigator)) return;
  try {
    const items = (await swMessage({ type: "LIST_DOWNLOADS" }))?.items || [];
    root.innerHTML = items.length ? items.map((item) =>
      '<article class="download-card"><div><strong>' + escapeHtml(item.title) + '</strong><span>' +
      escapeHtml(item.episode) + '</span></div><div><button type="button" data-play="' +
      escapeHtml(item.id) + '">Play offline</button><button type="button" data-delete="' +
      escapeHtml(item.id) + '">Delete</button></div></article>'
    ).join("") : "<p>No downloaded episodes on this device.</p>";
    root.querySelectorAll("[data-play]").forEach((button) => button.addEventListener("click", () => {
      const item = items.find((entry) => entry.id === button.dataset.play);
      if (!item) return;
      const video = $("#watch-video");
      $("#watch-dialog").showModal();
      $(".watch-player").hidden = false;
      if (item.hls && window.Hls?.isSupported()) {
        const hls = new window.Hls();
        hls.loadSource(item.sourceUrl);
        hls.attachMedia(video);
      } else video.src = item.sourceUrl;
      video.play().catch(() => {});
    }));
    root.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
      await swMessage({ type: "DELETE_DOWNLOAD", id: button.dataset.delete });
      refreshDownloads();
    }));
  } catch (error) {
    root.textContent = "Offline storage is unavailable: " + error.message;
  }
}

function bindUi() {
  $("#account-button").addEventListener("click", () => {
    $("#account-dialog").showModal();
    if (state.user) showPanel("profile");
  });
  $("#account-close").addEventListener("click", () => $("#account-dialog").close());
  $("#account-dialog").addEventListener("click", (event) => {
    if (event.target === $("#account-dialog")) $("#account-dialog").close();
  });
  document.querySelectorAll("[data-auth]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.auth)));
  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => showPanel(button.dataset.page)));

  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.supabase) return;
    $("#auth-message").textContent = "";
    const mode = event.currentTarget.dataset.mode || "login";
    try {
      if (mode === "signup") {
        const result = await state.supabase.auth.signUp({
          email: $("#auth-email").value.trim(),
          password: $("#auth-password").value,
          options: {
            data: { display_name: $("#auth-name").value.trim() || "Anime Fan" },
            emailRedirectTo: location.origin + location.pathname
          }
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          $("#auth-message").textContent = "Account created. Check your email to confirm it, then log in.";
          return;
        }
      } else {
        const result = await state.supabase.auth.signInWithPassword({
          email: $("#auth-email").value.trim(),
          password: $("#auth-password").value
        });
        if (result.error) throw result.error;
      }
      await refreshSession();
      showPanel("profile");
    } catch (error) {
      $("#auth-message").textContent = error.message;
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    await state.supabase.auth.signOut();
    state.user = null;
    state.profile = null;
    renderAccount();
  });

  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await updateProfile({
        display_name: $("#profile-display-name").value.trim(),
        default_audio: $("#profile-audio").value,
        default_subtitle: $("#profile-subtitle").value
      });
      const file = $("#profile-avatar-input").files[0];
      if (file) await uploadAvatar(file);
      fillProfileForm();
      renderAccount();
      notify("Profile saved.");
    } catch (error) {
      notify(error.message, true);
    }
  });

  $("#appearance-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await updateProfile({
        theme: $("#appearance-theme").value,
        accent_color: $("#appearance-accent").value,
        density: $("#appearance-density").value
      });
      applyProfileTheme();
      notify("Appearance saved.");
    } catch (error) {
      notify(error.message, true);
    }
  });

  $("#player-settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await updateProfile({
        playback_speed: Number($("#player-speed").value),
        subtitle_font: $("#subtitle-font").value.trim(),
        subtitle_color: $("#subtitle-color").value,
        subtitle_background: $("#subtitle-background").value,
        subtitle_opacity: Number($("#subtitle-opacity").value),
        auto_skip_intro: $("#auto-skip-intro").checked,
        auto_skip_outro: $("#auto-skip-outro").checked,
        intro_seconds: Number($("#intro-seconds").value),
        outro_seconds: Number($("#outro-seconds").value)
      });
      applyProfileTheme();
      applyPlayerPreferences();
      notify("Player settings saved.");
    } catch (error) {
      notify(error.message, true);
    }
  });

  $("#new-list-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const name = $("#new-list-name").value.trim();
      const result = await state.supabase.from("watch_lists").insert({
        user_id: state.user.id,
        name,
        slug: await uniqueSlug(name),
        visibility: $("#new-list-visibility").value
      });
      if (result.error) throw result.error;
      $("#new-list-name").value = "";
      loadLists();
    } catch (error) {
      notify(error.message, true);
    }
  });

  $("#download-current").addEventListener("click", downloadCurrent);
}

function bindAppEvents() {
  window.addEventListener("aniwatch:anime-selected", (event) => {
    state.anime = event.detail?.anime || null;
    if (state.user) loadLists();
  });
  window.addEventListener("aniwatch:episode-selected", (event) => {
    const detail = event.detail || {};
    state.anime = detail.anime || state.anime;
    state.sources = detail.sources || [];
    state.media = {
      media_key: mediaKey(detail),
      provider: detail.provider || "unknown",
      anime_id: String(detail.streamId || detail.anime?.id || "unknown"),
      episode_id: String(detail.episode?.id || "unknown"),
      anime_title: detail.anime?.title || detail.streamTitle || "Untitled",
      episode_title: detail.episode?.title || null,
      episode_number: detail.episode?.number == null ? null : String(detail.episode.number)
    };
    $("#download-current").disabled = false;
    $("#player-download").disabled = false;
    resumeCurrent();
    applyPlayerPreferences();
  });
}

async function showPublicList() {
  if (!state.supabase) return;
  const value = new URLSearchParams(location.search).get("publicList");
  if (!value) return;
  const parts = value.split("/");
  if (parts.length !== 2) return;
  const userId = parts[0];
  const slug = parts[1];
  const listResult = await state.supabase.from("watch_lists").select("id,name,user_id").eq("user_id", userId).eq("slug", slug).eq("visibility", "PUBLIC").single();
  if (listResult.error) return;
  const [itemsResult, ownerResult] = await Promise.all([
    state.supabase.from("list_items").select("*").eq("list_id", listResult.data.id).order("added_at", { ascending: false }),
    state.supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()
  ]);
  if (itemsResult.error) return;
  $("#account-dialog").showModal();
  $(".account-nav").hidden = true;
  $("#auth-view").hidden = true;
  $("#account-view").hidden = false;
  $(".account-content").innerHTML =
    "<section><h3>" + escapeHtml(listResult.data.name) + "</h3><p>Shared by " +
    escapeHtml(ownerResult.data?.display_name || "AniWatch user") +
    '</p><div class="public-list-grid">' +
    ((itemsResult.data || []).map((item) => "<article><strong>" + escapeHtml(item.title) + "</strong></article>").join("") || "<p>This list is empty.</p>") +
    "</div></section>";
}

async function init() {
  injectUi();
  setAuthMode("login");
  state.supabase = createCloudClient();
  bindUi();
  bindPlayer();
  bindAppEvents();
  await registerServiceWorker();

  if (state.supabase) {
    state.supabase.auth.onAuthStateChange(() => setTimeout(() => refreshSession().catch(console.warn), 0));
    await refreshSession();
  } else {
    renderAccount();
  }

  renderAds();
  await showPublicList();
}

init().catch((error) => {
  console.error(error);
  notify("AniWatch account features could not start.", true);
});
