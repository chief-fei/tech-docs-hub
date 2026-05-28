# Spring Boot 容器化

将 Spring Boot 项目打包为 Docker 镜像部署。

## 推荐多阶段 Dockerfile

```dockerfile
# ==================== 构建阶段 ====================
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -q

# ==================== 运行阶段 ====================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /build/target/*.jar app.jar
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
```

## Maven 插件构建（无需 Dockerfile）

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <image>
            <name>${project.artifactId}:${project.version}</name>
        </image>
    </configuration>
</plugin>
```

```bash
./mvnw spring-boot:build-image
docker run -p 8080:8080 myapp:1.0.0
```

## Docker Compose 部署

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
      - JAVA_OPTS=-Xms256m -Xmx512m
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
```

## 构建部署流程

```bash
# 1. 编译打包
./mvnw clean package -DskipTests

# 2. 构建镜像
docker build -t myapp:1.0 .

# 3. 本地验证
docker run -d -p 8080:8080 --name myapp-test myapp:1.0
curl http://localhost:8080/actuator/health
docker rm -f myapp-test

# 4. 推送仓库
docker tag myapp:1.0 registry.example.com/myapp:1.0
docker push registry.example.com/myapp:1.0

# 5. 服务器部署
ssh server "docker pull registry.example.com/myapp:1.0 && cd /app && docker compose up -d"
```

## 常见问题

### 时区设置

```dockerfile
# Alpine
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

# Debian/Ubuntu
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
```

### 日志输出到控制台

```yaml
# application.yml
logging:
  file:
    enabled: false
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
```

### 优雅关闭

```yaml
# application.yml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

### JVM 内存调优

```bash
# 限制容器内存 512M，JVM 自动适配
docker run -m 512m myapp:1.0

# 或指定 JVM 参数
docker run -e JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0" myapp:1.0
```
