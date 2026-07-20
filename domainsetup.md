# BidsRush Domain & Production Deployment Guide (`bidsrush.com`)

This guide provides step-by-step instructions to configure DNS on GoDaddy, set up Nginx reverse proxying on AWS EC2 (`98.90.22.230`), and enable SSL/TLS encryption with Let's Encrypt (Certbot).

---

## 📌 Architecture Overview

| Subdomain / Domain | Target Service & Local Port | AWS EC2 IP | Protocol |
| :--- | :--- | :--- | :--- |
| **`bidsrush.com`** | Next.js Landing & Admin Dashboard (`http://127.0.0.1:3000`) | `98.90.22.230` | HTTP / HTTPS |
| **`www.bidsrush.com`** | Next.js Landing & Admin Dashboard (`http://127.0.0.1:3000`) | `98.90.22.230` | HTTP / HTTPS |
| **`backend.bidsrush.com`** | Node.js Express API (`http://127.0.0.1:5000`) | `98.90.22.230` | HTTP / HTTPS |

---

## Step 1: GoDaddy DNS Configuration

Based on your GoDaddy Control Panel configuration, navigate to **Domain Portfolio** > **bidsrush.com** > **DNS**.

### 1.1 Update & Add DNS Records (**DNS Records Tab**)

1. **Root Domain `A` Record (`@`)**:
   - Locate the existing `A` record where Name is `@` (currently pointing to `76.223.126.88`).
   - Click **Edit** and update the **Data / Value** field to: `98.90.22.230`
   - Set **TTL**: `1/2 Hour` (or `1 Hour`).
   - Save changes.
   - *Note*: Delete any secondary default GoDaddy builder `A` records for `@` if present.

2. **Backend Subdomain `A` Record (`backend`)**:
   - Click **Add New Record**.
   - **Type**: `A`
   - **Name**: `backend`
   - **Value / Data**: `98.90.22.230`
   - **TTL**: `1/2 Hour` (or `1 Hour`).
   - Click **Save**.

3. **WWW Subdomain `CNAME` Record (`www`)**:
   - Verify the `CNAME` record for `www` exists:
     - **Type**: `CNAME`
     - **Name**: `www`
     - **Value**: `bidsrush.com.`
     - **TTL**: `1 Hour`

### 1.2 Verification of Nameservers & Forwarding

- **Nameservers Tab**: Ensure default GoDaddy nameservers (`ns21.domaincontrol.com` / `ns22.domaincontrol.com`) are selected.
- **Forwarding Tab**: Confirm domain and subdomain forwarding are **disabled (Not set up)** so Nginx handles all routing.

---

## Step 2: AWS EC2 Security Group Configuration

Ensure your AWS EC2 instance (`98.90.22.230`) allows inbound HTTP/HTTPS traffic.

In AWS EC2 Console > **Security Groups** > **Inbound Rules**:

| Port Range | Protocol | Source | Description |
| :--- | :--- | :--- | :--- |
| `22` | TCP | `0.0.0.0/0` (or Admin IP) | SSH Remote Access |
| `80` | TCP | `0.0.0.0/0` | HTTP (Web & Certbot Verification) |
| `443` | TCP | `0.0.0.0/0` | HTTPS (SSL Encrypted Web & API) |

---

## Step 3: Install Nginx & Certbot on EC2

SSH into your EC2 server and install Nginx along with Certbot:

```bash
# Connect to EC2
ssh -i /path/to/your-key.pem ubuntu@98.90.22.230

# Update packages and install Nginx & Certbot
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## Step 4: Configure Nginx Reverse Proxy (`/etc/nginx/conf.d/`)

Create dedicated configuration files for your domain and backend API under `/etc/nginx/conf.d/`.

### 4.1 Frontend & Landing Configuration: `/etc/nginx/conf.d/bidsrush.com.conf`

Create `/etc/nginx/conf.d/bidsrush.com.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name bidsrush.com www.bidsrush.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.2 Backend Express API Configuration: `/etc/nginx/conf.d/backend.bidsrush.com.conf`

Create `/etc/nginx/conf.d/backend.bidsrush.com.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name backend.bidsrush.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Step 5: Validate & Enable Nginx Configuration

Test the configuration files for syntax errors and restart Nginx:

```bash
# Test Nginx syntax
sudo nginx -t

# Reload/Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 6: SSL Certificate Setup with Let's Encrypt (Certbot)

Run Certbot to obtain SSL certificates and automatically update the Nginx configuration to enforce HTTPS redirection:

```bash
# Obtain certificates and configure HTTPS redirects automatically
sudo certbot --nginx -d bidsrush.com -d www.bidsrush.com -d backend.bidsrush.com
```

When prompted:
1. Enter your admin email address for renewal notices.
2. Agree to the Terms of Service.
3. Select **Redirect** (Option 2) to automatically force all HTTP traffic to HTTPS.

### 6.1 Test Auto-Renewal

Let's Encrypt certificates are valid for 90 days. Certbot configures an automatic systemd timer for renewals. Verify that auto-renewal works properly:

```bash
sudo certbot renew --dry-run
```

---

## Step 7: Verification Checklist

Test access to all public endpoints:

1. **Landing Page & Dashboard**:
   - `http://bidsrush.com` -> Auto-redirects to `https://bidsrush.com`
   - `https://www.bidsrush.com` -> Renders Dashboard (Port `3000`)
2. **Backend API**:
   - `http://backend.bidsrush.com` -> Auto-redirects to `https://backend.bidsrush.com`
   - `https://backend.bidsrush.com/api/v1/health` -> Returns `200 OK` status from Express (Port `5000`)
