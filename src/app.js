import { fetchAnime, ANIAPI_DEFAULT, PROVIDERS } from "./providers.js";
import { validBaseUrl } from "./api.js";
import {
  CONSUMET_DEFAULT,
  STREAM_PROVIDERS,
  searchStreams,
  getStreamInfo,
  getEpisodeSources,
} from "./streaming.js";

const STORAGE = {
  favorites: "aniwatch:favorites",
  streamProvider: "aniwatch:stream-provider",
  aniapiUrl: "aniwatch:aniapi-url",
  consumetUrl: "aniwatch:consumet-url",
  theme: "aniwatch:theme",
};
const $ = (selector) => document.querySelector(selector);
const elements = {
  home: $("#home-link"),
  searchForm: $("#search-form"),
  search: $("#search-input"),
  provider: $("#provider-select"),
  theme: $("#theme-toggle"),
  watchlist: $("#watchlist-toggle"),
  watchlistCount: $("#watchlist-count"),
  filters: $("#filter-row"),
  grid: $("#anime-grid"),
  loadMore: $("#load-more"),
  pageError: $("#page-error"),
  hero: $("#hero"),
  heading: $("#catalog-title"),
  subtitle: $("#catalog-subtitle"),
  mode: $("#section-mode"),
  source: $("#source-label"),
  count: $("#result-count"),
  dialog: $("#anime-dialog"),
  dialogClose: $("#dialog-close"),
  dialogImage: $("#dialog-image"),
  dialogProvider: $("#dialog-provider"),
  dialogTitle: $("#dialog-title"),
  dialogMeta: $("#dialog-meta"),
  dialogDescription: $("#dialog-description"),
  dialogFavorite: $("#dialog-favorite"),
  dialogWatch: $("#dialog-watch"),
  dialogSource: $("#dialog-source"),
  dialogTrailer: $("#dialog-trailer"),
  settings: $("#api-settings"),
  settingsForm: $("#api-settings-form"),
  aniapiUrl: $("#aniapi-url"),
  consumetUrl: $("#consumet-url"),
  settingsMessage: $("#settings-message"),
  watchDialog: $("#watch-dialog"),
  watchClose: $("#watch-close"),
  watchPlayer: $(".watch-player"),
  watchVideo: $("#watch-video"),
  watchTitle: $("#watch-title"),
  watchDescription: $("#watch-description"),
  watchError: $("#watch-error"),
  streamSearchForm: $("#stream-search-form"),
  streamSearchInput: $("#stream-search-input"),
  streamMatches: $("#stream-matches"),
  streamEpisodes: $("#stream-episodes"),
  moreEpisodes: $("#more-episodes"),
  quality: $("#quality-select"),
};

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing may disable storage. */
  }
}

const savedFavorites = readStorage(STORAGE.favorites, []);
const favorites = new Map(
  Array.isArray(savedFavorites)
    ? savedFavorites
        .filter(
          (item) =>
            item &&
            PROVIDERS[item.provider] &&
            item.key === `${item.provider}:${item.id}` &&
            typeof item.title === "string",
        )
        .map((item) => [item.key, item])
    : [],
);
const savedProvider = readStorage(STORAGE.streamProvider, "animekai");
const state = {
  streamProvider: STREAM_PROVIDERS[savedProvider] ? savedProvider : "animekai",
  aniapiUrl:
    validBaseUrl(readStorage(STORAGE.aniapiUrl, ANIAPI_DEFAULT)) ||
    ANIAPI_DEFAULT,
  consumetUrl:
    validBaseUrl(readStorage(STORAGE.consumetUrl, CONSUMET_DEFAULT)) ||
    CONSUMET_DEFAULT,
  query: "",
  type: "all",
  watchlist: false,
  page: 0,
  hasMore: false,
  items: [],
  controller: null,
  requestId: 0,
  busy: false,
  selected: null,
  watchAnime: null,
  streamTitle: "",
  streamId: "",
  episodePage: 0,
  episodes: [],
  streamController: null,
  streamRequestId: 0,
  videoSources: [],
};
let hlsPlayer = null;

function plainText(html) {
  return (
    new DOMParser()
      .parseFromString(html || "", "text/html")
      .body.textContent?.trim() || ""
  );
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.theme.setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
  elements.theme.innerHTML =
    theme === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  writeStorage(STORAGE.theme, theme);
}
function clearStream() {
  hlsPlayer?.destroy();
  hlsPlayer = null;
  elements.watchVideo.pause();
  elements.watchVideo.removeAttribute("src");
  elements.watchVideo.load();
  elements.watchPlayer.hidden = true;
  elements.quality.replaceChildren(new Option("Choose an episode", ""));
  elements.quality.disabled = true;
  elements.watchError.textContent = "";
}
function closeStream() {
  elements.watchDialog.close();
}

function nextStreamRequest() {
  state.streamController?.abort();
  state.streamController = new AbortController();
  return { signal: state.streamController.signal, id: ++state.streamRequestId };
}
function watchFailure(error, id) {
  if (id !== state.streamRequestId || error.name === "AbortError") return;
  elements.watchError.textContent =
    error.message || "Could not load this stream.";
  elements.watchDescription.textContent =
    "Check the API settings or choose another streaming source.";
}
function openWatch(anime) {
  closeDetails();
  state.watchAnime = anime;
  state.streamId = "";
  state.episodes = [];
  elements.watchTitle.textContent = anime.title;
  elements.streamSearchInput.value = anime.title;
  elements.watchDialog.showModal();
  searchWatch();
}
async function searchWatch() {
  if (!state.watchAnime) return;
  const request = nextStreamRequest();
  clearStream();
  state.streamId = "";
  state.episodes = [];
  state.episodePage = 0;
  elements.streamMatches.replaceChildren();
  elements.streamEpisodes.replaceChildren();
  elements.moreEpisodes.hidden = true;
  elements.watchDescription.textContent = `Searching ${STREAM_PROVIDERS[state.streamProvider]} for matching titles…`;
  try {
    const matches = await searchStreams({
      baseUrl: state.consumetUrl,
      provider: state.streamProvider,
      query: elements.streamSearchInput.value.trim() || state.watchAnime.title,
      signal: request.signal,
    });
    if (request.id !== state.streamRequestId) return;
    elements.watchDescription.textContent = matches.length
      ? "Choose the matching series to see its episodes."
      : "No matching series found. Try the other streaming source.";
    for (const match of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stream-match";
      button.dataset.streamId = match.id;
      button.textContent = `${match.title}${match.releaseDate ? ` · ${match.releaseDate}` : ""}${match.subOrDub ? ` · ${match.subOrDub}` : ""}`;
      button.addEventListener("click", () => selectStream(match));
      elements.streamMatches.append(button);
    }
  } catch (error) {
    watchFailure(error, request.id);
  }
}
async function selectStream(match) {
  const request = nextStreamRequest();
  clearStream();
  state.streamId = match.id;
  state.streamTitle = match.title;
  state.episodes = [];
  state.episodePage = 0;
  elements.streamEpisodes.replaceChildren();
  elements.moreEpisodes.hidden = true;
  elements.streamMatches.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.streamId === match.id);
  });
  elements.watchDescription.textContent = `Loading episodes for ${match.title}…`;
  await loadEpisodes(request);
}
async function loadEpisodes(existingRequest) {
  if (!state.streamId) return;
  const request = existingRequest || nextStreamRequest();
  const nextPage = state.episodePage + 1;
  elements.moreEpisodes.disabled = true;
  try {
    const info = await getStreamInfo({
      baseUrl: state.consumetUrl,
      provider: state.streamProvider,
      id: state.streamId,
      episodePage: nextPage,
      signal: request.signal,
    });
    if (request.id !== state.streamRequestId) return;
    const known = new Set(state.episodes.map((episode) => episode.id));
    const additional = info.episodes.filter(
      (episode) => !known.has(episode.id),
    );
    state.episodes.push(...additional);
    state.episodePage = nextPage;
    elements.watchDescription.textContent = state.episodes.length
      ? `Choose an episode of ${state.streamTitle}.`
      : "No episodes are available for this title.";
    for (const episode of additional) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "episode-button";
      button.textContent = `Episode ${episode.number}${episode.title ? ` · ${episode.title}` : ""}`;
      button.addEventListener("click", () => selectEpisode(episode, button));
      elements.streamEpisodes.append(button);
    }
    elements.moreEpisodes.hidden =
      state.streamProvider !== "animepahe" ||
      !additional.length ||
      state.episodes.length >= info.totalEpisodes;
  } catch (error) {
    watchFailure(error, request.id);
  } finally {
    if (request.id === state.streamRequestId)
      elements.moreEpisodes.disabled = false;
  }
}
async function selectEpisode(episode, button) {
  const request = nextStreamRequest();
  clearStream();
  elements.watchDescription.textContent = `Loading episode ${episode.number}…`;
  try {
    const result = await getEpisodeSources({
      baseUrl: state.consumetUrl,
      provider: state.streamProvider,
      episodeId: episode.id,
      signal: request.signal,
    });
    if (request.id !== state.streamRequestId) return;
    if (!result.sources.length)
      throw new Error("No browser-playable video sources were returned.");
    state.videoSources = result.sources;
    elements.streamEpisodes
      .querySelectorAll("button")
      .forEach((item) => item.classList.toggle("active", item === button));
    elements.quality.replaceChildren(
      ...result.sources.map(
        (source, index) => new Option(source.quality, String(index)),
      ),
    );
    elements.quality.disabled = false;
    elements.watchDescription.textContent = `${state.streamTitle} · Episode ${episode.number}`;
    if (result.needsHeaders)
      elements.watchError.textContent =
        "This source may require request headers that a browser cannot send. If playback fails, try another source.";
    playSource(result.sources[0]);
  } catch (error) {
    watchFailure(error, request.id);
  }
}
function playSource(source) {
  clearVideoOnly();
  elements.watchPlayer.hidden = false;
  const video = elements.watchVideo;
  if (source.hls) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.url;
    } else if (window.Hls?.isSupported()) {
      hlsPlayer = new window.Hls();
      hlsPlayer.loadSource(source.url);
      hlsPlayer.attachMedia(video);
      hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Native controls remain available when autoplay is blocked.
        });
      });
      hlsPlayer.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal)
          elements.watchError.textContent =
            "The HLS stream could not play. Check browser codec support or try another source.";
      });
    } else {
      elements.watchError.textContent =
        "HLS playback is unavailable in this browser.";
      return;
    }
  } else {
    video.src = source.url;
  }
  if (!hlsPlayer)
    video.play().catch(() => {
      // Native controls remain available when autoplay is blocked.
    });
}
function clearVideoOnly() {
  hlsPlayer?.destroy();
  hlsPlayer = null;
  elements.watchVideo.pause();
  elements.watchVideo.removeAttribute("src");
  elements.watchVideo.load();
}
function updateWatchlistControls() {
  elements.watchlist.setAttribute("aria-pressed", String(state.watchlist));
  elements.watchlistCount.textContent = String(favorites.size);
  elements.dialogFavorite.textContent =
    state.selected && favorites.has(state.selected.key)
      ? "♥ In watchlist"
      : "♡ Add to watchlist";
}
function updateHeading() {
  const title = state.watchlist
    ? "Your watchlist"
    : state.query
      ? `Results for “${state.query}”`
      : "Top rated anime";
  elements.heading.replaceChildren(
    document.createTextNode(title),
    Object.assign(document.createElement("span"), {
      className: "heading-period",
      textContent: ".",
    }),
  );
  elements.subtitle.textContent = state.watchlist
    ? "The stories you saved, all in one place."
    : state.query
      ? "Explore matches from AniAPI."
      : "Discover more titles from AniAPI.";
  elements.mode.textContent = state.watchlist
    ? "WATCHLIST"
    : state.query
      ? "SEARCH"
      : "TOP RATED";
  elements.source.textContent = state.watchlist
    ? "SAVED IN THIS BROWSER"
    : "POWERED BY ANIAPI";
  elements.hero.hidden = state.watchlist || Boolean(state.query);
  elements.filters.hidden = state.watchlist;
  elements.count.textContent = state.items.length
    ? `${state.items.length} titles`
    : "";
  elements.loadMore.hidden = state.watchlist || !state.hasMore;
  elements.loadMore.disabled = state.busy;
}
function showSkeletons() {
  elements.grid.replaceChildren();
  for (let index = 0; index < 10; index++) {
    const card = document.createElement("div");
    card.className = "anime-card";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML =
      '<div class="skeleton-cover"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div>';
    elements.grid.append(card);
  }
}
function showMessage(icon, title, description, retry = false) {
  const box = document.createElement("div");
  box.className = "empty-state";
  const symbol = document.createElement("span");
  symbol.className = "empty-icon";
  symbol.textContent = icon;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = description;
  box.append(symbol, heading, text);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Try again";
    button.addEventListener("click", () => loadPage(true));
    box.append(button);
  }
  elements.grid.replaceChildren(box);
}
function formatType(type) {
  return type?.toUpperCase() || "UNKNOWN";
}
function createCard(anime, index) {
  const card = document.createElement("article");
  card.className = "anime-card";
  const cover = document.createElement("button");
  cover.className = "card-cover";
  cover.type = "button";
  cover.setAttribute("aria-label", `View details for ${anime.title}`);
  if (anime.image) {
    const image = document.createElement("img");
    image.src = anime.image;
    image.alt = "";
    image.loading = "lazy";
    cover.append(image);
  } else {
    cover.classList.add("cover-placeholder");
    cover.textContent = "✦";
  }
  if (!state.watchlist && !state.query) {
    const rank = document.createElement("span");
    rank.className = "card-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    cover.append(rank);
  }
  if (anime.score != null && Number.isFinite(anime.score)) {
    const score = document.createElement("span");
    score.className = "card-score";
    score.innerHTML = '<span aria-hidden="true">★</span> ';
    score.append(document.createTextNode(anime.score.toFixed(1)));
    cover.append(score);
  }
  cover.addEventListener("click", () => openDetails(anime));
  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = "card-favorite";
  favorite.setAttribute(
    "aria-label",
    `${favorites.has(anime.key) ? "Remove" : "Add"} ${anime.title} ${favorites.has(anime.key) ? "from" : "to"} watchlist`,
  );
  favorite.setAttribute("aria-pressed", String(favorites.has(anime.key)));
  favorite.textContent = favorites.has(anime.key) ? "♥" : "♡";
  favorite.addEventListener("click", () => toggleFavorite(anime));
  const details = document.createElement("div");
  details.className = "card-details";
  const title = document.createElement("button");
  title.type = "button";
  title.className = "card-title";
  title.textContent = anime.title;
  title.addEventListener("click", () => openDetails(anime));
  const meta = document.createElement("div");
  meta.className = "card-meta";
  const type = document.createElement("span");
  type.textContent = formatType(anime.type);
  meta.append(type);
  if (anime.year) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.textContent = "•";
    const year = document.createElement("span");
    year.textContent = anime.year;
    meta.append(dot, year);
  }
  details.append(title, meta);
  card.append(cover, favorite, details);
  return card;
}
function renderItems() {
  elements.grid.replaceChildren();
  if (!state.items.length) {
    showMessage(
      state.watchlist ? "♡" : "⌕",
      state.watchlist ? "Your watchlist is empty" : "No anime found",
      state.watchlist
        ? "Save an anime with the heart button and it will appear here."
        : "Try another search or format.",
    );
  } else {
    const fragment = document.createDocumentFragment();
    state.items.forEach((anime, index) =>
      fragment.append(createCard(anime, index)),
    );
    elements.grid.append(fragment);
  }
  updateHeading();
}
async function loadPage(reset = false) {
  if (state.watchlist || (state.busy && !reset)) return;
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  const requestId = ++state.requestId;
  const nextPage = reset ? 1 : state.page + 1;
  state.busy = true;
  elements.pageError.textContent = "";
  if (reset) {
    state.items = [];
    state.hasMore = false;
    showSkeletons();
  }
  updateHeading();
  try {
    const result = await fetchAnime({
      baseUrl: state.aniapiUrl,
      query: state.query,
      type: state.type,
      page: nextPage,
      signal: controller.signal,
    });
    if (requestId !== state.requestId) return;
    state.page = nextPage;
    state.hasMore = result.hasMore;
    const keys = new Set(state.items.map((item) => item.key));
    state.items.push(...result.items.filter((item) => !keys.has(item.key)));
    renderItems();
  } catch (error) {
    if (requestId !== state.requestId || error.name === "AbortError") return;
    if (reset)
      showMessage(
        "!",
        "Could not load anime",
        error.message || "Please try again.",
        true,
      );
    else
      elements.pageError.textContent = `${error.message || "Could not load more."} You can try loading more again.`;
  } finally {
    if (requestId === state.requestId) {
      state.busy = false;
      updateHeading();
    }
  }
}
function startCatalog() {
  state.watchlist = false;
  updateWatchlistControls();
  loadPage(true);
}
function showWatchlist() {
  state.controller?.abort();
  state.requestId++;
  state.busy = false;
  elements.pageError.textContent = "";
  state.watchlist = true;
  state.hasMore = false;
  state.items = [...favorites.values()];
  updateWatchlistControls();
  renderItems();
}
function toggleFavorite(anime) {
  if (favorites.has(anime.key)) favorites.delete(anime.key);
  else favorites.set(anime.key, anime);
  writeStorage(STORAGE.favorites, [...favorites.values()]);
  updateWatchlistControls();
  if (state.watchlist) {
    state.items = [...favorites.values()];
    renderItems();
  } else renderItems();
}
function openDetails(anime) {
  state.selected = anime;
  elements.dialogImage.src = anime.image || "";
  elements.dialogImage.alt = anime.image ? `Cover art for ${anime.title}` : "";
  elements.dialogProvider.textContent = `FROM ${PROVIDERS[anime.provider].label.toUpperCase()}`;
  elements.dialogTitle.textContent = anime.title;
  elements.dialogDescription.textContent =
    plainText(anime.description) || "No synopsis is available for this title.";
  elements.dialogMeta.replaceChildren();
  for (const value of [
    formatType(anime.type),
    anime.year,
    anime.score == null ? "" : `★ ${anime.score.toFixed(1)}`,
    anime.status,
  ]) {
    if (value) {
      const tag = document.createElement("span");
      tag.textContent = value;
      elements.dialogMeta.append(tag);
    }
  }
  elements.dialogSource.href = anime.url;
  elements.dialogTrailer.replaceChildren();
  if (anime.trailerId) {
    const play = document.createElement("button");
    play.type = "button";
    play.className = "trailer-play";
    play.textContent = "▶ Play trailer";
    play.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.src = `https://www.youtube-nocookie.com/embed/${anime.trailerId}?autoplay=1`;
      frame.title = `Trailer for ${anime.title}`;
      frame.allow = "autoplay; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      elements.dialogTrailer.replaceChildren(frame);
    });
    elements.dialogTrailer.append(play);
  }
  updateWatchlistControls();
  elements.dialog.showModal();
}
function closeDetails() {
  elements.dialog.close();
  elements.dialogTrailer.replaceChildren();
  state.selected = null;
}

let searchTimer;
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(searchTimer);
  state.query = elements.search.value.trim();
  startCatalog();
  $("#discover").scrollIntoView({ behavior: "smooth" });
});
elements.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = elements.search.value.trim();
    startCatalog();
  }, 500);
});
elements.provider.addEventListener("change", () => {
  state.streamProvider = elements.provider.value;
  writeStorage(STORAGE.streamProvider, state.streamProvider);
  if (elements.watchDialog.open) searchWatch();
});
elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const aniapiUrl = validBaseUrl(elements.aniapiUrl.value.trim());
  const consumetUrl = validBaseUrl(elements.consumetUrl.value.trim());
  if (!aniapiUrl || !consumetUrl) {
    elements.settingsMessage.textContent =
      "Use HTTPS URLs, or local HTTP URLs during development.";
    return;
  }
  const catalogChanged = state.aniapiUrl !== aniapiUrl;
  const streamChanged = state.consumetUrl !== consumetUrl;
  state.aniapiUrl = aniapiUrl;
  state.consumetUrl = consumetUrl;
  writeStorage(STORAGE.aniapiUrl, aniapiUrl);
  writeStorage(STORAGE.consumetUrl, consumetUrl);
  elements.settingsMessage.textContent = "API URLs saved in this browser.";
  if (catalogChanged) startCatalog();
  if (streamChanged && elements.watchDialog.open) searchWatch();
});
elements.theme.addEventListener("click", () =>
  setTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  ),
);
elements.watchlist.addEventListener("click", () =>
  state.watchlist ? startCatalog() : showWatchlist(),
);
elements.filters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-type]");
  if (!button) return;
  state.type = button.dataset.type;
  elements.filters.querySelectorAll("button").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  loadPage(true);
});
elements.loadMore.addEventListener("click", () => loadPage());
elements.home.addEventListener("click", (event) => {
  event.preventDefault();
  state.query = "";
  state.type = "all";
  elements.search.value = "";
  elements.filters.querySelectorAll("button").forEach((item) => {
    const active = item.dataset.type === "all";
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  startCatalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
elements.dialogClose.addEventListener("click", closeDetails);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDetails();
});
elements.dialog.addEventListener("close", () => {
  elements.dialogTrailer.replaceChildren();
  state.selected = null;
});
elements.dialogFavorite.addEventListener("click", () => {
  if (state.selected) toggleFavorite(state.selected);
});
elements.dialogWatch.addEventListener("click", () => {
  if (state.selected) openWatch(state.selected);
});
elements.watchClose.addEventListener("click", closeStream);
elements.watchDialog.addEventListener("click", (event) => {
  if (event.target === elements.watchDialog) closeStream();
});
elements.watchDialog.addEventListener("close", () => {
  state.streamController?.abort();
  state.streamRequestId++;
  state.watchAnime = null;
  clearStream();
});
elements.moreEpisodes.addEventListener("click", () => loadEpisodes());
elements.streamSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (elements.streamSearchInput.value.trim()) searchWatch();
});
elements.quality.addEventListener("change", () => {
  const source = state.videoSources[Number(elements.quality.value)];
  if (source) playSource(source);
});
elements.watchVideo.addEventListener("error", () => {
  if (elements.watchVideo.currentSrc) {
    elements.watchError.textContent =
      "This video could not play in your browser. The host may block direct playback or need a proxy.";
  }
});
elements.watchVideo.addEventListener("playing", () => {
  elements.watchError.textContent = "";
});

elements.provider.value = state.streamProvider;
elements.aniapiUrl.value = state.aniapiUrl;
elements.consumetUrl.value = state.consumetUrl;
setTheme(readStorage(STORAGE.theme, "dark") === "light" ? "light" : "dark");
updateWatchlistControls();
startCatalog();
