# AniWatch

A static anime explorer built for GitHub Pages. AniAPI supplies the catalog. A selected Consumet provider supplies title matches, episodes, and video links. The site offers AnimeKai and Animepahe as streaming choices and plays HTTPS MP4 and HLS video in its on-page player. Your watchlist and API URLs are saved in this browser.

## Run

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Search or choose an anime, click **Find episodes**, select the matching series, then select an episode. You can edit the streaming search if the names differ. The stream selector is in the header. The site asks you to choose the series because AniAPI IDs do not identify Consumet titles.

The public `api.aniapi.com` and `api.consumet.org` endpoints were unavailable when this version was built. The [API list supplied for this project](https://github.com/Munna-Scriptz/free-anime-apis) links to those projects but does not host replacement endpoints. Enter working AniAPI-compatible and Consumet-compatible base URLs in **API settings**. Those servers must allow browser requests from your site origin (CORS). If an episode host requires custom Referer or User-Agent headers, a static site cannot add them to video requests; such streams need a compatible proxy or a different source. Availability and rights to stream individual titles depend on the services you configure.

The integration follows the [AniAPI anime and pagination documentation](https://github.com/AniAPI-Team/AniAPI-Docs/blob/main/docs/resources/anime.mdx) and [Consumet AnimeKai](https://docs.consumet.org/rest-api/Anime/animekai/search) and [Animepahe](https://docs.consumet.org/rest-api/Anime/animepahe/search) route documentation. HLS playback uses a local copy of [hls.js](https://github.com/video-dev/hls.js), licensed under MIT (see `vendor/hls.LICENSE`).

## Checks

```sh
node --test
```

## Deploy to GitHub Pages

`index.html`, `.nojekyll`, and all assets are at the repository root. There is no build step.

1. Push this branch, or merge it into `main`.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the branch and **/ (root)**, then save.
3. Open the URL GitHub shows in **Settings → Pages**. For this repository it should be <https://brysona320-coder.github.io/AniWatch/>.
4. Enter browser-reachable HTTPS AniAPI and Consumet service URLs in **API settings**.

The app uses relative asset paths for the `/AniWatch/` project URL. GitHub Pages serves only the frontend; it does not run either API or a video proxy.
