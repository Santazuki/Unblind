开发的标准流程：**开发目录（Git 仓库）与运行时目录（Claude Code 配置目录）分离**。

## 一、推荐的工作流程

### 1. 目录结构

text

```
~/projects/unblind/              # 开发目录（Git 仓库）
├── SKILL.md
├── scripts/
├── install.sh
└── ...

~/.claude/skills/unblind/        # 运行时目录（Claude Code 实际加载）
├── SKILL.md
├── scripts/
└── ...（从开发目录复制或链接而来）
```



### 2. 开发 → 测试 → 提交流程

text

```
开发目录修改代码
       ↓
   （复制或同步）
       ↓
 运行时目录（~/.claude/skills/unblind/）
       ↓
   在 Claude Code 中测试
       ↓
     通过？
       ↓ 是
   git commit & push
```



## 二、三种同步方式（推荐按场景选择）

| 方式                     | 命令                                                   | 适合场景           |
| :----------------------- | :----------------------------------------------------- | :----------------- |
| **符号链接（最推荐）**   | `ln -s ~/projects/unblind ~/.claude/skills/unblind`    | 频繁迭代，实时生效 |
| **安装脚本（本地模式）** | `./install.sh --local ~/projects/unblind`              | 需要复杂部署逻辑   |
| **手动复制**             | `cp -r ~/projects/unblind/* ~/.claude/skills/unblind/` | 偶尔测试，不想污染 |

**符号链接的好处**：你修改开发目录的任意文件，Claude Code 立刻能用到最新版本，无需手动拷贝。

## 三、注意事项

### ✅ 应该提交到 GitHub 的

- 开发目录下的所有源代码、文档、示例配置
- 安装脚本

### ❌ 绝不提交的

- 运行时目录下的 `settings.json`（含真实 API Key）
- 日志、缓存、临时文件
- Claude Code 的全局配置（`~/.claude/settings.json`）

### 🔧 测试时如何配置 API Key？

在 `~/.claude/skills/unblind/settings.json` 中填写真实 Key。这个文件**不会**出现在开发目录中，所以不会被误提交。

### 📝 推荐的 `.gitignore` 内容

text

```
# 本地运行时目录（防止误操作）
.claude/
settings.json
*.log
node_modules/
cache/
```



## 四、总结

你设想的流程完全可行且专业。核心原则就两条：

1. **开发目录与运行时目录分离** —— 保证 Git 仓库干净，不含个人配置。
2. **用符号链接或安装脚本同步** —— 省去反复拷贝的麻烦。

这样一来，你的 GitHub 仓库就是一个纯净的“源代码分发版”，任何人都可以 clone 后运行 `./install.sh` 完成部署。同时你自己也能高效迭代。