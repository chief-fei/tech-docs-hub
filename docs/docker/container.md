# Docker 容器管理命令

## docker run — 创建并启动容器

`docker run` 是最核心的命令，参数最多。

### 基本语法

```bash
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

### 最常用形式

```bash
docker run nginx                          # 前台运行（Ctrl+C 退出）
docker run -d nginx                       # -d 后台运行
docker run -d -p 8080:80 --name my-nginx nginx  # 后台+端口+命名
docker run -it ubuntu bash                # 交互式终端
docker run --rm nginx                     # 退出后自动删除容器
```

### 完整参数说明

**运行模式：**

| 参数 | 说明 |
|------|------|
| `-d` | 后台运行（detached） |
| `-it` | 交互模式 `-i`（stdin）+ `-t`（终端） |
| `--rm` | 退出后自动删除容器 |
| `--name NAME` | 容器自定义名称 |

**网络端口：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `-p` | 端口映射 主机端口:容器端口 | `-p 8080:80` |
| `-p` | 指定协议 | `-p 8080:80/tcp` |
| `-P` | 随机映射 EXPOSE 声明的端口 | `-P` |
| `--network` | 加入网络 | `--network my-net` |

**环境与配置：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `-e` | 设置环境变量 | `-e MYSQL_ROOT_PASSWORD=123` |
| `--env-file` | 从文件读取环境变量 | `--env-file .env` |
| `-w` | 工作目录 | `-w /app` |

**存储挂载：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `-v` | 绑定挂载 主机路径:容器路径 | `-v /data:/app/data` |
| `-v` | 命名卷挂载 | `-v my-volume:/app/data` |
| `-v` | 只读挂载 | `-v /config:/app/config:ro` |
| `--volumes-from` | 从其他容器挂载 | `--volumes-from db` |

**资源限制：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `--memory` | 内存限制 | `--memory 512m` |
| `--cpus` | CPU 核数限制 | `--cpus 2` |
| `--memory-swap` | 内存+Swap 限制 | `--memory-swap 1g` |

**重启策略：**

| 参数值 | 说明 |
|--------|------|
| `no` | 不自动重启（默认） |
| `always` | 无论什么原因退出都重启 |
| `unless-stopped` | 除非手动 stop，否则重启 |
| `on-failure[:N]` | 仅异常退出时重启，可选最大次数 |

### 完整示例

```bash
docker run -d \
  --name myapp \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e TZ=Asia/Shanghai \
  -v /home/app/logs:/app/logs \
  -v /home/app/config:/app/config:ro \
  --memory 512m \
  --cpus 1 \
  --restart unless-stopped \
  --network app-net \
  myapp:1.0
```

## docker ps — 查看容器

```bash
docker ps                        # 运行中的容器
docker ps -a                     # 所有容器（含已停止）
docker ps -q                     # 只显示 ID
docker ps -a -q                  # 所有容器 ID
docker ps --filter "status=exited"     # 过滤已退出
docker ps --filter "name=nginx"        # 过滤名称
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"
```

## 容器生命周期

```bash
docker start my-nginx             # 启动已停止的容器
docker start -a my-nginx          # 启动并附加输出

docker stop my-nginx              # 优雅停止（SIGTERM → 10s → SIGKILL）
docker stop -t 30 my-nginx        # 30 秒超时

docker kill my-nginx              # 强制停止（立即 SIGKILL）
docker kill -s SIGINT my-nginx    # 发送指定信号

docker restart my-nginx           # 重启
docker restart -t 10 my-nginx     # 10 秒超时

docker pause my-nginx             # 暂停进程（冻结）
docker unpause my-nginx           # 恢复

docker rm my-nginx                # 删除已停止的容器
docker rm -f my-nginx             # 强制删除运行中的
docker rm $(docker ps -aq)        # 删除全部容器
docker container prune            # 清理所有已停止的容器
docker container prune --filter "until=24h"
```

## docker exec — 进入容器执行命令

```bash
docker exec -it my-nginx bash         # 进入 bash
docker exec -it my-nginx sh           # Alpine 用 sh
docker exec my-nginx ls /app          # 执行单条命令
docker exec -u root my-nginx whoami   # 以 root 执行
docker exec -w /tmp my-nginx pwd      # 指定工作目录
docker exec -e VAR=value my-nginx env # 带环境变量
```

## docker logs — 查看日志

```bash
docker logs my-nginx                   # 全部日志
docker logs -f my-nginx                # 实时跟踪（tail -f）
docker logs --tail 100 my-nginx        # 最近 100 行
docker logs --since 10m my-nginx       # 最近 10 分钟
docker logs --until "2024-01-01" my-nginx
docker logs -t my-nginx                # 显示时间戳
```

## 其他容器命令

```bash
docker cp ./file.txt my-nginx:/app/         # 主机→容器
docker cp my-nginx:/app/file.txt ./         # 容器→主机

docker inspect my-nginx                     # 容器详情 JSON
docker inspect -f '{{.State.Status}}' my-nginx
docker inspect -f '{{.NetworkSettings.IPAddress}}' my-nginx

docker top my-nginx             # 查看容器内进程
docker stats                   # 实时资源使用（CPU/内存）
docker stats --no-stream       # 一次性输出
docker port my-nginx           # 查看端口映射
docker diff my-nginx           # 查看文件变更
```

## 命令速查

| 命令 | 说明 | 关键参数 |
|------|------|---------|
| `docker run` | 创建并启动 | `-d`, `-p`, `-v`, `-e`, `--name`, `--rm`, `--restart` |
| `docker ps` | 查看容器 | `-a`, `-q`, `--filter`, `--format` |
| `docker start/stop` | 启动/停止 | `-a`, `-t` |
| `docker restart` | 重启 | `-t` |
| `docker kill` | 强制停止 | `-s` |
| `docker rm` | 删除 | `-f` |
| `docker exec` | 进入执行 | `-it`, `-u`, `-w`, `-e` |
| `docker logs` | 查看日志 | `-f`, `--tail`, `--since` |
| `docker cp` | 文件复制 | — |
| `docker inspect` | 详情 | `-f` |
| `docker top` | 进程查看 | — |
| `docker stats` | 资源统计 | `--no-stream` |
