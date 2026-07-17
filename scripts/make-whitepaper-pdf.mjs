// Render docs/WHITEPAPER.md into the designed ProofBall whitepaper PDF.
//
// Pipeline: marked (markdown -> HTML) -> a bespoke cover + print stylesheet
// -> Playwright chrome-headless-shell -> page.pdf(). Writes the PDF to both
// docs/ (source of truth) and public/ (the copy the app serves at
// /ProofBall-Whitepaper.pdf).
//
// The big cover tagline is taken from the first prose line of WHITEPAPER.md,
// so edit the tagline there, not here.
//
// Requires `marked` at runtime (dev-only, not a shipped dependency):
//     npm install marked --no-save --no-package-lock
// then:  node scripts/make-whitepaper-pdf.mjs
import { createRequire } from "node:module";
import { globSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const require = createRequire(import.meta.url);

// Playwright + a headless Chrome shell, resolved from wherever they live on
// this machine (local node_modules first, then the npx / ms-playwright caches).
const pwDir =
  globSync("node_modules/playwright")[0] ||
  globSync(path.join(process.env.HOME, ".npm/_npx/*/node_modules/playwright")).sort().pop();
if (!pwDir) throw new Error("playwright not found (npm i --no-save playwright, or npx playwright install)");
const { chromium } = require(pwDir);

const executablePath = globSync(
  path.join(process.env.HOME, "Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell"),
).sort().pop();
if (!executablePath) throw new Error("chrome-headless-shell not found (npx playwright install chromium)");

const md = fs.readFileSync("docs/WHITEPAPER.md", "utf8");
const splitAt = md.indexOf("\n## ");
const head = md.slice(0, splitAt);
const body = md.slice(splitAt + 1);
const tagline =
  head.split("\n").find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---")) ||
  "Momentum trading for your favorite sports.";

// Embed the logo as a data URI (setContent has no base URL for relative paths).
const logoSrc = "data:image/png;base64," + fs.readFileSync("app/icon.png").toString("base64");

marked.setOptions({ gfm: true, breaks: false });
const bodyHtml = marked.parse(body);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  :root { --grn:#0a9e5c; --ink:#14151a; --mut:#5c5c66; --line:#e6e6ec; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: var(--ink); line-height: 1.62; font-size: 10.8pt; margin: 0; }
  .cover { min-height: 244mm; display: flex; flex-direction: column; page-break-after: always; }
  .cover .top { margin-top: 24mm; }
  .cover .logo { width: 24mm; height: 24mm; border-radius: 6mm; display: block; margin-bottom: 9mm; }
  .cover .brand { font-size: 46pt; font-weight: 800; letter-spacing: -0.03em; }
  .cover .brand .dot { color: var(--grn); }
  .cover .rule { border: 0; border-top: 2.5px solid var(--ink); width: 42mm; margin: 7mm 0; }
  .cover .label { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; color: var(--grn); }
  .cover .badge { display: inline-block; margin-top: 6mm; padding: 1.6mm 4mm; border: 1.5px solid var(--grn);
                  border-radius: 999px; font-size: 9.5pt; font-weight: 700; color: var(--grn); }
  .cover .tagline { margin-top: 8mm; font-size: 15pt; line-height: 1.5; max-width: 130mm; color: var(--ink); }
  .cover .foot { margin-top: auto; padding-top: 12mm; font-size: 9.5pt; color: var(--mut); border-top: 1px solid var(--line); }
  h2 { font-size: 17pt; font-weight: 800; letter-spacing: -0.01em; margin: 9mm 0 3mm; padding-top: 3mm;
       border-top: 1px solid var(--line); break-after: avoid; }
  h3 { font-size: 12.5pt; font-weight: 700; margin: 6mm 0 2mm; break-after: avoid; }
  h4 { font-size: 10.8pt; font-weight: 700; margin: 4mm 0 1mm; break-after: avoid; }
  p { margin: 0 0 3mm; }
  strong { font-weight: 700; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1.5mm; break-inside: avoid; }
  a { color: var(--grn); text-decoration: none; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 6mm 0; }
  table { border-collapse: collapse; width: 100%; margin: 3mm 0 4mm; font-size: 9.8pt; break-inside: avoid; }
  th, td { border: 1px solid var(--line); padding: 2mm 3mm; text-align: left; vertical-align: top; }
  th { background: #f3f6f4; font-weight: 700; }
  blockquote { margin: 3mm 0; padding: 1mm 4mm; border-left: 3px solid var(--grn); color: var(--mut); break-inside: avoid; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; background: #f4f4f6; padding: 0.4mm 1.4mm; border-radius: 3px; }
  figure { margin: 6mm 0; text-align: center; break-inside: avoid; }
  figure svg { max-width: 100%; height: auto; }
  figcaption { margin-top: 2.5mm; font-size: 9pt; color: var(--mut); font-style: italic; }
  h2, h3, table, blockquote { break-inside: avoid; }
</style></head><body>
  <section class="cover">
    <div class="top">
      <img class="logo" src="${logoSrc}" alt="">
      <div class="brand">ProofBall<span class="dot">.</span></div>
      <hr class="rule">
      <div class="label">Whitepaper</div><br>
      <div class="badge">Beta &middot; Solana devnet</div>
      <div class="tagline">${tagline}</div>
    </div>
    <div class="foot">Prove every call on-chain &middot; Built on TxLINE + Solana &middot; July 2026</div>
  </section>
  ${bodyHtml}
</body></html>`;

const primary = "docs/ProofBall-Whitepaper.pdf";
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: primary, format: "A4", printBackground: true,
  margin: { top: "15mm", bottom: "18mm", left: "17mm", right: "17mm" },
  displayHeaderFooter: true, headerTemplate: "<div></div>",
  footerTemplate: '<div style="font-size:8px;color:#9a9aa2;width:100%;padding:0 17mm;display:flex;justify-content:space-between;font-family:-apple-system,sans-serif;"><span>ProofBall Whitepaper</span><span class="pageNumber"></span></div>',
});
await browser.close();

// The app serves the public/ copy, so keep it in lockstep with docs/.
fs.copyFileSync(primary, "public/ProofBall-Whitepaper.pdf");
console.log("PDF written:", primary, "+ public/ (" + (fs.statSync(primary).size / 1024).toFixed(0) + " KB)");
