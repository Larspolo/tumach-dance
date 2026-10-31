# The preview on the home server

You do this once. After it, the server pulls each new preview image by itself (every 5 minutes).

1. Copy the folder `deploy/preview` to the home server, for example to `~/tumach-preview`.
2. In that folder, copy `.env.example` to `.env`.
3. Fill in `.env`:
   - `STUDIO_EMAIL`: the email of Nina.
   - `BETTER_AUTH_URL`: the public address of the preview, for example `https://preview.tumach.dance`.
   - `BETTER_AUTH_SECRET`: the output of `openssl rand -base64 32`.
   - `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` (and `MAILGUN_API_URL` for an EU account).
   - `TUNNEL_TOKEN`: in Cloudflare, Zero Trust > Networks > Tunnels > Create a tunnel (type Cloudflared). Copy the token of
     the Docker command.
4. Run `docker compose --profile tunnel up -d`.
5. In Cloudflare, at the tunnel, add a public hostname: `preview.tumach.dance`, service `http://site:3000`.
6. Open the address. You see the site with the "test site" banner.

The updater (watchtower) restarts only the container `site`: it does not touch Home Assistant or other containers.
The data of the site is in the Docker volume `tumach-preview_data`.

## The live site

The live site is tumach.dance. It runs the same image as the preview (tag `preview`): each merge to main goes live
within 5 minutes, with no step by you (owner, 2026-10-31). It has its own data, keys, tunnel and updater, and no
"test site" banner. Do this once.

1. Copy the folder `deploy/live` to the home server, for example to `~/tumach-live`.
2. In that folder, copy `.env.example` to `.env` and fill it in with new values: a new `BETTER_AUTH_SECRET`
   (`openssl rand -base64 32`), new VAPID keys (`npx web-push generate-vapid-keys`), the live Mailgun key and domain,
   and the `TUNNEL_TOKEN` of a new tunnel. Never copy the `.env` of the preview.
3. Make the folder of the backups, writable by the user of the image (`nextjs`, uid 1001):
   `mkdir backups && sudo chown 1001:1001 backups`.
4. Run `docker compose --profile tunnel up -d`.
5. In Cloudflare, at the live tunnel, add the public hostname `tumach.dance` with the service `http://site:3000`.
   When Cloudflare says that a DNS record of `tumach.dance` exists (the old site), remove that record first.
6. Open https://tumach.dance. You see the site with no "test site" banner.

The live site is on port 3001 of the server, and its updater restarts only its own container (scope `live`).
Its data is in the Docker volume `tumach-live_data`; the backups are in `~/tumach-live/backups` (14 nights).

### Restore a backup

Use this to go back to the data of one night (the date `YYYY-MM-DD` of a file in `backups/`):

```sh
docker compose stop site
docker compose run --rm --no-deps site node scripts/restore.mjs 2026-11-01
docker compose up -d
```

The restore copies the database of that night and the photos that are missing. It changes nothing when that night
has no backup, and it prints the dates that exist.

### The site watch

The workflow Site watch of GitHub (`.github/workflows/site-watch.yml`) checks the live site for you. When the site
is down, you get a ticket and a message on your phone.

1. What it checks: `/api/health` (the database and the age of the newest backup) and the home page `/en` of
   https://tumach.dance. It checks each 15 minutes, and about 7 minutes after each new image. When one of them does
   not answer in two checks one minute apart, it opens one `P0` ticket with the label `site-down` and the error text.
   When the site answers again, the watch closes the ticket.
2. Get the message on your phone (do this once):
   1. Install the GitHub app on your phone, tap **Sign in**, and allow notifications when the app asks.
   2. On the page of the repository (in the app or on github.com), tap **Watch** > **Custom**, select **Issues**, and
      tap **Apply**. (Or select **All Activity**.)
3. Try it once (about 20 minutes of downtime):
   1. In `~/tumach-live`, run `docker compose stop site`.
   2. Wait up to 20 minutes. You get a push of a new ticket with the label `site-down`.
   3. Run `docker compose start site`.
   4. Within 15 minutes, the watch closes the ticket.

## Change of the preview (scope)

The preview and the live site each have an updater with its own scope (`preview` and `live`). After this change, run
`docker compose up -d` once in the folder of the preview (`~/tumach-preview`), so that its updater gets the new scope.
