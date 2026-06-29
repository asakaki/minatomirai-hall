import { json, ensureSchema } from "./_lib.js";

// GET /api/seats?concert=:id … その公演の販売・種別データ {sold:{},types:{}}
export async function onRequestGet({ env, request }) {
  await ensureSchema(env.DB);
  const concert = new URL(request.url).searchParams.get("concert");
  const { results } = await env.DB
    .prepare("SELECT seat_key, sold, type FROM seats WHERE concert_id=?")
    .bind(concert)
    .all();
  const sold = {}, types = {};
  for (const r of results) {
    if (r.sold) sold[r.seat_key] = true;
    if (r.type) types[r.seat_key] = r.type;
  }
  return json({ sold, types });
}

// PUT /api/seats … 1座席の状態を保存 {concert,key,sold,type}（空なら行を削除）
export async function onRequestPut({ env, request }) {
  await ensureSchema(env.DB);
  const { concert, key, sold, type } = await request.json();
  const soldVal = sold ? 1 : 0;
  const typeVal = type && type !== "未設定" ? type : null;
  if (!soldVal && !typeVal) {
    await env.DB
      .prepare("DELETE FROM seats WHERE concert_id=? AND seat_key=?")
      .bind(concert, key)
      .run();
  } else {
    await env.DB
      .prepare(
        "INSERT INTO seats (concert_id, seat_key, sold, type) VALUES (?,?,?,?) " +
        "ON CONFLICT(concert_id, seat_key) DO UPDATE SET sold=excluded.sold, type=excluded.type"
      )
      .bind(concert, key, soldVal, typeVal)
      .run();
  }
  return json({ ok: true });
}

// DELETE /api/seats?concert=:id … その公演の座席データを全消去（リセット）
export async function onRequestDelete({ env, request }) {
  await ensureSchema(env.DB);
  const concert = new URL(request.url).searchParams.get("concert");
  await env.DB.prepare("DELETE FROM seats WHERE concert_id=?").bind(concert).run();
  return json({ ok: true });
}
