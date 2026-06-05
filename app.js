const FORMATS = [
  { id: "ig-square", name: "Instagram", detail: "Kvadrat", width: 1080, height: 1080 },
  { id: "ig-portrait", name: "Instagram", detail: "Portrett", width: 1080, height: 1350 },
  { id: "story", name: "Story / Snap", detail: "9:16", width: 1080, height: 1920 },
  { id: "facebook", name: "Facebook", detail: "Lenke", width: 1200, height: 630 },
  { id: "landscape", name: "Facebook", detail: "Video/post", width: 1920, height: 1080 },
  { id: "custom", name: "Egendefinert", detail: "Velg mål", width: 1080, height: 1080 }
];

const TEMPLATES = [
  { id: "full", name: "Fullflate", detail: "1 bilde" },
  { id: "headline", name: "Tittelboks", detail: "Bilde + tekst" },
  { id: "split2", name: "Delt 2", detail: "To felt" },
  { id: "split3", name: "Delt 3", detail: "Tre felt" },
  { id: "inset", name: "Innfelt", detail: "Luft rundt" },
  { id: "quote", name: "Sitat", detail: "Stor tekst" }
];

const LOGOS = {
  color: "assets/sa-farget.svg",
  white: "assets/sa-hvit.svg",
  black: "assets/sa-sort.svg",
  fullColor: "assets/sa-no-farget.svg"
};

const PALETTE = ["#e40200", "#0064dc", "#ef8a17", "#111827", "#ffffff", "#00584f", "#f7f8fb"];
const SNAP_THRESHOLD = 24;
const SNAP_GAP = 24;

const canvas = document.querySelector("#postCanvas");
const ctx = canvas.getContext("2d");
const canvasFrame = document.querySelector(".canvas-frame");
const fileInput = document.querySelector("#fileInput");
const formatGrid = document.querySelector("#formatGrid");
const templateGrid = document.querySelector("#templateGrid");
const customSize = document.querySelector("#customSize");
const formatStatus = document.querySelector("#formatStatus");
const exportBtn = document.querySelector("#exportBtn");
const imageZoom = document.querySelector("#imageZoom");
const imageBrightness = document.querySelector("#imageBrightness");
const imageVignette = document.querySelector("#imageVignette");
const textList = document.querySelector("#textList");
const textContent = document.querySelector("#textContent");
const fontSize = document.querySelector("#fontSize");
const textWidth = document.querySelector("#textWidth");
const boxColor = document.querySelector("#boxColor");
const textColor = document.querySelector("#textColor");
const logoVisible = document.querySelector("#logoVisible");
const logoSize = document.querySelector("#logoSize");

const logoImages = {};
let drag = null;

const state = {
  format: { ...FORMATS[0] },
  template: "headline",
  slots: [],
  selectedSlotId: null,
  texts: [],
  selectedTextId: null,
  logo: { visible: true, variant: "color", x: 58, y: 58, w: 190 },
  snapGuides: []
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createSlot(rect, previous) {
  return {
    id: previous?.id || uid("slot"),
    rect,
    image: previous?.image || null,
    imageName: previous?.imageName || "",
    fit: previous?.fit || "cover",
    zoom: previous?.zoom || 1,
    offsetX: previous?.offsetX || 0,
    offsetY: previous?.offsetY || 0,
    brightness: previous?.brightness || 1,
    vignette: previous?.vignette || 0
  };
}

function getTemplateRects(templateId) {
  const portrait = state.format.height > state.format.width * 1.15;
  const landscape = state.format.width > state.format.height * 1.25;

  if (templateId === "split2") {
    return portrait
      ? [{ x: 0, y: 0, w: 1, h: 0.52 }, { x: 0, y: 0.52, w: 1, h: 0.48 }]
      : [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }];
  }

  if (templateId === "split3") {
    return portrait
      ? [{ x: 0, y: 0, w: 1, h: 0.48 }, { x: 0, y: 0.48, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.48, w: 0.5, h: 0.52 }]
      : [{ x: 0, y: 0, w: 0.55, h: 1 }, { x: 0.55, y: 0, w: 0.45, h: 0.5 }, { x: 0.55, y: 0.5, w: 0.45, h: 0.5 }];
  }

  if (templateId === "inset") {
    return landscape
      ? [{ x: 0.06, y: 0.08, w: 0.62, h: 0.84 }]
      : [{ x: 0.07, y: 0.07, w: 0.86, h: 0.64 }];
  }

  return [{ x: 0, y: 0, w: 1, h: 1 }];
}

function applyTemplate(templateId, resetText = false) {
  const previous = state.slots;
  state.template = templateId;
  state.slots = getTemplateRects(templateId).map((rect, index) => createSlot(rect, previous[index]));
  state.selectedSlotId = state.slots[0]?.id || null;

  if (resetText) {
    state.texts = [];
    state.selectedTextId = null;
  }

  if (templateId === "headline" && state.texts.length === 0) {
    addText({
      text: "Skriv tittel her",
      x: Math.round(state.format.width * 0.08),
      y: Math.round(state.format.height * 0.68),
      w: Math.round(state.format.width * 0.84),
      fontSize: Math.round(state.format.width * 0.07),
      bg: "#e40200",
      color: "#ffffff"
    });
  }

  if (templateId === "quote" && state.texts.length === 0) {
    addText({
      text: "Sitat eller hovedpoeng",
      x: Math.round(state.format.width * 0.1),
      y: Math.round(state.format.height * 0.36),
      w: Math.round(state.format.width * 0.8),
      fontSize: Math.round(state.format.width * 0.075),
      bg: "#0064dc",
      color: "#ffffff"
    });
  }

  updateControls();
  draw();
}

function addText(overrides = {}) {
  const item = {
    id: uid("text"),
    text: "Ny tekst",
    x: Math.round(state.format.width * 0.12),
    y: Math.round(state.format.height * 0.14),
    w: Math.round(state.format.width * 0.72),
    fontSize: Math.round(Math.max(36, state.format.width * 0.055)),
    bg: "#ef8a17",
    color: "#111827",
    align: "center",
    padding: 26,
    h: 100,
    ...overrides
  };
  state.texts.push(item);
  state.selectedTextId = item.id;
}

function selectedSlot() {
  return state.slots.find((slot) => slot.id === state.selectedSlotId) || state.slots[0] || null;
}

function selectedText() {
  return state.texts.find((item) => item.id === state.selectedTextId) || null;
}

function loadLogos() {
  Object.entries(LOGOS).forEach(([key, src]) => {
    const image = new Image();
    image.onload = draw;
    image.src = src;
    logoImages[key] = image;
  });
}

function renderFormatButtons() {
  formatGrid.innerHTML = "";
  FORMATS.forEach((format) => {
    const active = format.id === state.format.id;
    const width = active && format.id === "custom" ? state.format.width : format.width;
    const height = active && format.id === "custom" ? state.format.height : format.height;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `format-card${active ? " active" : ""}`;
    button.dataset.format = format.id;
    button.innerHTML = `<strong>${format.name}</strong><span>${format.detail}<br>${width}x${height}</span>`;
    formatGrid.append(button);
  });
}

function renderTemplateButtons() {
  templateGrid.innerHTML = "";
  TEMPLATES.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `template-card${template.id === state.template ? " active" : ""}`;
    button.dataset.template = template.id;
    button.innerHTML = `<strong>${template.name}</strong><span>${template.detail}</span>`;
    templateGrid.append(button);
  });
}

function renderTextList() {
  textList.innerHTML = "";
  state.texts.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `text-chip${item.id === state.selectedTextId ? " active" : ""}`;
    button.dataset.text = item.id;
    button.innerHTML = `<span>${item.text || `Tekst ${index + 1}`}</span><small>${index + 1}</small>`;
    textList.append(button);
  });
}

function renderSwatches(containerId, input, property) {
  const container = document.querySelector(containerId);
  container.innerHTML = "";
  PALETTE.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `swatch${input.value.toLowerCase() === color ? " active" : ""}`;
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => {
      input.value = color;
      updateSelectedText({ [property]: color });
    });
    container.append(button);
  });
}

function setFormat(format) {
  const oldWidth = state.format.width;
  const oldHeight = state.format.height;
  state.format = { ...format };
  canvas.width = state.format.width;
  canvas.height = state.format.height;

  const sx = state.format.width / oldWidth;
  const sy = state.format.height / oldHeight;
  state.texts.forEach((item) => {
    item.x = Math.round(item.x * sx);
    item.y = Math.round(item.y * sy);
    item.w = Math.round(item.w * sx);
    item.fontSize = Math.round(item.fontSize * Math.min(sx, sy));
  });
  state.logo.x = Math.round(state.logo.x * sx);
  state.logo.y = Math.round(state.logo.y * sy);
  state.logo.w = Math.round(state.logo.w * Math.min(sx, sy));
  applyTemplate(state.template, false);
}

function updateControls() {
  renderFormatButtons();
  renderTemplateButtons();
  renderTextList();
  resizeCanvasPreview();
  formatStatus.textContent = `${state.format.name} ${state.format.detail} · ${state.format.width}x${state.format.height}`;
  exportBtn.textContent = `Eksporter (${state.format.width}x${state.format.height})`;
  customSize.classList.toggle("show", state.format.id === "custom");
  document.querySelector("#customWidth").value = state.format.width;
  document.querySelector("#customHeight").value = state.format.height;

  const slot = selectedSlot();
  if (slot) {
    imageZoom.value = slot.zoom;
    imageBrightness.value = slot.brightness;
    imageVignette.value = slot.vignette;
  }

  logoVisible.checked = state.logo.visible;
  logoSize.value = state.logo.w;
  document.querySelectorAll("#logoVariant button").forEach((button) => {
    button.classList.toggle("active", button.dataset.logo === state.logo.variant);
  });

  const text = selectedText();
  const disabled = !text;
  [textContent, fontSize, textWidth, boxColor, textColor].forEach((input) => {
    input.disabled = disabled;
  });
  document.querySelector("#deleteTextBtn").disabled = disabled;

  if (text) {
    textContent.value = text.text;
    fontSize.value = text.fontSize;
    textWidth.value = text.w;
    boxColor.value = text.bg;
    textColor.value = text.color;
    document.querySelectorAll("#textAlign button").forEach((button) => {
      button.classList.toggle("active", button.dataset.align === text.align);
    });
  } else {
    textContent.value = "";
  }

  renderSwatches("#boxSwatches", boxColor, "bg");
  renderSwatches("#textSwatches", textColor, "color");
}

function resizeCanvasPreview() {
  const styles = window.getComputedStyle(canvasFrame);
  const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const availableWidth = Math.max(160, canvasFrame.clientWidth - paddingX);
  const availableHeight = Math.max(160, canvasFrame.clientHeight - paddingY);
  const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height, 1);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}

function updateSelectedSlot(changes) {
  const slot = selectedSlot();
  if (!slot) return;
  Object.assign(slot, changes);
  updateControls();
  draw();
}

function updateSelectedText(changes) {
  const text = selectedText();
  if (!text) return;
  Object.assign(text, changes);
  updateControls();
  draw();
}

function absoluteRect(slot) {
  return {
    x: Math.round(slot.rect.x * state.format.width),
    y: Math.round(slot.rect.y * state.format.height),
    w: Math.round(slot.rect.w * state.format.width),
    h: Math.round(slot.rect.h * state.format.height)
  };
}

function draw(includeSelection = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.template === "inset" ? "#f4f6f9" : "#edf1f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  state.slots.forEach(drawSlot);
  state.texts.forEach(drawTextItem);
  drawLogo();
  if (includeSelection) {
    drawSnapGuides();
    drawSelection();
  }
}

function drawSlot(slot) {
  const rect = absoluteRect(slot);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (slot.image) {
    const image = slot.image;
    const baseScale = slot.fit === "contain"
      ? Math.min(rect.w / image.naturalWidth, rect.h / image.naturalHeight)
      : Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
    const scale = baseScale * slot.zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const x = rect.x + (rect.w - drawW) / 2 + slot.offsetX;
    const y = rect.y + (rect.h - drawH) / 2 + slot.offsetY;

    ctx.filter = `brightness(${slot.brightness})`;
    ctx.drawImage(image, x, y, drawW, drawH);
    ctx.filter = "none";

    if (slot.vignette > 0) {
      const gradient = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.25, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${slot.vignette})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  } else {
    ctx.fillStyle = "#e7edf3";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#c9d3df";
    ctx.lineWidth = Math.max(2, state.format.width * 0.002);
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    drawPlaceholder(rect);
  }

  ctx.restore();
}

function drawPlaceholder(rect) {
  const size = Math.min(rect.w, rect.h);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(42, size * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#00584f";
  ctx.font = `900 ${Math.max(28, size * 0.055)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", rect.x + rect.w / 2, rect.y + rect.h / 2 - size * 0.012);
  ctx.font = `900 ${Math.max(13, size * 0.018)}px Arial, sans-serif`;
  ctx.fillText("VELG BILDE", rect.x + rect.w / 2, rect.y + rect.h / 2 + size * 0.052);
  ctx.restore();
}

function splitLongWord(context, word, maxWidth) {
  const parts = [];
  let part = "";
  for (const char of word) {
    const test = part + char;
    if (context.measureText(test).width <= maxWidth || part === "") {
      part = test;
    } else {
      parts.push(part);
      part = char;
    }
  }
  if (part) parts.push(part);
  return parts;
}

function wrapText(context, text, maxWidth) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if (context.measureText(word).width > maxWidth) {
      splitLongWord(context, word, maxWidth).forEach((part) => {
        const test = line ? `${line} ${part}` : part;
        if (context.measureText(test).width <= maxWidth || line === "") {
          line = test;
        } else {
          lines.push(line);
          line = part;
        }
      });
      return;
    }
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width <= maxWidth || line === "") {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function textFont(item) {
  return `900 ${item.fontSize}px "Arial Black", Impact, Arial, sans-serif`;
}

function measureTextItem(item) {
  ctx.save();
  ctx.font = textFont(item);
  const lines = wrapText(ctx, item.text, item.w - item.padding * 2);
  const lineHeight = item.fontSize * 1.06;
  const height = Math.ceil(lines.length * lineHeight + item.padding * 2);
  ctx.restore();
  return { lines, lineHeight, height };
}

function drawTextItem(item) {
  const measured = measureTextItem(item);
  item.h = measured.height;
  const radius = Math.min(18, Math.max(8, item.fontSize * 0.18));

  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, radius);
  ctx.fillStyle = item.bg;
  ctx.fill();
  ctx.fillStyle = item.color;
  ctx.font = textFont(item);
  ctx.textAlign = item.align;
  ctx.textBaseline = "top";
  const x = {
    left: item.x + item.padding,
    center: item.x + item.w / 2,
    right: item.x + item.w - item.padding
  }[item.align];
  measured.lines.forEach((line, index) => {
    ctx.fillText(line, x, item.y + item.padding + index * measured.lineHeight);
  });
  ctx.restore();
}

function roundRect(context, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawLogo() {
  if (!state.logo.visible) return;
  const image = logoImages[state.logo.variant];
  if (!image || !image.complete) return;
  const aspect = image.naturalHeight ? image.naturalHeight / image.naturalWidth : 0.42;
  ctx.drawImage(image, state.logo.x, state.logo.y, state.logo.w, state.logo.w * aspect);
}

function drawSnapGuides() {
  if (state.snapGuides.length === 0) return;
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = "#0064dc";
  ctx.lineWidth = Math.max(2, state.format.width * 0.0022);
  state.snapGuides.forEach((guide) => {
    ctx.beginPath();
    if (guide.axis === "x") {
      ctx.moveTo(guide.at, 0);
      ctx.lineTo(guide.at, state.format.height);
    } else {
      ctx.moveTo(0, guide.at);
      ctx.lineTo(state.format.width, guide.at);
    }
    ctx.stroke();
  });
  ctx.restore();
}

function drawSelection() {
  const text = selectedText();
  if (text) {
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(2, state.format.width * 0.003);
    ctx.strokeRect(text.x - 8, text.y - 8, text.w + 16, text.h + 16);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = Math.max(1, state.format.width * 0.0018);
    ctx.strokeRect(text.x - 8, text.y - 8, text.w + 16, text.h + 16);
    ctx.restore();
    return;
  }

  const slot = selectedSlot();
  if (slot) {
    const rect = absoluteRect(slot);
    ctx.save();
    ctx.strokeStyle = "#00584f";
    ctx.lineWidth = Math.max(3, state.format.width * 0.004);
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.restore();
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function hitText(point) {
  for (let i = state.texts.length - 1; i >= 0; i -= 1) {
    const item = state.texts[i];
    if (point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h) return item;
  }
  return null;
}

function hitLogo(point) {
  if (!state.logo.visible) return false;
  const image = logoImages[state.logo.variant];
  const aspect = image?.naturalHeight ? image.naturalHeight / image.naturalWidth : 0.42;
  const h = state.logo.w * aspect;
  return point.x >= state.logo.x && point.x <= state.logo.x + state.logo.w && point.y >= state.logo.y && point.y <= state.logo.y + h;
}

function hitSlot(point) {
  return state.slots.find((slot) => {
    const rect = absoluteRect(slot);
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }) || null;
}

function textSnapTargets(text) {
  const margin = Math.round(Math.min(state.format.width, state.format.height) * 0.055);
  const xTargets = [
    { edge: "left", target: margin, x: margin, guide: margin },
    { edge: "center", target: state.format.width / 2, x: state.format.width / 2 - text.w / 2, guide: state.format.width / 2 },
    { edge: "right", target: state.format.width - margin, x: state.format.width - margin - text.w, guide: state.format.width - margin }
  ];
  const yTargets = [
    { edge: "top", target: margin, y: margin, guide: margin },
    { edge: "middle", target: state.format.height / 2, y: state.format.height / 2 - text.h / 2, guide: state.format.height / 2 },
    { edge: "bottom", target: state.format.height - margin, y: state.format.height - margin - text.h, guide: state.format.height - margin }
  ];

  state.texts.forEach((other) => {
    if (other.id === text.id) return;
    const otherCenterX = other.x + other.w / 2;
    const otherMiddleY = other.y + other.h / 2;
    xTargets.push(
      { edge: "left", target: other.x, x: other.x, guide: other.x },
      { edge: "center", target: otherCenterX, x: otherCenterX - text.w / 2, guide: otherCenterX },
      { edge: "right", target: other.x + other.w, x: other.x + other.w - text.w, guide: other.x + other.w }
    );
    yTargets.push(
      { edge: "top", target: other.y, y: other.y, guide: other.y },
      { edge: "middle", target: otherMiddleY, y: otherMiddleY - text.h / 2, guide: otherMiddleY },
      { edge: "bottom", target: other.y + other.h, y: other.y + other.h - text.h, guide: other.y + other.h },
      { edge: "top", target: other.y + other.h + SNAP_GAP, y: other.y + other.h + SNAP_GAP, guide: other.y + other.h + SNAP_GAP },
      { edge: "bottom", target: other.y - SNAP_GAP, y: other.y - SNAP_GAP - text.h, guide: other.y - SNAP_GAP }
    );
  });

  return { xTargets, yTargets };
}

function closestSnap(candidates, valueForCandidate) {
  let best = null;
  candidates.forEach((candidate) => {
    const distance = Math.abs(valueForCandidate(candidate) - candidate.target);
    if (distance <= SNAP_THRESHOLD && (!best || distance < best.distance)) {
      best = { candidate, distance };
    }
  });
  return best?.candidate || null;
}

function snapTextPosition(text, x, y) {
  text.h = measureTextItem(text).height;
  const { xTargets, yTargets } = textSnapTargets(text);
  const xEdges = {
    left: x,
    center: x + text.w / 2,
    right: x + text.w
  };
  const yEdges = {
    top: y,
    middle: y + text.h / 2,
    bottom: y + text.h
  };

  const snappedX = closestSnap(xTargets, (candidate) => xEdges[candidate.edge]);
  const snappedY = closestSnap(yTargets, (candidate) => yEdges[candidate.edge]);
  const guides = [];

  if (snappedX) {
    x = snappedX.x;
    guides.push({ axis: "x", at: snappedX.guide });
  }
  if (snappedY) {
    y = snappedY.y;
    guides.push({ axis: "y", at: snappedY.guide });
  }

  return { x: Math.round(x), y: Math.round(y), guides };
}

function pointerDown(event) {
  const point = canvasPoint(event);
  state.snapGuides = [];
  const text = hitText(point);
  if (text) {
    state.selectedTextId = text.id;
    state.selectedSlotId = null;
    drag = { type: "text", id: text.id, start: point, x: text.x, y: text.y };
    updateControls();
    draw();
    return;
  }

  if (hitLogo(point)) {
    state.selectedTextId = null;
    drag = { type: "logo", start: point, x: state.logo.x, y: state.logo.y };
    updateControls();
    draw();
    return;
  }

  const slot = hitSlot(point);
  if (!slot) return;
  state.selectedSlotId = slot.id;
  state.selectedTextId = null;
  if (slot.image) {
    drag = { type: "slot", id: slot.id, start: point, x: slot.offsetX, y: slot.offsetY };
  } else {
    openFilePicker();
  }
  updateControls();
  draw();
}

function pointerMove(event) {
  if (!drag) return;
  const point = canvasPoint(event);
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;

  if (drag.type === "text") {
    const text = state.texts.find((item) => item.id === drag.id);
    if (text) {
      const rawX = clamp(drag.x + dx, -text.w * 0.8, state.format.width - text.w * 0.2);
      const rawY = clamp(drag.y + dy, -text.h * 0.4, state.format.height - text.h * 0.2);
      const snapped = snapTextPosition(text, rawX, rawY);
      text.x = snapped.x;
      text.y = snapped.y;
      state.snapGuides = snapped.guides;
    }
  }

  if (drag.type === "slot") {
    state.snapGuides = [];
    const slot = state.slots.find((item) => item.id === drag.id);
    if (slot) {
      slot.offsetX = Math.round(drag.x + dx);
      slot.offsetY = Math.round(drag.y + dy);
    }
  }

  if (drag.type === "logo") {
    state.snapGuides = [];
    state.logo.x = Math.round(clamp(drag.x + dx, -state.logo.w * 0.45, state.format.width - state.logo.w * 0.2));
    state.logo.y = Math.round(clamp(drag.y + dy, -state.logo.w * 0.25, state.format.height - state.logo.w * 0.1));
  }

  draw();
}

function openFilePicker() {
  fileInput.value = "";
  fileInput.click();
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const slot = selectedSlot();
      if (!slot) return;
      slot.image = image;
      slot.imageName = file.name;
      slot.offsetX = 0;
      slot.offsetY = 0;
      slot.zoom = 1;
      updateControls();
      draw();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function setLogoPosition(pos) {
  const margin = Math.round(Math.min(state.format.width, state.format.height) * 0.055);
  const image = logoImages[state.logo.variant];
  const aspect = image?.naturalHeight ? image.naturalHeight / image.naturalWidth : 0.42;
  const h = state.logo.w * aspect;
  const positions = {
    tl: [margin, margin],
    tr: [state.format.width - state.logo.w - margin, margin],
    bl: [margin, state.format.height - h - margin],
    br: [state.format.width - state.logo.w - margin, state.format.height - h - margin]
  };
  const [x, y] = positions[pos] || positions.tl;
  state.logo.x = Math.round(x);
  state.logo.y = Math.round(y);
  draw();
}

function exportCanvas(download = true) {
  draw(false);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      draw(true);
      if (!blob) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `sa-somemaskin-${state.format.width}x${state.format.height}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      resolve(url);
    }, "image/png", 0.96);
  });
}

function resetPost() {
  state.format = { ...FORMATS[0] };
  state.template = "headline";
  state.texts = [];
  state.logo = { visible: true, variant: "color", x: 58, y: 58, w: 190 };
  canvas.width = state.format.width;
  canvas.height = state.format.height;
  applyTemplate("headline", true);
}

formatGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-format]");
  if (!button) return;
  const format = FORMATS.find((item) => item.id === button.dataset.format);
  if (format) setFormat(format);
});

templateGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-template]");
  if (button) applyTemplate(button.dataset.template, true);
});

document.querySelector("#applyCustomSize").addEventListener("click", () => {
  const width = clamp(Number(document.querySelector("#customWidth").value) || 1080, 320, 4096);
  const height = clamp(Number(document.querySelector("#customHeight").value) || 1080, 320, 4096);
  setFormat({ id: "custom", name: "Egendefinert", detail: "Custom", width, height });
});

document.querySelector("#imageBtn").addEventListener("click", openFilePicker);
document.querySelector("#nextSlotBtn").addEventListener("click", () => {
  const index = state.slots.findIndex((slot) => slot.id === state.selectedSlotId);
  const next = state.slots[(index + 1) % state.slots.length];
  if (next) {
    state.selectedSlotId = next.id;
    state.selectedTextId = null;
    updateControls();
    draw();
  }
});
fileInput.addEventListener("change", (event) => handleFile(event.target.files?.[0]));

const dropCard = document.querySelector("#dropCard");
dropCard.addEventListener("click", openFilePicker);
["dragenter", "dragover"].forEach((name) => {
  dropCard.addEventListener(name, (event) => {
    event.preventDefault();
    dropCard.classList.add("dragging");
  });
});
["dragleave", "drop"].forEach((name) => {
  dropCard.addEventListener(name, (event) => {
    event.preventDefault();
    dropCard.classList.remove("dragging");
  });
});
dropCard.addEventListener("drop", (event) => handleFile(event.dataTransfer.files?.[0]));

imageZoom.addEventListener("input", () => updateSelectedSlot({ zoom: Number(imageZoom.value) }));
imageBrightness.addEventListener("input", () => updateSelectedSlot({ brightness: Number(imageBrightness.value) }));
imageVignette.addEventListener("input", () => updateSelectedSlot({ vignette: Number(imageVignette.value) }));
document.querySelector("#zoomOutBtn").addEventListener("click", () => {
  const slot = selectedSlot();
  if (slot) updateSelectedSlot({ zoom: clamp(slot.zoom - 0.08, 1, 3) });
});
document.querySelector("#zoomInBtn").addEventListener("click", () => {
  const slot = selectedSlot();
  if (slot) updateSelectedSlot({ zoom: clamp(slot.zoom + 0.08, 1, 3) });
});
document.querySelector("#fitCoverBtn").addEventListener("click", () => updateSelectedSlot({ fit: "cover", zoom: 1, offsetX: 0, offsetY: 0 }));
document.querySelector("#fitContainBtn").addEventListener("click", () => updateSelectedSlot({ fit: "contain", zoom: 1, offsetX: 0, offsetY: 0 }));

document.querySelector("#logoVariant").addEventListener("click", (event) => {
  const button = event.target.closest("[data-logo]");
  if (!button) return;
  state.logo.variant = button.dataset.logo;
  updateControls();
  draw();
});
document.querySelector("#logoPosition").addEventListener("click", (event) => {
  const button = event.target.closest("[data-pos]");
  if (button) setLogoPosition(button.dataset.pos);
});
logoVisible.addEventListener("change", () => {
  state.logo.visible = logoVisible.checked;
  draw();
});
logoSize.addEventListener("input", () => {
  state.logo.w = Number(logoSize.value);
  draw();
});

document.querySelector("#addTextBtn").addEventListener("click", () => {
  addText();
  updateControls();
  draw();
});
textList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-text]");
  if (!button) return;
  state.selectedTextId = button.dataset.text;
  state.selectedSlotId = null;
  updateControls();
  draw();
});
textContent.addEventListener("input", () => updateSelectedText({ text: textContent.value }));
fontSize.addEventListener("input", () => updateSelectedText({ fontSize: Number(fontSize.value) }));
textWidth.addEventListener("input", () => updateSelectedText({ w: Number(textWidth.value) }));
boxColor.addEventListener("input", () => updateSelectedText({ bg: boxColor.value }));
textColor.addEventListener("input", () => updateSelectedText({ color: textColor.value }));
document.querySelector("#textAlign").addEventListener("click", (event) => {
  const button = event.target.closest("[data-align]");
  if (button) updateSelectedText({ align: button.dataset.align });
});
document.querySelector("#deleteTextBtn").addEventListener("click", () => {
  if (!state.selectedTextId) return;
  state.texts = state.texts.filter((item) => item.id !== state.selectedTextId);
  state.selectedTextId = state.texts[0]?.id || null;
  updateControls();
  draw();
});

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
window.addEventListener("pointerup", () => {
  if (drag?.type === "text") {
    state.snapGuides = [];
    draw();
  }
  drag = null;
});
window.addEventListener("resize", resizeCanvasPreview);

if ("ResizeObserver" in window) {
  new ResizeObserver(resizeCanvasPreview).observe(canvasFrame);
}

exportBtn.addEventListener("click", () => exportCanvas(true));
document.querySelector("#previewBtn").addEventListener("click", async () => {
  const url = await exportCanvas(false);
  if (url) window.open(url, "_blank");
});
document.querySelector("#resetBtn").addEventListener("click", resetPost);

window.addEventListener("keydown", (event) => {
  if (event.key === "Delete" && state.selectedTextId) {
    document.querySelector("#deleteTextBtn").click();
  }
});

loadLogos();
applyTemplate("headline", true);
