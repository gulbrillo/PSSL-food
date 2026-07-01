# 🚀🍕 PSSL LunchPad

Lab meeting RSVP & food coordination for the Precision Space Systems Lab.
(*Launch pad* → **LunchPad**. Every good mission starts on one.)

- **One login for the whole lab** — sign in with your account on the PSSL WordPress site
  (`pssl.mae.ufl.edu`), which itself uses UF single sign-on. Membership on the PSSL site is
  the only access rule.
- **One-tap RSVP** — dietary restrictions live on your profile, so "✅ I'm in" automatically
  counts vegan / vegetarian / gluten-free / … for the order. Mobile-friendly.
- **Late changes always work** — RSVPs, restriction changes, and food requests are possible
  even after the deadline; they're just flagged with a `*` in the attendance list everyone
  can see.
- **Guests & paperwork** — add guests by hand (with restrictions), and print a **PDF sign-in
  sheet** (title, date/time, participants, signature lines) for food reimbursement.
- **Caterers** — approved list, ❤️ voting, per-meeting caterer + menu, special requests
  ("please make sure there's a margarita pizza") with a remembered "usual" per caterer.
- **Discord bot** (optional gimmick) — channel reminders before each RSVP deadline, DMs to
  non-responders, `/rsvp` + `/meeting` slash commands.

```
┌────────────────────┐   OAuth2 code flow    ┌────────────┐      ┌──────────┐
│ pssl.mae.ufl.edu   │◄──────────────────────│    web     │◄────►│ postgres │
│ (WP + UF SSO +     │                       │  (Nuxt 3)  │      └──────────┘
│  pssl-sso plugin)  │                       └─────▲──────┘
└────────────────────┘                             │ internal API (bearer token)
                       ┌───────────┐         ┌─────┴──────┐
                       │  Discord  │◄───────►│    bot     │
                       └───────────┘         └────────────┘
```

| Path                 | What it is                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| `wordpress-plugin/`  | `pssl-sso` — minimal OAuth 2.0 provider plugin for the WordPress site  |
| `web/`               | Nuxt 3 app (frontend + API + Postgres via Prisma)                      |
| `bot/`               | Discord reminder bot (discord.js)                                      |
| `install.sh`         | Interactive first-time setup (asks for port, URLs, keys; writes `.env`)|
| `update.sh`          | One-command update: `git pull` + rebuild + restart                     |
| `docker-compose.yml` | db + web + bot (+ optional Caddy for HTTPS)                            |

## Install

### Step 1 — WordPress plugin (one time)

1. Install `wordpress-plugin/pssl-sso.zip` — on a multisite network go to
   **Network Admin → Plugins → Add New → Upload Plugin** and upload the zip
   (alternatively, copy the `wordpress-plugin/pssl-sso/` folder into
   `wp-content/plugins/` by SFTP).
2. Activate **PSSL SSO Provider** on the **PSSL site only** (site's own
   Plugins page — do *not* "Network Activate").
3. Open **Settings → PSSL SSO**: note the **Client ID** and **Client Secret**, and add the
   food app's redirect URI (`<your app URL>/auth/wp/callback`) to the allowed list.
4. Optional but recommended if the site uses a Google/UF-SSO login plugin: under
   **Login behavior**, tick *"Send users … straight to the Google / UF SSO sign-in"* —
   members then never see the WordPress username/password page.

When someone clicks "Sign in with your PSSL account", they're sent to the PSSL site; if they
aren't logged in there, the site's existing UF/Google SSO kicks in first, then they bounce
straight back — already authenticated. Only members of the PSSL site are accepted.

### Step 2 — Discord application (optional, one time)

1. Create an app at <https://discord.com/developers/applications>.
2. **OAuth2** tab: copy Client ID + Secret, add redirect `<your app URL>/auth/discord/callback`.
3. **Bot** tab: create the bot, copy the token.
4. Invite it: OAuth2 → URL Generator → scopes `bot` + `applications.commands`, permission
   **Send Messages** — open the generated URL.
5. With Discord **Developer Mode** on: right-click server → *Copy Server ID*, and the
   reminder channel → *Copy Channel ID*.

You can skip this entirely and add the values to `.env` later.

### Step 3 — Run the installer

On the server (Docker + git required):

```bash
git clone https://github.com/<you>/PSSL-food.git && cd PSSL-food
./install.sh
```

The installer asks, interactively:

- **How the app is reached** — `1)` behind **Apache** on the same server (recommended,
  see below), `2)` the bundled Caddy container serving HTTPS itself, or `3)` a plain
  HTTP port for testing
- the **web port** the app listens on (default `8080`; with option 1 it binds to
  `127.0.0.1` only, so it's unreachable except through Apache)
- the app's **public domain / URL**
- **WordPress** base URL + client ID/secret (from Step 1), admin emails
- **Discord** credentials (optional)

It generates all internal secrets itself, writes `.env`, runs
`docker compose up -d --build` (the database schema is created/updated automatically at
container start) — and, for option 1, **prints a ready-to-paste Apache vhost** and saves it
as `apache-vhost-<domain>.conf`.

### Behind Apache (recommended)

Add a vhost on the server's Apache that proxies to the app port — the installer generates
exactly this with your domain and port filled in:

```apache
# sudo a2enmod proxy proxy_http headers ssl    (Debian/Ubuntu)
<VirtualHost *:443>
    ServerName food.pssl.mae.ufl.edu

    SSLEngine on
    SSLCertificateFile      /etc/ssl/certs/food.pssl.mae.ufl.edu.crt
    SSLCertificateKeyFile   /etc/ssl/private/food.pssl.mae.ufl.edu.key

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/

    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port  "443"
</VirtualHost>

<VirtualHost *:80>
    ServerName food.pssl.mae.ufl.edu
    Redirect permanent / https://food.pssl.mae.ufl.edu/
</VirtualHost>
```

Adjust the certificate paths to your setup, reload Apache, done. `ProxyPreserveHost` and the
`X-Forwarded-*` headers matter — the app uses them to build correct login redirects.

## Update

```bash
./update.sh
```

That's `git pull` → rebuild images → restart containers → prune old images. The `.env` and
the database volume are never touched, and schema migrations apply automatically on start.

To change settings later: edit `.env`, then `docker compose up -d` (no rebuild needed).

## Everyday use

**Members** (no instructions needed, but for the record):

1. First visit: pick dietary restrictions in **Profile** (once); optionally **Connect Discord**.
2. Each week: tap **✅ I'm in** / **❌ Can't make it** — on the site or via `/rsvp` in Discord.
3. If a caterer is set: optionally add a special request; "remember as my usual" prefills it
   next time.
4. Changed your mind after the deadline? Everything still works — the change is simply
   marked `*` (late) in the list everyone can see.

**Anyone** can open a meeting's attendee list to: see who's coming (with dietary counts),
**add guests** with restrictions, and download the **🖨️ sign-in sheet (PDF)** — participants +
blank signature lines, ready to print for reimbursement.

**Admins** (WP administrators/editors + `ADMIN_EMAILS`): the **Admin** tab schedules weekly
meetings (defaults: Thursday 1 pm, RSVP by Tuesday 5 pm), reschedules or cancels individual
ones, assigns caterer + menu notes, and manages the caterer list.

## Reminders (bot)

Admins can also push a reminder manually at any time: **Admin → Upcoming meetings →
📣 Discord reminder** posts an RSVP call for that meeting to the channel immediately.

Automatic reminders are checked every 10 minutes; each fires once per meeting:

| When (before RSVP deadline)      | What                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `CHANNEL_REMINDER_HOURS` (48 h)  | Post in the configured channel with meeting/caterer/count   |
| `DM_REMINDER_HOURS` (24 h)       | DM every linked member who hasn't responded — **off by default**, admins enable it in the web app under *Admin → Settings* |

## Local development

```bash
docker run -d --name psslfood-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=pssl \
  -e POSTGRES_DB=psslfood -p 5432:5432 postgres:16-alpine

cd web
npm install
npx prisma db push
# web/.env: DATABASE_URL, NUXT_SESSION_PASSWORD (32+ chars), NUXT_WP_*,
#           NUXT_PUBLIC_APP_URL=http://localhost:3000, ...
npm run dev
```

For local login testing, temporarily add `http://localhost:3000/auth/wp/callback` to the
plugin's allowed redirect URIs.

## Security notes

- The WP plugin is a single-client OAuth 2.0 authorization-code flow: allow-listed
  exact-match redirect URIs, single-use 2-minute codes, 5-minute opaque access tokens,
  `hash_equals` comparisons. It only exposes name/email/username/roles of the logged-in user.
- The food app never sees WordPress or UF credentials.
- The bot's internal API is protected by `BOT_API_TOKEN` and lives inside the compose
  network; only the web port (and optionally Caddy) is exposed.
