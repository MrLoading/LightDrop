#!/usr/bin/env bash
# ==============================================================================
# LightDrop 打包脚本 (Package Script)
# 支持：
# 1. Docker 容器镜像打包 (构建后导出为本地 .tar 文件，并自动删除本地镜像仓库中的镜像)
# 2. 原生二进制可执行程序打包 (如环境支持 pkg / bun / Node SEA) 与便携免编译独立发行包
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
OUTPUT_DIR="${REPO_ROOT}/dist-packages"
IMAGE_NAME="lightdrop:latest"
TARGET="all" # all | docker | binary
SKIP_BUILD=false
LANG_OPT="zh"
VERSION="1.0.0"

# 从 package.json 尝试提取版本号
if [ -f "${REPO_ROOT}/package.json" ]; then
  PKG_VER=$(json_read "${REPO_ROOT}/package.json" "version")
  if [ -n "$PKG_VER" ]; then
    VERSION="$PKG_VER"
  fi
fi

# ----------------- 帮助信息 -----------------
show_help() {
  if [ "$LANG_OPT" = "en" ]; then
    cat <<EOF
LightDrop Packaging Utility - v${VERSION}

Usage:
  ./package.sh [OPTIONS]

Options:
  --all                   Package all supported formats (Docker & Binary/Standalone, Default)
  --docker                Package Docker image only (export to .tar and remove from local image repo)
  --binary                Package native binary executable only (if supported by environment)
  -o, --output-dir <DIR>  Output directory for packaged archives (Default: ./dist-packages)
  --image-name <NAME>     Docker image name and tag (Default: lightdrop:latest)
  --skip-build            Skip frontend/backend build step if already compiled
  -l, --lang <zh|en>      Output language (Default: zh)
  -h, --help              Show this help message

Examples:
  ./package.sh                          # Package all supported targets
  ./package.sh --docker                 # Build Docker image, export to .tar and remove local image
  ./package.sh --binary                 # Package binary / standalone bundle
  ./package.sh -o /tmp/packages         # Specify output directory
EOF
  else
    cat <<EOF
LightDrop 项目打包工具 - v${VERSION}

用法:
  ./package.sh [选项]

选项:
  --all                   打包所有支持的格式 (容器镜像 与 二进制/免编译发行包，默认)
  --docker                仅打包 Docker 容器镜像 (构建后保存到本地 .tar，并删除本地镜像以释放空间)
  --binary                仅打包独立二进制可执行程序 (如果系统环境支持 pkg/bun/SEA)
  -o, --output-dir <目录> 打包产物输出目录 (默认: ./dist-packages)
  --image-name <名称>     Docker 镜像完整名称及标签 (默认: lightdrop:latest)
  --skip-build            跳过构建步骤 (适用于 dist 目录已构建完成的情况)
  -l, --lang <zh|en>      语言设置 (默认: zh，可选: en)
  -h, --help              显示此帮助信息

示例:
  ./package.sh                          # 全量打包
  ./package.sh --docker                 # 仅构建容器镜像并导出 .tar，自动清理本地缓存镜像
  ./package.sh --binary                 # 仅打包二进制 / 独立分发程序
  ./package.sh -o /tmp/packages         # 指定产物保存路径
EOF
  fi
  exit 0
}

# ----------------- 解析命令行参数 -----------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      TARGET="all"
      shift
      ;;
    --docker)
      TARGET="docker"
      shift
      ;;
    --binary)
      TARGET="binary"
      shift
      ;;
    -o|--output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --image-name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    -l|--lang)
      LANG_OPT="$2"
      shift 2
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

# ----------------- 开始执行 -----------------
cd "${REPO_ROOT}"

if [ "$LANG_OPT" = "en" ]; then
  print_banner "LightDrop Packaging Engine v${VERSION}" "LAN Sharing - Fast & Lightweight"
else
  print_banner "LightDrop 打包引擎 v${VERSION}" "局域网跨设备极速快传 - 自动化发布系统"
fi

mkdir -p "${OUTPUT_DIR}"

SUMMARY_PACKAGES=()

# ----------------- 步骤 1: 源码构建 -----------------
build_project() {
  if [ "$SKIP_BUILD" = true ] && [ -d "${REPO_ROOT}/dist/client" ] && [ -d "${REPO_ROOT}/dist/server" ]; then
    if [ "$LANG_OPT" = "en" ]; then
      log_info "Skipping build stage as requested (--skip-build)"
    else
      log_info "已指定 --skip-build，跳过源码编译步骤"
    fi
    return 0
  fi

  if [ "$LANG_OPT" = "en" ]; then
    log_step "1" "Building Frontend and Backend (TypeScript & Vite)..."
  else
    log_step "1" "执行项目全量构建 (TypeScript 服务端 + Vite 前端 PWA)..."
  fi

  # 清理可能存在的过期 tsbuildinfo 缓存
  rm -f "${REPO_ROOT}/tsconfig.server.tsbuildinfo" "${REPO_ROOT}/tsconfig.client.tsbuildinfo"

  local node_bin
  node_bin="$(get_node_bin)"
  if [ -n "$node_bin" ]; then
    local node_dir
    node_dir="$(dirname "$node_bin")"
    export PATH="${node_dir}:${PATH}"
  fi

  if command -v pnpm >/dev/null 2>&1; then
    pnpm build
  elif command -v npx >/dev/null 2>&1; then
    log_info "未找到全局 pnpm，正在通过 npx 执行构建..."
    npx vite build && npx tsc -p tsconfig.server.json
  elif command -v npm >/dev/null 2>&1; then
    npm run build
  else
    log_error "未检测到 pnpm 或 npm，请先安装 Node.js 包管理器"
    exit 1
  fi

  if [ "$LANG_OPT" = "en" ]; then
    log_success "Project built successfully."
  else
    log_success "项目构建完成 (产物位于 dist/ 目录)。"
  fi
}

# ----------------- 步骤 2: Docker 镜像打包 -----------------
package_docker() {
  if [ "$LANG_OPT" = "en" ]; then
    log_step "Docker" "Building and exporting Container Image..."
  else
    log_step "Docker" "构建并导出容器镜像 (构建 -> 导出 .tar -> 清理本地镜像)..."
  fi

  if ! command -v docker >/dev/null 2>&1; then
    log_warn "未检测到 docker 命令行工具，跳过容器镜像打包"
    return 0
  fi

  if ! docker info >/dev/null 2>&1; then
    log_warn "Docker 守护进程未启动，无法打包 Docker 镜像。请先启动 Docker 服务后重试"
    return 0
  fi

  local tar_filename="lightdrop-docker-${VERSION}.tar"
  local output_tar="${OUTPUT_DIR}/${tar_filename}"

  # 1. 构建镜像
  log_info "正在构建 Docker 镜像: ${IMAGE_NAME}..."
  docker build -t "${IMAGE_NAME}" -f "${REPO_ROOT}/Dockerfile" "${REPO_ROOT}"
  log_success "Docker 镜像构建成功: ${IMAGE_NAME}"

  # 2. 保存镜像为本地 .tar 文件
  log_info "正在导出镜像到本地 TAR 文件: ${output_tar}..."
  rm -f "${output_tar}"
  docker save "${IMAGE_NAME}" -o "${output_tar}"

  if [ -f "${output_tar}" ]; then
    local size_bytes
    size_bytes=$(wc -c < "${output_tar}" | tr -d ' ')
    local human_size
    human_size=$(format_bytes "$size_bytes")
    log_success "镜像已成功导出: ${output_tar} (${human_size})"
  else
    log_error "镜像导出失败，未生成 ${output_tar}"
    return 1
  fi

  # 3. 删除本地镜像仓库中的该镜像 (符合用户明确要求)
  log_info "清理本地镜像仓库中的镜像以释放存储空间: ${IMAGE_NAME}..."
  docker rmi -f "${IMAGE_NAME}" >/dev/null 2>&1 || true
  log_success "已从本地镜像仓库中删除镜像: ${IMAGE_NAME} (本地 .tar 文件已完整保留)"

  SUMMARY_PACKAGES+=("Docker 镜像包|.tar|${output_tar}|${human_size}")
}

# ----------------- 步骤 3: 二进制打包 (如果支持) -----------------
package_binary() {
  if [ "$LANG_OPT" = "en" ]; then
    log_step "Binary" "Packaging Binary Executable (if supported) / Standalone Distribution..."
  else
    log_step "Binary" "独立二进制程序打包 (若系统支持) / 便携式免编译运行包..."
  fi

  local os_type
  os_type="$(uname -s | tr '[:upper:]' '[:lower:]')"
  local arch_type
  arch_type="$(uname -m)"

  local binary_built=false
  local bin_name="lightdrop"
  if [ "$os_type" = "windows" ] || [[ "$os_type" == *"mingw"* ]]; then
    bin_name="lightdrop.exe"
  fi

  # 检测环境是否具备二进制打包工具
  # 方式 1: pkg 或 @yao-pkg/pkg
  if command -v pkg >/dev/null 2>&1; then
    log_info "检测到系统已安装 pkg 二进制打包工具，开始编译原生可执行程序..."
    local temp_bin_dir="${OUTPUT_DIR}/.tmp_bin"
    rm -rf "${temp_bin_dir}"
    mkdir -p "${temp_bin_dir}"

    if pkg "${REPO_ROOT}/package.json" --output "${temp_bin_dir}/${bin_name}" 2>/dev/null; then
      binary_built=true
    fi
  elif command -v bun >/dev/null 2>&1; then
    # 方式 2: bun build --compile
    log_info "检测到系统已安装 bun，尝试编译单一独立可执行文件..."
    local temp_bin_dir="${OUTPUT_DIR}/.tmp_bin"
    rm -rf "${temp_bin_dir}"
    mkdir -p "${temp_bin_dir}"

    if bun build "${REPO_ROOT}/src/server/index.ts" --compile --outfile "${temp_bin_dir}/${bin_name}" 2>/dev/null; then
      binary_built=true
    fi
  fi

  if [ "$binary_built" = true ] && [ -f "${temp_bin_dir}/${bin_name}" ]; then
    # 打包二进制发行包 (包含二进制可执行文件 + 前端静态页面 dist/client)
    local bin_tar="${OUTPUT_DIR}/lightdrop-bin-${VERSION}-${os_type}-${arch_type}.tar.gz"
    log_info "正在打包独立二进制发布包: ${bin_tar}..."
    tar -czf "${bin_tar}" \
      -C "${temp_bin_dir}" "${bin_name}" \
      -C "${REPO_ROOT}" "dist/client" "public" 2>/dev/null || true
    rm -rf "${temp_bin_dir}"

    local bin_size
    bin_size=$(format_bytes "$(wc -c < "${bin_tar}" | tr -d ' ')")
    log_success "独立原生二进制包已生成: ${bin_tar} (${bin_size})"
    SUMMARY_PACKAGES+=("原生二进制包|.tar.gz|${bin_tar}|${bin_size}")
  else
    # 环境暂不支持二进制单文件直编（如缺少 pkg/bun/SEA 工具链）
    if [ "$LANG_OPT" = "en" ]; then
      log_info "Binary packaging note: Native binary bundler (pkg / bun) not detected in environment."
      log_info "Packaging precompiled zero-build standalone runtime distribution archive instead..."
    else
      log_info "二进制打包提示: 当前环境未检测到独立二进制编译器 (如 pkg / bun 工具链)。"
      log_info "提示: 如需编译纯独立二进制文件，可安装: npm install -g @yao-pkg/pkg"
      log_info "系统正在自动生成标准【开箱即用免编译独立发行包】(包含完整服务端、前端与运行环境配置)..."
    fi

    local standalone_tar="${OUTPUT_DIR}/lightdrop-standalone-${VERSION}.tar.gz"
    local temp_stage="${OUTPUT_DIR}/.tmp_standalone/lightdrop"
    rm -rf "${OUTPUT_DIR}/.tmp_standalone"
    mkdir -p "${temp_stage}"

    # 拷贝构建产物与运行时所需文件 (包含生产依赖库确保独立可运行)
    cp -r "${REPO_ROOT}/dist" "${temp_stage}/"
    cp -r "${REPO_ROOT}/public" "${temp_stage}/"
    cp "${REPO_ROOT}/package.json" "${temp_stage}/"
    cp "${REPO_ROOT}/ecosystem.config.cjs" "${temp_stage}/"
    if [ -f "${REPO_ROOT}/pnpm-lock.yaml" ]; then
      cp "${REPO_ROOT}/pnpm-lock.yaml" "${temp_stage}/"
    fi
    if [ -d "${REPO_ROOT}/node_modules" ]; then
      log_info "正在复制依赖库 node_modules 至便携包..."
      cp -R "${REPO_ROOT}/node_modules" "${temp_stage}/" 2>/dev/null || true
    fi

    # 生成一键启动脚本
    cat <<'RUN_EOF' > "${temp_stage}/run.sh"
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"
export NODE_ENV=production
export PORT="${PORT:-8080}"
echo "Starting LightDrop on port ${PORT}..."

# 探测满足 Node.js >= 18 的运行环境
NODE_BIN=""
shopt -s nullglob 2>/dev/null || true
for candidate in \
  "$(command -v node 2>/dev/null)" \
  /root/.nvm/versions/node/v*/bin/node \
  "${HOME}/.nvm/versions/node/v*/bin/node" \
  /usr/local/bin/node \
  /opt/homebrew/bin/node; do
  if [ -x "$candidate" ]; then
    v=$("$candidate" -v 2>/dev/null | sed -E 's/^v//' | cut -d. -f1)
    if [ -n "$v" ] && [ "$v" -ge 18 ] 2>/dev/null; then
      NODE_BIN="$candidate"
      break
    fi
  fi
done
shopt -u nullglob 2>/dev/null || true

if [ -z "$NODE_BIN" ]; then
  NODE_BIN="node"
fi

exec "$NODE_BIN" dist/server/index.js
RUN_EOF
    chmod +x "${temp_stage}/run.sh"

    # 打包为 tar.gz
    tar -czf "${standalone_tar}" -C "${OUTPUT_DIR}/.tmp_standalone" lightdrop
    rm -rf "${OUTPUT_DIR}/.tmp_standalone"

    local st_size
    st_size=$(format_bytes "$(wc -c < "${standalone_tar}" | tr -d ' ')")
    log_success "免编译独立发行包已就绪: ${standalone_tar} (${st_size})"
    SUMMARY_PACKAGES+=("独立免编译发行包|.tar.gz|${standalone_tar}|${st_size}")
  fi
}

# ----------------- 执行各构建目标 -----------------
# 仅当构建目标包含 binary 或 all 时才需要在宿主机编译；Docker 构建由 Dockerfile 独立完成
if [ "$TARGET" != "docker" ]; then
  build_project
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "docker" ]; then
  package_docker
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "binary" ]; then
  package_binary
fi

# ----------------- 优雅最终状态信息 -----------------
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
if [ "$LANG_OPT" = "en" ]; then
  echo -e " ${BOLD}${GREEN}✔ PACKAGING COMPLETED SUCCESSFULLY${RESET}"
else
  echo -e " ${BOLD}${GREEN}✔ LightDrop 打包作业全部完成${RESET}"
fi
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"

print_card_row "产物存放目录" "${OUTPUT_DIR}"
echo ""

if [ ${#SUMMARY_PACKAGES[@]} -gt 0 ]; then
  echo -e "  ${BOLD}已生成的发布包产物列表:${RESET}"
  for item in "${SUMMARY_PACKAGES[@]}"; do
    IFS="|" read -r p_name p_type p_path p_size <<< "$item"
    echo -e "   • ${CYAN}[${p_type}]${RESET} ${BOLD}${p_name}${RESET}:"
    echo -e "     路径: ${p_path}"
    echo -e "     大小: ${GREEN}${p_size}${RESET}"
  done
else
  log_warn "未生成任何包，请检查参数或前置工具链配置"
fi

echo -e "\n${BOLD}使用指引:${RESET}"
echo -e "  • Docker TAR 镜像包使用方式:"
echo -e "    ${DIM}docker load -i <导出的.tar文件>${RESET}"
echo -e "    ${DIM}docker run -d -p 8080:8080 -v /var/lib/lightdrop/data:/app/data lightdrop:latest${RESET}"
echo -e "  • 自动化一键部署服务:"
echo -e "    ${DIM}./deploy.sh --mode docker${RESET}  或  ${DIM}./deploy.sh --mode standalone${RESET}\n"
