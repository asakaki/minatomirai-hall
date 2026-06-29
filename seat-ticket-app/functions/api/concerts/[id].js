import { json, ensureSchema } from "../_lib.js";

// PATCH /api/concerts/:id … 公演情報を更新 {name,date,time}
export async function onRequestPatch({ env, params, request }) {
  await ensureSchema(env.DB);
  const { name, date, time } = await request.json();
  await env.DB
    .prepare("UPDATE concerts SET name=?, date=?, time=? WHERE id=?")
    .bind(name || "（無題）", date || "", time || "", params.id)
    .run();
  return json({ ok: true });
}

// DELETE /api/concerts/:id … 公演＋その座席データを削除
export async function onRequestDelete({ env, params }) {
  await ensureSchema(env.DB);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM seats WHERE concert_id=?").bind(params.id),
    env.DB.prepare("DELETE FROM concerts WHERE id=?").bind(params.id),
  ]);
  return json({ ok: true });
}
