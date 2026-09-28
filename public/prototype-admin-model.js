const SubbieAdminModel = (() => {
  const CATEGORIES = [
    "Reinforcement Mesh",
    "Dense Mesh Flame Retardant Safety Net",
    "Gypsum Block",
    "XPS Foam Board",
    "Tiles",
    "Vinyl",
    "Precasted Concrete",
    "Cat Ladder",
    "Logistics Storage Platform & Steel Shelving",
    "Handrails",
    "Balustrades",
    "Forge-welded Grating",
    "Press-Lock Grating",
    "GU Type Drainage Gratings",
    "GT Type Drainage Gratings",
    "Gypsum Board",
    "Software",
  ];

  const EXCEL_HEADERS = [
    "Provisional SKU ID",
    "Official SKU",
    "Category",
    "IMG (Gen)",
    "Product name",
    "Size / Description",
    "Certifications / Relevant Reports",
    "Primary Spec Description",
    "Sales Unit",
    "MOQ",
    "Lead Time",
    "Purposes (Indicator for Searching)",
    "Remark",
    "Tag (Green / Hit)",
  ];

  const HEADER_MAP = {
    "provisional sku id": "provisionalSku",
    "official sku": "productNo",
    "category": "category",
    "img (gen)": "image",
    "product name": "name",
    "size / description": "sizeDesc",
    "certifications / relevant reports": "certifications",
    "primary spec description": "primarySpec",
    "sales unit": "salesUnit",
    "moq": "moq",
    "lead time": "leadTime",
    "purposes (indicator for searching)": "purposes",
    "remark": "remark",
    "tag (green / hit)": "tags",
  };

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function seed() {
    return {
      seq: { tmp: 4, rfq: 100, report: 20, tms: 500, staff: 2 },
      session: { role: "anon", email: "" },
      staff: [
        { email: "sales@mattex.com", name: "Bootstrap Sales", password: "mattex", enabled: true, bootstrap: true },
        { email: "ops@mattex.com", name: "Second Sales", password: "mattex", enabled: true, bootstrap: false },
      ],
      buyers: [
        {
          email: "buyer@harbour.hk",
          name: "Alex Chan",
          password: "harbour",
          enabled: true,
          companyName: "Harbour Construction",
          companyPhone: "2123 0001",
          companyAddress: "Kowloon Bay",
        },
      ],
      products: [
        product({
          id: "p-mesh",
          provisionalSku: "TMP-0001",
          productNo: "MKT-MESH-A142",
          category: "Reinforcement Mesh",
          name: "A142 — 2.1m×4.8m / Customize",
          sizeDesc: "2.1m×4.8m / Customize",
          certifications: "BS4483:2005; BS4449:2005",
          primarySpec: "Square mesh for road / slab",
          salesUnit: "sheet",
          moq: 90,
          leadTime: "3-7 days",
          purposes: ["Anti-cracking", "Pavement laying", "路面防裂"],
          remark: "",
          green: false,
          hit: true,
          image: "/assets/prod-mesh.webp",
          imageSource: "upload",
          published: true,
          held: false,
          discontinued: false,
          deleted: false,
        }),
        product({
          id: "p-vinyl",
          provisionalSku: "TMP-0002",
          productNo: "MKT-VINYL-HETERO",
          category: "Vinyl",
          name: "Heterogeneous Vinyl Flooring — 2×20m",
          sizeDesc: "2×20m roll",
          certifications: "EN 649",
          primarySpec: "Heterogeneous vinyl sheet",
          salesUnit: "m²",
          moq: 20,
          leadTime: "7-14 days",
          purposes: [
            "Vinyl flooring", "Rubber Floor", "vinyl floor mats", "Heterogeneous Vinyl",
            "乙烯基地板", "膠地板", "膠地蓆", "異質乙烯基", "卷材", "無縫膠地板",
          ],
          remark: "Search keywords from Excel",
          green: true,
          hit: false,
          image: "/assets/prod-vinyl.webp",
          imageSource: "upload",
          published: true,
        }),
        product({
          id: "p-brick",
          provisionalSku: "TMP-0003",
          productNo: "MKT-PC-BRICK-01",
          category: "Precasted Concrete",
          name: "Soil filling concrete bricks",
          sizeDesc: "Modular civil brick",
          certifications: "",
          primarySpec: "Precast concrete brick",
          salesUnit: "pc",
          moq: 200,
          leadTime: "14-21 days",
          purposes: [
            "Soil filling concrete bricks", "Civil engineering concrete bricks",
            "填土工程石屎磚", "土木工程石屎磚", "石屎躉", "水泥躉",
          ],
          image: "/assets/prod-precast.webp",
          imageSource: "upload",
          published: true,
        }),
        product({
          id: "p-draft",
          provisionalSku: "TMP-0004",
          productNo: "",
          category: "Gypsum Board",
          name: "Fire-resistant gypsum board 1220×2440",
          sizeDesc: "1220×2440 × 12mm",
          certifications: "",
          primarySpec: "Fire-resistant board",
          salesUnit: "sheet",
          moq: 50,
          leadTime: "5-10 days",
          purposes: ["Partition", "防火石膏板"],
          image: "",
          imageSource: "generated",
          published: false,
        }),
        product({
          id: "p-held",
          provisionalSku: "TMP-0005",
          productNo: "MKT-NET-FR-01",
          category: "Dense Mesh Flame Retardant Safety Net",
          name: "FR Safety Net — green",
          sizeDesc: "Custom panel",
          certifications: "FR",
          primarySpec: "Dense mesh FR net",
          salesUnit: "sheet",
          moq: 10,
          leadTime: "7 days",
          purposes: ["Edge protection"],
          image: "/assets/prod-safetynet.webp",
          imageSource: "upload",
          published: true,
          held: true,
        }),
        product({
          id: "p-dead",
          provisionalSku: "TMP-0006",
          productNo: "MKT-SOFT-001",
          category: "Software",
          name: "Legacy site licence",
          sizeDesc: "Annual",
          certifications: "",
          primarySpec: "End-of-life licence",
          salesUnit: "license",
          moq: 1,
          leadTime: "1 day",
          purposes: ["BIM"],
          image: "/assets/vfd.webp",
          imageSource: "upload",
          published: true,
          discontinued: true,
        }),
        product({
          id: "p-deleted",
          provisionalSku: "TMP-0007",
          productNo: "MKT-LADDER-01",
          category: "Cat Ladder",
          name: "Galvanized cat ladder",
          sizeDesc: "By drawing",
          certifications: "",
          primarySpec: "Galvanized",
          salesUnit: "lot",
          moq: 1,
          leadTime: "21 days",
          purposes: ["Access"],
          image: "/assets/prod-ironwork.webp",
          imageSource: "upload",
          published: false,
          deleted: true,
        }),
      ],
      carts: {},
      rfqs: [],
      reports: [],
      lastDelta: "已載入種子資料（7 隻貨、1 買家、2 Sales）。",
      lastOk: true,
      lastTms: null,
    };
  }

  function product(p) {
    return {
      remark: "",
      green: false,
      hit: false,
      held: false,
      discontinued: false,
      deleted: false,
      certFiles: [],
      ...p,
    };
  }

  function fail(state, msg) {
    return { ...state, lastDelta: msg, lastOk: false };
  }

  function ok(state, msg) {
    return { ...state, lastDelta: msg, lastOk: true };
  }

  function staffBy(state, email) {
    return state.staff.find((s) => s.email === email);
  }
  function buyerBy(state, email) {
    return state.buyers.find((b) => b.email === email);
  }
  function productBy(state, id) {
    return state.products.find((p) => p.id === id);
  }

  function buyerVisible(p) {
    return p.published && !p.held && !p.deleted;
  }
  function canOrder(p) {
    return buyerVisible(p) && !p.discontinued;
  }
  function publishBlockers(p, products) {
    const reasons = [];
    if (!String(p.productNo || "").trim()) reasons.push("未填正式 SKU");
    if (!p.category) reasons.push("未選 Category");
    if (!String(p.name || "").trim()) reasons.push("未填 Product name");
    if (!String(p.salesUnit || "").trim()) reasons.push("未填 Sales Unit");
    if (p.moq == null || p.moq === "") reasons.push("未填 MOQ");
    if (!String(p.leadTime || "").trim()) reasons.push("未填 Lead Time");
    const sku = String(p.productNo || "").trim().toUpperCase();
    if (sku && products.some((o) => o.id !== p.id && String(o.productNo || "").toUpperCase() === sku)) {
      reasons.push("正式 SKU 與其他貨重複");
    }
    return reasons;
  }

  function matchCategory(name) {
    const n = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
    return CATEGORIES.find((c) => c.toLowerCase() === n) || null;
  }

  function splitPurposes(text) {
    return String(text || "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function parseTags(text) {
    const t = String(text || "").toLowerCase();
    return { green: /green|綠/.test(t), hit: /hit|熱/.test(t) };
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  function parseExcelCsv(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { headers: [], mapped: [], unknown: [], rows: [] };
    const headers = splitCsvLine(lines[0]);
    const mapped = [];
    const unknown = [];
    headers.forEach((h) => {
      const key = HEADER_MAP[h.trim().toLowerCase()];
      if (key) mapped.push({ header: h, key });
      else unknown.push(h);
    });
    const rows = lines.slice(1).map((line, idx) => {
      const cells = splitCsvLine(line);
      const raw = {};
      headers.forEach((h, i) => { raw[h] = cells[i] || ""; });
      const rec = { _line: idx + 2 };
      mapped.forEach(({ header, key }) => { rec[key] = raw[header] || ""; });
      return rec;
    });
    return { headers, mapped, unknown, rows };
  }

  function excelTemplate() {
    return EXCEL_HEADERS.join(",") + "\n";
  }

  function snapshotLine(p, qty) {
    return {
      productId: p.id,
      productNo: p.productNo,
      name: p.name,
      qty,
      unit: p.salesUnit,
      category: p.category,
    };
  }

  function requireSales(state) {
    if (state.session.role !== "sales") return "要 Sales 登入先做到。";
    const me = staffBy(state, state.session.email);
    if (!me || !me.enabled) return "呢個 Sales 帳已停用。";
    return "";
  }
  function requireBuyer(state) {
    if (state.session.role !== "buyer") return "要買家登入先做到。";
    const me = buyerBy(state, state.session.email);
    if (!me || !me.enabled) return "呢個買家帳已停用。";
    return "";
  }

  function reduce(state, action) {
    const s = clone(state);
    const t = action.type;

    if (t === "RESET") return ok(seed(), "已重置種子資料。");

    if (t === "LOGIN_SALES") {
      const email = String(action.email || "").trim().toLowerCase();
      const u = staffBy(s, email);
      if (!u || u.password !== action.password) return fail(s, "Sales 登入失敗。");
      if (!u.enabled) return fail(s, "Sales 帳已停用。");
      if (buyerBy(s, email)) return fail(s, "同一 email 不能身兼買家同 Sales。");
      s.session = { role: "sales", email };
      return ok(s, `Sales ${email} 已進入後台。`);
    }

    if (t === "LOGIN_BUYER") {
      const email = String(action.email || "").trim().toLowerCase();
      if (staffBy(s, email)) return fail(s, "呢個 email 係 Sales，不能當買家登入。");
      const u = buyerBy(s, email);
      if (!u || u.password !== action.password) return fail(s, "買家登入失敗。");
      if (!u.enabled) return fail(s, "買家帳已停用，不能登入或送 RFQ。");
      s.session = { role: "buyer", email };
      return ok(s, `買家 ${email} 已進入 storefront。`);
    }

    if (t === "LOGOUT") {
      s.session = { role: "anon", email: "" };
      return ok(s, "已登出。");
    }

    if (t === "BUYER_UPDATE_PROFILE") {
      const err = requireBuyer(s);
      if (err) return fail(s, err);
      const u = buyerBy(s, s.session.email);
      if (action.password) u.password = action.password;
      if (action.name != null) u.name = action.name;
      if (action.companyName != null) u.companyName = action.companyName;
      if (action.companyPhone != null) u.companyPhone = action.companyPhone;
      if (action.companyAddress != null) u.companyAddress = action.companyAddress;
      return ok(s, "買家已更新自己的公司資料／密碼。Sales 後台改唔到呢啲。");
    }

    if (t === "STAFF_CREATE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const email = String(action.email || "").trim().toLowerCase();
      if (!email) return fail(s, "要有員工 email。");
      if (staffBy(s, email) || buyerBy(s, email)) return fail(s, "Email 已被買家或員工使用。");
      s.staff.push({
        email, name: action.name || email, password: action.password || "mattex",
        enabled: true, bootstrap: false,
      });
      return ok(s, `已開員工 ${email}。不能自助註冊 Staff。`);
    }

    if (t === "STAFF_DISABLE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const u = staffBy(s, action.email);
      if (!u) return fail(s, "找不到員工。");
      const enabled = s.staff.filter((x) => x.enabled);
      if (enabled.length <= 1 && u.enabled) return fail(s, "最後一個 bootstrap／啟用中 Sales 不能停用。");
      u.enabled = false;
      s.rfqs.forEach((r) => {
        if (r.reviewingBy === u.email) r.reviewingBy = "";
      });
      s.reports.forEach((r) => {
        if (r.lookingBy === u.email) {
          r.lookingBy = "";
          if (r.status === "looking") r.status = "open";
        }
      });
      if (s.session.email === u.email) s.session = { role: "anon", email: "" };
      return ok(s, `已停用 ${u.email}。手上 RFQ／report 放回共用佇列。`);
    }

    if (t === "BUYER_SET_ENABLED") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const u = buyerBy(s, action.email);
      if (!u) return fail(s, "找不到買家。");
      u.enabled = !!action.enabled;
      if (!u.enabled && s.session.email === u.email) s.session = { role: "anon", email: "" };
      return ok(s, `${u.email} 已${u.enabled ? "啟用" : "停用"}（停用後不能登入／送 RFQ）。`);
    }

    if (t === "PRODUCT_CREATE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      if (!matchCategory(action.category)) return fail(s, "Category 必須係現有 17 類之一。");
      if (!String(action.name || "").trim()) return fail(s, "要有 Product name。");
      s.seq.tmp += 1;
      const tmp = `TMP-${String(s.seq.tmp).padStart(4, "0")}`;
      const p = product({
        id: "p-" + tmp.toLowerCase(),
        provisionalSku: tmp,
        productNo: String(action.productNo || "").trim(),
        category: matchCategory(action.category),
        name: action.name,
        sizeDesc: action.sizeDesc || "",
        certifications: action.certifications || "",
        primarySpec: action.primarySpec || "",
        salesUnit: action.salesUnit || "",
        moq: action.moq === "" || action.moq == null ? "" : Number(action.moq),
        leadTime: action.leadTime || "",
        purposes: Array.isArray(action.purposes) ? action.purposes : splitPurposes(action.purposes),
        remark: action.remark || "",
        green: !!action.green,
        hit: !!action.hit,
        image: action.image || "",
        imageSource: action.image ? "upload" : "generated",
        published: false,
      });
      s.products.push(p);
      return ok(s, `已新增草稿 ${p.name}（${tmp}）。買家暫時睇唔到。`);
    }

    if (t === "PRODUCT_UPDATE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.id);
      if (!p || p.deleted) return fail(s, "找不到貨，或已軟刪。");
      const fields = [
        "productNo", "category", "name", "sizeDesc", "certifications", "primarySpec",
        "salesUnit", "leadTime", "remark", "image", "imageSource",
      ];
      fields.forEach((k) => { if (action[k] != null) p[k] = action[k]; });
      if (action.category && !matchCategory(action.category)) return fail(s, "Category 不在閉集。");
      if (action.category) p.category = matchCategory(action.category);
      if (action.moq != null) p.moq = action.moq === "" ? "" : Number(action.moq);
      if (action.purposes != null) p.purposes = Array.isArray(action.purposes) ? action.purposes : splitPurposes(action.purposes);
      if (action.green != null) p.green = !!action.green;
      if (action.hit != null) p.hit = !!action.hit;
      if (action.certFiles != null) p.certFiles = action.certFiles;
      return ok(s, `已更新 ${p.name}。上架狀態不變。`);
    }

    if (t === "PRODUCT_SET_IMAGE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.id);
      if (!p) return fail(s, "找不到貨。");
      p.image = action.image || "";
      p.imageSource = action.imageSource || (p.image ? "upload" : "generated");
      return ok(s, `${p.name} 圖來源＝${p.imageSource}。Chain 真同步不在這期。`);
    }

    if (t === "PRODUCT_PUBLISH") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.id);
      if (!p || p.deleted) return fail(s, "找不到貨。");
      const blockers = publishBlockers(p, s.products);
      if (blockers.length) return fail(s, `不能 Publish：${blockers.join("、")}。`);
      p.published = true;
      p.held = false;
      p.deleted = false;
      return ok(s, `${p.productNo} 已上架。買家而家睇到。圖可空／Gen。`);
    }

    if (t === "PRODUCT_HOLD" || t === "PRODUCT_UNHOLD") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.id);
      if (!p || !p.published || p.deleted) return fail(s, "只能 Hold 已上架、未刪的貨。");
      p.held = t === "PRODUCT_HOLD";
      return ok(s, p.held
        ? `${p.productNo} 已 Hold：買家 catalog 隱藏；已送 RFQ 歷史不動。`
        : `${p.productNo} 已取消 Hold。`);
    }

    if (t === "PRODUCT_DISCONTINUE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.id);
      if (!p) return fail(s, "找不到貨。");
      p.discontinued = !!action.value;
      return ok(s, `${p.name} discontinued＝${p.discontinued}（仍可能睇到，但不能落 RFQ）。`);
    }

    if (t === "PRODUCT_SOFT_DELETE") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.id);
      if (!p) return fail(s, "找不到貨。");
      p.deleted = true;
      p.published = false;
      p.held = false;
      return ok(s, `${p.productNo || p.provisionalSku} 已軟刪。Excel 同一正式 SKU 可復活成草稿。`);
    }

    if (t === "EXCEL_IMPORT") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const parsed = typeof action.csv === "string" ? parseExcelCsv(action.csv) : action.parsed;
      const results = [];
      parsed.rows.forEach((row) => {
        const name = String(row.name || "").trim();
        const cat = matchCategory(row.category);
        if (!name || !cat) {
          results.push({ line: row._line, ok: false, msg: !name ? "缺 Product name" : `Category「${row.category}」不在 17 類閉集` });
          return;
        }
        const sku = String(row.productNo || "").trim();
        const tmp = String(row.provisionalSku || "").trim();
        let p = null;
        if (sku) p = s.products.find((x) => String(x.productNo || "").toUpperCase() === sku.toUpperCase());
        if (!p && tmp) p = s.products.find((x) => x.provisionalSku === tmp || x.id === tmp);
        const tags = parseTags(row.tags);
        const purposes = splitPurposes(row.purposes);
        const imgRaw = String(row.image || "").trim();
        const imgIsGen = !imgRaw || /^gen/i.test(imgRaw);
        if (!p) {
          s.seq.tmp += 1;
          const provisionalSku = tmp || `TMP-${String(s.seq.tmp).padStart(4, "0")}`;
          p = product({
            id: "p-xls-" + s.seq.tmp,
            provisionalSku,
            productNo: sku,
            category: cat,
            name,
            sizeDesc: row.sizeDesc || "",
            certifications: row.certifications || "",
            primarySpec: row.primarySpec || "",
            salesUnit: row.salesUnit || "",
            moq: row.moq === "" ? "" : Number(row.moq),
            leadTime: row.leadTime || "",
            purposes,
            remark: row.remark || "",
            green: tags.green,
            hit: tags.hit,
            image: imgIsGen ? "" : imgRaw,
            imageSource: imgIsGen ? "generated" : "upload",
            published: false,
          });
          s.products.push(p);
          results.push({ line: row._line, ok: true, msg: `新增草稿 ${name}（${p.provisionalSku}）` });
          return;
        }
        if (p.deleted) {
          p.deleted = false;
          p.published = false;
          p.held = false;
          results.push({ line: row._line, ok: true, msg: `復活 ${sku || tmp} 成未上架草稿` });
        } else {
          results.push({ line: row._line, ok: true, msg: p.published
            ? `更新已上架 ${p.productNo}（不上架狀態不變）`
            : `更新草稿 ${p.provisionalSku}` });
        }
        p.category = cat;
        p.name = name;
        if (sku) p.productNo = sku;
        if (row.sizeDesc != null) p.sizeDesc = row.sizeDesc;
        if (row.certifications != null) p.certifications = row.certifications;
        if (row.primarySpec != null) p.primarySpec = row.primarySpec;
        if (row.salesUnit != null) p.salesUnit = row.salesUnit;
        if (row.moq !== "" && row.moq != null) p.moq = Number(row.moq);
        if (row.leadTime != null) p.leadTime = row.leadTime;
        p.purposes = purposes.length ? purposes : p.purposes;
        if (row.remark != null) p.remark = row.remark;
        if (String(row.tags || "").trim()) {
          p.green = tags.green;
          p.hit = tags.hit;
        }
        const officialImg = p.imageSource === "upload" || p.imageSource === "chain";
        if (!imgIsGen) {
          p.image = imgRaw;
          p.imageSource = "upload";
        } else if (!officialImg) {
          p.imageSource = "generated";
        }
      });
      s.lastExcel = results;
      const okN = results.filter((r) => r.ok).length;
      const badN = results.length - okN;
      return ok(s, `Excel 完成：${okN} 列成功、${badN} 列失敗。多餘欄已忽略。`);
    }

    if (t === "CART_ADD") {
      const err = requireBuyer(s);
      if (err) return fail(s, err);
      const p = productBy(s, action.productId);
      if (!p || !canOrder(p)) return fail(s, "呢隻貨而家不能加入（未上架／Hold／停產／已刪）。");
      const email = s.session.email;
      s.carts[email] = s.carts[email] || [];
      const line = s.carts[email].find((l) => l.productId === p.id);
      if (line) line.qty += Number(action.qty || 1);
      else s.carts[email].push({ productId: p.id, qty: Number(action.qty || 1) });
      return ok(s, `已加入 ${p.name}。`);
    }

    if (t === "CART_REMOVE") {
      const err = requireBuyer(s);
      if (err) return fail(s, err);
      const email = s.session.email;
      s.carts[email] = (s.carts[email] || []).filter((l) => l.productId !== action.productId);
      return ok(s, "已從 cart 移除。");
    }

    if (t === "RFQ_SUBMIT") {
      const err = requireBuyer(s);
      if (err) return fail(s, err);
      const email = s.session.email;
      const cart = s.carts[email] || [];
      if (!cart.length) return fail(s, "Cart 係空。");
      const blocked = [];
      const lines = [];
      cart.forEach((l) => {
        const p = productBy(s, l.productId);
        if (!p || !canOrder(p)) blocked.push((p && p.name) || l.productId);
        else lines.push(snapshotLine(p, l.qty));
      });
      if (blocked.length) return fail(s, `不能送出：${blocked.join("、")} 已 Hold／不能訂。請先喺 cart 拎走。`);
      s.seq.rfq += 1;
      const id = "RFQ-" + s.seq.rfq;
      s.rfqs.push({
        id,
        buyerEmail: email,
        lines,
        note: action.note || "",
        status: "received",
        reviewingBy: "",
        reason: "",
        tmsRfqId: "",
        tmsPayload: null,
        history: [{ at: "now", event: "submitted" }],
      });
      s.carts[email] = [];
      return ok(s, `已送出 ${id}。Sales inbox 而家睇到。`);
    }

    if (t === "RFQ_START_REVIEW") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const r = s.rfqs.find((x) => x.id === action.id);
      if (!r) return fail(s, "找不到 RFQ。");
      if (r.status === "accepted" || r.status === "rejected") return fail(s, `${r.status} 單不能再搶。`);
      if (r.reviewingBy && r.reviewingBy !== s.session.email) {
        return fail(s, `而家 ${r.reviewingBy} 佔緊 reviewing。`);
      }
      r.status = "reviewing";
      r.reviewingBy = s.session.email;
      return ok(s, `${r.id} → reviewing（${s.session.email}）。`);
    }

    if (t === "RFQ_ACCEPT" || t === "RFQ_RETURN" || t === "RFQ_REJECT") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const r = s.rfqs.find((x) => x.id === action.id);
      if (!r) return fail(s, "找不到 RFQ。");
      if (r.status === "accepted") return fail(s, "已 accepted，內容已鎖。");
      if (r.status === "rejected") return fail(s, "已 rejected，終態。");
      if (t === "RFQ_RETURN" && !String(action.reason || "").trim()) return fail(s, "退回必須寫原因。");
      if (t === "RFQ_REJECT" && !String(action.reason || "").trim()) return fail(s, "拒絕必須寫原因。");
      r.reviewingBy = "";
      r.reason = action.reason || "";
      if (t === "RFQ_ACCEPT") r.status = "accepted";
      if (t === "RFQ_RETURN") r.status = "returned";
      if (t === "RFQ_REJECT") r.status = "rejected";
      r.history.push({ at: "now", event: r.status, reason: r.reason });
      return ok(s, `${r.id} → ${r.status}${r.reason ? "：" + r.reason : ""}。不出價、不建 PO。`);
    }

    if (t === "RFQ_RESUBMIT") {
      const err = requireBuyer(s);
      if (err) return fail(s, err);
      const r = s.rfqs.find((x) => x.id === action.id);
      if (!r || r.buyerEmail !== s.session.email) return fail(s, "不是你嘅單。");
      if (r.status !== "returned") return fail(s, r.status === "rejected" ? "Rejected 係終態，不能再送。" : "只有 returned 可以改同一張再送。");
      if (action.lines) r.lines = action.lines;
      r.status = "received";
      r.reviewingBy = "";
      r.history.push({ at: "now", event: "resubmitted" });
      return ok(s, `${r.id} 已再送，回到 received。`);
    }

    if (t === "RFQ_UPLOAD_TMS") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const r = s.rfqs.find((x) => x.id === action.id);
      if (!r) return fail(s, "找不到 RFQ。");
      if (r.status !== "accepted") return fail(s, "只有 accepted 可以 Upload to TMS。");
      if (r.tmsRfqId) return fail(s, `已上傳過（${r.tmsRfqId}），不能再開新 TMS 單。`);
      const payload = {
        model: "inbound_request_for_quotes",
        source: "subbie-admin-prototype",
        rfqId: r.id,
        buyerEmail: r.buyerEmail,
        lines: r.lines,
        note: r.note,
      };
      if (action.fail) {
        s.lastTms = { ok: false, payload, error: "模擬 TMS 失敗（UAT 未打出去）" };
        return fail(s, "TMS 模擬失敗。可重試。未寫 tmsRfqId。");
      }
      s.seq.tms += 1;
      r.tmsRfqId = "TMS-INB-" + s.seq.tms;
      r.tmsPayload = payload;
      s.lastTms = { ok: true, id: r.tmsRfqId, payload };
      return ok(s, `模擬上傳成功：${r.tmsRfqId}。真 UAT 不在這期。`);
    }

    if (t === "REPORT_CREATE") {
      const role = s.session.role;
      if (role !== "buyer" && role !== "sales") return fail(s, "要登入先開 report。");
      if (role === "buyer") {
        const b = buyerBy(s, s.session.email);
        if (!b || !b.enabled) return fail(s, "買家已停用。");
      }
      const p = productBy(s, action.productId);
      if (!p || !p.published || p.deleted) return fail(s, "只能 report 已上架貨。");
      const type = action.reportType;
      if (!["圖片不對", "資料不對", "其他"].includes(type)) return fail(s, "要選類型。");
      if (!String(action.text || "").trim()) return fail(s, "要寫文字。");
      s.seq.report += 1;
      const id = "RPT-" + s.seq.report;
      s.reports.push({
        id,
        productId: p.id,
        productNo: p.productNo,
        type,
        text: action.text,
        evidence: action.evidence || "",
        status: "open",
        lookingBy: "",
        filerEmail: s.session.email,
        filerRole: role,
      });
      return ok(s, `${id} 已入共用佇列（${p.productNo}／${type}）。證據圖可選。`);
    }

    if (t === "REPORT_START_LOOKING") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const r = s.reports.find((x) => x.id === action.id);
      if (!r || r.status === "dismissed" || r.status === "fixed") return fail(s, "呢張 report 已完。");
      if (r.lookingBy && r.lookingBy !== s.session.email) return fail(s, `${r.lookingBy} 睇緊。`);
      r.status = "looking";
      r.lookingBy = s.session.email;
      return ok(s, `${r.id} → looking。`);
    }

    if (t === "REPORT_DISMISS" || t === "REPORT_FIX") {
      const err = requireSales(s);
      if (err) return fail(s, err);
      const r = s.reports.find((x) => x.id === action.id);
      if (!r) return fail(s, "找不到 report。");
      const p = productBy(s, r.productId);
      if (t === "REPORT_DISMISS") {
        r.status = "dismissed";
        r.lookingBy = "";
        return ok(s, `${r.id} dismissed。貨狀態不變。`);
      }
      if (action.hold && p && p.published) p.held = true;
      if (action.markChain && p) p.imageSource = p.imageSource === "generated" ? "generated" : p.imageSource;
      if (action.markChain && p) p.needsChainImage = true;
      if (action.patch && p) {
        Object.keys(action.patch).forEach((k) => { p[k] = action.patch[k]; });
      }
      r.status = "fixed";
      r.lookingBy = "";
      r.fixNote = action.note || (action.hold ? "Hold" : "fixed");
      return ok(s, `${r.id} fixed。${action.hold ? "貨已 Hold。" : ""}${action.markChain ? "已標需重拉 Chain 圖。" : ""}預設不自動 Hold。`);
    }

    return fail(s, "未知動作：" + t);
  }

  function inspect(state) {
    const products = state.products;
    return {
      session: state.session.role === "anon" ? "未登入" : `${state.session.role} · ${state.session.email}`,
      catalog: `${products.filter(buyerVisible).length} 隻買家睇到`,
      pipeline: `草稿 ${products.filter((p) => !p.published && !p.deleted).length}／Hold ${products.filter((p) => p.held && !p.deleted).length}／軟刪 ${products.filter((p) => p.deleted).length}`,
      rfqs: `${state.rfqs.filter((r) => r.status === "received" || r.status === "reviewing" || r.status === "returned").length} 張未完 · 共 ${state.rfqs.length}`,
      reports: `${state.reports.filter((r) => r.status === "open" || r.status === "looking").length} 張待處理`,
      tms: state.lastTms
        ? (state.lastTms.ok ? state.lastTms.id : "上次模擬失敗")
        : "尚未上傳",
      last: state.lastDelta,
      lastOk: state.lastOk,
    };
  }

  return { CATEGORIES, EXCEL_HEADERS, seed, reduce, parseExcelCsv, excelTemplate, inspect, buyerVisible, canOrder, publishBlockers, productBy, clone };
})();
