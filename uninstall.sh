#!/usr/bin/env bash
# EasyDrop 卸载命令入口
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/scripts/uninstall.sh" "$@"
