# Sa-Token 1.37.x 完全指南

## 概述

Sa-Token 是一个轻量级 Java 权限认证框架，主要解决登录认证、权限验证、Session 会话、单点登录、OAuth2 等一系列权限相关问题。相比 Spring Security 和 Shiro，Sa-Token 的 API 调用非常简单，学习成本极低。

> **兼容性**：Sa-Token 1.37.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

### 框架对比

| 对比维度 | Sa-Token | Spring Security | Shiro |
|---------|----------|----------------|-------|
| 上手难度 | 🟢 极低 | 🔴 高 | 🟡 中 |
| API 简洁度 | 🟢 一行代码搞定 | 🔴 配置复杂 | 🟡 中 |
| 注解鉴权 | 🟢 支持 | 🟢 支持 | 🟢 支持 |
| OAuth2 | 🟢 内置 | 🟡 需 Spring Security OAuth2 | 🔴 需额外集成 |
| 分布式 Session | 🟢 内置 Redis 支持 | 🔴 需 Spring Session | 🔴 需额外配置 |
| 文档质量 | 🟢 详细 | 🟢 官方文档丰富 | 🟡 中 |

---

## 一、快速开始

### 1.1 Maven 依赖

```xml
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-spring-boot-starter</artifactId>
    <version>1.37.0</version>
</dependency>
```

### 1.2 application.yml

```yaml
# Sa-Token 配置
sa-token:
  # Token 名称（同时也是 Cookie 名称）
  token-name: satoken
  # Token 有效期（秒），默认 30 天
  timeout: 2592000
  # Token 临时有效期（指定时间内无操作则过期）
  activity-timeout: -1
  # 是否允许同一账号并发登录
  is-concurrent: true
  # 是否共享同一账号的 Token
  is-share: true
  # Token 风格
  token-style: uuid
  # 是否输出操作日志
  is-log: true
```

### 1.3 第一个登录示例

```java
@RestController
@RequestMapping("/api")
public class LoginController {

    /**
     * 登录
     */
    @PostMapping("/login")
    public Result<String> login(@RequestBody LoginRequest request) {
        // 1. 校验用户名密码（略）
        if (!"admin".equals(request.getUsername()) || !"123456".equals(request.getPassword())) {
            return Result.error("账号或密码错误");
        }

        // 2. 执行登录（一行代码）
        StpUtil.login(10001);  // 参数为 userId

        // 3. 返回 Token
        String token = StpUtil.getTokenValue();
        return Result.success(token);
    }

    /**
     * 检查登录状态
     */
    @GetMapping("/isLogin")
    public Result<Boolean> isLogin() {
        return Result.success(StpUtil.isLogin());
    }

    /**
     * 退出登录
     */
    @PostMapping("/logout")
    public Result<String> logout() {
        StpUtil.logout();
        return Result.success("退出成功");
    }
}
```

---

## 二、登录认证

### 2.1 StpUtil 核心方法

| 方法 | 说明 |
|------|------|
| `StpUtil.login(id)` | 登录，参数为账号 ID |
| `StpUtil.logout()` | 退出当前会话 |
| `StpUtil.logout(id)` | 踢出指定账号 |
| `StpUtil.isLogin()` | 是否已登录 |
| `StpUtil.getLoginId()` | 获取当前登录账号 ID |
| `StpUtil.getLoginIdAsString()` | 获取 String 类型的账号 ID |
| `StpUtil.getLoginIdAsLong()` | 获取 Long 类型的账号 ID |
| `StpUtil.getLoginIdAsInt()` | 获取 Int 类型的账号 ID |
| `StpUtil.getTokenValue()` | 获取当前 Token 值 |
| `StpUtil.getTokenInfo()` | 获取当前 Token 详细信息 |

### 2.2 自定义登录逻辑

```java
@Component
public class StpInterfaceImpl implements StpInterface {

    /**
     * 返回指定账号的权限码集合
     */
    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        // 从数据库查询权限列表
        List<String> list = new ArrayList<>();
        list.add("user:add");
        list.add("user:update");
        list.add("user:delete");
        return list;
    }

    /**
     * 返回指定账号的角色集合
     */
    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        // 从数据库查询角色列表
        List<String> list = new ArrayList<>();
        list.add("admin");
        list.add("super-admin");
        return list;
    }
}
```

### 2.3 多账号体系

Sa-Token 支持多账号体系（如：用户端、管理端分开）：

```java
// 用户端登录
StpUtil.login(10001);
StpUtil.logout();

// 管理端登录（使用 loginType 区分）
StpAdminUtil.login(10001);
StpAdminUtil.logout();
```

---

## 三、权限验证

### 3.1 注解鉴权

```java
@RestController
@RequestMapping("/api/user")
public class UserController {

    /**
     * 必须登录才能访问
     */
    @SaCheckLogin
    @GetMapping("/profile")
    public Result<UserVO> profile() {
        Long userId = StpUtil.getLoginIdAsLong();
        return Result.success(userService.getById(userId));
    }

    /**
     * 必须具备指定权限才能访问
     */
    @SaCheckPermission("user:add")
    @PostMapping
    public Result<String> addUser(@RequestBody UserDTO dto) {
        userService.add(dto);
        return Result.success("添加成功");
    }

    /**
     * 必须具备任一权限（OR 逻辑）
     */
    @SaCheckPermission(value = {"user:update", "user:admin"}, mode = SaMode.OR)
    @PutMapping
    public Result<String> updateUser(@RequestBody UserDTO dto) {
        userService.update(dto);
        return Result.success("更新成功");
    }

    /**
     * 必须具备指定角色
     */
    @SaCheckRole("admin")
    @DeleteMapping("/{id}")
    public Result<String> deleteUser(@PathVariable Long id) {
        userService.delete(id);
        return Result.success("删除成功");
    }

    /**
     * 具备任一角色
     */
    @SaCheckRole(value = {"admin", "super-admin"}, mode = SaMode.OR)
    @GetMapping("/list")
    public Result<List<UserVO>> listUsers() {
        return Result.success(userService.list());
    }

    /**
     * 二级认证（敏感操作需再次验证密码）
     */
    @SaCheckSafe
    @PostMapping("/reset-password")
    public Result<String> resetPassword(@RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request);
        return Result.success("重置成功");
    }
}
```

### 3.2 代码鉴权

```java
// 判断是否登录
StpUtil.isLogin();

// 判断是否具有指定权限
StpUtil.hasPermission("user:add");

// 校验权限（不通过则抛出异常）
StpUtil.checkPermission("user:add");

// 判断是否具有指定角色
StpUtil.hasRole("admin");

// 校验角色
StpUtil.checkRole("admin");

// 判断是否具有任一权限
StpUtil.hasPermissionOr("user:add", "user:update");

// 判断是否具有全部权限
StpUtil.hasPermissionAnd("user:add", "user:update");
```

---

## 四、Session 管理

### 4.1 Token 会话

```java
// 登录后，Sa-Token 自动创建会话

// 获取当前会话
SaSession session = StpUtil.getSession();

// 设置会话属性
session.set("username", "admin");
session.set("loginTime", new Date());

// 获取会话属性
String username = (String) session.get("username");

// 获取指定账号的会话
SaSession userSession = StpUtil.getSessionByLoginId(10001);
```

### 4.2 自定义 Session 存储

```java
// 获取 Token 专属 Session
SaSession tokenSession = StpUtil.getTokenSession();

// 获取自定义 Session
SaSession customSession = SaSessionCustomUtil.getSessionById("custom-key");
customSession.set("data", "value");
```

---

## 五、Redis 集成（分布式 Session）

### 5.1 Maven 依赖

```xml
<!-- Sa-Token Redis 集成 -->
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-redis-jackson</artifactId>
    <version>1.37.0</version>
</dependency>

<!-- Spring Boot Redis -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 5.2 application.yml

```yaml
spring:
  redis:
    host: localhost
    port: 6379
    password:
    database: 0

sa-token:
  # 使用 Redis 存储 Token
  alone-redis:
    host: localhost
    port: 6379
    database: 1
```

---

## 六、JWT 集成（无状态认证）

### 6.1 Maven 依赖

```xml
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-jwt</artifactId>
    <version>1.37.0</version>
</dependency>
```

### 6.2 配置

```yaml
sa-token:
  # JWT 密钥
  jwt-secret-key: abcdefghijklmnopqrstuvwxyz123456
```

### 6.3 使用方式

```java
// 登录（与普通模式完全一样）
StpUtil.login(10001);

// 获取 Token（此时返回的是 JWT 字符串）
String token = StpUtil.getTokenValue();
// 格式：eyJhbGciOiJIUzI1NiJ9.eyJsb2dpbklkIjoiMTAwMDEi...

// 前端将 Token 放在请求头中
// Authorization: Bearer eyJhbGciOi...
```

::: warning JWT 模式的限制
JWT 模式下 Token 是无状态的，服务端无法主动踢人下线、无法修改 Token 有效期。如需这些功能，请使用 Redis 模式。
:::

---

## 七、OAuth2 集成

### 7.1 授权码模式

```java
// 第一步：构建授权 URL，引导用户跳转
String authorizeUrl = SaOAuth2Util.buildAuthorizeUrl(
    "http://oauth-server.com/oauth2/authorize",
    "client_id",
    "http://client.com/callback"
);

// 第二步：回调接口，用授权码换取 Access Token
@GetMapping("/oauth2/callback")
public Result<String> callback(@RequestParam String code) {
    // 用 code 换取 access_token
    SaOAuth2AccessToken token = SaOAuth2Util.getAccessToken(
        "http://oauth-server.com/oauth2/token",
        "client_id",
        "client_secret",
        code
    );
    return Result.success(token.getAccessToken());
}
```

### 7.2 密码模式

```java
// 直接使用用户名密码获取 Token
SaOAuth2AccessToken token = SaOAuth2Util.getAccessTokenByPassword(
    "http://oauth-server.com/oauth2/token",
    "client_id",
    "client_secret",
    "username",
    "password"
);
```

---

## 八、路由拦截器（全局鉴权）

### 8.1 配置拦截器

```java
@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {

    /**
     * 注册 Sa-Token 路由拦截器
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new SaInterceptor(handler -> {
            // 所有路由都需要登录
            SaRouter.match("/**")
                .check(r -> StpUtil.checkLogin());

            // 排除登录接口
            SaRouter.notMatch("/api/login")
                .notMatch("/api/register")
                .notMatch("/api/public/**");

            // 指定路由需要特定权限
            SaRouter.match("/api/admin/**")
                .check(r -> StpUtil.checkPermission("admin"));

            SaRouter.match("/api/user/**")
                .check(r -> StpUtil.checkRoleOr("admin", "user"));
        }))
        .addPathPatterns("/**")
        .excludePathPatterns("/api/login", "/api/register", "/api/public/**");
    }
}
```

### 8.2 注解注册拦截器

```java
@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注解鉴权拦截器
        registry.addInterceptor(new SaInterceptor())
            .addPathPatterns("/**");
    }
}
```

---

## 九、账号踢人与封禁

### 9.1 强制下线

```java
// 将指定账号踢下线
StpUtil.logout(10001);

// 将指定账号踢下线（指定 Token）
StpUtil.logoutByTokenValue("token-value");

// 封禁账号（禁止登录）
StpUtil.disable(10001, 3600);  // 封禁 3600 秒
```

### 9.2 封禁检查

```java
// 检查是否被封禁
StpUtil.isDisable(10001);

// 解封账号
StpUtil.untieDisable(10001);
```

---

## 十、Spring Boot 2.7.x 完整集成示例

### 10.1 项目结构

```text
src/main/java/com/example/demo/
├── config/
│   ├── SaTokenConfigure.java      # 拦截器配置
│   └── StpInterfaceImpl.java       # 权限加载
├── controller/
│   └── AuthController.java         # 登录/注册
├── entity/
│   └── User.java
├── service/
│   └── UserService.java
└── DemoApplication.java
```

### 10.2 权限加载实现

```java
@Component
public class StpInterfaceImpl implements StpInterface {

    @Autowired
    private UserService userService;

    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        Long userId = Long.valueOf(loginId.toString());
        return userService.getUserPermissions(userId);
    }

    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        Long userId = Long.valueOf(loginId.toString());
        return userService.getUserRoles(userId);
    }
}
```

### 10.3 登录 Controller

```java
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    /**
     * 用户登录
     */
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody LoginRequest request) {
        // 验证码校验（略）

        // 校验用户名密码
        User user = userService.getByUsername(request.getUsername());
        if (user == null || !user.getPassword().equals(request.getPassword())) {
            return Result.error("账号或密码错误");
        }

        // 检查账号状态
        if (user.getStatus() == 0) {
            return Result.error("账号已被禁用");
        }

        // 执行登录
        StpUtil.login(user.getId());

        // 获取 Token
        String token = StpUtil.getTokenValue();

        // 返回 Token 和用户信息
        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("userInfo", userService.toVO(user));
        return Result.success(result);
    }

    /**
     * 获取当前用户信息
     */
    @SaCheckLogin
    @GetMapping("/user/info")
    public Result<UserVO> getUserInfo() {
        Long userId = StpUtil.getLoginIdAsLong();
        return Result.success(userService.getUserVO(userId));
    }

    /**
     * 退出登录
     */
    @SaCheckLogin
    @PostMapping("/logout")
    public Result<String> logout() {
        StpUtil.logout();
        return Result.success("退出成功");
    }
}
```

### 10.4 前端调用示例

```javascript
// 登录
const login = async () => {
  const res = await axios.post('/api/login', {
    username: 'admin',
    password: '123456'
  });
  // 保存 Token
  localStorage.setItem('token', res.data.data.token);
};

// 后续请求带 Token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['satoken'] = token;  // 默认 Header 名
  }
  return config;
});
```

---

## 十一、常见问题

**Q: Token 存放在 Cookie 还是 Header 中？**

默认情况下，Sa-Token 会把 Token 同时放在 Cookie 和响应体中。前后端分离项目建议使用 Header 方式传递 Token。

**Q: 如何修改 Token 传递的 Header 名称？**

```yaml
sa-token:
  token-name: Authorization   # 改为 Authorization
```

**Q: Token 过期了怎么办？**

Sa-Token 会在每次请求时判断 Token 是否过期。如果设置了 `activity-timeout`，只要用户保持活跃，Token 就不会过期。

```yaml
sa-token:
  timeout: 604800              # 7 天绝对过期
  activity-timeout: 1800       # 30 分钟无操作则过期
```

**Q: 跨域问题怎么解决？**

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowedHeaders("*")
            .allowCredentials(true);
    }
}
```

**Q: Sa-Token 与 Spring Security 能共存吗？**

可以共存，但强烈不推荐。两者功能重叠，同时使用会增加复杂度。

**Q: 如何实现"记住我"功能？**

设置更长的 `timeout`：

```java
// 登录时设置更长的有效期
StpUtil.login(10001, 60 * 60 * 24 * 30);  // 30 天
```

---

## 参考资源

- [Sa-Token 官方文档](https://sa-token.cc/)
- [Sa-Token GitHub](https://github.com/dromara/Sa-Token)
- [Spring Boot 2.7.x 文档](../spring-boot/)