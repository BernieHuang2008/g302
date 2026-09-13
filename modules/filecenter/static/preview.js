const LIBRARIES = {
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
};

const TAG_KEYS = {
  语文: "chinese",
  数学: "math",
  英语: "english",
  物理: "physics",
  化学: "chemistry",
  生物: "biology",
  答案: "answer",
  课件: "courseware",
  试卷: "exam",
};

const previewTitle = document.querySelector("#previewTitle");
const previewTags = document.querySelector("#previewTags");
const previewLoading = document.querySelector("#previewLoading");
const previewError = document.querySelector("#previewError");
const previewContent = document.querySelector("#previewContent");
const downloadLink = document.querySelector("#downloadLink");
const loadedScripts = new Map();
const loadedStylesheets = new Set();

function getFileId() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(pathParts[pathParts.length - 1] || "");
}

function getExtension(fileName) {
  return fileName?.split(".").pop()?.toLowerCase() || "";
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
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`预览组件加载失败：${src}`));
    document.head.append(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

function loadStylesheet(href) {
  if (loadedStylesheets.has(href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
  loadedStylesheets.add(href);
}

function showContent(className) {
  previewLoading.hidden = true;
  previewError.hidden = true;
  previewContent.hidden = false;
  previewContent.className = `office-preview-content ${className}`;
  previewContent.innerHTML = "";
}

function showError(title, detail) {
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
    link.className = "button button-primary";
    link.href = downloadUrl(state.record.id);
    link.textContent = "下载原文件";
    previewError.append(link);
  }
}

function renderActionbar(record) {
  const fileName = record.displayName || record.originalName || "文件预览";
  previewTitle.textContent = fileName;
  document.title = `${fileName} - G302`;

  downloadLink.href = downloadUrl(record.id);
  downloadLink.removeAttribute("aria-disabled");

  previewTags.innerHTML = "";
  for (const tag of record.tags || []) {
    const badge = document.createElement("span");
    badge.className = `tag-badge tag-${TAG_KEYS[tag] || "default"}`;
    badge.textContent = tag;
    previewTags.append(badge);
  }
  previewTags.hidden = previewTags.childElementCount === 0;
}

function renderPdf(url) {
  showContent("pdf-host");
  const iframe = document.createElement("iframe");
  iframe.className = "pdf-viewer-frame";
  iframe.title = "PDF 预览";
  iframe.src = `/filecenter/static/pdfjs/web/viewer.html?${new URLSearchParams({ file: url })}`;
  previewContent.append(iframe);
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
    slideMode: true,
    keyBoardShortCut: true,
    mediaProcess: true,
    themeProcess: true,
  });
  await waitForPptxRender();
}

function renderUnsupported(record) {
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
  renderActionbar(state.record);

  const extension = getExtension(state.record.originalName);
  const url = contentUrl(state.record.id);
  if (extension === "pdf") {
    renderPdf(url);
  } else if (["docx", "docm"].includes(extension)) {
    await renderDocx(url);
  } else if (["pptx", "pptm"].includes(extension)) {
    await renderPptx(url);
  } else {
    renderUnsupported(state.record);
  }
}

loadPreview().catch((error) => {
  showError("预览失败", error.message || "文件无法打开");
});
