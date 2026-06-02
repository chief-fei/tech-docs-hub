# OpenFeign 使用指南

## 什么是 OpenFeign？

OpenFeign 是一个**声明式 HTTP 客户端**。通俗地说：你只需要定义一个 Java 接口，在方法上加上注解描述"我要调用哪个 URL"，OpenFeign 就会自动帮你完成 HTTP 请求的发送和响应的解析。

**举个例子**，如果你想调用 GitHub 的 API 获取仓库的贡献者列表，传统方式需要写几十行代码：拼接 URL、设置请求头、发起 HTTP 连接、解析 JSON 响应……而用 OpenFeign，你只需要写一个接口：

```java path=null start=null
public interface GitHubClient {

    @GetMapping("/repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@PathVariable("owner") String owner,
                                   @PathVariable("repo") String repo);
}
```

> 适用版本：`spring-cloud-starter-openfeign: 3.1.5`（Spring Boot 2.7.x + Spring Cloud 2021.0.x）

## 为什么用 OpenFeign 而不是 RestTemplate？

在 Spring 项目中，发起 HTTP 请求最原始的方式是使用 `RestTemplate`：

```java path=null start=null
// RestTemplate 方式：需要手动拼接 URL、处理响应类型
RestTemplate restTemplate = new RestTemplate();
String url = "https://api.github.com/repos/" + owner + "/" + repo + "/contributors";
Contributor[] contributors = restTemplate.getForObject(url, Contributor[].class);
```

这种方式的问题：
- **URL 拼接容易出错**，参数多了之后代码可读性很差
- **代码重复**，每个接口都要写一遍 RestTemplate 调用
- **难以统一管理**，超时、认证、日志等配置分散在各处

OpenFeign 通过"接口 + 注解"把 HTTP 调用变成声明式，解决了以上所有问题。

## Feign.builder() 与 @FeignClient 的区别

OpenFeign 有两种使用方式，本文档主要介绍 **`Feign.builder()` + `SpringMvcContract`** 方式：

| 方式 | 注解风格 | 适用场景 |
|------|---------|------|
| `Feign.builder()` + `SpringMvcContract` | `@GetMapping` 等 Spring MVC 注解 | 调用外部 HTTP API，与 Controller 写法一致，对 Spring 开发者最友好 |
| `Feign.builder()` 默认（Feign 原生 Contract） | `@RequestLine` 等 Feign 注解 | 想与 Spring 框架完全解耦 |
| `@FeignClient`（Spring Cloud） | `@GetMapping` 等 | 微服务间调用（自动启用 SpringMvcContract） |

> 由于本项目的微服务调用已使用 Dubbo（详见 [Nacos 文档](../nacos/)），本文档聚焦于**作为 HTTP 客户端调用外部 API** 的场景，统一使用 `Feign.builder()` + `SpringMvcContract`。启用 `SpringMvcContract` 后，你就可以用熟悉的 `@GetMapping`、`@PostMapping` 等 Spring MVC 注解来定义接口了，学习成本几乎为零。

---

## 一、快速开始

这一节会带你从零开始，用 OpenFeign 调用 GitHub 的公开 API。

### 1.1 添加 Maven 依赖

在 `pom.xml` 中加入以下依赖：

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
    <version>3.1.5</version>
</dependency>
```

> **说明**：`spring-cloud-starter-openfeign` 是一个"全家桶"依赖，它已经包含了 feign-core、Jackson 编解码器、OkHttp 引擎、Slf4j 日志等所有需要的库，你只需要引入这一个依赖就够了。

### 1.2 定义 HTTP 接口

接下来的步骤是：**定义一个 Java 接口，用 Spring MVC 注解描述你要调用的 HTTP 请求**。

> 启用 `SpringMvcContract` 后，接口上的注解写法和你写 Controller 时完全一样——`@GetMapping`、`@PathVariable`、`@RequestBody` 等都可以直接使用。

```java
// 步骤说明：
// 1. 定义一个普通的 Java 接口（不需要实现类）
// 2. 用 @GetMapping/@PostMapping 声明 HTTP 方法和 URL 路径
// 3. 用 @PathVariable 绑定路径参数，用 @RequestBody 标记请求体

public interface GitHubClient {

    // 示例 1：GET 请求，@PathVariable 绑定路径中的 {owner} 和 {repo}
    @GetMapping("/repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@PathVariable("owner") String owner,
                                   @PathVariable("repo") String repo);

    // 示例 2：POST 请求，@RequestBody 将 Java 对象自动序列化为 JSON 请求体
    @PostMapping("/repos/{owner}/{repo}/issues")
    void createIssue(@RequestBody Issue issue,
                     @PathVariable("owner") String owner,
                     @PathVariable("repo") String repo);

    // 响应数据类：Feign 会自动将 JSON 反序列化为这些对象
    @Data
    class Contributor {
        private String login;
        private int contributions;
    }

    @Data
    class Issue {
        private String title;
        private String body;
    }
}
```

### 1.3 将客户端注册为 Spring Bean

光有接口还不够，你需要通过 `Feign.builder()` 构建一个**代理对象**，并将它注册到 Spring 容器中。

> **为什么需要注册为 Bean？** `Feign.builder().target()` 返回的是一个由 Feign 动态生成的代理对象，它本身不是 Spring Bean。只有通过 `@Bean` 方法把它注册到 Spring 容器后，其他类才能通过 `@Resource` 或构造器注入来使用它。

```java
@Configuration  // 标记这是一个配置类
public class FeignClientConfig {

    @Bean  // 将返回值注册为 Spring Bean，名字默认是方法名 "gitHubClient"
    public GitHubClient gitHubClient(ObjectMapper objectMapper) {
        return Feign.builder()
                // 启动 Spring MVC 契约：让接口可以使用 @GetMapping、@RequestBody 等注解
                .contract(new SpringMvcContract())
                // 编码器：将 Java 对象序列化为 JSON 请求体
                .encoder(new JacksonEncoder(objectMapper))
                // 解码器：将 JSON 响应体反序列化为 Java 对象
                .decoder(new JacksonDecoder(objectMapper))
                // 超时配置：连接 10 秒，读取 60 秒
                .options(new Request.Options(
                        10, TimeUnit.SECONDS,
                        60, TimeUnit.SECONDS,
                        true))
                // 请求拦截器：每次请求自动添加 Basic Auth 认证头
                .requestInterceptor(new BasicAuthRequestInterceptor("username", "token"))
                // 日志级别：BASIC 会记录请求方法、URL、状态码和耗时
                .logLevel(Logger.Level.BASIC)
                .logger(new Slf4jLogger(GitHubClient.class))
                // target：指定接口类型 + 目标 URL 的根地址
                .target(GitHubClient.class, "https://api.github.com");
    }
}
```

### 1.4 在业务代码中使用客户端

注册为 Bean 后，就可以在任意 Service 或 Controller 中通过**构造器注入**来使用了：

```java
@Service
@RequiredArgsConstructor  // Lombok 注解：自动生成包含所有 final 字段的构造器
public class GitHubService {

    private final GitHubClient gitHubClient;  // 构造器注入（推荐方式）

    // 调用 GET 接口获取贡献者列表
    public List<GitHubClient.Contributor> getContributors(String owner, String repo) {
        return gitHubClient.contributors(owner, repo);
    }

    // 调用 POST 接口创建 Issue
    public void createBugReport(String owner, String repo, String title, String body) {
        GitHubClient.Issue issue = new GitHubClient.Issue();
        issue.setTitle(title);
        issue.setBody(body);
        gitHubClient.createIssue(issue, owner, repo);
    }
}
```

> **到这里，一个完整的 HTTP 客户端就搭建好了。** 下面详细介绍每个注解的用法。

---

## 二、注解详解

### 为什么推荐 SpringMvcContract？

启用 `SpringMvcContract` 后，接口上可以使用所有你熟悉的 Spring MVC 注解——`@GetMapping`、`@PathVariable`、`@RequestBody` 等，和写 Controller 完全一致。这对 Spring 开发者来说几乎没有额外的学习成本。

当然，如果你偏好与 Spring 框架完全解耦，也可以使用 Feign 原生的 `@RequestLine` 等注解（不配置 `SpringMvcContract` 即可）。

| 方式 | 注解 | 适用场景 |
|------|------|---------|
| `Feign.builder()` + `SpringMvcContract`（推荐） | `@GetMapping` 等 | 与 Controller 写法一致，Spring 开发者首选 |
| `Feign.builder()` 默认 | `@RequestLine` | 与 Spring 框架完全解耦 |
| `@FeignClient`（Spring Cloud） | `@GetMapping` 等 | 微服务间调用 |

### 2.1 @GetMapping / @PostMapping / @PutMapping / @DeleteMapping — HTTP 方法

这几个注解分别对应 HTTP 的 GET、POST、PUT、DELETE 方法，和你在 Controller 里用的完全一样。

```java
public interface UserApi {

    @GetMapping("/users/{id}")
    UserDTO getById(@PathVariable("id") Long id);

    @PostMapping("/users")
    Result<Long> create(@RequestBody UserCreateCmd cmd);

    @PutMapping("/users/{id}")
    Result<Void> update(@PathVariable("id") Long id, @RequestBody UserUpdateCmd cmd);

    @DeleteMapping("/users/{id}")
    Result<Void> delete(@PathVariable("id") Long id);
}
```

| 注解 | HTTP 方法 | 典型用途 |
|------|----------|---------|
| `@GetMapping` | GET | 查询数据 |
| `@PostMapping` | POST | 创建数据 |
| `@PutMapping` | PUT | 更新数据 |
| `@DeleteMapping` | DELETE | 删除数据 |

### 2.2 @RequestMapping — 更灵活的 HTTP 方法声明

`@RequestMapping` 是更底层的注解，可以同时指定路径和 HTTP 方法，适合需要绑定多个方法的场景：

```java
public interface UserApi {

    @RequestMapping(method = RequestMethod.GET, value = "/users/{id}")
    UserDTO getById(@PathVariable("id") Long id);

    // 同一个路径，支持多种 HTTP 方法
    @RequestMapping(method = {RequestMethod.PUT, RequestMethod.PATCH}, value = "/users/{id}")
    Result<Void> updateOrPatch(@PathVariable("id") Long id, @RequestBody UserUpdateCmd cmd);
}
```

### 2.3 @PathVariable — 路径参数

`@PathVariable` 将方法参数绑定到 URL 路径中的 `{变量}` 占位符。当占位符名和方法参数名一致时，可以省略 `@PathVariable` 的 value 属性（Spring 4.3+）。

```java
public interface RepoApi {

    // 显式指定变量名
    @GetMapping("/repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@PathVariable("owner") String owner,
                                   @PathVariable("repo") String repo);

    // 变量名与方法参数名一致时，可省略 value
    @GetMapping("/users/{id}")
    UserDTO getById(@PathVariable Long id);  // 等价于 @PathVariable("id")
}
```

### 2.4 @RequestParam — 查询参数

`@RequestParam` 将方法参数拼接为 URL 查询参数（`?key=value`）。也支持 SpringMvcContract 下的 `@SpringQueryMap` 将整个对象展开为查询参数。

```java
public interface UserApi {

    // 单个查询参数：GET /users?page=1&size=20
    @GetMapping("/users")
    List<UserDTO> list(@RequestParam("page") int page,
                       @RequestParam("size") int size);

    // Map 展开为查询参数：@SpringQueryMap（注意不是 @QueryMap）
    @GetMapping("/users/search")
    List<UserDTO> search(@SpringQueryMap Map<String, Object> filters);
}

// 调用
Map<String, Object> params = new LinkedHashMap<>();
params.put("status", "active");
params.put("role", "admin");
api.search(params);  // GET /users/search?status=active&role=admin
```

### 2.5 @RequestBody — 请求体

`@RequestBody` 将方法参数序列化为 HTTP 请求体。配合 `JacksonEncoder`，Java 对象会自动转为 JSON。

```java
public interface OrderApi {

    @PostMapping("/orders")
    Order create(@RequestBody Order order);  // order 对象自动序列化为 JSON

    @PutMapping("/orders/{id}")
    Order update(@PathVariable("id") Long id, @RequestBody Order order);
}
```

> 正常情况下你只需要用 `@RequestBody` 传对象即可。如果你想精确控制请求体格式（如 XML），仍然可以配合 Feign 原生的 `@Body` 注解使用。

### 2.6 @RequestHeader — 请求头

`@RequestHeader` 将方法参数值设置为 HTTP 请求头。配合 `@RequestMapping` 或 `@Headers`（Feign 原生）可以灵活设置静态和动态请求头。

```java
public interface Api {

    // 动态请求头：值通过 @RequestHeader 传入
    @GetMapping("/orders")
    List<Order> listOrders(@RequestHeader("X-Tenant-ID") String tenantId);

    // Map 展开为请求头
    @GetMapping("/objects/{key}")
    byte[] download(@PathVariable("key") String key,
                    @RequestHeader Map<String, Object> headers);
}
```

### 2.7 @RequestPart — 文件上传（Multipart）

当需要上传文件时，用 `@RequestPart` 标记文件参数：

```java
public interface FileApi {

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    String upload(@RequestPart("file") MultipartFile file);
}
```

### 2.8 @CollectionFormat — 集合参数格式

控制数组/集合参数序列化为查询参数时的格式（如 CSV 格式）：

```java
public interface UserApi {

    @GetMapping("/users")
    @CollectionFormat(feign.CollectionFormat.CSV)  // ids=1,2,3
    List<UserDTO> batchGet(@RequestParam("ids") List<Long> ids);
}
```

### 2.9 注解速查表

| 注解 | 来源 | 作用 | 示例 |
|------|------|------|------|
| `@GetMapping` | Spring MVC | GET 请求 | `@GetMapping("/users/{id}")` |
| `@PostMapping` | Spring MVC | POST 请求 | `@PostMapping("/users")` |
| `@PutMapping` | Spring MVC | PUT 请求 | `@PutMapping("/users/{id}")` |
| `@DeleteMapping` | Spring MVC | DELETE 请求 | `@DeleteMapping("/users/{id}")` |
| `@RequestMapping` | Spring MVC | 通用 HTTP 方法声明 | `@RequestMapping(method=GET, value="/users")` |
| `@PathVariable` | Spring MVC | 绑定路径参数 | `@PathVariable("id") Long id` |
| `@RequestParam` | Spring MVC | 绑定查询参数 | `@RequestParam("page") int page` |
| `@RequestBody` | Spring MVC | 绑定请求体 | `@RequestBody UserCreateCmd cmd` |
| `@RequestHeader` | Spring MVC | 绑定请求头 | `@RequestHeader("X-Token") String token` |
| `@RequestPart` | Spring MVC | 文件上传 | `@RequestPart("file") MultipartFile file` |
| `@SpringQueryMap` | Feign | 对象/Map → 查询参数 | `@SpringQueryMap UserFilter filter` |
| `@CollectionFormat` | Feign | 集合参数序列化格式 | `@CollectionFormat(CSV)` |

---

## 三、最佳实践

### 3.1 封装统一构建工具类

**适用场景**：当项目中有多个外部 API 客户端时，每个客户端都重复写一遍 `Feign.builder()` 会很繁琐。封装一个工具类统一管理超时、编码器等通用配置，避免重复代码。

```java
public class FeignClientHelper {

    // 统一的超时配置：连接 5 秒，读取 30 秒
    private static final Request.Options DEFAULT_OPTIONS =
            new Request.Options(5, TimeUnit.SECONDS, 30, TimeUnit.SECONDS, true);

    public static <T> T build(Class<T> apiType, String url, RequestInterceptor... interceptors) {
        return Feign.builder()
                .contract(new SpringMvcContract())  // 启用 Spring MVC 注解
                .encoder(new JacksonEncoder())
                .decoder(new JacksonDecoder())
                .options(DEFAULT_OPTIONS)
                .requestInterceptors(Arrays.asList(interceptors))
                .logLevel(Logger.Level.BASIC)
                .logger(new Slf4jLogger(apiType))
                .target(apiType, url);
    }
}
```

使用方式变得极其简洁：

```java
// 一行代码构建客户端
GitHubClient github = FeignClientHelper.build(GitHubClient.class, "https://api.github.com");
```

### 3.2 统一认证拦截器

**适用场景**：调用外部 API 时通常需要认证（如 Bearer Token、API Key），通过 `RequestInterceptor` 统一处理，避免在每个方法上重复设置。

```java
// Bearer Token 认证拦截器
public class BearerAuthInterceptor implements RequestInterceptor {
    private final String token;

    public BearerAuthInterceptor(String token) { this.token = token; }

    @Override
    public void apply(RequestTemplate template) {
        template.header("Authorization", "Bearer " + token);
    }
}

// 使用：构建时传入拦截器，所有请求自动带上认证头
PayPalClient payPal = FeignClientHelper.build(
    PayPalClient.class, "https://api-m.paypal.com",
    new BearerAuthInterceptor(payPalAccessToken)
);
```

### 3.3 自定义 ErrorDecoder 统一错误处理

**适用场景**：外部 API 返回的 HTTP 错误状态码（如 404、429、500）需要转换为业务异常，方便上层统一处理，而不是在每个调用处写 try-catch。

```java
public class CustomErrorDecoder implements ErrorDecoder {

    private final ErrorDecoder defaultDecoder = new ErrorDecoder.Default();

    @Override
    public Exception decode(String methodKey, Response response) {
        if (response.status() == 404) {
            return new NotFoundException("Resource not found: " + response.request().url());
        }
        if (response.status() == 429) {
            return new RateLimitException("Rate limited");
        }
        if (response.status() >= 400 && response.status() < 500) {
            return new BusinessException("Client error: " + response.status());
        }
        return defaultDecoder.decode(methodKey, response);
    }
}

// 配置 ErrorDecoder
Feign.builder()
    .contract(new SpringMvcContract())
    .errorDecoder(new CustomErrorDecoder())
    .target(MyApi.class, "https://api.example.com");
```

### 3.4 日志级别控制

**适用场景**：开发阶段需要看到完整的请求/响应内容来排查问题，生产环境则只需记录请求 URL 和耗时。通过日志级别灵活切换。

| 级别 | 说明 | 推荐场景 |
|------|------|---------|
| `NONE` | 不记录（默认） | 生产环境 |
| `BASIC` | 请求方法、URL、状态码、耗时 | 生产环境（推荐） |
| `HEADERS` | BASIC + 请求/响应头 | 开发环境 |
| `FULL` | HEADERS + 请求/响应体 | 调试排查 |

```yaml
# application.yml —— 必须配置日志级别，否则 Feign 日志不会输出
logging:
  level:
    com.example.feign.GitHubClient: DEBUG  # 设为 DEBUG 才会输出 Feign 日志
```

```java
// 根据运行环境动态切换日志级别
Feign.builder()
    .contract(new SpringMvcContract())
    .logLevel(isProd ? Logger.Level.BASIC : Logger.Level.FULL)
    .target(MyApi.class, url);
```

### 3.5 异常处理

**适用场景**：调用外部 API 时，网络超时、对方服务挂了、返回错误码等情况都需要妥善处理，避免影响主业务流程。

```java
@Service
@Slf4j
public class GitHubService {

    private final GitHubClient gitHubClient;

    public List<Contributor> getContributors(String owner, String repo) {
        try {
            return gitHubClient.contributors(owner, repo);
        } catch (FeignException.NotFound e) {
            // 资源不存在（404）—— 可能是业务上的正常情况
            log.warn("Repo not found: {}/{}", owner, repo);
            return Collections.emptyList();
        } catch (FeignException.ServiceUnavailable e) {
            // 外部服务不可用（503）—— 需要告警
            log.error("外部服务不可用", e);
            throw new ServiceException("服务暂时不可用，请稍后重试", e);
        } catch (FeignException e) {
            // 其他 HTTP 错误
            log.error("HTTP error: status={}", e.status(), e);
            throw new BusinessException("调用外部接口失败", e);
        }
    }
}
```

### 3.6 多客户端统一管理

**适用场景**：项目需要调用多个不同的外部 API（如 GitHub + 短信服务），在一个配置类中集中管理所有客户端，结构清晰，便于维护。

```java
@Configuration
public class ExternalApiConfig {

    @Bean
    public GitHubClient gitHubClient(ObjectMapper mapper) {
        return Feign.builder()
                .contract(new SpringMvcContract())
                .encoder(new JacksonEncoder(mapper))
                .decoder(new JacksonDecoder(mapper))
                .options(new Request.Options(5, TimeUnit.SECONDS, 30, TimeUnit.SECONDS, true))
                .logLevel(Logger.Level.BASIC)
                .logger(new Slf4jLogger(GitHubClient.class))
                .target(GitHubClient.class, "https://api.github.com");
    }

    @Bean
    public SmsClient smsClient(ObjectMapper mapper,
                                @Value("${sms.api-key}") String apiKey) {
        return Feign.builder()
                .contract(new SpringMvcContract())
                .encoder(new JacksonEncoder(mapper))
                .decoder(new JacksonDecoder(mapper))
                .options(new Request.Options(3, TimeUnit.SECONDS, 10, TimeUnit.SECONDS, true))
                .requestInterceptor(tpl -> tpl.header("X-API-Key", apiKey))
                .target(SmsClient.class, "https://sms-api.example.com");
    }
}
```
