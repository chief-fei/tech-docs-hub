# Swagger API 文档

Swagger 是一个规范和完整的框架，用于生成、描述、调用和可视化 RESTful 风格的 Web 服务。Spring Boot 集成 Swagger 后，可以自动生成 API 文档并提供在线测试界面。

> 本文档基于 **Springfox 3.0** 版本，适用于 **Spring Boot 2.7.x**。

## 一、快速集成

### 1.1 添加 Maven 依赖

```xml
<dependency>
    <groupId>io.springfox</groupId>
    <artifactId>springfox-boot-starter</artifactId>
    <version>3.0.0</version>
</dependency>
```

### 1.2 启用 Swagger

Springfox 3.0 支持自动配置，只需添加依赖即可。如需显式启用，可在启动类添加 `@EnableOpenApi`：

```java
@SpringBootApplication
@EnableOpenApi
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 1.3 访问 Swagger UI

启动应用后，访问以下地址：

| 页面 | 地址 |
|------|------|
| Swagger UI | `http://localhost:8080/swagger-ui/index.html` |
| API JSON 文档 | `http://localhost:8080/v2/api-docs` |

## 二、核心配置类

### 2.1 Docket 配置

`Docket` 是 Springfox 的核心配置类，用于定义 API 文档的分组、扫描包路径、过滤规则等。

```java
@Configuration
public class SwaggerConfig {

    @Bean
    public Docket createRestApi() {
        return new Docket(DocumentationType.OAS_30)
                .apiInfo(apiInfo())
                .select()
                .apis(RequestHandlerSelectors.basePackage("com.example.controller"))
                .paths(PathSelectors.any())
                .build();
    }

    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
                .title("API 文档")
                .description("RESTful API 接口文档")
                .version("1.0.0")
                .contact(new Contact("作者", "https://example.com", "email@example.com"))
                .build();
    }
}
```

**Docket 常用方法：**

| 方法 | 说明 |
|------|------|
| `apiInfo(ApiInfo)` | 设置 API 元信息（标题、描述、版本等） |
| `select()` | 创建 API 选择器 |
| `groupName(String)` | 设置分组名称 |
| `ignoredApis(Collection<String>)` | 忽略指定路径的 API |

**API 选择器常用方法：**

| 方法 | 说明 |
|------|------|
| `apis(Predicate<RequestHandler>)` | 按包路径或注解过滤 Controller |
| `paths(Predicate<String>)` | 按路径过滤接口 |

### 2.2 API 分组

当项目较大时，可以按模块对 API 进行分组：

```java
@Configuration
public class SwaggerConfig {

    @Bean
    public Docket userApi() {
        return new Docket(DocumentationType.OAS_30)
                .groupName("用户模块")
                .select()
                .apis(RequestHandlerSelectors.basePackage("com.example.user.controller"))
                .paths(PathSelectors.any())
                .build();
    }

    @Bean
    public Docket orderApi() {
        return new Docket(DocumentationType.OAS_30)
                .groupName("订单模块")
                .select()
                .apis(RequestHandlerSelectors.basePackage("com.example.order.controller"))
                .paths(PathSelectors.any())
                .build();
    }
}
```

## 三、常用注解

### 3.1 @Api

标注在 **Controller 类** 上，描述该模块的功能。

| 参数 | 类型 | 说明 |
|------|------|------|
| `tags` | `String` | 模块标签（显示在 Swagger UI 分组） |
| `value` | `String` | 模块描述（已废弃，推荐使用 tags） |

```java
@Api(tags = "用户管理")
@RestController
@RequestMapping("/users")
public class UserController {
    // ...
}
```

### 3.2 @ApiOperation

标注在 **方法** 上，描述接口的功能。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | 接口简要描述 |
| `notes` | `String` | 接口详细说明 |
| `httpMethod` | `String` | HTTP 方法（GET/POST/PUT/DELETE） |

```java
@ApiOperation(value = "根据 ID 查询用户", notes = "返回用户详细信息")
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    return userService.findById(id);
}
```

### 3.3 @ApiParam

标注在 **方法参数** 上，描述参数信息。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | 参数描述 |
| `required` | `boolean` | 是否必填 |
| `defaultValue` | `String` | 默认值 |
| `example` | `String` | 示例值 |

```java
@GetMapping("/{id}")
public User getUser(
        @ApiParam(value = "用户 ID", required = true, example = "1")
        @PathVariable Long id) {
    return userService.findById(id);
}
```

### 3.4 @ApiModel

标注在 **实体类** 上，描述模型信息。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | 模型名称 |
| `description` | `String` | 模型描述 |

```java
@ApiModel(description = "用户实体")
public class User {
    // ...
}
```

### 3.5 @ApiModelProperty

标注在 **实体类属性** 上，描述字段信息。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | 字段描述 |
| `required` | `boolean` | 是否必填 |
| `example` | `String` | 示例值 |
| `hidden` | `boolean` | 是否隐藏（不在文档中显示） |
| `readOnly` | `boolean` | 是否只读 |

```java
@ApiModel(description = "用户实体")
public class User {

    @ApiModelProperty(value = "用户 ID", example = "1")
    private Long id;

    @ApiModelProperty(value = "用户名", required = true, example = "张三")
    private String username;

    @ApiModelProperty(value = "密码", hidden = true)
    private String password;
}
```

### 3.6 @ApiIgnore

标注在 **类、方法或参数** 上，表示在文档中忽略该元素。

```java
@ApiIgnore
@GetMapping("/internal")
public String internalApi() {
    return "internal";
}

@GetMapping("/users")
public List<User> list(@ApiIgnore @RequestHeader String token) {
    return userService.list();
}
```

### 3.7 @ApiResponse 和 @ApiResponses

描述接口的响应信息。

```java
@ApiOperation(value = "创建用户")
@ApiResponses({
    @ApiResponse(code = 200, message = "成功", response = User.class),
    @ApiResponse(code = 400, message = "参数错误"),
    @ApiResponse(code = 500, message = "服务器错误")
})
@PostMapping
public User create(@RequestBody User user) {
    return userService.save(user);
}
```

## 四、application.yml 配置

```yaml
springfox:
  documentation:
    enabled: true  # 是否启用 Swagger，生产环境建议关闭
    auto-startup: true
    swagger-ui:
      enabled: true
      base-url: /swagger-ui
```

## 五、与 Spring Security 集成

如果项目使用了 Spring Security 或自定义拦截器，需要放行 Swagger 相关路径：

### 5.1 Spring Security 配置

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    public void configure(WebSecurity web) throws Exception {
        web.ignoring().antMatchers(
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v2/api-docs/**",
            "/v3/api-docs/**",
            "/swagger-resources/**",
            "/webjars/**"
        );
    }
}
```

### 5.2 拦截器配置

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor())
                .addPathPatterns("/**")
                .excludePathPatterns(
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v2/api-docs/**",
                    "/swagger-resources/**",
                    "/webjars/**"
                );
    }
}
```

## 六、注解速查表

| 注解 | 作用位置 | 说明 |
|------|---------|------|
| `@Api` | Controller 类 | 描述模块功能 |
| `@ApiOperation` | 方法 | 描述接口功能 |
| `@ApiParam` | 方法参数 | 描述参数信息 |
| `@ApiModel` | 实体类 | 描述模型信息 |
| `@ApiModelProperty` | 实体类属性 | 描述字段信息 |
| `@ApiIgnore` | 类/方法/参数 | 忽略该元素 |
| `@ApiResponse` | 方法 | 描述响应信息 |
| `@ApiResponses` | 方法 | 多个响应描述 |

## 七、常见问题

### 7.1 Spring Boot 2.6+ 路径匹配问题

Spring Boot 2.6 默认使用 `PathPatternParser`，与 Springfox 不兼容。需要在 `application.yml` 中配置：

```yaml
spring:
  mvc:
    pathmatch:
      matching-strategy: ant_path_matcher
```

### 7.2 生产环境关闭 Swagger

```yaml
springfox:
  documentation:
    enabled: false
```

或通过配置类动态控制：

```java
@Bean
@Profile({"dev", "test"})  # 仅在开发/测试环境启用
public Docket createRestApi() {
    return new Docket(DocumentationType.OAS_30)
            .select()
            .apis(RequestHandlerSelectors.basePackage("com.example.controller"))
            .paths(PathSelectors.any())
            .build();
}
```
