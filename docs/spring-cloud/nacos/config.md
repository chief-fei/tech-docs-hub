# Nacos 配置中心详解

> 适用版本：Spring Boot 2.7.x + Spring Cloud 2021.0.x + Spring Cloud Alibaba 2021.0.x

## 一、Docker 部署 Nacos Server

### 单机模式（开发/测试环境）

```bash
docker run -d \
  --name nacos \
  -e MODE=standalone \
  -e NACOS_AUTH_ENABLE=true \
  -e NACOS_AUTH_TOKEN=SecretKey012345678901234567890123456789012345678901234567890123456789 \
  -e NACOS_AUTH_IDENTITY_KEY=serverIdentity \
  -e NACOS_AUTH_IDENTITY_VALUE=security \
  -p 8848:8848 \
  -p 9848:9848 \
  nacos/nacos-server:v2.3.2
```

::: warning 端口说明
- `8848`：HTTP 主端口（控制台 + 配置 API）
- `9848`：gRPC 端口（客户端长连接，**必须暴露**，否则配置推送和监听失效）
- `9849`：gRPC 集群通信端口（单机可不暴露）
:::

::: danger 常见坑点
从 Nacos 2.x 开始，客户端通过 gRPC（9848 端口）与服务端通信。如果 Docker 只映射了 8848 而没映射 9848，会导致：
- 配置获取超时
- 服务注册成功但配置拉不到
- `NacosException: Client not connected` 错误
:::

### Docker Compose 方式

```yaml
# docker-compose.yml
version: '3.8'
services:
  nacos:
    image: nacos/nacos-server:v2.3.2
    container_name: nacos
    environment:
      - MODE=standalone
      - NACOS_AUTH_ENABLE=true
      - NACOS_AUTH_TOKEN=SecretKey012345678901234567890123456789012345678901234567890123456789
      - NACOS_AUTH_IDENTITY_KEY=serverIdentity
      - NACOS_AUTH_IDENTITY_VALUE=security
      - JVM_XMS=256m
      - JVM_XMX=256m
      - JVM_XMN=128m
    ports:
      - "8848:8848"
      - "9848:9848"
    volumes:
      - nacos-logs:/home/nacos/logs
    restart: unless-stopped

volumes:
  nacos-logs:
```

```bash
docker-compose up -d
```

### 验证 Nacos 是否正常

```bash
# 访问控制台
open http://localhost:8848/nacos
# 默认账号密码：nacos / nacos

# API 验证
curl http://localhost:8848/nacos/v1/console/health/readiness
```

---

## 二、版本对应关系

Spring Boot 2.7.x 对应的版本矩阵：

| 组件 | 版本 |
|------|------|
| Spring Boot | 2.7.x |
| Spring Cloud | 2021.0.x |
| Spring Cloud Alibaba | 2021.0.x |
| Nacos Server | 2.x（推荐 2.3.x） |

::: danger 版本不匹配是配置获取失败的头号原因
Spring Cloud Alibaba 版本必须与 Spring Boot 版本匹配，否则自动配置类不会生效，配置静默拉取失败。
:::

---

## 三、Maven 依赖（完整）

### 父 POM 依赖管理

```xml
<properties>
    <spring-boot.version>2.7.18</spring-boot.version>
    <spring-cloud.version>2021.0.9</spring-cloud.version>
    <spring-cloud-alibaba.version>2021.0.6.0</spring-cloud-alibaba.version>
</properties>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>${spring-boot.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>${spring-cloud.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>${spring-cloud-alibaba.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### 子模块依赖

```xml
<dependencies>
    <!-- Nacos 配置中心 -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
    </dependency>

    <!-- Nacos 服务发现（可选，按需） -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>

    <!-- Bootstrap 上下文支持（Spring Boot 2.4+ 必须显式引入） -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-bootstrap</artifactId>
    </dependency>

    <!-- Web（示例用） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>
```

::: warning spring-cloud-starter-bootstrap 是关键
Spring Boot 2.4 之后默认不再加载 `bootstrap.yml`。如果不引入 `spring-cloud-starter-bootstrap`，`bootstrap.yml` 中的 Nacos 配置不会生效，导致应用启动时无法连接配置中心。

这是 **Spring Boot 2.7.x 获取不到 Nacos 配置最常见的原因之一**。
:::

---

## 四、配置文件编写

### 方式一：bootstrap.yml（推荐，传统方式）

**Spring Boot 2.7.x 下推荐使用此方式。**

```yaml
# src/main/resources/bootstrap.yml
spring:
  application:
    name: order-service
  profiles:
    active: dev
  cloud:
    nacos:
      # Nacos 服务端地址
      server-addr: 127.0.0.1:8848
      # 认证信息（Nacos 开启鉴权时必须配置）
      username: nacos
      password: nacos
      # ---- 配置中心 ----
      config:
        # 配置文件格式
        file-extension: yaml
        # 命名空间 ID（注意：是 ID，不是名称）
        namespace: public
        # 分组
        group: DEFAULT_GROUP
        # 是否开启配置刷新
        refresh-enabled: true
        # 共享配置（多个服务共用的配置）
        shared-configs:
          - data-id: common.yaml
            group: DEFAULT_GROUP
            refresh: true
        # 扩展配置（优先级高于主配置）
        extension-configs:
          - data-id: db.yaml
            group: DATABASE_GROUP
            refresh: true
```

```yaml
# src/main/resources/bootstrap-dev.yml
spring:
  cloud:
    nacos:
      config:
        # dev 环境的命名空间 ID（从 Nacos 控制台复制）
        namespace: e5a3b1c0-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 方式二：application.yml（Spring Boot 2.4+ 新方式）

不依赖 `bootstrap`，直接在 `application.yml` 中使用 `spring.config.import`：

```yaml
# src/main/resources/application.yml
spring:
  application:
    name: order-service
  cloud:
    nacos:
      server-addr: 127.0.0.1:8848
      username: nacos
      password: nacos
      config:
        namespace: public
        group: DEFAULT_GROUP
  config:
    import:
      - nacos:order-service.yaml?refreshEnabled=true&group=DEFAULT_GROUP
      - nacos:common.yaml?refreshEnabled=true&group=DEFAULT_GROUP
```

::: tip 两种方式的对比
| 特性 | bootstrap.yml | application.yml + import |
|------|:---:|:---:|
| 需要额外依赖 | 需要 `spring-cloud-starter-bootstrap` | 不需要 |
| 配置优先级 | 高于 application.yml | 等于 application.yml |
| 多 profile 支持 | 天然支持 bootstrap-dev.yml | 需要 `import` 中拼接 profile |
| Spring Boot 2.7.x 推荐 | **推荐** | 可用 |
| Spring Boot 3.x 推荐 | 不推荐 | **推荐** |
:::

---

## 五、Nacos 控制台配置

### 创建配置

登录 Nacos 控制台 `http://localhost:8848/nacos`：

1. 进入 **配置管理 → 配置列表**
2. 选择对应的 **命名空间**（dev / test / prod）
3. 点击 **+** 号创建配置

**Data ID 命名规则：**

```text
${spring.application.name}-${spring.profiles.active}.${file-extension}
```

例如 `spring.application.name=order-service`，`spring.profiles.active=dev`，`file-extension=yaml`：

| 配置项 | 值 |
|------|------|
| Data ID | `order-service-dev.yaml` |
| Group | `DEFAULT_GROUP` |
| 配置格式 | YAML |

**配置内容示例：**

```yaml
# Nacos 控制台中的 order-service-dev.yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/order_db?useSSL=false&characterEncoding=utf8
    username: root
    password: your-password
    driver-class-name: com.mysql.cj.jdbc.Driver

# 自定义配置
app:
  name: 订单服务
  version: 1.0.0
  features:
    - order-create
    - order-query
```

---

## 六、配置读取方式

### @Value 注入

```java
@RestController
@RefreshScope  // 支持 Nacos 动态刷新
public class ConfigDemoController {

    @Value("${app.name:默认应用名}")
    private String appName;

    @Value("${app.version:unknown}")
    private String appVersion;

    @GetMapping("/config")
    public Map<String, String> getConfig() {
        Map<String, String> map = new HashMap<>();
        map.put("appName", appName);
        map.put("appVersion", appVersion);
        return map;
    }
}
```

### @ConfigurationProperties 绑定

```java
@Data
@Component
@ConfigurationProperties(prefix = "app")
@RefreshScope
public class AppProperties {
    private String name;
    private String version;
    private List<String> features;
}
```

```java
@RestController
@RequiredArgsConstructor
public class AppConfigController {

    private final AppProperties appProperties;

    @GetMapping("/app-info")
    public AppProperties getAppInfo() {
        return appProperties;
    }
}
```

### @NacosValue 注解（可选）

```java
@RestController
public class NacosValueController {

    @NacosValue(value = "${app.name:默认}", autoRefreshed = true)
    private String appName;

    @GetMapping("/nacos-value")
    public String get() {
        return appName;
    }
}
```

---

## 七、配置优先级（从高到低）

```text
1. extension-configs（扩展配置，序号越大优先级越高）
2. shared-configs（共享配置，序号越大优先级越高）
3. ${spring.application.name}-${spring.profiles.active}.${file-extension}
4. ${spring.application.name}.${file-extension}
5. 本地 application.yml / application-dev.yml
```

---

## 八、动态刷新（@RefreshScope）

在 Nacos 控制台修改配置并发布后，使用 `@RefreshScope` 标注的 Bean 会自动刷新：

```java
@RefreshScope
@RestController
public class DynamicConfigController {

    @Value("${app.greeting:Hello}")
    private String greeting;

    @GetMapping("/greeting")
    public String get() {
        return greeting + " " + LocalDateTime.now();
    }
}
```

::: tip 验证动态刷新
1. 修改 Nacos 中的 `app.greeting` 值并发布
2. 再次调用 `/greeting` 接口
3. 观察返回值是否变化
:::

---

## 九、配置获取失败排查清单

以下是 Docker 部署 Nacos 后，Spring Boot 应用获取不到配置的常见原因和排查步骤：

### 1. 检查端口映射

```bash
# 确认 8848 和 9848 都已映射
docker port nacos
# 期望输出：
# 8848/tcp -> 0.0.0.0:8848
# 9848/tcp -> 0.0.0.0:9848
```

**如果缺少 9848 映射，配置推送和长连接监听全部失效。**

### 2. 检查网络连通性

```bash
# 从应用所在机器访问 Nacos
curl http://127.0.0.1:8848/nacos/v1/console/health/readiness

# 检查 gRPC 端口
telnet 127.0.0.1 9848
```

::: danger Docker 网络注意
如果应用也在 Docker 中运行，`server-addr` 不能写 `127.0.0.1`，需要使用 Docker 网络中的容器名或宿主机 IP：
```yaml
spring:
  cloud:
    nacos:
      server-addr: nacos:8848  # Docker Compose 中使用服务名
```
:::

### 3. 检查 namespace 是否为 ID

```yaml
spring:
  cloud:
    nacos:
      config:
        # 错误：使用了命名空间名称
        namespace: dev
        # 正确：使用命名空间 ID（从 Nacos 控制台 → 命名空间 页面复制）
        namespace: e5a3b1c0-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

::: warning namespace 必须用 ID
`namespace` 的值必须是 Nacos 控制台 **命名空间** 页面中显示的 **命名空间 ID**（UUID 格式），而不是命名空间名称。`public` 是唯一的例外，可以直接写 `public` 或留空。
:::

### 4. 检查 Data ID 是否匹配

启动日志中查找实际请求的 Data ID：

```text
# 启动日志中搜索这行
[fixed-DEFAULT_GROUP] data received, dataId=order-service-dev.yaml, group=DEFAULT_GROUP
```

确保 Nacos 控制台中存在的 Data ID 与应用自动拼接的完全一致：

```text
Data ID = ${spring.application.name}[-${spring.profiles.active}].${file-extension}
```

| 场景 | Data ID |
|------|------|
| name=order-service, profile=dev, ext=yaml | `order-service-dev.yaml` |
| name=order-service, 无 profile, ext=yaml | `order-service.yaml` |
| name=order-service, profile=dev, ext=properties | `order-service-dev.properties` |

### 5. 检查鉴权配置

如果 Nacos 开启了鉴权（`NACOS_AUTH_ENABLE=true`），客户端必须配置用户名密码：

```yaml
spring:
  cloud:
    nacos:
      username: nacos
      password: nacos
```

::: danger 鉴权不配置的表现
配置中心返回 403，但 Spring Boot 可能静默回退到本地配置，不报错，导致看起来"配置没拉到"。
:::

### 6. 检查 bootstrap 是否生效

在 `application.yml` 或启动日志中确认：

```text
# 如果看到以下日志，说明 bootstrap 已加载
Located property source: CompositePropertySource {name='NACOS', propertySources=[...]}
```

如果完全看不到 Nacos 相关日志，说明 `bootstrap.yml` 没有被加载：
- 确认引入了 `spring-cloud-starter-bootstrap` 依赖
- 确认配置文件名是 `bootstrap.yml`（不是 `bootstrap.yaml`，两者都可以，但不要拼错）

### 7. 开启调试日志

```yaml
# application.yml 或 bootstrap.yml 中添加
logging:
  level:
    com.alibaba.nacos: DEBUG
    org.springframework.cloud.nacos: DEBUG
```

通过日志可以看到完整的配置拉取过程、请求参数和响应结果。

---

## 十、完整可运行示例

### 项目结构

```text
order-service/
├── pom.xml
└── src/main/
    ├── java/com/example/order/
    │   ├── OrderApplication.java
    │   └── controller/
    │       └── ConfigController.java
    └── resources/
        ├── bootstrap.yml
        └── application.yml
```

### pom.xml（关键部分）

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>

<properties>
    <spring-cloud.version>2021.0.9</spring-cloud.version>
    <spring-cloud-alibaba.version>2021.0.6.0</spring-cloud-alibaba.version>
</properties>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>${spring-cloud.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>${spring-cloud-alibaba.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-bootstrap</artifactId>
    </dependency>
</dependencies>
```

### bootstrap.yml

```yaml
spring:
  application:
    name: order-service
  profiles:
    active: dev
  cloud:
    nacos:
      server-addr: 127.0.0.1:8848
      username: nacos
      password: nacos
      config:
        file-extension: yaml
        namespace: public
        group: DEFAULT_GROUP
```

### application.yml

```yaml
server:
  port: 8080

logging:
  level:
    com.alibaba.nacos: DEBUG
```

### OrderApplication.java

```java
@SpringBootApplication
public class OrderApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderApplication.class, args);
    }
}
```

### ConfigController.java

```java
@RestController
@RefreshScope
public class ConfigController {

    @Value("${app.name:未获取到配置}")
    private String appName;

    @GetMapping("/config/app-name")
    public String getAppName() {
        return appName;
    }
}
```

### Nacos 控制台操作

1. 创建配置：Data ID = `order-service-dev.yaml`，Group = `DEFAULT_GROUP`
2. 配置内容：

```yaml
app:
  name: 订单服务-v1.0
```

3. 发布配置
4. 启动应用，访问 `http://localhost:8080/config/app-name`
5. 期望返回：`订单服务-v1.0`
