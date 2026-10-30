(function () {
  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const TOOLS = [
    ["index.html", "Compress"],
    ["resize.html", "Resize"],
    ["crop.html", "Crop"],
    ["rotate.html", "Rotate"],
    ["convert.html", "Convert"],
    ["watermark.html", "Watermark"],
    ["meme.html", "Meme"],
    ["photo-editor.html", "Photo editor"],
    ["batch.html", "Batch"]
  ];
  const LABELS = { system: "🖥️ System", light: "☀️ Light", dark: "🌙 Dark" };
  const MODES = ["system", "light", "dark"];
  const inTools = /\/tools\//.test(location.pathname);
  const current = location.pathname.split("/").pop() || "index.html";
  const root = inTools ? "../" : "";

  function hrefFor(file) {
    if (file === "index.html") return root + "index.html";
    return inTools ? file : "tools/" + file;
  }

  // ---------- Navigation bar ----------
  function buildNav() {
    let nav = document.getElementById("nav");
    if (!nav) {
      nav = document.createElement("header");
      nav.id = "nav";
      document.body.prepend(nav);
    }
    const links = TOOLS.map(function (t) {
      const cls = t[0] === current ? "tn-link active" : "tn-link";
      return '<a class="' + cls + '" href="' + hrefFor(t[0]) + '">' + t[1] + "</a>";
    }).join("");
    nav.innerHTML =
      '<nav class="tn"><a class="tn-brand" href="' + hrefFor("index.html") + '"><img src="' + root + 'icons/icon-192.png" alt="" class="tn-icon">ImageTools</a>' +
      links + '<button class="tn-theme" id="tnTheme"></button></nav>';

    let mode = "system";
    try { mode = localStorage.getItem("theme") || "system"; } catch (e) {}
    function applyTheme() {
      if (mode === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", mode);
      document.getElementById("tnTheme").textContent = LABELS[mode];
      try { localStorage.setItem("theme", mode); } catch (e) {}
    }
    document.getElementById("tnTheme").addEventListener("click", function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      applyTheme();
    });
    applyTheme();
  }

  // ---------- PWA: manifest, theme colour, service worker ----------
  function addHead() {
    const add = function (tag, attrs) {
      const el = document.createElement(tag);
      Object.assign(el, attrs);
      document.head.appendChild(el);
    };
    add("link", { rel: "manifest", href: root + "manifest.json" });
    add("meta", { name: "theme-color", content: "#6a11cb" });
    add("link", { rel: "icon", type: "image/png", href: root + "icons/icon-192.png" });
    add("link", { rel: "apple-touch-icon", href: root + "icons/icon-192.png" });
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register(root + "sw.js").catch(function () {});
      });
    }
  }

  // ---------- Helpers ----------
  function fmtSize(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + " MB" : (bytes / 1024).toFixed(1) + " KB";
  }

  // Loads a file as an image and remembers its URL as the "original" for the before/after slider
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const im = new Image();
      im.onload = function () { window.originalUrl = im.src; resolve(im); };
      im.onerror = reject;
      im.src = URL.createObjectURL(file);
    });
  }

  function setupDrop(zone, input, onFile) {
    input.addEventListener("change", function () {
      if (input.files[0]) onFile(input.files[0]);
    });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("hover"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("hover"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("hover");
      if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
    });
    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("drop", function (e) { e.preventDefault(); });
  }

  // Draws a source onto a new canvas of the given size (white background for JPG)
  function paint(source, type, w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext("2d");
    if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  // Binary search for the best quality that fits; shrinks the image if needed
  async function fitToSize(source, type, targetBytes) {
    let scale = 1;
    while (scale > 0.1) {
      const c = paint(source, type, source.width * scale, source.height * scale);
      let low = 0.1, high = 0.95, best = null;
      for (let i = 0; i < 7; i++) {
        const mid = (low + high) / 2;
        const blob = await toBlob(c, type, mid);
        if (blob.size <= targetBytes) { best = { blob: blob, c: c }; low = mid; }
        else { high = mid; }
      }
      if (best) return best;
      scale *= 0.9;
    }
    return null;
  }

  // Before/after slider: replaces the result image with a draggable comparison
  function showCompare(afterUrl, w, h) {
    const out = document.getElementById("out");
    let box = document.getElementById("ba");
    if (!box) {
      box = document.createElement("div");
      box.id = "ba";
      box.className = "ba";
      out.replaceWith(box);
    }
    box.style.aspectRatio = w + " / " + h;
    box.innerHTML =
      '<img class="ba-base" src="' + (window.originalUrl || afterUrl) + '" alt="Original">' +
      '<img class="ba-after" src="' + afterUrl + '" alt="Result">' +
      '<div class="ba-line"></div>' +
      '<input type="range" class="ba-range" min="0" max="100" value="50" aria-label="Compare slider">';
    const range = box.querySelector(".ba-range");
    const set = function () { box.style.setProperty("--p", range.value + "%"); };
    range.addEventListener("input", set);
    set();
  }

  // Shows the result card. targetBytes (optional) makes the output fit under that size.
  let lastUrl = "";
  async function output(source, type, quality, targetBytes) {
    const msg = document.getElementById("msg");
    if (msg) msg.textContent = "";

    if (targetBytes && type === "image/png") {
      type = "image/jpeg";
      if (msg) msg.textContent = "Target size needs JPG or WebP, so JPG was used.";
    }

    let c, blob;
    if (targetBytes) {
      const r = await fitToSize(source, type, targetBytes);
      if (!r) { if (msg) msg.textContent = "Could not reach that size. Try a larger target."; return; }
      c = r.c; blob = r.blob;
    } else {
      c = paint(source, type, source.width, source.height);
      blob = await toBlob(c, type, quality || 0.92);
    }

    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);
    const ext = EXT[type];

    showCompare(lastUrl, c.width, c.height);
    document.getElementById("resultInfo").textContent =
      c.width + " x " + c.height + " · " + fmtSize(blob.size) + " · ." + ext;
    document.getElementById("resultCard").hidden = false;
    document.getElementById("dl").onclick = function () {
      const a = document.createElement("a");
      a.href = lastUrl;
      a.download = "image." + ext;
      a.click();
    };
    document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" });
  }

  window.loadImage = loadImage;
  window.setupDrop = setupDrop;
  window.fmtSize = fmtSize;
  window.paint = paint;
  window.toBlob = toBlob;
  window.fitToSize = fitToSize;
  window.output = output;

  buildNav();
  addHead();
})();