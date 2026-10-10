#!/usr/bin/env bash
# ==============================================================================
# LightDrop 卸载脚本 (Uninstall Script)
# 支持：
# 1. 默认采用工作路径 /var/lib/lightdrop，支持命令行指定其他工作路径
# 2. 读取 <工作路径>/runinfo 目录下的 .json 文件获取运行方式，并基于其准确卸载
# 3. 提供是否删除上传的文件等内容选项 (保留数据 or 彻底清除)
# 4. 删除对应工作路径内容
# 5. 优雅打印过程及最终状态信息
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
LANG_OPT="" # 优先从 runinfo.json 读取，否则默认 zh
DELETE_DATA="" # true: 彻底删除数据 | false: 保留数据 | "": 待交互确认
AUTO_YES=false
FORCE=false

# ----------------- 帮助信息 -----------------
show_help() {
  cat <<EOF
LightDrop 卸载工具 (Uninstall Script)

用法:
  ./uninstall.sh [选项]

选项:
  -w, --workdir <路径>    指定工作路径 (默认: ${DEFAULT_WORK_DIR})
  --delete-data           【彻底删除】上传的文件、记录与历史数据
  --keep-data             【安全保留】上传的文件与数据，仅卸载服务并清理程序文件
  -l, --lang <zh|en>      指定界面语言 (默认优先读取安装记录，或默认为 zh)
  -y, --yes               非交互确认模式 (默认保留数据，除非配合 --delete-data)
  -f, --force             强制清理模式 (忽略中间停止错误)
  -h, --help              显示此帮助信息

示例:
  ./uninstall.sh                                # 默认从 /var/lib/lightdrop 卸载 (交互确认是否删数据)
  ./uninstall.sh -w /var/lib/lightdrop          # 指定工作路径卸载
  ./uninstall.sh --delete-data -y               # 一键彻底静默卸载并清理全部上传数据
  ./uninstall.sh --keep-data                    # 卸载服务但保留上传文件
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
  log_error "安全拦截: 指定的工作路径 [${WORK_DIR}] 为系统关键目录，拒绝执行卸载操作！"
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
    # 查找任意一个 .json 文件
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
PID_FILE="${RUNINFO_DIR}/lightdrop.pid"
APP_PID=""
RECORDED_DATA_DIR="${WORK_DIR}/data"
RECORDED_LANG="zh"

if [ -n "$RUNINFO_JSON" ] && [ -f "$RUNINFO_JSON" ]; then
  DEPLOY_MODE=$(json_read "$RUNINFO_JSON" "deployMode")
  [ -z "$DEPLOY_MODE" ] && DEPLOY_MODE=$(json_read "$RUNINFO_JSON" "mode")
  
  c_name=$(json_read "$RUNINFO_JSON" "containerName")
  [ -n "$c_name" ] && CONTAINER_NAME="$c_name"

  s_name=$(json_read "$RUNINFO_JSON" "serviceName")
  [ -n "$s_name" ] && SERVICE_NAME="$s_name"

  p_name=$(json_read "$RUNINFO_JSON" "pm2Name")
  [ -n "$p_name" ] && PM2_NAME="$p_name"

  p_file=$(json_read "$RUNINFO_JSON" "pidFile")
  [ -n "$p_file" ] && PID_FILE="$p_file"

  p_id=$(json_read "$RUNINFO_JSON" "pid")
  [ -n "$p_id" ] && APP_PID="$p_id"

  d_dir=$(json_read "$RUNINFO_JSON" "dataDir")
  [ -n "$d_dir" ] && RECORDED_DATA_DIR="$d_dir"

  r_lang=$(json_read "$RUNINFO_JSON" "language")
  [ -n "$r_lang" ] && RECORDED_LANG="$r_lang"
fi

# 语言判定
if [ -z "$LANG_OPT" ]; then
  LANG_OPT="${RECORDED_LANG:-zh}"
fi

DATA_DIR="${RECORDED_DATA_DIR}"

# 打印横幅
echo ""
if [ "$LANG_OPT" = "en" ]; then
  print_banner "LightDrop Uninstallation Engine" "Target WorkDir: ${WORK_DIR}"
else
  print_banner "LightDrop 卸载与清理引擎" "目标工作路径: ${WORK_DIR}"
fi

# ----------------- 步骤 1: 审查运行记录与模式分析 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "1/4" "Inspecting deployment metadata from runinfo..."
else
  log_step "1/4" "读取 runinfo 运行记录并判定部署方式..."
fi

if [ -n "$RUNINFO_JSON" ]; then
  log_success "找到运行信息记录文件: ${RUNINFO_JSON}"
  log_info "记录中的部署模式: ${CYAN}${DEPLOY_MODE:-未明确标注}${RESET}"
  log_info "记录中的数据目录: ${DATA_DIR}"
else
  log_warn "未在 ${RUNINFO_DIR} 中检测到运行记录 JSON 文件，进入自动环境嗅探..."
  # 自动嗅探模式
  if command -v docker >/dev/null 2>&1 && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Eq "^${CONTAINER_NAME}\$"; then
    DEPLOY_MODE="docker"
    log_info "嗅探到正在运行的 Docker 容器: ${CONTAINER_NAME}"
  elif [ -f "${PID_FILE}" ]; then
    DEPLOY_MODE="standalone"
    log_info "嗅探到 PID 记录文件: ${PID_FILE}"
  elif command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q "\"${PM2_NAME}\""; then
    DEPLOY_MODE="pm2"
    log_info "嗅探到 PM2 进程任务: ${PM2_NAME}"
  else
    DEPLOY_MODE="standalone"
    log_info "未嗅探到活动服务，将按标准目录执行清理"
  fi
fi

# ----------------- 步骤 2: 确认数据保留/删除决策 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "2/4" "Confirming data retention policy..."
else
  log_step "2/4" "确认数据保留与清理决策..."
fi

if [ -z "$DELETE_DATA" ]; then
  if [ "$AUTO_YES" = true ]; then
    # 自动化模式下出于数据安全默认保留
    DELETE_DATA=false
    log_info "非交互模式 (-y): 出于安全防护，默认保留已上传的数据文件"
  elif [ -t 0 ]; then
    # 交互模式弹窗询问
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

# ----------------- 步骤 3: 停止并清理运行服务 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "3/4" "Stopping and removing active LightDrop service [${DEPLOY_MODE}]..."
else
  log_step "3/4" "停止并注销正在运行的 LightDrop 服务 [${DEPLOY_MODE}]..."
fi

case "$DEPLOY_MODE" in
  docker)
    if command -v docker >/dev/null 2>&1; then
      if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Eq "^${CONTAINER_NAME}\$"; then
        log_info "正在停止 Docker 容器: ${CONTAINER_NAME}..."
        docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        log_info "正在删除 Docker 容器: ${CONTAINER_NAME}..."
        docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        log_success "Docker 容器 ${CONTAINER_NAME} 已成功停止并清理"
      else
        log_info "未检测到活动的 Docker 容器: ${CONTAINER_NAME}"
      fi
    else
      log_warn "未找到 docker 命令，跳过容器停止"
    fi
    ;;

  systemd)
    if command -v systemctl >/dev/null 2>&1; then
      log_info "停止并注销 Systemd 服务: ${SERVICE_NAME}..."
      sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
      sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
      if [ -f "/etc/systemd/system/${SERVICE_NAME}" ]; then
        sudo rm -f "/etc/systemd/system/${SERVICE_NAME}"
        sudo systemctl daemon-reload 2>/dev/null || true
      fi
      log_success "Systemd 服务已成功卸载"
    fi
    ;;

  pm2)
    if command -v pm2 >/dev/null 2>&1; then
      log_info "停止并删除 PM2 应用: ${PM2_NAME}..."
      pm2 delete "${PM2_NAME}" >/dev/null 2>&1 || true
      pm2 save >/dev/null 2>&1 || true
      log_success "PM2 任务已注销"
    fi
    ;;

  standalone)
    TARGET_PID=""
    if [ -f "${PID_FILE}" ]; then
      TARGET_PID=$(cat "${PID_FILE}" 2>/dev/null || true)
    elif [ -n "$APP_PID" ] && [ "$APP_PID" -gt 0 ] 2>/dev/null; then
      TARGET_PID="$APP_PID"
    fi

    if [ -n "$TARGET_PID" ] && kill -0 "$TARGET_PID" 2>/dev/null; then
      log_info "正在终止后台进程 (PID: ${TARGET_PID})..."
      kill -15 "$TARGET_PID" 2>/dev/null || true
      sleep 1
      if kill -0 "$TARGET_PID" 2>/dev/null; then
        kill -9 "$TARGET_PID" 2>/dev/null || true
      fi
      log_success "进程 (PID: ${TARGET_PID}) 已终止"
    else
      log_info "未发现存活的后台进程"
    fi
    rm -f "${PID_FILE}" 2>/dev/null || true
    ;;

  *)
    log_info "未知或跳过服务停止阶段"
    ;;
esac

# ----------------- 步骤 4: 清理工作路径内容 -----------------
if [ "$LANG_OPT" = "en" ]; then
  log_step "4/4" "Cleaning up working directory assets..."
else
  log_step "4/4" "清理工作路径与部署文件..."
fi

if [ "$DELETE_DATA" = true ]; then
  # 彻底删除：先删数据，再删整个工作路径
  if [ -d "${DATA_DIR}" ] && ! is_dangerous_dir "${DATA_DIR}"; then
    log_info "清理数据目录: ${DATA_DIR}..."
    rm -rf "${DATA_DIR}"
  fi

  if [ -d "${WORK_DIR}" ] && ! is_dangerous_dir "${WORK_DIR}"; then
    log_info "彻底移除工作路径: ${WORK_DIR}..."
    rm -rf "${WORK_DIR}"
    log_success "工作路径及所有上传文件已彻底清除"
  fi
else
  # 保留数据：只删除 app, runinfo, logs, bin 等运行代码与配置
  log_info "保留数据目录: ${DATA_DIR}"

  for sub in "app" "runinfo" "logs" "bin"; do
    if [ -d "${WORK_DIR}/${sub}" ]; then
      rm -rf "${WORK_DIR}/${sub}"
    fi
  done
  rm -f "${WORK_DIR}/lightdrop.config.json" "${WORK_DIR}/app.log" 2>/dev/null || true

  log_success "服务程序文件与运行配置已清理完毕"
fi

# ----------------- 优雅最终状态信息 -----------------
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
if [ "$LANG_OPT" = "en" ]; then
  echo -e " ${BOLD}${GREEN}✔ LIGHTDROP UNINSTALLED SUCCESSFULLY${RESET}"
else
  echo -e " ${BOLD}${GREEN}✔ LightDrop 卸载作业全部完成${RESET}"
fi
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"

print_card_row "卸载对象" "LightDrop 服务实例"
print_card_row "服务状态" "${RED}○ 已停止并移除 (Stopped & Removed)${RESET}"
print_card_row "工作路径" "${WORK_DIR}"

if [ "$DELETE_DATA" = true ]; then
  print_card_row "数据处理结果" "${RED}已彻底清空 (Purged)${RESET}"
else
  print_card_row "数据处理结果" "${GREEN}已完整安全保留 (Preserved)${RESET}"
  echo -e "\n  ${CYAN}ℹ 提示: 用户上传的文件与历史记录已保存在以下目录:${RESET}"
  echo -e "    ${BOLD}${DATA_DIR}${RESET}"
  echo -e "    ${DIM}如需重新安装部署，可直接指定该数据目录以无缝恢复历史数据。${RESET}"
fi

echo ""
