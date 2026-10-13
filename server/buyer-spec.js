const DIM = /\d+(?:\.\d+)?\s*(?:mm)?\s*[x×*]\s*\d+(?:\.\d+)?(?:\s*(?:mm)?\s*[x×*]\s*\d+(?:\.\d+)?)?(?:\s*mm)?/i;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function joinSpec(spec, note) {
  const next = clean(note);
  if (!next) return clean(spec);
  const current = clean(spec);
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current} · ${next}`.slice(0, 240);
}

function parseQty(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const amount = Math.round(Number(text));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function isNoise(line) {
  const text = clean(line);
  const head = text.split(/[?？]/)[0];
  if (DIM.test(head) && /角|槽|鉛|介子|光砵|CHS|channel|sheet pile/i.test(head)) return false;
  if (text.length < 2 && !/^[米噸吨]$/.test(text)) return true;
  if (/^(today|you|你|產品名稱|product name|brand name)$/i.test(text)) return true;
  if (/^\d{1,2}:\d{2}/.test(text) || /^0:\d{2}$/.test(text)) return true;
  if (/^(上午|下午|中午)/.test(text) && text.length < 28) return true;
  if (/https?:|www\.|\.org|\.com|google maps/i.test(text)) return true;
  if (/[?？]/.test(text)) return true;
  if (/有[沒没]有|邊個|边个|多久|地址|圖紙|图纸|現貨|现货|大約價錢|大约价钱|\bcheck\b/i.test(text)) return true;
  if (/^(好的|明白|謝謝|谢谢|收到|是的)$/.test(text)) return true;
  if (/jingang|wong po kee|nicole chan|hong kong/i.test(text) && !DIM.test(text)) return true;
  if (/^SS\s*316\s*&\s*SS\s*304$/i.test(text)) return true;
  return false;
}

function trad(text) {
  return text.replace(/钢/g, "鋼").replace(/热/g, "熱").replace(/锌/g, "鋅");
}

function parseMaterialTable(lines) {
  const start = lines.findIndex((line) => /材料名[称稱]/.test(line));
  if (start < 0) return [];
  const specAt = lines.findIndex((line, index) => index > start && /型[号號][规規]/.test(line));
  const qtyAt = lines.findIndex((line, index) => index > specAt && specAt > 0 && /^[数數]量$/.test(line));
  const unitAt = lines.findIndex((line, index) => index > qtyAt && qtyAt > 0 && /^[单單]位$/.test(line));
  if (specAt < 0 || qtyAt < 0 || unitAt < 0) return [];
  const names = lines.slice(start + 1, specAt).map(trad);
  const specs = lines.slice(specAt + 1, qtyAt);
  const qtys = lines.slice(qtyAt + 1, unitAt);
  const units = lines.slice(unitAt + 1);
  if (names.length < 2 || names.length !== specs.length || names.length !== qtys.length) return [];
  return names.slice(0, 30).map((name, index) => ({
    name: `${name} ${clean(specs[index])}`.trim(),
    spec: joinSpec(clean(specs[index]), units[index] ? `單位 ${units[index]}` : ""),
    qty: parseQty(qtys[index]),
  }));
}

function isSizeLine(line) {
  return line.length < 80 && (DIM.test(line) || /\b(CHS|channel)\b/i.test(line));
}

function mergeDescriptions(lines, count) {
  const items = [...lines];
  while (items.length > count) {
    const sizeAt = items.findIndex((line, index) => index > 0 && isSizeLine(line));
    if (sizeAt < 0) break;
    items[sizeAt - 1] = `${items[sizeAt - 1]} ${items[sizeAt]}`;
    items.splice(sizeAt, 1);
  }
  return items.slice(0, count);
}

function bqName(text) {
  if (/extract and remove/i.test(text)) return "Extract and remove sheet pile";
  const chs = text.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*mm\s*CHS/i);
  if (chs || /\bCHS\b/.test(text)) {
    return chs ? `CHS ${chs[1]} x ${chs[2]}mm` : "CHS";
  }
  const channel = text.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*channel/i);
  if (channel || /\bchannel\b/i.test(text)) {
    return channel ? `Steel channel ${channel[1]} x ${channel[2]}` : "Steel channel";
  }
  const pile = text.match(/LSP\s*\w*/i);
  if (/sheet pile/i.test(text)) return pile ? `Sheet pile ${pile[0].replace(/\s+/g, "")}` : "Sheet pile";
  return clean(text).slice(0, 80);
}

function parseBq(lines) {
  let start = -1;
  let codes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^[A-Z]\d+(?:\.\d+)?$/.test(lines[index])) {
      if (!codes.length) start = index;
      codes.push(lines[index]);
    } else if (codes.length >= 2) break;
    else {
      codes = [];
      start = -1;
    }
  }
  if (codes.length < 2 || start < 0) return [];
  const rest = lines.slice(start + codes.length);
  let cursor = 0;
  const desc = [];
  for (; cursor < rest.length; cursor += 1) {
    const ahead = rest.slice(cursor, cursor + codes.length);
    const numbers = ahead.filter((line) => parseQty(line) != null && !DIM.test(line)).length;
    if (numbers >= Math.min(2, codes.length) && parseQty(rest[cursor]) != null) break;
    desc.push(rest[cursor]);
  }
  const qtys = [];
  for (; cursor < rest.length; cursor += 1) {
    const qty = parseQty(rest[cursor]);
    if (qty == null || DIM.test(rest[cursor])) break;
    qtys.push(qty);
  }
  const units = [];
  for (; cursor < rest.length; cursor += 1) {
    if (/^(m2|m²|m|t|kg|pcs|nos|米|噸|吨)$/i.test(rest[cursor])) units.push(rest[cursor]);
    else break;
  }
  const bodies = mergeDescriptions(desc, codes.length);
  if (bodies.length < codes.length) return [];
  return codes.map((code, index) => {
    const body = bodies[index] || "";
    const grade = /S\s*275/i.test(body) ? "grade S275" : "";
    return {
      name: bqName(body),
      spec: [code, clean(body), grade, units[index] || ""].filter(Boolean).join(" · ").slice(0, 240),
      qty: qtys[index] ?? null,
    };
  });
}

function parseSlashLists(lines) {
  const items = [];
  const prefix = /^(熱浸鋅角鋼|熱浸鋅槽鋼|角鋼|槽鋼|U槽)\s*(.*)$/;
  for (const raw of lines) {
    const line = trad(raw.split(/[?？]/)[0]);
    const match = line.match(prefix);
    if (!match || !DIM.test(match[2])) continue;
    const kind = match[1];
    const qtyMatch = match[2].match(/(?:qty|數量|数量)\s*(\d+)/i);
    const parts = match[2].split(/[\/、]/);
    for (const part of parts) {
      const size = clean(part).match(DIM);
      if (!size) continue;
      const label = size[0].replace(/\s+/g, "").replace(/[，,。].*$/, "");
      items.push({
        name: `${kind} ${label}`,
        spec: label,
        qty: qtyMatch ? parseQty(qtyMatch[1]) : null,
      });
    }
  }
  return items;
}

function isFastenerLine(line) {
  return /^(鉛水|不銹鋼|不锈钢|槽鐵|槽铁|絲母|介子|光砵|U槽夾|曲尺)/.test(line);
}

function parseFasteners(lines) {
  if (!lines.some((line) => isFastenerLine(line))) return [];
  const items = [];
  const waiting = [];
  const push = (name, qty) => {
    const title = clean(name).replace(/\s*-\s*/g, " ").replace(/\s+/g, " ");
    if (title.length < 3) return;
    items.push({ name: title, spec: "", qty });
  };
  for (const line of lines) {
    if (isFastenerLine(line)) {
      waiting.push(line);
      continue;
    }
    const qty = parseQty(line);
    if (qty != null && waiting.length) {
      push(waiting.shift(), qty);
      continue;
    }
  }
  for (const name of waiting) push(name, null);
  return items;
}

function parseDrawing(text) {
  const items = [];
  if (/LSP\s*3B/i.test(text)) {
    const thick = text.match(/LSP\s*3B[^\n]{0,48}?(\d+\s*mm)/i);
    items.push({
      name: "Sheet pile LSP3B",
      spec: [thick ? `${thick[1].replace(/\s+/g, "")} thick` : "", /S\s*275/i.test(text) ? "grade S275" : ""].filter(Boolean).join(" · "),
      qty: null,
    });
  }
  const channel = text.match(/(\d+)\s*[x×*]\s*(\d+)\s*CHANNEL/i);
  if (channel) {
    items.push({ name: `Steel channel ${channel[1]} x ${channel[2]}`, spec: `${channel[1]} x ${channel[2]} channel`, qty: null });
  }
  const chs = text.match(/[Øø]?6?(\d{2}\.\d)\s*[x×*]\s*(\d+)\s*mm\s*CHS/i);
  if (chs) {
    items.push({ name: `CHS ${chs[1]} x ${chs[2]}mm`, spec: `${chs[1]} x ${chs[2]}mm CHS`, qty: null });
  }
  if (/U-HEAD[_\s-]*SCREW JACK/i.test(text)) {
    items.push({ name: "U-head screw jack", spec: "", qty: null });
  }
  return items;
}

function applyNotes(items, text) {
  const source = trad(text);
  let next = items.map((item) => ({ ...item }));
  if (/6\s*米就可以|6\s*m就可以/i.test(source)) {
    next = next.map((item) => (/角鋼|槽鋼|U槽|channel|CHS/i.test(item.name) ? { ...item, spec: joinSpec(item.spec, "長度 6米") } : item));
  }
  if (/热浸鋅槽鋼和角鋼|熱浸鋅槽鋼和角鋼/.test(source)) {
    next = next
      .filter((item) => !/stainless steel plate/i.test(item.name))
      .map((item) => (/^(角鋼|槽鋼)/.test(item.name) ? { ...item, name: `熱浸鋅${item.name}` } : item));
  }
  const corrected = source.match(/(\d+\s*[x×*]\s*\d+\s*[x×*]\s*\d+(?:\.\d+)?\s*mm)\s*才正確/i);
  if (corrected) {
    const size = corrected[1].replace(/\s+/g, "");
    const index = [...next].reverse().findIndex((item) => /U槽|4\.1|41/.test(`${item.name} ${item.spec}`));
    if (index >= 0) {
      const at = next.length - 1 - index;
      next[at] = { ...next[at], name: `U槽 ${size}`, spec: joinSpec(size, "依對話更正") };
    } else next.push({ name: `U槽 ${size}`, spec: "依對話更正", qty: null });
  }
  if ((source.match(/SS\s*316\s*&\s*SS\s*304/gi) || []).length >= 2 || /兩個都要/.test(source)) {
    next = next.map((item) => (/鉛|介子|光砵|絲|槽鐵|U槽夾|曲尺/.test(item.name) ? { ...item, spec: joinSpec(item.spec, "SS316 及 SS304 都要報") } : item));
  }
  if (/落單數量都唔一樣|參考左價錢|參考報價/.test(source)) {
    next = next.map((item) => ({ ...item, spec: joinSpec(item.spec, "參考數量，落單數量其後先定") }));
  }
  if (/冇長度|沒有長度|没有长度/.test(source)) {
    next = next.map((item) => (/水平爆/.test(item.name) ? { ...item, spec: joinSpec(item.spec, "長度未提供") } : item));
  }
  if (/1\/2\s*31\.8/.test(source)) {
    next = next.map((item) => (/介子/.test(item.name) ? { ...item, spec: joinSpec(item.spec, "1/2 對 31.8、3/8 對 25.4（未確認）") } : item));
  }
  return next;
}

function dedupe(items) {
  const seen = new Set();
  const rows = [];
  for (const item of items) {
    const name = clean(item.name);
    if (name.length < 3) continue;
    const key = `${name.toLowerCase()}|${clean(item.spec).toLowerCase()}|${item.qty ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name: name.slice(0, 180), spec: clean(item.spec).slice(0, 240), qty: item.qty ?? null });
    if (rows.length >= 30) break;
  }
  return rows;
}

function isDrawingChrome(line) {
  return /pdf|頁|檢視|另存|報價|晚上|上午|下午|已寄|notes?|legend|for information|revised|scale\b|aecom|contract|drawing|土木工程|拓展署|比例|圖號|key description|building line|carriage|footpath|run-in|pattern|typ\b/i.test(line);
}

function sizeOnLine(line) {
  const match = String(line || "").match(DIM);
  if (!match) return "";
  const prev = match.index > 0 ? line[match.index - 1] : "";
  if (/[A-Za-z]/.test(prev) && !/^[A-Za-z]-?$/.test(line.slice(0, match.index))) return "";
  const first = (match[0].match(/\d+/) || [""])[0];
  if (first.length < 2 || first.startsWith("0")) return "";
  return match[0];
}

function cleanSize(raw) {
  const parts = String(raw || "")
    .split(/[x×*]/i)
    .map((part) => (part.match(/\d+(?:\.\d+)?/) || [""])[0])
    .filter(Boolean);
  while (parts.length >= 3 && parts[parts.length - 1].length < 2) parts.pop();
  if (parts.length < 2) return clean(raw);
  return `${parts.join("x")}${/mm|m$/i.test(String(raw || "").trim()) ? "mm" : ""}`;
}

function isProductTitle(line) {
  if (sizeOnLine(line) || isDrawingChrome(line) || isNoise(line) || line.length > 48) return false;
  if (/^(blocks?|precast|concrete|granite|colour|color|grey|gray|thk|paving)$/i.test(line)) return false;
  const words = line.match(/[A-Za-z\u4e00-\u9fff]{2,}/g) || [];
  if (words.length < 2 && !/磚|網|管|板|石|鋼|混凝土/.test(line)) return false;
  return /block|paving|brick|mesh|pipe|board|steel|concrete|granite|tile|timber|slab|磚|網|管|板|石|鋼|混凝土/i.test(line);
}

const COLOURS = [
  [/d[a-z]rk\W{0,3}gr[e]?y|oark\W{0,3}gr[e]?y|深灰/i, "Dark Grey"],
  [/m[e]?dium\W{0,3}gr[e]?y|n[e]?dium\W{0,3}gr[e]?y|中灰/i, "Medium Grey"],
  [/l[i1]ght\W{0,3}gr[e]?y|licht\W{0,3}crey|淺灰|浅灰/i, "Light Grey"],
];

function colourOf(text) {
  const hit = COLOURS.find(([re]) => re.test(text));
  return hit ? hit[1] : "";
}

function colourCount(text) {
  return COLOURS.filter(([re]) => re.test(text)).length;
}

function materialOf(text) {
  if (/granite|花崗/i.test(text)) return "Granite";
  if (/paving\s*block|concrete\s*block|路磚|地磚/i.test(text)) return "Concrete Paving Block";
  if (/precast/i.test(text) && /pav/i.test(text)) return "Precast concrete paving";
  return "";
}

function qtyOnSpecLine(line) {
  const rest = line.replace(DIM, " ");
  const match = rest.match(/(?:[:：]\s*)(\d{1,5})\s*(?:碼|码|礁|件|張|张|片|個|个|pcs|nos)?\s*$/i)
    || rest.match(/(\d{1,5})\s*(?:碼|码|礁|件|張|张|片|個|个|pcs|nos|m²|m2)\s*$/i);
  return match ? parseQty(match[1]) : null;
}

function usableHead(value) {
  const text = clean(value).replace(/^(thk\.?|thick\.?)$/i, "");
  if (!/[A-Za-z\u4e00-\u9fff]{3,}/.test(text)) return "";
  return text;
}

function parseLooseSpecs(lines) {
  const items = [];
  let title = "";
  let titleAge = 99;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isDrawingChrome(line) || colourCount(line) >= 2) {
      titleAge += 1;
      continue;
    }
    if (!sizeOnLine(line)) {
      if (isProductTitle(line)) {
        title = clean(line);
        titleAge = 0;
      } else titleAge += 1;
      continue;
    }
    const extra = [];
    let next = index + 1;
    while (next < lines.length && extra.length < 6) {
      const follow = lines[next];
      if (sizeOnLine(follow) || isDrawingChrome(follow) || colourCount(follow) >= 2 || follow.length > 48) break;
      const started = materialOf(extra.join(" "));
      const nextFamily = materialOf(follow);
      if (started && nextFamily && started !== nextFamily) break;
      extra.push(follow);
      next += 1;
    }
    const blob = [line, ...extra].join(" ");
    const size = cleanSize(sizeOnLine(line));
    const material = materialOf(blob);
    const head = material || usableHead(titleAge <= 4 ? title : "") || usableHead(line.slice(0, line.search(DIM)));
    const colour = colourOf(blob);
    const name = clean([head, colour].filter(Boolean).join(" "));
    if (name && (material || colour || (titleAge <= 4 && title))) {
      const thick = /thk|thick/i.test(blob) ? " THK" : "";
      items.push({ name, spec: `${size}${thick}`.trim(), qty: qtyOnSpecLine(line) });
    }
    index = next - 1;
  }
  return items.filter((item, index) => {
    const size = item.spec.replace(/\s*THK/gi, "").replace(/mm/gi, "").toLowerCase();
    return !items.some((other, otherIndex) => {
      if (otherIndex === index || other.name !== item.name) return false;
      const longer = other.spec.replace(/\s*THK/gi, "").replace(/mm/gi, "").toLowerCase();
      return longer.startsWith(size) && longer.length > size.length;
    });
  });
}

export function parseBuyerDocument(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(clean)
    .filter((line) => line && !isNoise(line));
  let items = parseMaterialTable(lines);
  if (!items.length) items = parseBq(lines);
  if (!items.length) items = parseSlashLists(lines);
  const fasteners = parseFasteners(lines);
  if (fasteners.length > items.length) items = fasteners;
  if (items.length < 2) {
    const drawn = parseDrawing(text);
    if (drawn.length > items.length) items = drawn;
  }
  if (!items.length) items = parseLooseSpecs(lines);
  return dedupe(applyNotes(items, String(text || "")));
}
