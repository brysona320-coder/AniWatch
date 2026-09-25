import {
  fetchManga,
  fetchChapters,
  fetchChapterPages,
  mangaApiUrl,
  MANGA_API_STORAGE,
} from "./manga.js?v=20260925-1";
import { validBaseUrl } from "./api.js?v=20260925-1";

const $ = (selector) => document.querySelector(selector);
const el = {
  animeTab: $("#anime-tab"),
  mangaTab: $("#manga-tab"),
  animeView: $("#anime-view"),
  mangaView: $("#manga-view"),
  animeSearch: $("#search-form"),
  provider: $(".provider-control"),
  watchlist: $("#watchlist-toggle"),
  browse: $(".watch-now-link"),
  form: $("#manga-search-form"),
  search: $("#manga-search"),
  grid: $("#manga-grid"),
  count: $("#manga-count"),
  error: $("#manga-error"),
  more: $("#manga-more"),
  library: $("#manga-library-toggle"),
  libraryCount: $("#manga-library-count"),
  apiForm: $("#manga-api-form"),
  apiInput: $("#manga-api-url"),
  apiMessage: $("#manga-api-message"),
  dialog: $("#manga-dialog"),
  close: $("#manga-close"),
  cover: $("#manga-cover"),
  title: $("#manga-dialog-title"),
  description: $("#manga-description"),
  save: $("#manga-save"),
  source: $("#manga-source"),
  chapters: $("#manga-chapters"),
  chapterStatus: $("#manga-chapter-status"),
  moreChapters: $("#manga-more-chapters"),
  reader: $("#manga-reader"),
  readerClose: $("#manga-reader-close"),
  readerTitle: $("#manga-reader-title"),
  readerChapter: $("#manga-reader-chapter"),
  readerStatus: $("#manga-reader-status"),
  pages: $("#manga-pages"),
  quality: $("#manga-quality"),
  prev: $("#manga-prev"),
  next: $("#manga-next"),
};

const state = {
  mode: "anime",
  query: "",
  offset: 0,
  total: 0,
  list: false,
  manga: null,
  chapters: [],
  chapterOffset: 0,
  chapterTotal: 0,
  chapter: null,
  catalogRequest: 0,
  chapterRequest: 0,
  pageRequest: 0,
};
const STORAGE = "aniwatch:manga-reading-list";
let library = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || "[]");
  if (Array.isArray(saved))
    library = new Map(
      saved
        .filter((item) => item?.id && item?.title)
        .map((item) => [item.id, item]),
    );
} catch {
  /* A damaged saved list should not stop the catalog. */
}

function setMode(mode) {
  state.mode = mode;
  const manga = mode === "manga";
  el.animeView.hidden = manga;
  el.mangaView.hidden = !manga;
  el.animeSearch.hidden = manga;
  el.provider.hidden = manga;
  el.watchlist.hidden = manga;
  el.animeTab.classList.toggle("active", !manga);
  el.mangaTab.classList.toggle("active", manga);
  el.animeTab.toggleAttribute("aria-current", !manga);
  el.mangaTab.toggleAttribute("aria-current", manga);
  el.browse.href = manga ? "#manga-view" : "#discover";
  el.browse.lastChild.textContent = manga ? " Browse manga" : " Browse anime";
  if (manga && !el.grid.children.length) loadCatalog();
}

function setEmpty(message, retry) {
  const box = document.createElement("div");
  box.className = "empty-state";
  const heading = document.createElement("h3");
  heading.textContent = message;
  box.append(heading);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Try again";
    button.addEventListener("click", retry);
    box.append(button);
  }
  if (message.startsWith("Could not load manga")) {
    const link = document.createElement("a");
    link.href = "https://mangadex.org";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Read on MangaDex ↗";
    box.append(link);
  }
  el.grid.replaceChildren(box);
}

function saveLibrary() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify([...library.values()]));
  } catch {
    /* Reading still works without storage. */
  }
  el.libraryCount.textContent = String(library.size);
  el.save.textContent = library.has(state.manga?.id)
    ? "♥ In reading list"
    : "♡ Add to reading list";
}

function cardFor(manga) {
  const card = document.createElement("article");
  card.className = "anime-card";
  const cover = document.createElement("button");
  cover.type = "button";
  cover.className = "card-cover";
  cover.setAttribute("aria-label", `Read ${manga.title}`);
  if (manga.cover) {
    const image = document.createElement("img");
    image.src = manga.cover;
    image.alt = "";
    image.loading = "lazy";
    cover.append(image);
  } else {
    cover.classList.add("cover-placeholder");
    cover.textContent = "▤";
  }
  cover.addEventListener("click", () => openDetails(manga));
  const details = document.createElement("div");
  details.className = "card-details";
  const title = document.createElement("button");
  title.type = "button";
  title.className = "card-title";
  title.textContent = manga.title;
  title.addEventListener("click", () => openDetails(manga));
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.textContent =
    [manga.year, manga.status].filter(Boolean).join(" · ") || "MangaDex";
  details.append(title, meta);
  card.append(cover, details);
  return card;
}

function renderLibrary() {
  el.grid.replaceChildren(...[...library.values()].map(cardFor));
  if (!library.size) setEmpty("Your reading list is empty.");
  el.count.textContent = `${library.size} saved`;
  el.more.hidden = true;
}

async function loadCatalog(append = false) {
  if (state.list) return renderLibrary();
  const request = ++state.catalogRequest;
  el.error.textContent = "";
  el.more.hidden = true;
  if (!append) {
    el.grid.replaceChildren();
    el.count.textContent = "Loading manga…";
  } else el.more.disabled = true;
  try {
    const result = await fetchManga(state.query, append ? state.offset : 0);
    if (request !== state.catalogRequest || state.list) return;
    if (!append) el.grid.replaceChildren();
    el.grid.append(...result.items.map(cardFor));
    state.offset = result.offset + 20;
    state.total = result.total;
    el.count.textContent = `${Math.min(state.offset, state.total)} of ${state.total}`;
    el.more.hidden = state.offset >= state.total;
    if (!el.grid.children.length) setEmpty("No manga found.");
  } catch (error) {
    if (request !== state.catalogRequest) return;
    if (!append)
      setEmpty("Could not load manga from MangaDex.", () => loadCatalog());
    else el.more.hidden = false;
    el.error.textContent = error.message;
    if (
      location.hostname.endsWith("github.io") &&
      mangaApiUrl() === "https://api.mangadex.org"
    )
      el.error.textContent =
        "MangaDex does not allow direct API requests from GitHub Pages. Enter a CORS-enabled URL in Manga API settings.";
  } finally {
    el.more.disabled = false;
  }
}

async function openDetails(manga) {
  state.manga = manga;
  state.chapters = [];
  state.chapterOffset = 0;
  state.chapterTotal = 0;
  ++state.chapterRequest;
  el.title.textContent = manga.title;
  el.description.textContent = manga.description;
  el.cover.src = manga.cover || "";
  el.cover.alt = manga.cover ? `Cover art for ${manga.title}` : "";
  el.source.href = manga.url;
  el.chapters.replaceChildren();
  el.chapterStatus.textContent = "Loading chapters…";
  el.moreChapters.hidden = true;
  saveLibrary();
  el.dialog.showModal();
  loadChapters();
}

async function loadChapters() {
  const mangaId = state.manga?.id;
  if (!mangaId) return;
  const request = ++state.chapterRequest;
  el.moreChapters.disabled = true;
  try {
    const result = await fetchChapters(mangaId, state.chapterOffset);
    if (request !== state.chapterRequest || state.manga?.id !== mangaId) return;
    state.chapters.push(...result.items);
    state.chapterOffset = result.nextOffset;
    state.chapterTotal = result.total;
    const buttons = result.items.map((chapter) => {
      const button = document.createElement(chapter.pages ? "button" : "a");
      button.className = "manga-chapter";
      button.textContent = `${chapter.label}${chapter.pages ? ` · ${chapter.pages} pages` : " · Publisher ↗"}`;
      if (chapter.pages) {
        button.type = "button";
        button.addEventListener("click", () => openChapter(chapter));
      } else {
        button.href = chapter.externalUrl;
        button.target = "_blank";
        button.rel = "noopener noreferrer";
      }
      return button;
    });
    el.chapters.append(...buttons);
    el.chapterStatus.textContent = state.chapters.length
      ? `${state.chapters.length} chapters shown`
      : "No English chapters available for this title.";
    el.moreChapters.hidden = state.chapterOffset >= state.chapterTotal;
  } catch (error) {
    if (request === state.chapterRequest)
      el.chapterStatus.textContent = `Could not load chapters: ${error.message}`;
  } finally {
    el.moreChapters.disabled = false;
  }
}

async function openChapter(chapter) {
  state.chapter = chapter;
  const request = ++state.pageRequest;
  el.dialog.close();
  el.readerTitle.textContent = state.manga.title;
  el.readerChapter.textContent = chapter.label;
  el.readerStatus.textContent = "Loading pages…";
  el.pages.replaceChildren();
  const readable = state.chapters.filter((item) => item.pages > 0);
  const index = readable.findIndex((item) => item.id === chapter.id);
  el.prev.disabled = index <= 0;
  el.next.disabled = index < 0 || index >= readable.length - 1;
  if (!el.reader.open) el.reader.showModal();
  el.reader.scrollTop = 0;
  try {
    const pages = await fetchChapterPages(chapter.id, el.quality.value);
    if (request !== state.pageRequest || state.chapter?.id !== chapter.id)
      return;
    el.pages.replaceChildren(
      ...pages.map((url, i) => {
        const image = document.createElement("img");
        image.src = url;
        image.alt = `Page ${i + 1}`;
        image.loading = i < 2 ? "eager" : "lazy";
        image.decoding = "async";
        return image;
      }),
    );
    el.readerStatus.textContent = `${pages.length} pages`;
  } catch (error) {
    if (request === state.pageRequest)
      el.readerStatus.textContent = error.message;
  }
}

function closeReader() {
  ++state.pageRequest;
  el.reader.close();
  el.pages.replaceChildren();
  if (state.manga) el.dialog.showModal();
}

el.animeTab.addEventListener("click", () => setMode("anime"));
el.mangaTab.addEventListener("click", () => setMode("manga"));
$("#home-link").addEventListener("click", () => setMode("anime"));
el.form.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = el.search.value.trim();
  state.list = false;
  el.library.setAttribute("aria-pressed", "false");
  loadCatalog();
});
el.apiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = validBaseUrl(el.apiInput.value);
  if (!url) {
    el.apiMessage.textContent = "Enter an HTTPS API URL.";
    return;
  }
  try {
    localStorage.setItem(MANGA_API_STORAGE, url);
  } catch {
    el.apiMessage.textContent = "Could not save this URL in your browser.";
    return;
  }
  el.apiMessage.textContent = "Saved. Loading manga…";
  state.offset = 0;
  loadCatalog();
});
el.more.addEventListener("click", () => loadCatalog(true));
el.library.addEventListener("click", () => {
  state.list = !state.list;
  ++state.catalogRequest;
  el.library.setAttribute("aria-pressed", String(state.list));
  state.list ? renderLibrary() : loadCatalog();
});
el.close.addEventListener("click", () => el.dialog.close());
el.dialog.addEventListener("click", (event) => {
  if (event.target === el.dialog) el.dialog.close();
});
el.save.addEventListener("click", () => {
  if (!state.manga) return;
  library.has(state.manga.id)
    ? library.delete(state.manga.id)
    : library.set(state.manga.id, state.manga);
  saveLibrary();
  if (state.list) renderLibrary();
});
el.moreChapters.addEventListener("click", loadChapters);
el.readerClose.addEventListener("click", closeReader);
el.reader.addEventListener("close", () => {
  ++state.pageRequest;
  el.pages.replaceChildren();
});
el.quality.addEventListener("change", () => {
  if (state.chapter && el.reader.open) openChapter(state.chapter);
});
el.prev.addEventListener("click", () => {
  const readable = state.chapters.filter((item) => item.pages > 0);
  const index = readable.findIndex((item) => item.id === state.chapter?.id);
  if (index > 0) openChapter(readable[index - 1]);
});
el.next.addEventListener("click", () => {
  const readable = state.chapters.filter((item) => item.pages > 0);
  const index = readable.findIndex((item) => item.id === state.chapter?.id);
  if (index >= 0 && index < readable.length - 1)
    openChapter(readable[index + 1]);
});
el.libraryCount.textContent = String(library.size);
el.apiInput.value = mangaApiUrl();
if (location.hash === "#manga-view" || location.hash === "#manga")
  setMode("manga");
