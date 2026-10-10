<p align="center">
  <img src="./public/icons/icon-192x192.png" width="120" height="120" alt="LightDrop Logo" style="border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.12);" />
</p>

<h1 align="center">⚡ LightDrop</h1>

<p align="center">
  <strong>Modern, Minimalist, Privacy-First Local Network (LAN) File & Text Sharing Service</strong><br>
  Zero Cloud Relays · No Third-Party Dependencies · 100% Full-Stack TypeScript · Native PWA Ready · Sub-Second WebSocket Sync
</p>

<p align="center">
  <a href="./README.md">简体中文</a> | <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-TypeScript_100%25-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Frontend-React_18_%2B_Vite_%2B_TailwindCSS-06b6d4?style=flat-square&logo=react&logoColor=white" alt="Frontend" />
  <img src="https://img.shields.io/badge/Backend-Node.js_%2B_Express_%2B_WS-339933?style=flat-square&logo=node.js&logoColor=white" alt="Backend" />
  <img src="https://img.shields.io/badge/PWA-Supported-orange?style=flat-square&logo=pwa&logoColor=white" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 Table of Contents

- [💡 Why LightDrop?](#-why-lightdrop)
- [🌟 Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
  - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Method 2: Automated Deployment Script (`deploy.sh`)](#method-2-automated-deployment-script-deploysh)
  - [Method 3: Build & Run from Source](#method-3-build--run-from-source)
- [📐 Architecture & Tech Stack](#-architecture--tech-stack)
- [📦 DevOps Tooling](#-devops-tooling)
- [⚙️ Configuration & Data Persistence](#️-configuration--data-persistence)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 💡 Why LightDrop?
<img width="1179" height="872" alt="image" src="https://github.com/user-attachments/assets/dc5ee901-535b-4c2f-b39a-4027de76c7cc" />

Transferring files and text snippets between diverse devices on a local network has traditionally been frustrating:

| Solution | Major Pain Points | LightDrop Advantages |
| :--- | :--- | :--- |
| **Instant Messengers (Slack, WeChat, Telegram)** | File size quotas, media compression, data uploaded to public clouds | **Maxes out Gigabit LAN bandwidth**, 100% data stays strictly on your local device |
| **Apple AirDrop** | Restricted strictly to Apple devices (iOS/macOS) | **Zero client installation**, works on any device with a modern browser |
| **Cloud Storage (Google Drive, Dropbox)** | Wastes external bandwidth, rate limits, mandatory registration | **No login or sign-up**, scan QR code to connect instantly, native PWA support |
| **Samba / FTP / NAS** | Complex configurations, poor mobile browser UX, no text sharing | **Zero-config setup**, clean modern UI, Markdown & code syntax rendering |

---

## 🌟 Key Features

### 1. 📝 Text Transfer & Immersive Markdown Reader
- **Quick Preview & Immersive Reading**:
  - Dedicated **"View"** buttons in both the quick preview card and table records trigger a full-screen, distraction-free Markdown reader;
  - Switch freely between **Rendered Preview** and **Raw Source**, fully supporting GitHub Flavored Markdown (GFM), tables, and syntax highlighting;
  - Real-time scroll progress bar at the top, accompanied by a smooth "Back to Top" floating button;
  - Export and download text directly as a standard `.md` file with built-in filename sanitization and custom rename modal.
- **Smart Excerpts & Hyperlinks**: Automatically excerpts the first 15 characters of long texts for clean table lists; automatically parses and renders clickable web URLs.

### 2. 📁 Multi-File & Recursive Folder Zip Packaging
- **High-Speed Drag & Drop**: Drag files and photos onto the dashboard with real-time transfer progress feedback;
- **Recursive Folder Auto-Packaging**: Select an entire directory from your disk; the server streams and compresses it into a standard ZIP archive while preserving your full directory tree;
- **Image Previews**: Clean thumbnails generated on the fly; click to view in full resolution.

### 3. 🔒 Streamlined Permission Model & Safe Decryption
- **Two Crystal-Clear Access Modes**:
  - **🌐 LAN**: Open and free to all local network devices without passwords;
  - **🔒 Password**: Protected with PIN encryption. Handled securely via server-side SHA-256 hashing—content is completely masked until validated.
- **Session Decryption Memory**: Once unlocked on a device, the content stays decrypted in the current browser session. Subsequent viewing and copying **require zero repeated password prompts**, and lock icons seamlessly turn into ready actions.

### 4. 🔗 Standalone Extraction Pages & Direct Links
- **Isolated Extraction Routes (`/download/:id`)**:
  - Share single records via dedicated URLs and QR codes without exposing the global dashboard records;
  - Text records open in a specialized card and transition into the reader once unlocked;
- **Direct Password-Free Links**:
  - Supports appending `?pwd=xxx` parameters to URLs for seamless, silent unlocking on recipient devices;
  - Share modal offers one-click copying for formatted descriptions and direct password-free links.

### 5. ⚡ Sub-Second WebSocket Synchronization
- Uploads, updates, deletions, and batch wipes broadcast to all connected devices in real time—**no manual browser refreshing required**;
- Live count of active online devices displayed in the footer bar.

### 6. 🧽 Classic SpongeBob Identity System
- Includes 15 classic SpongeBob characters (SpongeBob 🧽, Patrick ⭐️, Squidward 🐙, etc.), randomly assigned on initial visit;
- Persisted locally in `localStorage`—no registration needed, while giving each sender a distinct name and emoji badge across the network;
- Click the top navigation capsule to customize your display name or re-roll characters anytime.

### 7. 💾 No-DB Pure File Atomic Storage Engine
- **Zero Database Dependencies**: Uses `records.json` metadata + isolated directory storage. File-system atomic renames (`fs.renameSync`) ensure zero data corruption during power loss or high concurrency;
- **Live Path Migration via Web UI**: Change your storage path (e.g., to a mounted NAS share) on the fly without stopping the service, with **one-click automated migration**;
- **Automated Retention Schedules**: Configure retention periods (1 day / 3 days / 7 days / 30 days / Never) for hands-off automatic cleanup.

### 8. 🛡️ Host-Exclusive Audit Logs
- The operation audit log is strictly restricted to the local host machine (`localhost` / `127.0.0.1`) and completely hidden from other LAN devices;
- Comprehensive audit trails tracking client IPs, usernames, upload/download events, copy actions, and PIN verification.

### 9. 📱 Progressive Web App (PWA) Experience
- Fully compliant with Web App Manifest and Workbox Service Worker specifications;
- Supports "Add to Home Screen" on mobile and "Install App" on desktop Chrome/Edge for standalone window execution.

---

## 🚀 Quick Start

### Method 1: Docker Compose (Recommended)

1. Create a `docker-compose.yml`:
```yaml
version: '3.8'

services:
  lightdrop:
    image: node:22-alpine
    container_name: lightdrop
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./:/app
      - ./data:/app/data
    ports:
      - "8080:8080"
    command: sh -c "npm install -g pnpm && pnpm install && pnpm build && pnpm start"
```

2. Start the service:
```bash
docker compose up -d
```
Visit `http://<YOUR_LAN_IP>:8080` in your browser.

---

### Method 2: Automated Deployment Script (`deploy.sh`)

LightDrop includes a battle-tested cross-platform management script:

```bash
# Grant execution permissions
chmod +x deploy.sh package.sh uninstall.sh scripts/*.sh

# Run interactive setup wizard
./deploy.sh

# Or start as a standalone background daemon
./deploy.sh -m standalone -p 8080
```

---

### Method 3: Build & Run from Source

**Requirements**: Node.js >= 18.0.0, pnpm >= 8.0.0

```bash
# 1. Install dependencies
pnpm install

# 2. Build production assets
pnpm build

# 3. Start server
pnpm start

# Or start with hot-reload dev mode
pnpm dev
```

---

## 📐 Architecture & Tech Stack

LightDrop is built as a **full-stack TypeScript monorepo**, sharing data types between frontend and backend:

```text
LightDrop/
├── src/
│   ├── shared/                # Protocol layer: Shared TypeScript interfaces & types
│   ├── server/                # Backend: Node.js + Express + WebSocket + Atomic storage
│   └── client/                # Frontend: React 18 + Vite + Tailwind CSS + PWA
├── scripts/                   # DevOps script library (deploy, package, uninstall)
├── Dockerfile                 # Multi-stage production container build
└── docker-compose.yml         # Container orchestration manifest
```

---

## 📦 DevOps Tooling

| Script | Purpose | Example Command |
| :--- | :--- | :--- |
| `deploy.sh` | Deployment management (Docker, Standalone, PM2, Systemd) | `./deploy.sh -m standalone -p 8080` |
| `package.sh` | Multi-target packaging (Offline Docker TAR / Standalone binary) | `./package.sh --all` |
| `uninstall.sh` | Clean uninstallation (Safe data retention or total wipe) | `./uninstall.sh --keep-data` |

---

## ⚙️ Configuration & Data Persistence

### Directory Layout
Data persists in `./data` (or your custom directory) by default:

```text
data/
├── records.json               # Record metadata (in-memory indexed + atomic rename writes)
├── settings.json              # System configuration (quotas, retention rules)
├── audit.json                 # Local network audit trails
└── files/<recordId>/          # Uploaded physical files
```

### Environment Variables
Optionally configure via a `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Server listening port |
| `STORAGE_DIR` | `./data` | Physical storage directory (supports absolute or NAS paths) |
| `NODE_ENV` | `production` | Execution environment mode (`production` / `development`) |

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Q: Mobile device cannot open the page after scanning the QR code?</strong></summary>

1. Ensure the mobile device is on the **same Wi-Fi / subnet** as the host computer;
2. Verify that host firewall rules allow inbound traffic on port `8080`;
3. If virtual adapters (VPN, VM bridges) are active, switch to your physical Wi-Fi IPv4 address using the top IP dropdown.
</details>

<details>
<summary><strong>Q: Are there limits on uploading large files?</strong></summary>

No arbitrary limits out of the box. Streaming transfers ensure minimal memory footprints. If quota alerts appear, adjust or set "No Limit" in the top-right Settings modal.
</details>

<details>
<summary><strong>Q: Will NAS storage path settings be lost after restarting?</strong></summary>

No. `lightdrop.config.json` in the root folder automatically records the active storage directory and re-applies it during bootstrap.
</details>

<details>
<summary><strong>Q: How can I share a password-protected text without making recipients type the PIN?</strong></summary>

Click "Copy Link" on the record. The modal generates a **"Direct Password-Free Link"** containing secure parameters. Opening this link automatically unlocks the reader on the target device.
</details>

<details>
<summary><strong>Q: Why is the Audit Log inaccessible on mobile devices?</strong></summary>

By design. For security and privacy, the full audit trail is strictly restricted to the local host machine (`localhost` / `127.0.0.1`).
</details>

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork this repository
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to your branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Free for personal and commercial use.
