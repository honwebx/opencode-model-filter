# opencode-model-filter

OpenCode V2 插件：按免费/付费、最高单价、最小上下文和黑白名单过滤模型目录。

## 安装

```sh
opencode plugin add github:honwebx/opencode-model-filter
```

或写进 `opencode.json(c)`（启动时自动安装）：

```jsonc
{
  "plugins": [
    { "package": "github:honwebx/opencode-model-filter", "options": { "...": "见下" } }
  ]
}
```

## 配置

`options` 是 `provider id -> 规则` 的映射，`*` 为默认规则：

```jsonc
{
  "*": { "free": "include", "maxPrice": 5, "minContext": 200000 },
  "anthropic": { "include": ["claude-*-5"] },
  "openai": { "maxPrice": 10 }
}
```

### 规则字段

| 字段 | 说明 |
| --- | --- |
| `free` | `include` 保留免费、剔除非免费；`exclude` 反之。免费 = 所有档位四项单价全为 0；无价格数据不算 |
| `maxPrice` | 美元/百万 token，四项单价最高值超过即剔除 |
| `minContext` | 上下文 token 下限，小于即剔除 |
| `include` | glob 名单，命中的一律保留（最高优先级） |
| `exclude` | glob 名单，命中的一律剔除 |

优先级：`include` > `exclude` > `free` / `maxPrice` / `minContext`。glob 用 `*` 任意串、`?` 单字符。

### 白名单模式

只留指定模型：`include` 点名 + `exclude: ["*"]`

```jsonc
{ "*": { "include": ["claude-*", "gpt-*"], "exclude": ["*"] } }
```

### Provider 覆盖

`*` 为默认；具体 provider 的**非空**字段覆盖默认，空数组/未写则沿用 `*`。

## 注意

配置文件 `providers.<id>.models` 里自定义新增的模型不经过 transform，本插件过滤不到；要隐藏这类模型，在它的配置项里写 `"disabled": true`。

## 许可证

MIT
