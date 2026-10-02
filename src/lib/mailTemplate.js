const BRAND = "#245a41";
const INK = "#1a1d1c";
const MUTE = "#5c6560";
const PAGE = "#eef2f4";
const LINE = "#e6eaec";
export const MARKETPLACE_PUBLIC_ORIGIN = "https://marketplace.mattex.com.hk";
export const ADMIN_PUBLIC_ORIGIN = "https://subbie-admin.mattex.com.hk";
export const ADMIN_PUBLIC_HOME = `${ADMIN_PUBLIC_ORIGIN}/`;
export const MARKETPLACE_PUBLIC_HOME = `${MARKETPLACE_PUBLIC_ORIGIN}/`;
export const MARKETPLACE_LOGO_URL = `${MARKETPLACE_PUBLIC_ORIGIN}/assets/mattex-logo.webp`;

/** Same UI face as Marketplace header / body (`font-sans`). */
export const MM_GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";

const SANS = "'IBM Plex Sans', Helvetica, Arial, sans-serif";
const FACE = `font-family:${SANS};`;
const TITLE = `${FACE}font-weight:700;letter-spacing:-0.025em;`;
const WORDMARK = `${FACE}font-size:18px;line-height:1.15;font-weight:600;letter-spacing:-0.025em;`;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicMailHref(href) {
  const value = String(href || "").trim();
  if (!value || value.startsWith("mailto:") || value.startsWith("cid:")) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return value;
  const admin = url.port === "5179" || url.port === "5181";
  const base = admin ? ADMIN_PUBLIC_ORIGIN : MARKETPLACE_PUBLIC_ORIGIN;
  return `${base}${url.pathname}${url.search}${url.hash}`;
}

function mailButton(label, href) {
  const url = publicMailHref(href);
  if (!label || !url) return "";
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${BRAND}" style="border-radius:6px;background:${BRAND};">
                  <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 22px;${FACE}font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
                </td>
              </tr>
            </table>`;
}

function fontFaceCss(fontBase) {
  const base = String(fontBase || "").replace(/\/$/, "");
  const local = base.startsWith("https://")
    ? `
@font-face {
  font-family: "IBM Plex Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("${base}/fonts/ibm-plex-sans-400.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Sans";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("${base}/fonts/ibm-plex-sans-400.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Sans";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("${base}/fonts/ibm-plex-sans-600.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Sans";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("${base}/fonts/ibm-plex-sans-600.woff2") format("woff2");
}
`
    : "";
  return `
${local}
body, table, td, p, a, span, strong, h1 {
  font-family: ${SANS} !important;
}
h1 {
  font-weight: 700 !important;
}
`;
}

function detailRows(details) {
  return (details || [])
    .filter((row) => row && row.value)
    .map(
      (row) => `
        <tr>
          <td width="140" style="width:140px;padding:8px 16px 8px 0;${FACE}font-size:14px;line-height:1.4;color:${MUTE};vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 0;${FACE}font-size:14px;line-height:1.4;font-weight:600;color:${INK};vertical-align:top;">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join("");
}

function footerTextLinks(links) {
  const parts = (links || []).filter((link) => link && link.href && link.label);
  if (!parts.length) return "";
  const html = parts
    .map(
      (link, i) =>
        `${i ? `<span style="padding:0 8px;color:${LINE};">·</span>` : ""}<a href="${escapeHtml(publicMailHref(link.href))}" target="_blank" style="${FACE}font-size:13px;font-weight:600;color:${BRAND};text-decoration:underline;">${escapeHtml(link.label)}</a>`
    )
    .join("");
  return `<p style="margin:16px 0 0;${FACE}font-size:13px;line-height:1.5;">${html}</p>`;
}

export function renderMattexEmail({
  logoUrl,
  brandName = "Mattex Marketplace",
  salesEmail = "sales@mattex.com.hk",
  toEmail,
  title,
  greeting,
  paragraphs = [],
  details = [],
  detailsTitle = "Details",
  buttonLabel,
  buttonHref,
  footnote,
  footerLinks = [],
}) {
  const body = (paragraphs || [])
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;${FACE}font-size:15px;line-height:1.6;font-weight:400;color:${INK};">${escapeHtml(p)}</p>`
    )
    .join("");
  const rows = detailRows(details);
  const contact = salesEmail
    ? `Reply to this email or get in touch with us at <a href="mailto:${escapeHtml(salesEmail)}" style="${FACE}color:${BRAND};font-weight:600;text-decoration:underline;">${escapeHtml(salesEmail)}</a>.`
    : "";
  const logoSrc = String(logoUrl || "").includes("/assets/mattex-logo.webp") && String(logoUrl).startsWith("https://")
    ? logoUrl
    : MARKETPLACE_LOGO_URL;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};margin:0;padding:0;${FACE}">
  <tr>
    <td align="center" style="padding:28px 16px 0;${FACE}">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td align="center" style="background:${BRAND};padding:22px 24px;${FACE}">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center">
              <tr>
                <td style="background:#ffffff;border-radius:10px;padding:6px 8px;vertical-align:middle;">
                  <img src="${escapeHtml(logoSrc)}" alt="Mattex" width="43" height="36" style="display:block;width:43px;height:36px;border:0;outline:none;text-decoration:none;" />
                </td>
                <td style="padding:0 0 0 12px;vertical-align:middle;${WORDMARK}font-size:20px;color:#ffffff;">${escapeHtml(brandName)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px 8px;${FACE}">
            <h1 style="margin:0 0 16px;${TITLE}font-size:28px;line-height:1.25;color:${INK};text-align:left;">${escapeHtml(title)}</h1>
            ${greeting ? `<p style="margin:0 0 12px;${FACE}font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(greeting)}</p>` : ""}
            ${body}
          </td>
        </tr>
        ${
          rows
            ? `<tr>
          <td style="padding:8px 36px 0;${FACE}">
            <p style="margin:0;border-top:1px solid ${LINE};padding-top:18px;${FACE}font-size:15px;line-height:1.4;font-weight:700;color:${INK};">${escapeHtml(detailsTitle)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              ${rows}
            </table>
          </td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding:22px 36px 8px;${FACE}">
            ${mailButton(buttonLabel, buttonHref)}
            ${footerTextLinks(footerLinks)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 36px 32px;${FACE}">
            <p style="margin:18px 0 0;border-top:1px solid ${LINE};padding-top:18px;${FACE}font-size:15px;line-height:1.6;color:${INK};">Thanks for choosing ${escapeHtml(brandName)}.</p>
            <p style="margin:4px 0 0;${FACE}font-size:15px;line-height:1.6;color:${INK};">– The ${escapeHtml(brandName)} Team</p>
            ${footnote ? `<p style="margin:14px 0 0;${FACE}font-size:13px;line-height:1.5;color:${MUTE};">${escapeHtml(footnote)}</p>` : ""}
            ${toEmail ? `<p style="margin:8px 0 0;${FACE}font-size:12px;line-height:1.5;color:${MUTE};">This message was sent to ${escapeHtml(toEmail)}.</p>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:28px 24px 40px;${FACE}">
      <p style="margin:0;${FACE}font-size:15px;line-height:1.4;font-weight:700;color:${INK};">Questions?</p>
      <p style="margin:8px 0 0;max-width:460px;${FACE}font-size:14px;line-height:1.6;color:${MUTE};">${contact}</p>
      <p style="margin:16px 0 0;${FACE}font-size:12px;line-height:1.5;color:${MUTE};">Mattex Marketplace · Hong Kong</p>
    </td>
  </tr>
</table>`;
}

export function wrapEmailPreview({ to, subject, innerHtml, fontBase }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${MM_GOOGLE_FONTS}" rel="stylesheet" />
  <style>${fontFaceCss(fontBase)}</style>
</head>
<body style="margin:0;background:${PAGE};${FACE}">
  <div style="background:#101513;color:#ffffff;padding:16px 24px;font-size:13px;${FACE}">
    <p style="margin:0;${FACE}"><strong>To</strong> ${escapeHtml(to)}</p>
    <p style="margin:6px 0 0;${FACE}"><strong>Subject</strong> ${escapeHtml(subject)}</p>
  </div>
  ${innerHtml}
</body>
</html>`;
}

export function wrapEmailSend({ subject, innerHtml, fontBase }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${MM_GOOGLE_FONTS}" rel="stylesheet" />
  <style>${fontFaceCss(fontBase)}</style>
</head>
<body style="margin:0;background:${PAGE};${FACE}">
  ${innerHtml}
</body>
</html>`;
}

export function accountCreatedEmailHtml({ logoUrl, salesEmail, name, email, company }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail: email,
    title: "Your Mattex Marketplace account is ready",
    greeting: `Hi ${name},`,
    paragraphs: [
      "Your account was created. You can sign in and request quotes right away — no approval wait.",
    ],
    detailsTitle: "Here's your account:",
    details: [
      { label: "Work email", value: email },
      { label: "Company", value: company },
    ],
    buttonLabel: "Open Marketplace",
    buttonHref: MARKETPLACE_PUBLIC_HOME,
    footnote: "If you did not create this account, please contact Mattex.",
    footerLinks: [
      { label: "Marketplace", href: MARKETPLACE_PUBLIC_HOME },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function rfqSubmittedEmailHtml({ logoUrl, salesEmail, name, rfqId, project, lineCount, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "We received your quote request",
    greeting: `Hi ${name},`,
    paragraphs: [
      "Sales will follow up from the portal. You can also track this RFQ in My RFQs.",
    ],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Lines", value: lineCount != null ? String(lineCount) : "" },
    ],
    buttonLabel: "View your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function staffInviteEmailHtml({ logoUrl, salesEmail, name, setPasswordHref, toEmail, portalHref }) {
  return renderMattexEmail({
    logoUrl,
    brandName: "Mattex Marketplace Admin Portal",
    salesEmail,
    toEmail,
    title: "You've been invited to the Sales portal",
    greeting: `Hi ${name},`,
    paragraphs: [
      "Set a password to review RFQs, products, and buyer accounts. The button below opens the password page directly.",
    ],
    buttonLabel: "Set your password",
    buttonHref: setPasswordHref,
    footnote: "This link expires in 7 days. If you did not expect this invite, ignore the email.",
    footerLinks: [
      { label: "Sales portal", href: portalHref || setPasswordHref },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function passwordResetEmailHtml({ logoUrl, salesEmail, name, resetHref, toEmail, shopHref, portalHref, staff }) {
  return renderMattexEmail({
    logoUrl,
    brandName: staff ? "Mattex Marketplace Admin Portal" : "Mattex Marketplace",
    salesEmail,
    toEmail,
    title: "Reset your password",
    greeting: `Hi ${name},`,
    paragraphs: [
      staff
        ? "Use the button below to choose a new Sales portal password."
        : "Use the button below to choose a new Mattex Marketplace password.",
    ],
    buttonLabel: "Reset password",
    buttonHref: resetHref,
    footnote: "This link expires in 7 days. If you did not ask to reset your password, ignore the email.",
    footerLinks: staff
      ? [
          { label: "Sales portal", href: portalHref || resetHref },
          { label: "Contact", href: `mailto:${salesEmail}` },
        ]
      : [
          { label: "Sign in", href: shopHref || resetHref },
          { label: "Contact", href: `mailto:${salesEmail}` },
        ],
  });
}

export function buyerRejectedEmailHtml({ logoUrl, salesEmail, name, company, reason, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "Your application was not approved",
    greeting: `Hi ${name},`,
    paragraphs: [
      `Thank you for applying for a Mattex Marketplace account${company ? ` for ${company}` : ""}. We are unable to approve it at this time.`,
    ],
    details: [
      { label: "Company", value: company },
      { label: "Reason", value: reason },
    ],
    buttonLabel: "Contact Mattex",
    buttonHref: `mailto:${salesEmail}`,
    footnote: "If you did not apply, you can ignore this email.",
    footerLinks: [
      { label: "Marketplace", href: shopHref },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function salesNewRfqEmailHtml({ logoUrl, salesEmail, rfqId, buyerName, project, lineCount }) {
  return renderMattexEmail({
    logoUrl,
    brandName: "Mattex Marketplace Admin Portal",
    salesEmail,
    toEmail: salesEmail,
    title: "New RFQ from Marketplace",
    greeting: "Hi Sales,",
    paragraphs: ["A buyer submitted a quote request. Open it in the portal to Accept or Reject."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Buyer", value: buyerName },
      { label: "Project", value: project },
      { label: "Lines", value: lineCount != null ? String(lineCount) : "" },
    ],
    buttonLabel: "Open in portal",
    buttonHref: ADMIN_PUBLIC_HOME,
    footerLinks: [
      { label: "Sales portal", href: ADMIN_PUBLIC_HOME },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function rfqAcceptedEmailHtml({ logoUrl, salesEmail, name, rfqId, project, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "Your RFQ is in review",
    greeting: `Hi ${name},`,
    paragraphs: ["Sales accepted this quote request and is handling it. You can still request a cancellation from My RFQs until a purchase order is created."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Status", value: "In review" },
    ],
    buttonLabel: "View your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function rfqNoOfferEmailHtml({ logoUrl, salesEmail, name, rfqId, project, reason, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "No offer on your RFQ",
    greeting: `Hi ${name},`,
    paragraphs: ["Sales is not able to quote this request. The reason is saved on the RFQ in My RFQs."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Reason", value: reason },
    ],
    buttonLabel: "View your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function rfqCancelRequestedEmailHtml({ logoUrl, salesEmail, rfqId, buyerName, project }) {
  return renderMattexEmail({
    logoUrl,
    brandName: "Mattex Marketplace Admin Portal",
    salesEmail,
    toEmail: salesEmail,
    title: "Buyer asked to cancel an RFQ",
    greeting: "Hi Sales,",
    paragraphs: ["Accept the cancellation to close this RFQ, or keep it in review."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Buyer", value: buyerName },
      { label: "Project", value: project },
    ],
    buttonLabel: "Open in portal",
    buttonHref: ADMIN_PUBLIC_HOME,
    footerLinks: [
      { label: "Sales portal", href: ADMIN_PUBLIC_HOME },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function rfqCancelAcceptedEmailHtml({ logoUrl, salesEmail, name, rfqId, project, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "Your RFQ was cancelled",
    greeting: `Hi ${name},`,
    paragraphs: ["Sales accepted your cancellation request. This RFQ is closed."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Status", value: "Cancelled" },
    ],
    buttonLabel: "View your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
    ],
  });
}

export function rfqCancelDeclinedEmailHtml({ logoUrl, salesEmail, name, rfqId, project, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "Your RFQ remains open",
    greeting: `Hi ${name},`,
    paragraphs: ["Sales kept this quote request open. It stays in review."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Status", value: "In review" },
    ],
    buttonLabel: "View your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
    ],
  });
}

export function rfqReverseRequestedEmailHtml({ logoUrl, salesEmail, rfqId, buyerName, project }) {
  return renderMattexEmail({
    logoUrl,
    brandName: "Mattex Marketplace Admin Portal",
    salesEmail,
    toEmail: salesEmail,
    title: "Buyer asked to reverse an RFQ",
    greeting: "Hi Sales,",
    paragraphs: ["Accept the reverse so the buyer can revise this RFQ, or keep it in review."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Buyer", value: buyerName },
      { label: "Project", value: project },
    ],
    buttonLabel: "Open in portal",
    buttonHref: ADMIN_PUBLIC_HOME,
    footerLinks: [
      { label: "Sales portal", href: ADMIN_PUBLIC_HOME },
      { label: "Contact", href: `mailto:${salesEmail}` },
    ],
  });
}

export function rfqReverseAcceptedEmailHtml({ logoUrl, salesEmail, name, rfqId, project, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "You can revise your RFQ",
    greeting: `Hi ${name},`,
    paragraphs: ["Sales accepted your reverse request. This RFQ is in Revising — edit it, then resubmit."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Status", value: "Revising" },
    ],
    buttonLabel: "Revise your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
    ],
  });
}

export function rfqReverseDeclinedEmailHtml({ logoUrl, salesEmail, name, rfqId, project, rfqsHref, shopHref, toEmail }) {
  return renderMattexEmail({
    logoUrl,
    salesEmail,
    toEmail,
    title: "Your RFQ remains in review",
    greeting: `Hi ${name},`,
    paragraphs: ["Sales kept this RFQ in review. The reverse request was not accepted."],
    details: [
      { label: "RFQ", value: rfqId },
      { label: "Project", value: project },
      { label: "Status", value: "In review" },
    ],
    buttonLabel: "View your RFQ",
    buttonHref: rfqsHref,
    footerLinks: [
      { label: "My RFQs", href: rfqsHref },
      { label: "Marketplace", href: shopHref },
    ],
  });
}

export function listPrototypeEmails({ marketplaceOrigin, adminOrigin, salesEmail = "sales@mattex.com.hk" } = {}) {
  const shop = String(marketplaceOrigin || "").replace(/\/$/, "") || "http://localhost:5178";
  const admin = String(adminOrigin || "").replace(/\/$/, "") || "http://localhost:5179";
  const logoUrl = `${shop}/assets/mattex-logo.webp`;
  const fontBase = shop;
  const rows = [
    {
      id: "account-created",
      label: "Buyer account created",
      to: "resend@mattex.com.hk",
      subject: "Your Mattex Marketplace account is ready",
      innerHtml: accountCreatedEmailHtml({
        logoUrl,
        salesEmail,
        name: "Venus Chung",
        email: "resend@mattex.com.hk",
        company: "Mattex Engineering",
        shopHref: `${shop}/zh`,
      }),
    },
    {
      id: "rfq-submitted",
      label: "Buyer RFQ submitted",
      to: "venus@mattex.com.hk",
      subject: "We received your RFQ RFQ-1209",
      innerHtml: rfqSubmittedEmailHtml({
        logoUrl,
        salesEmail,
        name: "Venus Chung",
        rfqId: "RFQ-1209",
        project: "Kai Tak Tower",
        lineCount: 5,
        rfqsHref: `${shop}/zh/rfqs`,
        shopHref: `${shop}/zh`,
        toEmail: "venus@mattex.com.hk",
      }),
    },
    {
      id: "staff-invite",
      label: "Sales invite",
      to: "sales.staff@mattex.com.hk",
      subject: "Set your Mattex Sales portal password",
      innerHtml: staffInviteEmailHtml({
        logoUrl,
        salesEmail,
        name: "Alex Wong",
        setPasswordHref: `${admin}/set-password?token=preview-invite`,
        toEmail: "sales.staff@mattex.com.hk",
        portalHref: `${admin}/`,
      }),
    },
    {
      id: "buyer-rejected",
      label: "Buyer account rejected",
      to: "guest.buyer@example.com",
      subject: "Your Mattex Marketplace account application",
      innerHtml: buyerRejectedEmailHtml({
        logoUrl,
        salesEmail,
        name: "Jordan Lee",
        company: "Lee Contracting Ltd",
        reason: "Unable to verify company registration.",
        shopHref: `${shop}/zh`,
        toEmail: "guest.buyer@example.com",
      }),
    },
    {
      id: "sales-new-rfq",
      label: "Sales — new Marketplace RFQ",
      to: salesEmail,
      subject: "New RFQ RFQ-1209 from Marketplace",
      innerHtml: salesNewRfqEmailHtml({
        logoUrl,
        salesEmail,
        rfqId: "RFQ-1209",
        buyerName: "Venus Chung",
        buyerEmail: "venus@mattex.com.hk",
        project: "Kai Tak Tower",
        lineCount: 5,
        portalHref: `${admin}/?rfq=RFQ-1209`,
      }),
    },
    {
      id: "rfq-accepted",
      label: "Buyer — RFQ accepted (In review)",
      to: "venus@mattex.com.hk",
      subject: "Your RFQ RFQ-1209 is in review",
      innerHtml: rfqAcceptedEmailHtml({
        logoUrl,
        salesEmail,
        name: "Venus Chung",
        rfqId: "RFQ-1209",
        project: "Kai Tak Tower",
        rfqsHref: `${shop}/zh/rfqs`,
        shopHref: `${shop}/zh`,
        toEmail: "venus@mattex.com.hk",
      }),
    },
    {
      id: "rfq-no-offer",
      label: "Buyer — RFQ no offer",
      to: "venus@mattex.com.hk",
      subject: "No offer on RFQ RFQ-1209",
      innerHtml: rfqNoOfferEmailHtml({
        logoUrl,
        salesEmail,
        name: "Venus Chung",
        rfqId: "RFQ-1209",
        project: "Kai Tak Tower",
        reason: "Unable to source this specification in the requested lead time.",
        rfqsHref: `${shop}/zh/rfqs`,
        shopHref: `${shop}/zh`,
        toEmail: "venus@mattex.com.hk",
      }),
    },
    {
      id: "rfq-cancel-requested",
      label: "Sales — cancel requested",
      to: salesEmail,
      subject: "Cancel requested for RFQ RFQ-1209",
      innerHtml: rfqCancelRequestedEmailHtml({
        logoUrl,
        salesEmail,
        rfqId: "RFQ-1209",
        buyerName: "Venus Chung",
        buyerEmail: "venus@mattex.com.hk",
        project: "Kai Tak Tower",
        portalHref: `${admin}/?rfq=RFQ-1209`,
      }),
    },
    {
      id: "rfq-cancel-accepted",
      label: "Buyer — RFQ cancelled",
      to: "venus@mattex.com.hk",
      subject: "RFQ RFQ-1209 was cancelled",
      innerHtml: rfqCancelAcceptedEmailHtml({
        logoUrl,
        salesEmail,
        name: "Venus Chung",
        rfqId: "RFQ-1209",
        project: "Kai Tak Tower",
        rfqsHref: `${shop}/zh/rfqs`,
        shopHref: `${shop}/zh`,
        toEmail: "venus@mattex.com.hk",
      }),
    },
    {
      id: "rfq-cancel-declined",
      label: "Buyer — cancel declined",
      to: "venus@mattex.com.hk",
      subject: "RFQ RFQ-1209 remains open",
      innerHtml: rfqCancelDeclinedEmailHtml({
        logoUrl,
        salesEmail,
        name: "Venus Chung",
        rfqId: "RFQ-1209",
        project: "Kai Tak Tower",
        rfqsHref: `${shop}/zh/rfqs`,
        shopHref: `${shop}/zh`,
        toEmail: "venus@mattex.com.hk",
      }),
    },
  ];
  return rows.map((row) => ({
    ...row,
    href: `${shop}/emails/${row.id}`,
    html: wrapEmailPreview({ to: row.to, subject: row.subject, innerHtml: row.innerHtml, fontBase }),
  }));
}
