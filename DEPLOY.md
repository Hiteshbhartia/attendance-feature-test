# Self-hosting GHARPAYY Arena on your VPS

This guide stands up a complete, **self-contained** backend (Node.js API + MongoDB + Caddy reverse proxy with auto-SSL) on your own VPS using Docker Compose.

The frontend (this Lovable app) keeps running on Lovable ohsting and just **calls your VPS** for data — that way you keep the nice preview/publish flow while the data lives on hardware you control.

---

## What you get

- **MongoDB 7** (auth-enabled, data volume on the VPS, **not** exposed to the public internet)
- **Express API** at `https://YOUR_DOMAIN/api/*` covering all 11 modules:
  auth, employees, attendance, tasks, leaves, kudos, calendar, notifications, 1:1s, recruiting, console
- **Caddy** as a reverse proxy with **automatic Let's Encrypt SSL**
- **JWT auth** with bcrypt password hashing, role-based access, and rate limiting
- A **seed script** to load demo employees and bootstrap the first admin user

---

## Prerequisites

1. A VPS running **Ubuntu 22.04+** (or any Linux with Docker).
2. **Docker + docker-compose plugin** installed:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # log out and back in
   ```
3. A **domain name** pointed at your VPS via an A record (e.g. `arena.mycompany.com → 1.2.3.4`).
   Caddy will get an SSL certificate automatically — but only if DNS is correct **before** you start it.
4. Ports **80 and 443** open in your VPS firewall:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow 22
   sudo ufw enable
   ```

---

## Step 1 — Get the code on your VPS

You have two options:

### Option A: clone from GitHub (recommended)

After you publish this Lovable project to GitHub, on the VPS:

```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git arena
cd arena
```

### Option B: copy just the server folder + compose files

You only need these files on the VPS — the React frontend doesn't run there:

```
arena/
├── docker-compose.yml
├── Caddyfile
└── server/        (the entire folder)
```

Use `scp -r` or `rsync` to copy them.

---

## Step 2 — Configure secrets

```bash
cp server/.env.example .env
nano .env
```

**Fill in every `CHANGE_ME` value.** Critical ones:

| Variable                     | What to set                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `MONGO_INITDB_ROOT_PASSWORD` | A long random string. Use `openssl rand -base64 32`                  |
| `MONGODB_URI`                | Update the password to match the one above                           |
| `JWT_SECRET`                 | `openssl rand -hex 64`                                               |
| `PUBLIC_DOMAIN`              | Your domain, e.g. `arena.mycompany.com`                              |
| `CORS_ORIGINS`               | The URL of your Lovable frontend, e.g. `https://howtohr.lovable.app` |

> ⚠️ The `.env` file is in `.gitignore`. **Never commit it.**

---

## Step 3 — Start the stack

```bash
docker compose up -d
docker compose logs -f api
```

You should see `[api] mongo connected` and `[api] listening on :4000`.

Test it:

```bash
curl https://YOUR_DOMAIN/api/health
# → {"ok":true,"db":"connected","ts":...}
```

If SSL fails: check DNS first (`dig YOUR_DOMAIN`), then `docker compose logs caddy`.

---

## Step 4 — Seed the database & create the first admin

```bash
docker compose exec api node scripts/seed.js
```

This:

- Inserts the demo employees (`e1`–`e15`).
- If no users exist, creates an admin: `admin@arena.local` / `ChangeMe123!`.

**Log in immediately and change the password.** You can override the bootstrap creds:

```bash
docker compose exec -e SEED_ADMIN_EMAIL=you@yourco.com -e SEED_ADMIN_PASSWORD='YourStrongPass!' api node scripts/seed.js
```

---

## Step 5 — Point the frontend at your VPS

In **this Lovable project**, set a build env var (Project Settings → Environment Variables):

```
VITE_API_URL=https://YOUR_DOMAIN/api
```

Then **republish** the project. The frontend's API client (already scaffolded in `src/lib/api-client.ts`) will start hitting your VPS.

> **Round 2** of the migration (rewiring each store from localStorage → API) happens in the next chat turn. After Round 1, the API exists and is callable, but the frontend is still on localStorage.

---

## Maintenance

### Backups (do this!)

```bash
# Daily Mongo dump to /root/backups
docker compose exec -T mongo mongodump --archive --gzip \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  > /root/backups/arena-$(date +%F).archive.gz
```

Add to crontab. Test restores periodically.

### Update the app

```bash
git pull
docker compose build api
docker compose up -d
```

### Logs

```bash
docker compose logs -f api      # API logs
docker compose logs -f caddy    # SSL / proxy logs
docker compose logs -f mongo    # DB logs
```

### Resource use

The whole stack runs comfortably on **1 vCPU / 2 GB RAM**. For >50 active users add RAM.

---

## Security checklist

- [ ] Strong `JWT_SECRET` (64+ random hex chars)
- [ ] Strong `MONGO_INITDB_ROOT_PASSWORD`
- [ ] UFW enabled, only 22/80/443 open
- [ ] SSH key-only login, root login disabled
- [ ] Mongo **never** exposed to the internet (it isn't in this compose file — keep it that way)
- [ ] Default admin password changed
- [ ] Daily backups configured & tested
- [ ] Caddy auto-renews SSL (it does this by default)

---

## Troubleshooting

**"Connection refused" from frontend** → Check `CORS_ORIGINS` in `.env` includes your frontend URL exactly.

**SSL cert never arrives** → Caddy needs DNS pointing at the VPS _before_ port 80/443 are reachable. Run `dig YOUR_DOMAIN +short` — must return your VPS IP.

**`MONGODB_URI missing`** → You ran `docker compose up` without an `.env` file in the project root.

**Login returns 403 "pending approval"** → Only the **first** signup is auto-approved (becomes admin). Subsequent users need an admin to call `POST /api/auth/approve/:userId`. Round 2 will add a UI for this.

**Need to wipe everything and start over**:

```bash
docker compose down -v   # ⚠️ deletes the mongo volume
docker compose up -d
docker compose exec api node scripts/seed.js
```
