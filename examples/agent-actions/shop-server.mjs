// A stand-in for real systems: a small MCP server with an order book, refunds and email.
// It keeps its state in shop-state.json next to it, so you can see what scripts did.
//   node shop-server.mjs            (started for you through tools.json)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const stateFile = process.env.SHOP_STATE ?? fileURLToPath(new URL('./shop-state.json', import.meta.url));
const fresh = () => ({
  orders: {
    7: { id: 7, email: 'ada@example.com', days_late: 3, shipping_cents: 499, refunded: false },
    8: { id: 8, email: 'grace@example.com', days_late: 0, shipping_cents: 499, refunded: false },
    9: { id: 9, email: 'linus@example.com', days_late: 5, shipping_cents: 2500, refunded: false },
  },
  refunds: [], emails: [],
});
const read = () => (existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : fresh());
const write = (s) => writeFileSync(stateFile, `${JSON.stringify(s, null, 1)}\n`);

const TOOLS = [
  { name: 'lookup_order', description: 'An order as JSON: id, email, days_late, shipping_cents, refunded.', annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: { order: { type: 'integer' } }, required: ['order'] },
    run: ({ order }) => { const o = read().orders[order]; if (!o) throw new Error(`there is no order ${order}`); return JSON.stringify(o); } },
  { name: 'list_late_orders', description: 'The ids of orders that arrived late, as a JSON list.', annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
    run: () => JSON.stringify(Object.values(read().orders).filter((o) => o.days_late >= 2 && !o.refunded).map((o) => o.id)) },
  { name: 'refund', description: 'Pays amount_cents back on an order. Returns a receipt number.', annotations: { destructiveHint: true },
    inputSchema: { type: 'object', properties: { order: { type: 'integer' }, amount_cents: { type: 'integer' } }, required: ['order', 'amount_cents'] },
    run: ({ order, amount_cents }) => { const s = read(); if (!s.orders[order]) throw new Error(`there is no order ${order}`); s.orders[order].refunded = true; s.refunds.push({ order, amount_cents }); write(s); return `receipt R-${s.refunds.length}`; } },
  { name: 'send_email', description: 'Sends an email to a customer.',
    inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] },
    run: ({ to, subject, body }) => { const s = read(); s.emails.push({ to, subject, body }); write(s); return 'queued'; } },
];

const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const req = JSON.parse(line);
  if (req.id === undefined) continue;
  if (req.method === 'initialize') say({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: req.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'shop', version: '1' } } });
  else if (req.method === 'tools/list') say({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
  else if (req.method === 'tools/call') {
    const t = TOOLS.find((x) => x.name === req.params.name);
    try {
      if (!t) throw new Error(`there is no tool ${req.params.name}`);
      say({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: t.run(req.params.arguments ?? {}) }], isError: false } });
    } catch (e) {
      say({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: e.message }], isError: true } });
    }
  } else say({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'not supported' } });
}
