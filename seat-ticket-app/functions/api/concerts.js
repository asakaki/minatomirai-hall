import { json, ensureSchema } from "./_lib.js";

// GET /api/concerts … 公演一覧
export async function onRequestGet({ env }) {
  await ensureSchema(env.DB);
  const { results } = await env.DB
    .prepare("SELECT id, name, date, time FROM concerts ORDER BY created_at")
    .all();
  return json(results);
}

// POST /api/concerts … 公演を追加 {name,date,time}
export async function onRequestPost({ env, request }) {
  await ensureSchema(env.DB);
  const { name, date, time } = await request.json();
  const id = crypto.randomUUID();
  await env.DB
    .prepare("INSERT INTO concerts (id, name, date, time, created_at) VALUES (?,?,?,?,?)")
    .bind(id, name || "（無題）", date || "", time || "", Date.now())
    .run();
  return json({ id, name: name || "（無題）", date: date || "", time: time || "" });
}
