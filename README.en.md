# OpenCode Model Filter

> English | [中文](README.md)

An OpenCode plugin that filters OpenCode's built-in models by free/paid status, max price, min context, and glob include/exclude lists.

## Installation

```sh
opencode plugin add github:honwebx/opencode-model-filter
```

You can also add it directly to `opencode.json(c)` — OpenCode installs it automatically on startup:

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

Restart OpenCode after installing:

```sh
opencode service restart
```

## Configuration

The plugin's `options` are written per model provider: one rule set per provider, with `*` matching all providers. A provider's own rule set takes precedence.

```jsonc
{
  "*": { "free": "include", "minContext": 200000 },
  "alibaba": { "include": ["qwen3.8-*"] }
}
```

### Rule fields

| Field | Effect |
| --- | --- |
| `free` | `include` keeps free models and filters out paid ones;<br />`exclude` keeps paid models and filters out free ones;<br />a model counts as "free" only when all four prices — input, output, cache read, cache write — are 0; models without pricing data are not considered free. |
| `maxPrice` | Price cap, in USD per million tokens. Takes the highest of the model's four prices; if it exceeds this value, the model is removed. |
| `minContext` | Minimum context window (tokens). Models below this value are removed. |
| `exclude` | Blocklist; matching models are removed. |
| `include` | Allowlist; matching models are always kept, with the highest priority. |

Field precedence: `include` > `exclude` > `free` / `maxPrice` / `minContext`. List matching uses glob, where `*` matches any string and `?` matches a single character.

### Examples

**Keep only free models**

```jsonc
{ "*": { "free": "include" } }
```

Hides everything that isn't free.

**Keep only paid models**

```jsonc
{ "*": { "free": "exclude" } }
```

The reverse — hides free models, useful when you only care about commercial ones.

**Price cap**

```jsonc
{ "*": { "maxPrice": 5 } }
```

Removes any model whose highest of the four prices exceeds 5 USD / million tokens.

**Minimum context**

```jsonc
{ "*": { "minContext": 200000 } }
```

Removes models with a context window under 200K tokens, keeping only long-context ones.

**Allowlist: keep only specific models**

```jsonc
{
	"*": {
		"include": ["deepseek-*", "glm-*"],
		"exclude": ["*"]
	}
}
```

Note: `exclude: ["*"]` is required. Writing `include` alone only force-keeps the named models; it does not remove the rest.

**Blocklist: remove specific models**

```jsonc
{ "*": { "exclude": ["*-legacy", "gpt-*"] } }
```

Removes the named ones; everything else stays.

**Combined: free + long context + specific models**

```jsonc
{ 
	"*": {
		"free": "include",
		"minContext": 128000,
		"include": ["deepSeek-v4.1-flash"]
	}
}
```

Keeps free models, models with context over 128K, and deepSeek-v4.1-flash.

**Provider override**

```jsonc
{
  "*": { "free": "include" },
  "opencode-go": { "include": ["deepSeek-v4.1-*"] }
}
```

By default only free models are kept, but under `opencode-go` the deepSeek-v4.1 series is always kept.

## Custom models

Models you add under `providers.<id>.models` in `opencode.json(c)` are merged into the catalog after the plugin filters, so the plugin does not filter them.

To disable such a model, add `"disabled": true` to its config entry.
