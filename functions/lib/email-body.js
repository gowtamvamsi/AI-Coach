// Email body rendering. Pure — no firebase-admin, no network — so it unit-tests
// offline (see tests/email-body.test.mjs), same as lib/otp.js.
//
// Two modes, chosen by looking at the body itself:
//   • markdown-lite (default) — what the admin composer produces: **bold** and
//     [label](url), escaped, newlines as <br>.
//   • raw HTML — a body that already starts with "<" is a designed template
//     (see email-templates/), so it passes through untouched.
// Either way a plain-text part is derived and sent alongside as the fallback
// for text-only clients (and it measurably helps spam scoring).

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ponytail: sentinel-free detection — a body starting with "<" is markup.
// Covers "<!DOCTYPE html>" and "<table>" alike; plain composer text never
// starts with "<" (and a stray "<" that did would only lose its escaping,
// and only for admins, who are the sole callers of the bulk send).
function isHtmlBody(body) {
  return /^\s*</.test(String(body == null ? "" : body));
}

function htmlToText(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    // Blocks become blank-line-separated paragraphs; rows/list items just wrap.
    .replace(/<\/(p|div|h[1-6]|table)>/gi, "\n\n")
    .replace(/<\/(tr|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    // Entities after tag-stripping, and &amp; last, so "&amp;lt;" stays "&lt;".
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    // Numeric refs too — the template writes its emoji as &#128640; etc., and a
    // literal "&#128640;" in the text part reads as breakage.
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function emailBodyToHtml(body) {
  if (isHtmlBody(body)) return String(body);
  const html = escapeHtml(body)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\r?\n/g, "<br>\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222">${html}</div>`;
}

function emailBodyToText(body) {
  if (isHtmlBody(body)) return htmlToText(body);
  return String(body)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)");
}

module.exports = { escapeHtml, isHtmlBody, htmlToText, emailBodyToHtml, emailBodyToText };
