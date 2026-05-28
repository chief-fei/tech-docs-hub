# Dockerfile 编写指南

Dockerfile 是构建镜像的指令文件。

## 指令速查

| 指令 | 说明 | 格式 |
|------|------|------|
| `FROM` | 基础镜像 | `FROM image:tag` |
| `WORKDIR` | 工作目录 | `WORKDIR /app` |
| `COPY` | 复制文件（推荐） | `COPY src dest` |
| `ADD` | 复制+解压/URL | `ADD src dest` |
| `RUN` | 构建时执行命令 | `RUN command` |
| `CMD` | 默认启动命令（可覆盖） | `CMD ["exec","arg"]` |
| `ENTRYPOINT` | 入口命令 | `ENTRYPOINT ["exec"]` |
| `ENV` | 环境变量 | `ENV KEY=VALUE` |
| `ARG` | 构建参数 | `ARG VAR=default` |
| `EXPOSE` | 声明端口（文档） | `EXPOSE 8080` |
| `VOLUME` | 声明挂载点 | `VOLUME /data` |
| `USER` | 切换用户 | `USER app` |
| `HEALTHCHECK` | 健康检查 | `HEALTHCHECK CMD ...` |

## 各指令详解

### FROM — 基础镜像 + 多阶段构建

```dockerfile
FROM openjdk:17-jdk-slim
FROM eclipse-temurin:17-jre-alpine AS runtime
FROM scratch                        # 空白镜像（静态编译）

# 多阶段构建
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY . .
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre-alpine
COPY --from=builder /build/target/*.jar app.jar
```

### WORKDIR — 工作目录

```dockerfile
WORKDIR /app              # 设置后所有命令都在此目录执行
WORKDIR src               # 相对路径=/app/src
```

### COPY — 复制文件

```dockerfile
COPY target/app.jar /app/app.jar    # 复制文件
COPY src/ /app/src/                 # 复制目录
COPY --chown=1000:1000 app /app     # 复制并改所有者
COPY target/*.jar /app/app.jar      # 通配符（只有一个匹配）
```

### ADD — 增强复制（自动解压）

```dockerfile
ADD archive.tar.gz /app/   # 自动解压到目标目录
# ⚠️ 优先用 COPY，只在需要解压时用 ADD
```

### RUN — 执行命令

```dockerfile
# Shell 形式
RUN apt-get update && apt-get install -y curl

# Exec 形式
RUN ["apt-get", "update"]

# 合并多层减小镜像
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

### CMD vs ENTRYPOINT

```dockerfile
# CMD：默认命令，docker run 后面加参数可覆盖
CMD ["java", "-jar", "app.jar"]

# ENTRYPOINT：固定入口，docker run 参数会追加在后面
ENTRYPOINT ["java", "-jar", "app.jar"]

# 组合（推荐）：固定入口 + 可覆盖的默认参数
ENTRYPOINT ["java", "-jar", "app.jar"]
CMD ["--spring.profiles.active=default"]

# docker run myapp                           → default
# docker run myapp --server.port=9090        → --server.port=9090
```

### ENV vs ARG

```dockerfile
# ENV：运行时环境变量
ENV JAVA_HOME=/usr/lib/jvm/java-17
ENV APP_PORT=8080

# ARG：构建时参数
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} /app/app.jar
# docker build --build-arg JAR_FILE=target/myapp.jar .
```

### HEALTHCHECK — 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1
```

## Spring Boot 多阶段 Dockerfile

```dockerfile
# ========== 构建阶段 ==========
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -q

# ========== 运行阶段 ==========
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /build/target/*.jar app.jar
RUN chown -R app:app /app
USER app

EXPOSE 8080
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
```

## .dockerignore

```text
target/
*.log
.git/
.gitignore
.idea/
*.iml
node_modules/
Dockerfile
docker-compose.yml
```

## 最佳实践

1. **使用精确版本标签**：`FROM openjdk:17-jdk-slim` 而非 `FROM openjdk`
2. **多阶段构建**：构建和运行分离，最终镜像只含 JRE
3. **先复制依赖再复制源码**：利用 Docker 层缓存
4. **合并 RUN 命令**：减少镜像层数
5. **不以 root 运行**：`USER app`
6. **使用 .dockerignore**：减小构建上下文
7. **清理临时文件**：`rm -rf /var/lib/apt/lists/*`
