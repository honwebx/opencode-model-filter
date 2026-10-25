# OpenCode 模型过滤

> [English](README.en.md) | 中文

OpenCode 模型过滤插件：按免费/付费、最高单价、最小上下文和黑白名单过滤 OpenCode 内置大模型。

## 安装

```sh
opencode plugin add github:honwebx/opencode-model-filter
```

也可以直接在 `opencode.json(c)` 中配置，OpenCode 启动时会自动安装：

```jsonc
{
  "plugins": [
    {
      "package": "github:honwebx/opencode-model-filter",
      "options": { "*": { "free": "include" } }
    }
  ]
}
```

安装好以后重启 OpenCode：

```sh
opencode service restart
```

## 配置

插件的 `options` 按模型供应商（Provider）来写：每个 Provider 一份规则，支持 `*` 通配所有 Provider，Provider 自己的规则优先。

```jsonc
{
  "*": { "free": "include", "minContext": 200000 },
  "alibaba": { "include": ["qwen3.8-*"] }
}
```

### 规则字段

| 字段 | 作用 |
| --- | --- |
| `free` | `include` 保留免费模型，过滤付费模型；<br />`exclude` 保留付费模型，过滤免费模型；<br />输入、输出、缓存读、缓存写四项单价都是 0 才为免费模型，没有价格数据的模型不算免费。 |
| `maxPrice` | 价格上限，单位美元 / 百万 token。取模型四个单价里最高的那个，超过就排除。 |
| `minContext` | 上下文窗口下限（token）。小于这个值的模型会被排除。 |
| `exclude` | 黑名单，命中的模型排除。 |
| `include` | 白名单，命中的模型强制保留，优先级最高。 |

字段优先级是：`include` > `exclude` > `free` / `maxPrice` / `minContext`。名单匹配用 glob，`*` 代表任意字符串，`?` 代表单个字符。

### 示例

**只要免费模型**

```jsonc
{ "*": { "free": "include" } }
```

非免费的全部隐藏。

**只要付费模型**

```jsonc
{ "*": { "free": "exclude" } }
```

反着用，把免费的隐藏掉，适合只关心商用模型的场景。

**价格上限**

```jsonc
{ "*": { "maxPrice": 5 } }
```

四项单价里最高的一项超过 5 美元 / 百万 token 就排除。

**上下文下限**

```jsonc
{ "*": { "minContext": 200000 } }
```

上下文窗口不足 20 万 token 的排除，只留长上下文模型。

**白名单：只留指定模型**

```jsonc
{
	"*": {
		"include": ["deepseek-*", "glm-*"],
		"exclude": ["*"]
	}
}
```

注意：`exclude: ["*"]` 不能省。单写 `include` 只是额外点名保留，不会排除其余模型。

**黑名单：去掉指定模型**

```jsonc
{ "*": { "exclude": ["*-legacy", "gpt-*"] } }
```

点名的排除，其余照常显示。

**组合：免费 + 长上下文 + 指定模型**

```jsonc
{ 
	"*": {
		"free": "include",
		"minContext": 128000,
		"include": ["deepSeek-v4.1-flash"]
	}
}
```

保留免费模型、上下文超过128K的模型、deepSeek-v4.1-flash。

**Provider 优先**

```jsonc
{
  "*": { "free": "include" },
  "opencode-go": { "include": ["deepSeek-v4.1-*"] }
}
```

默认只留免费模型，但 opencode-go 下强制保留 deepSeek-v4.1 系列。

## 自定义模型

在 `opencode.json(c)` 的 `providers.<id>.models` 里新增的模型，OpenCode 在插件过滤之后才合并进目录，所以插件不会过滤。

需要禁用这类模型，可直接在它的配置项里加 `"disabled": true` 
