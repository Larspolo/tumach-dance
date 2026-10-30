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
