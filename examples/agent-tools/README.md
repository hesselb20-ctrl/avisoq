# Functions as tools for an AI agent

`tools.avq` holds five functions. Two commands turn them into something an agent can use, or
your own program can call, without anyone reviewing the code first.

## As tools over the Model Context Protocol

```
avisoq mcp tools.avq --host host.mjs
```

That is a complete MCP server on standard input and output. Register it with any MCP client,
for example:

```json
{ "mcpServers": { "pricing": { "command": "avisoq", "args": ["mcp", "tools.avq", "--host", "host.mjs"] } } }
```

What the client sees for `quote`:

- **Name:** `quote`
- **Description:** "Prices an order in cents: quantity times the unit price, with 10% off from
  10 units. Avisoq function quote(product: Str, quantity: Int) -> Result[Quote, Str].
  Capabilities it uses: host."
- **Input schema:** `{ product: string, quantity: integer }`, both required, nothing else allowed.

The description comes from the comment above the function, the schema from its types, and the
capabilities from its signature. A function that uses none says so: "It uses no capabilities:
it cannot print, read or write files, use the network or start programs."

What happens when a call goes wrong:

| The agent calls | It gets back |
|---|---|
| `quote("gadget", 10)` | `{"variant":"Ok","value":{... "total":17991}}` |
| `quote("gadget", 0)` | error `precondition: precondition violated: requires quantity > 0` |
| `fibonacci(100)` | error `overflow: integer overflow` (not a wrong number) |
| `fibonacci("ten")` | error `argument: ... expected an Int` |
| `spin()` | error `time_limit: the call ran longer than its time limit of 5000 ms` |

After any of these the server keeps answering. The limits are 5 seconds and 256 MB per call
unless you pass `--time-limit <ms>` and `--memory <MB>`. Capabilities such as printing or
files are off unless you pass `--allow`.

## From your own program

```js
import { load } from 'avisoq';
import * as host from './host.mjs';

const tools = await load('tools.avq', { host, timeLimitMs: 50, memoryLimitMb: 64 });
tools.quote('widget', 12);        // { variant: 'Ok', value: { ..., total: 2700 } }
tools.monthly_payment(1000000, 6.0, 12);   // 86066
try { tools.spin(); } catch (e) { e.kind; }   // 'time_limit', after 50 ms
```

## Reaching your systems

`tools.avq` cannot open a file, a socket or a database. The one thing it can reach is what it
declares and you provide:

```
extern "host" fn unit_price(product: Str) -> Int
```

`host.mjs` exports a function of that name. Host functions take and return `Int`, `Float`,
`Bool` and `Str`. A function that calls one must say `uses host`, so the tool description
shows it. If the host function throws, the call fails with kind `host` and its message.

## Limits of this

- Host functions and `avisoq mcp --host` work from JavaScript on the WebAssembly route only.
- The memory limit on the WebAssembly route does not count maps; the time limit still stops
  code that grows one without end.
- This is days old and nobody has tried to break out of it. Treat it as a strong default, not
  as a proven security boundary.
