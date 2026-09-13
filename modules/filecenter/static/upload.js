const TAGS = ["语文", "数学", "英语", "物理", "化学", "生物", "答案", "课件", "试卷"];
const SUBJECT_TAGS = ["语文", "数学", "英语", "物理", "化学", "生物"];
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

const FORMAT_DEFINITIONS = [
  { extensions: ["pdf"], label: "PDF", className: "format-pdf" },
  { extensions: ["ppt", "pptx", "pptm"], label: "PPT", className: "format-ppt" },
  { extensions: ["doc", "docx", "docm"], label: "Word", className: "format-word" },
  { extensions: ["xls", "xlsx", "xlsm", "csv"], label: "Excel", className: "format-excel" },
  { extensions: ["txt", "md"], label: "TXT", className: "format-text" },
  { extensions: ["zip", "rar", "7z"], label: "ZIP", className: "format-archive" },
  { extensions: ["jpg", "jpeg", "png", "gif", "webp"], label: "IMG", className: "format-image" },
  { extensions: ["mp4", "mov", "avi", "mkv"], label: "视频", className: "format-video" },
  { extensions: ["mp3", "wav", "m4a", "flac"], label: "音频", className: "format-audio" },
];

const state = {
  selectedFiles: [],
  uploading: false,
};

const dropArea = document.querySelector("#dropArea");
const dropZone = document.querySelector("#dropZone");
const fileInput = document.querySelector("#fileInput");
const selectedFiles = document.querySelector("#selectedFiles");
const uploadForm = document.querySelector("#uploadForm");
const uploadButton = document.querySelector("#uploadButton");
const uploadStatus = document.querySelector("#uploadStatus");
const progressPanel = document.querySelector("#progressPanel");
const progressBar = document.querySelector("#progressBar");
const progressPercent = document.querySelector("#progressPercent");
const progressStatus = document.querySelector("#progressStatus");
const progressTrack = document.querySelector(".progress-track");
const template = document.querySelector("#fileEditorTemplate");
let dragDepth = 0;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFormatInfo(fileName) {
  const extension = fileName?.split(".").pop()?.toLowerCase() || "";
  return (
    FORMAT_DEFINITIONS.find((definition) => definition.extensions.includes(extension)) || {
      label: extension ? extension.slice(0, 5).toUpperCase() : "FILE",
      className: "format-other",
    }
  );
}

function subjectKey(tags = []) {
  const subject = SUBJECT_TAGS.find((tag) => tags.includes(tag));
  return subject ? TAG_KEYS[subject] : "default";
}

function addFiles(files) {
  if (state.uploading) return;
  const incoming = [...files];
  const existing = new Set(
    state.selectedFiles.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`),
  );

  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (existing.has(key)) continue;
    existing.add(key);
    state.selectedFiles.push({
      file,
      displayName: file.name,
      tags: new Set(),
    });
  }
  renderSelectedFiles();
}

function renderSelectedFiles() {
  selectedFiles.innerHTML = "";
  selectedFiles.classList.toggle("empty-state", state.selectedFiles.length === 0);
  uploadButton.disabled = state.selectedFiles.length === 0 || state.uploading;

  if (state.selectedFiles.length === 0) {
    selectedFiles.textContent = "还没有选择文件";
    return;
  }

  state.selectedFiles.forEach((item, index) => {
    const node = template.firstElementChild.cloneNode(true);
    node.classList.add(`file-tint-${subjectKey([...item.tags])}`);
    const icon = node.querySelector(".upload-format-icon");
    const info = getFormatInfo(item.file.name);
    icon.className = `format-icon upload-format-icon ${info.className}`;
    icon.textContent = info.label;
    icon.setAttribute("aria-label", `文件格式：${info.label}`);

    const nameInput = node.querySelector(".display-name");
    const detail = node.querySelector(".file-detail");
    const tagsWrap = node.querySelector(".editor-tags");
    const removeButton = node.querySelector(".remove-file");

    nameInput.value = item.displayName;
    nameInput.disabled = state.uploading;
    detail.textContent = `${item.file.name} · ${formatSize(item.file.size)}`;
    nameInput.addEventListener("input", () => {
      item.displayName = nameInput.value;
    });

    removeButton.disabled = state.uploading;
    removeButton.addEventListener("click", () => {
      state.selectedFiles.splice(index, 1);
      renderSelectedFiles();
    });

    for (const tag of TAGS) {
      const label = document.createElement("label");
      label.className = `check-pill tag-${TAG_KEYS[tag]}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.tags.has(tag);
      checkbox.disabled = state.uploading;
      label.classList.toggle("is-selected", checkbox.checked);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          item.tags.add(tag);
        } else {
          item.tags.delete(tag);
        }
        label.classList.toggle("is-selected", checkbox.checked);
        node.className = `file-editor file-tint-${subjectKey([...item.tags])}`;
      });
      label.append(checkbox, document.createTextNode(tag));
      tagsWrap.append(label);
    }

    selectedFiles.append(node);
  });
}

function setProgress(value, status) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  progressPanel.hidden = false;
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressStatus.textContent = status;
  progressTrack.setAttribute("aria-valuenow", String(percent));
}

function setDragActive(active) {
  dropArea.classList.toggle("is-dragging", active);
  dropZone.classList.toggle("is-dragging", active);
}

function uploadFiles() {
  const form = new FormData();
  const metadata = state.selectedFiles.map((item) => {
    form.append("files", item.file, item.file.name);
    return {
      displayName: item.displayName,
      tags: [...item.tags],
    };
  });
  form.append("metadata", JSON.stringify(metadata));

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/filecenter/api/upload");

  xhr.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) {
      setProgress((event.loaded / event.total) * 100, "正在上传...");
    } else {
      setProgress(0, "正在上传...");
    }
  });

  xhr.addEventListener("load", () => {
    state.uploading = false;
    if (xhr.status >= 200 && xhr.status < 300) {
      const uploadedCount = state.selectedFiles.length;
      state.selectedFiles = [];
      renderSelectedFiles();
      setProgress(100, "上传完成");
      uploadStatus.textContent = `已上传 ${uploadedCount} 个文件`;
      fileInput.value = "";
    } else {
      renderSelectedFiles();
      let message = "上传失败";
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {
        // Keep the friendly fallback for non-JSON server errors.
      }
      uploadStatus.textContent = message;
      setProgress(0, "上传失败");
    }
  });

  xhr.addEventListener("error", () => {
    state.uploading = false;
    renderSelectedFiles();
    uploadStatus.textContent = "网络错误，上传失败";
    setProgress(0, "上传失败");
  });

  xhr.addEventListener("abort", () => {
    state.uploading = false;
    renderSelectedFiles();
    uploadStatus.textContent = "上传已取消";
    setProgress(0, "已取消");
  });

  xhr.send(form);
}

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

dropArea.addEventListener("dragenter", (event) => {
  event.preventDefault();
  event.stopPropagation();
  dragDepth += 1;
  setDragActive(true);
});

dropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

dropArea.addEventListener("dragleave", (event) => {
  event.preventDefault();
  event.stopPropagation();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDragActive(false);
});

dropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  dragDepth = 0;
  addFiles(event.dataTransfer.files);
  setDragActive(false);
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

uploadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.selectedFiles.length === 0 || state.uploading) return;
  state.uploading = true;
  uploadStatus.textContent = "";
  uploadButton.disabled = true;
  setProgress(0, "准备上传...");
  renderSelectedFiles();
  uploadFiles();
});

renderSelectedFiles();
