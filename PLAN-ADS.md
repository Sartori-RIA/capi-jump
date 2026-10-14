# Ads Plan (Once Traffic Picks Up)

The game remains **free to play**. Ads are only introduced once people are actually playing. Don't enable AdSense on `localhost` or on an empty first deployment.

Game name: **Capi Jump**. The ads plan does not depend on the title.

## What Not to Do

- Place a banner in the middle of the canvas (it interferes with touch controls and has poor CPM).
- Show an interstitial after every death starting with the first game (players will close the tab).
- Use shady ad networks (popunders, redirects). They can ruin your domain's reputation and get your game rejected by portals.
- Rely on AdSense for an HTML5 game hosted on your own domain. Approval can be difficult, and ad fill rates are low without sufficient traffic.

## Path 1 — Gaming Portals (Preferred)

Poki, CrazyGames, and similar platforms **bring the players and the ads**. You provide the build (`npm run build`) in the format they require (iframe, no paywall, no redirects).

1. Publish a playable static build (Cloudflare Pages / GitHub Pages).
2. Read the portal's developer guide (SDK / `postMessage` / `gameplayStart` and `gameplayStop` events).
3. Integrate the SDK only into `die()` (end of a run) and the first `flap()` (start of a run).
4. Submit the game. They decide whether to feature it.

Revenue: a share of the portal's ad revenue. No need to manage an ad network, deal with third-party advertising under Brazil's LGPD, or handle banner layouts.

Current code entry points: `CapivaraGame.die()` and `flap()` in `src/engine.js`. When the time comes, create a `src/ads.js` module with no-op implementations in development:

```js
export const ads = {
  gameplayStart() {},
  gameplayStop() {},
  commercialBreak() { return Promise.resolve() },
}
```

On the portal, these functions call the SDK. When running `npm run dev`, they remain empty.

## Path 2 — Your Own Domain (Only Once You Have Traffic)

If the game goes viral outside gaming portals:

| Timing | Format | Frequency |
| --- | --- | --- |
| After game over | Interstitial or rewarded ad (“revive / view high score”) | Every 3–4 deaths, never on the first one |
| Menu / start screen | Discreet banner **outside** the canvas | Optional |
| During a run | Nothing | — |

Rewarded ads (“watch to continue”) convert better than banners, but they require an ad network that supports HTML5 rewarded ads (not classic AdSense).

## LGPD / Consent

If ads run on **your own** domain with cookies/tracking, display a consent banner before showing ads. On gaming portals, their own policies apply.

Don't identify players. The high score is already stored exclusively in `localStorage`.

## Practical Rollout Order

1. Choose the name, polish the game, and publish it at a stable public URL.
2. Submit it to 1–2 gaming portals.
3. If they reject it and traffic to your own site grows, add `src/ads.js` and an interstitial on game over.
4. Only then consider rewarded ads or an in-app purchase (IAP) to “remove ads.”

Until step 2, **don't add a single line of advertising code to the game.**
