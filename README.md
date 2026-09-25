# AniWatch

A small, dependency-free anime discovery site. Browse top rated titles or search Jikan, AniList, and Kitsu, filter by format, inspect details and trailers, and save a watchlist locally in your browser.

## Run

Serve the repository with any static file server, for example:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Internet access is needed for anime data, cover images, and the optional web font. The site does not host or stream episodes. Watchlist and display preferences are stored only in this browser. Provider request limits or outages may temporarily prevent results; choose another source from the header if needed.

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
