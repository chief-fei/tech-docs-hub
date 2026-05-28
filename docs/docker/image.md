# Docker 镜像管理命令

## docker pull — 拉取镜像

```bash
# 基本语法
docker pull [OPTIONS] NAME[:TAG|@DIGEST]

# 拉取镜像
docker pull nginx                    # 等同于 nginx:latest
docker pull nginx:1.25               # 指定版本
docker pull openjdk:17-jdk-slim      # Java 17

# 选项
docker pull --platform linux/amd64 nginx  # M1 Mac 上拉 Intel 镜像
docker pull -q nginx                     # -q 静默模式
```

## docker images — 查看本地镜像

```bash
docker images                       # 列出所有镜像
docker images nginx                 # 过滤名称
docker images -q                    # 只显示 ID
docker images --filter "dangling=true"  # 悬空镜像（&lt;none&gt;）
docker images --format "{{.Repository}}:{{.Tag}}"  # 自定义格式
```

## docker build — 构建镜像

```bash
# 基本语法
docker build [OPTIONS] PATH

# 选项说明
docker build -t myapp:1.0 .             # -t 名称:标签
docker build -f Dockerfile.prod -t myapp:1.0 .  # -f 指定 Dockerfile
docker build --no-cache -t myapp:1.0 .  # 不使用构建缓存
docker build --build-arg JAR_FILE=app.jar -t myapp:1.0 .  # --build-arg 构建参数
docker build --platform linux/amd64 -t myapp:1.0 .  # 指定平台
docker build --pull -t myapp:1.0 .      # 先拉取最新基础镜像
docker build -q -t myapp:1.0 .          # 静默构建
```

## docker tag — 标记镜像

```bash
docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]

docker tag myapp:1.0 myapp:latest           # 打 latest 标签
docker tag myapp:1.0 myrepo/myapp:1.0       # 准备推送
docker tag myapp:1.0 registry.example.com/myapp:1.0  # 私有仓库
```

## docker push — 推送镜像

```bash
docker push myuser/myapp:1.0
docker push registry.example.com/myapp:1.0
docker push -q myuser/myapp:1.0        # 静默模式
```

## docker rmi — 删除镜像

```bash
docker rmi nginx:1.25                  # 删除指定镜像
docker rmi abc123 def456               # 批量删除
docker rmi -f nginx:1.25               # 强制删除
docker rmi $(docker images -q)         # 删除全部

# 清理
docker image prune                     # 删除悬空镜像
docker image prune -a                  # 删除所有未使用镜像
docker image prune -a --filter "until=24h"
```

## docker save / load — 导出导入（离线部署）

```bash
docker save -o myapp.tar myapp:1.0         # 导出
docker save myapp:1.0 | gzip > myapp.tar.gz  # 压缩导出
docker load -i myapp.tar                   # 导入
docker load < myapp.tar.gz                 # 从压缩文件导入
```

## 其他镜像命令

```bash
docker history nginx:latest            # 查看镜像构建历史（层信息）
docker history --no-trunc nginx:latest # 不截断输出

docker inspect nginx:latest            # 镜像详情（JSON）
docker inspect -f '{{.Os}}' nginx      # 提取特定字段
docker inspect -f '{{.Config.ExposedPorts}}' nginx
```

## 命令速查

| 命令 | 说明 | 关键选项 |
|------|------|---------|
| `docker pull` | 拉取镜像 | `--platform` |
| `docker images` | 查看本地镜像 | `-q`, `--filter`, `--format` |
| `docker build` | 构建镜像 | `-t`, `-f`, `--no-cache`, `--build-arg` |
| `docker tag` | 打标签 | — |
| `docker push` | 推送镜像 | — |
| `docker rmi` | 删除镜像 | `-f` |
| `docker save` | 导出 | `-o` |
| `docker load` | 导入 | `-i` |
| `docker history` | 查看历史 | `--no-trunc` |
| `docker inspect` | 查看详情 | `-f`（Go template） |
| `docker image prune` | 清理 | `-a`, `--filter` |
