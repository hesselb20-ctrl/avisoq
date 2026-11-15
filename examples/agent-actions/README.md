# A script that acts, and the approval around it

This folder is a small, complete setup you can run:

| File | What it is |
|---|---|
| `shop-server.mjs` | a stand-in for real systems: an MCP server with orders, refunds and email. It keeps its state in `shop-state.json` so you can see what happened |
| `tools.json` | names that server, so scripts and the gateway can reach it |
| `refund_late_order.avq` | the kind of script an agent writes |
| `policy.json` | what may run without asking a person |

Run the commands from this folder (`avisoq` is `node ../../src/cli.mjs` from a clone).

## 1. See what a script can do

```
avisoq tools --tools tools.json          # the tools, as declarations to copy
avisoq plan refund_late_order.avq --tools tools.json
```

`plan` prints the manifest: every tool the script can reach, how often, and under which rules.
"The code cannot do more" means the compiler counted the call sites; "stopped if it tries
more" means the limit is a cap the runner enforces.

## 2. Approve it, run it

```
avisoq act refund_late_order.avq '[7]' --tools tools.json      # refused: not approved
avisoq approve refund_late_order.avq --tools tools.json
avisoq act refund_late_order.avq '[7]' --tools tools.json      # refunds 499 cents, sends one email
avisoq act refund_late_order.avq '[9]' --tools tools.json      # stopped: 2500 is over the total of 2000
```

Edit the script, even one number, and `act` refuses again until someone approves the new
version. Open `shop-state.json` to see what was actually done.

## 3. Check what happened

```
avisoq replay refund_late_order.avq
```

Every run appends to `refund_late_order.avq.runs.jsonl`: the arguments, each tool call with its
answer, and how it ended. `replay` runs the script again against those answers, calling
nothing, and says whether it does the same.

## 4. Let routine work through without asking

```
avisoq act refund_late_order.avq '[8]' --tools tools.json --policy policy.json
```

`policy.json` says which tools may be used and how tightly they must be bounded:

```json
{
  "tools": {
    "lookup_order": {},
    "list_late_orders": {},
    "refund": { "max": 1, "totals": { "amount_cents": 2000 } },
    "send_email": { "max": 1 }
  },
  "effects": []
}
```

A script passes if every tool it can reach is listed, its own limits are at least as tight,
and it uses no other capability. A script that refunds in a loop, or sets a total of 200000,
does not pass and waits for a person.

## 5. Connect an agent

Give the agent this one MCP server instead of the real tools:

```json
{ "mcpServers": { "actions": { "command": "avisoq",
    "args": ["gateway", "--tools", "tools.json", "--policy", "policy.json"] } } }
```

It offers four tools: `avisoq_guide` (the language on one page), `avisoq_tools` (the real
tools as declarations), `avisoq_check` (what would this script be able to do?) and
`avisoq_run`. A script the policy covers runs at once and the agent gets the result and the
list of calls made. Anything else is not run: the agent gets the manifest and the exact
`avisoq approve` command to show a person, and can try again afterwards, or rewrite the script
with tighter limits so that no approval is needed. Submitted scripts and their logs are kept
in `avisoq-scripts/`.

## What to know before trusting it

- Tool arguments and results are numbers, booleans and text. Structured data travels as JSON text.
- A failed tool call stops the script; it cannot be caught and handled yet.
- Every loop counts as unbounded, even `for i in 0..3`. Put an `at most` on tools called in loops.
- Approval is a file next to the script. There are no users, signatures or roles behind it.
- The limits are enforced by this runner, in one process. Nobody has tried to get around them yet.
