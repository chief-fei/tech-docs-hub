# Docker Compose 使用指南

Docker Compose 用 `docker-compose.yml` 文件定义和管理多容器应用。

## 基本结构

```yaml
services:             # 服务定义
  app:                # 服务名
    build: .          # 构建配置
    image: myapp:1.0  # 使用镜像
    ports:            # 端口映射
      - "8080:8080"
    environment:      # 环境变量
      - DB_HOST=mysql
    depends_on:       # 依赖
      - mysql
    volumes:          # 数据卷
      - ./data:/app/data
    networks:         # 网络
      - app-net

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=secret
    volumes:
      - mysql-data:/var/lib/mysql

volumes:              # 命名卷
  mysql-data:

networks:             # 自定义网络
  app-net:
    driver: bridge
```

## 常用命令

```bash
# 启动
docker compose up -d                    # 后台启动所有服务
docker compose up -d --build            # 重新构建并启动
docker compose up -d --pull always      # 拉取最新镜像并启动
docker compose up -d app mysql          # 启动指定服务

# 停止
docker compose down                     # 停止并删除容器/网络
docker compose down -v                  # 同时删除数据卷
docker compose down --rmi all           # 同时删除镜像
docker compose stop                     # 停止（保留容器）
docker compose start                    # 启动已停止的服务
docker compose restart                  # 重启服务
docker compose restart app              # 重启单个

# 查看
docker compose ps                       # 运行中的服务
docker compose ps -a                    # 所有服务
docker compose logs                     # 查看日志
docker compose logs -f                  # 实时跟踪
docker compose logs -f app              # 指定服务
docker compose logs --tail=50 app       # 最近 50 行
docker compose top                      # 查看进程
docker compose port app 8080            # 查看端口映射

# 执行命令
docker compose exec app bash            # 在运行的服务中执行
docker compose exec -u root app whoami
docker compose run app npm install      # 一次性命令
docker compose run --rm app python manage.py migrate  # 执行完删除
```

## 完整实战：Spring Boot + MySQL + Redis

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: myapp:latest
    container_name: myapp
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/mydb
      - SPRING_DATASOURCE_USERNAME=root
      - SPRING_DATASOURCE_PASSWORD=root123
      - SPRING_DATA_REDIS_HOST=redis
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - app-net
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    container_name: mysql
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: mydb
    volumes:
      - mysql-data:/var/lib/mysql
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-net
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    networks:
      - app-net
    restart: unless-stopped

volumes:
  mysql-data:
  redis-data:

networks:
  app-net:
    driver: bridge
```

## depends_on + healthcheck

```yaml
depends_on:
  mysql:
    condition: service_healthy    # 等待健康检查通过
  redis:
    condition: service_started    # 仅等待启动

mysql:
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s   # 启动缓冲时间
```

## 网络模式

```yaml
services:
  app:
    networks:
      - frontend        # 对外
      - backend         # 对内
  db:
    networks:
      - backend         # 只连内网

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true      # 禁止外部访问
```

## 命令速查

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 后台启动所有服务 |
| `docker compose up -d --build` | 重新构建并启动 |
| `docker compose down` | 停止并清理容器 |
| `docker compose down -v` | 停止并清理容器+卷 |
| `docker compose stop/start` | 停止/启动（保留容器） |
| `docker compose restart` | 重启 |
| `docker compose ps` | 查看状态 |
| `docker compose logs -f` | 实时日志 |
| `docker compose exec` | 执行命令 |
| `docker compose run --rm` | 一次性命令 |
| `docker compose build` | 构建镜像 |
| `docker compose pull` | 拉取镜像 |
