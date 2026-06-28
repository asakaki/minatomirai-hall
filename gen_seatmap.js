// みなとみらいホール 大ホール 座席表 — PDFの座席配置を画像のグリッド表スタイルで再現
// 座席数は PDF を正とする（合計 2,020席 / 車椅子14席分は座席数外）。
//   1階 1,044 = C 1-29列 ×36席 (1-19列=684, 20-29列=360)
//   2階   682 = P126 + C186 + (LA65 + LB/LC/LD/LE/LF 各24)×左右
//   3階   294 = C216 + (LA/LB/LC/LD 各8 + LE7)×左右
// ステータス文字・色・座席数表記・凡例は入れず、空セルのグリッドのみ。
const fs = require("fs");

const W = 1920, H = 1545;
const CXc = 960;
const C_CELL = "#ffffff", C_CELL_ST = "#b9bfc9";
const C_BLACK = "#1a1a1a";
const C_TXT = "#2a2f3a", C_HEAD = "#3a4250";
const FONT = "'Segoe UI','Hiragino Sans','Meiryo',sans-serif";

const out = [];
const n = (v) => Number(v).toFixed(1);
const push = (s) => out.push(s);
let TOTAL = 0;

function cellRect(x, y, s) {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(s)}" height="${n(s)}" fill="${C_CELL}" stroke="${C_CELL_ST}" stroke-width="0.8"/>`;
}
function text(x, y, str, { size = 11, anchor = "middle", weight = "normal", fill = C_TXT } = {}) {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" text-anchor="${anchor}" font-family="${FONT}" font-weight="${weight}" fill="${fill}">${str}</text>`;
}
function rectFill(x, y, w, h, fill) {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;
}
const seq = (a, b) => { const r = []; const s = a <= b ? 1 : -1; for (let i = a; i !== b + s; i += s) r.push(String(i)); return r; };

/**
 * rowCounts(各行の席数)でブロックを描画。align で行内寄せ。
 */
function drawSeatBlock({ x0, y0, cell, rowCounts, maxCols, align = "left",
  colHeaders = null, rowLabels = null, rowSide = "left", title = null }) {
  if (title) push(text(title.x, title.y, title.s, { size: 13, anchor: "start", weight: "700", fill: C_HEAD }));
  if (colHeaders) {
    for (let c = 0; c < colHeaders.length; c++) {
      if (!colHeaders[c]) continue;
      push(text(x0 + c * cell + cell / 2, y0 - 6, colHeaders[c], { size: 9.5, weight: "600", fill: C_HEAD }));
    }
  }
  const blockW = maxCols * cell;
  for (let r = 0; r < rowCounts.length; r++) {
    const k = rowCounts[r];
    let startX;
    if (align === "right") startX = x0 + (maxCols - k) * cell;
    else if (align === "center") startX = x0 + (maxCols - k) * cell / 2;
    else startX = x0;
    for (let i = 0; i < k; i++) push(cellRect(startX + i * cell, y0 + r * cell, cell));
    TOTAL += k;
    if (rowLabels && rowLabels[r] != null) {
      const yy = y0 + r * cell + cell / 2 + 3.5;
      if (rowSide === "left" || rowSide === "both")
        push(text(x0 - 7, yy, rowLabels[r], { size: 9, anchor: "end", fill: C_HEAD }));
      if (rowSide === "right" || rowSide === "both")
        push(text(x0 + blockW + 7, yy, rowLabels[r], { size: 9, anchor: "start", fill: C_HEAD }));
    }
  }
}

push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`);
push(rectFill(0, 0, W, H, "#ffffff"));
push(text(40, 34, "大ホール座席表", { size: 22, anchor: "start", weight: "700", fill: C_HEAD }));
push(text(40, 52, "横浜みなとみらいホール", { size: 12, anchor: "start", fill: "#7a828d" }));

// ===================== 2階 P席 (126) =====================
{
  const cell = 20, maxCols = 26;
  const rowCounts = [16, 18, 20, 22, 24, 26]; // 上→下 (扇形), 計126
  const x0 = CXc - maxCols * cell / 2;
  drawSeatBlock({ x0, y0: 84, cell, rowCounts, maxCols, align: "center",
    rowLabels: ["6", "5", "4", "3", "2", "1"], rowSide: "both",
    title: { s: "■2階 P席", x: x0, y: 70 } });
}

// ===================== 1階 C席 (1,044) =====================
{
  const cell = 22, y0 = 250, nrows = 29;
  const groups = [{ from: 1, to: 12 }, { from: 13, to: 24 }, { from: 25, to: 36 }];
  const sep = 14;
  const totalW = 36 * cell + 2 * sep;
  const x0 = CXc - totalW / 2;
  push(text(x0, 236, "■1階 C席", { size: 13, anchor: "start", weight: "700", fill: C_HEAD }));
  let gx = x0;
  const sepXs = [];
  groups.forEach((g, gi) => {
    const nc = g.to - g.from + 1;
    // 列見出し
    for (let c = 0; c < nc; c++)
      push(text(gx + c * cell + cell / 2, y0 - 6, String(g.from + c), { size: 9, weight: "600", fill: C_HEAD }));
    // セル (全行全列)
    for (let r = 0; r < nrows; r++)
      for (let c = 0; c < nc; c++) { push(cellRect(gx + c * cell, y0 + r * cell, cell)); TOTAL++; }
    gx += nc * cell;
    if (gi < groups.length - 1) { sepXs.push(gx); gx += sep; }
  });
  const rightEdge = gx;
  // 行見出し C1-C29
  for (let r = 0; r < nrows; r++) {
    const yy = y0 + r * cell + cell / 2 + 3.5;
    push(text(x0 - 10, yy, "C" + (r + 1), { size: 9, anchor: "end", fill: C_HEAD }));
    push(text(rightEdge + 10, yy, "C" + (r + 1), { size: 9, anchor: "start", fill: C_HEAD }));
  }
  const yBot = y0 + nrows * cell;
  // グループ間の黒い縦バー
  sepXs.forEach((sx) => push(rectFill(sx, y0, sep, yBot - y0, C_BLACK)));
  // 19列/20列 の黒い横バー
  const yb = y0 + 19 * cell;
  push(rectFill(x0, yb, rightEdge - x0, 7, C_BLACK));
}

// ===================== 2階 C席 (186) =====================
{
  const cell = 22, maxCols = 31;
  const rowCounts = [31, 31, 31, 31, 31, 31]; // 計186
  const x0 = CXc - maxCols * cell / 2;
  const y0 = 930;
  push(text(x0, y0 - 14, "■2階 C席", { size: 13, anchor: "start", weight: "700", fill: C_HEAD }));
  drawSeatBlock({ x0, y0, cell, rowCounts, maxCols, align: "center",
    rowLabels: seq(1, 6), rowSide: "both" });
}

// ===================== 3階 C席 (216) =====================
{
  const cell = 22, maxCols = 36;
  const rowCounts = [36, 36, 36, 36, 36, 36]; // 計216
  const x0 = CXc - maxCols * cell / 2;
  const y0 = 1130;
  push(text(x0, y0 - 14, "■3階 C席", { size: 13, anchor: "start", weight: "700", fill: C_HEAD }));
  drawSeatBlock({ x0, y0, cell, rowCounts, maxCols, align: "center",
    rowLabels: seq(1, 6), rowSide: "both" });
}

// ===================== 2階 左バルコニー LA-LF =====================
// LA(65): 4列×23行の階段 / LB-LF(各24): 3列×8行
const LA_COUNTS = [1, 2, 2, 3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1]; // 計65
const LB_COUNTS = [3, 3, 3, 3, 3, 3, 3, 3]; // 計24
{
  const cell = 20;
  // LA
  drawSeatBlock({ x0: 390, y0: 84, cell, rowCounts: LA_COUNTS, maxCols: 4, align: "left",
    colHeaders: ["LA1", "LA2", "LA3", "LA4"], rowLabels: seq(1, 23), rowSide: "left",
    title: { s: "■2階L", x: 360, y: 70 } });
  // LB-LF
  const subs = [["LB", 575], ["LC", 765], ["LD", 955], ["LE", 1145], ["LF", 1335]];
  subs.forEach(([lab, yy]) => {
    drawSeatBlock({ x0: 400, y0: yy, cell, rowCounts: LB_COUNTS, maxCols: 3, align: "left",
      colHeaders: [lab + "1", lab + "2", lab + "3"], rowLabels: seq(1, 8), rowSide: "left" });
  });
}

// ===================== 2階 右バルコニー RA-RF (左右反転) =====================
{
  const cell = 20;
  // RA : 右端を揃える → align right
  const xRA = 2 * CXc - (390 + 4 * cell);
  drawSeatBlock({ x0: xRA, y0: 84, cell, rowCounts: LA_COUNTS, maxCols: 4, align: "right",
    colHeaders: ["RA4", "RA3", "RA2", "RA1"], rowLabels: seq(23, 1), rowSide: "right",
    title: { s: "■2階R", x: xRA + 4 * cell - 60, y: 70 } });
  const xRB = 2 * CXc - (400 + 3 * cell);
  const subs = [["RB", 575], ["RC", 765], ["RD", 955], ["RE", 1145], ["RF", 1335]];
  subs.forEach(([lab, yy]) => {
    drawSeatBlock({ x0: xRB, y0: yy, cell, rowCounts: LB_COUNTS, maxCols: 3, align: "right",
      colHeaders: [lab + "3", lab + "2", lab + "1"], rowLabels: seq(8, 1), rowSide: "right" });
  });
}

// ===================== 3階 左ブロック LA-LE (単列) =====================
{
  const cell = 20, y0 = 300;
  push(text(120, y0 - 14, "■3階L", { size: 13, anchor: "start", weight: "700", fill: C_HEAD }));
  const blocks = [["LA", 8, 120], ["LB", 8, 175], ["LC", 8, 230], ["LD", 8, 285], ["LE", 7, 340]];
  blocks.forEach(([lab, rows, x0], i) => {
    drawSeatBlock({ x0, y0, cell, rowCounts: new Array(rows).fill(1), maxCols: 1, align: "left",
      colHeaders: [lab], rowLabels: i === 0 ? seq(1, rows) : null, rowSide: "left" });
  });
}

// ===================== 3階 右ブロック RA-RE (単列, 反転) =====================
{
  const cell = 20, y0 = 300;
  push(text(W - 120, y0 - 14, "■3階R", { size: 13, anchor: "end", weight: "700", fill: C_HEAD }));
  const blocks = [["RA", 8, 120], ["RB", 8, 175], ["RC", 8, 230], ["RD", 8, 285], ["RE", 7, 340]];
  blocks.forEach(([lab, rows, leftX], i) => {
    const x0 = W - leftX - cell;
    drawSeatBlock({ x0, y0, cell, rowCounts: new Array(rows).fill(1), maxCols: 1, align: "left",
      colHeaders: [lab], rowLabels: i === 0 ? seq(1, rows) : null, rowSide: "right" });
  });
}

push("</svg>");
fs.writeFileSync("みなとみらい座席表.svg", out.join("\n"), "utf-8");
console.log("done. 合計座席数 =", TOTAL, "(PDF: 2020)");
