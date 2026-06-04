# SpringDoc OpenAPI 文档

SpringDoc OpenAPI 是一个用于自动生成 OpenAPI 3 规范文档的 Java 库，与 Spring Boot 无缝集成。相比已停止维护的 Springfox，SpringDoc 更轻量、更现代，支持零配置启动。

> 本文档基于 **springdoc-openapi-ui v1.8.0**，适用于 **Spring Boot 2.7.x**。v1.8.0 是最后一个支持 Spring Boot 2.x 的开源版本。

---

## 一、SpringDoc vs Springfox

| 特性 | SpringDoc | Springfox |
|------|-----------|-----------|
| 维护状态 | 活跃维护 | 已停止维护 |
| OpenAPI 版本 | 3.0 | 2.0 / 3.0 |
| 配置方式 | 零配置启动 | 需要编写 Docket 配置 |
| Spring Boot 兼容性 | 原生支持 | 兼容性问题多 |
| 注解来源 | `io.swagger.v3.oas.annotations` | `io.swagger.annotations` |

---

## 二、Maven 依赖

```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-ui</artifactId>
    <version>1.8.0</version>
</dependency>
```

---

## 三、快速集成

添加依赖后**无需任何配置**，启动应用即可自动扫描 `@RestController` 和 `@Controller`。

### 访问地址

| 页面 | 地址 |
|------|------|
| Swagger UI | `http://localhost:8080/swagger-ui.html` |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs` |
| OpenAPI YAML | `http://localhost:8080/v3/api-docs.yaml` |

---

## 四、自定义配置

### 4.1 配置 OpenAPI 信息

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("API 文档")
                .version("1.0.0")
                .description("RESTful API 接口文档")
                .contact(new Contact()
                    .name("作者")
                    .url("https://example.com")
                    .email("email@example.com"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://www.apache.org/licenses/LICENSE-2.0")));
    }
}
```

### 4.2 配置 Swagger UI 路径

```yaml
springdoc:
  swagger-ui:
    path: /swagger-ui.html          # Swagger UI 访问路径
  api-docs:
    path: /v3/api-docs             # API 文档 JSON 路径
```

### 4.3 API 分组

当项目较大时，可以按模块分组：

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public GroupedOpenApi userApi() {
        return GroupedOpenApi.builder()
            .group("用户模块")
            .pathsToMatch("/users/**")
            .build();
    }

    @Bean
    public GroupedOpenApi orderApi() {
        return GroupedOpenApi.builder()
            .group("订单模块")
            .pathsToMatch("/orders/**")
            .build();
    }
}
```

---

## 五、常用注解

### 5.1 @Tag

标注在 **Controller 类** 上，描述模块功能。

```java
@Tag(name = "用户管理", description = "用户相关接口")
@RestController
@RequestMapping("/users")
public class UserController {
    // ...
}
```

### 5.2 @Operation

标注在 **方法** 上，描述接口功能。

```java
@Operation(summary = "根据 ID 查询用户", description = "返回用户详细信息")
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    return userService.findById(id);
}
```

### 5.3 @Schema

标注在 **实体类** 上，描述模型信息。

```java
@Schema(description = "用户实体")
public class User {

    @Schema(description = "用户 ID", example = "1")
    private Long id;

    @Schema(description = "用户名", required = true, example = "张三")
    private String username;

    @Schema(description = "密码", hidden = true)
    private String password;
}
```

### 5.4 @Parameter

标注在 **方法参数** 上，描述参数信息。

```java
@GetMapping("/{id}")
public User getUser(
        @Parameter(description = "用户 ID", required = true, example = "1")
        @PathVariable Long id) {
    return userService.findById(id);
}
```

### 5.5 @ApiResponse

描述接口的响应信息。

```java
@Operation(summary = "创建用户")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "成功", content = @Content(schema = @Schema(implementation = User.class))),
    @ApiResponse(responseCode = "400", description = "参数错误"),
    @ApiResponse(responseCode = "500", description = "服务器错误")
})
@PostMapping
public User create(@RequestBody User user) {
    return userService.save(user);
}
```

### 5.6 @Hidden

标注在 **类、方法或参数** 上，表示在文档中忽略该元素。

```java
@Hidden
@GetMapping("/internal")
public String internalApi() {
    return "internal";
}
```

---

## 六、application.yml 配置

```yaml
springdoc:
  swagger-ui:
    path: /swagger-ui.html
    enabled: true
  api-docs:
    path: /v3/api-docs
    enabled: true
```

---

## 七、与 Spring Security 集成

如果项目使用了 Spring Security，需要放行 SpringDoc 相关路径：

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    public void configure(WebSecurity web) throws Exception {
        web.ignoring().antMatchers(
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**",
            "/swagger-resources/**",
            "/webjars/**"
        );
    }
}
```

---

## 八、生产环境关闭

```yaml
springdoc:
  swagger-ui:
    enabled: false
  api-docs:
    enabled: false
```

或通过配置类动态控制：

```java
@Bean
@Profile({"dev", "test"})
public OpenAPI customOpenAPI() {
    return new OpenAPI()
        .info(new Info().title("API 文档").version("1.0.0"));
}
```

---

## 九、注解速查表

| 注解 | 作用位置 | 说明 |
|------|---------|------|
| `@Tag` | Controller 类 | 描述模块功能 |
| `@Operation` | 方法 | 描述接口功能 |
| `@Schema` | 实体类/属性 | 描述模型信息 |
| `@Parameter` | 方法参数 | 描述参数信息 |
| `@ApiResponse` | 方法 | 描述响应信息 |
| `@ApiResponses` | 方法 | 多个响应描述 |
| `@Hidden` | 类/方法/参数 | 忽略该元素 |
