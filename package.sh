#!/usr/bin/env bash
# EasyDrop 打包命令入口
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/scripts/package.sh" "$@"
