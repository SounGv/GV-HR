// Paste into the browser console (or a browser tool) on any signed-in page of the running app. It measures every visible text
// against its real background (gradients: the worst stop), counts placeholders, and lists what is under 4.5:1.
// Add the class "dark" to <html> first to check dark mode. Result: "<path> n<texts> LOW<count>" plus the four worst distinct cases.
(() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (s) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (layers) => { let base = [255, 255, 255]; for (const p of layers) base = base.map((v, i) => v * (1 - p[3]) + p[i] * p[3]); return base; };
  const bgs = (el) => {
    const layers = []; let grads = null;
    for (; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== "none" && !layers.length && !grads) grads = (cs.backgroundImage.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|oklab\([^)]*\)|oklch\([^)]*\)|color\([^)]*\))/g) || []).map(rgba).filter((c) => c[3] > 0.5);
      const p = rgba(cs.backgroundColor);
      if (p[3] > 0) { layers.push(p); if (p[3] >= 0.99) break; }
    }
    layers.reverse();
    return grads && grads.length ? grads.map((g) => over([...layers, g])) : [over(layers)];
  };
  const res = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || el.closest("[disabled],[aria-disabled=true]")) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity); if (op === 0) continue;
    const fg = rgba(cs.color); let worst = 99;
    for (const b of bgs(el)) { const a = fg[3] * op; const f = [0, 1, 2].map((i) => fg[i] * a + b[i] * (1 - a)); const L1 = lum(f), L2 = lum(b); worst = Math.min(worst, (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)); }
    res.push({ cr: Math.round(worst * 100) / 100, sz: parseFloat(cs.fontSize), t: t.slice(0, 16), cls: (el.className && el.className.toString().replace(/\s+/g, ".").slice(0, 34)) || el.tagName });
  }
  const low = res.filter((x) => x.cr < 4.5); const seen = new Set();
  const uniq = low.sort((a, b) => a.cr - b.cr).filter((x) => { const k = x.cls + x.cr; if (seen.has(k)) return false; seen.add(k); return true; });
  return `${location.pathname}${location.search} n${res.length} LOW${low.length}` + uniq.slice(0, 4).map((x) => `\n ${x.cr} ${x.sz}px ${x.t} ${x.cls}`).join("");
})();
