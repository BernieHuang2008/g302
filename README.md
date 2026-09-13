# G302

G302 是班级内部服务的主项目。当前包含 `filecenter` 文件中心模块，主 Flask 应用负责把流量路由到各个模块。

## 功能

- 访问 `/filecenter/` 查看文件列表，访问 `/filecenter/upload` 上传文件。
- 支持一次选择一个或多个文件。
- 上传页支持拖拽选择文件、逐项移除待上传文件和上传进度显示。
- 上传前可逐个编辑展示文件名。
- 支持多选标签：语文、数学、英语、物理、化学、生物、答案、课件、试卷。
- 文件保存到 `data/filecenter/uploads/`。
- 服务器实际保存名使用随机 ID 且不带扩展名；原始文件名只记录在 JSON 中，下载时强制作为附件返回。
- 文件索引保存到 `data/filecenter/files.json`，使用 UTF-8 JSON。
- 文件按周展示，从最新到最旧。最近三周标题为本周、上周、两周前，更早显示日期范围。
- 支持按文件名、时间、标签搜索；同时选择多个标签时按并集显示匹配文件。
- 上传页会在浏览器 `localStorage` 中记住上一次上传列表最后一个文件的科目选择，后续新选文件会默认使用这组科目。
- 点击文件名进入预览页面，支持 PDF、DOCX/Word 和 PPTX/PPT 的浏览器端预览。
- 预览页保留原文件下载按钮；旧版 `.doc`、`.ppt` 和其他格式会提示下载原文件。
- 不提供删除接口。

## 本地运行

```bash
pip install -r requirements.txt
python app.py
```

然后访问：

```text
http://127.0.0.1:8080/filecenter/
```

## Docker 运行

```bash
docker compose up --build
```

容器内只监听 `8080`，使用 bridge 网络。服务器上可按需要把宿主机端口映射到容器的 `8080`。

如果不用 compose：

```bash
docker build -t g302 .
docker run -d --name g302 -p 8080:8080 -v ./data:/app/data g302
```

## API

- `GET /api/health`：主服务健康检查。
- `GET /filecenter/api/files`：获取文件索引 JSON。
- `GET /filecenter/api/files/<file_id>`：获取单个文件的元数据。
- `POST /filecenter/api/upload`：上传文件，multipart 字段为 `files` 和 `metadata`。
- `GET /filecenter/api/content/<file_id>`：以内联方式返回文件内容，供预览组件读取。
- `GET /filecenter/api/download/<file_id>`：以附件方式下载原文件。

预览页通过普通 `script` 标签按需加载 PDF.js、docx-preview 和 PPTXjs。PDF 和 DOCX 使用固定版本的 CDN 资源；PPTXjs 依赖 jQuery、JSZip 2.x 兼容包及其配套脚本。
