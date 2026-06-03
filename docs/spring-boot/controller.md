# Controller & 请求处理

Spring MVC 中，Controller 负责接收 HTTP 请求、解析参数、调用业务逻辑并返回响应。

## 一、Controller 注解

### 1.1 @RestController

`@RestController` = `@Controller` + `@ResponseBody`，每个方法的返回值直接序列化为 JSON 写入响应体。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | Bean 名称 |

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

### 1.2 @Controller

传统 MVC 控制器，方法返回视图名（配合模板引擎使用）。**RESTful API 场景请用 @RestController**。

```java
@Controller
@RequestMapping("/pages")
public class PageController {

    @GetMapping("/home")
    public String home(Model model) {
        model.addAttribute("message", "Hello");
        return "home"; // 返回模板视图名
    }
}
```

## 二、@RequestMapping 详解

`@RequestMapping` 是通用请求映射注解，可标注在类和方法上。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `path` | `String[]` | URL 路径（支持 Ant 风格和 `{变量}` 占位） |
| `method` | `RequestMethod[]` | 限定 HTTP 方法（GET/POST/PUT/DELETE 等） |
| `params` | `String[]` | 限定请求参数条件（如 `"myParam=myValue"`） |
| `headers` | `String[]` | 限定请求头条件（如 `"Content-Type=application/json"`） |
| `consumes` | `String[]` | 限定 Content-Type（如 `"application/json"`） |
| `produces` | `String[]` | 限定 Accept 响应类型（如 `"application/json;charset=UTF-8"`） |

```java
// 精确匹配
@RequestMapping(value = "/user/delete", method = RequestMethod.DELETE)

// 路径变量
@RequestMapping(value = "/user/{id}", method = RequestMethod.GET)

// 限定参数
@RequestMapping(value = "/user/list", params = "page=1")

// 限定响应类型
@RequestMapping(value = "/user/export", produces = "application/pdf")
```

### 快捷注解

Spring 4.3 提供了更简洁的组合注解：

| 注解 | 等价写法 |
|------|---------|
| `@GetMapping("/{id}")` | `@RequestMapping(method = GET, path = "/{id}")` |
| `@PostMapping` | `@RequestMapping(method = POST)` |
| `@PutMapping` | `@RequestMapping(method = PUT)` |
| `@DeleteMapping` | `@RequestMapping(method = DELETE)` |
| `@PatchMapping` | `@RequestMapping(method = PATCH)` |

## 三、参数绑定注解

### 3.1 @PathVariable

从 URL 路径中提取变量。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `name` | `String` | 绑定的路径变量名（默认与参数名一致） |
| `required` | `boolean` | 是否必须（默认 `true`） |

```java
@GetMapping("/users/{userId}/orders/{orderId}")
public Order getOrder(@PathVariable Long userId,
                      @PathVariable("orderId") Long orderId) {
    // userId 自动匹配 {userId}
    // orderId 通过 name 显式指定匹配 {orderId}
}
```

### 3.2 @RequestParam

从 URL 查询参数或表单数据中获取值。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `name` | `String` | HTTP 参数名 |
| `required` | `boolean` | 是否必须（默认 `true`） |
| `defaultValue` | `String` | 默认值 |

```java
@GetMapping("/users")
public List<User> list(@RequestParam(defaultValue = "1") Integer page,
                       @RequestParam(defaultValue = "10") Integer size,
                       @RequestParam(required = false) String keyword) {
    // GET /users?page=2&size=20&keyword=zhang
}
```

### 3.3 @RequestBody

将 HTTP 请求体（JSON/XML）反序列化为 Java 对象。

| 参数 | 类型 | 说明 |
|------|------|------|
| `required` | `boolean` | 是否必须（默认 `true`） |

```java
@PostMapping("/users")
public Result<User> create(@Valid @RequestBody User user) {
    // 自动将 JSON 反序列化为 User 对象
    // @Valid 触发 JSR-303 校验
    return Result.success(userService.save(user));
}
```

### 3.4 @RequestHeader

获取 HTTP 请求头中的值。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `name` | `String` | 请求头名 |
| `required` | `boolean` | 是否必须（默认 `true`） |

```java
@GetMapping("/info")
public String info(@RequestHeader("User-Agent") String userAgent,
                   @RequestHeader(value = "X-Token", required = false) String token) {
    // 获取请求头信息
}
```

### 3.5 @RequestAttribute

从 `HttpServletRequest` 的属性域中获取值（通常由 Filter 或 Interceptor 设置）。

```java
@GetMapping("/current-user")
public User currentUser(@RequestAttribute("loginUser") User loginUser) {
    return loginUser;
}
```

### 3.6 @CookieValue

从 Cookie 中获取值。

```java
@GetMapping("/profile")
public String profile(@CookieValue(value = "JSESSIONID", required = false) String sessionId) {
    // 获取指定 Cookie
}
```

## 四、其他常用注解

### 4.1 @ResponseBody

将方法返回值直接写入 HTTP 响应体。**@RestController 已内置，无需重复标注**。

### 4.2 @ResponseStatus

自定义 HTTP 响应状态码。

```java
@ResponseStatus(HttpStatus.CREATED)
@PostMapping("/users")
public User create(@RequestBody User user) {
    return userService.save(user);
}
```

### 4.3 @CrossOrigin

允许跨域访问，可标注类或方法。

```java
@CrossOrigin(origins = "http://localhost:3000", maxAge = 3600)
@GetMapping("/public/data")
public List<Data> publicData() { ... }
```

### 4.4 @InitBinder

定义数据绑定器，用于自定义参数绑定逻辑。

```java
@InitBinder
public void initBinder(WebDataBinder binder) {
    binder.setDisallowedFields("id"); // 禁止绑定 id 字段
}
```

### 4.5 @ModelAttribute

方法参数：从 Model 中获取或绑定数据。标注方法：每个请求前向 Model 添加属性。

```java
@ModelAttribute
public void addCommonData(Model model) {
    model.addAttribute("appName", "MyApp");
}

@GetMapping("/form")
public String form(@ModelAttribute User user) {
    return "form";
}
```

## 五、统一返回格式

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {
    private Integer code;
    private String message;
    private T data;

    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }
}
```

## 六、速查表

| 注解 | 用途 | 示例 |
|------|------|------|
| `@RestController` | REST 控制器 | `@RestController` |
| `@Controller` | 传统 MVC 控制器 | `@Controller` |
| `@RequestMapping` | 通用请求映射 | `@RequestMapping("/user")` |
| `@GetMapping` | GET 请求 | `@GetMapping("/{id}")` |
| `@PostMapping` | POST 请求 | `@PostMapping` |
| `@PutMapping` | PUT 请求 | `@PutMapping` |
| `@DeleteMapping` | DELETE 请求 | `@DeleteMapping` |
| `@PathVariable` | URL 路径变量 | `@PathVariable Long id` |
| `@RequestParam` | 查询参数 | `@RequestParam(defaultValue="1") int page` |
| `@RequestBody` | 请求体（JSON） | `@RequestBody User user` |
| `@RequestHeader` | 请求头 | `@RequestHeader("User-Agent")` |
| `@CookieValue` | Cookie | `@CookieValue("JSESSIONID")` |
| `@RequestAttribute` | 请求属性 | `@RequestAttribute("loginUser")` |
| `@ResponseBody` | 写入响应体 | `@ResponseBody` |
| `@ResponseStatus` | 自定义状态码 | `@ResponseStatus(HttpStatus.CREATED)` |
| `@CrossOrigin` | 跨域 | `@CrossOrigin(origins = "http://...")` |
| `@InitBinder` | 数据绑定器 | `@InitBinder` |
| `@ModelAttribute` | Model 属性 | `@ModelAttribute` |