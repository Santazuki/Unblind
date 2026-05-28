#!/bin/bash
# Unblind — 一键安装脚本
# 将仓库内容部署到 Claude Code 技能目录
set -euo pipefail

SKILL_NAME="unblind"
SKILL_DIR="${HOME}/.claude/skills/${SKILL_NAME}"
AGENTS_DIR="${HOME}/.agents/skills/${SKILL_NAME}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📸 Unblind — 视觉增强 Skill 安装脚本"
echo "=========================================="
echo ""

# 检测安装来源
if [ -f "./SKILL.md" ]; then
    SOURCE_DIR="$(pwd)"
else
    echo -e "${RED}❌ 错误：未找到 SKILL.md。请在 unblind 仓库根目录运行此脚本。${NC}"
    exit 1
fi

# 创建目标目录
echo "→ 创建目标目录..."
mkdir -p "$SKILL_DIR"
mkdir -p "$AGENTS_DIR"

# 复制文件到 .claude/skills/unblind/
echo "→ 部署到 ${SKILL_DIR} ..."
cp "$SOURCE_DIR/SKILL.md" "$SKILL_DIR/"
cp "$SOURCE_DIR/README.md" "$SKILL_DIR/"
cp -r "$SOURCE_DIR/scripts" "$SKILL_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/templates" "$SKILL_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/resources" "$SKILL_DIR/" 2>/dev/null || true

# 同步到 .agents/skills/unblind/（兼容其他 Agent）
echo "→ 同步到 ${AGENTS_DIR} ..."
cp "$SOURCE_DIR/SKILL.md" "$AGENTS_DIR/"
cp "$SOURCE_DIR/README.md" "$AGENTS_DIR/"
cp -r "$SOURCE_DIR/scripts" "$AGENTS_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/templates" "$AGENTS_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/resources" "$AGENTS_DIR/" 2>/dev/null || true

# 检测 Node.js
echo ""
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js $(node --version) 已就绪${NC}"
    else
        echo -e "${YELLOW}⚠️  Node.js $(node --version) 版本过低，需要 >= 18${NC}"
    fi
else
    echo -e "${RED}❌ 未检测到 Node.js。请安装 Node.js >= 18${NC}"
fi

# 检测现有配置
SETTINGS_FILE="${HOME}/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    echo -e "${GREEN}✅ 检测到 ${SETTINGS_FILE}${NC}"
else
    echo -e "${YELLOW}⚠️  未检测到 settings.json。首次使用时会自动引导配置。${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ Unblind 安装完成！"
echo "=========================================="
echo ""
echo "下一步：向 Claude Code 发送任意图片，首次运行将自动引导配置 Mimo API Key。"
echo ""
echo "手动配置 API Key："
echo "  1. 获取 Mimo Token Plan Key: https://token-plan-cn.xiaomimimo.com"
echo "  2. 运行: node -e \"const fs=require('fs');const s=JSON.parse(fs.readFileSync('${HOME}/.claude/settings.json','utf8'));s.env.MIMO_API_KEY='YOUR_KEY';fs.writeFileSync('${HOME}/.claude/settings.json',JSON.stringify(s,null,2)+'\n')\""
echo ""
echo "更多信息: ${SKILL_DIR}/README.md${NC}"
