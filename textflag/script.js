const urlInput = document.getElementById("ttmlUrl");
const loadBtn = document.getElementById("loadBtn");
const status = document.getElementById("status");
const container = document.getElementById("captionContainer");
const ttmlFileInput = document.getElementById("ttmlFile");

const isWebKit = navigator.userAgent.includes("AppleWebKit");

if (!isWebKit) {
  ttmlFileInput.accept = ".ttml,.xml";
}

const annotationTemplates = {
  "sync-too-early": {
    label: "Sync too early",
    prefill:
      "The sync for this section is too early for the audio provided, please resync.",
  },
  "sync-too-late": {
    label: "Sync too late",
    prefill:
      "The sync for this section is delayed in the audio provided, please resync.",
  },
  "generic-resync": {
    label: "Generic re-sync needed",
    prefill: "This section needs to be re-synced.",
  },
  "missing-words": {
    label: "Missing word(s) in this line",
    prefill: "This line is missing [___].",
  },
  "misheard-words": {
    label: "Misheard word(s) in this line",
    prefill: "This line is incorrectly transcribed. [___] should be [___].",
  },
  "split-suggest": {
    label: "Suggest syllable split",
    prefill: 'The word "example" should be split into "ex-am-ple".',
  },
  oversplit: {
    label: "Oversplitting",
    prefill:
      "This word does not need to be split up so much. It would be better if it was synced as a whole word.",
  },
  "inaccurate-transcription": {
    label: "Inaccurate transcription",
    prefill: "This line is inaccurately transcribed.",
  },
  other: {
    label: "Other",
    prefill: "",
  },
};

function populateAnnotationOptions() {
  const select = document.getElementById("annotationReason");
  select.innerHTML = "";
  Object.keys(annotationTemplates).forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = annotationTemplates[key].label;
    select.appendChild(option);
  });
}

function isXBgSpan(span) {
  if (!(span instanceof Element)) return false;
  if (span.hasAttribute("x-bg")) return true;
  if (span.getAttribute("ttm:role") === "x-bg") return true;
  if (span.getAttribute("role") === "x-bg") return true;
  const cls = span.getAttribute("class");
  if (cls && cls.split(/\s+/).includes("x-bg")) return true;
  return false;
}

function parseTTML(xmlDoc) {
  const songwriters = Array.from(xmlDoc.querySelectorAll("songwriter"))
    .map((s) => s.textContent.trim())
    .filter(Boolean);
  const hasSongwriters = songwriters.length > 0;
  const ttTag = xmlDoc.querySelector("tt");
  const timing = ttTag
    ? ttTag.getAttribute("itunes:timing") ||
      ttTag.getAttribute("itunes\\:timing") ||
      ttTag.getAttribute("timing") ||
      ""
    : "";

  const paragraphs = Array.from(xmlDoc.querySelectorAll("p"));
  if (!paragraphs.length) {
    throw new Error("No <p> elements found in TTML");
  }

  const cues = [];

  for (const p of paragraphs) {
    const agent =
      p.getAttribute("ttm:agent") || p.getAttribute("ttm\\:agent") || null;
    const begin = p.getAttribute("begin") || "";
    const timestamp = begin.split(".")[0];

    let mainText = "";
    let adlibText = "";
    let lastWasSpan = false;
    let adlibLastWasSpan = false;

    for (const node of p.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        mainText += node.textContent;
        lastWasSpan = false;
        adlibLastWasSpan = false;
        continue;
      }

      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.tagName.toLowerCase() === "span"
      ) {
        const spanText = node.textContent || "";
        if (!spanText.trim()) {
          adlibLastWasSpan = false;
          continue;
        }

        if (isXBgSpan(node)) {
          const raw = spanText;
          const cleaned = raw.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
          if (cleaned) {
            if (adlibLastWasSpan) {
              adlibText += "•" + cleaned;
            } else {
              adlibText += (adlibText ? " " : "") + cleaned;
            }
            adlibLastWasSpan = true;
          }
          continue;
        }

        if (lastWasSpan) {
          mainText += "•" + spanText;
        } else {
          mainText += spanText;
        }
        lastWasSpan = true;
        adlibLastWasSpan = false;
        continue;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        mainText += node.textContent || "";
        lastWasSpan = false;
        adlibLastWasSpan = false;
      }
    }

    mainText = mainText.replace(/\s+/g, " ").trim();
    adlibText = adlibText.replace(/\s+/g, " ").trim();

    if (mainText) {
      cues.push({
        text: mainText,
        timestamp,
        isRight: agent === "v2",
        isAdlib: false,
      });
    }

    if (adlibText) {
      cues.push({
        text: adlibText,
        timestamp,
        isRight: agent === "v2",
        isAdlib: true,
      });
    }
  }

  return { cues, songwriters, hasSongwriters, timing };
}

async function loadTTMLFromContent(xmlText) {
  status.textContent = "Loading TTML...";
  status.classList.remove("error");
  loadBtn.disabled = true;

  try {
    const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
    const parsererror = xmlDoc.querySelector("parsererror");
    if (parsererror)
      throw new Error("Invalid XML/TTML: " + parsererror.textContent);

    const { cues, songwriters, hasSongwriters, timing } = parseTTML(xmlDoc);

    const songwriterEl = document.getElementById("songwriters");
    if (hasSongwriters) {
      songwriterEl.textContent = `${timing ? `${timing} sync | ` : ""}Written by: ${songwriters.join(", ")}`;
      songwriterEl.classList.remove("error");
    } else {
      songwriterEl.textContent = `${timing ? `${timing} sync | ` : ""}No songwriters found in TTML.`;
      songwriterEl.classList.add("error");
    }

    container.innerHTML = "";

    cues.forEach((cue, index) => {
      const cueEl = document.createElement("article");
      cueEl.className =
        `cue ${cue.isRight ? "line-right" : ""} ${cue.isAdlib ? "adlib" : ""}`.trim();

      if (!cue.isAdlib) {
        const timestampEl = document.createElement("div");
        timestampEl.className = "timestamp";
        timestampEl.textContent = cue.timestamp;
        cueEl.appendChild(timestampEl);
      }

      const main = document.createElement("div");
      main.className = "line-main";
      main.dataset.lineId = `line-${index}`;
      main.innerHTML = cue.text.replace(/•/g, '<span class="split">|</span>');
      cueEl.appendChild(main);

      container.appendChild(cueEl);
    });

    status.textContent = ``;
    windowLoaded = true;
    updateExportState();
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
    status.classList.add("error");
    container.innerHTML = "";
    windowLoaded = false;
    updateExportState();
  } finally {
    loadBtn.disabled = false;
  }
}

async function loadTTML(url) {
  status.textContent = "Loading TTML...";
  status.classList.remove("error");
  loadBtn.disabled = true;

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`HTTP ${response.status} ${response.statusText}`);

    const xmlText = await response.text();
    await loadTTMLFromContent(xmlText);
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
    status.classList.add("error");
    container.innerHTML = "";
    windowLoaded = false;
    updateExportState();
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (!url) {
    ttmlFileInput.click();
    return;
  }
  loadTTML(url);
});

ttmlFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];

  if (isWebKit) {
    if (event.target.files.length > 0) {
      if (!file.name.endsWith(".ttml")) {
        alert("Filetype invalid, please reselect");
        return;
      }
    }
  }

  if (!file) return;

  status.textContent = "Loading TTML from file...";
  status.classList.remove("error");

  try {
    const xmlText = await file.text();
    await loadTTMLFromContent(xmlText);
  } catch (error) {
    status.textContent = `Error loading file: ${error.message}`;
    status.classList.add("error");
  } finally {
    ttmlFileInput.value = "";
  }
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadBtn.click();
});

const annotationTooltip = document.getElementById("annotationTooltip");
const annotationModal = document.getElementById("annotationModal");
const annotationViewer = document.getElementById("annotationViewer");
const annotationReason = document.getElementById("annotationReason");
const annotationText = document.getElementById("annotationText");
const annotationSaveBtn = document.getElementById("annotationSaveBtn");
const annotationCancelBtn = document.getElementById("annotationCancelBtn");
const annotationDetails = document.getElementById("annotationDetails");
const annotationEditBtn = document.getElementById("annotationEditBtn");
const annotationDeleteBtn = document.getElementById("annotationDeleteBtn");
const annotationViewerCloseBtn = document.getElementById(
  "annotationViewerCloseBtn",
);

const exportBtn = document.getElementById("exportBtn");
const exportSection = document.getElementById("exportSection");
const exportOutput = document.getElementById("exportOutput");

let annotations = [];
let currentSelectionInfo = null;
let activeAnnotationId = null;
let editAnnotationId = null;

function getPrefillText(reason) {
  return annotationTemplates[reason]?.prefill || "";
}

function shouldOverrideText(reason) {
  return [
    "sync-too-early",
    "sync-too-late",
    "generic-resync",
    "adlib-mainline",
    "missing-words",
    "misheard-words",
    "inaccurate-transcription",
    "other",
  ].includes(reason);
}

function hideAllModals() {
  annotationModal.classList.add("hidden");
  annotationViewer.classList.add("hidden");
  activeAnnotationId = null;
  editAnnotationId = null;
}

function clearTooltip() {
  annotationTooltip.classList.add("hidden");
}

function clearSelection() {
  if (window.getSelection) {
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }
  currentSelectionInfo = null;
  clearTooltip();
}

function insertSelectedTextSelectionByLine() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;

  const text = sel.toString().trim();
  if (!text) return null;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const lineElements = new Set();

  const startContainer = sel.anchorNode;
  const endContainer = sel.focusNode;

  function findLine(el) {
    while (el && el !== container && !el.classList?.contains("line-main")) {
      el = el.parentNode;
    }
    return el && el.classList && el.classList.contains("line-main") ? el : null;
  }

  const lineStart = findLine(startContainer);
  const lineEnd = findLine(endContainer);

  if (lineStart) lineElements.add(lineStart);
  if (lineEnd) lineElements.add(lineEnd);

  const linesInRange = Array.from(
    container.querySelectorAll(".line-main"),
  ).filter((line) => {
    const lineRect = line.getBoundingClientRect();
    return lineRect.top <= rect.bottom && lineRect.bottom >= rect.top;
  });

  linesInRange.forEach((l) => lineElements.add(l));

  if (!lineElements.size) return null;

  return {
    text,
    rect,
    lines: Array.from(lineElements),
    range: range.cloneRange(),
  };
}

function showTooltipAt(x, y) {
  annotationTooltip.style.left = `${x}px`;
  annotationTooltip.style.top = `${y}px`;
  annotationTooltip.classList.remove("hidden");
}

function openAnnotationModal() {
  if (!currentSelectionInfo) return;

  editAnnotationId = null;
  annotationReason.value = "sync-too-early";
  annotationText.value = getPrefillText(annotationReason.value);
  annotationModal.classList.remove("hidden");
  annotationViewer.classList.add("hidden");
}

function renderAnnotationsForLine(line) {
  const lineId = line.dataset.lineId;
  return annotations.filter((a) => a.lineIds.includes(lineId));
}

function updateLineHighlightState() {
  document.querySelectorAll(".line-main").forEach((line) => {
    const lineId = line.dataset.lineId;
    const hasFallback = annotations.some(
      (a) =>
        a.lineIds.includes(lineId) &&
        (!a.highlightElements || a.highlightElements.length === 0),
    );
    if (hasFallback) {
      line.classList.add("line-highlight");
    } else {
      line.classList.remove("line-highlight");
    }
  });
}

function getAnnotationTimestamp(annotation) {
  if (!annotation || !annotation.elements || !annotation.elements.length) {
    return "0:00";
  }
  const firstLineEl = annotation.elements[0];
  const cueEl = firstLineEl.closest(".cue");
  if (!cueEl) return "0:00";
  const tsEl = cueEl.querySelector(".timestamp");
  return tsEl ? tsEl.textContent.trim() : "0:00";
}

function applyHighlightEscaping(fullLine, rawText) {
  if (!rawText) return fullLine;
  const raw = rawText.trim();
  const idx = fullLine.indexOf(raw);
  if (idx < 0) return rawText;
  if (fullLine === raw) return rawText;
  const before = fullLine.slice(0, idx);
  const middle = fullLine.slice(idx, idx + raw.length);
  const after = fullLine.slice(idx + raw.length);
  return `${before}__${middle}__${after}`;
}

function formatAnnotationMarkdown(annotation) {
  const ts = getAnnotationTimestamp(annotation);
  let body;

  if (annotation.elements.length === 1) {
    const lineText = annotation.elements[0].textContent
      .trim()
      .replaceAll("|", "");
    const raw = annotation.rawText?.trim().replaceAll("|", "") || "";
    if (raw && lineText !== raw && lineText.includes(raw)) {
      body = applyHighlightEscaping(lineText, raw);
    } else {
      body = raw || lineText;
    }
  } else {
    body = annotation.rawText?.trim().replaceAll("\n", "\n> ") || "";
  }

  return `> -# [${ts}]\n> ${body}\n**${annotation.reason}**: ${annotation.text}`;
}

function updateExportState() {
  const hasAnnotations = annotations.length > 0;
  exportBtn.classList.toggle("hidden", !windowLoaded);
  exportBtn.disabled = !hasAnnotations;
  exportSection.classList.toggle("hidden", !hasAnnotations);
  if (hasAnnotations) {
    const markdown = annotations.map(formatAnnotationMarkdown).join("\n\n");
    exportOutput.value = markdown;
  } else {
    exportOutput.value = "";
  }
}

let windowLoaded = false;

function getLineBoundary(line, atEnd) {
  let node = atEnd ? line.lastChild : line.firstChild;
  if (!node) return { node: line, offset: atEnd ? line.childNodes.length : 0 };

  while (node && node.nodeType !== Node.TEXT_NODE) {
    if (atEnd) {
      if (node.lastChild) node = node.lastChild;
      else break;
    } else {
      if (node.firstChild) node = node.firstChild;
      else break;
    }
  }

  if (!node) return { node: line, offset: atEnd ? line.childNodes.length : 0 };

  if (node.nodeType === Node.TEXT_NODE) {
    return { node, offset: atEnd ? node.textContent.length : 0 };
  }

  return { node, offset: atEnd ? node.childNodes.length : 0 };
}

function applyAnnotationRangeHighlight(range, lines) {
  if (!range || range.collapsed || !lines?.length) {
    return [];
  }

  const baseRange = range.cloneRange();
  const highlightElements = [];

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lineRange = document.createRange();

    const startBoundary = getLineBoundary(line, false);
    const endBoundary = getLineBoundary(line, true);

    let startNode = startBoundary.node;
    let startOffset = startBoundary.offset;
    let endNode = endBoundary.node;
    let endOffset = endBoundary.offset;

    if (line === firstLine) {
      if (line.contains(baseRange.startContainer)) {
        startNode = baseRange.startContainer;
        startOffset = baseRange.startOffset;
      }
    }

    if (line === lastLine) {
      if (line.contains(baseRange.endContainer)) {
        endNode = baseRange.endContainer;
        endOffset = baseRange.endOffset;
      }
    }

    // If the selection does not actually intersect this line, skip.
    if (!line.contains(startNode) || !line.contains(endNode)) {
      continue;
    }

    lineRange.setStart(startNode, startOffset);
    lineRange.setEnd(endNode, endOffset);

    if (lineRange.collapsed) {
      continue;
    }

    // Guard against the span escaping outside of line
    const ancestor = lineRange.commonAncestorContainer;
    if (!line.contains(ancestor) && ancestor !== line) {
      continue;
    }

    try {
      const span = document.createElement("span");
      span.className = "annotation-range-highlight";
      const frag = lineRange.extractContents();
      span.appendChild(frag);
      lineRange.insertNode(span);
      highlightElements.push(span);
    } catch (error) {
      console.warn("Unable to apply range highlight on line:", line, error);
    }
  }

  return highlightElements;
}

function removeAnnotationHighlights(annotation) {
  if (!annotation || !annotation.highlightElements) return;

  annotation.highlightElements.forEach((node) => {
    if (!node.parentNode) return;
    while (node.firstChild) {
      node.parentNode.insertBefore(node.firstChild, node);
    }
    node.parentNode.removeChild(node);
  });
  annotation.highlightElements = [];
}

function openAnnotationViewer(annotationId) {
  const annotation = annotations.find((a) => a.id === annotationId);
  if (!annotation) return;

  activeAnnotationId = annotationId;

  annotationViewer.classList.remove("hidden");
  annotationModal.classList.add("hidden");
}

function setReasonPrefill() {
  const reason = annotationReason.value;
  if (reason === "other") {
    annotationText.value = "";
  } else {
    annotationText.value = getPrefillText(reason);
  }
}

annotationReason.addEventListener("change", setReasonPrefill);
annotationCancelBtn.addEventListener("click", () => {
  clearSelection();
  hideAllModals();
});
annotationViewerCloseBtn.addEventListener("click", hideAllModals);

annotationSaveBtn.addEventListener("click", () => {
  if (!annotationText.value.trim()) return;

  const reasonKey = annotationReason.value;
  const reasonText =
    annotationReason.options[annotationReason.selectedIndex]?.text || reasonKey;
  const text = annotationText.value.trim();

  if (editAnnotationId) {
    const existing = annotations.find((a) => a.id === editAnnotationId);
    if (!existing) return;
    existing.reason = reasonText;
    existing.text = text;
    editAnnotationId = null;
    updateLineHighlightState();
    hideAllModals();
    return;
  }

  if (!currentSelectionInfo) return;

  const lineIds = currentSelectionInfo.lines.map((l) => l.dataset.lineId);
  const annotation = {
    id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reason: reasonText,
    text,
    rawText: currentSelectionInfo.text,
    lineIds,
    elements: currentSelectionInfo.lines,
    highlightElements: [],
  };

  // apply exact-range transient highlight for user-selected span (per-line)
  const highlightEls = applyAnnotationRangeHighlight(
    currentSelectionInfo.range,
    currentSelectionInfo.lines,
  );
  annotation.highlightElements = highlightEls;

  annotations.push(annotation);

  if (annotation.highlightElements.length === 0) {
    currentSelectionInfo.lines.forEach((line) => {
      line.classList.add("line-highlight");
    });
  }

  currentSelectionInfo = null;
  clearSelection();
  updateExportState();
  hideAllModals();
});

annotationEditBtn.addEventListener("click", () => {
  if (!activeAnnotationId) return;
  const existing = annotations.find((a) => a.id === activeAnnotationId);
  if (!existing) return;

  editAnnotationId = existing.id;
  const key =
    Object.keys(annotationTemplates).find(
      (k) => annotationTemplates[k].label === existing.reason,
    ) || "other";
  annotationReason.value = key;
  annotationText.value = existing.text;

  annotationModal.classList.remove("hidden");
  annotationViewer.classList.add("hidden");
});

annotationDeleteBtn.addEventListener("click", () => {
  if (!activeAnnotationId) return;
  const target = annotations.find((a) => a.id === activeAnnotationId);
  if (target) {
    removeAnnotationHighlights(target);
  }
  annotations = annotations.filter((a) => a.id !== activeAnnotationId);
  updateLineHighlightState();
  updateExportState();
  hideAllModals();
});

container.addEventListener("mouseup", (event) => {
  const selInfo = insertSelectedTextSelectionByLine();
  if (!selInfo) {
    clearTooltip();
    return;
  }

  currentSelectionInfo = selInfo;
  const x = selInfo.rect.left + window.scrollX;
  const y = selInfo.rect.top + window.scrollY - 35;
  showTooltipAt(x, y);
});

annotationTooltip.addEventListener("click", () => {
  openAnnotationModal();
});

exportBtn.addEventListener("click", async () => {
  if (!exportOutput.value) return;
  try {
    await navigator.clipboard.writeText(exportOutput.value);
    exportBtn.textContent = "Copied!";
    setTimeout(() => {
      exportBtn.textContent = "Export annotations";
    }, 1500);
  } catch (error) {
    console.error("Clipboard copy failed", error);
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("src")) {
  urlInput.value = params.get("src");
  loadTTML(urlInput.value);
}

container.addEventListener("click", (event) => {
  const line = event.target.closest(".line-main");
  if (!line) return;

  const lineId = line.dataset.lineId;
  const related = annotations.filter((a) => a.lineIds.includes(lineId));
  if (!related.length) return;

  const html = related
    .map(
      (a) =>
        `<div><blockquote>${a.rawText.replaceAll("\n", "<br/>")}</blockquote></div><div class="annotation-choice" data-id="${a.id}"><strong>${a.reason}</strong><br>${a.text}</div>`,
    )
    .join("<hr>");
  annotationDetails.innerHTML = html;
  activeAnnotationId = related[0].id;
  annotationViewer.classList.remove("hidden");
  annotationModal.classList.add("hidden");

  document
    .querySelectorAll("#annotationDetails .annotation-choice")
    .forEach((el) => {
      el.addEventListener("click", () => {
        activeAnnotationId = el.dataset.id;
        openAnnotationViewer(activeAnnotationId);
      });
    });
});

populateAnnotationOptions();
