# 💸 Budget Draft

Who can build the better team with **$20**?

Items from a category (footballers, rappers, fast food…) are revealed one at a time.
Players take turns to **BUY** or **PASS**. Only one player gets each item, and you have
to fill every slot without running out of money. The highest-rated team wins, and
everyone votes for the team they like best.

Built with the MERN stack and TypeScript everywhere: React + Vite, Express, MongoDB +
Mongoose and Socket.io.

## Modes

| Mode | How it works | Needs the server? |
| --- | --- | --- |
| 📱 Pass & Play | 2–4 players on one device. A "pass the device" screen between turns. | No (uses bundled data) |
| 🌐 Online Room | Create a room, share the 6-letter code or link. Everyone taps **Ready**, and the host can start once they all have (changing a setting or a new player joining resets it). The host can tap a player to **make them host** or **remove** them (a removed player can't rejoin that room). Anyone who joins after the game started **watches** the same public board (no hidden ratings) and gets a seat on Rematch, up to 4 players. Everyone picks one of 12 **avatars** (also in local setup), shown on the board and the results. A small **lobby chat** (120 characters, one message per second, kept in memory only, closed once the game starts). The host picks the timers in the lobby (10–60s per turn, 5–20s per bid, 15–60s to vote; defaults 15s, 7s and 30s), and they stay for rematches. The host can **Rematch** from the results (same players, new shuffle), or create the room with **their own list** of 20–150 items (`name, price, rating, tag` per line, pasted from anywhere, kept for that room only). | Yes |
| 🤖 Solo vs Bots | You against 1–3 bots (easy, medium or hard). | No |
| 📅 Daily Challenge | Same category and item order for everyone today (UTC), against one hard bot. One try per day. Share your score as "Budget Draft #12 — 412 pts 🟩🟩🟨🟩⬜". | To post a score |

Every mode can be played in either **draft style**, with any mix of the **extras**:

| Draft style | |
| --- | --- |
| Classic | BUY or PASS at the listed price. The first BUY wins the item. |
| Auction | Bid against each other, starting at $1. The highest bid wins. Online: 7s per bid by default (the host can pick 5–20s). |

| Extra (all off by default) | |
| --- | --- |
| Balanced team | +15 points for a team with every role the category defines (football, cricket). |
| Mystery items | About 1 in 6 items hide their rating until the draft ends. |
| Power-ups | Veto, Discount (Classic only) and Peek, once each per game. |

The **Chaos** preset switches every extra on.

Also everywhere:

- **How to play**: 4 short cards on your first visit; the **?** in the header opens them again.
- **Sound effects** for buy, pass, the last 5 seconds of a timer, and the results. They're
  generated with the Web Audio API (no audio files). The speaker button mutes them, and
  that choice is remembered in localStorage.
- **A dark editorial look**: midnight black (`#08090B`), warm white (`#F5F3EF`) and golden
  yellow (`#FFC900`), with an upright Instrument Serif for headlines (self-hosted with
  `@fontsource`), DM Sans for body text, thin hairlines and small uppercase labels. Gold is the
  only accent: buttons, prices, the active player and urgency. The palette is six Tailwind theme
  tokens in `client/src/index.css` (mirrored in `lib/palette.ts`, where a test checks WCAG AA
  contrast for every pairing). There is no warning colour, so urgency is a pulsing gold icon
  plus motion. UI icons are thin lucide line icons; the only full-colour emoji are the
  reactions (and category emoji, which are content). Open `/style-guide` to see every colour,
  type size and component.
- **Emoji reactions** in online rooms: 👏 😂 😱 🔥 💸 float up the board for everyone, one per
  player per second.
- **Made for phones.** Below 768px the board changes shape: the other players sit in a
  strip at the top (tap one for their full team in a bottom sheet), and BUY/PASS or the bid
  buttons, the power-ups and your own team (a row that opens upward) are pinned to the
  bottom of the screen, in thumb reach and clear of the home indicator. The item card fits
  above them on an iPhone SE (375×667). The turn timer is also a thin bar across the top of
  the screen. Dialogs (how to play, power-up info, team view, list errors, quit) are bottom
  sheets on phones. Buttons are at least 44×44px, inputs are 16px or larger so iOS doesn't
  zoom, and double-tap zoom is off on controls.
- **Haptics**: a short buzz on buy and bid, when your online turn starts, and for the winner
  (`navigator.vibrate`, so Android only; iPhones don't support it). Muting turns it off too.
- **Phones that sleep**: when an online room's tab comes back from the background, it
  re-joins straight away and shows "Reconnecting…" over the board until the latest state
  has arrived, instead of a frozen board. The invite button uses the phone's share sheet
  (falls back to copying the link).
- **Installable** (PWA): `client/public/manifest.webmanifest` plus iOS meta tags, so "Add to
  Home Screen" opens it full-screen with the chrome-pebble icon (`client/public/icons`,
  rendered from `icon.svg`). There's no service worker: the game needs the network anyway.

## Setup

You need **Node.js 22.9+** and a **MongoDB** database (local, Docker or Atlas).

```bash
# 1. Install everything (one install for all three packages)
npm install

# 2. Create your .env from the example and fill it in
cp .env.example .env

# 3. (Optional) start MongoDB with Docker
docker compose up -d

# 4. Load the 10 categories (483 items) into MongoDB
npm run seed

# 5. Start the API (port 4000) and the web app (port 5173)
npm run dev
```

Open http://localhost:5173.

Pass-and-play and bot mode work without the server: the app bundles the seed data and
uses it whenever the API can't be reached.

### Environment variables

All variables live in one `.env` file at the repo root. The server checks them with zod
at startup and stops with a clear message if one is missing.

| Variable | Used by | Example | What it's for |
| --- | --- | --- | --- |
| `MONGO_URI` | server | `mongodb://localhost:27017/budget-draft` | Database connection. With no database name in it, `budget-draft` is used |
| `PORT` | server | `4000` | API + Socket.io port (Render sets it) |
| `ADMIN_PASSWORD` | server | at least 8 characters | Password for `/admin` |
| `CLIENT_URL` | server | `http://localhost:5173` | The only other origin allowed by CORS and sockets. Required in production |
| `NODE_ENV` | server | `production` | `production` makes the server also serve `client/dist` |
| `VITE_SERVER_URL` | client | `http://localhost:4000` | Development only: where the web app finds the API. A production build always uses its own origin |

### Scripts

Run these from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (auto-restarts on change) + client (hot reload) together |
| `npm run seed` | Clears categories and items, then reloads them from `server/seed/*.json` |
| `npm test` | Every Vitest suite (shared, server, client). Includes a typecheck of `shared`. |
| `npm run typecheck` | Strict TypeScript check of all three packages |
| `npm run build` | Production build: typechecks `shared`, builds the web app into `client/dist`, bundles the server into `server/dist` |
| `npm start` | Run the built server (`server/dist/index.js`). Needs `npm run build` first |

Tests that need a database start a throwaway in-memory MongoDB, so `npm test` doesn't
need your real database.

## Deployment

Production is **one Render web service**. It serves the API, Socket.io and the built React
app from the same origin, so the browser never makes a cross-site request. MongoDB is
hosted on Atlas.

To try the production build locally first:

```bash
npm run build
NODE_ENV=production CLIENT_URL=http://localhost:4000 npm start
# open http://localhost:4000
```

### 1. MongoDB Atlas

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com) and create a project.
2. **Create a cluster:** choose the free **M0** tier. Pick the cloud region closest to the
   Render region in `render.yaml` (`oregon` = AWS `us-west-2`).
3. **Database Access → Add New Database User:** password authentication, role
   **Read and write to any database**. Use a password made of letters and digits only, so
   it needs no URL encoding.
4. **Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`).
   Render's free plan has no fixed outgoing IP, so this is required. The database
   password still protects the data.
5. **Connect → Drivers:** copy the connection string and put your password in it. Add
   `budget-draft` as the database name, between `.net/` and `?`:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/budget-draft?retryWrites=true&w=majority&appName=Cluster0
   ```

   If you leave out the name, the server uses `budget-draft` anyway.

6. **Load the categories from your own machine** (from the repo root):

   ```bash
   MONGO_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/budget-draft?retryWrites=true&w=majority" npm run seed
   ```

   It should print `Seeded 10 categories and 483 items.` Seeding replaces **only**
   categories and items. Saved games and daily scores stay. Edits made on `/admin` are
   replaced too, so after going live, edit categories on `/admin` instead of reseeding.

### 2. Render

1. Push this repo to GitHub.
2. In [dashboard.render.com](https://dashboard.render.com): **New → Blueprint**, connect
   your GitHub account and pick this repo. Render reads `render.yaml` and shows one web
   service called `budget-draft`.
3. Render asks for the three secret values:

   | Variable | Value |
   | --- | --- |
   | `MONGO_URI` | the Atlas string from step 1.5 |
   | `ADMIN_PASSWORD` | a long password (at least 8 characters) for `/admin` |
   | `CLIENT_URL` | `https://budget-draft.onrender.com`, the service's own URL |

   `NODE_ENV=production` and the Node version (`NODE_VERSION`) come from `render.yaml`.
   Render sets `PORT` itself.
4. Click **Apply**. The first build runs `npm ci --include=dev && npm run build` (a few
   minutes), then `npm start`. Render waits for `GET /api/health` to answer before
   sending traffic.
5. **Check the URL.** If `budget-draft` was taken, Render adds a suffix (for example
   `budget-draft-x1y2.onrender.com`). Then go to **Environment**, set `CLIENT_URL` to the
   real URL and save. Render redeploys. The app works either way because everything is
   same-origin, but `CLIENT_URL` is the only origin CORS allows.
6. **Check it's live:**
   - `https://<your-service>.onrender.com/api/health` shows `{"ok":true,"db":"connected"}`.
     If `db` isn't `connected`, check `MONGO_URI` and the Atlas IP access list.
   - The home page loads, and **Online Room → Create room** works. Open the room link
     in a second browser or on a phone and play a round.

Every push to the default branch deploys again (`autoDeploy: true`). Logs are under the
service's **Logs** tab.

## Architecture

```
budget-draft/
├── shared/   Types, zod schemas and the pure game engine. Used by BOTH client and server.
├── server/   Express REST API, Socket.io rooms, Mongoose models, seed data (server/seed/*.json)
└── client/   React + Vite + Tailwind web app, Zustand stores
```

```mermaid
flowchart LR
  subgraph Browser
    UI[React pages] --> LS[localGameStore<br/>pass-and-play + bots]
    UI --> OS[onlineStore]
    LS --> ENG1[shared game engine]
    LS -. no server? .-> BUNDLE[(bundled seed JSON)]
  end

  subgraph Server["Node server"]
    API[Express REST<br/>/api/...] --> CAT[catalog service]
    IO[Socket.io handlers<br/>zod-validated] --> RUN[GameRunner<br/>timers + broadcasts]
    RUN --> ENG2[shared game engine]
    RUN --> ROOMS[(RoomStore<br/>in memory)]
    RUN --> SAVE[save GameResult]
  end

  OS <-- "room:join, turn:action, vote:cast<br/>game:state, item:reveal, game:end" --> IO
  UI -- "fetch" --> API
  CAT --> DB[(MongoDB)]
  SAVE --> DB
```

**One game engine, three modes.** All the rules (budget check, turn order, scoring, the
bot) are pure functions in `shared/src/game/`. They take a state and return a new state,
with no network, database or timers. The browser runs them for pass-and-play and bot
games, and the server runs exactly the same code for online rooms.

**The server is in charge online.** For online games the real `GameState` only exists
on the server. Clients send intentions ("BUY", "PASS", a vote), the server checks them
with zod and the engine, then sends everyone the new state. Clients can't skip the
budget rule or act out of turn: the acting player's id comes from their socket, never
from the message.

**The item pool stays secret.** The full state includes `itemPool` (the shuffled items
still to come). Clients only ever get `PublicGameState`, which has
`itemPool?: never` and just an `itemsRemaining` count. Because every server→client
socket event is typed with `PublicGameState`, sending the full state is a compile error.
A type test (`shared/src/__typetests__`) checks that this protection holds.

### REST API

| Method & path | Description |
| --- | --- |
| `GET /api/health` | `{ ok: true, db }`, where `db` is `connected`, `connecting`, `disconnecting` or `disconnected`. Render's health check |
| `GET /api/categories` | All categories with item counts |
| `GET /api/categories/:slug/items` | Items in a category |
| `POST /api/rooms` | Create a room → `{ code }`. Optional `customItems` (20–150 `{ name, price, rating, tag }`) plays the host's own list |
| `GET /api/rooms/:code` | Room info (phase, player count, joinable) |
| `GET /api/leaderboard` | Wins, games played, best score (online games only; best score from Classic games with no extras) |
| `POST /api/results` | Store a finished local/bot game (never ranked) |
| `POST /api/daily` | Submit a Daily Challenge: `{ dateKey, playerName, moves }`. The server replays the moves to get the score → `{ total, rank, players }` |
| `GET /api/daily/leaderboard?date=YYYY-MM-DD` | Top 20 for one day's daily (default today, UTC) |
| `/api/admin/...` | Category and item CRUD, needs the `x-admin-password` header |

### Socket events

| Client → server | Server → client |
| --- | --- |
| `room:join` (code, name, stored playerId) | `room:update` (lobby + game snapshot) |
| `room:leave` | `item:reveal` (new item + state) |
| `room:settings` (host only) | `game:state` (after every action) |
| `game:start` (host only) | `game:end` (final state + results) |
| `game:rematch` (host only, after the game ends: same players, new shuffle) | |
| `turn:action` (buy/pass/bid/veto/discount + round number) | |
| `turn:peek` (Peek: the next item comes back in the ack, to you only) | |
| `vote:cast` | `reaction` (who sent which emoji) |
| `reaction:send` (one of 👏 😂 😱 🔥 💸, max 1 per second per player) | |

Every request gets an acknowledgement: `{ ok: true, data }` or `{ ok: false, error }`.

### Data models

- **Category**: `slug` (unique), `name`, `emoji`, `description`
- **Item**: `name`, `categorySlug`, `price` (1–10), `rating` (1–100), `tag`, optional `emoji`.
  Unique per (category, name).
- **Category** also has `roles` (empty for most categories). In a category with roles, every
  item's tag must be one of them.
- **GameResult**: mode, category, settings, `draftStyle`, `preset` (classic / custom /
  chaos), players with a *snapshot* of their team (with the price actually paid) and
  scores, `statsWinnerIds`, `voteWinnerIds`, and `countsForLeaderboard` (true only for
  online games). Results saved before `draftStyle`/`preset` existed are read as Classic.
- **DailyResult**: `dateKey`, `playerName`, `total` and `botTotal` (both worked out by the
  server), and the `moves` (so a score can be checked again). Unique per (day, lower-case name).

No images or logos anywhere: items are names and text, shown with an emoji or a
generated initials avatar.

## How the game works

### The budget rule

Every empty slot will need an item eventually, and the cheapest real item costs $1.
So when you buy something, **you must keep at least $1 for each of your other empty slots**.

> Most you can spend right now = budget − (empty slots − 1)

| Situation | Can spend up to |
| --- | --- |
| $20, 5 empty slots | $20 − 4 = **$16** |
| $5, 3 empty slots | $5 − 2 = **$3** (a $4 item is blocked) |
| $3, 1 empty slot (the last one) | **$3**: spend it all |

The server enforces this (`getBuyBlockReason` in `shared/src/game/rules.ts`), and the
UI uses the same function to grey out BUY and explain why.

### Turn order

1. An item is revealed. Players act in seat order, **starting from a different player
   each round** (the first seat moves one place to the right every item).
2. Players with a full team are skipped. Players who can't afford the item under the
   budget rule are skipped too, and get a "can't afford" note. Budgets only change when
   someone buys, and a buy ends the round, so asking them would be pointless.
3. Each player chooses **BUY** or **PASS**. The first BUY takes the item and ends the round.
   Online, each player gets 15 seconds by default (the host can pick 10–60s); running out of
   time counts as a pass. There is no "off" online, so one idle player can't freeze the game.
4. If everyone passes, the item is discarded. If nobody can afford an item at all, it is
   discarded straight away and the next one comes up.
5. The draft ends when every team is full. If the items run out first, the empty slots get
   **$0 "Bench Player" items rated 10**.

### Auction

1. Each item opens with no bids. The first bid can be $1; every bid after that must be at
   least $1 more than the high bid, and it must follow the budget rule.
2. Bidding goes round the table. A bid sends you to the back of the queue so everyone else
   answers first. **PASS** means you're out for this item.
3. When everyone except the high bidder has passed, the high bidder gets the item **at their
   bid**. If everyone passes before anyone bids, the item is discarded.
4. Players who can't afford the next bid are skipped automatically. The budget rule is what
   stops a bidding war: nobody can bid more than they can spend.
5. Quick-bid buttons raise the high bid by +$1, +$2 or +$5 and grey out when the budget
   rule blocks them.

### Extras

- **Balanced team**: a category can list roles (football: Goalkeeper, Defender, Midfielder,
  Forward; cricket: Batter, Bowler, All-rounder, Wicketkeeper). An item's tag is its role.
  A team with at least one of every role gets **+15**. It needs at least as many slots as
  roles, and bench items don't count. The board shows which roles each team still needs.
- **Mystery items**: about 1 in 6 items show only price and tag. The rating is revealed
  when the draft ends. The server never sends a hidden rating: public items have
  `rating: number | null`, so the compiler points at every place the UI shows one.
  Bots play fair and guess a mystery item's rating from its price.
- **Power-ups**, each usable once per game, on your own turn:
  - **Veto**: discard the current item, as long as nobody has bid on it yet.
  - **Discount** (Classic only): buy the current item for $2 less (minimum $1). A player
    who could only afford the item with their Discount is still asked.
  - **Peek**: see the next item. Online it comes back only to you; everyone else just sees
    that you peeked. On a shared device it's shown only while it's still your turn.

### Bots

Bots play fair. They never see the full game state, only what a player sees plus the list of
items not revealed yet, **sorted by rating**. A careful human could work that list out
from the category; the secret part, the order of the pile, stays hidden. Bots guess a
mystery item's rating from its price.

| Level | How it plays |
| --- | --- |
| Easy | Takes an item when its rating per dollar is at least 11. Never pays for stars. |
| Medium | Compares the item with the average rating still to come. Below average only as a bargain, above average up to its per-slot budget, and a fair price plus $2 for a star. |
| Hard | Plans its budget across all its empty slots: is "this item now + the best plan for my other slots" better than "the best plan without it"? The plan is a small knapsack over the items still to come, thinned out for the other players. The same sum gives its highest auction bid. With Balanced team on, it values roles it still needs. |

`shared/src/game/__tests__/botDifficulty.test.ts` plays 200 seeded games per check on the
real seed categories, swapping seats each game. Hard must beat easy in at least 70% of
games (it wins about 98% in Classic and Auction), and easy vs easy must stay between 40% and
60% so neither seat is favoured.

### Scoring and voting

- **Team score** = sum of ratings + **1 point per $1 left over** (small on purpose)
  + **15** for a balanced team (when that extra is on).
- **Stats winner** = highest team score. Ties share the win.
- **Voting** only happens with **3+ human players** (with 2 you'd just vote for each
  other). Nobody can vote for themselves. Online there is a timer (30 seconds by default, the host can pick 15–60s); in
  pass-and-play people vote one at a time with no timer. The results show the stats
  winner and the vote winner separately (or "tie").

### Seed data

Prices roughly follow ratings (90+ costs $8–10, under 55 costs $1), but every category has
**2–3 bargains** (much cheaper than their rating suggests) and **2–3 overpriced** items.
Spotting them is the skill. A test (`server/src/seed/__tests__/seedFiles.test.ts`) checks
every file: 40+ items, valid prices and ratings, tags, unique names and the bargain/overpriced
counts. Ratings are a playful opinion for the game, not a real-world ranking.

## Known limits

- **Live rooms are in memory.** Online rooms live in the server process (`RoomStore`).
  **If the server restarts, every room in progress is lost**, and players see "No room
  with that code. It may have expired." Finished games are already saved in MongoDB.
  Running several server instances would need shared room storage (for example Redis)
  and the Socket.io Redis adapter.
- **Render's free plan sleeps.** After about 15 minutes without traffic the service
  stops, which also ends any room in memory. The next visit wakes it, and that first
  page load can take up to a minute.
- **Empty rooms are deleted** after 10 minutes with nobody connected.
- **No accounts.** A player id stored in the browser is what lets you reconnect to your
  seat. Clearing site data or switching device means joining as a new player. The
  leaderboard groups players by name (case-insensitive), so two people using the same
  name share an entry.
- **The daily's items can be found in dev tools.** The day's game is built in the browser
  from the date (it's the seed), so a curious player can work out the item order before
  playing. The server replays every submitted move list, so scores can't be faked, but a
  player who looked ahead can play perfectly. Fine for a casual game.
- **One daily attempt per device is a localStorage flag.** Clearing site data gives
  another try. The server allows one score per name per day; a new name gets around that.
- **Best score only counts Classic games with no extras.** Auctions, power-ups and the
  balanced bonus all change what a score means. Wins count in every mode.
- **Custom lists aren't ranked.** A host could paste a list of cheap 100-rated items, so
  those games are saved with `countsForLeaderboard: false`. The list itself lives only in
  the room's memory.
- **Leaderboard = online games only.** In local and bot games one person controls every
  name, so those results are stored (`countsForLeaderboard: false`) but never ranked.
- **Admin is a single shared password**, sent as a header over HTTPS in production. It's
  compared in constant time, but there are no user accounts, roles or rate limiting.
- **Timers use the server's clock.** The countdown on each phone is approximate (it
  never shows more than the full turn length). The server decides when time is up.
