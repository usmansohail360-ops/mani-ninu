import { DurableObject } from "cloudflare:workers";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (o, st = 200) =>
  new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json", ...CORS } });

// One Room = one private shared space (id comes from your secret code).
export class Room extends DurableObject {
  async fetch(req) {
    let cur = (await this.ctx.storage.get("d")) || {};
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const inc = body.d || {};
      for (const k in inc) {
        const v = inc[k];
        if (!v || typeof v.t !== "number") continue;
        if (!cur[k] || v.t > cur[k].t) cur[k] = v; // newest change wins
      }
      await this.ctx.storage.put("d", cur);
    }
    return json({ now: Date.now(), d: cur });
  }
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const u = new URL(req.url);
    if (u.pathname !== "/s") return json({ ok: true, app: "mani-ninu-sync" });
    const room = u.searchParams.get("room") || "";
    if (!/^[a-z0-9]{4,40}$/.test(room)) return json({ error: "bad room" }, 400);
    if (+req.headers.get("content-length") > 200000) return json({ error: "too big" }, 413);
    return env.ROOM.get(env.ROOM.idFromName(room)).fetch(req);
  },
};
