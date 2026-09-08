# CloudPybara

A small website that lists, uploads, and downloads photos stored on your
Android phone. The website itself runs on your computer — the phone only
runs a lightweight SFTP server and holds the actual files. Nothing needs to
be installed or built on the phone.

```
Browser ⇄ website (runs on your Mac) ⇄ SFTP over the network ⇄ phone (storage only)
```

## What's here

- `src/app/page.tsx` — the UI: folders, photo gallery, file list, upload, create folder.
- `src/app/login/page.tsx` — the sign-in page.
- `src/app/api/files/route.ts` — list a folder's contents (`GET ?folder=`) and upload files (`POST`).
- `src/app/api/files/[...path]/route.ts` — download (`GET`) and delete (`DELETE`) one file, at any nesting depth.
- `src/app/api/folders/route.ts` — create a new folder (`POST`).
- `src/app/api/login/route.ts`, `src/app/api/logout/route.ts` — sign in/out.
- `src/lib/storage.ts` — every file/folder read/write goes through here, over SFTP to the phone.
- `src/lib/session.ts` — signs and verifies the login session cookie.
- `src/proxy.ts` — redirects to `/login` (or returns 401 for API calls) when there's no valid session cookie.

## 1. Turn your phone into an SFTP server

Install **[Primitive FTPd](https://f-droid.org/packages/org.primftpd/)** from
F-Droid or the Play Store — it's free, open-source, and needs no setup beyond
a few taps.

1. Open the app, set a username and password under its SFTP settings.
2. Create a folder on your phone named `PhoneCloud` (any file manager app can
   do this) — this is where uploaded photos will live.
3. Point Primitive FTPd's server root at that folder (or note the path to it
   if the app roots at your whole storage instead).
4. Note the **SFTP port** (not the FTP port — the app runs both at once, on
   different ports; make sure you copy the SFTP one) and tap **Start**.

The phone is now done — you don't need to touch it again unless you restart
the server.

## 2. Let your computer reach the phone from anywhere: Tailscale

1. Install the **Tailscale** app on your phone and sign in.
2. Install Tailscale on your computer and sign in with the same account.
3. On the phone, open the Tailscale app and note its Tailscale IP (looks like
   `100.x.x.x`) — this is the address your computer will use to reach it,
   whether you're on the same Wi-Fi or on the other side of the world.

## 3. Configure and run the website on your computer

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```
AUTH_USER=pick-a-username
AUTH_PASSWORD=pick-a-strong-password
SESSION_SECRET=...          # generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PORT=3000

SFTP_HOST=100.x.x.x        # the phone's Tailscale IP from step 2
SFTP_PORT=2222             # the SFTP port from Primitive FTPd (not the FTP port)
SFTP_USERNAME=...          # from Primitive FTPd
SFTP_PASSWORD=...          # from Primitive FTPd
SFTP_REMOTE_DIR=PhoneCloud   # no leading slash — see .env.example for why
```

Then run it:

```bash
npm run dev     # while you're building/testing
# or
npm run build && npm start   # for regular use
```

Open http://localhost:3000, sign in on the login page with
`AUTH_USER`/`AUTH_PASSWORD`, and try uploading a photo — it lands directly in
the `PhoneCloud` folder on your phone, not on your computer.

The sign-in creates a signed cookie that's valid for 30 days, so you won't
need to log in again on that browser until it expires (or you log out).

## Deploying to a VPS (Docker)

The `Dockerfile` builds a self-contained image (`output: "standalone"` in
`next.config.ts`). None of the application code changes for this — only
where it runs and its env vars.

**The one thing that matters for the phone connection:** the VPS must join
the same Tailscale network as the phone, or it can't reach it over SFTP —
this is independent of whatever you use for the public-facing side
(domain, reverse proxy, TLS).

**Build on your Mac, not on the VPS.** The VPS never runs `docker build` —
it only pulls a finished image from GitHub Container Registry (ghcr.io) and
runs it. This keeps the VPS's CPU/RAM free and makes deploys fast. Since
this Mac is Apple Silicon (arm64) and a typical Ubuntu VPS is x86_64, the
build targets `linux/amd64` explicitly via `docker buildx` (Docker's
cross-platform build support) even though you're building on different
hardware.

### One-time setup

**On your Mac** — log in to ghcr.io so you can push:

1. Create a GitHub Personal Access Token (classic) with the `write:packages`
   scope, at github.com → Settings → Developer settings → Personal access
   tokens.
2. `docker login ghcr.io -u <your-github-username>` and paste the token
   when prompted for a password (run this yourself in a terminal — never
   paste a token into chat).

**On the Ubuntu VPS:**

```bash
# Install Docker: see docs.docker.com/engine/install/ubuntu

# Install and join Tailscale on the VPS itself
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# log in with the same Tailscale account as the phone

# Confirm the VPS can actually reach the phone
tailscale ping <phone-tailscale-ip>

# Log in to ghcr.io so `docker pull` works (a read:packages-scoped token is
# enough here — or make the package public in GitHub's package settings
# after your first push, and skip this login on the VPS entirely)
docker login ghcr.io -u <your-github-username>
```

### Every deploy

**On your Mac**, build for the VPS's architecture and push in one step:

```bash
docker buildx build --platform linux/amd64 \
  -t ghcr.io/<your-github-username>/cloudpybara:latest \
  --push .
```

**On the VPS**, pull the new image and restart the container:

```bash
docker pull ghcr.io/<your-github-username>/cloudpybara:latest
docker rm -f cloudpybara 2>/dev/null

cp .env.example .env.production   # first time only — fill in real values
docker run -d --name cloudpybara \
  --network host \
  --env-file .env.production \
  --restart unless-stopped \
  ghcr.io/<your-github-username>/cloudpybara:latest
```

`--network host` means the container shares the VPS's own network stack —
this is what lets it reach the phone's Tailscale IP directly, and it also
means your reverse proxy (Caddy, Nginx, whatever you're already using) can
reach the app the same way it would reach any other process:
`127.0.0.1:PORT`. In host mode there's no `-p` port mapping — the
container listens directly on the VPS's `PORT`.

## Notes

- This app has no built-in HTTPS. Tailscale traffic is already encrypted
  between your devices, so this is fine for personal use over Tailscale.
  Don't expose the website's port directly to the public internet.
- A private key (`SFTP_PRIVATE_KEY_PATH` in `.env.local`) is more secure than
  a password if Primitive FTPd's key-auth mode is set up — optional, password
  auth is fine for personal use over Tailscale.
- Deleting a folder doesn't truly remove it — Primitive FTPd's SFTP server
  rejects the actual delete-folder operation, so instead the site renames the
  folder into a hidden `.trash` folder inside `PhoneCloud` (this still moves
  everything inside it out of the way, just not off the phone's storage). To
  actually free the space, empty `PhoneCloud/.trash` from the phone's own
  file manager occasionally.
- Tap the checkbox icon in the top-right to select multiple photos, files,
  or folders at once and delete them together.
- Logging out clears the cookie in your browser, but the session token
  itself isn't tracked server-side, so it can't be individually revoked
  early. If you ever suspect a session leaked, change `SESSION_SECRET` — that
  invalidates every session at once.
