const TAGS = ["语文", "数学", "英语", "物理", "化学", "生物", "答案", "课件", "试卷"];

const state = {
  selectedFiles: [],
  uploadedFiles: [],
  activeTags: new Set(),
  query: "",
};

const fileInput = document.querySelector("#fileInput");
const selectedFiles = document.querySelector("#selectedFiles");
const uploadForm = document.querySelector("#uploadForm");
const uploadButton = document.querySelector("#uploadButton");
const uploadStatus = document.querySelector("#uploadStatus");
const searchInput = document.querySelector("#searchInput");
const tagFilters = document.querySelector("#tagFilters");
const timeline = document.querySelector("#timeline");
const fileCount = document.querySelector("#fileCount");
const template = document.querySelector("#fileEditorTemplate");

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function localDate(uploadedAt) {
  return new Date(uploadedAt);
}

function formatDateTime(uploadedAt) {
  return localDate(uploadedAt).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - day + 1);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameWeekKey(date) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function weekTitle(weekStart) {
  const currentWeek = startOfWeek(new Date());
  const diffWeeks = Math.round((currentWeek - weekStart) / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks === 0) return "本周";
  if (diffWeeks === 1) return "上周";
  if (diffWeeks === 2) return "两周前";
  return `${formatMonthDay(weekStart)} 到 ${formatMonthDay(addDays(weekStart, 6))}`;
}

function renderTagFilters() {
  tagFilters.innerHTML = "";
  for (const tag of TAGS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-pill";
    button.textContent = tag;
    button.ariaPressed = String(state.activeTags.has(tag));
    button.addEventListener("click", () => {
      if (state.activeTags.has(tag)) {
        state.activeTags.delete(tag);
      } else {
        state.activeTags.add(tag);
      }
      renderTagFilters();
      renderTimeline();
    });
    tagFilters.append(button);
  }
}

function renderSelectedFiles() {
  selectedFiles.innerHTML = "";
  selectedFiles.classList.toggle("empty-state", state.selectedFiles.length === 0);
  uploadButton.disabled = state.selectedFiles.length === 0;

  if (state.selectedFiles.length === 0) {
    selectedFiles.textContent = "还没有选择文件";
    return;
  }

  state.selectedFiles.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const nameInput = node.querySelector(".display-name");
    const detail = node.querySelector(".file-detail");
    const tagsWrap = node.querySelector(".editor-tags");

    nameInput.value = item.displayName;
    detail.textContent = `${item.file.name} · ${formatSize(item.file.size)}`;
    nameInput.addEventListener("input", () => {
      item.displayName = nameInput.value;
    });

    for (const tag of TAGS) {
      const label = document.createElement("label");
      label.className = "check-pill";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = tag;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          item.tags.add(tag);
        } else {
          item.tags.delete(tag);
        }
      });
      label.append(checkbox, document.createTextNode(tag));
      tagsWrap.append(label);
    }

    selectedFiles.append(node);
  });
}

function getFilteredFiles() {
  const query = state.query.trim().toLowerCase();
  return state.uploadedFiles.filter((file) => {
    const searchable = [
      file.displayName,
      file.originalName,
      formatDateTime(file.uploadedAt),
      ...(file.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    const queryMatched = !query || searchable.includes(query);
    const tagsMatched =
      state.activeTags.size === 0 || [...state.activeTags].every((tag) => file.tags?.includes(tag));
    return queryMatched && tagsMatched;
  });
}

function groupByWeek(files) {
  const groups = new Map();
  for (const file of files) {
    const date = localDate(file.uploadedAt);
    const weekStart = startOfWeek(date);
    const key = sameWeekKey(date);
    if (!groups.has(key)) {
      groups.set(key, { weekStart, files: [] });
    }
    groups.get(key).files.push(file);
  }
  return [...groups.values()].sort((a, b) => b.weekStart - a.weekStart);
}

function renderTimeline() {
  timeline.innerHTML = "";
  const files = getFilteredFiles();
  fileCount.textContent = `${state.uploadedFiles.length} 个文件`;

  if (files.length === 0) {
    const empty = document.createElement("section");
    empty.className = "panel empty-timeline";
    empty.textContent = "没有匹配的文件";
    timeline.append(empty);
    return;
  }

  for (const group of groupByWeek(files)) {
    const section = document.createElement("section");
    section.className = "week-block";

    const title = document.createElement("h2");
    title.textContent = weekTitle(group.weekStart);
    section.append(title);

    for (const file of group.files) {
      const article = document.createElement("article");
      article.className = "file-card";

      const main = document.createElement("div");
      const name = document.createElement("a");
      name.href = `/filecenter/api/download/${encodeURIComponent(file.id)}`;
      name.textContent = file.displayName || file.originalName;
      name.className = "file-link";

      const detail = document.createElement("p");
      detail.className = "file-detail";
      detail.textContent = `${formatDateTime(file.uploadedAt)} · ${formatSize(file.size || 0)}`;
      main.append(name, detail);

      const tags = document.createElement("div");
      tags.className = "tag-row";
      for (const tag of file.tags || []) {
        const badge = document.createElement("span");
        badge.className = "tag-badge";
        badge.textContent = tag;
        tags.append(badge);
      }

      article.append(main, tags);
      section.append(article);
    }
    timeline.append(section);
  }
}

async function loadFiles() {
  const response = await fetch("/filecenter/api/files", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("读取文件列表失败");
  const payload = await response.json();
  state.uploadedFiles = payload.files || [];
  renderTimeline();
}

fileInput.addEventListener("change", () => {
  state.selectedFiles = [...fileInput.files].map((file, index) => ({
    key: `file-${index}`,
    file,
    displayName: file.name,
    tags: new Set(),
  }));
  renderSelectedFiles();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderTimeline();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.selectedFiles.length === 0) return;

  uploadButton.disabled = true;
  uploadStatus.textContent = "正在上传...";

  const form = new FormData();
  const metadata = state.selectedFiles.map((item) => {
    form.append("files", item.file, item.file.name);
    return {
      key: "files",
      displayName: item.displayName,
      tags: [...item.tags],
    };
  });
  form.append("metadata", JSON.stringify(metadata));

  try {
    const response = await fetch("/filecenter/api/upload", { method: "POST", body: form });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "上传失败");
    }
    fileInput.value = "";
    state.selectedFiles = [];
    renderSelectedFiles();
    uploadStatus.textContent = "上传完成";
    await loadFiles();
  } catch (error) {
    uploadStatus.textContent = error.message;
    uploadButton.disabled = false;
  }
});

renderTagFilters();
renderSelectedFiles();
loadFiles().catch((error) => {
  timeline.innerHTML = `<section class="panel empty-timeline">${error.message}</section>`;
  fileCount.textContent = "同步失败";
});
