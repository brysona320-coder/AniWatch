import { fetchAnime, PROVIDERS } from "./providers.js";
import { STREAMS } from "./streams.js";

const STORAGE = {
  favorites: "aniwatch:favorites",
  provider: "aniwatch:provider",
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
  dialogSource: $("#dialog-source"),
  dialogTrailer: $("#dialog-trailer"),
  streamGrid: $("#stream-grid"),
  watchDialog: $("#watch-dialog"),
  watchClose: $("#watch-close"),
  watchVideo: $("#watch-video"),
  watchTitle: $("#watch-title"),
  watchDescription: $("#watch-description"),
  watchError: $("#watch-error"),
  watchSource: $("#watch-source"),
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
const savedProvider = readStorage(STORAGE.provider, "anilist");
const state = {
  provider: PROVIDERS[savedProvider] ? savedProvider : "anilist",
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
};

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
function renderStreams() {
  const fragment = document.createDocumentFragment();
  for (const film of STREAMS) {
    const card = document.createElement("article");
    card.className = "stream-card";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stream-cover";
    button.setAttribute("aria-label", `Watch ${film.title}`);
    const poster = document.createElement("img");
    poster.src = film.poster;
    poster.alt = "";
    poster.loading = "lazy";
    const play = document.createElement("span");
    play.className = "stream-play";
    play.textContent = "▶";
    play.setAttribute("aria-hidden", "true");
    button.append(poster, play);
    button.addEventListener("click", () => openStream(film));
    const title = document.createElement("h3");
    title.textContent = film.title;
    const meta = document.createElement("p");
    meta.textContent = `${film.year} · Full film`;
    card.append(button, title, meta);
    fragment.append(card);
  }
  elements.streamGrid.replaceChildren(fragment);
}
function openStream(film) {
  elements.watchTitle.textContent = film.title;
  elements.watchDescription.textContent = film.description;
  elements.watchSource.href = film.sourceUrl;
  elements.watchError.textContent = "";
  elements.watchVideo.poster = film.poster;
  elements.watchVideo.src = film.videoUrl;
  elements.watchDialog.showModal();
  elements.watchVideo.play().catch(() => {
    // Native controls remain available if autoplay is blocked.
  });
}
function clearStream() {
  elements.watchVideo.pause();
  elements.watchVideo.removeAttribute("src");
  elements.watchVideo.removeAttribute("poster");
  elements.watchVideo.load();
  elements.watchError.textContent = "";
}
function closeStream() {
  elements.watchDialog.close();
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
      ? "Explore matches from your selected source."
      : "Discover more titles from anime catalogs.";
  elements.mode.textContent = state.watchlist
    ? "WATCHLIST"
    : state.query
      ? "SEARCH"
      : "TOP RATED";
  elements.source.textContent = state.watchlist
    ? "SAVED IN THIS BROWSER"
    : `POWERED BY ${PROVIDERS[state.provider].label.toUpperCase()}`;
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
      provider: state.provider,
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
  state.provider = elements.provider.value;
  writeStorage(STORAGE.provider, state.provider);
  startCatalog();
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
elements.watchClose.addEventListener("click", closeStream);
elements.watchDialog.addEventListener("click", (event) => {
  if (event.target === elements.watchDialog) closeStream();
});
elements.watchDialog.addEventListener("close", clearStream);
elements.watchVideo.addEventListener("error", () => {
  if (elements.watchVideo.currentSrc) {
    elements.watchError.textContent =
      "This video could not play in your browser. Try the file on Wikimedia Commons.";
  }
});
elements.watchVideo.addEventListener("playing", () => {
  elements.watchError.textContent = "";
});

elements.provider.value = state.provider;
setTheme(readStorage(STORAGE.theme, "dark") === "light" ? "light" : "dark");
updateWatchlistControls();
renderStreams();
startCatalog();
