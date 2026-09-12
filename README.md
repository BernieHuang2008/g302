# G302

G302 是班级内部服务的主项目。当前包含 `filecenter` 文件中心模块，主 Flask 应用负责把流量路由到各个模块。

## 功能

- 访问 `/filecenter/` 使用文件中心。
- 支持一次选择一个或多个文件。
- 上传前可逐个编辑展示文件名。
- 支持多选标签：语文、数学、英语、物理、化学、生物、答案、课件、试卷。
- 文件保存到 `data/filecenter/uploads/`。
- 服务器实际保存名使用随机 ID 且不带扩展名；原始文件名只记录在 JSON 中，下载时强制作为附件返回。
- 文件索引保存到 `data/filecenter/files.json`，使用 UTF-8 JSON。
- 文件按周展示，从最新到最旧。最近三周标题为本周、上周、两周前，更早显示日期范围。
- 支持按文件名、时间、标签搜索。
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
- `POST /filecenter/api/upload`：上传文件，multipart 字段为 `files` 和 `metadata`。
- `GET /filecenter/api/download/<file_id>`：下载指定文件。
