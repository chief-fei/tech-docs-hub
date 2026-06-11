# OpenFeign 使用指南

## 什么是 OpenFeign？

OpenFeign 是一个**声明式 HTTP 客户端**。通俗地说：你只需要定义一个 Java 接口，在方法上加上注解描述"我要调用哪个 URL"，OpenFeign 就会自动帮你完成 HTTP 请求的发送和响应的解析。

**举个例子**，如果你想调用 GitHub 的 API 获取仓库的贡献者列表，传统方式需要写几十行代码：拼接 URL、设置请求头、发起 HTTP 连接、解析 JSON 响应……而用 OpenFeign，你只需要写一个接口：

```java path=null start=null
@FeignClient(name = "github", url = "https://api.github.com")
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

## @FeignClient 是什么？

`@FeignClient` 是 Spring Cloud OpenFeign 提供的最核心注解，你只需要在接口上加一个 `@FeignClient`，Spring 就会在启动时自动为你生成代理对象并注册到容器中，之后直接 `@Resource` 注入即可使用。

使用 `@FeignClient` 的好处：
- **零配置**：不用手动 `Feign.builder()`，不用写 `@Bean` 方法
- **自动装配**：Spring 自动创建代理对象，直接注入即可
- **配置集中**：超时、编解码、拦截器等都可以通过 `application.yml` 统一管理
- **与 Spring MVC 注解无缝兼容**：`@GetMapping`、`@PathVariable`、`@RequestBody` 等直接使用

> 由于本项目的微服务调用已使用 Dubbo（详见 [Nacos 文档](../nacos/)），本文档聚焦于**作为 HTTP 客户端调用外部 API** 的场景，通过 `@FeignClient` 的 `url` 属性指定目标地址。

---

## 一、快速开始

这一节会带你从零开始，用 `@FeignClient` 调用 GitHub 的公开 API。

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

::: warning 使用 `lb://` 负载均衡模式需要额外依赖
如果 Feign 要通过服务名（如 `lb://user-service`）调用 Nacos 中的微服务，需要引入 `spring-cloud-starter-loadbalancer`：

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

> 从 Spring Cloud 2020.0 开始，**Ribbon 已停止维护**，Spring Cloud 使用 **Spring Cloud LoadBalancer** 替代。不要引入 `spring-cloud-starter-netflix-ribbon` 依赖。
:::

### 1.2 启用 Feign 客户端

在启动类上加上 `@EnableFeignClients` 注解，告诉 Spring 启动时扫描所有 `@FeignClient` 接口并自动生成代理对象：

```java
@SpringBootApplication
@EnableFeignClients  // 启用 Feign 客户端扫描
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 1.3 定义 HTTP 接口

接下来的步骤是：**定义一个 Java 接口，加上 `@FeignClient` 注解，用 Spring MVC 注解描述你要调用的 HTTP 请求**。

> `@FeignClient` 的 `url` 属性指定目标 API 的根地址，`name` 属性是客户端的唯一标识（必填）。

```java
// 步骤说明：
// 1. @FeignClient 指定 name（客户端标识）和 url（目标 API 根地址）
// 2. 用 @GetMapping/@PostMapping 声明 HTTP 方法和 URL 路径
// 3. 用 @PathVariable 绑定路径参数，用 @RequestBody 标记请求体

@FeignClient(name = "github", url = "https://api.github.com")
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

> **不需要实现类，不需要写 `@Bean` 方法！** Spring 会在启动时自动扫描 `@FeignClient` 接口，动态生成代理对象并注册到容器中。

### 1.4 在业务代码中使用客户端

Spring 自动注册后，直接在 Service 或 Controller 中通过**构造器注入**即可使用：

```java
@Service
@RequiredArgsConstructor  // Lombok 注解：自动生成包含所有 final 字段的构造器
public class GitHubService {

    private final GitHubClient gitHubClient;  // 构造器注入，Spring 自动装配

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

> **到这里，一个完整的 HTTP 客户端就搭建好了。** 和 `Feign.builder()` 方式相比，`@FeignClient` 省去了手动编写配置类、手动 `@Bean` 注册的步骤，代码量大幅减少。

---

## 二、注解详解

### 为什么 @FeignClient 可以直接使用 Spring MVC 注解？

`@FeignClient` 内部自动启用了 `SpringMvcContract`，因此接口上可以直接使用 `@GetMapping`、`@PathVariable`、`@RequestBody` 等所有你熟悉的 Spring MVC 注解，和写 Controller 完全一样，学习成本几乎为零。

---

## @FeignClient 注解参数详解

`@FeignClient` 除了用来标记接口，还提供了丰富的参数用于精细控制客户端行为。以下是所有参数的完整说明。

### 参数总览

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | String | **是** | — | 客户端名称，用于 Spring 容器中的 Bean 名称和配置关联 |
| `value` | String | 否 | — | `name` 的别名，作用完全相同 |
| `url` | String | 否 | `""` | 目标服务的绝对 URL（可包含 `{变量}` 占位符） |
| `path` | String | 否 | `""` | 所有方法的统一路径前缀 |
| `contextId` | String | 否 | `""` | 自定义客户端上下文 ID，用于区分同名客户端的配置 |
| `qualifiers` | String[] | 否 | `{}` | 自定义 Bean 限定名，注入时可配合 `@Qualifier` 使用 |
| `primary` | boolean | 否 | `true` | 是否标记为 Spring 主 Bean |
| `configuration` | Class<?>[] | 否 | `{}` | 自定义 Feign 配置类（编解码器、拦截器、Contract 等） |
| `fallback` | Class<?> | 否 | `void.class` | 熔断降级类 |
| `fallbackFactory` | Class<?> | 否 | `void.class` | 熔断降级工厂（可获取异常信息） |
| `decode404` | boolean | 否 | `false` | HTTP 404 是否调用 decoder 解码 |
| `dismiss404` | boolean | 否 | `false` | 是否将 HTTP 404 视为空响应而不抛异常 |

### name / value —— 客户端名称

最核心的参数，**必填**。它有两个作用：

1. **作为 Spring Bean 的名称**注册到容器中
2. **与 `application.yml` 中的配置关联**——`spring.cloud.openfeign.client.config.{name}` 中的 `{name}` 就是这个值

```java
// name = "github" → yml 中对应 spring.cloud.openfeign.client.config.github
@FeignClient(name = "github", url = "https://api.github.com")
public interface GitHubClient { }
```

> `value` 是 `name` 的别名，`@FeignClient(value = "github")` 等价于 `@FeignClient(name = "github")`。建议统一使用 `name` 以增加可读性。

### url —— 目标服务地址

指定目标 API 的根地址。支持两种形式：

```java
// 方式一：写死 URL
@FeignClient(name = "github", url = "https://api.github.com")
public interface GitHubClient { }

// 方式二：通过配置文件占位符动态解析（推荐）
@FeignClient(name = "github", url = "${github.api.url}")
public interface GitHubClient { }
```

对应的 `application.yml`：

```yaml
github:
  api:
    url: https://api.github.com
```

> 当 `url` 不指定时，Feign 会尝试从配置 `spring.cloud.openfeign.client.config.{name}.url` 中读取。如果两者都未设置，则走负载均衡模式（通过 `name` 在注册中心发现服务，需引入 `spring-cloud-starter-loadbalancer`）。Ribbon 已停止维护，请使用 Spring Cloud LoadBalancer。

### path —— 统一路径前缀

当接口中每个方法都有相同的前缀时，可以用 `path` 统一指定，避免在每个方法上重复写：

```java
// 没有 path：每个方法都要写 /api/v2
@FeignClient(name = "github", url = "https://api.github.com")
public interface GitHubClient {
    @GetMapping("/api/v2/repos/{owner}/{repo}")
    Repo getRepo(@PathVariable String owner, @PathVariable String repo);

    @GetMapping("/api/v2/repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@PathVariable String owner, @PathVariable String repo);
}

// 有 path：前缀集中管理，方法只用写后半段
@FeignClient(name = "github", url = "https://api.github.com", path = "/api/v2")
public interface GitHubClient {
    @GetMapping("/repos/{owner}/{repo}")             // 实际请求 /api/v2/repos/{owner}/{repo}
    Repo getRepo(@PathVariable String owner, @PathVariable String repo);

    @GetMapping("/repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@PathVariable String owner, @PathVariable String repo);
}
```

### contextId —— 自定义上下文 ID

当多个 `@FeignClient` 的 `name` 相同但需要不同的配置时，用 `contextId` 区分：

```java
// 两个客户端 name 相同，但各自需要不同的拦截器配置
@FeignClient(contextId = "fooClient", name = "stores",
             configuration = FooConfiguration.class)
public interface FooClient { }

@FeignClient(contextId = "barClient", name = "stores",
             configuration = BarConfiguration.class)
public interface BarClient { }
```

> 如果不指定 `contextId`，默认使用 `name` 的值。当多个客户端共享 `name` 时，必须通过 `contextId` 区分，否则配置会互相覆盖。

### qualifiers —— 自定义 Bean 限定名

当同一接口有多个实例需要区分注入时，用 `qualifiers` 定义限定名，注入时配合 `@Qualifier` 使用：

```java
@FeignClient(name = "github-primary", url = "https://api.github.com",
             qualifiers = "githubPrimary")
public interface GitHubClient { }

@Service
public class MyService {
    // 通过 @Qualifier 精确指定注入哪个实例
    @Resource
    @Qualifier("githubPrimary")
    private GitHubClient gitHubClient;
}
```

### primary —— 是否标记为主 Bean

默认为 `true`。当有多个同类型的 Bean 时，Spring 在自动注入时会优先选择 `primary = true` 的那个：

```java
// 主客户端（默认 primary = true，注入时优先选这个）
@FeignClient(name = "github", url = "https://api.github.com")
public interface GitHubClient { }

// 备用客户端
@FeignClient(name = "github-backup", url = "https://backup.github-api.com", primary = false)
public interface GitHubBackupClient { }
```

### configuration —— 自定义配置类

指定一个或多个 `@Configuration` 类，为该客户端提供**专属的**编解码器、拦截器、Contract 等组件：

```java
@FeignClient(name = "paypal", url = "https://api-m.paypal.com",
             configuration = PayPalConfig.class)
public interface PayPalClient {
    @PostMapping("/v2/checkout/orders")
    Order createOrder(@RequestBody OrderRequest request);
}

// 该配置类仅对 PayPalClient 生效
public class PayPalConfig {
    @Bean
    public RequestInterceptor payPalAuthInterceptor() {
        return template -> template.header("Authorization", "Bearer " + payPalToken);
    }

    @Bean
    public Encoder customEncoder() {
        return new JacksonEncoder();
    }

    @Bean
    Logger.Level feignLoggerLevel() {
        return Logger.Level.FULL;
    }
}
```

> **注意**：`configuration` 指定的配置类**不要**加 `@Configuration` 注解，否则会变成全局配置影响所有客户端。

### fallback / fallbackFactory —— 熔断降级

当调用失败时执行降级逻辑。`fallback` 直接返回一个实现类，`fallbackFactory` 能额外获取到失败原因：

```java
// fallback：无法获取异常信息
@FeignClient(name = "github", url = "https://api.github.com",
             fallback = GitHubClientFallback.class)
public interface GitHubClient {
    @GetMapping("/repos/{owner}/{repo}")
    Repo getRepo(@PathVariable String owner, @PathVariable String repo);
}

@Component
public class GitHubClientFallback implements GitHubClient {
    @Override
    public Repo getRepo(String owner, String repo) {
        return new Repo();  // 返回空对象或默认值
    }
}
```

```java
// fallbackFactory：能拿到 Throwable 判断失败原因
@FeignClient(name = "github", url = "https://api.github.com",
             fallbackFactory = GitHubClientFallbackFactory.class)
public interface GitHubClient { }

@Component
public class GitHubClientFallbackFactory implements FallbackFactory<GitHubClient> {
    @Override
    public GitHubClient create(Throwable cause) {
        log.error("GitHub API 调用失败", cause);  // 可以记录异常日志
        return new GitHubClient() {
            @Override
            public Repo getRepo(String owner, String repo) {
                return new Repo();
            }
        };
    }
}
```

> `fallback` 和 `fallbackFactory` 不能同时使用。推荐 `fallbackFactory`，因为可以拿到异常信息用于日志记录和按异常类型做不同降级处理。

### decode404 —— 404 状态码处理

默认为 `false`。当设为 `true` 时，HTTP 404 响应会正常进入 decoder 解码，而不是直接抛异常。适用于某些 API 用 404 表示"资源不存在"作为正常业务逻辑的场景：

```java
@FeignClient(name = "user-api", url = "${user.api.url}", decode404 = true)
public interface UserApi {
    @GetMapping("/users/{id}")
    UserDTO getById(@PathVariable Long id);  // 用户不存在时返回 UserDTO(null) 而不是抛异常
}
```

### dismiss404 —— 将 404 视为空响应

默认为 `false`。与 `decode404` 类似，但 `dismiss404` 会更加激进地将 404 完全视为空响应（返回 null），连 decoder 都不会调用：

```java
@FeignClient(name = "optional-api", url = "${optional.api.url}", dismiss404 = true)
public interface OptionalApi {
    @GetMapping("/data/{id}")
    DataDTO getData(@PathVariable Long id);  // 404 时返回 null
}
```

> `decode404` 和 `dismiss404` 的区别：`decode404=true` 会让 decoder 尝试解析 404 的响应体；`dismiss404=true` 则直接跳过解析返回 null。

---

## 三、方法注解详解

### 3.1 @GetMapping / @PostMapping / @PutMapping / @DeleteMapping — HTTP 方法

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

### 3.2 @RequestMapping — 更灵活的 HTTP 方法声明

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

### 3.3 @PathVariable — 路径参数

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

### 3.4 @RequestParam — 查询参数

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

### 3.5 @RequestBody — 请求体

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

### 3.6 @RequestHeader — 请求头

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

### 3.7 @RequestPart — 文件上传（Multipart）

当需要上传文件时，用 `@RequestPart` 标记文件参数：

```java
public interface FileApi {

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    String upload(@RequestPart("file") MultipartFile file);
}
```

### 3.8 @CollectionFormat — 集合参数格式

控制数组/集合参数序列化为查询参数时的格式（如 CSV 格式）：

```java
public interface UserApi {

    @GetMapping("/users")
    @CollectionFormat(feign.CollectionFormat.CSV)  // ids=1,2,3
    List<UserDTO> batchGet(@RequestParam("ids") List<Long> ids);
}
```

### 3.9 注解速查表

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

## 四、最佳实践

### 4.1 通过 application.yml 统一配置超时

**适用场景**：使用 `@FeignClient` 后，不需要手动 `Feign.builder()`，所有配置都可以通过 `application.yml` 集中管理。

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          # 全局默认配置：对所有 @FeignClient 生效
          default:
            connectTimeout: 5000      # 连接超时（毫秒）
            readTimeout: 30000        # 读取超时（毫秒）
            loggerLevel: BASIC        # 日志级别
          # 针对特定客户端的配置：优先级高于 default
          github:
            connectTimeout: 10000
            readTimeout: 60000
          sms-client:
            connectTimeout: 3000
            readTimeout: 10000
```

> 配置名 `github` 和 `sms-client` 分别对应 `@FeignClient(name = "github")` 和 `@FeignClient(name = "sms-client")` 中的 `name` 属性。

### 4.2 统一认证拦截器（全局生效）

**适用场景**：调用外部 API 时通常需要认证（如 Bearer Token、API Key），通过 `@Bean` 注册一个全局 `RequestInterceptor`，所有 `@FeignClient` 自动生效。

```java
@Configuration
public class FeignConfig {

    @Bean
    public RequestInterceptor bearerAuthInterceptor() {
        return template -> template.header("Authorization", "Bearer " + getToken());
    }

    private String getToken() {
        // 从配置或缓存中获取 token
        return "your-token";
    }
}
```

> 注册为 `@Bean` 后，所有 `@FeignClient` 发出的请求都会自动带上 `Authorization` 头，无需在每个接口上单独设置。

如果只想让某个特定客户端使用拦截器，可以用 `@FeignClient` 的 `configuration` 属性：

```java
@FeignClient(name = "paypal", url = "https://api-m.paypal.com",
             configuration = PayPalConfig.class)
public interface PayPalClient { /* ... */ }

// 独立的配置类，仅 PayPalClient 使用
public class PayPalConfig {
    @Bean
    public RequestInterceptor payPalAuthInterceptor() {
        return template -> template.header("Authorization", "Bearer " + payPalToken);
    }
}
```

### 4.3 自定义 ErrorDecoder 统一错误处理

**适用场景**：外部 API 返回的 HTTP 错误状态码（如 404、429、500）需要转换为业务异常，方便上层统一处理。

```java
@Configuration
public class FeignConfig {

    @Bean
    public ErrorDecoder customErrorDecoder() {
        return new ErrorDecoder() {
            private final ErrorDecoder defaultDecoder = new ErrorDecoder.Default();

            @Override
            public Exception decode(String methodKey, Response response) {
                if (response.status() == 404) {
                    return new NotFoundException("Resource not found");
                }
                if (response.status() == 429) {
                    return new RateLimitException("Rate limited");
                }
                if (response.status() >= 400 && response.status() < 500) {
                    return new BusinessException("Client error: " + response.status());
                }
                return defaultDecoder.decode(methodKey, response);
            }
        };
    }
}
```

> 注册为 `@Bean` 后，所有 `@FeignClient` 都会使用这个 ErrorDecoder。

### 4.4 日志级别控制

**适用场景**：开发阶段需要看到完整的请求/响应内容来排查问题，生产环境则只需记录请求 URL 和耗时。

| 级别 | 说明 | 推荐场景 |
|------|------|---------|
| `NONE` | 不记录（默认） | 生产环境 |
| `BASIC` | 请求方法、URL、状态码、耗时 | 生产环境（推荐） |
| `HEADERS` | BASIC + 请求/响应头 | 开发环境 |
| `FULL` | HEADERS + 请求/响应体 | 调试排查 |

两步配置：

**① 在 `application.yml` 中设置 Feign 日志级别：**

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:
            loggerLevel: BASIC  # 或 FULL / HEADERS / NONE
```

**② 在 `application.yml` 中设置接口包的日志级别为 DEBUG：**

```yaml
logging:
  level:
    com.example.feign: DEBUG  # 设为 DEBUG 才会输出 Feign 日志
```

> 两个配置缺一不可：`loggerLevel` 决定记录什么内容，`logging.level` 决定是否输出。

### 4.5 异常处理

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

### 4.6 多客户端统一管理

**适用场景**：项目需要调用多个不同的外部 API（如 GitHub + 短信服务），每个 API 只需定义一个 `@FeignClient` 接口，通过 `application.yml` 统一管理各自的配置即可。

```java
// 客户端 1：GitHub
@FeignClient(name = "github", url = "https://api.github.com")
public interface GitHubClient {

    @GetMapping("/repos/{owner}/{repo}/contributors")
    List<Contributor> contributors(@PathVariable("owner") String owner,
                                   @PathVariable("repo") String repo);
}

// 客户端 2：短信服务
@FeignClient(name = "sms-client", url = "https://sms-api.example.com")
public interface SmsClient {

    @PostMapping("/sms/send")
    SmsResult send(@RequestBody SmsRequest request);
}
```

对应的 `application.yml` 配置：

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          github:
            connectTimeout: 5000
            readTimeout: 30000
            loggerLevel: BASIC
          sms-client:
            connectTimeout: 3000
            readTimeout: 10000
            loggerLevel: FULL
```

> 使用 `@FeignClient` 后，每个外部 API 就是一个接口文件 + 对应的 yml 配置，结构清晰，无需手动编写配置类。
