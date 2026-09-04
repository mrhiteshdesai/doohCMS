# Smartags Backend — Linux EC2 Deployment Guide (Layman)

**For someone new to Linux servers.**  
Follow the steps **in order**. Copy-paste commands carefully.

## Your production connection values (BrandEagles)

| Item | Value |
|------|--------|
| Elastic / Public IP | **`13.202.75.97`** |
| SSH user | **`ec2-user`** |
| SSH private key (on your PC) | **`C:\QR\Server\SmartagsCMS.pem`** |
| API domain | `https://dooh.brandeagles.com` |
| CMS (Netlify) | `https://cms.brandeagles.com` |
| TV API base | `https://dooh.brandeagles.com/api` |
| GitHub repo | **`https://github.com/mrhiteshdesai/doohCMS.git`** |
| Default branch | `main` |

> **Git status note:** OTA / VAST / snapshot-fix / these deploy docs may still be **local only** until you commit + push to `main`. If `git clone` on the server looks outdated, use **scp upload** (Option 2 below) or push from your PC first.

**Login from your Windows PC (PowerShell):**

```powershell
icacls "C:\QR\Server\SmartagsCMS.pem" /inheritance:r
icacls "C:\QR\Server\SmartagsCMS.pem" /grant:r "$($env:USERNAME):(R)"
ssh -i "C:\QR\Server\SmartagsCMS.pem" ec2-user@13.202.75.97
```

**Upload backend folder from your PC (when you reach Part E):**

```powershell
scp -i "C:\QR\Server\SmartagsCMS.pem" -r C:\Projects\Smartags\backend ec2-user@13.202.75.97:/opt/smartags/
```

**DNS (when ready for HTTPS):** `dooh` **A** record → **`13.202.75.97`**

---

| Item | Choice |
|------|--------|
| Server | **One** Amazon Linux 2023 EC2 |
| Size | **`t3.large`** (2 vCPU / 8 GB) — cost-effective for ~400 screens on Linux |
| More headroom | `t3.xlarge` (16 GB) if you want extra safety |
| Database | TimescaleDB in **Docker** on the same server |
| API process | **systemd** (Linux equivalent of NSSM) |
| HTTPS reverse proxy | **nginx** |
| Frontend | **Netlify** (`cms.brandeagles.com`) — unchanged |

---

## Domains

| Role | URL |
|------|-----|
| API | `https://dooh.brandeagles.com` |
| CMS (Netlify) | `https://cms.brandeagles.com` |
| TV API base | `https://dooh.brandeagles.com/api` |

---

## What you will build

```text
Internet
   │
   │  https://dooh.brandeagles.com
   ▼
┌──────────── Amazon Linux EC2 (t3.large) @ 13.202.75.97 ────────────┐
│  nginx (:443)  →  Node API (:3000)  [systemd]                         │
│                     │                                                 │
│                     ▼                                                 │
│              TimescaleDB Docker (:5432 localhost)                     │
└───────────────────────────────────────────────────────────────────────┘

Browsers → Netlify (cms.brandeagles.com) → API above
TVs      → https://dooh.brandeagles.com/api
```

---

## Words you will see (30-second dictionary)

| Word | Meaning |
|------|--------|
| **EC2** | A rented computer in Amazon’s cloud |
| **SSH** | Remote login to Linux (like RDP, but text-based) |
| **Terminal / shell** | Where you type commands on Linux |
| **sudo** | “Do this as administrator” |
| **systemd / service** | Keeps the API running after reboot |
| **nginx** | Receives HTTPS traffic and forwards it to Node |
| **Docker** | Runs TimescaleDB in a small isolated box |
| **`.env`** | Secret settings file for the API |

---

# PART A — Create the Linux server in AWS

## A1. Launch the instance

1. Open **AWS Console** in your browser.
2. Go to **EC2** → **Instances** → **Launch instance**.
3. Fill in:

| Field | What to choose |
|-------|----------------|
| Name | `smartags-backend-prod` |
| Application and OS Images | **Amazon Linux 2023** |
| Instance type | **`t3.large`** |
| Key pair | Existing key that matches **`C:\QR\Server\SmartagsCMS.pem`** (e.g. SmartagsCMS). Do **not** create a new key unless you also save the new `.pem`. |
| Storage | **80 GB** gp3 |
| File systems (EFS / FSx / S3) | **Leave empty** — not needed |

4. Click **Launch instance**.

## A2. Security Group (firewall rules)

Edit the instance’s security group. Inbound rules:

| Type | Port | Source | Why |
|------|------|--------|-----|
| SSH | 22 | **My IP** only | So only you can log in |
| HTTP | 80 | Anywhere (`0.0.0.0/0`) | For HTTPS redirect / cert |
| HTTPS | 443 | Anywhere (`0.0.0.0/0`) | Public API |

Do **not** open port `5432` (database) to the internet.

## A3. Elastic IP (fixed public address)

1. EC2 → **Elastic IPs** → **Allocate**.
2. **Associate** it with `smartags-backend-prod`.
3. For this deployment the Elastic IP is **`13.202.75.97`**.

## A4. Point DNS (can do later, but need it before HTTPS)

At your DNS provider for `brandeagles.com`:

| Host | Type | Value |
|------|------|--------|
| `dooh` | **A** | **`13.202.75.97`** |

Wait a few minutes after creating it.

---

# PART B — Log in with SSH (from your Windows PC)

## B1. Open PowerShell on your PC

You can run SSH from any folder; the key path is absolute.

## B2. Fix key permissions (run once if SSH complains about the key)

```powershell
icacls "C:\QR\Server\SmartagsCMS.pem" /inheritance:r
icacls "C:\QR\Server\SmartagsCMS.pem" /grant:r "$($env:USERNAME):(R)"
```

## B3. Connect

```powershell
ssh -i "C:\QR\Server\SmartagsCMS.pem" ec2-user@13.202.75.97
```

- First time it asks “Are you sure…?” → type `yes` and Enter.
- Username: **`ec2-user`**
- Host: **`13.202.75.97`**
- Key: **`C:\QR\Server\SmartagsCMS.pem`**

You should see a prompt like:

```text
[ec2-user@ip-xxx-xxx-xxx-xxx ~]$
```

You are now **on the server**. All commands below are typed **here**, unless it says “on your PC”.

> Tip: If SSH fails, check Security Group allows port 22 from **your current IP**.

---

# PART C — Update the server and install tools

Still SSH’d in as `ec2-user`.

## C1. Update packages

```bash
sudo dnf update -y
```

## C2. Install Git, nginx, and useful tools

```bash
sudo dnf install -y git nginx
```

## C3. Install Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v
npm -v
```

You should see versions (e.g. `v20.x.x`).

## C4. Install Docker

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

**Log out of SSH and log back in** (needed for Docker group):

```bash
exit
```

On your PC again:

```powershell
ssh -i "C:\QR\Server\SmartagsCMS.pem" ec2-user@13.202.75.97
```

Check Docker:

```bash
docker version
```

## C5. Install Docker Compose plugin

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

---

# PART D — Start TimescaleDB (database)

## D1. Create a folder

```bash
sudo mkdir -p /opt/smartags/db
sudo chown ec2-user:ec2-user /opt/smartags/db
cd /opt/smartags/db
```

## D2. Create the compose file

```bash
nano docker-compose.yml
```

`nano` is a simple text editor.

1. Paste this (change the password to something strong):

```yaml
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    container_name: smartags_timescaledb
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: "CHANGE_ME_TO_A_STRONG_PASSWORD"
      POSTGRES_DB: smartags
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
    restart: always

volumes:
  timescaledb_data:
```

2. Save: press `Ctrl+O`, Enter, then exit: `Ctrl+X`.

## D3. Start the database

```bash
cd /opt/smartags/db
docker compose up -d
docker compose ps
```

Status should show **running**.

## D4. Confirm Timescale works

```bash
docker exec -it smartags_timescaledb psql -U postgres -d smartags \
  -c "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';"
```

You should see a version number. If this errors, wait 20 seconds and try again (DB may still be starting).

**Remember your DB password** — you will put the same one in the API `.env`.

---

# PART E — Put the backend code on the server

## E1. Create app folders

```bash
sudo mkdir -p /opt/smartags/backend /opt/smartags/logs
sudo chown -R ec2-user:ec2-user /opt/smartags
```

## E2. Get the code

**Option 1 — Git clone from GitHub:**

```bash
cd /opt/smartags
git clone https://github.com/mrhiteshdesai/doohCMS.git repo
cp -r repo/backend/* backend/
```

If the repo is private, GitHub will ask for credentials, or use a Personal Access Token / deploy key.

> Only use Option 1 after the latest backend work is **committed and pushed** to `main`. Otherwise the server will get an older codebase.

**Option 2 — Upload from your PC (use this now if git is not updated yet):**

On your **Windows PC** (new PowerShell window, not SSH).  
**Tip:** right-click to paste in some terminals; in Windows Terminal use `Ctrl+Shift+V`.

```powershell
scp -i "C:\QR\Server\SmartagsCMS.pem" -r C:\Projects\Smartags\backend ec2-user@13.202.75.97:/opt/smartags/
```

That copies your local `backend` folder to the server at `/opt/smartags/backend`.

## E3. Create the secrets file `.env`

```bash
cd /opt/smartags/backend
nano .env
```

Paste (edit password, JWT, keep domains as below):

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:CHANGE_ME_TO_A_STRONG_PASSWORD@127.0.0.1:5432/smartags?schema=public
JWT_SECRET=PASTE_A_LONG_RANDOM_STRING_AT_LEAST_32_CHARACTERS
CORS_ORIGINS=https://cms.brandeagles.com
TRUST_PROXY=true
ALLOW_PUBLIC_REGISTRATION=false
```

Rules:

- DB password must **match** `POSTGRES_PASSWORD` in Docker.
- `JWT_SECRET` = long random text (password manager is fine).
- Save: `Ctrl+O`, Enter, `Ctrl+X`.

## E4. Install dependencies, migrate DB, build

```bash
cd /opt/smartags/backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

This can take a few minutes. Wait until it finishes without red errors.

## E5. Create admin user (first time only)

```bash
cd /opt/smartags/backend
npm run seed-admin
```

Note the default admin email/password from the script output (or project defaults). **Change the password after first CMS login.**

## E6. Quick manual test

```bash
cd /opt/smartags/backend
node dist/index.js
```

In **another SSH window** (second terminal):

```powershell
ssh -i "C:\QR\Server\SmartagsCMS.pem" ec2-user@13.202.75.97
```

Then on the server:

```bash
curl -s http://127.0.0.1:3000/health/live
curl -s http://127.0.0.1:3000/health/ready
```

You want healthy / OK style responses (HTTP 200).

Go back to the first window and stop the test with `Ctrl+C`.

---

# PART F — Keep the API running forever (systemd)

This is the Linux version of NSSM.

## F1. Create the service file

```bash
sudo nano /etc/systemd/system/smartags-backend.service
```

Paste:

```ini
[Unit]
Description=Smartags Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/smartags/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=append:/opt/smartags/logs/backend-stdout.log
StandardError=append:/opt/smartags/logs/backend-stderr.log

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

## F2. Start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartags-backend
sudo systemctl start smartags-backend
sudo systemctl status smartags-backend
```

Look for **active (running)** (green/OK). Press `q` to leave the status screen.

Useful later:

```bash
sudo systemctl restart smartags-backend
sudo systemctl status smartags-backend
tail -n 100 /opt/smartags/logs/backend-stderr.log
```

---

# PART G — HTTPS with nginx + Let’s Encrypt

## G1. Basic nginx site (HTTP first)

```bash
sudo nano /etc/nginx/conf.d/smartags.conf
```

Paste:

```nginx
server {
    listen 80;
    server_name dooh.brandeagles.com;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }
}
```

Save and exit.

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl restart nginx
```

## G2. Open firewall on the instance (if using firewalld)

Amazon Linux often relies on Security Groups only. If `curl` from outside fails, re-check SG ports 80/443.

## G3. Get a free HTTPS certificate (Certbot)

Only after DNS `dooh.brandeagles.com` points to **`13.202.75.97`**:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dooh.brandeagles.com
```

Follow prompts (email, agree to terms). Certbot will adjust nginx for HTTPS.

Test in your browser:

```text
https://dooh.brandeagles.com/health/live
https://dooh.brandeagles.com/health/ready
```

Both should work over HTTPS.

---

# PART H — Netlify frontend (still Netlify)

1. Netlify → Site → Environment variables:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://dooh.brandeagles.com` |

2. Domain `cms.brandeagles.com` → CNAME to Netlify as they show.  
3. **Redeploy** production.  
4. Open `https://cms.brandeagles.com` → login → Network tab should call `dooh.brandeagles.com`.

---

# PART I — Point TVs

On each player, API base:

```text
https://dooh.brandeagles.com/api
```

Then pair as usual.

---

# PART J — Go-live checklist

- [ ] Amazon Linux at **`13.202.75.97`**  
- [ ] Timescale Docker `running`  
- [ ] `smartags-backend` systemd service **active**  
- [ ] nginx + HTTPS on `dooh.brandeagles.com`  
- [ ] `/health/live` and `/health/ready` = OK  
- [ ] Netlify redeployed with `VITE_API_URL`  
- [ ] CMS login works (no CORS errors)  
- [ ] One TV pairs and plays  
- [ ] SSH only from your IP  
- [ ] DB port not public  

---

# PART K — Everyday operations (copy-paste)

## Restart API

```bash
sudo systemctl restart smartags-backend
```

## Restart database

```bash
cd /opt/smartags/db
docker compose restart
```

## Deploy new backend code

From PC (upload):

```powershell
scp -i "C:\QR\Server\SmartagsCMS.pem" -r C:\Projects\Smartags\backend ec2-user@13.202.75.97:/opt/smartags/
```

On server:

```bash
cd /opt/smartags/backend
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart smartags-backend
```

## View API errors

```bash
tail -n 100 /opt/smartags/logs/backend-stderr.log
```

## Backup database

```bash
docker exec smartags_timescaledb pg_dump -U postgres smartags \
  > /opt/smartags/db/backup-$(date +%F).sql
```

Copy that file off the server (S3 or `scp` to your PC).

---

# PART L — Common problems

| Problem | What to do |
|---------|------------|
| `Permission denied (publickey)` | Use `C:\QR\Server\SmartagsCMS.pem`, user `ec2-user`, IP `13.202.75.97` |
| `Connection timed out` SSH | Security Group port 22 not open to your IP |
| `npm ci` fails | You are not in `/opt/smartags/backend`, or Node not installed |
| `/health/ready` fails | Docker DB not running, or wrong password in `.env` |
| CMS CORS error | `.env` must include `https://cms.brandeagles.com`, then `sudo systemctl restart smartags-backend` |
| Certbot fails | DNS A record for `dooh` not pointing to **`13.202.75.97`** yet |
| Site 502 | API service down → `sudo systemctl status smartags-backend` |

---

## Quick reference

| Item | Value |
|------|--------|
| OS | Amazon Linux 2023 |
| Instance | **`t3.large`** |
| Elastic IP | **`13.202.75.97`** |
| SSH user | `ec2-user` |
| SSH key (PC) | `C:\QR\Server\SmartagsCMS.pem` |
| App path | `/opt/smartags/backend` |
| DB path | `/opt/smartags/db` |
| Service name | `smartags-backend` |
| API URL | `https://dooh.brandeagles.com` |
| CMS | `https://cms.brandeagles.com` (Netlify) |
| TV API | `https://dooh.brandeagles.com/api` |
| GitHub | `https://github.com/mrhiteshdesai/doohCMS.git` |

---

## Why Linux instead of Windows (for you right now)

- Your Windows `t3` could **not** run WSL2/Docker (no nested virtualization).  
- Timescale **needs** Linux Docker.  
- One Linux box = API + DB together, simpler and usually cheaper (no Windows license).  
- Netlify frontend stays the same.
