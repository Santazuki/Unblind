#!/bin/bash
# Unblind — 一键安装脚本（仅部署运行时必要文件）
set -euo pipefail

SKILL_NAME="unblind"
SKILL_DIR="${HOME}/.claude/skills/${SKILL_NAME}"
AGENTS_DIR="${HOME}/.agents/skills/${SKILL_NAME}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

if [ -f "./SKILL.md" ]; then SOURCE_DIR="$(pwd)"; else
  echo -e "${RED}❌ 错误：未找到 SKILL.md。请在 unblind 仓库根目录运行此脚本。${NC}"
  exit 1; fi

deploy() {
  local dir="$1"
  mkdir -p "$dir"

  # 核心文件
  cp "$SOURCE_DIR/SKILL.md" "$dir/"
  cp "$SOURCE_DIR/README.md" "$dir/"

  # 脚本（仅 lib 模块 + CLI 入口，不含 install.js、占位文件）
  mkdir -p "$dir/scripts/lib/providers"
  cp "$SOURCE_DIR/scripts/unblind.mjs" "$dir/scripts/"
  cp "$SOURCE_DIR/scripts/lib/"*.js "$dir/scripts/lib/"
  cp "$SOURCE_DIR/scripts/lib/providers/"*.js "$dir/scripts/lib/providers/"

  # 清理旧版本残留
  rm -f "$dir/unblind.mjs" 2>/dev/null
  rm -f "$dir/scripts/install.js" 2>/dev/null
}

echo "📸 Unblind — 部署中..."
deploy "$SKILL_DIR"
deploy "$AGENTS_DIR"

if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  [ "$NODE_VERSION" -ge 18 ] && echo -e "${GREEN}✅ Node.js $(node --version)${NC}" || echo -e "${YELLOW}⚠️ Node.js $(node --version) < 18${NC}"
else
  echo -e "${RED}❌ 未检测到 Node.js >= 18${NC}"
fi

[ -f "${HOME}/.claude/settings.json" ] && echo -e "${GREEN}✅ settings.json${NC}" || echo -e "${YELLOW}⚠️ 首次使用时会自动引导配置${NC}"

echo -e "${GREEN}✅ Unblind 已部署${NC}"
echo "  Skill:  ${SKILL_DIR}"
echo "  Agents: ${AGENTS_DIR}"
