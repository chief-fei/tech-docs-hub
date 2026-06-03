# Spring Cloud Gateway 使用指南

Spring Cloud Gateway 是 Spring Cloud 官方推出的第二代 API 网关，基于 **Spring WebFlux**（Reactor + Netty）构建，异步非阻塞，性能远超第一代网关 Zuul。

> 适用版本：Spring Cloud Gateway 3.1.x（Spring Cloud 2021.0.x + Spring Boot 2.7.x）

## 一、什么是 API 网关？

### 网关在微服务中的角色

在微服务架构中，API 网关是所有客户端请求的**统一入口**。它不是某个具体业务功能的实现者，而是一层"大门"——把所有的外部请求集中到一个地方处理，再转发到相应的后端服务。

```text
客户端（浏览器 / App）
        │
        ▼
 ┌──────────────┐
 │  API Gateway │  ← 统一入口：认证、路由、限流、日志
 └──────┬───────┘
        │ 路由转发
  ┌─────┼─────┐
  ▼     ▼     ▼
┌────┐┌────┐┌────┐
│用户││订单││商品│  ← 微服务
└────┘└────┘└────┘
```

网关承担的核心职责：

| 职责 | 说明 |
|------|------|
| **路由转发** | 根据请求路径、Header 等将请求转发到对应的微服务 |
| **负载均衡** | 结合 LoadBalancer 将流量均匀分发到多个实例 |
| **身份认证** | 在网关层统一校验 Token/JWT，避免每个微服务各自认证 |
| **限流熔断** | 控制流量速率，防止瞬时高并发打垮后端服务 |
| **日志监控** | 统一记录请求日志、耗时、状态码，方便排查问题 |
| **跨域处理** | 统一配置 CORS，避免每个服务各自处理跨域 |
| **协议转换** | 对外暴露 HTTP/HTTPS，内部可能走 gRPC 或其他协议 |

### Gateway vs Zuul

Spring Cloud Gateway 是 Zuul 的替代方案，两者对比：

| 对比维度 | Spring Cloud Gateway | Zuul 1.x |
|---------|---------------------|----------|
| 底层框架 | Spring WebFlux（Reactor + Netty） | Servlet 2.5（阻塞 IO） |
| IO 模型 | 异步非阻塞 | 同步阻塞 |
| 性能 | 高吞吐、低资源占用 | 连接数较多时性能急剧下降 |
| 长连接支持 | 原生支持（WebSocket 等） | 需要额外配置 |
| 限流 | 内置 RequestRateLimiter | 需自行实现 |
| 动态路由 | 配合 Nacos 等自刷新 | 需配合 Archaius |
| Spring Boot 2.7.x | 原生支持，当前推荐 | 已停止维护 |

> Zuul 1.x 基于 Servlet 2.5，使用阻塞 IO。每个请求占用一个线程，线程池耗尽后后续请求会被阻塞。Gateway 基于 Reactor 的异步非阻塞模型，少量线程即可处理大量并发连接，两者性能差距可达数倍。

---

## 二、核心概念

Spring Cloud Gateway 的工作机制可以用一句话概括：**请求到达 Gateway → 匹配路由（Route）→ 执行断言（Predicate）→ 经过过滤器链（Filter Chain）→ 转发到后端服务**。

```text
请求 → Gateway → Route 匹配 → Predicate 断言 → Filter 链 → 后端服务
                      │               │              │
                      │ - id         │ - Path       │ - AddRequestHeader
                      │ - uri        │ - Header     │ - StripPrefix
                      │ - predicates │ - Method     │ - RateLimiter
                      │ - filters    │ - ...        │ - ...
```

### Route（路由）

路由是网关的基本构造块。每条路由包含四要素：

| 要素 | 说明 | 示例 |
|------|------|------|
| `id` | 路由唯一标识 | `user-service-route` |
| `uri` | 目标服务地址 | `lb://user-service` |
| `predicates` | 匹配规则（可多个，全部满足才匹配） | `Path=/api/user/**` |
| `filters` | 对请求/响应的处理操作 | `StripPrefix=1` |

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service-route          # 路由 ID
          uri: lb://user-service          # 目标：走负载均衡
          predicates:
            - Path=/api/user/**           # 匹配 /api/user/** 的请求
          filters:
            - StripPrefix=1               # 去掉第一段路径（/api）
```

以上配置的含义：当请求路径以 `/api/user/` 开头时，去掉第一段 `/api`，然后将剩余路径转发到 `user-service`。

例如：`GET /api/user/profile` → 断言匹配 → StripPrefix=1 去掉 `/api` → 转发到 `lb://user-service/user/profile`

### Predicate（断言）

Predicate 源自 Java 8 的 `java.util.function.Predicate`，即"如果满足条件，则返回 true"。在 Gateway 中，只有当所有断言都返回 true 时，请求才会被路由到对应的 `uri`。

一条路由可以配置**多个断言**，它们之间是**AND**关系，全部满足才会匹配。

### Filter（过滤器）

Filter 可以对请求（进入后端服务前）和响应（返回客户端前）进行修改。Gateway 提供了两套过滤器：

| 类型 | 接口 | 作用范围 |
|------|------|---------|
| **GatewayFilter** | 路由级过滤器 | 作用在特定路由上，通过 `filters` 配置 |
| **GlobalFilter** | 全局过滤器 | 对所有路由生效，不需要显式配置 |

---

## 三、快速开始

### 3.1 创建网关模块

```text
gateway-service/
├── pom.xml
└── src/main/
    ├── java/com/example/gateway/
    │   └── GatewayApplication.java
    └── resources/
        ├── bootstrap.yml
        └── application.yml
```

### 3.2 Maven 依赖

```xml
<!-- pom.xml -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>

<properties>
    <spring-cloud.version>2021.0.9</spring-cloud.version>
    <spring-cloud-alibaba.version>2021.0.5.0</spring-cloud-alibaba.version>
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
    <!-- Spring Cloud Gateway 核心依赖 -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-gateway</artifactId>
    </dependency>

    <!-- Nacos 注册中心 + 配置中心 -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
    </dependency>

    <!-- Bootstrap 上下文支持（Spring Boot 2.4+ 必须显式引入） -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-bootstrap</artifactId>
    </dependency>

    <!-- Spring Cloud LoadBalancer -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-loadbalancer</artifactId>
    </dependency>
</dependencies>
```

::: warning Gateway 与 spring-boot-starter-web 不能共存
Spring Cloud Gateway 基于 **WebFlux**，而 `spring-boot-starter-web` 基于 Servlet 容器。两者同时引入会导致冲突，启动报错。如果模块中已有 `spring-boot-starter-web`，必须移除。
:::

### 3.3 配置文件

```yaml
# bootstrap.yml
spring:
  application:
    name: gateway-service
  cloud:
    nacos:
      server-addr: 127.0.0.1:8848
      username: nacos
      password: nacos
      discovery:
        namespace: public
        group: DEFAULT_GROUP
```

```yaml
# application.yml
server:
  port: 9000

spring:
  cloud:
    gateway:
      routes:
        - id: user-service-route
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1

        - id: order-service-route
          uri: lb://order-service
          predicates:
            - Path=/api/order/**
          filters:
            - StripPrefix=1
```

### 3.4 启动类

```java
@SpringBootApplication
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
```

::: tip 不需要 @EnableDiscoveryClient
Spring Cloud 2021.0.x 之后，只要在 classpath 中存在注册中心依赖，就会自动注册。不需要在启动类上添加 `@EnableDiscoveryClient` 注解。
:::

### 3.5 验证

1. 确保 Nacos 已启动（`http://localhost:8848/nacos`）
2. 确保 `user-service` 已注册到 Nacos
3. 启动网关，访问 `http://localhost:9000/api/user/profile`

如果 `user-service` 暴露了 `/user/profile` 接口，请求会经过网关转发到 `http://user-service/user/profile`。

---

## 四、路由配置方式

Gateway 支持两种路由配置方式：**YAML 配置文件**和 **Java DSL（RouteLocator Bean）**。

### 4.1 YAML 配置（推荐）

适合大多数场景，配置清晰直观，支持热更新（配合 Nacos）。

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service-route
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1

        - id: order-service-route
          uri: lb://order-service
          predicates:
            - Path=/api/order/**
          filters:
            - StripPrefix=1
```

### 4.2 Java DSL（RouteLocator Bean）

适合**按环境条件动态构造路由**的场景（比如根据配置文件决定是否启用某条路由）。

```java
@Configuration
public class GatewayRouteConfig {

    @Bean
    public RouteLocator customRoutes(RouteLocatorBuilder builder) {
        return builder.routes()
            .route("user-service-route", r -> r
                .path("/api/user/**")
                .filters(f -> f.stripPrefix(1))
                .uri("lb://user-service"))
            .route("order-service-route", r -> r
                .path("/api/order/**")
                .filters(f -> f.stripPrefix(1))
                .uri("lb://order-service"))
            .build();
    }
}
```

::: tip 两种方式对比

| 特性 | YAML 配置 | Java DSL |
|------|----------|----------|
| 可读性 | 结构清晰，一目了然 | 需要阅读代码 |
| 热更新 | 配合 Nacos 支持动态刷新 | 需要重启 |
| 条件逻辑 | 不支持 | 支持 if/else 等条件判断 |
| 生产推荐 | **推荐** | 少量特殊场景使用 |
| 配置与代码分离 | 是 | 否 |

:::

---

## 五、路由断言工厂（Predicate Factories）

断言决定"什么样的请求会被匹配到这条路由"。Gateway 内置了十几种断言工厂，每条路由可以组合多个断言——**全部满足才算匹配**。

### 5.1 Path —— 路径匹配

最常用的断言，按请求路径匹配。

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/user/**        # 匹配 /api/user/ 下所有路径
```

多条路径用逗号分隔：

```yaml
predicates:
  - Path=/api/user/**, /api/member/**  # 同时匹配两个路径前缀
```

| 通配符 | 说明 |
|--------|------|
| `*` | 匹配当前层级任意内容（不含 `/`） |
| `**` | 匹配任意层级任意内容 |

::: tip Path 断言是 Ant 风格的模糊匹配，大小写敏感。例如 `/API/User` 不会匹配 `/api/user/**`。

:::

### 5.2 After / Before / Between —— 时间控制

用于**按时间段控制路由是否生效**，在定时切换、灰度发布中很实用。

```yaml
predicates:
  # 在指定时间之后生效
  - After=2025-06-01T00:00:00+08:00[Asia/Shanghai]
```

```yaml
predicates:
  # 在指定时间之前生效
  - Before=2025-12-31T23:59:59+08:00[Asia/Shanghai]
```

```yaml
predicates:
  # 在指定时间段内生效
  - Between=2025-06-01T00:00:00+08:00[Asia/Shanghai], 2025-06-30T23:59:59+08:00[Asia/Shanghai]
```

::: tip 时间断言中用到了 Java 的 `ZonedDateTime` 格式。可以通过代码快速生成时间字符串：

```java
ZonedDateTime now = ZonedDateTime.now();
System.out.println(now);  // 输出可直接复制使用
```

:::

### 5.3 Header —— 请求头匹配

根据请求中是否包含指定 Header 及其值来匹配。

```yaml
predicates:
  # Header "X-Request-Id" 的值匹配正则 \d+（纯数字）
  - Header=X-Request-Id, \d+

  # Header "X-Source" 的值等于 "mobile"
  - Header=X-Source, mobile
```

```text
# 匹配：Header 中 X-Source: mobile
# 匹配：Header 中 X-Request-Id: 12345
# 不匹配：请求头没有 X-Source
# 不匹配：X-Request-Id 值为 "abc"
```

### 5.4 Cookie —— Cookie 匹配

根据请求携带的 Cookie 名称和值（正则）匹配。

```yaml
predicates:
  # Cookie "token" 的值匹配正则 .+（至少一个字符，即"存在"）
  - Cookie=token, .+

  # Cookie "lang" 的值等于 "zh-CN"
  - Cookie=lang, zh-CN
```

### 5.5 Query —— 查询参数匹配

根据 URL 查询参数名和值匹配。

```yaml
predicates:
  # 包含名为 "version" 的查询参数，值可以是任意内容
  - Query=version

  # 包含 "version" 且值为 "v2"
  - Query=version, v2

  # 包含 "price" 且值为纯数字
  - Query=price, \d+
```

```text
# 匹配：/api/items?version=v2
# 匹配：/api/items?version=v2&price=100
# 不匹配：/api/items（没有 version 参数）
# 不匹配：/api/items?version=v1（值不匹配）
```

### 5.6 Method —— 请求方法匹配

限制匹配的 HTTP 方法。

```yaml
predicates:
  # 只匹配 GET 请求
  - Method=GET

  # 匹配 GET 或 POST
  - Method=GET,POST
```

### 5.7 RemoteAddr —— 来源 IP 匹配

根据客户端 IP 匹配。

```yaml
predicates:
  # 只允许 192.168 网段访问
  - RemoteAddr=192.168.0.1/16

  # 允许多个 IP 段
  - RemoteAddr=192.168.0.1/16, 10.0.0.1/8
```

::: warning RemoteAddr 的实际值取决于网络环境。如果前面有 Nginx 反向代理，获取到的 IP 是 Nginx 的 IP，需要配合 `X-Forwarded-For` 使用自定义的 `RemoteAddrRoutePredicateFactory`。

:::

### 5.8 Weight —— 权重路由（灰度/金丝雀发布）

按权重比例将流量分发到不同目标服务，是实现**金丝雀发布**和**蓝绿部署**的基础。

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 稳定版：承载 80% 流量
        - id: user-service-stable
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
            - Weight=user-group, 8      # 权重 8 → 80%

        # 灰度版：承载 20% 流量
        - id: user-service-canary
          uri: lb://user-service-canary
          predicates:
            - Path=/api/user/**
            - Weight=user-group, 2      # 权重 2 → 20%
```

核心规则：

| 要点 | 说明 |
|------|------|
| `group` | 权重分组名（同一组内的路由互相按权重分配） |
| `weight` | 权重值（最终占比 = 当前权重 ÷ 同组权重之和） |
| 路径 | 同组中的路由 `Path` 断言要完全一致 |

::: tip 灰度发布工作流
1. 部署 `user-service`（稳定版）和 `user-service-canary`（灰度版）到 Nacos
2. 配置权重 9:1，先释放 10% 流量到灰度版
3. 观察灰度版的错误率和响应时间
4. 逐步调整权重：9:1 → 5:5 → 1:9 → 关闭稳定版
5. 灰度版转为正式版
:::

### 5.9 Host —— 主机名匹配

```yaml
predicates:
  # 匹配 myapp.example.com 或其子域
  - Host=**.myapp.example.com

  # 精确匹配多个域名
  - Host=api.example.com, api2.example.com
```

---

## 六、网关过滤器工厂（GatewayFilter Factories）

过滤器对请求和响应进行修改。与断言不同，过滤器是**操作型**的——它可以添加/修改请求头、重写路径、限流、熔断等。

### 6.1 AddRequestHeader —— 添加请求头

在转发给后端服务之前，添加一个请求头。

```yaml
filters:
  # 添加 X-Request-From: gateway
  - AddRequestHeader=X-Request-From, gateway
```

后端服务可通过 `@RequestHeader` 获取：

```java
@GetMapping("/info")
public String info(@RequestHeader(value = "X-Request-From", required = false) String from) {
    return "来自: " + from;  // 输出：来自: gateway
}
```

### 6.2 AddRequestParameter —— 添加请求参数

在转发之前，向查询参数中添加键值对。

```yaml
filters:
  # 添加 ?source=gateway
  - AddRequestParameter=source, gateway
```

### 6.3 AddResponseHeader —— 添加响应头

在返回给客户端之前，添加一个响应头。

```yaml
filters:
  - AddResponseHeader=X-Gateway-Version, 3.1.5
```

### 6.4 RemoveRequestHeader / RemoveResponseHeader —— 移除请求/响应头

```yaml
filters:
  # 移除敏感请求头（避免内部信息泄露给后端服务）
  - RemoveRequestHeader=Cookie
  - RemoveRequestHeader=X-Internal-Token

  # 移除响应头
  - RemoveResponseHeader=X-Powered-By
```

### 6.5 路径重写系列

路径重写是网关最常用的操作之一。客户端请求的路径通常带了统一的 `api` 前缀或者其他修饰，但后端服务不需要这些前缀。

#### StripPrefix —— 去掉路径前缀

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1      # 去掉第 1 段路径
```

```text
客户端请求:        /api/user/profile    →    StripPrefix=1
去掉第 1 段 /api:  /user/profile       →    转发给后端
```

`StripPrefix` 的值表示**去掉的段数**：

```yaml
# StripPrefix=2
# /gateway/api/user/profile → /user/profile（去掉前面两段）
```

#### PrefixPath —— 添加路径前缀

与 StripPrefix 相反——在转发之前给路径添加前缀。

```yaml
filters:
  - PrefixPath=/api
```

```text
客户端请求:        /user/profile
添加前缀 /api:     /api/user/profile    →    转发给后端
```

#### SetPath —— 完全重写路径

通过模板表达式完全重写路径，最灵活的方式。

```yaml
filters:
  # 将 /api/user/{segment} 重写为 /user/{segment}
  - SetPath=/user/{segment}
```

```text
客户端请求:        /api/user/profile
SetPath 重写:      /user/profile        →    转发给后端
```

支持灵活的模板替换：

```yaml
# 将 /api/v1/user/123 重写为 /user/v1/123
filters:
  - SetPath=/user/{version}/{id}
predicates:
  - Path=/api/{version}/user/{id}
```

### 6.6 RedirectTo —— 重定向

返回 302 重定向响应，不转发到后端服务。

```yaml
filters:
  # 302 重定向到新地址
  - RedirectTo=302, https://new-site.example.com
```

```text
请求:         GET http://old-site.example.com/page
响应:         302 Found
Location:     https://new-site.example.com/page
```

### 6.7 SetStatus —— 设置响应状态码

直接返回指定状态码，不转发到后端。

```yaml
filters:
  # 返回 403 Forbidden
  - SetStatus=403
```

### 6.8 RequestRateLimiter —— 请求限流

结合 **Redis** 实现令牌桶算法限流，保护后端服务不被流量冲垮。

#### 添加依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>
```

::: warning 必须是 reactive 版本
Gateway 基于 WebFlux，Redis 依赖必须使用 **`spring-boot-starter-data-redis-reactive`**，不能使用普通的 `spring-boot-starter-data-redis`，否则会与 WebFlux 不兼容。
:::

#### 配置 Redis + KeyResolver

```yaml
spring:
  redis:
    host: 127.0.0.1
    port: 6379
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1
            - name: RequestRateLimiter
              args:
                redis-rate-limiter:
                  replenishRate: 10       # 每秒填充的令牌数
                  burstCapacity: 20       # 令牌桶总容量
```

#### KeyResolver 配置

KeyResolver 决定"按什么维度限流"。

```java
@Configuration
public class RateLimiterConfig {

    /**
     * 按 IP 限流：同一 IP 共享令牌
     */
    @Bean
    @Primary
    public KeyResolver ipKeyResolver() {
        return exchange -> {
            String ip = exchange.getRequest().getRemoteAddress()
                    .getAddress().getHostAddress();
            return Mono.just(ip);
        };
    }

    /**
     * 按路径限流：访问同一路径共享令牌
     */
    @Bean
    public KeyResolver pathKeyResolver() {
        return exchange -> Mono.just(
                exchange.getRequest().getURI().getPath());
    }

    /**
     * 按用户限流：结合认证信息
     */
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String user = exchange.getRequest()
                    .getQueryParams().getFirst("userId");
            return Mono.just(user == null ? "anonymous" : user);
        };
    }
}
```

参数详解：

| 参数 | 说明 | 建议值 |
|------|------|--------|
| `replenishRate` | 每秒向桶中放入的令牌数 | 根据后端能力设定 |
| `burstCapacity` | 令牌桶总容量（允许的瞬时峰值） | ≥ replenishRate |
| `requestedTokens` | 每次请求消耗的令牌数 | 默认 1 |

::: tip 令牌桶算法解释
- 桶里最多放 `burstCapacity` 个令牌
- 每秒往桶里加 `replenishRate` 个令牌（满了就不加了）
- 每个请求需要消耗 `requestedTokens` 个令牌才被放行
- 桶里令牌不够时返回 **HTTP 429 Too Many Requests**

举例：`replenishRate=10, burstCapacity=20`
- 匀速请求：每秒最多通过 10 个
- 突发请求：瞬时最多放行 20 个
- 超过后被限流
:::

### 6.9 CircuitBreaker —— 熔断

当后端服务出错率高或响应变慢时，熔断器会"熔断"该路由，直接返回降级响应，避免请求积压。

Spring Cloud Gateway 自带 `Spring Cloud CircuitBreaker` 抽象层，支持 Sentinel、Resilience4J 两种实现。以下使用 **Sentinel** 作为熔断器（与 Spring Cloud Alibaba 统一技术栈）。

#### 添加依赖

```xml
<!-- Sentinel 网关适配 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-alibaba-sentinel-gateway</artifactId>
</dependency>

<!-- CircuitBreaker 抽象层 -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-reactor-resilience4j</artifactId>
</dependency>
```

#### 路由级熔断配置

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1
            - name: CircuitBreaker
              args:
                name: userServiceCircuitBreaker
                fallbackUri: forward:/fallback/user
```

#### 降级处理接口

```java
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping("/user")
    public Mono<Map<String, Object>> userFallback() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("code", 503);
        result.put("message", "用户服务暂时不可用，请稍后重试");
        result.put("timestamp", System.currentTimeMillis());
        return Mono.just(result);
    }
}
```

### 6.10 Retry —— 重试

当后端服务临时不可用时（如网络抖动），自动重试。

```yaml
filters:
  - name: Retry
    args:
      retries: 3                        # 重试次数
      statuses: BAD_GATEWAY, SERVICE_UNAVAILABLE  # 遇到这些状态码才重试
      methods: GET                      # 只对 GET 请求重试（安全）
      backoff:
        firstBackoff: 100ms             # 第一次重试等 100ms
        maxBackoff: 2000ms              # 最大重试间隔 2s
        factor: 2                       # 每次间隔翻倍
        basedOnPreviousValue: true      # 基于上次间隔计算
```

::: warning 重试策略注意事项
- 对 POST/PUT/DELETE 请求重试需谨慎，可能造成重复提交（如重复创建订单）
- `retries` 值不宜过大，否则会延长请求响应时间
- 重试应配合熔断使用，避免不断重试已经挂掉的服务
:::

---

## 七、自定义全局过滤器

内置的过滤器可以覆盖大部分常规场景，但有些业务逻辑（如全局 Token 校验、请求日志）需要自定义过滤器。

实现 `GlobalFilter` 接口即可（对所有路由生效，无需在 YAML 中显式配置）。

### 7.1 示例：JWT 鉴权过滤器

```java
@Component
@Slf4j
public class AuthGlobalFilter implements GlobalFilter, Ordered {

    // 白名单路径（不需要鉴权）
    private static final List<String> WHITE_LIST = Arrays.asList(
            "/api/auth/login",
            "/api/auth/register",
            "/api/public/**"
    );

    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // 1. 白名单路径直接放行
        if (WHITE_LIST.stream().anyMatch(p -> pathMatcher.match(p, path))) {
            return chain.filter(exchange);
        }

        // 2. 获取 Token
        String token = exchange.getRequest().getHeaders()
                .getFirst(HttpHeaders.AUTHORIZATION);

        if (token == null || !token.startsWith("Bearer ")) {
            log.warn("请求缺少有效 Token: {}", path);
            return unauthorized(exchange, "Token 缺失或无效");
        }

        // 3. 解析 Token（伪代码）
        try {
            String tokenValue = token.substring(7);
            // Claims claims = jwtUtil.parseToken(tokenValue);
            // exchange.getRequest().mutate()
            //         .header("X-User-Id", claims.getUserId());
            log.debug("Token 验证通过");
        } catch (Exception e) {
            log.warn("Token 解析失败: {}", e.getMessage());
            return unauthorized(exchange, "Token 已过期或格式错误");
        }

        // 4. 放行
        return chain.filter(exchange);
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("code", 401);
        result.put("message", message);
        byte[] bytes = JSON.toJSONString(result).getBytes(StandardCharsets.UTF_8);

        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().add(HttpHeaders.CONTENT_TYPE,
                MediaType.APPLICATION_JSON_VALUE);

        DataBuffer buffer = response.bufferFactory().wrap(bytes);
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        // 数值越小优先级越高，NettyWriteResponseFilter 之前执行
        return -100;
    }
}
```

### 7.2 示例：请求日志过滤器

```java
@Component
@Slf4j
public class RequestLogGlobalFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        long startTime = System.currentTimeMillis();

        log.info(">> {} {}", request.getMethod(), request.getURI());

        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            long cost = System.currentTimeMillis() - startTime;
            HttpStatus status = exchange.getResponse().getStatusCode();
            log.info("<< {} {} {} {}ms",
                    request.getMethod(), request.getURI(),
                    status != null ? status.value() : "null", cost);
        }));
    }

    @Override
    public int getOrder() {
        return -200;  // 最先执行，记录所有请求
    }
}
```

### 7.3 Filter 执行顺序

多个 GlobalFilter 的执行顺序由 `getOrder()` 决定，数字越小越先执行。

```java
getOrder() = -200  →  请求日志（最先执行）
getOrder() = -100  →  鉴权检查
getOrder() = 0     →  默认顺序（如 NettyWriteResponseFilter）
getOrder() = 100   →  其他
```

---

## 八、跨域配置（CORS）

在网关层统一配置 CORS，所有后端服务无需各自处理跨域问题。

### 8.1 YAML 配置方式

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            # 允许的来源（生产环境不要用 *）
            allowedOrigins:
              - "https://www.example.com"
              - "https://admin.example.com"
            # 允许的 HTTP 方法
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
            # 允许的请求头
            allowedHeaders:
              - "*"
            # 是否允许携带 Cookie
            allowCredentials: true
            # 预检请求缓存时间（秒）
            maxAge: 3600
```

### 8.2 Java 配置方式

```java
@Configuration
public class CorsConfig implements WebFilter {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();

        // OPTIONS 预检请求直接返回 200
        if (CorsUtils.isCorsRequest(request) &&
            request.getMethod() == HttpMethod.OPTIONS) {
            ServerHttpResponse response = exchange.getResponse();
            response.getHeaders().add("Access-Control-Allow-Origin", "*");
            response.getHeaders().add("Access-Control-Allow-Methods",
                    "GET, POST, PUT, DELETE, OPTIONS");
            response.getHeaders().add("Access-Control-Allow-Headers", "*");
            response.setStatusCode(HttpStatus.OK);
            return Mono.empty();
        }

        return chain.filter(exchange);
    }
}
```

::: warning CORS 配置注意事项
- `allowedOrigins` 和 `allowedOriginPatterns` 只能配置其一，不能同时使用
- 生产环境不要使用 `*`，应明确列出域名
- 如果使用了自定义 Token 的 Header（如 `X-Token`），需要在 `allowedHeaders` 中加上
:::

---

## 九、Nacos 动态路由

将路由配置从 YAML 迁移到 Nacos 配置中心，实现**不重启应用**即可修改路由规则。

### 9.1 核心思路

Gateway 通过监听 Nacos 的配置变更事件，实时更新路由表。Spring Cloud Alibaba 已经提供了自动刷新机制——只需将路由配置发布到 Nacos 即可。

### 9.2 配置文件改造

将路由配置移到 Nacos 中，YAML 中只保留基础配置。

```yaml
# application.yml —— 只保留基础配置
spring:
  application:
    name: gateway-service
  profiles:
    active: dev
  cloud:
    nacos:
      server-addr: 127.0.0.1:8848
      username: nacos
      password: nacos
      discovery:
        namespace: public
        group: DEFAULT_GROUP
      config:
        file-extension: yaml
        namespace: public
        group: DEFAULT_GROUP
        # 关键配置：启用动态路由
        extension-configs:
          - data-id: gateway-routes.yaml
            group: DEFAULT_GROUP
            refresh: true           # 开启自动刷新
```

在 Nacos 控制台中创建 `gateway-routes.yaml`，内容为纯路由定义：

```yaml
# Nacos 中的 gateway-routes.yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service-route
          uri: lb://user-service
          predicates:
            - Path=/api/user/**
          filters:
            - StripPrefix=1

        - id: order-service-route
          uri: lb://order-service
          predicates:
            - Path=/api/order/**
          filters:
            - StripPrefix=1
```

### 9.3 动态路由刷新原理

1. Gateway 启动时从 Nacos 拉取 `gateway-routes.yaml`
2. Nacos 客户端建立 gRPC 长连接监听配置变更
3. 在 Nacos 控制台修改 `gateway-routes.yaml` 并发布
4. Gateway 收到推送，自动重建路由表

::: tip 验证动态路由是否生效

1. 调整 Nacos 中某条路由的 `uri` 指向其他服务
2. 等待几秒（Nacos 配置推送通常 1-2 秒生效）
3. 调用对应接口，观察是否转发到新的后端服务
4. 查看日志中是否有 `Refresh routes` 相关日志
:::

### 9.4 高级：自定义动态路由监听器

如果内置的刷新机制不够灵活，可以自己监听并处理路由变更。

```java
@Component
@Slf4j
public class DynamicRouteService {

    @Autowired
    private RouteDefinitionWriter routeDefinitionWriter;

    /**
     * 动态添加路由
     */
    public void addRoute(RouteDefinition definition) {
        routeDefinitionWriter.save(Mono.just(definition)).subscribe();
        log.info("动态添加路由: {}", definition.getId());
    }

    /**
     * 动态删除路由
     */
    public void deleteRoute(String routeId) {
        routeDefinitionWriter.delete(Mono.just(routeId)).subscribe();
        log.info("动态删除路由: {}", routeId);
    }

    /**
     * 动态更新路由
     */
    public void updateRoute(RouteDefinition definition) {
        deleteRoute(definition.getId());
        addRoute(definition);
    }
}
```

::: danger 动态路由的注意事项
- 路由 ID 是唯一标识，增删改都以 ID 为准
- 动态路由和 YAML 中配置的路由**共存**，不是替换关系
- 删除 YAML 中的路由后，如果 Nacos 中有同 ID 的路由，它仍然生效
:::

---

## 十、Sentinel 网关限流

Spring Cloud Alibaba Sentinel 提供了专门的**网关限流**功能，比 `RequestRateLimiter` 更强大——支持 API 分组、热点参数限流、控制台实时管理。

### 10.1 添加依赖

```xml
<!-- Sentinel 核心 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>

<!-- Sentinel 网关适配器 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-alibaba-sentinel-gateway</artifactId>
</dependency>

<!-- Sentinel 控制台 -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-datasource-nacos</artifactId>
</dependency>
```

### 10.2 配置文件

```yaml
spring:
  cloud:
    sentinel:
      # 控制台地址
      transport:
        dashboard: 127.0.0.1:8080
      # 将规则持久化到 Nacos
      datasource:
        ds1:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: ${spring.application.name}-sentinel-rules
            group-id: DEFAULT_GROUP
            data-type: json
            rule-type: gw-flow      # 网关流控规则
```

### 10.3 两种限流模式

#### 路由维度限流

按路由 ID 设置限流规则：

```json
// Nacos 中的 gateway-service-sentinel-rules
[
    {
        "resource": "user-service-route",
        "resourceMode": 0,
        "grade": 1,
        "count": 100,
        "intervalSec": 1
    }
]
```

| 字段 | 说明 | 值 |
|------|------|------|
| `resource` | 资源名（路由 ID） | `user-service-route` |
| `resourceMode` | 0=路由ID模式 | 0 |
| `grade` | 1=QPS限流 | 1 |
| `count` | 阈值 | `100` |
| `intervalSec` | 统计窗口（秒） | `1` |

#### API 分组限流

将多个路径归为一个 API 组，统一限流：

```java
@Configuration
public class SentinelApiConfig {

    @PostConstruct
    public void initApiDefinitions() {
        // 将多个路径归为同一个 API 组
        Set<ApiDefinition> definitions = new HashSet<>();

        ApiDefinition userApi = new ApiDefinition("user-api")
                .setPredicateItems(new HashSet<ApiPredicateItem>() {{
                    add(new ApiPathPredicateItem()
                            .setPattern("/api/user/**")
                            .setMatchStrategy(SentinelGatewayConstants.URL_MATCH_STRATEGY_PREFIX));
                }});

        definitions.add(userApi);
        GatewayApiDefinitionManager.loadApiDefinitions(definitions);
    }
}
```

然后对 API 组设置规则：

```json
{
    "resource": "user-api",
    "resourceMode": 1,
    "grade": 1,
    "count": 200
}
```

`resourceMode: 1` 表示按 API 组模式限流。

### 10.4 自定义限流异常处理

限制触发时默认返回 429，可以自定义返回内容：

```java
@Configuration
public class SentinelGatewayConfig {

    @PostConstruct
    public void init() {
        GatewayCallbackManager.setBlockHandler(
            new BlockRequestHandler() {
                @Override
                public Mono<ServerResponse> handleRequest(
                        ServerWebExchange exchange, Throwable t) {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("code", 429);
                    result.put("message", "请求过于频繁，请稍后重试");
                    return ServerResponse.status(HttpStatus.TOO_MANY_REQUESTS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(result);
                }
            }
        );
    }
}
```

---

## 十一、负载均衡

Spring Cloud Gateway 集成了 **Spring Cloud LoadBalancer**，自动将请求分发到注册在 Nacos 的多个服务实例。

### 11.1 工作流程

```text
                     Nacos 注册中心
                     ┌─────────────┐
                     │ user-service │
                     │  实例1 :8081 │
                     │  实例2 :8082 │
                     │  实例3 :8083 │
                     └──────┬──────┘
                            │ 拉取实例列表
                            ▼
网关请求 → Gateway → LoadBalancer → 选择一个实例 → 转发
```

### 11.2 配置方式

YAML 中使用 `lb://` 前缀即可启用负载均衡：

```yaml
routes:
  - id: user-service-route
    uri: lb://user-service   # lb:// 前缀触发负载均衡
```

### 11.3 负载均衡策略

默认使用**轮询**策略（RoundRobin）。可以通过 Java 配置切换：

```java
@Configuration
public class LoadBalancerConfig {

    /**
     * 随机策略
     */
    @Bean
    public ReactorLoadBalancer<ServiceInstance> randomLoadBalancer(
            Environment env, LoadBalancerClientFactory factory) {
        String name = env.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new RandomLoadBalancer(
                factory.getLazyProvider(name, ServiceInstanceListSupplier.class), name);
    }
}
```

常用策略对比：

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| 轮询（默认） | 依次分配请求 | 各实例性能一致 |
| 随机 | 随机选择实例 | 实例较多时 |
| 加权 | 按权重分配 | 实例配置不同 |
| 最少连接 | 选连接数最少的 | 长连接场景 |

::: tip Spring Cloud 2021.0.x 使用 LoadBalancer，不是 Ribbon
从 Spring Cloud 2020.0 开始，Ribbon 已进入维护模式，Spring Cloud Gateway 默认集成了 LoadBalancer。不要引入 Ribbon 依赖。
:::

---

## 十二、生产环境最佳实践

### 12.1 全局超时配置

网关是流量入口，超时不控制会导致请求堆积。

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        connect-timeout: 3000          # 连接超时（毫秒）
        response-timeout: 30s          # 响应超时
        pool:
          max-connections: 1000        # 最大连接数
          max-idle-time: 5m            # 空闲连接保活时间
```

### 12.2 熔断保障

为每条关键路由配置熔断，防止级联故障：

```yaml
filters:
  - name: CircuitBreaker
    args:
      name: productServiceCB
      fallbackUri: forward:/fallback/product
```

### 12.3 重试 + 幂等性

```yaml
filters:
  - name: Retry
    args:
      retries: 2
      statuses: SERVICE_UNAVAILABLE, GATEWAY_TIMEOUT
      methods: GET                     # 仅 GET 请求重试
      backoff:
        firstBackoff: 50ms
        maxBackoff: 500ms
```

::: danger POST/PUT 重试风险
重试 POST 请求可能造成重复写入。如果业务确实需要对写操作重试，必须保证后端接口的**幂等性**——同样的请求无论执行多少次，结果都一样。

常见幂等方案：
- 请求头带唯一 `Idempotent-Key`，后端去重
- 数据库唯一索引约束
- Redis 分布式锁
:::

### 12.4 安全性配置

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: internal-api
          uri: lb://internal-service
          predicates:
            - Path=/internal/**
            - RemoteAddr=192.168.0.0/16    # 仅内网可访问
          filters:
            - RemoveResponseHeader=X-Powered-By
            - RemoveResponseHeader=Server
```

### 12.5 响应体缓存

Gateway 默认不会缓存响应体。如果需要读取响应体做修改（如加密、脱敏），需要开启缓存：

```java
@Component
public class BodyCachingFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // 缓存请求体
        return DataBufferUtils.join(exchange.getRequest().getBody())
                .flatMap(dataBuffer -> {
                    byte[] bytes = new byte[dataBuffer.readableByteCount()];
                    dataBuffer.read(bytes);
                    DataBufferUtils.release(dataBuffer);

                    // 将缓存后的请求体放回 exchange
                    ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                            .body(Flux.just(ByteBuffer.wrap(bytes)))
                            .build();

                    return chain.filter(
                            exchange.mutate().request(mutatedRequest).build());
                });
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;  // 最高优先级
    }
}
```

### 12.6 JVM 参数调优

Gateway 基于 Netty，网络 IO 密集。推荐 JVM 参数：

```bash
java -jar gateway-service.jar \
  -Xms1g -Xmx1g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -Dio.netty.leakDetection.level=paranoid
```

### 12.7 监控端点

暴露 `/actuator` 获取网关运行指标：

```yaml
management:
  endpoints:
    web:
      exposure:
        include: gateway, health, metrics
  endpoint:
    gateway:
      enabled: true
```

访问 `http://localhost:9000/actuator/gateway/routes` 查看所有路由定义和运行状态。

### 12.8 生产配置清单

| 配置项 | 作用 | 推荐值 |
|--------|------|--------|
| 连接超时 | 防止连接 hang 住 | 3-5s |
| 响应超时 | 防止请求堆积 | 30-60s |
| 限流 | 防止流量打垮后端 | 按业务设置 |
| 熔断 | 防止级联故障 | 必须配置 |
| 重试 | 提升可用性 | GET 最多 3 次 |
| CORS | 解决跨域问题 | 明确列出域名 |
| 鉴权 | 统一认证入口 | 白名单 + Token |
| JVM | 性能保障 | G1GC |

### 12.9 完整配置参考

以下是一个较为完整的生产级配置示例：

```yaml
# bootstrap.yml
spring:
  application:
    name: gateway-service
  cloud:
    nacos:
      server-addr: 127.0.0.1:8848
      username: nacos
      password: nacos
      discovery:
        namespace: 4a2b3c1d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        group: DEFAULT_GROUP
      config:
        file-extension: yaml
        namespace: 4a2b3c1d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        group: DEFAULT_GROUP
        extension-configs:
          - data-id: gateway-routes.yaml
            group: DEFAULT_GROUP
            refresh: true
```

```yaml
# application.yml
server:
  port: 9000

spring:
  redis:
    host: 127.0.0.1
    port: 6379
  cloud:
    sentinel:
      transport:
        dashboard: 127.0.0.1:8080
      datasource:
        ds1:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: ${spring.application.name}-sentinel-rules
            group-id: DEFAULT_GROUP
            data-type: json
            rule-type: gw-flow
    gateway:
      httpclient:
        connect-timeout: 3000
        response-timeout: 30s
        pool:
          max-connections: 1000
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOriginPatterns:
              - "https://*.example.com"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
            allowedHeaders:
              - "*"
            allowCredentials: true
            maxAge: 3600

logging:
  level:
    org.springframework.cloud.gateway: INFO

management:
  endpoints:
    web:
      exposure:
        include: gateway, health, metrics, info
  endpoint:
    gateway:
      enabled: true
```

---

## 常见问题排查

### 路由没有生效

1. 检查路由 `id` 是否重复，后定义的同 ID 路由会覆盖前面的
2. 检查多个 `predicates` 是否全部满足（AND 关系）
3. 访问 `/actuator/gateway/routes` 确认路由是否注册
4. 开启 DEBUG 日志：`logging.level.org.springframework.cloud.gateway: DEBUG`

### 503 Service Unavailable

出现 503 通常表示 Gateway 找不到后端服务的可用实例：

1. 确认后端服务在 Nacos 中已注册且为"健康"状态
2. 确认 `uri` 中使用的服务名与 Nacos 中的服务名**完全一致**
3. 确认 `lb://` 前缀是否遗漏
4. 检查 `spring-cloud-starter-loadbalancer` 依赖是否引入

### CORS 还是报跨域错误

Gateway 配置了 CORS 但前端仍然报跨域：

1. 确认 `allowedOriginPatterns` 和 `allowedOrigins` 没有同时配置（冲突导致失效）
2. 检查自定义的 `GlobalFilter` 是否在返回时修改了响应头导致 CORS 头丢失
3. 检查是否在路由的 `filters` 中使用了 `StripPrefix`，造成 OPTIONS 预检请求路径不匹配
4. 如果使用了 Token 认证的 Header，确认 `allowedHeaders` 中包含了该自定义 Header