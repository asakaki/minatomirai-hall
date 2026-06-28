"use strict";

/* =====================================================================
 * コンサートチケット 販売状況管理（パイロット版）
 *   座席キー = 階 / ブロック / 列 / 席番号 の4要素で一意
 *   保存先   = ブラウザの localStorage（サーバー不要・Pages にそのまま公開可）
 * ===================================================================== */

const STORAGE_KEY = "mmh-ticket-pilot-v1";

/* 座席構成（データ駆動：ここに追記すれば対象座席を拡張できる）
 * PDFの席数に準拠した 1〜3階 C席（合計1,446席）。
 *   1階 C: 1〜29列 ×36番 = 1,044席（1-19列=684 / 20-29列=360）
 *   2階 C: 1〜6列  ×31番 =   186席
 *   3階 C: 1〜6列  ×36番 =   216席 */
const rangeN = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* 2階サイドバルコニー LA/RA の変則配置。各列に存在する席番号レンジ（連続）。各計65席
 *   縦=席番号 / 横=列（列1が中央寄り）。LAは席番号 上=1→下=23、RAはその上下反転(上=23→下=1) */
const LA_COL_RANGES = { 1: [6, 22], 2: [4, 22], 3: [2, 23], 4: [1, 7] };
const RA_COL_RANGES = { 1: [2, 18], 2: [2, 20], 3: [1, 22], 4: [17, 23] };

/* 2階 P席（126）：パイプオルガンを囲む変則配置。列ごとに「存在する席番号」を指定（番号は右→左の通し番号）。
 *   1〜4列は中央を跨いで連続、5〜6列はオルガンを挟んで左右に分かれ中央が空く */
const P_ROW_SEATS = {
  6: [1, 2, 3, 4, 5, 6, 31, 32, 33, 34, 35, 36], // 12
  5: [2, 3, 4, 5, 6, 31, 32, 33, 34, 35],         // 10
  4: rangeN(4, 33),                                // 30
  3: rangeN(5, 32),                                // 28
  2: rangeN(6, 31),                                // 26
  1: rangeN(9, 28),                                // 20
};

/* 2階 C席（186）：変則。1-3列=席4-29 / 4-6列=席1-32 / 7列=席11-22（席番号は左→右、10/22の後に通路） */
const C2F_ROW_SEATS = {
  1: rangeN(4, 29), 2: rangeN(4, 29), 3: rangeN(4, 29),
  4: rangeN(1, 32), 5: rangeN(1, 32), 6: rangeN(1, 32),
  7: rangeN(11, 22),
};

/* 3階 C席（216）：変則。1-3列=席3-36 / 4-6列=席1-38（席番号は左→右、2/13/25/36の後に通路） */
const C3F_ROW_SEATS = {
  1: rangeN(3, 36), 2: rangeN(3, 36), 3: rangeN(3, 36),
  4: rangeN(1, 38), 5: rangeN(1, 38), 6: rangeN(1, 38),
};

const SEAT_CONFIG = [
  /* --- 中央席（zone: center） --- */
  // 2階 P席（126）：パイプオルガンを囲む変則配置（上=6列、席番号は右→左の通し）
  {
    zone: "center", placement: "top", floor: "2階", block: "P",
    seatCols: 36, rows: [6, 5, 4, 3, 2, 1], rowSeats: P_ROW_SEATS, refRow: 6, // 6列(上端)を基準
  },
  // 1階 C席：PDF/SVG どおり 1-12 / 13-24 / 25-36 の3ブロック（間に通路）、19/20列に区切り
  {
    zone: "center", floor: "1階", block: "C", rows: rangeN(1, 29), seats: rangeN(1, 36),
    colGroups: [[1, 12], [13, 24], [25, 36]], rowDividerAfter: [19],
  },
  // 2階 C席（186）：変則（1-3列=席4-29 / 4-6列=席1-32 / 7列=席11-22、席1が左、10/22後に通路）
  {
    zone: "center", floor: "2階", block: "C", seatCols: 32, numDir: "ltr",
    rows: rangeN(1, 7), rowSeats: C2F_ROW_SEATS, aisleAfter: [10, 22],
  },
  // 3階 C席（216）：変則（1-3列=席3-36 / 4-6列=席1-38、席1が左、2/13/25/36後に通路）
  {
    zone: "center", floor: "3階", block: "C", seatCols: 38, numDir: "ltr",
    rows: rangeN(1, 6), rowSeats: C3F_ROW_SEATS, aisleAfter: [2, 13, 25, 36],
  },

  /* --- 2階 左バルコニー（zone: left）：PDF/SVG どおり ---
   * LA 65席（4席幅・階段状の23列） / LB〜LF 各24席（3席幅 × 8列） */
  { zone: "left", floor: "2階", block: "LA", rows: rangeN(1, 23), colRanges: LA_COL_RANGES, refRow: 1 }, // 計65（変則）/ 席1(上端)を基準
  { zone: "left", floor: "2階", block: "LB", rows: rangeN(1, 8), seats: rangeN(1, 3) },
  { zone: "left", floor: "2階", block: "LC", rows: rangeN(1, 8), seats: rangeN(1, 3) },
  { zone: "left", floor: "2階", block: "LD", rows: rangeN(1, 8), seats: rangeN(1, 3) },
  { zone: "left", floor: "2階", block: "LE", rows: rangeN(1, 8), seats: rangeN(1, 3) },
  { zone: "left", floor: "2階", block: "LF", rows: rangeN(1, 8), seats: rangeN(1, 3) },

  /* --- 2階 右バルコニー（zone: right）：左の鏡写し ---
   * 席番号は中央寄り＝左端から 1,2,3,4。列番号は上下逆（RA: 上23→下1 / RB〜RF: 上8→下1）。 */
  { zone: "right", floor: "2階", block: "RA", rows: rangeN(1, 23).reverse(), colRanges: RA_COL_RANGES, refRow: 23 }, // 計65（変則）/ 席23(上端)を基準
  { zone: "right", floor: "2階", block: "RB", rows: rangeN(1, 8).reverse(), seats: rangeN(1, 3) },
  { zone: "right", floor: "2階", block: "RC", rows: rangeN(1, 8).reverse(), seats: rangeN(1, 3) },
  { zone: "right", floor: "2階", block: "RD", rows: rangeN(1, 8).reverse(), seats: rangeN(1, 3) },
  { zone: "right", floor: "2階", block: "RE", rows: rangeN(1, 8).reverse(), seats: rangeN(1, 3) },
  { zone: "right", floor: "2階", block: "RF", rows: rangeN(1, 8).reverse(), seats: rangeN(1, 3) },

  /* --- 3階 左バルコニー（zone: outerL = 2階Lの外側）：上から LA→LE の縦並び。LA〜LD 各8席 / LE 7席（単列） --- */
  { zone: "outerL", floor: "3階", block: "LA", rows: rangeN(1, 8), seats: [1] },
  { zone: "outerL", floor: "3階", block: "LB", rows: rangeN(1, 8), seats: [1] },
  { zone: "outerL", floor: "3階", block: "LC", rows: rangeN(1, 8), seats: [1] },
  { zone: "outerL", floor: "3階", block: "LD", rows: rangeN(1, 8), seats: [1] },
  { zone: "outerL", floor: "3階", block: "LE", rows: rangeN(1, 7), seats: [1] },

  /* --- 3階 右バルコニー（zone: outerR = 2階Rの外側）：上から RA→RE。列番号は上下逆 --- */
  { zone: "outerR", floor: "3階", block: "RA", rows: rangeN(1, 8).reverse(), seats: [1] },
  { zone: "outerR", floor: "3階", block: "RB", rows: rangeN(1, 8).reverse(), seats: [1] },
  { zone: "outerR", floor: "3階", block: "RC", rows: rangeN(1, 8).reverse(), seats: [1] },
  { zone: "outerR", floor: "3階", block: "RD", rows: rangeN(1, 8).reverse(), seats: [1] },
  { zone: "outerR", floor: "3階", block: "RE", rows: rangeN(1, 7).reverse(), seats: [1] },
];

/* 座席種別の定義 */
const TYPES = {
  "未設定": { label: "未設定", color: "#ffffff", textColor: "#333", legend: false },
  "SS":     { label: "SS席",  color: "#f2b705", textColor: "#222" },
  "S":      { label: "S席",   color: "#2f80ed", textColor: "#fff" },
  "A":      { label: "A席",   color: "#27ae60", textColor: "#fff" },
  "封鎖":   { label: "封鎖席", color: "#4b5563", textColor: "#fff", blocked: true },
};
const TYPE_ORDER = ["未設定", "SS", "S", "A", "封鎖"];
const SOLD = { label: "販売済", color: "#9ca3af", textColor: "#fff" };

/* ---------- 状態管理 ---------- */
let state = loadState();

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && typeof s === "object" && s.sold && s.types) return s;
  } catch (e) { /* ignore */ }
  return { sold: {}, types: {} };
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- ヘルパー ---------- */
const keyOf = (floor, block, row, num) => `${floor}/${block}/${row}/${num}`;
const seatTypeOf = (key) => state.types[key] || "未設定";
const isSold = (key) => !!state.sold[key];

function labelOf(key) {
  const [floor, block, row, num] = key.split("/");
  return `${floor} ${block}ブロック ${row}列 ${num}番`;
}

const uniqueFloors = () => [...new Set(SEAT_CONFIG.map((c) => c.floor))];
const blocksOf = (floor) => SEAT_CONFIG.filter((c) => c.floor === floor).map((c) => c.block);
const cfgOf = (floor, block) => SEAT_CONFIG.find((c) => c.floor === floor && c.block === block);

/* ---------- 画面状態 ---------- */
const panel = document.getElementById("panel");
let currentTab = "chart";
let currentMode = "view";   // view | sales | type
let currentBrush = "SS";
let chartHost = null;
let msgEl = null;

/* ===================================================================== */
/* 座席表の描画                                                          */
/* ===================================================================== */
function buildChart(mode) {
  const scroll = document.createElement("div");
  scroll.className = "chart-scroll";

  // PDF/SVG どおり「左バルコニー｜中央席｜右バルコニー」の3ゾーン配置
  const hall = document.createElement("div");
  hall.className = "hall";
  // 外側=3階バルコニー / 内側=2階バルコニー / 中央=C・P席
  const zones = {
    outerL: zoneEl("zone-outerL"),
    left: zoneEl("zone-left"),
    center: zoneEl("zone-center"),
    right: zoneEl("zone-right"),
    outerR: zoneEl("zone-outerR"),
  };

  // 中央ゾーン：上部席(P) → ステージ → その他中央席（C）
  const centerCfgs = SEAT_CONFIG.filter((c) => (c.zone || "center") === "center");
  centerCfgs.filter((c) => c.placement === "top").forEach((c) => zones.center.appendChild(buildBlock(c, mode)));
  zones.center.appendChild(stageEl());
  centerCfgs.filter((c) => c.placement !== "top").forEach((c) => zones.center.appendChild(buildBlock(c, mode)));
  // バルコニー（外側=3階, 内側=2階）
  appendBalconies(zones.outerL, SEAT_CONFIG.filter((c) => c.zone === "outerL"), mode);
  appendBalconies(zones.left, SEAT_CONFIG.filter((c) => c.zone === "left"), mode);
  appendBalconies(zones.right, SEAT_CONFIG.filter((c) => c.zone === "right"), mode);
  appendBalconies(zones.outerR, SEAT_CONFIG.filter((c) => c.zone === "outerR"), mode);

  hall.append(zones.outerL, zones.left, zones.center, zones.right, zones.outerR);
  scroll.appendChild(hall);
  return scroll;
}

/* ゾーンへブロックを追加。groupId 付きは1つの横並びコンテナにまとめる（3階サイド等） */
function appendBalconies(zone, cfgs, mode) {
  const groups = {};
  cfgs.forEach((cfg) => {
    const block = buildBlock(cfg, mode);
    if (cfg.groupId) {
      if (!groups[cfg.groupId]) {
        groups[cfg.groupId] = el("balcony-group");
        zone.appendChild(groups[cfg.groupId]);
      }
      groups[cfg.groupId].appendChild(block);
    } else {
      zone.appendChild(block);
    }
  });
}

/* 1ブロックを描画（中央席=通路つき長方形 / バルコニー=行ごとに席数可変）
 * バルコニー(zone≠center)は 列/番号 が縦横逆：横位置=列, 縦位置=席番号。
 * 見た目（レイアウト）は中央席と同じ向きのまま、ラベルと座席キーだけ入れ替える。 */
function buildBlock(cfg, mode) {
  const transpose = !!cfg.zone && cfg.zone !== "center";

  const block = document.createElement("div");
  block.className = "seat-block";

  const title = document.createElement("div");
  title.className = "seat-block-title";
  // 名称は「〇階　XXブロック」に統一（例: 2階　LAブロック / 1階　Cブロック）
  title.textContent = `${cfg.floor}　${cfg.block}ブロック`;
  block.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "seat-grid";

  // バルコニーは縦=席番号 / 横=列。席番号ラベルは表示せず、列見出し(上部)に「○列」太字を出す
  const corner = () => el("corner-cell", transpose ? "" : "列＼番");
  const rowLab = (row) => {
    const rc = el("rcell", transpose ? "" : `${row}列`);
    if (cfg.refRow === row) rc.classList.add("ref-row");
    return rc;
  };

  if (cfg.colGroups) {
    // 中央席：グループ（通路）つきの長方形
    const groups = cfg.colGroups;
    grid.style.gridTemplateColumns = buildTemplate(groups);
    grid.appendChild(corner());
    groups.forEach((g, gi) => {
      for (let num = g[0]; num <= g[1]; num++) grid.appendChild(hcell(num));
      if (gi < groups.length - 1) grid.appendChild(aisleCell());
    });
    cfg.rows.forEach((row) => {
      grid.appendChild(rowLab(row));
      groups.forEach((g, gi) => {
        for (let num = g[0]; num <= g[1]; num++) grid.appendChild(seatCell(cfg.floor, cfg.block, row, num, mode, transpose));
        if (gi < groups.length - 1) grid.appendChild(aisleCell());
      });
      if (cfg.rowDividerAfter && cfg.rowDividerAfter.includes(row)) grid.appendChild(rowDividerEl());
    });
  } else if (cfg.colRanges) {
    // バルコニー変則（LA/RA）：列ごとに席番号レンジが異なる。横=列（中央寄りが列1）、縦=席番号
    const maxC = maxColsOf(cfg);
    const isLeftSide = cfg.zone === "left" || cfg.zone === "outerL";
    const colAt = (v) => (isLeftSide ? maxC - v + 1 : v); // 視覚col v → 列番号（左側は列1が右端）
    grid.style.gridTemplateColumns = `var(--rowlabel) repeat(${maxC}, var(--seat))`;
    grid.appendChild(corner());
    for (let v = 1; v <= maxC; v++) grid.appendChild(el("hcell col-strong", `${colAt(v)}列`));
    cfg.rows.forEach((row) => { // row = 席番号
      grid.appendChild(rowLab(row));
      for (let v = 1; v <= maxC; v++) {
        const col = colAt(v);
        const r = cfg.colRanges[col];
        const present = r && row >= r[0] && row <= r[1];
        grid.appendChild(present ? seatCell(cfg.floor, cfg.block, row, col, mode, transpose) : emptyCell());
      }
    });
  } else if (cfg.rowSeats) {
    // 列ごとに存在する席番号が変則的（P席・2階C席）。numDir で番号の向き、aisleAfter で通路を挿入
    const cols = cfg.seatCols;
    const ltr = cfg.numDir === "ltr"; // 既定(P席)は右→左、2階Cは左→右
    const aisleAfter = new Set(cfg.aisleAfter || []);
    const seatAt = (v) => (ltr ? v : cols - v + 1); // 視覚col v の席番号
    let template = "var(--rowlabel)";
    for (let v = 1; v <= cols; v++) {
      template += " var(--seat)";
      if (aisleAfter.has(seatAt(v))) template += " var(--aisle)";
    }
    grid.style.gridTemplateColumns = template;
    grid.appendChild(corner());
    for (let v = 1; v <= cols; v++) {
      grid.appendChild(hcell("")); // 見出しは省略（各席に番号を表示）
      if (aisleAfter.has(seatAt(v))) grid.appendChild(aisleCell());
    }
    cfg.rows.forEach((row) => {
      grid.appendChild(rowLab(row));
      const present = new Set(cfg.rowSeats[row]);
      for (let v = 1; v <= cols; v++) {
        const seatNo = seatAt(v);
        grid.appendChild(present.has(seatNo) ? seatCell(cfg.floor, cfg.block, row, seatNo, mode, transpose) : emptyCell());
        if (aisleAfter.has(seatNo)) grid.appendChild(aisleCell());
      }
    });
  } else {
    // 行ごとに席数が異なるブロック（足りない位置は空セルで桁を揃える）
    //   align: left  = 左から1,2,3…（右バルコニー） / right = 右から1,2,3…（左バルコニー） / center = 中央寄せ（P席）
    const maxC = maxColsOf(cfg);
    const isLeftSide = cfg.zone === "left" || cfg.zone === "outerL";
    const align = cfg.align || (isLeftSide ? "right" : "left");
    grid.style.gridTemplateColumns = `var(--rowlabel) repeat(${maxC}, var(--seat))`;
    grid.appendChild(corner());
    for (let p = 1; p <= maxC; p++) {
      if (align === "center") { grid.appendChild(hcell("")); continue; } // P席は列見出し省略
      const colNum = align === "right" ? maxC - p + 1 : p;
      // バルコニーは列見出しを「○列」太字で表示
      grid.appendChild(transpose ? el("hcell col-strong", `${colNum}列`) : hcell(colNum));
    }
    cfg.rows.forEach((row) => {
      grid.appendChild(rowLab(row));
      const count = seatsForRow(cfg, row).length;
      const start = align === "right" ? maxC - count + 1
        : align === "center" ? Math.floor((maxC - count) / 2) + 1
          : 1;
      for (let p = 1; p <= maxC; p++) {
        const idx = p - start; // 0..count-1 が席の位置
        if (idx >= 0 && idx < count) {
          const num = align === "right" ? count - idx : idx + 1; // 右寄せのみ右から採番
          grid.appendChild(seatCell(cfg.floor, cfg.block, row, num, mode, transpose));
        } else {
          grid.appendChild(emptyCell());
        }
      }
    });
  }

  block.appendChild(grid);
  return block;
}

/* --- グリッド部品 --- */
function buildTemplate(groups) {
  let t = "var(--rowlabel)";
  groups.forEach((g, gi) => {
    t += ` repeat(${g[1] - g[0] + 1}, var(--seat))`;
    if (gi < groups.length - 1) t += " var(--aisle)";
  });
  return t;
}
function el(cls, text) {
  const e = document.createElement("div");
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const zoneEl = (cls) => el("zone " + cls);
const stageEl = () => el("stage", "ステージ");
const aisleCell = () => el("aisle");
const hcell = (n) => el("hcell", n);
const rowDividerEl = () => el("row-divider");
const emptyCell = () => el("seat-empty");

/* --- バルコニー（行ごとに席数可変）対応ヘルパー --- */
const maxColsOf = (cfg) =>
  cfg.seatCols ? cfg.seatCols
    : cfg.colRanges ? Math.max(...Object.keys(cfg.colRanges).map(Number))
      : cfg.seats ? cfg.seats.length
        : Math.max(...cfg.rowSeatCounts);
function seatsForRow(cfg, row) {
  if (cfg.rowSeats) return cfg.rowSeats[row]; // P席：列ごとに存在する席番号を直接指定
  if (cfg.seats) return cfg.seats;
  return rangeN(1, cfg.rowSeatCounts[cfg.rows.indexOf(row)]);
}
const isTranspose = (cfg) => !!cfg.zone && cfg.zone !== "center";

/* フォーム用：そのブロックで選べる「列」一覧 */
function retsuValues(cfg) {
  return isTranspose(cfg) ? rangeN(1, maxColsOf(cfg)) : cfg.rows; // 転置時の列=横位置1..maxCols
}
/* フォーム用：指定「列」に存在する「席番号」一覧 */
function banValues(cfg, retsu) {
  if (cfg.colRanges) { // バルコニー変則（LA/RA）：列ごとの席番号レンジ
    const r = cfg.colRanges[retsu];
    return r ? rangeN(r[0], r[1]) : [];
  }
  if (isTranspose(cfg)) return cfg.rows.filter((v) => seatsForRow(cfg, v).includes(retsu)); // 席番号=縦位置
  return seatsForRow(cfg, retsu);
}

function seatCell(floor, block, row, num, mode, transpose) {
  // バルコニーは 列=横位置(num) / 席番号=縦位置(row) としてキー化（中央席はそのまま）
  const key = transpose ? keyOf(floor, block, num, row) : keyOf(floor, block, row, num);
  const sold = isSold(key);
  const type = seatTypeOf(key);

  const el = document.createElement("button");
  el.type = "button";
  el.className = "seat";
  el.dataset.key = key;
  el.title = `${labelOf(key)}\n種別: ${TYPES[type].label}${sold ? " / 販売済" : ""}`;

  if (sold) {
    el.style.background = SOLD.color;
    el.style.color = SOLD.textColor;
    if (type !== "未設定") {
      const c = document.createElement("span");
      c.className = "corner";
      c.style.background = TYPES[type].color;  // 販売済でも種別が分かるよう隅に表示
      el.appendChild(c);
    }
  } else if (TYPES[type].blocked) {
    el.classList.add("is-blocked");
  } else {
    el.style.background = TYPES[type].color;
    el.style.color = TYPES[type].textColor;
  }

  const span = document.createElement("span");
  span.className = "num";
  span.textContent = transpose ? row : num; // 枠内は席番号（バルコニーは縦位置=席番号）
  el.appendChild(span);

  if (mode === "view") {
    el.classList.add("readonly");
  } else if (mode === "sales") {
    el.addEventListener("click", () => toggleSold(key));
  } else if (mode === "type") {
    el.addEventListener("click", () => applyBrush(key));
  }
  return el;
}

function refreshChart() {
  if (!chartHost) return;
  chartHost.innerHTML = "";
  chartHost.appendChild(buildChart(currentMode));
  alignRefRows();
}

/* refRow を付けた各ゾーンの基準行を同じ高さに揃える（上マージンで調整） */
function alignRefRows() {
  const hall = chartHost && chartHost.querySelector(".hall");
  if (!hall) return;
  const refs = [...hall.querySelectorAll(".ref-row")];
  if (refs.length < 2) return;
  const hallTop = hall.getBoundingClientRect().top;
  const tops = refs.map((r) => r.getBoundingClientRect().top - hallTop); // 各基準行の現在の高さ
  const maxTop = Math.max(...tops);
  refs.forEach((r, i) => {
    const zone = r.closest(".zone");
    if (zone) zone.style.marginTop = `${maxTop - tops[i]}px`;
  });
}

/* ---------- 操作 ---------- */
function toggleSold(key) {
  if (state.sold[key]) delete state.sold[key];
  else state.sold[key] = true;
  saveState();
  refreshChart();
  showMsg(`${labelOf(key)} を ${state.sold[key] ? "販売済" : "未販売"} にしました`);
}
function applyBrush(key) {
  if (currentBrush === "未設定") delete state.types[key];
  else state.types[key] = currentBrush;
  saveState();
  refreshChart();
  showMsg(`${labelOf(key)} → ${TYPES[currentBrush].label}`);
}
function showMsg(text) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.classList.add("show");
  clearTimeout(msgEl._t);
  msgEl._t = setTimeout(() => msgEl.classList.remove("show"), 2600);
}

/* ===================================================================== */
/* 座席選択フォーム（階・ブロック・列・席番号）                          */
/* ===================================================================== */
function mkField(labelText) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const sel = document.createElement("select");
  field.append(label, sel);
  return { field, sel };
}
function setOptions(sel, values) {
  const prev = sel.value;
  sel.innerHTML = "";
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = String(v);
    o.textContent = String(v);
    sel.appendChild(o);
  });
  if (values.map(String).includes(prev)) sel.value = prev;
}

function buildSeatForm() {
  const wrap = document.createElement("div");
  wrap.className = "seat-form";
  const fFloor = mkField("階");
  const fBlock = mkField("ブロック");
  const fRow = mkField("列");
  const fNum = mkField("席番号");
  wrap.append(fFloor.field, fBlock.field, fRow.field, fNum.field);

  function onRow() {
    const c = cfgOf(fFloor.sel.value, fBlock.sel.value);
    setOptions(fNum.sel, banValues(c, Number(fRow.sel.value)));
  }
  function onBlock() {
    const c = cfgOf(fFloor.sel.value, fBlock.sel.value);
    setOptions(fRow.sel, retsuValues(c)); // バルコニーは列=横位置・席番号=縦位置
    onRow();
  }
  function onFloor() {
    setOptions(fBlock.sel, blocksOf(fFloor.sel.value));
    onBlock();
  }
  fFloor.sel.addEventListener("change", onFloor);
  fBlock.sel.addEventListener("change", onBlock);
  fRow.sel.addEventListener("change", onRow);

  setOptions(fFloor.sel, uniqueFloors());
  onFloor();

  return {
    el: wrap,
    addControl(node) { wrap.appendChild(node); },
    get() {
      const floor = fFloor.sel.value;
      const block = fBlock.sel.value;
      const row = Number(fRow.sel.value);
      const num = Number(fNum.sel.value);
      return { floor, block, row, num, key: keyOf(floor, block, row, num) };
    },
  };
}

/* ===================================================================== */
/* タブ描画                                                              */
/* ===================================================================== */
function renderChartTab() {
  currentMode = "view";

  const intro = document.createElement("div");
  intro.innerHTML =
    '<h2 class="section-title">座席表表示</h2>' +
    '<p class="hint">販売済み座席はグレー、座席種別は色分けで表示します（販売済み座席は隅に種別色を表示）。</p>';
  panel.appendChild(intro);

  // 凡例
  const legendCard = document.createElement("div");
  legendCard.className = "card";
  legendCard.appendChild(buildLegend());
  panel.appendChild(legendCard);

  // データ管理
  const tools = document.createElement("div");
  tools.className = "card";
  tools.innerHTML = '<div class="actions"></div><p class="hint" style="margin:10px 0 0">' +
    'データはこのブラウザに保存されます。バックアップ/復元や全消去ができます。</p>';
  const actions = tools.querySelector(".actions");
  actions.appendChild(button("エクスポート(JSON)", "btn-outline", exportData));
  actions.appendChild(importButton());
  actions.appendChild(button("全リセット", "btn-danger", resetData));
  panel.appendChild(tools);

  // 座席表
  const card = document.createElement("div");
  card.className = "card";
  chartHost = document.createElement("div");
  card.appendChild(chartHost);
  panel.appendChild(card);

  msgEl = null;
  refreshChart();
}

function renderSalesTab() {
  currentMode = "sales";

  const intro = document.createElement("div");
  intro.innerHTML =
    '<h2 class="section-title">販売座席入力</h2>' +
    '<p class="hint">階・ブロック・列・席番号を選んで登録、または下の座席表を直接クリックで販売/取消を切り替えます。販売済みはグレーになります。</p>';
  panel.appendChild(intro);

  const form = buildSeatForm();
  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(form.el);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.style.marginTop = "14px";
  actions.appendChild(button("販売登録", "btn-primary", () => {
    const s = form.get();
    state.sold[s.key] = true; saveState(); refreshChart();
    showMsg(`${labelOf(s.key)} を販売済にしました`);
  }));
  actions.appendChild(button("販売取消", "btn-ghost", () => {
    const s = form.get();
    delete state.sold[s.key]; saveState(); refreshChart();
    showMsg(`${labelOf(s.key)} を未販売にしました`);
  }));
  card.appendChild(actions);

  msgEl = document.createElement("div");
  msgEl.className = "msg";
  card.appendChild(msgEl);
  panel.appendChild(card);

  const chartCard = document.createElement("div");
  chartCard.className = "card";
  chartHost = document.createElement("div");
  chartCard.appendChild(chartHost);
  panel.appendChild(chartCard);
  refreshChart();
}

function renderTypeTab() {
  currentMode = "type";

  const intro = document.createElement("div");
  intro.innerHTML =
    '<h2 class="section-title">座席種別登録</h2>' +
    '<p class="hint">種別を選んで座席表をクリックすると、その座席に種別が適用されます。フォームからの個別登録も可能です。</p>';
  panel.appendChild(intro);

  // ブラシ（適用する種別）
  const brushCard = document.createElement("div");
  brushCard.className = "card";
  const brushLabel = document.createElement("div");
  brushLabel.className = "hint";
  brushLabel.style.margin = "0 0 8px";
  brushLabel.textContent = "塗りつぶす種別（座席クリックで適用）:";
  brushCard.appendChild(brushLabel);

  const brush = document.createElement("div");
  brush.className = "brush";
  TYPE_ORDER.forEach((t) => {
    const lab = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio"; input.name = "brush"; input.value = t;
    input.checked = (t === currentBrush);
    input.addEventListener("change", () => { currentBrush = t; });
    const dot = document.createElement("span");
    dot.className = "dot" + (TYPES[t].blocked ? " blocked" : "");
    if (!TYPES[t].blocked) dot.style.background = TYPES[t].color;
    const span = document.createElement("span");
    span.textContent = TYPES[t].label;
    lab.append(input, dot, span);
    brush.appendChild(lab);
  });
  brushCard.appendChild(brush);

  // フォーム個別登録
  const form = buildSeatForm();
  const typeField = mkField("種別");
  setOptions(typeField.sel, TYPE_ORDER.map((t) => t));
  // 表示名で見せる
  [...typeField.sel.options].forEach((o) => { o.textContent = TYPES[o.value].label; });
  form.addControl(typeField.field);

  brushCard.appendChild(form.el);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.style.marginTop = "14px";
  actions.appendChild(button("種別を登録", "btn-primary", () => {
    const s = form.get();
    const v = typeField.sel.value;
    if (v === "未設定") delete state.types[s.key];
    else state.types[s.key] = v;
    saveState(); refreshChart();
    showMsg(`${labelOf(s.key)} → ${TYPES[v].label}`);
  }));
  brushCard.appendChild(actions);

  msgEl = document.createElement("div");
  msgEl.className = "msg";
  brushCard.appendChild(msgEl);
  panel.appendChild(brushCard);

  const chartCard = document.createElement("div");
  chartCard.className = "card";
  chartHost = document.createElement("div");
  chartCard.appendChild(chartHost);
  panel.appendChild(chartCard);
  refreshChart();
}

/* ---------- 凡例 ---------- */
function buildLegend() {
  const wrap = document.createElement("div");
  wrap.className = "legend";
  const items = [];
  TYPE_ORDER.forEach((t) => {
    if (TYPES[t].legend === false) {
      items.push({ label: "未設定（白）", color: "#ffffff", blocked: false });
    } else {
      items.push({ label: TYPES[t].label, color: TYPES[t].color, blocked: !!TYPES[t].blocked });
    }
  });
  items.push({ label: "販売済", color: SOLD.color, blocked: false });

  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "legend-item";
    const sw = document.createElement("span");
    sw.className = "swatch" + (it.blocked ? " blocked" : "");
    if (!it.blocked) sw.style.background = it.color;
    const label = document.createElement("span");
    label.textContent = it.label;
    row.append(sw, label);
    wrap.appendChild(row);
  });
  return wrap;
}

/* ---------- 共通UI部品 ---------- */
function button(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn " + cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

/* ---------- データ管理 ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ticket-seats.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importButton() {
  const wrap = document.createElement("label");
  wrap.className = "btn btn-outline";
  wrap.textContent = "インポート(JSON)";
  const input = document.createElement("input");
  input.type = "file"; input.accept = "application/json"; input.hidden = true;
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s.sold || !s.types) throw new Error("形式が不正です");
        state = { sold: s.sold, types: s.types };
        saveState();
        render(currentTab);
      } catch (e) {
        alert("読み込みに失敗しました: " + e.message);
      }
    };
    reader.readAsText(file);
  });
  wrap.appendChild(input);
  return wrap;
}
function resetData() {
  if (!confirm("販売状況と座席種別をすべて消去します。よろしいですか？")) return;
  state = { sold: {}, types: {} };
  saveState();
  render(currentTab);
}

/* ===================================================================== */
/* タブ切替・初期化                                                      */
/* ===================================================================== */
function render(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  panel.innerHTML = "";
  chartHost = null;
  msgEl = null;
  if (tab === "chart") renderChartTab();
  else if (tab === "sales") renderSalesTab();
  else renderTypeTab();
}

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (btn) render(btn.dataset.tab);
});

render("chart");
