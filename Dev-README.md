# Claude Session Recorder Plugin - 开发者文档

本文档面向开发者，介绍如何在本地开发、测试和发布此插件。

## 目录

- [项目结构](#项目结构)
- [模块架构](#模块架构)
- [开发环境设置](#开发环境设置)
- [运行脚本与验证输出](#运行脚本与验证输出)
- [测试](#测试)
- [发布到 npm](#发布到-npm)

---

## 项目结构

```
claude-session-recorder/
├── src/
│   ├── summarize.ts          # 主入口：CLI/Hook 双模式、generateTranscriptLog、main()
│   ├── parser.ts             # JSONL 解析、日志条目提取、工具调用摘要
│   ├── formatter.ts          # Markdown 输出格式化、文件名生成、会话信息提取
│   ├── types.ts              # TypeScript 类型定义（JsonlEntry、LogEntry、SessionInfo）
│   └── utils.ts              # 工具函数（truncate、cleanXmlTags、时间格式化）
├── dist/                      # 编译输出目录 (npm 发布)
│   ├── summarize.js          # 编译后的可执行脚本 (ESM, 含 shebang)
│   ├── summarize.d.ts        # TypeScript 类型声明
│   └── summarize.js.map      # Source map
├── hooks/
│   └── hooks.json            # Claude Code 插件 Hook 配置
├── skills/
│   └── summarize-session/
│       └── skill.md          # Slash command 技能定义
├── tests/
│   ├── summarize.test.ts     # 主入口单元测试
│   ├── parser.test.ts        # 解析器单元测试
│   ├── formatter.test.ts     # 格式化器单元测试
│   ├── utils.test.ts         # 工具函数单元测试
│   ├── integration.test.ts   # 端到端集成测试
│   └── fixtures/             # 测试数据
│       ├── normal-session.jsonl
│       ├── invalid-lines.jsonl
│       ├── empty-session.jsonl
│       ├── heavy-tools.jsonl
│       ├── 7e146ba1-6c18-4afb-a4ef-e65a40c6b6f7.jsonl
│       └── conversations/    # 集成测试输出目录
├── conversations/             # 默认输出目录 (生成的转写记录存放于此)
├── package.json              # npm 包配置
├── tsconfig.json             # TypeScript 配置
├── tsup.config.ts            # tsup 打包配置
├── vitest.config.ts          # Vitest 测试配置
├── README.md                 # 用户文档
├── LICENSE                   # MIT 许可证
└── Dev-README.md             # 本文档
```

---

## 模块架构

源码按职责拆分为 5 个模块，依赖关系如下：

```
summarize.ts (主入口)
  ├── parser.ts    (JSONL 解析 + 日志条目提取)
  │     └── types.ts
  │     └── utils.ts
  ├── formatter.ts (Markdown 格式化 + 文件名生成)
  │     └── types.ts
  │     └── utils.ts
  ├── types.ts
  └── utils.ts
```

### 核心文件说明

| 文件 | 职责 | 主要导出 |
|------|------|----------|
| `src/types.ts` | 类型定义 | `JsonlEntry`, `ContentBlock`, `LogEntry`, `SessionInfo` |
| `src/utils.ts` | 通用工具函数 | `truncate()`, `cleanXmlTags()`, `formatTimestamp()`, `formatDate()`, `formatDateTime()` |
| `src/parser.ts` | 解析层 | `parseJsonl()`, `extractLogEntries()`, `summarizeToolInput()` |
| `src/formatter.ts` | 格式化层 | `formatTranscriptLog()`, `generateFilename()`, `extractSessionInfo()` |
| `src/summarize.ts` | 主入口 + CLI | `generateTranscriptLog()`, `main()`, 兼容导出 `generateSummary()`, `extractConversation()` |

### 数据流

```
JSONL 文件
  → parseJsonl()          解析为 JsonlEntry[]
  → extractLogEntries()   提取为 LogEntry[]（含 tool_result 关联）
  → extractSessionInfo()  提取会话元信息（标题、时间）
  → formatTranscriptLog() 生成 Markdown 内容
  → generateFilename()    生成文件名
  → 写入 .md 文件
```

### 兼容性

`summarize.ts` 保留了两项兼容导出，供旧代码或外部调用使用：

- `generateSummary(filepath, outputDir)` — 内部调用 `generateTranscriptLog()`
- `extractConversation(entries)` — 将 `LogEntry[]` 转换为旧 `ConversationTurn[]` 格式

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

构建产物将输出到 `dist/` 目录。tsup 配置为 ESM 格式，自动添加 shebang，生成 `.d.ts` 声明和 source map。

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

运行后会在 `conversations/` 或指定的输出目录生成一个 Markdown 文件，文件名格式为 `YYYY-MM-DD-标题.md`：

```bash
# 查看生成的转写记录
cat conversations/*.md

# 或查看自定义输出目录
ls .tmp/test-output/
cat .tmp/test-output/*.md
```

示例输出内容：

```markdown
# 2026-06-11 10:00:00-Help me create a simple HTTP server

## 基本信息

* session id：normal-session
* created：2026-06-11 10:00:00

### 对话记录

#### 用户

```
10:00:00 Help me create a simple HTTP server in Node.js
```

#### AI

10:01:00 [tool]:Write
```
 file: /project/server.js
```

#### AI

10:05:00 [答复]
```
I've created the server file. Now let's run it.
```
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

然后进行一段对话，退出 Claude Code 后检查 `conversations/` 目录是否生成了转写记录文件。

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

### 测试文件说明

| 文件 | 覆盖内容 |
|------|----------|
| `utils.test.ts` | `truncate()`, `cleanXmlTags()`, `formatTimestamp()`, `formatDate()`, `formatDateTime()` |
| `parser.test.ts` | `parseJsonl()`, `summarizeToolInput()`, `extractLogEntries()` |
| `formatter.test.ts` | `generateFilename()`, `extractSessionInfo()`, `formatTranscriptLog()` |
| `summarize.test.ts` | `generateTranscriptLog()`, 兼容函数 `generateSummary()`, `extractConversation()` |
| `integration.test.ts` | 端到端：JSONL 文件 → Markdown 输出 |

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
  "type": "module",
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

- `type: "module"` — 项目使用 ESM 模块系统
- `bin` — 定义可执行命令，安装后可通过 `npx claude-session-recorder` 运行
- `files` — 指定发布到 npm 的文件，避免打包不必要的文件

---

## 常见问题

### Q: 修改代码后测试没有更新？

测试直接引用 `src/` 下的 TypeScript 源码（Vitest 原生支持），无需手动构建即可运行测试。但如果要验证 CLI 运行效果，需重新构建：

```bash
npm run build && node dist/summarize.js --file tests/fixtures/normal-session.jsonl
```

### Q: Hook 没有触发？

检查 `hooks/hooks.json` 中的路径是否正确指向 `dist/summarize.js`。

### Q: 如何调试 Hook？

使用 `console.error()` 输出调试信息到 stderr，不会影响 Hook 的正常输出。

---

## 相关链接

- [Claude Code 插件开发文档](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [npm 发布指南](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
