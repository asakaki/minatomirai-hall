import { json, ensureSchema } from "./_lib.js";

// POST /api/import … 全データを置換 {concerts:[{id,name,date,time}], byId:{id:{sold,types}}}
export async function onRequestPost({ env, request }) {
  await ensureSchema(env.DB);
  const data = await request.json();
  if (!data || !Array.isArray(data.concerts) || !data.byId) {
    return json({ error: "形式が不正です" }, 400);
  }
  const stmts = [
    env.DB.prepare("DELETE FROM seats"),
    env.DB.prepare("DELETE FROM concerts"),
  ];
  data.concerts.forEach((c) => {
    stmts.push(
      env.DB
        .prepare("INSERT INTO concerts (id,name,date,time,created_at) VALUES (?,?,?,?,?)")
        .bind(c.id, c.name || "（無題）", c.date || "", c.time || "", Date.now())
    );
    const d = data.byId[c.id] || { sold: {}, types: {} };
    const keys = new Set([...Object.keys(d.sold || {}), ...Object.keys(d.types || {})]);
    keys.forEach((k) => {
      const sold = d.sold && d.sold[k] ? 1 : 0;
      const type = (d.types && d.types[k]) || null;
      if (sold || type) {
        stmts.push(
          env.DB
            .prepare("INSERT INTO seats (concert_id,seat_key,sold,type) VALUES (?,?,?,?)")
            .bind(c.id, k, sold, type)
        );
      }
    });
  });
  await env.DB.batch(stmts);
  return json({ ok: true });
}
