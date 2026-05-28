## 一、unblind 项目本身组织结构

### 推荐：GitHub 仓库的根目录结构

text

```
unblind/                     # 仓库根目录
├── SKILL.md                 # 技能主入口（必需）
├── CLAUDE.md                # 项目长期记忆（可选，用于记录架构原则）
├── README.md                # 给人类看的说明文档
├── LICENSE                  # 开源协议
├── install.sh               # 一键安装脚本（或 npm 包配置）
├── scripts/
│   ├── imageProcessor.js
│   ├── providers/
│   │   ├── mimoprovider.js
│   │   └── ...
│   ├── cache.js
│   └── install.js
├── templates/
│   ├── chain_of_thought.md
│   └── output_formats/
├── resources/
│   └── best_practices.md
├── tests/
│   └── sample_images/
└── .github/                 # CI/CD 配置
    └── workflows/
```



**核心变化**：不再有 `.claude/skills/unblind/` 这一层前缀。因为用户克隆仓库后，需要通过安装脚本把内容**复制或链接**到 `.claude/skills/unblind/` 下，而不是直接原地使用。

### 为什么 SKILL.md 必须放在根目录？

Claude Code 在加载技能时，会到技能目录下**直接查找 `SKILL.md`**，不会递归进子目录。所以你的仓库根目录必须有 `SKILL.md`。

### 那 CLAUDE.md 放在哪里？

`CLAUDE.md` 是**项目级**的全局指令文件，通常放在**仓库根目录**。对于 unblind 这个 Skill 项目本身，如果你希望 Claude（在帮你开发这个 Skill 时）遵循某些架构原则，可以放一个 `CLAUDE.md`。如果你不需要，也可以不放。**这不是 Skill 运行所必需的**。

------

## 二、哪一部分要传 GitHub？

**整个仓库（除了敏感信息）都要传**，但有一些注意事项：

### ✅ 必须上传的内容

- 所有源代码（`scripts/`, `templates/`, `resources/`）
- `SKILL.md`
- `README.md`、`LICENSE`
- 安装脚本（`install.sh` 或 `install.js`）
- 测试用例（`tests/`，可选但推荐）

### ❌ 绝对不能上传的内容

- **任何包含真实 API Key 的文件**（如 `settings.json` 或 `.env`）
- **用户本地缓存**（如 `cache/` 目录）
- **日志文件**（`*.log`）
- **依赖目录**（`node_modules/`）—— 应在 `README` 中说明用户自行 `npm install`
- **IDE 配置**（如 `.vscode/`，除非是通用配置）

### 🔐 推荐做法：提供示例配置文件

在仓库中放一个 `settings.example.json`：

json

```
{
  "providers": {
    "mimo": {
      "apiKey": "YOUR_API_KEY_HERE",
      "apiUrl": "https://api.mimo.dev/v1/chat/completions"
    }
  }
}
```



然后在 `README` 中说明：复制为 `~/.claude/skills/unblind/settings.json` 并填入真实 Key。

------

## 总结对照表

| 内容                         | 是否传 GitHub | 说明                       |
| :--------------------------- | :------------ | :------------------------- |
| `SKILL.md`                   | ✅ 是          | 技能入口，必须             |
| `CLAUDE.md`                  | 可选          | 仅用于指导 AI 开发本 Skill |
| 源代码（`scripts/`）         | ✅ 是          | 核心逻辑                   |
| 模板/资源                    | ✅ 是          | 辅助文件                   |
| 示例配置（`*.example.json`） | ✅ 是          | 方便用户                   |
| 真实配置文件（含 API Key）   | ❌ 否          | **绝对不要提交**           |
| 测试图片（非敏感）           | ✅ 可以        | 推荐放几张示例             |
| 用户缓存、日志               | ❌ 否          | 应被 `.gitignore` 忽略     |
| `node_modules/`              | ❌ 否          | 由用户安装                 |

你的 GitHub 仓库就是 **源分发形态**，用户拿到后运行 `./install.sh` 就会自动部署到正确的技能目录。这样既清晰又符合生态惯例。