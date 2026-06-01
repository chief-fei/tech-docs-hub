# OpenFeign 使用指南

OpenFeign 是声明式 HTTP 客户端，通过接口 + 注解即可定义 HTTP 调用，无需手写 RestTemplate 代码。

> 适用版本：Spring Boot 2.7.x + Spring Cloud 2021.0.x

## 一、HTTP 接口调用（推荐用法）

在现代微服务架构中，内部服务间 RPC 通信推荐使用 [Dubbo + Nacos](../nacos/)，OpenFeign 更适合作为 **调用外部 HTTP API 的声明式客户端**。

### 1.1 Maven 依赖

```xml
<!-- OpenFeign Core（不依赖 Spring Cloud 全家桶） -->
<dependency>
    <groupId>io.github.openfeign</groupId>
    <artifactId>feign-core</artifactId>
</dependency>
<!-- Jackson 编解码 -->
<dependency>
    <groupId>io.github.openfeign</groupId>
    <artifactId>feign-jackson</artifactId>
</dependency>
<!-- OkHttp 作为底层 HTTP 引擎（推荐） -->
<dependency>
    <groupId>io.github.openfeign</groupId>
    <artifactId>feign-okhttp</artifactId>
</dependency>
<!-- Slf4j 日志 -->
<dependency>
    <groupId>io.github.openfeign</groupId>
    <artifactId>feign-slf4j</artifactId>
</dependency>
```

> 版本由 Spring Cloud BOM 或 `openfeign-bom` 统一管理，无需手动指定。

### 1.2 定义接口

```java
// 使用 Feign 原生注解（@RequestLine + @Headers），与 Spring MVC 解耦
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

### 1.3 构建客户端（推荐：单例 + 集中配置）

```java
@Configuration
public class FeignClientConfig {

    @Bean
    public GitHubClient gitHubClient(ObjectMapper objectMapper) {
        return Feign.builder()
                .encoder(new JacksonEncoder(objectMapper))
                .decoder(new JacksonDecoder(objectMapper))
                .client(new OkHttpClient())
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

```java
@Service
@RequiredArgsConstructor
public class GitHubService {

    private final GitHubClient gitHubClient;

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

### 1.5 为什么不用 RestTemplate？

| 对比 | OpenFeign | RestTemplate |
|------|-----------|-------------|
| 调用方式 | 声明式接口 | 命令式，手动拼接 URL |
| 类型安全 | 编译期检查 | 运行时发现错误 |
| 可读性 | 接口即文档 | 大量样板代码 |
| 连接池 | 默认支持 OkHttp/Apache HC5 | 需额外配置 |
| 超时控制 | `Request.Options` 一行搞定 | 需手动配置 Factory |
| 拦截器 | `RequestInterceptor` 接口 | `ClientHttpRequestInterceptor` |

---

## 二、最佳实践

### 2.1 统一超时配置

```java
// 推荐：抽取出公共超时配置
public class FeignClientHelper {

    private static final Request.Options DEFAULT_OPTIONS =
            new Request.Options(5, TimeUnit.SECONDS, 30, TimeUnit.SECONDS, true);

    public static <T> T build(Class<T> apiType, String url, RequestInterceptor... interceptors) {
        return Feign.builder()
                .encoder(new JacksonEncoder())
                .decoder(new JacksonDecoder())
                .client(new OkHttpClient())
                .options(DEFAULT_OPTIONS)
                .requestInterceptors(Arrays.asList(interceptors))
                .logLevel(Logger.Level.BASIC)
                .logger(new Slf4jLogger(apiType))
                .target(apiType, url);
    }
}
```

### 2.2 统一的认证拦截器

```java
// 推荐：Bearer Token 拦截器
public class BearerAuthInterceptor implements RequestInterceptor {

    private final String token;

    public BearerAuthInterceptor(String token) {
        this.token = token;
    }

    @Override
    public void apply(RequestTemplate template) {
        template.header("Authorization", "Bearer " + token);
    }
}

// 使用
PayPalClient payPal = FeignClientHelper.build(
    PayPalClient.class,
    "https://api-m.paypal.com",
    new BearerAuthInterceptor(payPalAccessToken)
);
```

### 2.3 自定义 ErrorDecoder 统一错误处理

```java
public class CustomErrorDecoder implements ErrorDecoder {

    private final ErrorDecoder defaultDecoder = new ErrorDecoder.Default();

    @Override
    public Exception decode(String methodKey, Response response) {
        if (response.status() == 404) {
            return new NotFoundException("Resource not found: " + response.request().url());
        }
        if (response.status() == 429) {
            return new RateLimitException("Rate limited, retry after " +
                    response.headers().getOrDefault("Retry-After", List.of("unknown")));
        }
        // 4xx 客户端错误
        if (response.status() >= 400 && response.status() < 500) {
            return new BusinessException("Client error: " + response.status());
        }
        // 5xx 保留原始行为
        return defaultDecoder.decode(methodKey, response);
    }
}

// 配置
Feign.builder()
    .errorDecoder(new CustomErrorDecoder())
    .target(MyApi.class, "https://api.example.com");
```

### 2.4 日志级别控制

| 级别 | 说明 | 推荐场景 |
|------|------|---------|
| `NONE` | 不记录（默认） | 生产环境 |
| `BASIC` | 请求方法、URL、响应状态码、耗时 | 生产环境（推荐） |
| `HEADERS` | BASIC + 请求/响应头 | 开发环境 |
| `FULL` | HEADERS + 请求/响应体 | 调试/排查问题 |

```yaml
# application.yml
logging:
  level:
    com.example.feign.GitHubClient: DEBUG
```

```java
// 代码层面控制：根据 profile 切换
Feign.builder()
    .logLevel(isProd ? Logger.Level.BASIC : Logger.Level.FULL)
    .target(MyApi.class, url);
```

### 2.5 异常处理最佳实践

```java
@Service
@Slf4j
public class GitHubService {

    private final GitHubClient gitHubClient;

    public List<GitHubClient.Contributor> getContributors(String owner, String repo) {
        try {
            List<GitHubClient.Contributor> result = gitHubClient.contributors(owner, repo);
            log.debug("Fetched {} contributors for {}/{}", result.size(), owner, repo);
            return result;
        } catch (FeignException.NotFound e) {
            log.warn("Repo not found: {}/{}", owner, repo);
            return Collections.emptyList();
        } catch (FeignException.ServiceUnavailable e) {
            log.error("GitHub API unreachable", e);
            throw new ServiceException("外部服务暂时不可用，请稍后重试", e);
        } catch (FeignException e) {
            log.error("GitHub API error: status={}", e.status(), e);
            throw new BusinessException("调用外部接口失败", e);
        }
    }
}
```

### 2.6 多客户端统一管理

```java
@Configuration
public class ExternalApiConfig {

    @Bean
    public GitHubClient gitHubClient(ObjectMapper mapper) {
        return Feign.builder()
                .encoder(new JacksonEncoder(mapper))
                .decoder(new JacksonDecoder(mapper))
                .client(new OkHttpClient())
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
                .client(new OkHttpClient())
                .options(new Request.Options(3, TimeUnit.SECONDS, 10, TimeUnit.SECONDS, true))
                .requestInterceptor(tpl -> tpl.header("X-API-Key", apiKey))
                .target(SmsClient.class, "https://sms-api.example.com");
    }
}
```

---

## 三、微服务间调用（简要）

服务间 RPC 通信推荐使用 [Dubbo](../nacos/#一服务注册与发现)，OpenFeign 在此场景仅作补充。

### 3.1 Maven 依赖

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

### 3.2 启动类

```java
@EnableFeignClients
@SpringBootApplication
public class Application { }
```

### 3.3 声明式接口

```java
@FeignClient(
    name = "user-service",          // 服务名 → 通过 Nacos 自动发现实例
    path = "/api/users",
    fallbackFactory = UserClientFallbackFactory.class
)
public interface UserClient {

    @GetMapping("/{id}")
    UserDTO getById(@PathVariable Long id);

    @PostMapping
    Result<Long> create(@RequestBody UserCreateCmd cmd);
}

// 降级处理
@Component
@Slf4j
public class UserClientFallbackFactory implements FallbackFactory<UserClient> {
    @Override
    public UserClient create(Throwable cause) {
        log.error("UserClient 调用失败，触发降级", cause);
        return new UserClient() {
            @Override
            public UserDTO getById(Long id) {
                return UserDTO.fallback(id);
            }
            @Override
            public Result<Long> create(UserCreateCmd cmd) {
                return Result.error("服务暂不可用");
            }
        };
    }
}
```

### 3.4 超时与日志

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          user-service:
            connect-timeout: 3000
            read-timeout: 10000
            logger-level: BASIC
      compression:
        request:
          enabled: true
          min-request-size: 2048
        response:
          enabled: true
```

### 3.5 @FeignClient 核心参数

| 参数 | 说明 |
|------|------|
| `name` | 服务名（必填，用于服务发现） |
| `url` | 直连 URL（跳过注册中心，调试用） |
| `path` | 路径前缀 |
| `fallbackFactory` | 降级工厂（**推荐**，可获取异常原因） |
| `configuration` | 自定义配置类 |

### 3.6 参数注解速查

| 注解 | 说明 |
|------|------|
| `@PathVariable` | 路径参数 `/users/{id}` |
| `@RequestParam` | 查询参数 `?page=1` |
| `@RequestHeader` | 请求头 |
| `@RequestBody` | JSON 请求体 |
| `@SpringQueryMap` | 对象转 Query 参数 |

---

## 四、总结：Spring Boot 2.7.x 下 OpenFeign 使用策略

| 场景 | 方案 | 底层实现 |
|------|------|---------|
| 调用外部 HTTP API | `feign-core` + `@RequestLine` | `Feign.builder()` 手动构建 |
| 微服务间 RPC | [Dubbo + Nacos](../nacos/)（推荐） | Dubbo 协议 |
| 微服务间 HTTP（少数场景） | `@FeignClient` + 服务名 | Nacos 服务发现 + LoadBalancer |

**核心原则：**

1. 外部 API 调用用 `Feign.builder()` 原生方式，解耦 Spring Cloud
2. 内部 RPC 用 Dubbo，性能更好、功能更全
3. OpenFeign 作为微服务间 HTTP 调用只是备选方案
4. 始终配置超时、日志、统一错误处理
