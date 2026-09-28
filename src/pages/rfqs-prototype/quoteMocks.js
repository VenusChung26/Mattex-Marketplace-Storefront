/**
 * PROTOTYPE — mock multi-supplier quotes for an RFQ.
 * In-memory only; not persisted.
 *
 * Buyer may request 1 product; a supplier can reply with a SET (2+ SKUs)
 * that maps to that same RFQ line (productId).
 */
import { getProduct, supplierDisplayName, getQuoteVersion, getEffectiveQuoteVersion } from "../../lib/store";

const SUPPLIER_POOL = [
  { name: "Harbor Precast Co.", leadDays: 5, note: "Ex-works + site unload", paymentTerms: "Net 30" },
  { name: "Bayform Concrete Systems", leadDays: 7, note: "Includes delivery to site", paymentTerms: "COD" },
  { name: "MetroFab Structural", leadDays: 10, note: "Cut-to-length available", paymentTerms: "30% deposit, balance on delivery" },
  { name: "Northspan Steel Group", leadDays: 8, note: "Partial shipment OK", paymentTerms: "Net 45" },
];

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function money(n) {
  return Math.round(n * 100) / 100;
}

function catalogMeta(line) {
  const product = line?.custom ? null : getProduct(line.productId);
  return {
    product,
    description: String(product?.description || line?.description || "").trim(),
    productNo: product?.productNo || line?.productNo || "",
    image: product?.image || line?.image || null,
    moq: Math.max(1, Number(product?.moq || line?.moq) || 1),
    green: Boolean(product?.green || line?.green),
  };
}

/** Build 3–4 supplier quotes — may return a multi-SKU set for one RFQ line. */
export function buildPrototypeQuotes(rfq) {
  if (!rfq?.lines?.length) return [];
  const seed = hashSeed(rfq.id);
  const count = 3 + (seed % 2); // 3 or 4
  const suppliers = SUPPLIER_POOL.slice(0, count);

  return suppliers.map((sup, si) => {
    const lines = [];
    rfq.lines.forEach((l, li) => {
      // ~1 in 5 lines skipped by non-first suppliers → different coverage
      const skip = si > 0 && (seed + si * 11 + li * 19) % 5 === 0;
      if (skip) return;

      const listed = l.unitPrice == null ? null : Number(l.unitPrice);
      const asked =
        l.requestedUnitPrice != null && Number(l.requestedUnitPrice) > 0
          ? Number(l.requestedUnitPrice)
          : null;
      const base = asked ?? listed ?? 80 + ((seed + li * 17) % 120);
      const factor = 0.88 + ((seed + si * 13 + li * 7) % 28) / 100;
      const unitPrice = money(base * factor);

      // Some suppliers answer one RFQ item with a 2-piece set
      const asSet = (seed + si * 3 + li * 5) % 4 === 1;

      if (asSet) {
        const mainQty = l.qty;
        const kitQty = Math.max(1, Math.ceil(l.qty / 4));
        const mainUnit = unitPrice;
        const kitUnit = money(unitPrice * 0.18 + 12 + ((seed + si) % 9));
        const meta = catalogMeta(l);
        const kitMeta = catalogMeta({ productId: "pipe-01" });
        const parts = [
          {
            id: `${l.productId}-main`,
            name: `${l.name} — primary member`,
            description: meta.description || "Primary item matching the RFQ line.",
            image: meta.image,
            productNo: meta.productNo,
            moq: meta.moq,
            qty: mainQty,
            unitPrice: mainUnit,
            lineTotal: money(mainUnit * mainQty),
            optional: false,
            green: Boolean(meta.green),
          },
          {
            id: `${l.productId}-kit`,
            name: `${sup.name.split(" ")[0]} pairing / fixings kit`,
            description: "Optional fixings and pairing hardware for site installation.",
            image: kitMeta.image || "/assets/cat-pipe.webp",
            productNo: kitMeta.productNo,
            moq: 1,
            qty: kitQty,
            unitPrice: kitUnit,
            lineTotal: money(kitUnit * kitQty),
            optional: true,
            green: Boolean(kitMeta.green),
          },
        ];
        const lineTotal = money(parts.reduce((s, p) => s + p.lineTotal, 0));
        lines.push({
          productId: l.productId,
          requestName: l.name,
          name: `Set: ${l.name} + kit`,
          description: meta.description
            ? `${meta.description} Quoted as a ${parts.length}-item set; kit is optional.`
            : `Quoted as a ${parts.length}-item set. Select only the items you need.`,
          productNo: meta.productNo,
          qty: l.qty,
          unitPrice: null,
          lineTotal,
          custom: Boolean(l.custom),
          isSet: true,
          setParts: parts,
          image: meta.image,
          moq: meta.moq,
          isAlternate: true,
          green: Boolean(meta.green),
        });
        return;
      }

      const suffix = ["", " — Grade A stock", " / site-cut package", " (alt. SKU)"][si % 4];
      const brandTag = si === 0 ? "" : ` · ${sup.name.split(" ")[0]}`;
      const offeredName = `${l.name}${brandTag}${suffix}`;
      const meta = catalogMeta(l);

      lines.push({
        productId: l.productId,
        requestName: l.name,
        name: offeredName,
        description: meta.description,
        productNo: meta.productNo,
        qty: l.qty,
        unitPrice,
        lineTotal: money(unitPrice * l.qty),
        custom: Boolean(l.custom),
        isSet: false,
        setParts: null,
        image: meta.image,
        moq: meta.moq,
        isAlternate: offeredName !== l.name,
        green: Boolean(meta.green),
      });
    });

    if (!lines.length && rfq.lines[0]) {
      const l = rfq.lines[0];
      const meta = catalogMeta(l);
      const unitPrice = l.unitPrice == null ? 100 : Number(l.unitPrice);
      lines.push({
        productId: l.productId,
        requestName: l.name,
        name: l.name,
        description: meta.description,
        productNo: meta.productNo,
        qty: l.qty,
        unitPrice,
        lineTotal: money(unitPrice * l.qty),
        custom: Boolean(l.custom),
        isSet: false,
        setParts: null,
        image: meta.image,
        moq: meta.moq,
        isAlternate: false,
        green: Boolean(meta.green),
      });
    }

    const total = lines.reduce((s, row) => s + row.lineTotal, 0);
    return {
      id: `q-${rfq.id}-${si}`,
      supplierName: sup.name,
      leadDays: sup.leadDays + (si % 3),
      note: sup.note,
      paymentTerms: sup.paymentTerms,
      validUntil: rfq.responseDate || "—",
      lines,
      coveredCount: lines.length,
      requestCount: rfq.lines.length,
      total: money(total),
    };
  });
}

/** One Mattex Sales quote from admin-quoted unit prices (or a frozen quote version). */
export function buildSalesQuote(rfq, versionNo) {
  const version =
    versionNo != null && versionNo !== ""
      ? getQuoteVersion(rfq, versionNo) || getEffectiveQuoteVersion(rfq)
      : getEffectiveQuoteVersion(rfq);
  const sourceLines = version?.lines?.length ? version.lines : rfq?.lines;
  if (!sourceLines?.length) return [];
  const lines = sourceLines
    .filter((l) => !l.noOffer)
    .map((l) => {
      const meta = catalogMeta(l);
      const unitPrice =
        l.quotedUnitPrice != null && Number(l.quotedUnitPrice) > 0
          ? money(Number(l.quotedUnitPrice))
          : null;
      return {
        productId: l.productId,
        requestName: l.name,
        name: l.name,
        description: meta.description,
        productNo: meta.productNo,
        qty: l.qty,
        unitPrice,
        lineTotal: unitPrice != null ? money(unitPrice * (Number(l.qty) || 0)) : 0,
        custom: Boolean(l.custom),
        isSet: false,
        setParts: null,
        image: meta.image,
        moq: meta.moq,
        isAlternate: false,
        green: Boolean(meta.green),
      };
    });
  if (!lines.length || lines.some((row) => row.unitPrice == null)) return [];
  const total = lines.reduce((s, row) => s + row.lineTotal, 0);
  return [
    {
      id: `q-${rfq.id}-sales-v${version?.version || "live"}`,
      supplierName: supplierDisplayName("Mattex"),
      leadDays: 7,
      note: version?.quoteNote || rfq.quoteNote || "Quoted on Marketplace",
      paymentTerms: "Net 30",
      validUntil: version?.deadline || rfq.responseDate || "—",
      lines,
      coveredCount: lines.length,
      requestCount: sourceLines.length,
      total: money(
        version?.quotedSubtotal != null
          ? Number(version.quotedSubtotal)
          : rfq.quotedSubtotal != null
            ? Number(rfq.quotedSubtotal)
            : total
      ),
    },
  ];
}

/** Demo RFQ so /rfqs?variant=A works even with an empty history. */
export const DEMO_QUOTED_RFQ = {
  id: "RFQ-DEMO-2401",
  status: "quoted",
  submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  responseDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
  address: "12 Construction Rd, Kowloon",
  project: "Kai Tak Tower",
  note: "Need delivery before next pour.",
  pricedSubtotal: 4200,
  unpricedCount: 0,
  lines: [
    {
      productId: "steel-01",
      name: "UB Structural Steel Beam",
      supplier: "Northspan Steel Group",
      qty: 8,
      unitPrice: 380,
      custom: false,
    },
    {
      productId: "waterproof-01",
      name: "Torch-on Waterproof Membrane",
      supplier: "AquaShield Membranes",
      qty: 20,
      unitPrice: 145,
      custom: false,
    },
    {
      productId: "custom_demo",
      name: "Site temporary fencing",
      supplier: "",
      qty: 40,
      unitPrice: null,
      custom: true,
      description: "2.4m panels, hire 2 weeks",
    },
  ],
};
