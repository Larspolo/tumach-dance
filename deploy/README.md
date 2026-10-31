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

The live site runs next to the preview, with its own data, keys and updater. Do this once.

1. Copy the folder `deploy/live` to the home server, for example to `~/tumach-live`.
2. In that folder, copy `.env.example` to `.env` and fill it in as for the preview, with the live values: a new
   `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), new VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`), and the live `BETTER_AUTH_URL`, Mailgun key and domain. Its `TUNNEL_TOKEN` is the one of a new tunnel.
   Never copy the `.env` of the preview.
3. Make the folder of the backups, writable by the user of the image (`nextjs`, uid 1001):
   `mkdir backups && sudo chown 1001:1001 backups`.
4. Run `docker compose --profile tunnel up -d`.
5. In Cloudflare, at the live tunnel, add a public hostname and service `http://site:3000` (of this project).

The live site is on port 3001 of the server, and its updater restarts only its own container (scope `live`).
Its data is in the Docker volume `tumach-live_data`; the backups are in `~/tumach-live/backups` (14 nights).
The address tumach.dance is not switched yet: that waits for the texts of Nina (epic #245).

### Put a version live

1. On GitHub, go to Releases > Draft a new release.
2. Create a new tag `v<n>` (the next number), target `main`, and click Publish.
3. The server pulls the new `live` image within 5 minutes, and restarts the live site.

### Restore a backup

Use this to go back to the data of one night (the date `YYYY-MM-DD` of a file in `backups/`):

```sh
docker compose stop site
docker compose run --rm --no-deps site node scripts/restore.mjs 2026-11-01
docker compose up -d
```

The restore copies the database of that night and the photos that are missing. It changes nothing when that night
has no backup, and it prints the dates that exist.

## Change of the preview (scope)

The preview and the live site each have an updater with its own scope (`preview` and `live`). After this change, run
`docker compose up -d` once in the folder of the preview (`~/tumach-preview`), so that its updater gets the new scope.
