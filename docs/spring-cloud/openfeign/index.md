# OpenFeign 使用指南

OpenFeign 是声明式 HTTP 客户端，通过接口 + 注解即可定义 HTTP 调用，无需手写 RestTemplate 代码。

> 适用版本：Spring Boot 2.7.x + Spring Cloud 2021.0.x

## 一、快速开始

`spring-cloud-starter-openfeign` 已包含 feign-core、Jackson 编解码、OkHttp 引擎、Slf4j 日志等全部传递依赖，无需额外引入。

### 1.1 Maven 依赖

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
```

### 1.2 定义接口

```java
public interface GitHubClient {

    @RequestLine("GET /repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@Param("owner") String owner,
                                   @Param("repo") String repo);

    @RequestLine("POST /repos/{owner}/{repo}/issues")
    @Headers("Content-Type: application/json")
    void createIssue(Issue issue,
                     @Param("owner") String owner,
                     @Param("repo") String repo);

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

### 1.3 构建客户端

`Feign.builder().target()` 返回的是一个**代理对象**，不是 Spring Bean。需要通过 `@Bean` 方法将其注册到 Spring 容器中，之后才能用 `@Resource`/构造器注入。

```java
@Configuration
public class FeignClientConfig {

    @Bean                                 // ← 注册为 Spring Bean
    public GitHubClient gitHubClient(ObjectMapper objectMapper) {
        return Feign.builder()
                .encoder(new JacksonEncoder(objectMapper))
                .decoder(new JacksonDecoder(objectMapper))
                .options(new Request.Options(
                        10, TimeUnit.SECONDS,   // connectTimeout
                        60, TimeUnit.SECONDS,   // readTimeout
                        true                    // followRedirects
                ))
                .requestInterceptor(new BasicAuthRequestInterceptor("username", "token"))
                .logLevel(Logger.Level.BASIC)
                .logger(new Slf4jLogger(GitHubClient.class))
                .target(GitHubClient.class, "https://api.github.com");
    }
}
```

### 1.4 使用客户端

通过构造器注入（推荐）或 `@Resource` 注入已注册的 Bean：

```java
@Service
@RequiredArgsConstructor
public class GitHubService {

    private final GitHubClient gitHubClient;  // 构造器注入

    public List<GitHubClient.Contributor> getContributors(String owner, String repo) {
        return gitHubClient.contributors(owner, repo);
    }

    public void createBugReport(String owner, String repo, String title, String body) {
        GitHubClient.Issue issue = new GitHubClient.Issue();
        issue.setTitle(title);
        issue.setBody(body);
        gitHubClient.createIssue(issue, owner, repo);
    }
}
```

---

## 二、注解详解

### 为什么用 @RequestLine 而不是 @GetMapping？

`Feign.builder()` 默认使用 Feign 原生契约（Contract），只识别 `@RequestLine`、`@Param`、`@Headers` 等注解，**不识别** Spring MVC 的 `@GetMapping`/`@PostMapping`。

| 方式 | 注解 | 适用场景 |
|------|------|---------|
| `Feign.builder()` 默认 | `@RequestLine` | 调用外部 HTTP API，与 Spring MVC 解耦 |
| `Feign.builder()` + `SpringMvcContract` | `@GetMapping` 等 | 想复用 Spring MVC 注解风格 |
| `@FeignClient`（Spring Cloud） | `@GetMapping` 等 | 微服务间调用（自动启用 SpringMvcContract） |

```java
// 方式一：默认契约（推荐，无需额外依赖）
@RequestLine("GET /users/{id}")
UserDTO getById(@Param("id") Long id);

// 方式二：Spring MVC 契约
Feign.builder()
    .contract(new SpringMvcContract())  // 额外配置
    .target(UserApi.class, url);

@GetMapping("/users/{id}")             // 现在可以用
UserDTO getById(@PathVariable Long id);
```

> 推荐使用默认的 `@RequestLine`，接口定义与 Spring 框架解耦，更简洁且无额外依赖。

### 注解详解

Feign 默认契约定义了以下原生注解，全部来自 `feign-core`：

### 2.1 @RequestLine — 定义 HTTP 方法和 URI

```java
public interface Api {
    @RequestLine("GET /users/{id}")
    UserDTO getById(@Param("id") Long id);

    @RequestLine("POST /users")
    Result<Long> create(UserCreateCmd cmd);

    @RequestLine("PUT /users/{id}")
    Result<Void> update(@Param("id") Long id, UserUpdateCmd cmd);

    @RequestLine("DELETE /users/{id}")
    Result<Void> delete(@Param("id") Long id);
}
```

| 格式 | 说明 |
|------|------|
| `GET /users` | HTTP 方法 + 路径 |
| `POST /users` | 路径固定 |
| `GET /users/{id}` | `{id}` 为模板变量，需配合 `@Param("id")` |

### 2.2 @Param — 绑定模板变量

`@Param` 用于将方法参数绑定到 `@RequestLine` 中的 `{变量}` 占位符：

```java
public interface Api {
    // 路径参数自动替换
    @RequestLine("GET /repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@Param("owner") String owner,
                                   @Param("repo") String repo);

    // 也可用于 @Headers 中的动态值
    @RequestLine("GET /orders")
    @Headers("X-Tenant-ID: {tenantId}")
    List<Order> listOrders(@Param("tenantId") String tenantId);
}
```

### 2.3 @Headers — 设置请求头

可在类或方法级别使用，支持静态值和动态占位符：

```java
// 类级别：所有方法继承
@Headers("Accept: application/json")
public interface Api {

    // 方法级别：覆盖/追加
    @Headers("Content-Type: application/json")
    @RequestLine("POST /orders")
    Order create(Order order);

    // 动态 Header：用 @Param 注入值
    @RequestLine("GET /orders")
    @Headers("X-Tenant-ID: {tenantId}")
    List<Order> listOrders(@Param("tenantId") String tenantId);

    // 多个 Header 用数组
    @Headers({
        "Content-Type: application/x-www-form-urlencoded",
        "Accept: application/json"
    })
    @RequestLine("POST /login")
    Token login(@Param("username") String u, @Param("password") String p);
}
```

### 2.4 @Body — 自定义请求体模板

当需要精确控制请求体格式（如 XML、自定义 JSON 模板）时使用：

```java
public interface LoginClient {

    @RequestLine("POST /")
    @Headers("Content-Type: application/xml")
    @Body("<login user_name="{user_name}" password="{password}" />")
    void xml(@Param("user_name") String user, @Param("password") String password);

    @RequestLine("POST /")
    @Headers("Content-Type: application/json")
    @Body("%7B"user_name": "{user_name}", "password": "{password}"%7D")  // { } 需 URL 编码
    void json(@Param("user_name") String user, @Param("password") String password);
}
```

> 使用 JacksonEncoder 时通常**不需要**手动 `@Body`，直接传对象即可自动序列化。

### 2.5 @QueryMap — 动态查询参数

将 Map 中的所有键值对展开为 URL 查询参数：

```java
public interface Api {

    @RequestLine("GET /users")
    List<UserDTO> search(@QueryMap Map<String, Object> filters);
}

// 调用后实际请求: GET /users?page=1&size=20&status=active
Map<String, Object> params = new LinkedHashMap<>();
params.put("page", 1);
params.put("size", 20);
params.put("status", "active");
api.search(params);
```

### 2.6 @HeaderMap — 动态请求头

将 Map 中的所有键值对展开为请求头：

```java
public interface StorageApi {

    @RequestLine("PUT /objects/{key}")
    void upload(@Param("key") String key,
                @HeaderMap Map<String, Object> metadata,
                byte[] body);
}

// 调用
Map<String, Object> meta = new LinkedHashMap<>();
meta.put("x-amz-meta-author", "alice");
meta.put("x-amz-server-side-encryption", "AES256");
storage.upload("reports/q1.pdf", meta, pdfBytes);
```

### 2.7 注解速查表

| 注解 | 作用 | 示例 |
|------|------|------|
| `@RequestLine` | HTTP 方法 + URI 模板 | `"GET /users/{id}"` |
| `@Param` | 绑定模板变量 | `@Param("id") Long id` |
| `@Headers` | 请求头（类/方法级别） | `"Content-Type: application/json"` |
| `@Body` | 自定义请求体模板 | `"<xml>...</xml>"` |
| `@QueryMap` | Map → URL 查询参数 | `@QueryMap Map<String, Object>` |
| `@HeaderMap` | Map → 请求头键值对 | `@HeaderMap Map<String, Object>` |

---

## 三、最佳实践

### 3.1 统一超时配置

```java
public class FeignClientHelper {

    private static final Request.Options DEFAULT_OPTIONS =
            new Request.Options(5, TimeUnit.SECONDS, 30, TimeUnit.SECONDS, true);

    public static <T> T build(Class<T> apiType, String url, RequestInterceptor... interceptors) {
        return Feign.builder()
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

### 3.2 统一的认证拦截器

```java
public class BearerAuthInterceptor implements RequestInterceptor {
    private final String token;

    public BearerAuthInterceptor(String token) { this.token = token; }

    @Override
    public void apply(RequestTemplate template) {
        template.header("Authorization", "Bearer " + token);
    }
}

// 使用
PayPalClient payPal = FeignClientHelper.build(
    PayPalClient.class, "https://api-m.paypal.com",
    new BearerAuthInterceptor(payPalAccessToken)
);
```

### 3.3 自定义 ErrorDecoder 统一错误处理

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

Feign.builder()
    .errorDecoder(new CustomErrorDecoder())
    .target(MyApi.class, "https://api.example.com");
```

### 3.4 日志级别控制

| 级别 | 说明 | 推荐场景 |
|------|------|---------|
| `NONE` | 不记录（默认） | 生产环境 |
| `BASIC` | 请求方法、URL、状态码、耗时 | 生产环境（推荐） |
| `HEADERS` | BASIC + 请求/响应头 | 开发环境 |
| `FULL` | HEADERS + 请求/响应体 | 调试排查 |

```yaml
# application.yml
logging:
  level:
    com.example.feign.GitHubClient: DEBUG
```

```java
// 根据 profile 动态切换
Feign.builder()
    .logLevel(isProd ? Logger.Level.BASIC : Logger.Level.FULL)
    .target(MyApi.class, url);
```

### 3.5 异常处理

```java
@Service
@Slf4j
public class GitHubService {

    private final GitHubClient gitHubClient;

    public List<Contributor> getContributors(String owner, String repo) {
        try {
            return gitHubClient.contributors(owner, repo);
        } catch (FeignException.NotFound e) {
            log.warn("Repo not found: {}/{}", owner, repo);
            return Collections.emptyList();
        } catch (FeignException.ServiceUnavailable e) {
            log.error("外部服务不可用", e);
            throw new ServiceException("服务暂时不可用，请稍后重试", e);
        } catch (FeignException e) {
            log.error("HTTP error: status={}", e.status(), e);
            throw new BusinessException("调用外部接口失败", e);
        }
    }
}
```

### 3.6 多客户端统一管理

```java
@Configuration
public class ExternalApiConfig {

    @Bean
    public GitHubClient gitHubClient(ObjectMapper mapper) {
        return Feign.builder()
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
                .encoder(new JacksonEncoder(mapper))
                .decoder(new JacksonDecoder(mapper))
                .options(new Request.Options(3, TimeUnit.SECONDS, 10, TimeUnit.SECONDS, true))
                .requestInterceptor(tpl -> tpl.header("X-API-Key", apiKey))
                .target(SmsClient.class, "https://sms-api.example.com");
    }
}
```
