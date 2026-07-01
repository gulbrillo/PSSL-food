# PSSL Food

Lab-meeting food coordination for the Precision Space Systems Lab:

- **Sign in with the PSSL WordPress site** (`pssl.mae.ufl.edu`) — which itself uses UF SSO.
  Anyone with an account on the PSSL site can use the food app; nobody else can.
- **Meetings & RSVP** — admins schedule weekly meetings (Thursdays 1 pm by default), members
  RSVP with one tap. Dietary restrictions live on each member's profile, so every "I'm in"
  automatically counts vegan / vegetarian / gluten-free / … for the food order.
- **Caterers** — an approved caterer list, member voting (❤️), per-meeting caterer + menu,
  and per-meeting special requests ("please make sure there's a margarita pizza"), with a
  remembered "usual" per caterer.
- **Discord bot** — posts channel reminders before each RSVP deadline, DMs members who
  haven't responded, and offers `/rsvp` + `/meeting` slash commands.

```
┌────────────────────┐   OAuth2 code flow    ┌───────────┐      ┌──────────┐
│ pssl.mae.ufl.edu   │◄──────────────────────│  web       │◄────►│ postgres │
│ (WP + UF SSO +     │                       │ (Nuxt 3)   │      └──────────┘
│  pssl-sso plugin)  │                       └─────▲──────┘
└────────────────────┘                             │ internal API (bearer token)
                       ┌───────────┐         ┌─────┴──────┐
                       │  Discord  │◄───────►│    bot     │
                       └───────────┘         └────────────┘
```

## Repository layout

| Path                | What it is                                                            |
| ------------------- | --------------------------------------------------------------------- |
| `wordpress-plugin/` | `pssl-sso` — minimal OAuth 2.0 provider plugin for the WordPress site |
| `web/`              | Nuxt 3 app (frontend + API + Postgres via Prisma)                     |
| `bot/`              | Discord reminder bot (discord.js)                                     |
| `docker-compose.yml`| db + web + bot + Caddy (automatic HTTPS)                              |

## Setup

### 1. WordPress plugin (one time)

1. Copy `wordpress-plugin/pssl-sso/` into `wp-content/plugins/` of the network.
2. Activate **PSSL SSO Provider** on the **PSSL site only** (not network-wide).
3. Open **Settings → PSSL SSO** on the PSSL site. Note the **Client ID** and **Client Secret**,
   and add the redirect URI of your food site: `https://<your-food-domain>/auth/wp/callback`.

That's it on the WordPress side. When someone clicks "Sign in with your PSSL account", they are
sent to the PSSL site; if they aren't logged in there, the site's existing UF/Google SSO login
kicks in first, then they bounce straight back — already authenticated. Only users who are
members of the PSSL site are accepted.

### 2. Discord application (one time)

1. Create an app at <https://discord.com/developers/applications>.
2. **OAuth2** tab: copy Client ID + Client Secret, and add redirect
   `https://<your-food-domain>/auth/discord/callback`.
3. **Bot** tab: create the bot, copy the token.
4. Invite the bot to your server: OAuth2 → URL Generator → scopes `bot` + `applications.commands`,
   permissions **Send Messages** — open the generated URL.
5. Enable **Developer Mode** in your Discord client, then right-click your server → *Copy Server ID*
   and the reminder channel → *Copy Channel ID*.

### 3. Deploy

On the server (needs Docker + a DNS record for the food domain pointing at it):

```bash
git clone <this repo> && cd PSSL-food
cp .env.example .env      # fill in everything
docker compose up -d --build
```

Caddy obtains the TLS certificate automatically. The database schema is created on first start.

### 4. First login

- Sign in once — WordPress **administrators/editors** of the PSSL site (and anyone in
  `ADMIN_EMAILS`) automatically get the **Admin** tab.
- Admin → schedule the weekly meetings, add caterers.
- Everyone else: set food preferences in **Profile**, click **Connect Discord**, done.

## How members use it (the 10-second version)

1. First visit: pick your dietary restrictions in **Profile** (once).
2. Each week: tap **✅ I'm in** or **❌ Can't make it** — on the site or with `/rsvp` in Discord.
3. If a caterer is set, optionally add a request ("margarita pizza please") — it can be
   remembered as your usual for that caterer.

Admins see per-meeting counts by restriction plus all requests — i.e. exactly what to order.

## Reminders

The bot checks every 10 minutes:

- `CHANNEL_REMINDER_HOURS` (default 48) before the RSVP deadline → posts one reminder in the
  configured channel with meeting, caterer, deadline, and response count.
- `DM_REMINDER_HOURS` (default 24) before the deadline → DMs every member who linked Discord
  but hasn't RSVP'd yet.

Each reminder is sent exactly once per meeting.

## Local development

```bash
# database
docker run -d --name psslfood-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=pssl \
  -e POSTGRES_DB=psslfood -p 5432:5432 postgres:16-alpine

cd web
npm install
npx prisma db push
# .env in web/: DATABASE_URL, NUXT_SESSION_PASSWORD, NUXT_WP_* , NUXT_PUBLIC_APP_URL=http://localhost:3000, …
npm run dev
```

Note: for local login testing, add `http://localhost:3000/auth/wp/callback` to the plugin's
allowed redirect URIs (and remove it again in production).

## Security notes

- The WP plugin implements a single-client OAuth 2.0 authorization-code flow: allow-listed
  exact-match redirect URIs, single-use 2-minute codes, 5-minute opaque access tokens,
  `hash_equals` comparisons everywhere. It exposes name/email/username/roles of the logged-in
  user only.
- The food app never sees WordPress or UF credentials — only the profile payload above.
- The bot's internal API is protected by `BOT_API_TOKEN` and is only reachable inside the
  compose network (no ports are published on `web` or `bot`; only Caddy is exposed).
