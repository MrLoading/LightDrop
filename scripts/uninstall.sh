#!/usr/bin/env bash
# ==============================================================================
# LightDrop 跨平台智能卸载与清理脚本 (Uninstall Script)
# 支持：
# 1. 自动适配操作系统 (macOS / Linux / Windows)，自适应解析工作路径
# 2. 读取 <工作路径>/runinfo/*.json 获取生命周期模式及自启动配置并精准注销：
#    • macOS:   注销并移除 LaunchAgent 服务，清理开机/登录自启动项
#    • Linux:   停止并注销 Systemd 单元，关闭系统自启动 (systemctl disable)
#    • Windows: 注销任务计划程序 (schtasks) 及开机自启动文件夹启动项
#    • 全平台:  注销 Docker 容器、PM2 进程、独立后台进程
# 3. 灵活的数据保留策略 (数据安全保留 vs 彻底清空)
# 4. 彻底清理运行时产物与配置
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 导入通用库
if [ -f "${SCRIPT_DIR}/common.sh" ]; then
  # shellcheck source=scripts/common.sh
  source "${SCRIPT_DIR}/common.sh"
fi

# ----------------- 环境与操作系统探测 -----------------
CURRENT_OS="$(detect_os)"
OS_PRETTY="$(get_os_pretty_name)"
DEFAULT_WORK_DIR="$(get_default_work_dir)"

# ----------------- 默认配置 -----------------
WORK_DIR="${DEFAULT_WORK_DIR}"
LANG_OPT="" # 优先从 runinfo.json 读取，否则默认 zh
DELETE_DATA="" # true: 彻底删除数据 | false: 保留数据 | "": 待交互确认
AUTO_YES=false
FORCE=false

# ----------------- 帮助信息 -----------------
show_help() {
  cat <<EOF
LightDrop 跨平台服务卸载工具 (Uninstall Script)
检测到当前系统: ${OS_PRETTY}

用法:
  ./uninstall.sh [选项]

选项:
  -w, --workdir <路径>    指定工作路径 (当前系统默认: ${DEFAULT_WORK_DIR})
  --delete-data           【彻底删除】上传的文件、文本记录与历史数据
  --keep-data             【安全保留】上传的文件与数据，仅卸载服务并清理程序文件
  -l, --lang <zh|en>      指定界面语言 (默认优先读取安装记录，或默认为 zh)
  -y, --yes               非交互确认模式 (默认保留数据，除非配合 --delete-data)
  -f, --force             强制清理模式 (忽略中间停止错误)
  -h, --help              显示此帮助信息

示例:
  ./uninstall.sh                                # 默认从当前系统工作路径交互式卸载
  ./uninstall.sh -w "${DEFAULT_WORK_DIR}"        # 指定工作路径卸载
  ./uninstall.sh --delete-data -y               # 一键彻底静默卸载并清理全部上传数据
  ./uninstall.sh --keep-data                    # 卸载服务但保留上传的文件
EOF
  exit 0
}

# ----------------- 解析命令行参数 -----------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--workdir)
      WORK_DIR="$2"
      shift 2
      ;;
    --delete-data|--purge)
      DELETE_DATA=true
      shift
      ;;
    --keep-data)
      DELETE_DATA=false
      shift
      ;;
    -l|--lang)
      LANG_OPT="$2"
      shift 2
      ;;
    -y|--yes)
      AUTO_YES=true
      shift
      ;;
    -f|--force)
      FORCE=true
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

# ----------------- 安全检查与目录有效性 -----------------
if is_dangerous_dir "${WORK_DIR}"; then
  log_error "安全拦截: 指定的工作路径 [${WORK_DIR}] 为系统保护目录，拒绝执行卸载操作！"
  exit 1
fi

if [ ! -d "${WORK_DIR}" ]; then
  log_warn "工作路径不存在: ${WORK_DIR}，系统中未找到需要卸载的内容。"
  exit 0
fi

# ----------------- 寻找并读取 runinfo/*.json -----------------
RUNINFO_DIR="${WORK_DIR}/runinfo"
RUNINFO_JSON=""

if [ -d "${RUNINFO_DIR}" ]; then
  if [ -f "${RUNINFO_DIR}/lightdrop-runinfo.json" ]; then
    RUNINFO_JSON="${RUNINFO_DIR}/lightdrop-runinfo.json"
  elif [ -f "${RUNINFO_DIR}/runinfo.json" ]; then
    RUNINFO_JSON="${RUNINFO_DIR}/runinfo.json"
  else
    CANDIDATE=$(find "${RUNINFO_DIR}" -maxdepth 1 -name "*.json" 2>/dev/null | head -n 1 || true)
    if [ -n "$CANDIDATE" ]; then
      RUNINFO_JSON="$CANDIDATE"
    fi
  fi
fi

# 解析运行信息
DEPLOY_MODE=""
CONTAINER_NAME="lightdrop"
SERVICE_NAME="lightdrop.service"
PM2_NAME="lightdrop"
TASK_NAME="LightDrop"
PLIST_LABEL="com.lightdrop.server"
PLIST_PATH=""
PID_FILE="${RUNINFO_DIR}/lightdrop.pid"
APP_PID=""
RECORDED_DATA_DIR="${WORK_DIR}/data"
RECORDED_LANG="zh"
AUTOSTART_STATUS=""

if [ -n "$RUNINFO_JSON" ] && [ -f "$RUNINFO_JSON" ]; then
  DEPLOY_MODE=$(json_read "$RUNINFO_JSON" "deployMode")
  [ -z "$DEPLOY_MODE" ] && DEPLOY_MODE=$(json_read "$RUNINFO_JSON" "mode")

  c_name=$(json_read "$RUNINFO_JSON" "containerName")
  [ -n "$c_name" ] && CONTAINER_NAME="$c_name"

  s_name=$(json_read "$RUNINFO_JSON" "serviceName")
  [ -n "$s_name" ] && SERVICE_NAME="$s_name"

  p_name=$(json_read "$RUNINFO_JSON" "pm2Name")
  [ -n "$p_name" ] && PM2_NAME="$p_name"

  t_name=$(json_read "$RUNINFO_JSON" "taskName")
  [ -n "$t_name" ] && TASK_NAME="$t_name"

  pl_path=$(json_read "$RUNINFO_JSON" "plistPath")
  [ -n "$pl_path" ] && PLIST_PATH="$pl_path"

  p_file=$(json_read "$RUNINFO_JSON" "pidFile")
  [ -n "$p_file" ] && PID_FILE="$p_file"

  p_id=$(json_read "$RUNINFO_JSON" "pid")
  [ -n "$p_id" ] && APP_PID="$p_id"

  d_dir=$(json_read "$RUNINFO_JSON" "dataDir")
  [ -n "$d_dir" ] && RECORDED_DATA_DIR="$d_dir"

  r_lang=$(json_read "$RUNINFO_JSON" "language")
  [ -n "$r_lang" ] && RECORDED_LANG="$r_lang"

  a_stat=$(json_read "$RUNINFO_JSON" "autostart")
  [ -n "$a_stat" ] && AUTOSTART_STATUS="$a_stat"
fi

# 语言判定
if [ -z "$LANG_OPT" ]; then
  LANG_OPT="${RECORDED_LANG:-zh}"
fi

DATA_DIR="${RECORDED_DATA_DIR}"

# 打印横幅
echo ""
if [ "$LANG_OPT" = "en" ]; then
  print_banner "LightDrop Uninstallation Engine" "OS: ${OS_PRETTY} | WorkDir: ${WORK_DIR}"
else
  print_banner "LightDrop 跨平台服务卸载引擎" "系统: ${OS_PRETTY} | 工作路径: ${WORK_DIR}"
fi

# ----------------- 步骤 1: 审查运行记录与模式分析 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "1/4" "Inspecting deployment metadata & lifecycle status..."
else
  log_step "1/4" "审查部署元数据与生命周期运行状态..."
fi

if [ -n "$RUNINFO_JSON" ]; then
  log_success "找到部署运行记录: ${RUNINFO_JSON}"
  log_info "记录的部署模式: ${CYAN}${DEPLOY_MODE:-未知}${RESET}"
  log_info "开机自启状态: ${CYAN}${AUTOSTART_STATUS:-未标注}${RESET}"
  log_info "数据存储目录: ${DATA_DIR}"
else
  log_warn "未在 ${RUNINFO_DIR} 检测到运行记录，进入多系统环境深度嗅探..."

  if [ "$CURRENT_OS" = "macos" ] && { launchctl list 2>/dev/null | grep -q "${PLIST_LABEL}" || [ -f "${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist" ]; }; then
    DEPLOY_MODE="launchd"
    PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
    log_info "嗅探到正在运行或已注册的 macOS LaunchAgent: ${PLIST_LABEL}"
  elif command -v docker >/dev/null 2>&1 && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Eq "^${CONTAINER_NAME}\$"; then
    DEPLOY_MODE="docker"
    log_info "嗅探到活动中的 Docker 容器: ${CONTAINER_NAME}"
  elif command -v systemctl >/dev/null 2>&1 && (systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null || [ -f "/etc/systemd/system/${SERVICE_NAME}" ]); then
    DEPLOY_MODE="systemd"
    log_info "嗅探到 Linux Systemd 服务: ${SERVICE_NAME}"
  elif [ "$CURRENT_OS" = "windows" ] && schtasks //Query //TN "${TASK_NAME}" >/dev/null 2>&1; then
    DEPLOY_MODE="task"
    log_info "嗅探到 Windows 任务计划程序: ${TASK_NAME}"
  elif command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q "\"${PM2_NAME}\""; then
    DEPLOY_MODE="pm2"
    log_info "嗅探到活动中的 PM2 进程: ${PM2_NAME}"
  elif [ -f "${PID_FILE}" ]; then
    DEPLOY_MODE="standalone"
    log_info "嗅探到独立进程 PID 文件: ${PID_FILE}"
  else
    DEPLOY_MODE="standalone"
    log_info "未检测到明确活动服务，将按标准目录执行清理"
  fi
fi

# ----------------- 步骤 2: 确认数据保留/删除决策 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "2/4" "Confirming data retention policy..."
else
  log_step "2/4" "确认数据保留与清理策略..."
fi

if [ -z "$DELETE_DATA" ]; then
  if [ "$AUTO_YES" = true ]; then
    DELETE_DATA=false
    log_info "非交互模式 (-y): 出于数据安全，默认保留用户上传的数据"
  elif [ -t 0 ]; then
    echo ""
    echo -e "${YELLOW}${BOLD}┌──────────────────────────────────────────────────────────────┐${RESET}"
    if [ "$LANG_OPT" = "en" ]; then
      echo -e "${YELLOW}${BOLD}│  📦 Data Retention Confirmation                              │${RESET}"
      echo -e "${YELLOW}${BOLD}├──────────────────────────────────────────────────────────────┤${RESET}"
      echo -e "│  Data Directory: ${BOLD}${DATA_DIR}${RESET}"
      echo -e "│  Do you want to permanently DELETE uploaded files & data?    │"
      echo -e "│  [y] Delete everything including uploaded files              │"
      echo -e "│  [N] Keep uploaded files safe, only uninstall service        │"
    else
      echo -e "${YELLOW}${BOLD}│  📦 数据保留选项确认                                         │${RESET}"
      echo -e "${YELLOW}${BOLD}├──────────────────────────────────────────────────────────────┤${RESET}"
      echo -e "│  数据存储目录: ${BOLD}${DATA_DIR}${RESET}"
      echo -e "│  是否彻底删除已上传的文件和历史数据？                        │"
      echo -e "│  [y] 彻底删除 (包含所有上传的文件、文本记录与系统设置)       │"
      echo -e "│  [N] 安全保留 (仅停止并卸载运行服务，上传的文件完好保留)     │"
    fi
    echo -e "${YELLOW}${BOLD}└──────────────────────────────────────────────────────────────┘${RESET}"
    read -r -p "请输入选择 [y/N] (默认保留数据 N): " user_choice
    case "$user_choice" in
      [yY]|[yY][eE][sS])
        DELETE_DATA=true
        ;;
      *)
        DELETE_DATA=false
        ;;
    esac
  else
    DELETE_DATA=false
  fi
fi

if [ "$DELETE_DATA" = true ]; then
  log_warn "决策: 将彻底清除所有上传的文件和工作路径数据！"
else
  log_success "决策: 安全保留上传的文件和数据目录 (${DATA_DIR})"
fi

# ----------------- 步骤 3: 停止并注销系统服务与自启动项 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "3/4" "Deregistering service & disabling autostart [${DEPLOY_MODE}]..."
else
  log_step "3/4" "停止并注销系统生命周期服务与自启动项 [${DEPLOY_MODE}]..."
fi

case "$DEPLOY_MODE" in
  # ----------------- macOS launchd -----------------
  launchd)
    if [ -z "$PLIST_PATH" ]; then
      if [ -f "${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist" ]; then
        PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
      elif [ -f "/Library/LaunchAgents/${PLIST_LABEL}.plist" ]; then
        PLIST_PATH="/Library/LaunchAgents/${PLIST_LABEL}.plist"
      fi
    fi

    log_info "注销并卸载 macOS LaunchAgent 服务..."
    if [ -n "$PLIST_PATH" ] && [ -f "$PLIST_PATH" ]; then
      launchctl unload -w "${PLIST_PATH}" 2>/dev/null || true
      rm -f "${PLIST_PATH}"
      log_success "已注销并移除 LaunchAgent 属性文件: ${PLIST_PATH}"
    else
      launchctl stop "${PLIST_LABEL}" 2>/dev/null || true
    fi

    # 兜底终止后台 node 实例
    pkill -f "dist/server/index.js" 2>/dev/null || true
    log_success "macOS LaunchAgent 服务及开机自启项已成功卸载"
    ;;

  # ----------------- Linux systemd -----------------
  systemd)
    if command -v systemctl >/dev/null 2>&1; then
      log_info "停止并禁用 Linux Systemd 服务: ${SERVICE_NAME}..."
      sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || systemctl --user stop "${SERVICE_NAME}" 2>/dev/null || true
      sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || systemctl --user disable "${SERVICE_NAME}" 2>/dev/null || true

      if [ -f "/etc/systemd/system/${SERVICE_NAME}" ]; then
        sudo rm -f "/etc/systemd/system/${SERVICE_NAME}"
        sudo systemctl daemon-reload 2>/dev/null || true
      fi
      if [ -f "${HOME}/.config/systemd/user/${SERVICE_NAME}" ]; then
        rm -f "${HOME}/.config/systemd/user/${SERVICE_NAME}"
        systemctl --user daemon-reload 2>/dev/null || true
      fi
      log_success "Linux Systemd 系统服务及开机自启项已成功卸载"
    fi
    ;;

  # ----------------- Windows 任务计划程序 (task) -----------------
  task)
    log_info "停止并注销 Windows 任务计划程序: ${TASK_NAME}..."
    schtasks //End //TN "${TASK_NAME}" 2>/dev/null || true
    schtasks //Delete //TN "${TASK_NAME}" //F 2>/dev/null || true
    # 精准终止 LightDrop node 进程，避免误杀其它 node 应用
    if command -v powershell >/dev/null 2>&1; then
      powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" -ErrorAction SilentlyContinue | Where-Object { \$_.CommandLine -like '*dist*server*index.js*' -or \$_.CommandLine -like '*${APP_DIR}*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>/dev/null || true
    fi
    log_success "Windows 任务计划程序服务及自启动项已注销"
    ;;

  # ----------------- Windows 开机自启文件夹 (startup) -----------------
  startup)
    log_info "清理 Windows 开机自启动文件夹启动项..."
    STARTUP_VBS="${APPDATA}/Microsoft/Windows/Start Menu/Programs/Startup/LightDrop.vbs"
    if [ -f "${STARTUP_VBS}" ]; then
      rm -f "${STARTUP_VBS}"
      log_success "已移除开机自启动文件: ${STARTUP_VBS}"
    fi
    if command -v powershell >/dev/null 2>&1; then
      powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" -ErrorAction SilentlyContinue | Where-Object { \$_.CommandLine -like '*dist*server*index.js*' -or \$_.CommandLine -like '*${APP_DIR}*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>/dev/null || true
    fi
    log_success "Windows 启动项已成功清理"
    ;;

  # ----------------- Docker -----------------
  docker)
    if command -v docker >/dev/null 2>&1; then
      if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Eq "^${CONTAINER_NAME}\$"; then
        log_info "正在停止 Docker 容器: ${CONTAINER_NAME}..."
        docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        log_info "正在删除 Docker 容器: ${CONTAINER_NAME}..."
        docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        log_success "Docker 容器 ${CONTAINER_NAME} 已成功移除 (包含自启策略)"
      fi
    fi
    ;;

  # ----------------- PM2 -----------------
  pm2)
    if command -v pm2 >/dev/null 2>&1; then
      log_info "停止并删除 PM2 应用: ${PM2_NAME}..."
      pm2 delete "${PM2_NAME}" >/dev/null 2>&1 || true
      pm2 save >/dev/null 2>&1 || true
      log_success "PM2 任务已注销"
    fi
    ;;

  # ----------------- Standalone -----------------
  standalone)
    TARGET_PID=""
    if [ -f "${PID_FILE}" ]; then
      TARGET_PID=$(cat "${PID_FILE}" 2>/dev/null || true)
    elif [ -n "$APP_PID" ] && [ "$APP_PID" -gt 0 ] 2>/dev/null; then
      TARGET_PID="$APP_PID"
    fi

    if [ -n "$TARGET_PID" ] && kill -0 "$TARGET_PID" 2>/dev/null; then
      log_info "正在终止后台常驻进程 (PID: ${TARGET_PID})..."
      kill -15 "$TARGET_PID" 2>/dev/null || true
      sleep 1
      if kill -0 "$TARGET_PID" 2>/dev/null; then
        kill -9 "$TARGET_PID" 2>/dev/null || true
      fi
      log_success "后台进程 (PID: ${TARGET_PID}) 已成功终止"
    fi
    pkill -f "${APP_DIR}/dist/server/index.js" 2>/dev/null || true
    rm -f "${PID_FILE}" 2>/dev/null || true
    ;;

  *)
    log_info "跳过专用服务停止阶段"
    ;;
esac

# ----------------- 步骤 4: 清理工作路径资产 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "4/4" "Cleaning up working directory files..."
else
  log_step "4/4" "清理工作路径与部署文件..."
fi

if [ "$DELETE_DATA" = true ]; then
  if [ -d "${DATA_DIR}" ] && ! is_dangerous_dir "${DATA_DIR}"; then
    log_info "移除数据存储目录: ${DATA_DIR}..."
    rm -rf "${DATA_DIR}"
  fi

  if [ -d "${WORK_DIR}" ] && ! is_dangerous_dir "${WORK_DIR}"; then
    log_info "移除完整工作路径: ${WORK_DIR}..."
    rm -rf "${WORK_DIR}"
    log_success "工作路径及所有上传文件已彻底清除"
  fi
else
  log_info "安全保留数据目录: ${DATA_DIR}"

  for sub in "app" "runinfo" "logs" "bin"; do
    if [ -d "${WORK_DIR}/${sub}" ]; then
      rm -rf "${WORK_DIR:?}/${sub}"
    fi
  done
  rm -f "${WORK_DIR}/lightdrop.config.json" "${WORK_DIR}/app.log" 2>/dev/null || true

  log_success "服务运行程序、日志与配置已清理完毕"
fi

# ----------------- 优雅最终状态信息 -----------------
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
if [ "$LANG_OPT" = "en" ]; then
  echo -e " ${BOLD}${GREEN}✔ LIGHTDROP UNINSTALLED SUCCESSFULLY FROM ${OS_PRETTY}${RESET}"
else
  echo -e " ${BOLD}${GREEN}✔ LightDrop 服务已从 ${OS_PRETTY} 完整卸载${RESET}"
fi
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"

print_card_row "操作系统" "${OS_PRETTY}"
print_card_row "服务状态" "${RED}○ 已停止并注销 (Stopped & Deregistered)${RESET}"
print_card_row "自启动项" "${RED}○ 已注销清理 (Autostart Removed)${RESET}"
print_card_row "工作路径" "${WORK_DIR}"

if [ "$DELETE_DATA" = true ]; then
  print_card_row "数据处理结果" "${RED}已彻底清空 (Purged)${RESET}"
else
  print_card_row "数据处理结果" "${GREEN}已完整安全保留 (Preserved)${RESET}"
  echo -e "\n  ${CYAN}ℹ 提示: 用户上传的文件与数据已保留在:${RESET}"
  echo -e "    ${BOLD}${DATA_DIR}${RESET}"
  echo -e "    ${DIM}后续若重新部署，直接指定此数据目录即可快速恢复历史文件。${RESET}"
fi

echo ""
