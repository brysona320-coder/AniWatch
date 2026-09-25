# AniWatch

A small, dependency-free anime site. Watch eight public-domain Japanese animated films on the site, browse or search Jikan, AniList, and Kitsu catalogs, and save a watchlist locally in your browser.

## Run

Serve the repository with any static file server, for example:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The full films stream directly from Wikimedia Commons when you press play. Internet access is also needed for catalog data, cover images, and the optional web font. Watchlist and display preferences are stored only in this browser. Provider request limits or outages may temporarily prevent catalog results; choose another source from the header if needed.

## Video sources

The playable films are listed in [`src/streams.js`](src/streams.js). Each entry links to its Wikimedia Commons file page, where its public-domain status can be checked. To add another film you have the right to stream, add a unique `id`, `title`, `year`, `description`, `poster`, direct HTTPS WebM or MP4 `videoUrl`, and `sourceUrl` to that list. The site uses native browser video controls and clears the video source when the player closes.

Jikan, AniList, and Kitsu are **catalog sources**. Their records and trailer URLs do not grant full-episode playback. Titles from those catalogs need a separate playable, permitted video source before they can be watched on this site.

## Checks

```sh
node --test
```

## Deploy to GitHub Pages

AniWatch is a static site. Its `index.html` and `.nojekyll` files are at the repository root, so GitHub Pages can publish it directly from a branch without a build step.

1. Merge the app into `main` (or select this feature branch to publish it before merging).
2. A repository admin opens **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**. Select the branch containing the app and **/ (root)** as the folder, then save.
3. Wait for the Pages deployment to finish. The project site should be available at <https://brysona320-coder.github.io/AniWatch/>. GitHub also displays the live URL in **Settings → Pages**.

The app uses relative asset paths, so it works under the `/AniWatch/` project path. No build command, API key, or package installation is required for the site itself.
