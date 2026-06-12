# Claude Session Recorder Plugin - 开发者文档

本文档面向开发者，介绍如何在本地开发、测试和发布此插件。

## 目录

- [项目结构](#项目结构)
- [开发环境设置](#开发环境设置)
- [运行脚本与验证输出](#运行脚本与验证输出)
- [测试](#测试)
- [发布到 npm](#发布到-npm)

---

## 项目结构

```
claude-session-recorder/
├── src/
│   └── summarize.ts          # 核心源码：JSONL 解析、摘要生成、CLI 入口
├── dist/                      # 编译输出目录 (npm 发布)
│   ├── summarize.js          # 编译后的可执行脚本
│   └── summarize.d.ts        # TypeScript 类型声明
├── hooks/
│   └── hooks.json            # Claude Code 插件 Hook 配置
├── skills/
│   └── summarize-session/
│       └── skill.md          # Slash command 技能定义
├── tests/
│   ├── summarize.test.ts     # 单元测试
│   ├── integration.test.ts   # 集成测试
│   └── fixtures/             # 测试数据
│       ├── normal-session.jsonl
│       ├── invalid-lines.jsonl
│       ├── empty-session.jsonl
│       └── heavy-tools.jsonl
├── conversations/             # 默认输出目录 (生成的摘要存放于此)
├── docs/                      # 项目文档
├── package.json              # npm 包配置
├── tsconfig.json             # TypeScript 配置
├── tsup.config.ts            # tsup 打包配置
├── vitest.config.ts          # Vitest 测试配置
├── README.md                 # 用户文档
├── LICENSE                   # MIT 许可证
└── Dev-README.md             # 本文档
```

### 核心文件说明

| 文件 | 作用 |
|------|------|
| `src/summarize.ts` | 主入口文件，包含 JSONL 解析、对话提取、摘要生成、CLI 和 Hook 双模式 |
| `hooks/hooks.json` | 定义 `SessionEnd` Hook，在会话结束时自动调用脚本 |
| `skills/summarize-session/skill.md` | 定义 `/summarize-session` slash command |
| `dist/summarize.js` | 编译产物，作为 CLI 可执行文件 |

---

## 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
git clone https://github.com/<user>/claude-session-recorder
cd claude-session-recorder
npm install
```

### 构建项目

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

---

## 运行脚本与验证输出

### 方式一：CLI 模式（手动调用）

脚本支持通过命令行参数指定输入文件：

```bash
# 使用测试 fixture 运行
node dist/summarize.js --file tests/fixtures/normal-session.jsonl

# 指定自定义输出目录
node dist/summarize.js --file tests/fixtures/normal-session.jsonl --output .tmp/test-output

# 也支持位置参数
node dist/summarize.js tests/fixtures/normal-session.jsonl
```

**验证输出：**

运行后会在 `conversations/` 或指定的输出目录生成一个 Markdown 文件：

```bash
# 查看生成的摘要
cat conversations/*.md

# 或查看自定义输出目录
ls .tmp/test-output/
cat .tmp/test-output/*.md
```

示例输出内容：

```markdown
# Help me create a simple HTTP server in Node.js

**Session ID:** `normal-session`
**Created:** 2026-06-11 10:00:00

---

## User Requests

- Help me create a simple HTTP server in Node.js
- Run the server

## Tools Used

- **Write**: /project/server.js: 150 chars
- **Bash**: node /project/server.js

## Files Modified

- `/project/server.js`

## Commands Run

- `node /project/server.js`
```

### 方式二：Hook 模式（模拟 SessionEnd Hook）

Hook 模式通过 stdin 接收 JSON 数据：

```bash
# 模拟 Hook 调用
echo '{
  "transcript_path": "tests/fixtures/normal-session.jsonl",
  "cwd": ".tmp/hook-test",
  "session_id": "test-session-123"
}' | node dist/summarize.js
```

**验证输出：**

```bash
ls .tmp/hook-test/conversations/
cat .tmp/hook-test/conversations/*.md
```

### 方式三：本地插件测试

在 Claude Code 中加载本地插件进行实际测试：

```bash
# 在项目根目录执行
claude plugin add $(pwd)
```

然后进行一段对话，退出 Claude Code 后检查 `conversations/` 目录是否生成了摘要文件。

卸载插件：

```bash
claude plugin remove claude-session-recorder-plugin
```

---

## 测试

### 运行所有测试

```bash
npm test
```

### 运行测试（监视模式）

```bash
npm run test:watch
```

### 类型检查

```bash
npm run typecheck
```

### 测试覆盖说明

测试文件位于 `tests/` 目录：

- `summarize.test.ts` - 单元测试，覆盖：
  - `parseJsonl()` - JSONL 文件解析
  - `summarizeToolInput()` - 工具调用摘要生成
  - `extractConversation()` - 对话内容提取、标签过滤

- `integration.test.ts` - 集成测试，验证端到端摘要生成

---

## 发布到 npm

### 1. 准备工作

确保已登录 npm 账户：

```bash
npm login
```

### 2. 更新版本号

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 小版本 (1.0.0 -> 1.1.0)
npm version minor

# 大版本 (1.0.0 -> 2.0.0)
npm version major
```

### 3. 构建与发布

```bash
# 构建项目
npm run build

# 发布到 npm
npm publish
```

`prepublishOnly` 脚本会在发布前自动执行 `npm run build`。

### 4. 验证发布

```bash
# 查看已发布的包信息
npm info claude-session-recorder-plugin

# 全局安装测试
npm install -g claude-session-recorder-plugin
```

### 发布检查清单

- [ ] 所有测试通过 (`npm test`)
- [ ] 类型检查通过 (`npm run typecheck`)
- [ ] 构建成功 (`npm run build`)
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新（如有）
- [ ] README.md 文档是最新的

---

## package.json 关键配置说明

```json
{
  "name": "claude-session-recorder-plugin",
  "bin": {
    "claude-session-recorder": "./dist/summarize.js"
  },
  "files": [
    "dist",
    "skills",
    "hooks",
    "README.md",
    "LICENSE"
  ]
}
```

- `bin` - 定义可执行命令，安装后可通过 `npx claude-session-recorder` 运行
- `files` - 指定发布到 npm 的文件，避免打包不必要的文件

---

## 常见问题

### Q: 修改代码后测试没有更新？

确保重新构建：

```bash
npm run build && npm test
```

### Q: Hook 没有触发？

检查 `hooks/hooks.json` 中的路径是否正确指向 `dist/summarize.js`。

### Q: 如何调试 Hook？

使用 `console.error()` 输出调试信息到 stderr，不会影响 Hook 的正常输出。

---

## 相关链接

- [Claude Code 插件开发文档](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [npm 发布指南](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
