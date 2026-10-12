#!/usr/bin/env bash
# ==============================================================================
# LightDrop 通用脚本工具库 (Scripts Common Library)
# 提供跨平台终端色彩、国际化、目录检测、JSON处理及格式化打印
# ==============================================================================

# ----------------- 终端色彩设置 -----------------
setup_terminal_colors() {
  if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BOLD='\033[1m'
    DIM='\033[2m'
    RESET='\033[0m'
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    WHITE='\033[1;37m'
    BG_BLUE='\033[44m'
    BG_CYAN='\033[46m'
  else
    BOLD=''
    DIM=''
    RESET=''
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    WHITE=''
    BG_BLUE=''
    BG_CYAN=''
  fi
}
setup_terminal_colors

# ----------------- 优雅日志输出 -----------------
log_info() {
  echo -e "  ${CYAN}ℹ${RESET}  $*"
}

log_success() {
  echo -e "  ${GREEN}✓${RESET}  $*"
}

log_warn() {
  echo -e "  ${YELLOW}!${RESET}  ${YELLOW}$*${RESET}"
}

log_error() {
  echo -e "  ${RED}✗${RESET}  ${RED}$*${RESET}"
}

log_step() {
  local step_num="$1"
  local step_desc="$2"
  echo -e "\n${BOLD}${CYAN}━━━ [${step_num}] ${step_desc} ━━━${RESET}"
}

# ----------------- 打印横幅 Banner -----------------
print_banner() {
  local title="$1"
  local subtitle="${2:-}"
  echo -e "${CYAN}${BOLD}"
  echo "╔════════════════════════════════════════════════════════════════╗"
  printf "║  %-60s║\n" "$title"
  if [ -n "$subtitle" ]; then
    printf "║  %-60s║\n" "$subtitle"
  fi
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# ----------------- 格式化输出键值卡片 -----------------
print_card_row() {
  local label="$1"
  local val="$2"
  printf "  ${BOLD}%-20s${RESET}: %b\n" "$label" "$val"
}

# ----------------- 本机 IP 地址探测 -----------------
get_local_ip() {
  local ip=""
  if [[ "$OSTYPE" == "darwin"* ]]; then
    ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || true)
  fi
  if [ -z "$ip" ] && command -v ifconfig >/dev/null 2>&1; then
    ip=$(ifconfig 2>/dev/null | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1 || true)
  fi
  if [ -z "$ip" ]; then
    ip="127.0.0.1"
  fi
  echo "$ip"
}

# ----------------- 人类可读文件大小 -----------------
format_bytes() {
  local bytes="$1"
  if [ -z "$bytes" ] || ! [[ "$bytes" =~ ^[0-9]+$ ]]; then
    echo "0 B"
    return
  fi
  if [ "$bytes" -ge 1073741824 ]; then
    echo "$(awk -v b="$bytes" 'BEGIN { printf "%.2f GB", b/1073741824 }')"
  elif [ "$bytes" -ge 1048576 ]; then
    echo "$(awk -v b="$bytes" 'BEGIN { printf "%.2f MB", b/1048576 }')"
  elif [ "$bytes" -ge 1024 ]; then
    echo "$(awk -v b="$bytes" 'BEGIN { printf "%.2f KB", b/1024 }')"
  else
    echo "${bytes} B"
  fi
}

# ----------------- 读写 JSON 工具 -----------------
json_read() {
  local file="$1"
  local key="$2"
  if [ ! -f "$file" ]; then
    echo ""
    return
  fi
  local node_cmd
  node_cmd="$(command -v node 2>/dev/null || which node 2>/dev/null || true)"
  if [ -n "$node_cmd" ] && [ -x "$node_cmd" ]; then
    "$node_cmd" -e 'try { const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = d[process.argv[2]]; console.log(v !== undefined && v !== null ? v : ""); } catch(e) { console.log(""); }' "$file" "$key" 2>/dev/null || true
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import sys, json; print(json.load(open(sys.argv[1])).get(sys.argv[2], ''))" "$file" "$key" 2>/dev/null || true
    return
  fi
  grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" 2>/dev/null | head -n1 | sed -E "s/\"$key\"[[:space:]]*:[[:space:]]*\"([^\"]*)\"/\1/" || true
}

# ----------------- 操作系统与架构探测 -----------------
detect_os() {
  local os_raw=""
  if [ -n "${OSTYPE:-}" ]; then
    os_raw="$OSTYPE"
  else
    os_raw="$(uname -s 2>/dev/null || echo 'unknown')"
  fi
  os_raw="$(echo "$os_raw" | tr '[:upper:]' '[:lower:]')"

  case "$os_raw" in
    darwin*)
      echo "macos"
      ;;
    linux*)
      echo "linux"
      ;;
    msys*|cygwin*|mingw*|win32*|windows*)
      echo "windows"
      ;;
    *)
      local uname_s
      uname_s="$(uname -s 2>/dev/null || echo 'unknown')"
      case "$uname_s" in
        Darwin*) echo "macos" ;;
        Linux*)  echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
      esac
      ;;
  esac
}

get_os_pretty_name() {
  local os
  os="$(detect_os)"
  local arch
  arch="$(uname -m 2>/dev/null || echo '')"
  case "$os" in
    macos)
      local ver
      ver="$(sw_vers -productVersion 2>/dev/null || echo '')"
      echo "macOS ${ver} (${arch})"
      ;;
    linux)
      local distro=""
      if [ -f /etc/os-release ]; then
        distro="$(grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
      fi
      [ -z "$distro" ] && distro="Linux"
      echo "${distro} (${arch})"
      ;;
    windows)
      echo "Windows (${arch:-x64})"
      ;;
    *)
      echo "Unknown OS ($(uname -s 2>/dev/null || ''))"
      ;;
  esac
}

# ----------------- 基于操作系统自适应默认工作路径 -----------------
get_default_work_dir() {
  local os
  os="$(detect_os)"
  case "$os" in
    macos)
      if [ "$(id -u 2>/dev/null || echo 1)" -eq 0 ]; then
        echo "/Library/Application Support/LightDrop"
      else
        echo "${HOME}/Library/Application Support/LightDrop"
      fi
      ;;
    linux)
      if [ "$(id -u 2>/dev/null || echo 1)" -eq 0 ]; then
        echo "/var/lib/lightdrop"
      else
        echo "${HOME}/.lightdrop"
      fi
      ;;
    windows)
      if [ -n "${LOCALAPPDATA:-}" ]; then
        echo "${LOCALAPPDATA}/LightDrop" | tr '\\' '/'
      elif [ -n "${PROGRAMDATA:-}" ]; then
        echo "${PROGRAMDATA}/LightDrop" | tr '\\' '/'
      else
        echo "${HOME}/.lightdrop"
      fi
      ;;
    *)
      echo "${HOME}/.lightdrop"
      ;;
  esac
}

# ----------------- 获取精确 Node 可执行文件路径 (优先匹配 >= 18 版本) -----------------
get_node_bin() {
  local candidates=()

  # 1. 当前 PATH 中的 node
  local path_node
  path_node="$(command -v node 2>/dev/null || which node 2>/dev/null || true)"
  [ -n "$path_node" ] && candidates+=("$path_node")

  # 2. 常见现代 Node 安装路径
  candidates+=(
    "/usr/local/bin/node"
    "/opt/node/bin/node"
    "${HOME}/.local/share/pnpm/node"
  )

  # 3. NVM 环境嗅探 (从高版本向低版本匹配)
  local nvm_dirs=("${NVM_DIR:-}" "${HOME}/.nvm" "/root/.nvm")
  for nd in "${nvm_dirs[@]}"; do
    if [ -n "$nd" ] && [ -d "$nd/versions/node" ]; then
      while IFS= read -r nvm_node; do
        [ -n "$nvm_node" ] && candidates+=("$nvm_node")
      done < <(find "$nd/versions/node" -maxdepth 3 -name "node" -type f 2>/dev/null | sort -V -r || true)
    fi
  done

  # 4. 系统默认路径
  candidates+=("/usr/bin/node")

  # 遍历候选列表，优先返回版本 >= 18 的 Node
  for candidate in "${candidates[@]}"; do
    if [ -x "$candidate" ]; then
      local ver_raw
      ver_raw="$("$candidate" -v 2>/dev/null || true)"
      local major
      major="$(echo "$ver_raw" | sed -E 's/^v//' | cut -d. -f1 || true)"
      if [[ "$major" =~ ^[0-9]+$ ]] && [ "$major" -ge 18 ]; then
        echo "$candidate"
        return 0
      fi
    fi
  done

  # 若未找到 >= 18 的版本，降级返回任意可用 node
  for candidate in "${candidates[@]}"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  echo ""
}

# ----------------- 检测指定 TCP 端口是否被占用 -----------------
is_port_in_use() {
  local port="$1"
  [ -z "$port" ] && return 1

  if command -v ss >/dev/null 2>&1; then
    if ss -H -tulpn 2>/dev/null | grep -E "[:.]${port}[[:space:]]" >/dev/null 2>&1; then
      return 0
    fi
  elif command -v netstat >/dev/null 2>&1; then
    if netstat -tulpn 2>/dev/null | grep -E "[:.]${port}[[:space:]]" >/dev/null 2>&1; then
      return 0
    fi
  elif command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

get_process_on_port() {
  local port="$1"
  local info=""
  if command -v ss >/dev/null 2>&1; then
    info="$(ss -tulpn 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | awk '{print $NF}' | head -n 1 || true)"
  elif command -v lsof >/dev/null 2>&1; then
    info="$(lsof -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | tail -n +2 | awk '{print $1 "[" $2 "]"}' | head -n 1 || true)"
  fi
  echo "$info"
}

# ----------------- 安全检查：拦截高危目录误删 -----------------
is_dangerous_dir() {
  local raw_dir="$1"
  if [ -z "$raw_dir" ]; then
    return 0 # dangerous
  fi

  local norm_dir
  norm_dir=$(echo "$raw_dir" | tr '\\' '/' | tr '[:upper:]' '[:lower:]' | sed 's:/*$::')

  case "$norm_dir" in
    ""|"/"|"/bin"|"/sbin"|"/etc"|"/usr"|"/usr/bin"|"/usr/lib"|"/var"|"/var/lib"|"/var/log"|"/tmp"|"/home"|"/root"|"/users"|"/system"|"/library"|"/applications"|"c:"|"c:/"|"c:/windows"|"c:/program files"|"c:/program files (x86)"|"c:/users"|"c:/programdata")
      return 0 # dangerous
      ;;
    *)
      # 必须路径深度至少两层以上
      if [ "$norm_dir" = "/" ] || [ -z "$norm_dir" ]; then
        return 0
      fi
      return 1 # safe
      ;;
  esac
}

# ----------------- 确保目录具有写权限 (尝试提权) -----------------
ensure_writable_dir() {
  local target_dir="$1"
  if [ -d "$target_dir" ] && [ -w "$target_dir" ]; then
    return 0
  fi

  if mkdir -p "$target_dir" 2>/dev/null && [ -w "$target_dir" ]; then
    return 0
  fi

  # 若无写权限且为普通用户，尝试 sudo (非 Windows 环境)
  if [ "$(detect_os)" != "windows" ] && command -v sudo >/dev/null 2>&1; then
    log_warn "需要管理员权限创建/配置工作目录: ${target_dir}"
    sudo mkdir -p "$target_dir"
    sudo chown -R "$(id -u):$(id -g)" "$target_dir" 2>/dev/null || true
    if [ -w "$target_dir" ]; then
      return 0
    fi
  fi

  return 1
}

