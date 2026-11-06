/* weight-viz.js — interactive views of a 500-32-32-5 tanh policy network.
 *
 * Load one data script per network before this file:
 *   <script defer src="net1.js"></script>   (sets window.WV_WEIGHTS.net1 = {W1, b1, ...})
 * then place mount points; each names its network and view:
 *   <div data-wv="size" data-wv-net="net1" data-wv-scale="per"></div>
 * data-wv-scale ("shared" | "per") fixes the color scale for channels/size; omit it for a checkbox.
 * Views:
 *   data-wv="text"       W1 as plain text, the way the model was given it
 *   data-wv="raw"        W1, b1, W2, b2, W3^T, b3 as given
 *   data-wv="channels"   W1 split into the 5 channels (100 x 32 each), board-row separators
 *   data-wv="size"       ||W1[i,:]|| on five 10x10 boards
 *   data-wv="topk"       count of units whose top-p% set contains each input, with a slider
 *   data-wv="bias"       b3 and softmax(b3)
 *   data-wv="units"      diffusion models: b3 and each row of W3 as a 12x12 image (data-wv-base="hide" drops b3)
 * data-wv="raw" also takes data-wv-act ("tanh"), data-wv-out ("logits") and data-wv-note.
 * The explanatory note under a figure is shown only the first time that kind of figure appears;
 * add data-wv-notes="show" to keep it on a later one.
 * Everything is computed in the browser from the raw weights.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------ constants
  var CH_NAMES = ["agent", "moving objects", "reward targets", "obstacles", "previous frame"];
  var CH_SHORT = ["agent", "moving", "reward", "obstacles", "prev frame"];
  var CH_DESC = [
    "cells the player controls",
    "things other than the agent that move",
    "things that give reward",
    "cannot enter / ends episode; includes wall border",
    "cells in ch 0 or ch 1 on the previous step",
  ];
  var ACTIONS = ["noop", "up", "down", "left", "right"];

  // ------------------------------------------------------------------ styles (injected so purgecss can't strip them)
  var CSS = [
    ".wv-fig{margin:1.2em 0 0.4em;overflow-x:auto;text-align:center}",
    ".wv-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:flex-start;justify-content:center}",
    ".wv-title{font-size:14px;font-weight:600;margin:0 0 4px;text-align:center}",
    ".wv-note{font-size:13px;opacity:.75;margin:6px auto 0;max-width:760px;text-align:center}",
    ".wv-tip{position:fixed;pointer-events:none;z-index:9999;padding:4px 7px;border-radius:4px;",
    "font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;background:rgba(20,20,20,.92);color:#fff;display:none;white-space:pre}",
    ".wv-picker{display:flex;gap:6px;flex-wrap:wrap;margin:.6em 0}",
    ".wv-btn{font:13px system-ui,sans-serif;padding:5px 12px;border-radius:6px;cursor:pointer;",
    "border:1px solid currentColor;background:transparent;color:inherit;opacity:.65}",
    ".wv-btn.wv-on{opacity:1;font-weight:600;box-shadow:inset 0 0 0 1px currentColor}",
    ".wv-ctrl{display:flex;gap:16px;align-items:center;justify-content:center;flex-wrap:wrap;font:14px system-ui,sans-serif;margin:.4em 0}",
    ".wv-ctrl input[type=range]{width:240px}",
    ".wv-ctrl label{display:flex;gap:6px;align-items:center;cursor:pointer}",
    ".wv-val{font-variant-numeric:tabular-nums;font-weight:600;min-width:3.2em;display:inline-block}",
    ".wv-text{max-height:240px;overflow:auto;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre;",
    "padding:8px 10px;border:1px solid rgba(128,128,128,.35);border-radius:6px;margin:.6em 0}",
    ".wv-tabbar{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid rgba(128,128,128,.4);margin:1.2em 0 .8em}",
    ".wv-tabbtn{font:14px system-ui,sans-serif;padding:7px 14px;cursor:pointer;background:transparent;color:inherit;",
    "border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;margin-bottom:-1px;opacity:.65}",
    ".wv-tabbtn.wv-on{opacity:1;font-weight:600;border-color:rgba(128,128,128,.4);background:inherit}",
    // reasoning traces and prompts, lightly formatted
    ".wv-trace{font-size:15px;line-height:1.55;margin:0 0 .6em}",
    ".wv-trace h4{font:600 14px system-ui,sans-serif;margin:1.1em 0 .3em;text-transform:uppercase;letter-spacing:.04em;opacity:.8}",
    ".wv-trace ul{margin:.3em 0 .6em;padding-left:1.3em}.wv-trace li{margin:.25em 0}",
    ".wv-trace-note{font-size:13px;font-style:italic;opacity:.7;margin:.6em 0}",
    ".wv-trace-ascii{font:13px/1.15 ui-monospace,Menlo,Consolas,monospace;display:inline-block;margin:.5em 0;padding:6px 10px;",
    "border:1px solid rgba(128,128,128,.35);border-radius:4px;white-space:pre}",
    ".wv-prompt{font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;max-height:280px;overflow:auto;",
    "padding:10px 12px;border:1px solid rgba(128,128,128,.35);border-radius:6px;margin:.4em 0}",
    // static figures: GIF clips, the game gallery, the task figure
    ".wv-gif{margin:1.2em auto;text-align:center}.wv-gif img{max-width:100%;height:auto;image-rendering:pixelated;border-radius:4px}",
    ".wv-gif figcaption,.wv-gallery figcaption{font:13px system-ui,sans-serif;opacity:.75;margin-top:6px;text-align:center}",
    ".wv-gallery{margin:1.2em auto;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}",
    ".wv-gallery>div{display:flex;flex-direction:column;align-items:center;gap:4px;font:600 13px system-ui,sans-serif}",
    ".wv-gallery img{width:170px;height:170px;image-rendering:pixelated;border-radius:4px}",
    ".wv-gallery figcaption{flex-basis:100%}",
    "details.wv-details h3,details.wv-details .l-body{margin-left:auto;margin-right:auto}",
    "details.wv-details{margin:1em 0;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:.3em .9em}",
    "details.wv-details>summary{cursor:pointer;font-weight:600;padding:.3em 0}",
  ].join("");

  // ------------------------------------------------------------------ theme + colors
  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function inkColor() {
    return isDark() ? "#e6e6e6" : "#222";
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function hex(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function ramp(stops) {
    var s = stops.map(hex);
    return function (t) {
      t = Math.max(0, Math.min(1, t));
      var x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i;
      return "rgb(" + [0, 1, 2].map(function (k) { return Math.round(lerp(s[i][k], s[i + 1][k], f)); }).join(",") + ")";
    };
  }
  // Diverging: blue (neg) - neutral - red (pos). Neutral follows the page background.
  function cmapDiverging() {
    var mid = isDark() ? "#2b2b2b" : "#f7f7f7";
    return ramp(["#08306b", "#2166ac", "#67a9cf", "#d1e5f0", mid, "#fddbc7", "#ef8a62", "#b2182b", "#67000d"]);
  }
  var VIRIDIS = ramp(["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"]);
  var PIXEL = ramp(["#000000", "#ffffff"]);
  // Magnitude: background-like at 0, ink-like at max.
  function cmapMagnitude() {
    return isDark() ? ramp(["#1e1e1e", "#f0f0f0"]) : ramp(["#ffffff", "#111111"]);
  }

  // ------------------------------------------------------------------ math helpers
  function absMax(arr) {
    var m = 0;
    for (var i = 0; i < arr.length; i++) m = Math.max(m, Math.abs(arr[i]));
    return m;
  }
  // Network JSON -> flat Float64Arrays with shapes.
  function prepare(raw) {
    function flat(M) {
      var r = M.length, c = M[0].length, a = new Float64Array(r * c);
      for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) a[i * c + j] = M[i][j];
      return { a: a, r: r, c: c };
    }
    var W3 = flat(raw.W3), W3T = new Float64Array(W3.r * W3.c);
    for (var i = 0; i < W3.r; i++) for (var j = 0; j < W3.c; j++) W3T[j * W3.r + i] = W3.a[i * W3.c + j];
    return {
      W1: flat(raw.W1), W2: flat(raw.W2), W3: W3, W3T: { a: W3T, r: W3.c, c: W3.r },
      b1: Float64Array.from(raw.b1), b2: Float64Array.from(raw.b2), b3: Float64Array.from(raw.b3),
    };
  }
  // Rows of W1 for channel c: 100 x 32, block row k = board_row*10 + board_col.
  function channelBlock(W1, c) {
    var out = new Float64Array(100 * 32);
    for (var k = 0; k < 100; k++) for (var j = 0; j < 32; j++) out[k * 32 + j] = W1.a[(k * 5 + c) * 32 + j];
    return out;
  }
  // Length-500 vector -> 5 boards of 100 (row-major 10x10).
  function toBoards(v) {
    var b = [];
    for (var c = 0; c < 5; c++) {
      var t = new Float64Array(100);
      for (var k = 0; k < 100; k++) t[k] = v[k * 5 + c];
      b.push(t);
    }
    return b;
  }
  function rowNorms(W1) {
    var n = new Float64Array(500);
    for (var i = 0; i < 500; i++) {
      var s = 0;
      for (var j = 0; j < 32; j++) s += W1.a[i * 32 + j] * W1.a[i * 32 + j];
      n[i] = Math.sqrt(s);
    }
    return n;
  }
  // For each unit j, the top-p set of inputs. mode 'mass': fewest inputs whose squared weights
  // reach fraction p of ||W1[:,j]||^2. mode 'rank': the round(p*500) largest |w|.
  // Returns {count: per-input number of units (0..32), sizes: per-unit set size}.
  function topCounts(W1, p, mode) {
    var count = new Float64Array(500), sizes = [];
    for (var j = 0; j < 32; j++) {
      var idx = [], tot = 0;
      for (var i = 0; i < 500; i++) { idx.push(i); tot += W1.a[i * 32 + j] * W1.a[i * 32 + j]; }
      idx.sort(function (a, b) { return Math.abs(W1.a[b * 32 + j]) - Math.abs(W1.a[a * 32 + j]); });
      var k;
      if (mode === "mass") {
        var cum = 0; k = 500;
        for (var q = 0; q < 500; q++) {
          var w = W1.a[idx[q] * 32 + j]; cum += w * w;
          if (cum / tot >= p - 1e-12) { k = q + 1; break; }
        }
      } else {
        k = Math.round(p * 500);
      }
      for (var q2 = 0; q2 < k; q2++) count[idx[q2]] += 1;
      sizes.push(k);
    }
    return { count: count, sizes: sizes };
  }
  function softmax(z) {
    var m = Math.max.apply(null, z), e = z.map(function (v) { return Math.exp(v - m); }), s = e.reduce(function (a, b) { return a + b; }, 0);
    return e.map(function (v) { return v / s; });
  }
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function decodeInput(i) {
    var c = i % 5, cell = (i - c) / 5;
    return { row: Math.floor(cell / 10), col: cell % 10, ch: c };
  }
  function fmt(v, d) {
    return (v >= 0 ? "+" : "") + v.toFixed(d == null ? 3 : d);
  }

  // ------------------------------------------------------------------ tooltip
  var tipEl = null;
  function tip(text, ev) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "wv-tip"; document.body.appendChild(tipEl); }
    if (text == null) { tipEl.style.display = "none"; return; }
    tipEl.textContent = text;
    tipEl.style.display = "block";
    var x = ev.clientX + 14, y = ev.clientY + 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    if (x + w > window.innerWidth - 4) x = ev.clientX - w - 10;
    if (y + h > window.innerHeight - 4) y = ev.clientY - h - 10;
    tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
  }

  // ------------------------------------------------------------------ heatmap primitive
  /* opts:
   *  data (Float64Array rows*cols), rows, cols, cellW, cellH
   *  cmap: 'div' | 'mag' | 'viridis';  vmin, vmax  (div uses [-vmax, vmax])
   *  title, xLabel, yLabel, xTicks [[pos,label]], yTicks [[pos,label]] (pos in cell units, center)
   *  hlines: [row indices]  -> line drawn above that row
   *  box: [x, y, w, h] in cells (outline), annotate: fn(v)->string or null
   *  colorbar: bool, cbLabel, tipFn(r, c, v) -> string
   *  marginLeft / marginBottom overrides
   */
  function heatmap(opts) {
    var ink = inkColor(), dpr = window.devicePixelRatio || 1;
    var mL = opts.marginLeft != null ? opts.marginLeft : (opts.yTicks || opts.yLabel ? 58 : 8);
    var mT = opts.title ? (opts.subtitle ? 34 : 22) : 6, mB = opts.marginBottom != null ? opts.marginBottom : (opts.xTicks || opts.xLabel ? 36 : 6);
    if (opts.cbBelow) mB += 30;
    var cbW = opts.colorbar ? (opts.cbCompact ? 40 : opts.rows * opts.cellH >= 90 ? 56 : 80) : 0, mR = 6 + cbW;
    var pw = opts.cols * opts.cellW, ph = opts.rows * opts.cellH;
    var W = mL + pw + mR, H = mT + ph + mB;
    var cv = document.createElement("canvas");
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px"; cv.style.flex = "0 0 auto";
    var g = cv.getContext("2d");
    g.scale(dpr, dpr);

    var cm, lo, hi;
    if (opts.cmap === "div") { cm = cmapDiverging(); hi = opts.vmax || absMax(opts.data) || 1; lo = -hi; }
    else { cm = opts.cmap === "viridis" ? VIRIDIS : opts.cmap === "pixel" ? PIXEL : cmapMagnitude(); lo = opts.vmin != null ? opts.vmin : 0; hi = opts.vmax != null ? opts.vmax : (absMax(opts.data) || 1); }
    var norm = function (v) { return (v - lo) / (hi - lo || 1); };

    // cells
    for (var r = 0; r < opts.rows; r++) for (var c = 0; c < opts.cols; c++) {
      g.fillStyle = cm(norm(opts.data[r * opts.cols + c]));
      // +0.5 px overlap avoids hairline seams between cells
      g.fillRect(mL + c * opts.cellW, mT + r * opts.cellH, opts.cellW + 0.5, opts.cellH + 0.5);
    }
    // annotations
    if (opts.annotate) {
      g.font = Math.max(8, Math.min(11, opts.cellW * 0.42)) + "px system-ui,sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      for (r = 0; r < opts.rows; r++) for (c = 0; c < opts.cols; c++) {
        var v = opts.data[r * opts.cols + c], t = norm(v);
        var lightCell = opts.cmap === "viridis" ? t > 0.6 : opts.cmap === "div" ? Math.abs(t - 0.5) < 0.3 : (isDark() ? t > 0.55 : t < 0.45);
        g.fillStyle = lightCell ? "#111" : "#f5f5f5";
        g.fillText(opts.annotate(v), mL + (c + 0.5) * opts.cellW, mT + (r + 0.5) * opts.cellH);
      }
    }
    // separator lines
    g.strokeStyle = ink; g.lineWidth = 1;
    (opts.hlines || []).forEach(function (r) {
      var y = Math.round(mT + r * opts.cellH) + 0.5;
      g.beginPath(); g.moveTo(mL, y); g.lineTo(mL + pw, y); g.stroke();
    });
    // box
    if (opts.box) {
      g.strokeStyle = "#f28e2b"; g.lineWidth = 1.5;
      g.strokeRect(mL + opts.box[0] * opts.cellW, mT + opts.box[1] * opts.cellH, opts.box[2] * opts.cellW, opts.box[3] * opts.cellH);
    }
    // frame
    g.strokeStyle = ink; g.globalAlpha = 0.5; g.lineWidth = 1;
    g.strokeRect(mL + 0.5, mT + 0.5, pw - 1, ph - 1); g.globalAlpha = 1;
    // text
    g.fillStyle = ink; g.font = "11px system-ui,sans-serif";
    if (opts.title) { g.font = "600 12px system-ui,sans-serif"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText(opts.title, mL, 15); g.font = "11px system-ui,sans-serif"; }
    if (opts.subtitle) { g.globalAlpha = 0.7; g.font = "10.5px system-ui,sans-serif"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText(opts.subtitle, mL, 28); g.globalAlpha = 1; g.font = "11px system-ui,sans-serif"; }
    g.textAlign = "right"; g.textBaseline = "middle";
    (opts.yTicks || []).forEach(function (t) { g.fillText(t[1], mL - 5, mT + t[0] * opts.cellH); });
    g.textAlign = "center"; g.textBaseline = "top";
    (opts.xTicks || []).forEach(function (t) { g.fillText(t[1], mL + t[0] * opts.cellW, mT + ph + 3); });
    if (opts.xLabel) g.fillText(opts.xLabel, mL + pw / 2, mT + ph + 18);
    if (opts.yLabel) {
      g.save(); g.translate(11, mT + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText(opts.yLabel, 0, 0); g.restore();
    }
    // colorbar: vertical beside tall plots, horizontal beside short ones (vectors, b3)
    if (opts.colorbar) {
      var fmtTick = function (v) { return Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2); };
      var bx = mL + pw + 10;
      g.fillStyle = ink; g.font = "11px system-ui,sans-serif";
      if (ph >= 90) {
        var bh = Math.min(ph - 16, 260), by = mT + 16 + (ph - 16 - bh) / 2;
        for (var y = 0; y < bh; y++) { g.fillStyle = cm(1 - y / bh); g.fillRect(bx, by + y, 10, 1.5); }
        g.strokeStyle = ink; g.globalAlpha = 0.5; g.strokeRect(bx + 0.5, by + 0.5, 9, bh - 1); g.globalAlpha = 1;
        g.fillStyle = ink; g.textAlign = "left"; g.textBaseline = "middle";
        (opts.cbCompact ? [0, 1] : [0, 0.5, 1]).forEach(function (f) { g.fillText(fmtTick(lo + (hi - lo) * (1 - f)), bx + 14, by + f * bh); });
        if (opts.cbLabel) { g.textAlign = "left"; g.textBaseline = "bottom"; g.fillText(opts.cbLabel, bx, by - 4); }
      } else {
        var bw = cbW - 12, byh = mT + ph / 2 - 9;
        for (var x = 0; x < bw; x++) { g.fillStyle = cm(x / bw); g.fillRect(bx + x, byh, 1.5, 8); }
        g.strokeStyle = ink; g.globalAlpha = 0.5; g.strokeRect(bx + 0.5, byh + 0.5, bw - 1, 7); g.globalAlpha = 1;
        g.fillStyle = ink; g.textBaseline = "top"; g.font = "10px system-ui,sans-serif";
        g.textAlign = "left"; g.fillText(fmtTick(lo), bx, byh + 10);
        g.textAlign = "right"; g.fillText(fmtTick(hi), bx + bw, byh + 10);
      }
    }
    // small horizontal colorbar under the plot, spanning its width
    if (opts.cbBelow) {
      var cy = mT + ph + mB - 28, tl = function (v) { return Math.abs(v) >= 10 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2); };
      for (var xx = 0; xx < pw; xx++) { g.fillStyle = cm(xx / pw); g.fillRect(mL + xx, cy, 1.5, 7); }
      g.strokeStyle = ink; g.globalAlpha = 0.5; g.strokeRect(mL + 0.5, cy + 0.5, pw - 1, 6); g.globalAlpha = 1;
      g.fillStyle = ink; g.font = "10px system-ui,sans-serif"; g.textBaseline = "top";
      g.textAlign = "left"; g.fillText(tl(lo), mL, cy + 9);
      if (opts.cmap === "div") { g.textAlign = "center"; g.fillText("0", mL + pw / 2, cy + 9); }
      g.textAlign = "right"; g.fillText(tl(hi), mL + pw, cy + 9);
    }
    // hover
    if (opts.tipFn) {
      cv.addEventListener("mousemove", function (ev) {
        var rect = cv.getBoundingClientRect(), px = ev.clientX - rect.left - mL, py = ev.clientY - rect.top - mT;
        var c = Math.floor(px / opts.cellW), r = Math.floor(py / opts.cellH);
        if (c < 0 || r < 0 || c >= opts.cols || r >= opts.rows) return tip(null);
        tip(opts.tipFn(r, c, opts.data[r * opts.cols + c]), ev);
      });
      cv.addEventListener("mouseleave", function () { tip(null); });
    }
    return cv;
  }

  // ------------------------------------------------------------------ DOM helpers
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fig(parent, title, note) {
    var f = el("div", "wv-fig");
    if (title) f.appendChild(el("div", "wv-title", title));
    var row = el("div", "wv-row");
    f.appendChild(row);
    if (note) f.appendChild(el("div", "wv-note", note));
    parent.appendChild(f);
    return row;
  }
  // Available width for a mount point (falls back if it sits inside a closed <details>).
  function widthOf(node) {
    var w = node.clientWidth;
    for (var p = node; !w && p; p = p.parentElement) w = p.clientWidth;
    return Math.max(320, w || 900);
  }

  // ------------------------------------------------------------------ one shared horizontal legend
  // kind: 'div' | 'mag' | 'viridis'; ticks: [[fraction 0..1, label]]
  function legend(parent, kind, ticks, label) {
    var dpr = window.devicePixelRatio || 1, H = 34, ink = inkColor();
    var meas = document.createElement("canvas").getContext("2d"); meas.font = "10.5px system-ui,sans-serif";
    var W = 8 + 150 + 8 + (label ? Math.ceil(meas.measureText(label).width) + 4 : 0);
    var cv = document.createElement("canvas");
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    var g = cv.getContext("2d"); g.scale(dpr, dpr);
    var cm = kind === "div" ? cmapDiverging() : kind === "viridis" ? VIRIDIS : cmapMagnitude();
    var x0 = 8, bw = 150;
    for (var x = 0; x < bw; x++) { g.fillStyle = cm(x / bw); g.fillRect(x0 + x, 4, 1.5, 9); }
    g.strokeStyle = ink; g.globalAlpha = 0.5; g.strokeRect(x0 + 0.5, 4.5, bw - 1, 8); g.globalAlpha = 1;
    g.fillStyle = ink; g.font = "10.5px system-ui,sans-serif"; g.textBaseline = "top";
    ticks.forEach(function (t) { g.textAlign = t[0] === 0 ? "left" : t[0] === 1 ? "right" : "center"; g.fillText(t[1], x0 + t[0] * bw, 16); });
    if (label) { g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(label, x0 + bw + 8, 9); }
    parent.appendChild(cv);
  }
  function fmtTick(v) { return Math.abs(v) >= 10 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2); }

  // ------------------------------------------------------------------ five 10x10 boards
  // Fits the width it is given; wraps onto a second line rather than overflowing on narrow screens.
  function boardsRow(parent, boards, opts) {
    var per = Array.isArray(opts.vmax);
    var avail = widthOf(parent) - 36 - 4 * 6 - 5 * 6 - 4 * 8 - 4;
    var cell = Math.max(10, Math.min(16, Math.floor(avail / 50)));
    var row = fig(parent, opts.title, null);
    for (var c = 0; c < 5; c++) {
      var lo = Array.isArray(opts.vmin) ? opts.vmin[c] : opts.vmin, hi = per ? opts.vmax[c] : opts.vmax;
      row.appendChild(heatmap({
        data: boards[c], rows: 10, cols: 10, cellW: cell, cellH: cell,
        cmap: opts.cmap, vmin: lo, vmax: hi,
        title: "ch " + c + ": " + (cell * 10 < 130 ? CH_SHORT[c] : CH_NAMES[c]),
        xTicks: [0, 9].map(function (k) { return [k + 0.5, String(k)]; }),
        yTicks: c === 0 ? [0, 9].map(function (k) { return [k + 0.5, "row " + k]; }) : null,
        marginLeft: c === 0 ? 36 : 6, marginBottom: 16,
        box: [1, 1, 8, 8], annotate: opts.annotate && cell >= 17 ? opts.annotate : null, cbBelow: per,
        tipFn: function (cc) {
          return function (r, col, v) { return "ch " + cc + " (" + CH_NAMES[cc] + ")\nrow " + r + ", col " + col + "\ninput " + ((r * 10 + col) * 5 + cc) + "\n" + opts.tipLabel + " = " + opts.tipFmt(v); };
        }(c),
      }));
    }
    var foot = el("div", "wv-row"); foot.style.alignItems = "center"; row.parentNode.appendChild(foot);
    if (!per) legend(foot, opts.cmap, [[0, fmtTick(opts.vmin || 0)], [0.5, fmtTick(((opts.vmin || 0) + opts.vmax) / 2)], [1, fmtTick(opts.vmax)]], opts.cbLabel);
    if (opts.note) row.parentNode.appendChild(el("div", "wv-note", opts.note));
  }

  // ------------------------------------------------------------------ views
  var VIEWS = {};
  function stripNotes(node) {
    if (node._wvFull === false) node.querySelectorAll(".wv-note").forEach(function (n) { n.remove(); });
  }

  /* The whole network as one picture, left to right like a network diagram:
   *   [W1 500x32 over b1] -> [W2 32x32 over b2] -> [W3 32x5 over b3]
   * Each block is on its own color scale (its max |w| is printed under it). Static: no hover. */
  VIEWS.raw = function (node, N) {
    var ink = inkColor(), dpr = window.devicePixelRatio || 1, cm = cmapDiverging();
    var gapB = 8, bh = 8, arrow = 56, top = 36, left = 8;
    var act = node.getAttribute("data-wv-act") || "tanh", outLabel = node.getAttribute("data-wv-out") || "logits";
    // block geometry from the shapes: ~192 px wide; tall matrices (W1) up to 500 px
    function geom(M) {
      var cwid = Math.min(8, 160 / M.c), rh = M.r <= 64 ? 160 / M.r : Math.max(0.8, Math.min(4, 420 / M.r));
      return { cwid: cwid, rh: rh };
    }
    var blocks = [["W1", N.W1, N.b1, "b1"], ["W2", N.W2, N.b2, "b2"], ["W3", N.W3, N.b3, "b3"]].map(function (t) {
      var gm = geom(t[1]);
      return { name: t[0], M: t[1].a, rows: t[1].r, cols: t[1].c, cwid: gm.cwid, rh: gm.rh, b: t[2], bname: t[3], shape: t[1].r + " × " + t[1].c };
    });
    var x = left;
    blocks.forEach(function (B, k) { B.x = x; B.w = B.cols * B.cwid; B.h = B.rows * B.rh; x += B.w + (k < 2 ? arrow : 0); });
    var tallest = Math.max.apply(null, blocks.map(function (B) { return B.h; }));
    var W = x + 70, H = top + Math.max(tallest + gapB + bh + 40, blocks[1].h + gapB + bh + 130);
    var cv = document.createElement("canvas");
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = "auto";
    cv.style.maxWidth = "100%";   // static picture: shrink to fit a narrow column rather than overflow
    var g = cv.getContext("2d"); g.scale(dpr, dpr);

    function paint(M, rows, cols, x0, y0, cwid, rh) {
      var vmax = absMax(M) || 1;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        g.fillStyle = cm((M[r * cols + c] / vmax + 1) / 2);
        g.fillRect(x0 + c * cwid, y0 + r * rh, cwid + 0.5, rh + 0.5);
      }
      g.strokeStyle = ink; g.globalAlpha = 0.45; g.lineWidth = 1;
      g.strokeRect(x0 - 0.5, y0 - 0.5, cols * cwid + 1, rows * rh + 1); g.globalAlpha = 1;
      return vmax;
    }
    g.textBaseline = "alphabetic";
    blocks.forEach(function (B, k) {
      var vW = paint(B.M, B.rows, B.cols, B.x, top, B.cwid, B.rh);
      var by = top + B.h + gapB;
      var vB = paint(B.b, 1, B.b.length, B.x, by, B.cwid, bh);
      g.fillStyle = ink; g.textAlign = "left";
      g.font = "600 12px system-ui,sans-serif"; g.fillText(B.name, B.x, top - 20);
      g.font = "10.5px system-ui,sans-serif"; g.globalAlpha = 0.75; g.fillText(B.shape, B.x, top - 7); g.globalAlpha = 1;
      g.font = "10.5px system-ui,sans-serif";
      g.fillText(B.bname, B.x, by + bh + 13);
      g.globalAlpha = 0.7;
      g.fillText("max |w| " + vW.toFixed(2), B.x, by + bh + 26);
      g.fillText("max |b| " + vB.toFixed(2), B.x, by + bh + 38);
      g.globalAlpha = 1;
      // arrow to the next block
      var ay = top + 70, ax0 = B.x + B.w + 8, ax1 = B.x + B.w + (k < 2 ? arrow : 46) - 8;
      g.strokeStyle = ink; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ax0, ay); g.lineTo(ax1, ay); g.stroke();
      g.beginPath(); g.moveTo(ax1, ay); g.lineTo(ax1 - 6, ay - 4); g.lineTo(ax1 - 6, ay + 4); g.closePath(); g.fillStyle = ink; g.fill();
      g.textAlign = "center"; g.font = "10.5px system-ui,sans-serif";
      g.fillText(k < 2 ? act : outLabel, (ax0 + ax1) / 2 + (k < 2 ? 0 : 14), ay - 7);
    });
    // color-scale explanation, in the empty space under W2 and W3
    var lx = blocks[1].x, ly = top + blocks[1].h + gapB + bh + 70, lw = 150;
    for (var q = 0; q < lw; q++) { g.fillStyle = cm(q / lw); g.fillRect(lx + q, ly, 1.5, 9); }
    g.strokeStyle = ink; g.globalAlpha = 0.5; g.strokeRect(lx + 0.5, ly + 0.5, lw - 1, 8); g.globalAlpha = 1;
    g.fillStyle = ink; g.font = "10.5px system-ui,sans-serif"; g.textBaseline = "top";
    g.textAlign = "left"; g.fillText("−max", lx, ly + 12);
    g.textAlign = "center"; g.fillText("0", lx + lw / 2, ly + 12);
    g.textAlign = "right"; g.fillText("+max", lx + lw, ly + 12);
    g.textAlign = "left"; g.textBaseline = "alphabetic"; g.globalAlpha = 0.75;
    ["Each block has its own color scale:", "−max and +max are that block's", "largest |value|, printed under it."]
      .forEach(function (t, i) { g.fillText(t, lx, ly + 42 + i * 14); });
    g.globalAlpha = 1;

    var f = el("div", "wv-fig");
    f.appendChild(el("div", "wv-title", "The whole network, as given"));
    f.appendChild(cv);
    f.appendChild(el("div", "wv-note", node.getAttribute("data-wv-note") ||
      ("Rows are a layer's inputs and columns its outputs (h = tanh(x·W + b)). W1's 500 rows are the inputs " +
      "i = (row·10 + col)·5 + channel; W3's 5 columns are the actions noop, up, down, left, right.")));
    node.appendChild(f);
  };

  /* Diffusion models (experiment 2): x0_hat = b3 + sum_j h2_j * W3[j, :], with h2_j >= 0 (ReLU).
   * So b3 is the base image and each layer-2 unit can only ADD its row of W3, scaled by how active it is.
   * Shows b3 as a 12x12 image (black = -1, white = +1) and each W3 row as a 12x12 image on its own scale. */
  VIEWS.units = function (node, N) {
    var side = Math.round(Math.sqrt(N.W3.c)), H = N.W3.r, w = widthOf(node);
    if (node.getAttribute("data-wv-base") !== "hide") {   // data-wv-base="hide" leaves out the b3 image
      var row0 = fig(node, "b3: the image the network predicts when every layer-2 unit is off");
      row0.appendChild(heatmap({
        data: N.b3, rows: side, cols: side, cellW: 14, cellH: 14, cmap: "pixel", vmin: -1, vmax: 1, cbBelow: true,
        tipFn: function (r, c, v) { return "pixel (" + r + ", " + c + ")\nb3 = " + fmt(v); },
      }));
    }
    var perRow = Math.max(4, Math.min(16, Math.floor((w + 6) / (side * 5 + 12))));
    var cell = Math.max(3, Math.min(5, Math.floor((w - perRow * 10) / (perRow * side))));
    var row = fig(node, "What each final neuron adds to the image (rows of W3)",
      "Each tile is one unit's 144 outgoing weights folded back to 12 × 12, on its own color scale. Red brightens a pixel, blue darkens it. " +
      "Since the unit's activation is never negative, it can only add its own pattern, never the opposite. Hover a pixel for its value.");
    for (var j = 0; j < H; j++) {
      var d = N.W3.a.subarray(j * N.W3.c, (j + 1) * N.W3.c);
      row.appendChild(heatmap({
        data: d, rows: side, cols: side, cellW: cell, cellH: cell, cmap: "div", title: "unit " + j, marginLeft: 2, marginBottom: 2,
        tipFn: function (jj) { return function (r, c, v) { return "unit " + jj + ", pixel (" + r + ", " + c + ")\nW3[" + jj + ", " + (r * side + c) + "] = " + fmt(v); }; }(j),
      }));
    }
    var foot = el("div", "wv-row"); foot.style.alignItems = "center"; row.parentNode.insertBefore(foot, row.nextSibling);
    legend(foot, "div", [[0, "−max"], [0.5, "0"], [1, "+max"]], "each tile on its own scale");
  };

  // data-wv-scale="shared" | "per" fixes the color scale; anything else shows a checkbox.
  function scaleControl(node, state, key) {
    var fixed = node.getAttribute("data-wv-scale");
    if (fixed === "shared" || fixed === "per") { state[key] = fixed === "shared"; return { addEventListener: function () {} }; }
    var ctrl = el("div", "wv-ctrl"), lab = el("label"), cb = el("input");
    cb.type = "checkbox"; cb.checked = state[key];
    lab.appendChild(cb); lab.appendChild(document.createTextNode("same color scale for all channels"));
    ctrl.appendChild(lab); node.appendChild(ctrl);
    return cb;
  }

  VIEWS.text = function (node, N) {
    var lines = ["W1 (layer 1 weights), shape 500 x 32: one line per row (row i = input i), 32 values per line"];
    for (var i = 0; i < 500; i++) {
      var row = [];
      for (var j = 0; j < 32; j++) row.push(N.W1.a[i * 32 + j].toFixed(3));
      lines.push(row.join(" "));
    }
    lines.push("", "... followed by b1, W2, b2, W3 and b3 in the same format.");
    var pre = el("pre", "wv-text", lines.join("\n"));
    node.appendChild(pre);
  };

  VIEWS.channels = function (node, N, state) {
    var cb = scaleControl(node, state, "sharedScale");
    var holder = el("div"); node.appendChild(holder);
    function draw() {
      holder.innerHTML = "";
      var blocks = [0, 1, 2, 3, 4].map(function (c) { return channelBlock(N.W1, c); });
      var vAll = absMax(N.W1.a), w = widthOf(node);
      var cellW = Math.max(2, Math.min(4, Math.floor((w - 42 - 4 * 6 - 5 * 6 - 4 * 8 - 4) / 160)));
      var row = fig(holder, null, null);
      for (var c = 0; c < 5; c++) {
        row.appendChild(heatmap({
          data: blocks[c], rows: 100, cols: 32, cellW: cellW, cellH: 3.6, cmap: "div",
          vmax: state.sharedScale ? vAll : absMax(blocks[c]),
          title: "ch " + c + ": " + (cellW * 32 < 130 ? CH_SHORT[c] : CH_NAMES[c]), subtitle: "max |w| " + absMax(blocks[c]).toFixed(2),
          hlines: [10, 20, 30, 40, 50, 60, 70, 80, 90],
          yTicks: c === 0 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (r) { return [r * 10 + 5, "row " + r]; }) : null,
          marginLeft: c === 0 ? 42 : 6,
          xTicks: [[0.5, "0"], [31.5, "31"]], xLabel: "unit", cbBelow: !state.sharedScale,
          tipFn: function (cc) {
            return function (k, j, v) {
              return "ch " + cc + " (" + CH_NAMES[cc] + ")\nboard row " + Math.floor(k / 10) + ", col " + (k % 10) + "\nunit " + j + "\nW1[" + (k * 5 + cc) + ", " + j + "] = " + fmt(v);
            };
          }(c),
        }));
      }
      var foot = el("div", "wv-row"); foot.style.alignItems = "center"; holder.firstChild.appendChild(foot);
      if (state.sharedScale) legend(foot, "div", [[0, fmtTick(-vAll)], [0.5, "0"], [1, fmtTick(vAll)]], "weight");
      holder.firstChild.appendChild(el("div", "wv-note",
        "Each block is 100 cells × 32 units. Block row k = board_row·10 + board_col, so rows are grouped by board row " +
        "(row first, column second); black lines separate board rows. Rows 0 and 9, and the first and last entry of each band (columns 0 and 9), are the wall border."));
    }
    cb.addEventListener("change", function () { state.sharedScale = cb.checked; draw(); stripNotes(node); });
    draw();
  };

  VIEWS.size = function (node, N, state) {
    var cb = scaleControl(node, state, "sizeShared");
    var holder = el("div"); node.appendChild(holder);
    function draw() {
      holder.innerHTML = "";
      var b = toBoards(rowNorms(N.W1)), each = b.map(absMax), all = Math.max.apply(null, each);
      var mins = b.map(function (t) { return Math.min.apply(null, Array.prototype.slice.call(t)); });
      boardsRow(holder, b, {
        title: "Input Channel Weight Norm  ‖W1[i, :]‖",
        note: (state.sizeShared
          ? "One color scale for all channels, so channels can be compared with each other."
          : "Each channel has its own color scale (shown under it), so compare colors only within a board.") +
          " Orange box = playable 8×8. Hover a cell for its value.",
        cmap: "mag", vmin: state.sizeShared ? 0 : mins, vmax: state.sizeShared ? all : each,
        annotate: null, cbLabel: "‖W1[i,:]‖",
        tipLabel: "‖W1[i,:]‖", tipFmt: function (v) { return v.toFixed(3); },
      });
    }
    cb.addEventListener("change", function () { state.sizeShared = cb.checked; draw(); stripNotes(node); });
    draw();
  };

  VIEWS.topk = function (node, N, state) {
    var ctrl = el("div", "wv-ctrl");
    var l1 = el("label"); l1.appendChild(document.createTextNode("top"));
    var sl = el("input"); sl.type = "range"; sl.min = 5; sl.max = 95; sl.step = 5; sl.value = state.topP;
    var val = el("span", "wv-val");
    l1.appendChild(sl); l1.appendChild(val);
    ctrl.appendChild(l1);
    var modes = el("span");
    [["mass", "by share of squared weight"], ["rank", "by count of inputs"]].forEach(function (m) {
      var lab = el("label"), r = el("input");
      r.type = "radio"; r.name = "wv-mode-" + Math.random().toString(36).slice(2); r.value = m[0]; r.checked = state.topMode === m[0];
      r.addEventListener("change", function () { if (r.checked) { state.topMode = m[0]; draw(); } });
      lab.appendChild(r); lab.appendChild(document.createTextNode(m[1]));
      modes.appendChild(lab);
    });
    modes.style.display = "flex"; modes.style.gap = "14px";
    ctrl.appendChild(modes);
    node.appendChild(ctrl);
    var holder = el("div"); node.appendChild(holder);

    function draw() {
      val.textContent = state.topP + "%";
      holder.innerHTML = "";
      var p = state.topP / 100, res = topCounts(N.W1, p, state.topMode);
      var sz = res.sizes;
      var rule = state.topMode === "mass"
        ? "For each layer-1 unit, its inputs are sorted by |w| and kept until their squared weights reach " + state.topP + "% of the unit's total."
        : "For each layer-1 unit, the " + Math.round(p * 500) + " inputs (" + state.topP + "% of 500) with the largest |w| are kept.";
      boardsRow(holder, toBoards(res.count), {
        title: "Number of layer-1 units (of 32) that keep this input in their top " + state.topP + "%",
        note: rule + "  Inputs kept per unit: min " + Math.min.apply(null, sz) + ", median " + median(sz) + ", max " + Math.max.apply(null, sz) + ".",
        cmap: "viridis", vmin: 0, vmax: 32, annotate: function (v) { return v.toFixed(0); }, cbLabel: "units",
        tipLabel: "units", tipFmt: function (v) { return v.toFixed(0) + " of 32"; },
      });
    }
    sl.addEventListener("input", function () { state.topP = +sl.value; draw(); stripNotes(node); });
    draw();
  };

  VIEWS.bias = function (node, N) {
    var p = softmax(Array.prototype.slice.call(N.b3));
    var row = fig(node, "Output Biases + Naive Action Probabilities",
      "softmax(b3) is the network's default policy when the hidden layer contributes nothing.");
    var probs = Float64Array.from(p);
    row.appendChild(heatmap({
      data: N.b3, rows: 5, cols: 1, cellW: 60, cellH: 24, cmap: "div", title: "b3",
      yTicks: ACTIONS.map(function (a, k) { return [k + 0.5, a]; }), marginBottom: 6,
      annotate: function (v) { return fmt(v, 2); },
      tipFn: function (r, c, v) { return "b3[" + r + "] (" + ACTIONS[r] + ") = " + fmt(v); },
    }));
    row.appendChild(heatmap({
      data: probs, rows: 5, cols: 1, cellW: 60, cellH: 24, cmap: "viridis", vmin: 0, vmax: 1, title: "softmax(b3)",
      marginLeft: 8, marginBottom: 6, annotate: function (v) { return v.toFixed(2); },
      tipFn: function (r, c, v) { return ACTIONS[r] + ": " + (100 * v).toFixed(1) + "%"; },
    }));
  };

  // ------------------------------------------------------------------ app
  /* Each mount point names its network: <div data-wv="size" data-wv-net="net2"></div>.
   * The weights come from data scripts loaded before this file (net2.js sets window.WV_WEIGHTS.net2),
   * which also works when the page is opened straight from disk. */
  function init() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var cache = {};
    var mounts = Array.prototype.slice.call(document.querySelectorAll("[data-wv]"));
    // Explanatory notes appear only under the first figure of each kind (same kind and same
    // data-wv-note); later ones drop them. data-wv-notes="show" keeps them anyway.
    var seen = {};
    mounts.forEach(function (m) {
      var key = m.getAttribute("data-wv") + "|" + (m.getAttribute("data-wv-note") || "");
      m._wvFull = !seen[key] || m.getAttribute("data-wv-notes") === "show";
      seen[key] = true;
    });

    function load(key) {
      if (!cache[key]) {
        var raw = window.WV_WEIGHTS && window.WV_WEIGHTS[key];
        if (!raw) throw new Error("no weights for '" + key + "'; is " + key + ".js loaded before weight-viz.js?");
        cache[key] = prepare(raw);
      }
      return cache[key];
    }
    function isHidden(node) {
      for (var p = node; p; p = p.parentElement) {
        if (p.tagName === "DETAILS" && !p.open) return true;
        if (p.hidden) return true;
      }
      return false;
    }
    function renderStaleIn(root) {
      mounts.forEach(function (m) { if (root.contains(m) && m.dataset.wvStale === "1") renderOne(m); });
    }
    // Tabs: each .wv-tabs holds .wv-tab panels with a data-label; the first is shown.
    document.querySelectorAll(".wv-tabs").forEach(function (box) {
      var panels = Array.prototype.slice.call(box.children).filter(function (c) { return c.classList.contains("wv-tab"); });
      var bar = el("div", "wv-tabbar"), btns = [];
      panels.forEach(function (pnl, i) {
        var b = el("button", "wv-tabbtn", pnl.getAttribute("data-label") || "Tab " + (i + 1));
        b.type = "button";
        b.addEventListener("click", function () { show(i); });
        bar.appendChild(b); btns.push(b);
      });
      function show(i) {
        panels.forEach(function (pnl, k) { pnl.hidden = k !== i; btns[k].classList.toggle("wv-on", k === i); });
        renderStaleIn(panels[i]);
      }
      box.insertBefore(bar, box.firstChild);
      show(0);
    });
    function renderOne(node) {
      if (isHidden(node)) { node.dataset.wvStale = "1"; return; }   // drawn when its <details> opens
      node.dataset.wvStale = "";
      node.innerHTML = "";
      var kind = node.getAttribute("data-wv");
      // per-mount state, so toggles in one figure don't affect another
      node._wvState = node._wvState || { sharedScale: true, sizeShared: true, topP: 25, topMode: "mass" };
      try {
        var N = load(node.getAttribute("data-wv-net"));
        if (VIEWS[kind]) VIEWS[kind](node, N, node._wvState);
        if (!node._wvFull) node.querySelectorAll(".wv-note").forEach(function (n) { n.remove(); });
      } catch (e) {
        node.textContent = "Could not draw this figure: " + e.message;
      }
    }
    function renderAll() { mounts.forEach(renderOne); }
    document.querySelectorAll("details").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) renderStaleIn(d);
      });
    });
    new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(renderAll, 200); });
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
