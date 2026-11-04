# Synology Container Manager (Docker) Deployment Guide

Deployment target: **Synology NAS (Container Manager)** on the company LAN (`192.168.5.x`).

## Architecture
A single unified production container (`oracle-reporting-web`) built on `node:22-alpine`:
- Serves the compiled React SPA (`client/dist`) and Express API (`/api/*`) from the **same origin** on port **`3001`** (no CORS issues across LAN IPs).
- Connects directly over the LAN to Microsoft SQL Server (`192.168.5.201:1433` / `OracleDB`) and the FTP server (`ftp.cfi.com.ph`) for deposit slip attachments.

---

## Step-by-Step Deployment on Synology NAS

### 1. Copy Project to Synology Shared Folder
1. Open **File Station** on your Synology DSM.
2. Inside `/docker`, create a folder named **`oracle-reporting-tool-web`** (full path: `/volume1/docker/oracle-reporting-tool-web`).
3. Upload the project files into `/docker/oracle-reporting-tool-web` (**excluding** `node_modules`, `client/dist`, and `server/dist` — Docker will build them cleanly inside the container).
4. Make sure your `.env` file is present in `/docker/oracle-reporting-tool-web/.env`:
   ```env
   API_HOST=0.0.0.0
   API_PORT=3001
   APP_PORT=3001
   CLIENT_ORIGIN=*
   NODE_ENV=production

   JWT_SECRET=oracle_reporting_secret_key_change_in_production_2026

   SQL_SERVER_HOST=192.168.5.201
   SQL_SERVER_PORT=1433
   SQL_SERVER_DATABASE=OracleDB
   SQL_SERVER_USER=oracle_web_reporting
   SQL_SERVER_PASSWORD=Cfi05122011
   SQL_SERVER_ENCRYPT=true
   SQL_SERVER_TRUST_SERVER_CERTIFICATE=true

   FTP_HOST=ftp.cfi.com.ph
   FTP_USER=cfiftp@cfi.com.ph
   FTP_PASSWORD="9%%0ngTq;vYB@-_g"
   FTP_SECURE=false
   ```

### 2. Deploy via Synology Container Manager (GUI)
1. Open **Container Manager** in Synology DSM.
2. Go to **Project** in the left sidebar and click **Create**.
3. Fill in:
   - **Project name:** `oracle-reporting-tool-web`
   - **Path:** Select `/docker/oracle-reporting-tool-web`
   - **Source:** Choose **Use existing docker-compose.yml**
4. Click **Next** → **Done** and let Container Manager build and start the container.

*(Alternative via SSH — One-Command Update)*:
```bash
cd /volume1/docker/oracle-reporting-tool-web
sudo sh deploy/update.sh
```

The `update.sh` script automatically:
1. Pulls the latest commits from `main` (falling back to a Docker-based git runner if git is not installed on DSM).
2. Builds the updated client and server bundles inside the Docker container.
3. Automatically prunes old/dangling image layers so your Synology storage never fills up.
4. Performs a health check on `http://localhost:3001/api/health` and reports status.

### 3. Access on the LAN
Open any browser on the company network and visit:
- **`http://<SYNOLOGY_NAS_IP>:3001`**
- Health check endpoint: **`http://<SYNOLOGY_NAS_IP>:3001/api/health`**

---

## 4. Enabling HTTPS / SSL on Synology DSM (Reverse Proxy)

Synology DSM includes a built-in Nginx **Reverse Proxy** and **SSL Certificate Manager** that terminates HTTPS and forwards traffic to `localhost:3001` without modifying the container.

### Option A: Using a Domain / DDNS (`*.synology.me` or Company Domain) with Let's Encrypt
1. **Create or Assign an SSL Certificate:**
   - Open **Control Panel** → **Security** → **Certificate** → **Add**.
   - Select **Add a new certificate** → **Get a certificate from Let's Encrypt** (or **Import certificate** if you have a company wildcard/internal `.crt` + `.key`).
   - Enter your domain (e.g., `reporting.yourdomain.com` or `yourname.synology.me`).
2. **Create the HTTPS Reverse Proxy Rule:**
   - Open **Control Panel** → **Login Portal** → **Advanced** tab → click **Reverse Proxy**.
   - Click **Create** and configure:
     - **Reverse Proxy Name:** `Oracle Reporting Tool HTTPS`
     - **Source (HTTPS):**
       - **Protocol:** `HTTPS`
       - **Hostname:** `reporting.yourdomain.com` *(or `*` if accessing via IP + port like `https://192.168.5.x:3443`)*
       - **Port:** `443` *(or a custom HTTPS port like `3443`)*
       - Check **Enable HSTS** (optional)
     - **Destination (Docker Container):**
       - **Protocol:** `HTTP`
       - **Hostname:** `localhost` (or `127.0.0.1`)
       - **Port:** `3001`
   - Click **Save**.
3. **Bind the Certificate to the Reverse Proxy:**
   - Go to **Control Panel** → **Security** → **Certificate**.
   - Click **Settings** (top button).
   - Find your Reverse Proxy entry (`reporting.yourdomain.com` or `:3443`) and select your SSL certificate from the dropdown → click **OK**.

