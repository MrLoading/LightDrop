#!/usr/bin/env bash
# ==============================================================================
# LightDrop 构建并部署脚本 (Build & Deploy Script)
# 支持：
# 1. 指定部署方式：docker (容器化) | systemd (系统服务) | pm2 (进程管理) | standalone (独立后台进程)
# 2. 工作路径：默认 /var/lib/lightdrop，不存在则自动创建
# 3. 安装语言：默认中文，支持选择英文
# 4. 在 <工作路径>/runinfo 目录下创建 .json 文件持久化记录运行信息
# 5. 优雅终端交互、步骤进度输出及最终状态看板
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 导入通用库
if [ -f "${SCRIPT_DIR}/common.sh" ]; then
  # shellcheck source=scripts/common.sh
  source "${SCRIPT_DIR}/common.sh"
fi

# ----------------- 默认配置 -----------------
DEFAULT_WORK_DIR="/var/lib/lightdrop"
WORK_DIR="${DEFAULT_WORK_DIR}"
DEPLOY_MODE="" # 未指定时若交互模式则引导选择，非交互则默认 docker (或 fallback standalone)
LANG_OPT="zh"  # 默认中文
PORT=8080
DATA_DIR=""
IMAGE_TAR=""
SKIP_BUILD=false
AUTO_YES=false
CONTAINER_NAME="lightdrop"
IMAGE_NAME="lightdrop:latest"
SERVICE_NAME="lightdrop.service"
PM2_NAME="lightdrop"
VERSION="1.0.0"

if [ -f "${REPO_ROOT}/package.json" ]; then
  PKG_VER=$(json_read "${REPO_ROOT}/package.json" "version")
  [ -n "$PKG_VER" ] && VERSION="$PKG_VER"
fi

# ----------------- 帮助文档 -----------------
show_help() {
  if [ "$LANG_OPT" = "en" ]; then
    cat <<EOF
LightDrop Build & Deploy Tool - v${VERSION}

Usage:
  ./deploy.sh [OPTIONS]

Options:
  -m, --mode <MODE>       Deployment mode:
                            • docker      - Containerized deployment (Recommended)
                            • systemd     - Linux Systemd system service
                            • pm2         - PM2 process manager
                            • standalone  - Standalone background daemon (Zero external dependencies)
  -w, --workdir <DIR>     Working directory path (Default: ${DEFAULT_WORK_DIR})
  -l, --lang <zh|en>      Installation language: zh (Chinese, Default) | en (English)
  -p, --port <PORT>       Service HTTP listening port (Default: 8080)
  -d, --data-dir <DIR>    Persistent data directory (Default: <WORKDIR>/data)
  --image-tar <FILE>      Import existing Docker image .tar directly without rebuilding
  --skip-build            Skip frontend/backend compilation step
  -y, --yes               Non-interactive mode, apply defaults or arguments directly
  -h, --help              Show this help information

Examples:
  ./deploy.sh                                    # Interactive deployment wizard
  ./deploy.sh -m docker -w /var/lib/lightdrop    # Deploy via Docker to /var/lib/lightdrop
  ./deploy.sh -m standalone -p 9000 -l en        # Deploy standalone process on port 9000 in English
  ./deploy.sh --mode docker --image-tar pkg.tar  # Deploy directly from prebuilt Docker tar
EOF
  else
    cat <<EOF
LightDrop 构建并部署工具 - v${VERSION}

用法:
  ./deploy.sh [选项]

选项:
  -m, --mode <模式>       指定部署方式:
                            • docker      - Docker 容器化部署 (推荐)
                            • systemd     - Linux Systemd 系统服务 (适用于生产服务器)
                            • pm2         - PM2 进程守护管理
                            • standalone  - 独立后台常驻进程 (零额外组件依赖，极速运行)
  -w, --workdir <路径>    指定工作路径 (默认: ${DEFAULT_WORK_DIR}，不存在则自动创建)
  -l, --lang <zh|en>      选择安装语言: zh (简体中文, 默认) | en (English)
  -p, --port <端口>       服务监听端口 (默认: 8080)
  -d, --data-dir <路径>   数据持久化目录 (默认: <工作路径>/data)
  --image-tar <文件>      使用预先导出的 Docker 镜像 .tar 文件直接导入部署
  --skip-build            跳过源码构建步骤
  -y, --yes               非交互模式，全部使用默认参数或命令行传入参数
  -h, --help              显示此帮助信息

示例:
  ./deploy.sh                                    # 启动交互式引导部署
  ./deploy.sh -m docker -w /var/lib/lightdrop    # 容器化部署至默认工作目录
  ./deploy.sh -m standalone -p 9000              # 以原生后台服务模式部署在 9000 端口
  ./deploy.sh -m docker --image-tar image.tar    # 从预打包的镜像 tar 文件直接导入并启动
EOF
  fi
  exit 0
}

# ----------------- 解析参数 -----------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--mode)
      DEPLOY_MODE="$2"
      shift 2
      ;;
    -w|--workdir)
      WORK_DIR="$2"
      shift 2
      ;;
    -l|--lang)
      LANG_OPT="$2"
      shift 2
      ;;
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -d|--data-dir)
      DATA_DIR="$2"
      shift 2
      ;;
    --image-tar)
      IMAGE_TAR="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    -y|--yes)
      AUTO_YES=true
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      log_warn "未知参数: $1"
      show_help
      ;;
  esac
done

# ----------------- 交互式配置引导 (Wizard) -----------------
is_interactive() {
  [ -t 0 ] && [ "$AUTO_YES" = false ]
}

if is_interactive; then
  # 1. 语言选择 (默认中文)
  echo ""
  echo -e "${CYAN}${BOLD}╔════════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║  🌐 请选择安装语言 / Select Installation Language             ║${RESET}"
  echo -e "${CYAN}${BOLD}╠════════════════════════════════════════════════════════════════╣${RESET}"
  echo -e "║  ${BOLD}[1]${RESET} 简体中文 (默认 / Default)                                  ║"
  echo -e "║  ${BOLD}[2]${RESET} English                                                    ║"
  echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════════╝${RESET}"
  read -r -p "请输入选项 [1-2] (默认: 1): " lang_choice
  case "$lang_choice" in
    2|[eE][nN]*)
      LANG_OPT="en"
      ;;
    *)
      LANG_OPT="zh"
      ;;
  esac

  # 2. 部署方式选择
  if [ -z "$DEPLOY_MODE" ]; then
    echo ""
    if [ "$LANG_OPT" = "en" ]; then
      echo -e "${CYAN}${BOLD}╔════════════════════════════════════════════════════════════════╗${RESET}"
      echo -e "${CYAN}${BOLD}║  🚀 Select Deployment Mode                                     ║${RESET}"
      echo -e "${CYAN}${BOLD}╠════════════════════════════════════════════════════════════════╣${RESET}"
      echo -e "║  ${BOLD}[1]${RESET} docker     - Docker Container (Recommended)                 ║"
      echo -e "║  ${BOLD}[2]${RESET} systemd    - Linux Systemd Service                          ║"
      echo -e "║  ${BOLD}[3]${RESET} pm2        - PM2 Process Manager                            ║"
      echo -e "║  ${BOLD}[4]${RESET} standalone - Standalone Background Process                  ║"
      echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════════╝${RESET}"
      read -r -p "Enter choice [1-4] (Default: 1): " mode_choice
    else
      echo -e "${CYAN}${BOLD}╔════════════════════════════════════════════════════════════════╗${RESET}"
      echo -e "${CYAN}${BOLD}║  🚀 请选择部署方式                                             ║${RESET}"
      echo -e "${CYAN}${BOLD}╠════════════════════════════════════════════════════════════════╣${RESET}"
      echo -e "║  ${BOLD}[1]${RESET} docker     - Docker 容器化部署 (推荐)                       ║"
      echo -e "║  ${BOLD}[2]${RESET} systemd    - Linux Systemd 系统服务                         ║"
      echo -e "║  ${BOLD}[3]${RESET} pm2        - PM2 进程守护管理                               ║"
      echo -e "║  ${BOLD}[4]${RESET} standalone - 原生独立后台进程 (免额外组件)                  ║"
      echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════════╝${RESET}"
      read -r -p "请输入选项 [1-4] (默认: 1): " mode_choice
    fi

    case "$mode_choice" in
      2|systemd)
        DEPLOY_MODE="systemd"
        ;;
      3|pm2)
        DEPLOY_MODE="pm2"
        ;;
      4|standalone)
        DEPLOY_MODE="standalone"
        ;;
      *)
        DEPLOY_MODE="docker"
        ;;
    esac
  fi

  # 3. 工作路径确认 (默认 /var/lib/lightdrop)
  if [ "$WORK_DIR" = "$DEFAULT_WORK_DIR" ]; then
    if [ "$LANG_OPT" = "en" ]; then
      read -r -p "Working directory [Default: ${DEFAULT_WORK_DIR}]: " input_workdir
    else
      read -r -p "工作路径 [默认: ${DEFAULT_WORK_DIR}]: " input_workdir
    fi
    if [ -n "$input_workdir" ]; then
      WORK_DIR="$input_workdir"
    fi
  fi

  # 4. 端口设置
  if [ "$PORT" = "8080" ]; then
    if [ "$LANG_OPT" = "en" ]; then
      read -r -p "Listening Port [Default: 8080]: " input_port
    else
      read -r -p "运行端口 [默认: 8080]: " input_port
    fi
    if [ -n "$input_port" ]; then
      PORT="$input_port"
    fi
  fi
fi

# 非交互且未指定模式时的智能默认判定
if [ -z "$DEPLOY_MODE" ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    DEPLOY_MODE="docker"
  else
    DEPLOY_MODE="standalone"
  fi
fi

# 规范化数据路径
if [ -z "$DATA_DIR" ]; then
  DATA_DIR="${WORK_DIR}/data"
fi

RUNINFO_DIR="${WORK_DIR}/runinfo"
RUNINFO_FILE="${RUNINFO_DIR}/lightdrop-runinfo.json"
APP_DIR="${WORK_DIR}/app"
LOG_DIR="${WORK_DIR}/logs"
PID_FILE="${RUNINFO_DIR}/lightdrop.pid"

# ----------------- 打印部署横幅 -----------------
echo ""
if [ "$LANG_OPT" = "en" ]; then
  print_banner "LightDrop Deployment System v${VERSION}" "Mode: ${DEPLOY_MODE} | Target: ${WORK_DIR}"
else
  print_banner "LightDrop 自动化构建部署引擎 v${VERSION}" "部署模式: ${DEPLOY_MODE} | 工作路径: ${WORK_DIR}"
fi

# ----------------- 步骤 1: 检查环境并初始化工作目录 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "1/5" "Initializing working directory and permissions..."
else
  log_step "1/5" "检查运行环境并初始化工作路径..."
fi

log_info "工作路径: ${WORK_DIR}"
log_info "数据目录: ${DATA_DIR}"
log_info "运行信息目录: ${RUNINFO_DIR}"

if ! ensure_writable_dir "${WORK_DIR}"; then
  log_error "无法写入工作路径: ${WORK_DIR}。请使用 sudo 或通过 -w 指定可写目录"
  exit 1
fi

mkdir -p "${DATA_DIR}/files"
mkdir -p "${RUNINFO_DIR}"
mkdir -p "${LOG_DIR}"

log_success "工作路径结构就绪"

# ----------------- 步骤 2: 源码构建 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "2/5" "Building application source..."
else
  log_step "2/5" "编译构建前端与后端应用程序..."
fi

if [ -n "$IMAGE_TAR" ] && [ "$DEPLOY_MODE" = "docker" ]; then
  log_info "已指定镜像归档包 ${IMAGE_TAR}，跳过本地源码编译"
elif [ "$SKIP_BUILD" = true ] && [ -d "${REPO_ROOT}/dist/client" ] && [ -d "${REPO_ROOT}/dist/server" ]; then
  log_info "已检测到已有构建产物，跳过编译步骤 (--skip-build)"
else
  cd "${REPO_ROOT}"
  rm -f "${REPO_ROOT}/tsconfig.server.tsbuildinfo" "${REPO_ROOT}/tsconfig.client.tsbuildinfo"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build
  elif command -v npm >/dev/null 2>&1; then
    npm run build
  else
    log_error "未检测到 Node.js 包管理器 (pnpm/npm)"
    exit 1
  fi
  log_success "应用全量编译完成"
fi

# ----------------- 步骤 3: 准备运行环境与应用产物 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "3/5" "Configuring deployment assets and runtime parameters..."
else
  log_step "3/5" "装配部署资源与运行引导配置..."
fi

APP_PID=""

# 非 Docker 模式下，将应用产物同步至工作路径的 app 目录
if [ "$DEPLOY_MODE" != "docker" ]; then
  mkdir -p "${APP_DIR}"
  log_info "同步应用资源到工作目录: ${APP_DIR}..."
  cp -r "${REPO_ROOT}/dist" "${APP_DIR}/"
  cp -r "${REPO_ROOT}/public" "${APP_DIR}/"
  cp "${REPO_ROOT}/package.json" "${APP_DIR}/"
  cp "${REPO_ROOT}/ecosystem.config.cjs" "${APP_DIR}/"
  if [ -f "${REPO_ROOT}/pnpm-lock.yaml" ]; then
    cp "${REPO_ROOT}/pnpm-lock.yaml" "${APP_DIR}/"
  fi

  # 写入工作目录专属的引导配置文件 lightdrop.config.json
  cat <<BOOTSTRAP_JSON > "${APP_DIR}/lightdrop.config.json"
{
  "storageDir": "${DATA_DIR}",
  "port": ${PORT}
}
BOOTSTRAP_JSON

  # 拷贝 node_modules 保证独立可运行
  if [ -d "${REPO_ROOT}/node_modules" ] && [ ! -d "${APP_DIR}/node_modules" ]; then
    log_info "复制 node_modules 运行时依赖至部署目录..."
    cp -R "${REPO_ROOT}/node_modules" "${APP_DIR}/" 2>/dev/null || true
  fi
fi

# ----------------- 步骤 4: 执行具体模式部署 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "4/5" "Starting LightDrop service via [${DEPLOY_MODE}]..."
else
  log_step "4/5" "以 [${DEPLOY_MODE}] 方式启动 LightDrop 传输服务..."
fi

case "$DEPLOY_MODE" in
  docker)
    if ! command -v docker >/dev/null 2>&1; then
      log_error "系统未安装 docker 工具，无法使用容器化部署模式"
      exit 1
    fi
    if ! docker info >/dev/null 2>&1; then
      log_error "Docker 守护进程未启动，请先启动 Docker 服务"
      exit 1
    fi

    # 若指定了 tar 文件则导入
    if [ -n "$IMAGE_TAR" ] && [ -f "$IMAGE_TAR" ]; then
      log_info "正在从本地 TAR 包载入 Docker 镜像: ${IMAGE_TAR}..."
      docker load -i "${IMAGE_TAR}"
    else
      # 检查镜像是否存在，不存在则构建
      if ! docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
        log_info "本地未检索到镜像 ${IMAGE_NAME}，正在执行构建..."
        docker build -t "${IMAGE_NAME}" -f "${REPO_ROOT}/Dockerfile" "${REPO_ROOT}"
      fi
    fi

    # 清理已有的同名容器
    if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
      log_info "发现已有容器 ${CONTAINER_NAME}，正在停止并清理..."
      docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    fi

    # 启动新容器
    log_info "正在启动 Docker 容器: ${CONTAINER_NAME} (端口: ${PORT})..."
    docker run -d \
      --name "${CONTAINER_NAME}" \
      --restart unless-stopped \
      -p "${PORT}:8080" \
      -v "${DATA_DIR}:/app/data" \
      -e PORT=8080 \
      -e NODE_ENV=production \
      "${IMAGE_NAME}" >/dev/null

    # 验证运行状态
    sleep 2
    if docker ps --filter "name=^${CONTAINER_NAME}\$" --format '{{.Status}}' | grep -qi "Up"; then
      log_success "Docker 容器启动成功并正在稳定运行"
    else
      log_error "Docker 容器启动后状态异常，日志如下:"
      docker logs --tail 20 "${CONTAINER_NAME}" || true
      exit 1
    fi
    ;;

  systemd)
    if ! command -v systemctl >/dev/null 2>&1; then
      log_error "当前操作系统不支持 systemctl (非 Linux 或无 systemd 守护进程)"
      log_warn "建议改用 standalone 或 pm2 模式: ./deploy.sh --mode standalone"
      exit 1
    fi

    NODE_BIN="$(command -v node)"
    SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"

    log_info "生成 Systemd 单元配置文件: ${SERVICE_PATH}..."
    cat <<SYSTEMD_UNIT | sudo tee "${SERVICE_PATH}" >/dev/null
[Unit]
Description=LightDrop LAN File Sharing Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
SYSTEMD_UNIT

    log_info "加载并启动 Systemd 服务..."
    sudo systemctl daemon-reload
    sudo systemctl enable "${SERVICE_NAME}"
    sudo systemctl restart "${SERVICE_NAME}"
    sleep 1

    if sudo systemctl is-active --quiet "${SERVICE_NAME}"; then
      log_success "Systemd 服务已激活并正在运行 (${SERVICE_NAME})"
    else
      log_error "Systemd 服务启动失败，请检查 journalctl -u ${SERVICE_NAME}"
      exit 1
    fi
    ;;

  pm2)
    if ! command -v pm2 >/dev/null 2>&1; then
      log_error "未检测到 pm2 命令行工具。请运行 npm install -g pm2 或选择 standalone 模式"
      exit 1
    fi

    cd "${APP_DIR}"
    pm2 delete "${PM2_NAME}" >/dev/null 2>&1 || true
    pm2 start ecosystem.config.cjs --name "${PM2_NAME}" --env production
    pm2 save >/dev/null 2>&1 || true
    log_success "PM2 服务进程托管成功: ${PM2_NAME}"
    ;;

  standalone)
    # 原生独立后台进程
    log_info "准备原生后台常驻进程..."

    # 停止旧进程
    if [ -f "${PID_FILE}" ]; then
      OLD_PID=$(cat "${PID_FILE}" 2>/dev/null || true)
      if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        log_info "停止已存在的旧实例 (PID: ${OLD_PID})..."
        kill -15 "$OLD_PID" 2>/dev/null || true
        sleep 1
      fi
    fi

    cd "${APP_DIR}"
    export NODE_ENV=production
    export PORT="${PORT}"

    # 启动后台进程
    nohup "$(command -v node)" dist/server/index.js </dev/null > "${LOG_DIR}/app.log" 2>&1 &
    APP_PID=$!
    disown "$APP_PID" 2>/dev/null || true
    echo "$APP_PID" > "${PID_FILE}"

    sleep 1.5
    if kill -0 "$APP_PID" 2>/dev/null; then
      log_success "LightDrop 独立后台进程已成功启动 (PID: ${APP_PID})"
    else
      log_error "独立进程启动失败，错误日志如下:"
      cat "${LOG_DIR}/app.log" || true
      exit 1
    fi
    ;;

  *)
    log_error "不支持的部署模式: ${DEPLOY_MODE}"
    exit 1
    ;;
esac

# ----------------- 步骤 5: 写入运行记录与状态持久化 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "5/5" "Persisting deployment metadata to runinfo directory..."
else
  log_step "5/5" "记录运行信息至 ${RUNINFO_DIR} 持久化归档..."
fi

LOCAL_IP=$(get_local_ip)
ACCESS_URL="http://${LOCAL_IP}:${PORT}"
LOCAL_URL="http://localhost:${PORT}"
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 严格创建 runinfo JSON 文件
cat <<EOF > "${RUNINFO_FILE}"
{
  "appName": "lightdrop",
  "version": "${VERSION}",
  "deployMode": "${DEPLOY_MODE}",
  "language": "${LANG_OPT}",
  "workDir": "${WORK_DIR}",
  "dataDir": "${DATA_DIR}",
  "runInfoDir": "${RUNINFO_DIR}",
  "runInfoFile": "${RUNINFO_FILE}",
  "port": ${PORT},
  "containerName": "${CONTAINER_NAME}",
  "imageName": "${IMAGE_NAME}",
  "serviceName": "${SERVICE_NAME}",
  "pm2Name": "${PM2_NAME}",
  "pidFile": "${PID_FILE}",
  "pid": ${APP_PID:-0},
  "installedAt": "${CURRENT_TIME}",
  "sourceDir": "${REPO_ROOT}",
  "accessUrl": "${ACCESS_URL}",
  "status": "running"
}
EOF

# 兼容别名软链
cp -f "${RUNINFO_FILE}" "${RUNINFO_DIR}/runinfo.json"

log_success "运行记录已写入: ${RUNINFO_FILE}"

# ----------------- 优雅最终状态信息卡片 -----------------
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
if [ "$LANG_OPT" = "en" ]; then
  echo -e " ${BOLD}${GREEN}✔ LIGHTDROP DEPLOYMENT COMPLETED SUCCESSFULLY${RESET}"
else
  echo -e " ${BOLD}${GREEN}✔ LightDrop 构建并部署作业顺利完成${RESET}"
fi
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"

print_card_row "部署方式 (Mode)" "${CYAN}${DEPLOY_MODE}${RESET}"
print_card_row "运行状态 (Status)" "${GREEN}● 活跃运行中 (Active / Running)${RESET}"
print_card_row "本机访问 (Local)" "${BOLD}${LOCAL_URL}${RESET}"
print_card_row "局域网访问 (LAN)" "${BOLD}${GREEN}${ACCESS_URL}${RESET}"
print_card_row "工作路径 (WorkDir)" "${WORK_DIR}"
print_card_row "数据存储 (DataDir)" "${DATA_DIR}"
print_card_row "运行记录 (RunInfo)" "${RUNINFO_FILE}"
print_card_row "服务端口 (Port)" "${PORT}"

echo -e "\n${BOLD}常用运维指令:${RESET}"
case "$DEPLOY_MODE" in
  docker)
    echo -e "  • 查看实时日志: ${DIM}docker logs -f ${CONTAINER_NAME}${RESET}"
    echo -e "  • 重启服务:     ${DIM}docker restart ${CONTAINER_NAME}${RESET}"
    echo -e "  • 停止服务:     ${DIM}docker stop ${CONTAINER_NAME}${RESET}"
    ;;
  systemd)
    echo -e "  • 查看实时日志: ${DIM}journalctl -u ${SERVICE_NAME} -f${RESET}"
    echo -e "  • 重启服务:     ${DIM}sudo systemctl restart ${SERVICE_NAME}${RESET}"
    echo -e "  • 停止服务:     ${DIM}sudo systemctl stop ${SERVICE_NAME}${RESET}"
    ;;
  pm2)
    echo -e "  • 查看实时日志: ${DIM}pm2 logs ${PM2_NAME}${RESET}"
    echo -e "  • 重启服务:     ${DIM}pm2 restart ${PM2_NAME}${RESET}"
    echo -e "  • 停止服务:     ${DIM}pm2 stop ${PM2_NAME}${RESET}"
    ;;
  standalone)
    echo -e "  • 查看实时日志: ${DIM}tail -f ${LOG_DIR}/app.log${RESET}"
    echo -e "  • 停止服务:     ${DIM}kill -15 \$(cat ${PID_FILE})${RESET}"
    ;;
esac

echo -e "  • 一键安全卸载: ${YELLOW}./uninstall.sh -w ${WORK_DIR}${RESET}\n"
