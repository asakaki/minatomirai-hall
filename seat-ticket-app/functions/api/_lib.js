// Pages Functions 共通ユーティリティ
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// テーブルが無ければ作成（マイグレーション不要・冪等）
export async function ensureSchema(db) {
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS concerts (id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT, time TEXT, created_at INTEGER)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS seats (concert_id TEXT NOT NULL, seat_key TEXT NOT NULL, sold INTEGER NOT NULL DEFAULT 0, type TEXT, PRIMARY KEY (concert_id, seat_key))"
    ),
  ]);
}
