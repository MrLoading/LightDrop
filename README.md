<p align="center">
  <img src="./public/icons/icon-192.png" width="120" height="120" alt="LightDrop Logo" style="border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.12);" />
</p>

<h1 align="center">⚡ LightDrop</h1>

<p align="center">
  <strong>现代化、极简、高隐私的局域网跨设备文件与文本共享服务</strong><br>
  无需公网中转 · 零第三方依赖 · 纯 TypeScript 全栈 · PWA 原生支持 · 毫秒级实时同步
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

## 📖 目录

- [💡 项目亮点](#-项目亮点)
- [🌟 核心功能特性](#-核心功能特性)
- [🚀 快速开始](#-快速开始)
  - [方式一：Docker Compose（推荐）](#方式一docker-compose推荐)
  - [方式二：全平台智能运维部署脚本 (`deploy.sh` / `deploy.bat` / `deploy.ps1`)](#方式二全平台智能运维部署脚本-deploysh--deploybat--deployps1)
  - [方式三：本地源码运行](#方式三本地源码运行)
- [📐 架构设计与技术栈](#-架构设计与技术栈)
- [📦 自动化运维体系](#-自动化运维体系)
- [⚙️ 配置与数据持久化](#️-配置与数据持久化)
- [❓ 常见问题 (FAQ)](#-常见问题-faq)
- [🤝 参与贡献](#-参与贡献)
- [📄 开源协议](#-开源协议)

---

## 💡 项目亮点
<img width="1180" height="880" alt="image" src="https://github.com/user-attachments/assets/8c153b6a-34e3-4153-a7d8-387d8e555661" />


在跨设备文件与文本互传场景中，现有工具往往存在诸多限制：

| 方案 | 痛点 | LightDrop 优势 |
| :--- | :--- | :--- |
| **微信 / QQ / IM** | 大文件限速、媒体严重压缩、隐私上传云端 | **跑满局域网千兆带宽**，零外网流量，数据 100% 留存本地 |
| **Apple AirDrop** | 仅支持苹果生态内部互传 | **全平台免装客户端**，任意设备有浏览器即开即用 |
| **网盘 / 云存储** | 需公网中转、下载限速、需注册登录 | **免注册免登录**，支持局域网扫码直连与 PWA 安装 |
| **传统 Samba / FTP** | 配置繁琐、移动端体验差、无文本互传 | **开箱即用**，现代 Web 界面，支持富文本与 Markdown 渲染 |

---

## 🌟 核心功能特性

### 1. 📝 文本互传与沉浸式 Markdown 阅读器
- **快捷查看与沉浸式阅读**：
  - 快速预览区与记录列表中均提供专属 **「查看」** 按钮，点击即可无缝调出全屏 Markdown 阅读器；
  - 支持 **渲染预览 (Preview)** 与 **纯文本源码 (Raw)** 自由切换，完美兼容 GitHub Flavored Markdown (GFM)、表格与代码语法高亮；
  - 顶部集成实时滚动阅读进度指示条，右下角提供平滑「回到顶部」悬浮按钮；
  - 支持一键导出/下载为标准 `.md` 文件，内置文件名合法化校验与自定义重命名。
- **智能标题与链接识别**：超长文本自动截取首行前 15 字符生成标题，URL 链接自动识别为可点击外链。

### 2. 📁 多文件与文件夹递归打包上传
- **批量拖拽极速互传**：支持多文件、图片拖拽上传，动态展示传输进度与元信息；
- **文件夹自动打包**：直接选择整个本地文件夹，服务端自动流式压缩打包为 ZIP 文件，完整保留多级层级结构；
- **图片缩略与原图预览**：图片自动生成高清缩略图，点击即可快速全屏预览。

### 3. 🔒 权限模式与安全解密体验
- **简明清晰的两种权限类型**：
  - **🌐 局域网**：免密公开，局域网内任意访客均可自由查看、复制与下载；
  - **🔒 密码**：受 PIN 访问密码保护，服务端 SHA-256 哈希脱敏，未输入正确密码前内容绝不泄露。
- **会话免密记忆**：当前页面成功输入密码解锁一次后，在当前会话内自动保持解密状态，再次查看或复制**无需重复输入密码**，锁图标自动转换为可用状态。

### 4. 🔗 独立提取页与免密直达链接
- **单记录专属提取页 (`/download/:id`)**：
  - 每条记录提供专属路由与独立二维码，扫码或访问直达，无需暴露整个主站记录仪表盘；
  - 针对文本内容呈现专属解锁阅读卡片，验证通过后无缝切入沉浸式阅读视图；
- **免密直达链接**：
  - 支持在分享链接中携带 `?pwd=xxx` 参数，接收方点击直接自动静默校验解锁，免除手动输入的繁琐；
  - 提取信息弹窗支持一键复制「文本/文件分享文案」及「快捷免密直链」。

### 5. ⚡ 毫秒级多端实时同步 (WebSocket)
- 局域网内任意设备执行发送、修改、删除或清空操作，其余所有在线设备**无需手动刷新**，秒级全自动同步；
- 底部状态栏实时呈现当前在线连接设备数与服务运行状态。

### 6. 🧽 经典海绵宝宝身份系统
- 内置 15 位经典海绵宝宝角色库（海绵宝宝 🧽、派大星 ⭐️、章鱼哥 🐙 等），初次访问自动分发角色与专属 Emoji；
- 浏览器 `localStorage` 本地持久化，免去注册登录门槛，同时为发送记录、操作审计提供清晰直观的身份标识；
- 顶部导航支持随时自定义改名或一键随机换角色。

### 7. 💾 纯文件原子存储引擎 (No-DB)
- **零外部数据库依赖**：采用 `records.json` 索引 + 物理文件目录隔离，通过文件系统原子重命名（Atomic Write）保障高并发写入与意外断电数据零损坏；
- **Web 端平滑热迁移**：系统设置中支持随时更改数据存储目录（如挂载的 NAS 路径），支持**一键热迁移**历史数据，服务重启自动读取引导配置；
- **自动清理策略**：支持配置 1天 / 3天 / 7天 / 30天 或永不清理过期记录。

### 8. 🛡️ 本机专属操作审计日志 (Audit Logs)
- 仅在运行服务的本机（Localhost）开放审计面板，局域网外部设备不可见，保障系统安全；
- 全链路追踪局域网各客户端的上传、下载、复制、删除、查看密码及访问分享单页等操作轨迹。

### 9. 📱 PWA 原生跨平台体验
- 完整支持 Web App Manifest 与 Service Worker；
- 手机端支持“添加到主屏幕”，电脑端 Chrome/Edge 支持“安装应用”，拥有独立的窗口与原生 App 级操作体验。

---

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

1. 创建 `docker-compose.yml`：
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

2. 启动服务：
```bash
docker compose up -d
```
打开浏览器访问 `http://<本机局域网IP>:8080` 即可开始使用。

---

### 方式二：全平台智能运维部署脚本 (`deploy.sh` / `deploy.bat` / `deploy.ps1`)

项目内置跨平台一键部署系统，**自动嗅探操作系统环境 (macOS / Linux / Windows)** 并动态匹配最优生命周期管理机制与开机自启动配置：

```bash
# === macOS / Linux / Windows (Git Bash) ===
# 交互式向导 (自动检测系统、适配模式与自启动选项)
./deploy.sh

# 自动选择系统最优原生模式并开启开机自启
./deploy.sh -m auto --autostart

# macOS 原生 LaunchAgent 守护服务 (免 root、崩溃自动恢复、开机自启)
./deploy.sh -m launchd --autostart

# Linux 原生 Systemd 系统服务
./deploy.sh -m systemd --autostart

# Docker 容器化部署 (全平台)
./deploy.sh -m docker -p 8080 --autostart
```

```powershell
# === Windows 原生 (PowerShell / CMD 双击) ===
# 双击 deploy.bat 或在 PowerShell 中执行:
.\deploy.ps1

# Windows 任务计划程序静默后台常驻 (推荐)
.\deploy.ps1 -Mode task -AutoStart $true

# Windows 开机自启文件夹模式 (免管理员权限)
.\deploy.ps1 -Mode startup -AutoStart $true
```


---

### 方式三：本地源码运行

**环境要求**：Node.js >= 18.0.0，pnpm >= 8.0.0

```bash
# 1. 安装依赖
pnpm install

# 2. 编译生产代码
pnpm build

# 3. 启动服务
pnpm start

# 或使用开发热重载模式
pnpm dev
```

---

## 📐 架构设计与技术栈

本项目采用 **TypeScript 全栈单仓规范**，前后端共享底层类型契约：

```text
LightDrop/
├── src/
│   ├── shared/                # 协议层：前后端共享 TypeScript 类型契约
│   ├── server/                # 服务端：Node.js + Express + WebSocket + 原子文件引擎
│   └── client/                # 客户端：React 18 + Vite + Tailwind CSS + PWA
├── scripts/                   # 自动化运维脚本库 (deploy, package, uninstall)
├── Dockerfile                 # 多阶段瘦身容器构建配置
└── docker-compose.yml         # 生产容器编排文件
```

---

## 📦 自动化运维体系

| 脚本 | 适用平台 | 生命周期支持 | 常用命令 |
| :--- | :--- | :--- | :--- |
| `deploy.sh` / `deploy.bat` / `deploy.ps1` | macOS / Linux / Windows | **macOS**: `launchd` (LaunchAgent)<br>**Linux**: `systemd`<br>**Windows**: `task` / `startup`<br>**全平台**: `docker` / `pm2` / `standalone` | `./deploy.sh -m auto --autostart`<br>`.\deploy.ps1 -Mode task` |
| `package.sh` | Linux / macOS / Git Bash | 多形态发行打包 (Docker TAR 离线镜像 / 原生免编独立发行包) | `./package.sh --all` |
| `uninstall.sh` / `uninstall.bat` / `uninstall.ps1` | macOS / Linux / Windows | 精准停用服务、注销自启动项，支持数据保留或全量清除 | `./uninstall.sh --keep-data`<br>`.\uninstall.ps1 -DeleteData` |


---

## ⚙️ 配置与数据持久化

### 存储目录结构
数据默认持久化在 `./data`（或用户自定义路径）：

```text
data/
├── records.json               # 共享记录元数据 (内存索引加速 + 原子重命名覆写)
├── settings.json              # 系统运行首选项 (单文件限额、自动清理周期)
├── audit.json                 # 局域网操作审计日志
└── files/<recordId>/          # 上传的物理文件存储目录
```

### 环境变量
可创建 `.env` 文件覆盖默认参数：

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `8080` | 服务监听端口 |
| `STORAGE_DIR` | `./data` | 实际物理存储目录（支持绝对路径或挂载的 NAS 路径） |
| `NODE_ENV` | `production` | 运行环境模式 (`production` / `development`) |

---

## ❓ 常见问题 (FAQ)

<details>
<summary><strong>Q: 手机扫码提示无法连接或超时？</strong></summary>

1. 确认手机与电脑连接在**同一 Wi-Fi** 下（处于同一局域网网段）；
2. 检查电脑系统防火墙是否已放行 `8080` 端口入站规则；
3. 若电脑启用了 VPN 或虚拟机虚拟网卡，点击顶部 IP 下拉框切换至真实的局域网 IPv4 地址。
</details>

<details>
<summary><strong>Q: 上传超大文件是否有限制？</strong></summary>

原生无大小限制。系统采用流式写入机制，内存占用极低。如遇限额提示，可在右上角「设置」中将「单文件大小限制」调整为更大或设置为“无限制”。
</details>

<details>
<summary><strong>Q: 更改存储路径到 NAS 挂载目录后，重启会丢失吗？</strong></summary>

不会。根目录下 `lightdrop.config.json` 会持久记录当前生效的物理路径，服务重启后自动从引导配置定位目标目录。
</details>

<details>
<summary><strong>Q: 如何快捷分享带密码的文本并免去输入步骤？</strong></summary>

在记录的操作栏点击“复制链接”，弹窗内提供「快捷免密链接」（内含安全校验参数），接收者直接点击该链接即可自动验证并展开阅读。
</details>

<details>
<summary><strong>Q: 为什么手机端看不到“操作审计”入口？</strong></summary>

安全设计机制。局域网操作审计包含所有客户端行为留痕，仅开放给运行服务的本机（Localhost / 127.0.0.1）管理员访问，防止数据外泄。
</details>

---

## 🤝 参与贡献

欢迎提交 Issue 与 Pull Request！

1. Fork 本项目并克隆到本地
2. 创建特性分支 (`git checkout -b feature/awesome-feature`)
3. 提交改动 (`git commit -m 'feat: add awesome feature'`)
4. 推送到远程分支 (`git push origin feature/awesome-feature`)
5. 发起 Pull Request

---

## 📄 开源协议

本项目采用 [MIT 许可证](LICENSE) 开源，允许免费商用与自由二次分发。
