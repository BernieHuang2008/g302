const LIBRARIES = {
  pdf: {
    script: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  },
  docx: {
    jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    script: "https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js",
  },
  pptx: {
    css: [
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/css/pptxjs.css",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/css/nv.d3.min.css",
    ],
    scripts: [
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/jquery-1.11.3.min.js",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/jszip.min.js",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/filereader.js",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/d3.min.js",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/nv.d3.min.js",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/dingbat.js",
      "https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@master/js/pptxjs.min.js",
    ],
  },
};

const state = {
  record: null,
  pdf: null,
  pdfZoom: 1,
  pdfPage: 1,
};

const previewFormat = document.querySelector("#previewFormat");
const previewTitle = document.querySelector("#previewTitle");
const previewMeta = document.querySelector("#previewMeta");
const previewToolbar = document.querySelector("#previewToolbar");
const previewLoading = document.querySelector("#previewLoading");
const previewError = document.querySelector("#previewError");
const previewContent = document.querySelector("#previewContent");
const downloadLink = document.querySelector("#downloadLink");
const loadedScripts = new Map();

function getFileId() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(pathParts[pathParts.length - 1] || "");
}

function getExtension(fileName) {
  return fileName?.split(".").pop()?.toLowerCase() || "";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(uploadedAt) {
  return new Date(uploadedAt).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function contentUrl(fileId) {
  return `/filecenter/api/content/${encodeURIComponent(fileId)}`;
}

function downloadUrl(fileId) {
  return `/filecenter/api/download/${encodeURIComponent(fileId)}`;
}

function loadScript(src) {
  if (loadedScripts.has(src)) return loadedScripts.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`外部预览组件加载失败：${src}`));
    document.head.append(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

function showContent(className) {
  previewLoading.hidden = true;
  previewError.hidden = true;
  previewContent.hidden = false;
  previewContent.className = `preview-content ${className}`;
  previewContent.innerHTML = "";
}

function showError(title, detail = "") {
  previewLoading.hidden = true;
  previewContent.hidden = true;
  previewError.hidden = false;
  previewError.innerHTML = "";

  const heading = document.createElement("strong");
  heading.textContent = title;
  previewError.append(heading);

  if (detail) {
    const paragraph = document.createElement("p");
    paragraph.textContent = detail;
    previewError.append(paragraph);
  }

  if (state.record) {
    const link = document.createElement("a");
    link.className = "button button-secondary";
    link.href = downloadUrl(state.record.id);
    link.textContent = "下载原文件";
    previewError.append(link);
  }
}

function renderMeta(record) {
  previewFormat.textContent = `${getExtension(record.originalName).toUpperCase() || "FILE"} 预览`;
  previewTitle.textContent = record.displayName || record.originalName;
  document.title = `${record.displayName || record.originalName} - G302`;

  previewMeta.hidden = false;
  previewMeta.innerHTML = "";
  const details = [
    `原始文件名：${record.originalName}`,
    `上传于：${formatDateTime(record.uploadedAt)}`,
    `大小：${formatSize(record.size || 0)}`,
  ];
  for (const detail of details) {
    const item = document.createElement("span");
    item.textContent = detail;
    previewMeta.append(item);
  }

  downloadLink.href = downloadUrl(record.id);
  downloadLink.removeAttribute("aria-disabled");
}

function createToolbarButton(label, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function renderPdfToolbar() {
  previewToolbar.hidden = false;
  previewToolbar.innerHTML = "";

  const pageGroup = document.createElement("div");
  pageGroup.className = "preview-toolbar-group";
  const previous = createToolbarButton("上一页", "跳到上一页", () => {
    state.pdfPage = Math.max(1, state.pdfPage - 1);
    scrollToPdfPage();
    updatePdfToolbar();
  });
  previous.id = "pdfPrevious";
  const pageStatus = document.createElement("span");
  pageStatus.className = "preview-toolbar-status";
  pageStatus.id = "pdfPageStatus";
  const next = createToolbarButton("下一页", "跳到下一页", () => {
    state.pdfPage = Math.min(state.pdf?.numPages || 1, state.pdfPage + 1);
    scrollToPdfPage();
    updatePdfToolbar();
  });
  next.id = "pdfNext";
  pageGroup.append(previous, pageStatus, next);

  const zoomGroup = document.createElement("div");
  zoomGroup.className = "preview-toolbar-group";
  zoomGroup.append(
    createToolbarButton("−", "缩小", () => changePdfZoom(-0.1)),
    createToolbarButton("适宽", "适合当前窗口宽度", () => {
      state.pdfZoom = 1;
      renderPdfPages();
    }),
    createToolbarButton("+", "放大", () => changePdfZoom(0.1)),
  );

  previewToolbar.append(pageGroup, zoomGroup);
  updatePdfToolbar();
}

function updatePdfToolbar() {
  const pageStatus = document.querySelector("#pdfPageStatus");
  const previous = document.querySelector("#pdfPrevious");
  const next = document.querySelector("#pdfNext");
  if (!pageStatus || !previous || !next || !state.pdf) return;
  pageStatus.textContent = `${state.pdfPage} / ${state.pdf.numPages}`;
  previous.disabled = state.pdfPage <= 1;
  next.disabled = state.pdfPage >= state.pdf.numPages;
}

function changePdfZoom(delta) {
  state.pdfZoom = Math.min(2, Math.max(0.6, state.pdfZoom + delta));
  renderPdfPages();
}

function getPdfScale(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(280, previewContent.clientWidth - 36);
  const fitScale = availableWidth / baseViewport.width;
  return Math.min(1.5, fitScale) * state.pdfZoom;
}

function scrollToPdfPage() {
  const page = previewContent.querySelector(`[data-page="${state.pdfPage}"]`);
  page?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function renderPdfPages() {
  if (!state.pdf) return;
  showContent("pdf-host");
  renderPdfToolbar();

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    const page = await state.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: getPdfScale(page) });
    const wrapper = document.createElement("section");
    wrapper.className = "pdf-page";
    wrapper.dataset.page = String(pageNumber);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    wrapper.append(canvas);
    previewContent.append(wrapper);

    await page.render({
      canvasContext: context,
      viewport,
      transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    }).promise;
  }

  updatePdfToolbar();
}

async function renderPdf(url) {
  await loadScript(LIBRARIES.pdf.script);
  if (!window.pdfjsLib) throw new Error("PDF 预览组件没有正确加载");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBRARIES.pdf.worker;

  const response = await fetch(url);
  if (!response.ok) throw new Error("读取 PDF 文件失败");
  const data = await response.arrayBuffer();
  state.pdf = await window.pdfjsLib.getDocument({ data }).promise;
  state.pdfPage = 1;
  state.pdfZoom = 1;
  await renderPdfPages();
}

async function renderDocx(url) {
  await loadScript(LIBRARIES.docx.jszip);
  await loadScript(LIBRARIES.docx.script);
  if (!window.docx?.renderAsync) throw new Error("Word 预览组件没有正确加载");

  const response = await fetch(url);
  if (!response.ok) throw new Error("读取 Word 文件失败");
  const data = await response.arrayBuffer();
  showContent("docx-host");
  await window.docx.renderAsync(data, previewContent, null, {
    className: "docx",
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
  });
}

function waitForPptxRender() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000;
    const check = () => {
      if (previewContent.querySelector(".slide")) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error("PPT 预览超时，文件可能包含暂不支持的内容"));
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

async function renderPptx(url) {
  LIBRARIES.pptx.css.forEach(loadStylesheet);
  for (const script of LIBRARIES.pptx.scripts) {
    await loadScript(script);
  }
  if (!window.jQuery?.fn?.pptxToHtml) throw new Error("PPT 预览组件没有正确加载");

  showContent("pptx-host");
  const slidesResult = document.createElement("div");
  slidesResult.id = "slidesResult";
  previewContent.append(slidesResult);
  window.jQuery(slidesResult).pptxToHtml({
    pptxFileUrl: url,
    slideMode: false,
    keyBoardShortCut: false,
    mediaProcess: true,
    themeProcess: true,
  });
  await waitForPptxRender();
}

async function renderUnsupported(record) {
  previewToolbar.hidden = true;
  showError(
    "暂不支持在线预览",
    `${record.originalName} 属于旧版或当前未接入的文件格式，请下载原文件后使用本地办公软件打开。`,
  );
}

async function loadPreview() {
  const fileId = getFileId();
  if (!fileId) throw new Error("缺少文件 ID");

  const response = await fetch(`/filecenter/api/files/${encodeURIComponent(fileId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("文件不存在或已被移除");
  state.record = await response.json();
  renderMeta(state.record);

  const extension = getExtension(state.record.originalName);
  const url = contentUrl(state.record.id);
  if (extension === "pdf") {
    await renderPdf(url);
  } else if (["docx", "docm"].includes(extension)) {
    await renderDocx(url);
  } else if (["pptx", "pptm"].includes(extension)) {
    await renderPptx(url);
  } else {
    await renderUnsupported(state.record);
  }
}

loadPreview().catch((error) => {
  showError("预览失败", error.message || "文件无法打开");
});
