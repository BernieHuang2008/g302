const TAGS = ["语文", "数学", "英语", "物理", "化学", "生物", "|", "答案", "课件", "试卷"];
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
const WEEK_FILES_PREFIX = "week-files-";

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
  uploadedFiles: [],
  activeTags: new Set(),
  collapsedWeeks: new Set(),
  query: "",
};

const searchInput = document.querySelector("#searchInput");
const tagFilters = document.querySelector("#tagFilters");
const timeline = document.querySelector("#timeline");
const fileCount = document.querySelector("#fileCount");

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

function renderFormatIcon(fileName) {
  const info = getFormatInfo(fileName);
  const icon = document.createElement("span");
  icon.className = `format-icon ${info.className}`;
  icon.textContent = info.label;
  icon.setAttribute("aria-label", `文件格式：${info.label}`);
  return icon;
}

function renderTagFilters() {
  tagFilters.innerHTML = "";
  for (const tag of TAGS) {
    if (tag === "|") {
      const separator = document.createElement("span");
      separator.className = "tag-separator";
      tagFilters.append(separator);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-pill tag-${TAG_KEYS[tag]}`;
    button.textContent = tag;
    button.setAttribute("aria-pressed", String(state.activeTags.has(tag)));
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
      state.activeTags.size === 0 || [...state.activeTags].some((tag) => file.tags?.includes(tag));
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
      groups.set(key, { key, weekStart, files: [] });
    }
    groups.get(key).files.push(file);
  }
  return [...groups.values()].sort((a, b) => b.weekStart - a.weekStart);
}

function renderFileCard(file) {
  const a = document.createElement("a");
  a.href = `/filecenter/preview/${encodeURIComponent(file.id)}`;

  const article = document.createElement("article");
  article.className = `file-card file-tint-${subjectKey(file.tags)}`;

  const icon = renderFormatIcon(file.originalName || file.displayName);
  const main = document.createElement("div");
  main.className = "file-card-main";

  const name = document.createElement("span");
  name.textContent = file.displayName || file.originalName;
  name.className = "file-link";
  name.title = "预览文件";

  const detail = document.createElement("p");
  detail.className = "file-detail";
  detail.textContent = `${formatDateTime(file.uploadedAt)} · ${formatSize(file.size || 0)}`;
  main.append(name, detail);

  const tags = document.createElement("div");
  tags.className = "tag-row file-tags";
  for (const tag of file.tags || []) {
    const badge = document.createElement("span");
    badge.className = `tag-badge tag-${TAG_KEYS[tag]}`;
    badge.textContent = tag;
    tags.append(badge);
  }

  article.append(icon, main, tags);
  a.append(article);

  return a;
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
    const week = document.createElement("section");
    week.className = "timeline-week";

    const node = document.createElement("button");
    node.type = "button";
    node.className = "week-node";
    node.title = "折叠或展开这一周";
    node.setAttribute("aria-label", `折叠或展开${weekTitle(group.weekStart)}的文件`);
    node.setAttribute("aria-expanded", String(!state.collapsedWeeks.has(group.key)));
    node.dataset.weekKey = group.key;

    const content = document.createElement("div");
    content.className = "week-content";

    const header = document.createElement("div");
    header.className = "week-header";
    const title = document.createElement("h2");
    title.textContent = weekTitle(group.weekStart);
    const count = document.createElement("span");
    count.className = "week-count";
    count.textContent = `${group.files.length} 个文件`;
    header.append(title, count);

    const filesWrap = document.createElement("div");
    filesWrap.className = "week-files";
    filesWrap.id = `${WEEK_FILES_PREFIX}${group.key}`;
    node.setAttribute("aria-controls", filesWrap.id);
    for (const file of group.files) {
      filesWrap.append(renderFileCard(file));
    }

    const isCollapsed = state.collapsedWeeks.has(group.key);
    if (isCollapsed) {
      week.classList.add("is-collapsed");
    }
    filesWrap.hidden = isCollapsed;

    node.addEventListener("click", () => {
      const collapsed = !state.collapsedWeeks.has(group.key);
      if (collapsed) {
        state.collapsedWeeks.add(group.key);
      } else {
        state.collapsedWeeks.delete(group.key);
      }
      week.classList.toggle("is-collapsed", collapsed);
      filesWrap.hidden = collapsed;
      node.setAttribute("aria-expanded", String(!collapsed));
    });

    content.append(header, filesWrap);
    week.append(node, content);
    timeline.append(week);
  }
}

async function loadFiles() {
  const response = await fetch("/filecenter/api/files", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("读取文件列表失败");
  const payload = await response.json();
  state.uploadedFiles = payload.files || [];
  renderTimeline();
}

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderTimeline();
});

renderTagFilters();
loadFiles().catch((error) => {
  timeline.innerHTML = `<section class="panel empty-timeline">${error.message}</section>`;
  fileCount.textContent = "同步失败";
});
