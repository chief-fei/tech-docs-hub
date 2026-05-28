# OpenFeign 使用指南

OpenFeign 是声明式 HTTP 客户端，接口 + 注解定义远程调用。

## 一、入门

### Maven 依赖

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

### 启动类

```java
@EnableFeignClients
@SpringBootApplication
public class Application { }
```

### 定义 FeignClient

```java
@FeignClient(
    name = "user-service",        // 服务名（注册到 Nacos）
    path = "/api/users"           // 公共路径前缀
)
public interface UserClient {

    @GetMapping("/{id}")
    UserDTO getById(@PathVariable Long id);

    @PostMapping
    Result<Long> create(@RequestBody UserCreateCmd cmd);

    @PutMapping("/{id}")
    Result<Void> update(@PathVariable Long id, @RequestBody UserUpdateCmd cmd);

    @DeleteMapping("/{id}")
    Result<Void> delete(@PathVariable Long id);

    @GetMapping
    PageResult<UserDTO> list(
        @RequestParam Integer page,
        @RequestParam Integer size
    );
}
```

### 直接调用

```java
@Autowired
private UserClient userClient;

UserDTO user = userClient.getById(1001L);
```

## 二、@FeignClient 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `name` | 服务名（必填） | `"user-service"` |
| `url` | 直连 URL（跳过注册中心） | `"http://localhost:8080"` |
| `path` | 路径前缀 | `"/api/users"` |
| `contextId` | 服务同名时区分 | `"user-v2"` |
| `configuration` | 自定义配置类 | `FeignConfig.class` |
| `fallback` | 降级类 | `UserClientFallback.class` |
| `fallbackFactory` | 降级工厂（可获取异常） | `UserFallbackFactory.class` |

## 三、参数注解

| 注解 | 说明 | 示例 |
|------|------|------|
| `@PathVariable` | 路径参数 | `@GetMapping("/{id}")` |
| `@RequestParam` | 查询参数 | `@RequestParam("page")` |
| `@RequestHeader` | 请求头 | `@RequestHeader("Authorization")` |
| `@RequestBody` | 请求体 JSON | `@RequestBody UserCmd cmd` |
| `@SpringQueryMap` | 对象转 Query 参数 | `@SpringQueryMap UserQuery q` |

## 四、超时与重试

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:                  # 全局
            connect-timeout: 3000
            read-timeout: 5000
          user-service:             # 指定服务
            connect-timeout: 2000
            read-timeout: 10000
      compression:
        request:
          enabled: true
          min-request-size: 2048
        response:
          enabled: true
```

## 五、拦截器（Token 传递）

```java
@Bean
public RequestInterceptor authInterceptor() {
    return tpl -> {
        String token = AuthContext.getToken();
        if (token != null) tpl.header("Authorization", "Bearer " + token);
    };
}
```

## 六、日志

```yaml
logging:
  level:
    com.example.client.UserClient: DEBUG

spring:
  cloud:
    openfeign:
      client:
        config:
          default:
            logger-level: FULL       # NONE/BASIC/HEADERS/FULL
```

## 七、熔断降级

```java
@FeignClient(
    name = "user-service",
    fallbackFactory = UserClientFallbackFactory.class
)

@Component
public class UserFallbackFactory implements FallbackFactory<UserClient> {
    public UserClient create(Throwable cause) {
        return new UserClient() {
            public UserDTO getById(Long id) {
                return UserDTO.fallback();  // 降级返回
            }
        };
    }
}
```
