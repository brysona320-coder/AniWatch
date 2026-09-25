# AniWatch

A static anime streaming frontend built for GitHub Pages. The default **Watchable titles** catalog comes from AnimeParadise, whose API supplies matching episodes and HLS video links for the on-page player. AniList and Kitsu provide additional working metadata catalogs. AniAPI remains an optional metadata catalog, and AnimeKai and Animepahe through Consumet remain optional streaming sources. Your watchlist and API settings are saved in this browser.

## Run

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The default catalog lists anime with episodes. Choose a title, click **Watch episodes**, then choose an episode to play it. If you choose AniList, Kitsu, or AniAPI for the catalog, the player searches the selected streaming source by title and asks you to confirm the match. You can edit that search if the names differ. The streaming source can be changed in the header or in the player.

AnimeParadise, AniList, and Kitsu returned browser-accessible responses when checked on 2026-09-25. Availability can vary by title, region, and time. The public `api.aniapi.com` endpoint redirected to HTML instead of JSON, and `api.consumet.org` redirected to a blocked repository during the same check. The [API list supplied for this project](https://github.com/Munna-Scriptz/free-anime-apis) links to those projects but does not host replacement endpoints. Enter working AniAPI-compatible or Consumet-compatible URLs in **API settings** if you want to use those options. A static site cannot add custom Referer or User-Agent headers to video requests; a source requiring them needs a compatible proxy. HLS playback also requires browser support for the stream's video codec; the shared Linux Preview browser lacks H.264 decoding.

The AnimeParadise adapter follows the [anime-sdk provider implementation](https://github.com/hexxt-git/anime-sdk/blob/master/src/providers/AnimeParadiseProvider.ts). The optional integrations follow the [AniAPI anime and pagination documentation](https://github.com/AniAPI-Team/AniAPI-Docs/blob/main/docs/resources/anime.mdx) and [Consumet AnimeKai](https://docs.consumet.org/rest-api/Anime/animekai/search) and [Animepahe](https://docs.consumet.org/rest-api/Anime/animepahe/search) routes. HLS playback uses a local copy of [hls.js](https://github.com/video-dev/hls.js), licensed under MIT (see `vendor/hls.LICENSE`).

## Checks

```sh
node --test
```

## Deploy to GitHub Pages

`index.html`, `.nojekyll`, and all assets are at the repository root. There is no build step.

1. Push this branch, or merge it into `main`.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the branch and **/ (root)**, then save.
3. Open the URL GitHub shows in **Settings → Pages**. For this repository it should be <https://brysona320-coder.github.io/AniWatch/>.
4. Open a title from **Watchable titles** and play an episode. The default AnimeParadise endpoint requires no API key. Optional AniAPI and Consumet choices need working browser-reachable HTTPS endpoints.

The app uses relative asset paths for the `/AniWatch/` project URL. GitHub Pages serves only the frontend; the APIs and video segments are served by their external hosts.
