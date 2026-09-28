import "./ssrNodePolyfill.js";
import { absAsset, absUrl, siteOrigin, stripLocale, withLocale } from "./locale.js";
import { OG_HEIGHT, OG_WIDTH, categoryOgPath, ogImagePath } from "./ogImage.js";
import { seoCopy } from "./seoCopy.js";
import { breadcrumbJsonLd, orgJsonLd, productJsonLd } from "./seoJsonLd.js";
import {
  catalogPathForCategory,
  getCategoryBySlug,
  getCategoryDefs,
  getGreenProducts,
  getProduct,
  getProductsBySupplier,
  getSupplier,
  getSuppliers,
  getTopProducts,
  getTopProductsForSupplier,
  isBuyerVisible,
  isDiscontinued,
  searchProducts,
  supplierDisplayName,
  supplierPath,
} from "./store.js";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function safeImage(src) {
  const value = String(src || "").trim();
  if (!value || value.startsWith("data:")) return "";
  return value;
}

function slimProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    productNo: product.productNo || "",
    sku: product.productNo || product.id,
    category: product.category || "",
    description: String(product.description || "").slice(0, 400),
    image: safeImage(product.image),
    tailorMade: Boolean(product.tailorMade),
    moq: product.moq || 1,
    unit: product.unit || "",
  };
}

export function parsePublicPath(pathname) {
  const raw = String(pathname || "").split("?")[0];
  const trimmed = raw.replace(/\/+$/, "") || "/";
  const parts = trimmed.split("/").filter(Boolean);
  const lang = parts[0] === "zh" || parts[0] === "en" ? parts[0] : null;
  if (!lang) return null;
  const rest = parts.slice(1);
  if (!rest.length) return { kind: "home", lang, path: withLocale(lang, "/") };
  if (rest[0] === "green" && rest.length === 1) {
    return { kind: "green", lang, path: withLocale(lang, "/green") };
  }
  if (rest[0] === "catalog" && rest[1] && rest.length === 2) {
    return { kind: "catalog", lang, slug: rest[1], path: withLocale(lang, `/catalog/${rest[1]}`) };
  }
  if (rest[0] === "details" && rest[1] && rest.length === 2) {
    return { kind: "details", lang, id: rest[1], path: withLocale(lang, `/details/${rest[1]}`) };
  }
  if (rest[0] === "supplier" && rest[1] && rest.length === 2) {
    return { kind: "supplier", lang, slug: rest[1], path: withLocale(lang, `/supplier/${rest[1]}`) };
  }
  return null;
}

function crumbs(origin, lang, items) {
  return breadcrumbJsonLd(
    origin,
    items.map((item) => ({ name: item.name, path: withLocale(lang, item.path) }))
  );
}

export function resolvePublicPage(pathname, origin = siteOrigin()) {
  const parsed = parsePublicPath(pathname);
  if (!parsed) return null;
  const copy = seoCopy(parsed.lang);
  const base = {
    kind: parsed.kind,
    lang: parsed.lang,
    path: parsed.path,
    ogType: "website",
    image: "/og-default.webp",
    product: null,
    category: null,
    supplier: null,
  };

  if (parsed.kind === "home") {
    return {
      ...base,
      title: copy.homeTitle,
      description: copy.homeDesc,
      jsonLd: [orgJsonLd(origin), crumbs(origin, parsed.lang, [{ name: "Mattex Marketplace", path: "/" }])],
      heading: copy.homeTitle,
      body: copy.homeDesc,
    };
  }

  if (parsed.kind === "green") {
    return {
      ...base,
      title: copy.greenTitle,
      description: copy.greenDesc,
      jsonLd: [
        orgJsonLd(origin),
        crumbs(origin, parsed.lang, [
          { name: "Mattex Marketplace", path: "/" },
          { name: "Green", path: "/green" },
        ]),
      ],
      heading: copy.greenTitle,
      body: copy.greenDesc,
    };
  }

  if (parsed.kind === "catalog") {
    const category = getCategoryBySlug(parsed.slug) || getCategoryDefs().find((item) => item.id === parsed.slug);
    const name = category?.name || parsed.slug;
    return {
      ...base,
      title: copy.categoryTitle(name),
      description: copy.categoryDesc(name),
      image: categoryOgPath(parsed.slug),
      category: { id: parsed.slug, name },
      jsonLd: [
        orgJsonLd(origin),
        crumbs(origin, parsed.lang, [
          { name: "Mattex Marketplace", path: "/" },
          { name, path: `/catalog/${parsed.slug}` },
        ]),
      ],
      heading: name,
      body: copy.categoryDesc(name),
    };
  }

  if (parsed.kind === "supplier") {
    const supplier = getSupplier(parsed.slug) || getSuppliers().find((item) => item.slug === parsed.slug);
    const name = supplier?.name || parsed.slug;
    return {
      ...base,
      title: copy.supplierTitle(name),
      description: copy.supplierDesc(name),
      supplier: { slug: parsed.slug, name },
      jsonLd: [
        orgJsonLd(origin),
        crumbs(origin, parsed.lang, [
          { name: "Mattex Marketplace", path: "/" },
          { name, path: `/supplier/${parsed.slug}` },
        ]),
      ],
      heading: name,
      body: copy.supplierDesc(name),
    };
  }

  const product = getProduct(parsed.id);
  if (!product || isDiscontinued(product) || !isBuyerVisible(product)) {
    return {
      ...base,
      title: copy.homeTitle,
      description: copy.homeDesc,
      heading: copy.homeTitle,
      body: copy.homeDesc,
      jsonLd: [orgJsonLd(origin)],
    };
  }
  const slim = slimProduct(product);
  return {
    ...base,
    ogType: "product",
    title: copy.productTitle(product.name),
    description: copy.productDesc(product),
    image: slim.image || "/og-default.webp",
    product: slim,
    jsonLd: [
      orgJsonLd(origin),
      productJsonLd(origin, product, parsed.lang),
      crumbs(origin, parsed.lang, [
        { name: "Mattex Marketplace", path: "/" },
        { name: product.category, path: catalogPathForCategory(product.category) },
        { name: product.name, path: `/details/${product.id}` },
      ]),
    ],
    heading: product.name,
    body: copy.productDesc(product),
  };
}

function headSnippet(page, origin) {
  const url = absUrl(origin, page.path);
  const enUrl = absUrl(origin, withLocale("en", stripLocale(page.path)));
  const zhUrl = absUrl(origin, withLocale("zh", stripLocale(page.path)));
  const img = absAsset(origin, ogImagePath(page.image || "/og-default.webp"));
  const robots = page.noindex ? "noindex, nofollow" : "index, follow";
  const payload = Array.isArray(page.jsonLd) ? page.jsonLd.filter(Boolean) : page.jsonLd ? [page.jsonLd] : [];
  const json = payload.length
    ? `<script type="application/ld+json">${JSON.stringify(payload.length === 1 ? payload[0] : payload).replace(/</g, "\\u003c")}</script>`
    : "";
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(enUrl)}" />`,
    `<link rel="alternate" hreflang="zh-Hant" href="${esc(zhUrl)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(enUrl)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:type" content="${esc(page.ogType || "website")}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:image:url" content="${esc(img)}" />`,
    img.startsWith("https://") ? `<meta property="og:image:secure_url" content="${esc(img)}" />` : "",
    `<meta property="og:image:type" content="image/webp" />`,
    `<meta property="og:image:width" content="${OG_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${esc(page.title)}" />`,
    `<link rel="image_src" href="${esc(img)}" />`,
    `<meta property="og:site_name" content="Mattex Marketplace" />`,
    `<meta property="og:locale" content="${page.lang === "zh" ? "zh_HK" : "en_HK"}" />`,
    `<meta property="og:locale:alternate" content="${page.lang === "zh" ? "en_HK" : "zh_HK"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    json,
  ]
    .filter(Boolean)
    .join("\n    ");
}

function bootPayload(page) {
  return {
    kind: page.kind,
    lang: page.lang,
    path: page.path,
    title: page.title,
    description: page.description,
    image: page.image,
    ogType: page.ogType,
    product: page.product,
    category: page.category,
    supplier: page.supplier,
  };
}

function paragraphs(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${esc(line)}</p>`)
    .join("\n");
}

const HOME_COPY = {
  en: {
    heroHeadline: "Engineering products, ready to quote",
    heroSupport: "Catalog SKUs or your own spec — both go to the same WhatsApp quote.",
    browseCatalog: "Browse catalog",
    materialCategories: "Material categories",
    greenHeadline: "Lower-impact picks for greener builds",
    greenSupport: "FSC timber, high-R insulation, recycled aggregate, and low-VOC boards — ready to quote.",
    topProducts: "Top products",
    supplierCompanies: "Supplier companies",
    supplierSupport: "Open a company page for top products and a searchable catalog",
    howHeadline: "From catalog to quote in three steps",
    step1Title: "Browse specs",
    step1Body: "Open product details for datasheet-style info before you quote.",
    step2Title: "Ask, add, or tailor make",
    step2Body: "WhatsApp for price, add catalog SKUs, or describe a Tailor Made Product if it is not listed.",
    step3Title: "Send via WhatsApp",
    step3Body: "Review quantities in your cart. We prepare a PDF with product images, then you open WhatsApp to send the PDF link to the supplier.",
    customPitchTitle: "Not in the catalog? Still quote it.",
    customPitchBody: "Name the material, attach drawings or spec files, and drop it in the same cart as listed SKUs.",
    allProductsTitle: "All products",
    searchHint: "Search by spec, size, material, SKU, supplier, or description",
  },
  zh: {
    heroHeadline: "工程產品，即時報價",
    heroSupport: "目錄 SKU 或你自己的規格，都經同一條 WhatsApp 問價。",
    browseCatalog: "瀏覽目錄",
    materialCategories: "物料分類",
    greenHeadline: "較低碳影響的建材選擇",
    greenSupport: "FSC 木材、高 R 值隔熱、再生骨料、低 VOC 板材 — 可直接問價。",
    topProducts: "熱門產品",
    supplierCompanies: "供應商公司",
    supplierSupport: "進入公司頁查看熱門產品與可搜尋目錄",
    howHeadline: "三步完成問價",
    step1Title: "瀏覽規格",
    step1Body: "先開啟產品詳情，查看規格再問價。",
    step2Title: "詢價、加入，或度身訂造",
    step2Body: "可用 WhatsApp 問價、加入目錄 SKU，目錄沒有的可新增度身訂造產品。",
    step3Title: "用 WhatsApp 送出",
    step3Body: "在購物車核對數量。系統會準備含產品圖的 PDF 連結，再開 WhatsApp 傳送給供應商。",
    customPitchTitle: "目錄沒有，一樣可以問價",
    customPitchBody: "寫物料名稱、上傳圖則或規格附件，同目錄 SKU 放喺同一個購物車。",
    allProductsTitle: "全部產品",
    searchHint: "用規格、尺寸、物料、SKU、供應商或描述搜尋",
  },
};

function productBlock(lang, product) {
  const href = withLocale(lang, `/details/${product.id}`);
  const categoryHref = withLocale(lang, catalogPathForCategory(product.category));
  const supplierHref = product.supplier ? withLocale(lang, supplierPath(product.supplier)) : "";
  const specs = (product.specs || []).map((line) => `<li>${esc(line)}</li>`).join("");
  const purposes = (product.purposes || []).map((line) => `<li>${esc(line)}</li>`).join("");
  return `<article>
        <p><a href="${esc(categoryHref)}">${esc(product.category)}</a></p>
        <h3><a href="${esc(href)}">${esc(product.name)}</a></h3>
        <p>${esc(product.productNo || product.provisionalSku || "")}${
          product.supplier
            ? ` · <a href="${esc(supplierHref)}">${esc(supplierDisplayName(product.supplier))}</a>`
            : ""
        }</p>
        <p>${esc(
          [
            product.unit ? `Unit ${product.unit}` : "",
            product.moq != null ? `MOQ ${product.moq}` : "",
            product.leadTimeLabel || "",
            product.standard || "",
          ]
            .filter(Boolean)
            .join(" · ")
        )}</p>
        ${paragraphs(product.description)}
        ${paragraphs(product.sizeDesc)}
        ${paragraphs(product.primarySpec)}
        ${paragraphs(product.certifications)}
        ${specs ? `<ul>${specs}</ul>` : ""}
        ${purposes ? `<ul>${purposes}</ul>` : ""}
        ${paragraphs(product.remark)}
      </article>`;
}

function categoryNav(lang, activeId) {
  return getCategoryDefs()
    .filter((category) => category.count > 0)
    .map((category) => {
      const href = withLocale(lang, `/catalog/${category.id}`);
      const current = category.id === activeId ? ` aria-current="page"` : "";
      return `<li><a href="${esc(href)}"${current}>${esc(category.name)}</a> — ${category.count}</li>`;
    })
    .join("\n");
}

function visibleProducts(categoryName) {
  return searchProducts("", categoryName || "").filter((product) => isBuyerVisible(product) && !isDiscontinued(product));
}

function pageContent(page) {
  const lang = page.lang === "zh" ? "zh" : "en";
  const copy = HOME_COPY[lang];
  if (page.kind === "details" && page.product) {
    const product = getProduct(page.product.id) || page.product;
    const image = safeImage(product.image);
    const images = (product.images || []).map((src) => safeImage(src)).filter(Boolean);
    const gallery = images.length ? images : image ? [image] : [];
    const specs = (product.specs || []).map((line) => `<li>${esc(line)}</li>`).join("");
    const purposes = (product.purposes || []).map((term) => `<li>${esc(term)}</li>`).join("");
    const lead = product.leadTime
      ? product.leadTime.min === product.leadTime.max
        ? String(product.leadTime.min)
        : `${product.leadTime.min}–${product.leadTime.max}`
      : product.leadTimeLabel || "";
    return `<article class="mattex-ssr">
      <nav>
        <a href="${esc(withLocale(lang, "/"))}">${lang === "zh" ? "產品目錄" : "Catalog"}</a>
        /
        <a href="${esc(withLocale(lang, catalogPathForCategory(product.category)))}">${esc(product.category)}</a>
      </nav>
      ${gallery.map((src) => `<img src="${esc(src)}" alt="${esc(product.name)}" />`).join("\n")}
      <p><a href="${esc(withLocale(lang, catalogPathForCategory(product.category)))}">${esc(product.category)}</a></p>
      <h1>${esc(product.name)}</h1>
      <p>${lang === "zh" ? "供應商" : "Supplier"}: ${
        product.supplier
          ? `<a href="${esc(withLocale(lang, supplierPath(product.supplier)))}">${esc(supplierDisplayName(product.supplier))}</a>`
          : "Mattex"
      }</p>
      ${paragraphs(product.description)}
      <dl>
        <dt>${lang === "zh" ? "產品編號" : "Product no."}</dt><dd>${esc(product.productNo || product.id)}</dd>
        <dt>MOQ</dt><dd>${esc(product.moq)} ${esc(product.unit)}</dd>
        <dt>${lang === "zh" ? "交貨期" : "Lead time"}</dt><dd>${esc(lead)} ${lang === "zh" ? "日" : "days"}</dd>
        <dt>${lang === "zh" ? "標準" : "Standard"}</dt><dd>${esc(product.standard)}</dd>
      </dl>
      ${paragraphs(product.sizeDesc)}
      ${paragraphs(product.primarySpec)}
      ${paragraphs(product.certifications)}
      <h2>${lang === "zh" ? "規格" : "Specifications"}</h2>
      ${specs ? `<ul>${specs}</ul>` : ""}
      ${
        purposes
          ? `<h2>${lang === "zh" ? "用途" : "Purposes"}</h2><ul>${purposes}</ul>`
          : ""
      }
      ${product.remark ? `<h2>${lang === "zh" ? "備註" : "Remark"}</h2>${paragraphs(product.remark)}` : ""}
    </article>`;
  }
  if (page.kind === "catalog" && page.category) {
    const products = visibleProducts(page.category.name);
    return `<article class="mattex-ssr">
      <nav>
        <a href="${esc(withLocale(lang, "/"))}">${esc(copy.allProductsTitle)}</a>
        / ${esc(page.category.name)}
      </nav>
      <aside>
        <h2>${esc(copy.materialCategories)}</h2>
        <ul>${categoryNav(lang, page.category.id)}</ul>
      </aside>
      <h1>${esc(page.category.name)}</h1>
      <p>${esc(page.body || page.description)}</p>
      <p>${esc(copy.searchHint)}</p>
      <p>${products.length} ${lang === "zh" ? "件產品" : "products"}</p>
      ${products.map((product) => productBlock(lang, product)).join("\n")}
    </article>`;
  }
  if (page.kind === "supplier" && page.supplier) {
    const supplier = getSupplier(page.supplier.slug) || page.supplier;
    const products = getProductsBySupplier(supplier.slug).filter((product) => isBuyerVisible(product) && !isDiscontinued(product));
    const top = getTopProductsForSupplier(supplier.slug, 5);
    const categories = supplier.categories || [];
    return `<article class="mattex-ssr">
      <p>${lang === "zh" ? "供應商" : "Supplier"}</p>
      <h1>${esc(supplier.name)}</h1>
      <p>${esc(copy.supplierSupport)}</p>
      <p>${products.length} ${lang === "zh" ? "件產品" : "products"}${categories.length ? ` · ${esc(categories.join(", "))}` : ""}</p>
      <section>
        <h2>${esc(copy.topProducts)}</h2>
        ${top.map((product) => productBlock(lang, product)).join("\n")}
      </section>
      <section>
        <h2>${lang === "zh" ? `${esc(supplier.name)} 的產品` : `Products from ${esc(supplier.name)}`}</h2>
        <ul>${categoryNav(lang)}</ul>
        ${products.map((product) => productBlock(lang, product)).join("\n")}
      </section>
    </article>`;
  }
  if (page.kind === "green") {
    const products = getGreenProducts().filter((product) => isBuyerVisible(product));
    return `<article class="mattex-ssr">
      <p>${lang === "zh" ? "綠色優選" : "Green preferred"}</p>
      <h1>${esc(copy.greenHeadline)}</h1>
      <p>${esc(copy.greenSupport)}</p>
      <h2>${lang === "zh" ? "綠色產品" : "Green products"}</h2>
      <p>${products.length} ${lang === "zh" ? "件產品" : "products"}</p>
      ${products.map((product) => productBlock(lang, product)).join("\n")}
    </article>`;
  }
  const categories = getCategoryDefs().filter((category) => category.count > 0);
  const products = visibleProducts();
  const featured = getTopProducts(12);
  const greens = getGreenProducts(8);
  const suppliers = getSuppliers();
  return `<article class="mattex-ssr">
      <h1>${esc(copy.heroHeadline)}</h1>
      <p>${esc(copy.heroSupport)}</p>
      <p><a href="${esc(withLocale(lang, "/catalog"))}">${esc(copy.browseCatalog)}</a></p>
      <section>
        <h2>${esc(copy.materialCategories)}</h2>
        <ul>
          ${categories
            .map(
              (category) =>
                `<li><a href="${esc(withLocale(lang, `/catalog/${category.id}`))}">${esc(category.name)}</a> — ${category.count}</li>`
            )
            .join("\n          ")}
        </ul>
      </section>
      <section>
        <h2>${esc(copy.greenHeadline)}</h2>
        <p>${esc(copy.greenSupport)}</p>
        ${greens.map((product) => productBlock(lang, product)).join("\n")}
      </section>
      <section>
        <h2>${esc(copy.topProducts)}</h2>
        ${featured.map((product) => productBlock(lang, product)).join("\n")}
      </section>
      <section>
        <h2>${esc(copy.supplierCompanies)}</h2>
        <p>${esc(copy.supplierSupport)}</p>
        <ul>
          ${suppliers
            .map(
              (supplier) =>
                `<li><a href="${esc(withLocale(lang, `/supplier/${supplier.slug}`))}">${esc(supplier.name)}</a> — ${supplier.count || 0}</li>`
            )
            .join("\n          ")}
        </ul>
      </section>
      <section>
        <h2>${esc(copy.howHeadline)}</h2>
        <h3>${esc(copy.step1Title)}</h3>
        <p>${esc(copy.step1Body)}</p>
        <h3>${esc(copy.step2Title)}</h3>
        <p>${esc(copy.step2Body)}</p>
        <h3>${esc(copy.step3Title)}</h3>
        <p>${esc(copy.step3Body)}</p>
      </section>
      <section>
        <h2>${esc(copy.customPitchTitle)}</h2>
        <p>${esc(copy.customPitchBody)}</p>
      </section>
      <section>
        <h2>${esc(copy.allProductsTitle)}</h2>
        <p>${esc(copy.searchHint)}</p>
        <p>${products.length} products</p>
        ${products.map((product) => productBlock(lang, product)).join("\n")}
      </section>
    </article>`;
}

function ssrBody(page) {
  return `<div data-ssr="mattex">
    ${pageContent(page)}
  </div>`;
}

export function injectPublicDocument(html, pathname, origin = siteOrigin()) {
  const page = resolvePublicPage(pathname, origin);
  if (!page) return html;
  const snippet = headSnippet(page, origin);
  const htmlLang = page.lang === "zh" ? "zh-Hant" : "en";
  let next = String(html || "").replace(/<html lang="[^"]*">/, `<html lang="${htmlLang}">`);
  if (next.includes("<!--seo-head-->")) {
    next = next.replace(/<title>[^<]*<\/title>\s*/, "");
    next = next.replace(/<!--seo-head-->[\s\S]*?<!--\/seo-head-->/, `<!--seo-head-->\n    ${snippet}\n    <!--/seo-head-->`);
  } else {
    next = next.replace(/<title>[^<]*<\/title>/, snippet);
  }
  const boot = `<script>window.__MATTEX_PAGE__=${JSON.stringify(bootPayload(page)).replace(/</g, "\\u003c")};</script>`;
  if (next.includes("window.__MATTEX_PAGE__")) {
    next = next.replace(/<script>window\.__MATTEX_PAGE__=[\s\S]*?<\/script>/, boot);
  } else {
    next = next.replace('<div id="root">', `${boot}\n    <div id="root">`);
  }
  const root = `<div id="root"><!--app-root-->${ssrBody(page)}<!--/app-root--></div>`;
  if (next.includes("<!--app-root-->")) {
    next = next.replace(/<div id="root"><!--app-root-->[\s\S]*?<!--\/app-root--><\/div>/, root);
  } else if (!next.includes('data-ssr="mattex"')) {
    next = next.replace(/<div id="root"><\/div>/, root);
    next = next.replace(/<div id="root">\s*<\/div>/, root);
  }
  return next;
}

export function listPublicPrerenderPaths() {
  const paths = [];
  const products = searchProducts("").filter((p) => !isDiscontinued(p) && isBuyerVisible(p));
  const suppliers = getSuppliers();
  for (const lang of ["en", "zh"]) {
    paths.push(withLocale(lang, "/"));
    paths.push(withLocale(lang, "/green"));
    for (const category of getCategoryDefs()) {
      paths.push(withLocale(lang, `/catalog/${category.id}`));
    }
    for (const supplier of suppliers) {
      paths.push(withLocale(lang, `/supplier/${supplier.slug}`));
    }
    for (const product of products) {
      paths.push(withLocale(lang, `/details/${product.id}`));
    }
  }
  return paths;
}
