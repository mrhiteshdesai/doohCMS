# Smartags Production Deployment Guide

**Scope:** Production only (staging out of scope)  
**API compute:** **AWS EC2 Windows** (`t3.xlarge`) — IIS + Node via **NSSM**  
**Database:** **TimescaleDB in Docker on a second Linux EC2** (`t3.medium`)  
**Frontend:** **Netlify** (unchanged)  

> **Why two instances?** Windows `t3` EC2 cannot run WSL2/Docker Linux containers (no nested virtualization). Timescale needs Linux Docker, so the DB sits on a small Amazon Linux box. The Windows host stays for IIS/NSSM as planned.

---

## Instance types (cost-effective for ~400 screens)

| Role | Instance | Spec | Notes |
|------|----------|------|--------|
| **API (Windows)** | **`t3.xlarge`** | 4 vCPU / **16 GB** | IIS + Node; can downsize to `t3.large` later if RAM is idle |
| **DB (Linux)** | **`t3.medium`** | 2 vCPU / **4 GB** | TimescaleDB only — enough for ~400 screens |
| Frontend | Netlify | — | `cms.brandeagles.com` |

**Windows disk:** 80–100 GB gp3  
**Linux DB disk:** 40–80 GB gp3 (grows with PoP/heartbeats)

---

## Domains

| Role | Domain | Notes |
|------|--------|--------|
| Backend API | `https://dooh.brandeagles.com` | EC2 IIS `:443` → Node `:3000` |
| CMS / web player | `https://cms.brandeagles.com` | **Netlify** |
| TV player API base | `https://dooh.brandeagles.com/api` | Same API host for all screens |

---

## Architecture

```text
[Android TV / boxes]
        │
        │  HTTPS  https://dooh.brandeagles.com/api
        ▼
┌──────── EC2 t3.xlarge (Windows) ────────┐     ┌── EC2 t3.medium (Amazon Linux) ──┐
│  IIS (:443) → Node (:3000) [NSSM]       │────►│  TimescaleDB Docker (:5432)       │
│  uploads / APKs (or S3 later)           │     │  private SG only from Windows     │
└─────────────────────────────────────────┘     └───────────────────────────────────┘

[Browsers] → Netlify cms.brandeagles.com → API https://dooh.brandeagles.com
```

---

## Prerequisites checklist

- [ ] AWS account (EC2, Elastic IP, Security Groups)
- [ ] DNS control for `brandeagles.com`
- [ ] Smartags `backend` code (git or zip)
- [ ] Strong DB password + `JWT_SECRET` (32+ chars)
- [ ] RDP client (Windows) + SSH key (Linux DB)
- [ ] TLS plan for `dooh.brandeagles.com`
- [ ] Netlify access for `cms.brandeagles.com`

---

## Part 1 — Create the EC2 instance

### 1.1 Launch

1. AWS Console → **EC2** → **Launch instance**.
2. Use:

| Field | Value |
|-------|--------|
| Name | `smartags-backend-prod` |
| AMI | Windows Server 2025 Base *(or 2022)* |
| Instance type | **`t3.xlarge`** |
| Key pair | Create/download `.pem` and store safely |
| Storage | **100 GB** gp3 |

3. Launch.

### 1.2 Security Group (`smartags-backend-sg`)

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| RDP | 3389 | **Your office/VPN IP only** | Admin |
| HTTP | 80 | `0.0.0.0/0` | Optional redirect to HTTPS |
| HTTPS | 443 | `0.0.0.0/0` | Public API |
| Custom TCP | 3000 | *(temp)* Your IP only | Direct Node test — remove later |

**Do not** open PostgreSQL `5432` to the internet. DB listens on localhost inside the instance only.

### 1.3 Elastic IP

1. **Elastic IPs** → Allocate → Associate to this instance.  
2. You will point `dooh.brandeagles.com` at this IP.

### 1.4 RDP in

1. Instance → **Connect** → RDP → decrypt password with `.pem`.  
2. Log in as Administrator; set a strong password and store it.

---

## Part 2 — Install software on the server

Open **PowerShell as Administrator**.

### 2.1 Node.js 20 LTS

Prefer the **winget** source only (avoids Microsoft Store certificate errors on some EC2 images):

```powershell
winget install --id OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
```

If that still fails, download the **Windows x64 LTS MSI** from [https://nodejs.org](https://nodejs.org) → run the installer → Next through defaults (include “Add to PATH”).

Then **close and reopen** PowerShell (required so PATH updates), and verify:

```powershell
node -v
npm -v
```

You should see versions like `v20.x.x` and `10.x.x`. If `node` is still not recognized, log out of RDP and back in, or reboot once.

### 2.2 Git

```powershell
winget install --id Git.Git --source winget --accept-package-agreements --accept-source-agreements
```

Close and reopen PowerShell, then:

```powershell
git --version
```

If winget fails, install from [https://git-scm.com/download/win](https://git-scm.com/download/win) (64-bit).

### 2.3 NSSM

```powershell
winget install --id NSSM.NSSM --source winget --accept-package-agreements --accept-source-agreements
```

Close and reopen PowerShell, then confirm:

```powershell
nssm version
```

If `nssm` is not on PATH, typical install locations are:

```text
C:\Program Files\NSSM\win64\nssm.exe
```

or under LocalAppData. You can always call it by full path, e.g.:

```powershell
& "C:\Program Files\NSSM\win64\nssm.exe" version
```

Manual fallback: download from [https://nssm.cc/download](https://nssm.cc/download) and unzip to `C:\Tools\nssm\`.

### 2.4 Database runtime (TimescaleDB) — important on EC2 Windows

Smartags needs **TimescaleDB** (Linux). On many EC2 Windows sizes (**including `t3.xlarge`**), **WSL2 / Docker Desktop Linux containers will not start** because nested virtualization is not available. Typical error:

```text
WSL2 is unable to start since virtualization is not enabled on this machine.
```

**Do not keep trying WSL/Docker Desktop on `t3` Windows** — it will not work.

#### Recommended for this deployment (cost-effective + works)

Keep **API on this Windows `t3.xlarge`**, and put **TimescaleDB on a second small Linux EC2**:

| Server | Type | Role |
|--------|------|------|
| Windows (current) | `t3.xlarge` | IIS + Node (NSSM) |
| Linux (new) | **`t3.medium`** Amazon Linux 2023 | TimescaleDB (Docker) only |

- Security Group on Linux DB: allow **TCP 5432 only from the Windows instance security group**.
- On Windows `.env`, set `DATABASE_URL` to the Linux private IP, e.g.  
  `postgresql://postgres:PASSWORD@10.x.x.x:5432/smartags?schema=public`
- Skip Part 2.4 Docker install on Windows; follow **Part 3B** on the Linux box instead.

#### Alternative (true single server with Docker)

Replace the Windows host with **one Amazon Linux `t3.xlarge`**, run Node under systemd + Timescale in Docker.  
That abandons IIS/NSSM-on-Windows (use nginx + systemd). Only choose this if you are OK leaving Windows.

#### Not recommended

- Bare-metal EC2 just to get nested virt — expensive.  
- Plain Windows Postgres without Timescale — breaks hypertable migrations unless you change the project.

### 2.5 Folders

```powershell
New-Item -ItemType Directory -Force -Path C:\Apps\Smartags\backend
New-Item -ItemType Directory -Force -Path C:\Apps\Smartags\logs
New-Item -ItemType Directory -Force -Path C:\Apps\Smartags\db
```

---

## Part 3 — TimescaleDB on the same server (Docker)

### 3.1 Create compose file

Create `C:\Apps\Smartags\db\docker-compose.yml`:

```yaml
version: "3.8"
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    container_name: smartags_timescaledb
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: "REPLACE_WITH_STRONG_PASSWORD"
      POSTGRES_DB: smartags
    ports:
      # Bind to loopback only — not public
      - "127.0.0.1:5432:5432"
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
    restart: always

volumes:
  timescaledb_data:
```

Replace `REPLACE_WITH_STRONG_PASSWORD` with a strong password (same one you put in `.env`).

### 3.2 Start the database

```powershell
cd C:\Apps\Smartags\db
docker compose up -d
docker compose ps
docker exec -it smartags_timescaledb psql -U postgres -d smartags -c "SELECT extversion FROM pg_extension WHERE extname='timescaledb';"
```

You should see a Timescale version. Leave this container running (`restart: always`).

### 3.3 Optional: start DB on boot via Task Scheduler / NSSM

Docker `restart: always` normally brings the container back when Docker starts. Ensure the **Docker service** is set to **Automatic** in `services.msc`.

---

## Part 4 — Deploy backend code

### 4.1 Get code onto the server

```powershell
cd C:\Apps\Smartags
git clone <YOUR_SMARTAGS_REPO_URL> repo
Copy-Item -Recurse -Force .\repo\backend\* .\backend\
```

Or copy the `backend` folder via RDP/S3 into `C:\Apps\Smartags\backend`.

### 4.2 Production `.env`

Create `C:\Apps\Smartags\backend\.env`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/smartags?schema=public
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS
CORS_ORIGINS=https://cms.brandeagles.com
TRUST_PROXY=true
ALLOW_PUBLIC_REGISTRATION=false
```

Notes:

- Host is **`127.0.0.1`** (DB on same machine).  
- `CORS_ORIGINS` must include Netlify CMS: `https://cms.brandeagles.com`.  
- During cutover you may temporarily add `,https://YOUR-SITE.netlify.app`.

### 4.3 Install, migrate, build

```powershell
cd C:\Apps\Smartags\backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

### 4.4 First-time admin seed

```powershell
cd C:\Apps\Smartags\backend
npm run seed-admin
```

Change the admin password after first CMS login.

### 4.5 Manual smoke test

```powershell
cd C:\Apps\Smartags\backend
node dist\index.js
```

Other window:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health/live
Invoke-WebRequest http://127.0.0.1:3000/health/ready
```

Expect **200**. Stop with `Ctrl+C`.

---

## Part 5 — NSSM Windows service (API)

### 5.1 Find Node

```powershell
where.exe node
```

Typical: `C:\Program Files\nodejs\node.exe`

### 5.2 Install service

```powershell
cd C:\Tools\nssm\win64
.\nssm.exe install SmartagsBackend
```

| Tab | Field | Value |
|-----|--------|--------|
| Application | Path | `C:\Program Files\nodejs\node.exe` |
| Application | Startup directory | `C:\Apps\Smartags\backend` |
| Application | Arguments | `dist\index.js` |
| Details | Display name | `Smartags Backend` |
| I/O | stdout | `C:\Apps\Smartags\logs\backend-stdout.log` |
| I/O | stderr | `C:\Apps\Smartags\logs\backend-stderr.log` |

Install service.

### 5.3 Start + auto-start

```powershell
cd C:\Tools\nssm\win64
.\nssm.exe set SmartagsBackend Start SERVICE_AUTO_START
.\nssm.exe start SmartagsBackend
.\nssm.exe status SmartagsBackend
```

### 5.4 Useful commands

```powershell
.\nssm.exe restart SmartagsBackend
.\nssm.exe stop SmartagsBackend
.\nssm.exe status SmartagsBackend
```

### 5.5 After each backend deploy

```powershell
cd C:\Apps\Smartags\backend
git pull
npm ci
npx prisma migrate deploy
npm run build
C:\Tools\nssm\win64\nssm.exe restart SmartagsBackend
```

---

## Part 6 — IIS reverse proxy + HTTPS

Keep Node on `127.0.0.1:3000`. Public traffic uses **443**.

### 6.1 Install IIS + ARR + URL Rewrite

1. Server Manager → **Web Server (IIS)**.  
2. Install **URL Rewrite** and **Application Request Routing (ARR)**.  
3. ARR → **Server Proxy Settings** → **Enable proxy**.

### 6.2 Site for `dooh.brandeagles.com`

1. Add site `SmartagsAPI`.  
2. Physical path: `C:\inetpub\smartags-api`.  
3. Binding: **https** / **443** / host `dooh.brandeagles.com` + certificate.

### 6.3 `web.config`

`C:\inetpub\smartags-api\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 6.4 Firewall

```powershell
New-NetFirewallRule -DisplayName "HTTPS 443 Smartags" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Do **not** expose `5432`. Prefer not exposing `3000` publicly once IIS works.

---

## Part 7 — DNS (API)

| Host | Type | Value |
|------|------|--------|
| `dooh` | **A** | EC2 Elastic IP |

Test:

```text
https://dooh.brandeagles.com/health/live
https://dooh.brandeagles.com/health/ready
https://dooh.brandeagles.com/api/health
```

Flip DNS from an old server only after these pass (or use a short maintenance window).

---

## Part 8 — Netlify frontend (`cms.brandeagles.com`)

Frontend **stays on Netlify**.

### 8.1 Environment variable

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://dooh.brandeagles.com` |

No trailing slash. Do **not** add `/api` (the app appends it).

### 8.2 Custom domain

Add `cms.brandeagles.com` in Netlify and create the DNS CNAME Netlify shows.

| Host | Type | Value |
|------|------|--------|
| `cms` | **CNAME** | Netlify target (e.g. `your-site.netlify.app`) |

### 8.3 Redeploy production

Trigger a new production deploy after changing `VITE_API_URL`.

### 8.4 Verify

1. Open `https://cms.brandeagles.com` → login.  
2. Network tab → calls go to `dooh.brandeagles.com`.  
3. No CORS errors. If CORS fails, fix `CORS_ORIGINS` and restart NSSM.

---

## Part 9 — TV players

API base for all devices:

```text
https://dooh.brandeagles.com/api
```

1. Install release APK via **USB stick**.  
2. Set Device Owner via **ADB** (once).  
3. Set API base → pair.  

See also: `docs/Smartags-TV-Player-Install-and-OTA-Guide.docx`.

---

## Part 10 — Storage & backups (same server)

### Uploads

- Local path: `C:\Apps\Smartags\backend\uploads`  
- Or configure **S3** in CMS System Settings (recommended later for media growth).

### Backups (required on all-in-one)

1. **EBS snapshots** of the instance volume on a schedule.  
2. Regular DB dump:

```powershell
docker exec smartags_timescaledb pg_dump -U postgres smartags > C:\Apps\Smartags\logs\smartags-backup.sql
```

3. Store dumps off-box (S3 bucket).  
4. Backup `keystore` / secrets separately (not only on this VM).

---

## Part 11 — Go-live checklist

- [ ] Instance is **`t3.xlarge`** with **~100 GB** disk  
- [ ] Timescale container healthy; port **5432 only on localhost**  
- [ ] NSSM `SmartagsBackend` = Running + Automatic  
- [ ] Reboot test: Docker + NSSM + IIS come back  
- [ ] `https://dooh.brandeagles.com/health/live` = 200  
- [ ] `https://dooh.brandeagles.com/health/ready` = 200  
- [ ] Netlify `VITE_API_URL` set; `cms.brandeagles.com` works  
- [ ] One TV pairs and plays  
- [ ] RDP not open to the world  
- [ ] Backup plan in place  

---

## Part 12 — Operations cheat sheet

```powershell
# API
C:\Tools\nssm\win64\nssm.exe restart SmartagsBackend
Get-Content C:\Apps\Smartags\logs\backend-stderr.log -Tail 100

# DB
cd C:\Apps\Smartags\db
docker compose ps
docker compose logs --tail 100 timescaledb
docker compose restart timescaledb
```

---

## Part 13 — Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/health/ready` fails | DB down or wrong `DATABASE_URL` | `docker compose ps`; check password/port |
| Service won't start | Bad `.env` / missing `dist` | Run `node dist\index.js` manually; read stderr log |
| CORS errors in CMS | Origin missing | Add `https://cms.brandeagles.com`, restart NSSM |
| 502 from IIS | Node down | `nssm status`; fix proxy to `:3000` |
| High memory | All-in-one pressure | Confirm `t3.xlarge`; restart runaway containers; move media to S3 |
| Hypertable migration errors | Not Timescale | Use `timescale/timescaledb` image, not plain Postgres |

---

## Quick reference

| Item | Value |
|------|--------|
| Instance | **`t3.xlarge`** (4 vCPU / 16 GB) — cost-effective for ~400 screens all-in-one |
| Disk | **100 GB gp3** |
| API | `https://dooh.brandeagles.com` |
| CMS (Netlify) | `https://cms.brandeagles.com` |
| TV API base | `https://dooh.brandeagles.com/api` |
| Backend path | `C:\Apps\Smartags\backend` |
| DB compose | `C:\Apps\Smartags\db\docker-compose.yml` |
| Windows service | `SmartagsBackend` (NSSM) |
| DB port | `127.0.0.1:5432` only |

---

## Related docs

- TV USB install + ADB Device Owner + OTA: `docs/Smartags-TV-Player-Install-and-OTA-Guide.docx`  
- Backend env template: `backend/.env.example`  
- Local Timescale compose reference: `docker-compose.yml`  
