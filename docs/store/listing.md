# Store listing

The text to paste into the Play Console's store listing, for the closed track and later for production. Each of the next three sections holds only the text to paste. Copy it as it stands: a test in `apps/mobile/test/store-config.test.ts` keeps each one inside Google's limit.

**Where it goes:** Play Console → your app → Grow users → Store presence → Store listings → the default listing. Console menu names change, so look for the nearest match.

## App name

Our Players

## Short description

Morning recap of how players from the countries you follow did last night.

## Full description

Our Players is a morning recap for people who follow their country's players. Open it over breakfast and see how the players from your countries did in last night's NHL and NBA games, without digging through every box score.

It starts with Latvia, and you can follow any other countries you like, in one league or both.

Each game day shows the games your players were in first, with a stat line for each player: goals, assists and time on ice in hockey, points, rebounds and assists in basketball. If someone didn't play, it says so.

Tap a game for its full box score. Tap a player for their season stats and recent games.

Search for any player to make them a favorite, so you see them wherever they're from. Hide the players you'd rather not see.

There's no account to create, and there are no ads.

Data comes from public NHL and ESPN web APIs. Our Players is an independent, free project and isn't affiliated with or endorsed by the NHL, the NBA, their teams or ESPN.

## Category and tags

- **App or game:** App
- **Category:** Sports
- **Tags:** chosen in the console from Google's own list. Pick the ones closest to sports, and leave out anything the app doesn't do. Its choices change, so they aren't listed here.

League names stay out of the app's name and icon. They appear only in the description, to say what the app covers (VISION §11).

## Contact details

- **Email:** `ourplayers@adveis.dev` (shown publicly on the listing)
- **Website:** `https://ourplayers.adveis.dev`
- **Phone:** leave empty if the console allows it. It's optional as far as we know; the console's wording may differ.

## Privacy policy

`https://ourplayers.adveis.dev/privacy`

## Graphics

All of these are in `docs/store/graphics/`, ready to upload.

| Slot in the console | File | Size |
|---|---|---|
| App icon | `icon-512.png` | 512×512, 32-bit PNG with a fully opaque field |
| Feature graphic | `feature-graphic.png` | 1024×500, PNG without alpha |
| Phone screenshots, in this order | `screenshots/01-night-mixed.png` | 1080×2160 |
| | `screenshots/02-game-basketball.png` | 1080×2160 |
| | `screenshots/03-player-skater.png` | 1080×2160 |
| | `screenshots/04-settings.png` | 1080×2160 |

Leave the tablet and other device slots empty. Success: the console accepts each file with no size warning, and the listing's preview shows the screenshots in this order.

To make them again: `pnpm screenshots --store` for the screenshots and `pnpm --filter @our-players/mobile store-graphics` for the icon and feature graphic, from the repo root.
