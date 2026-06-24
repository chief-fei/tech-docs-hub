# 自定义参数解析器

参数解析器（Argument Resolver）是 Spring MVC 提供的扩展机制，用于**自定义 Controller 方法参数的填充逻辑**。内置的 `@RequestParam`、`@PathVariable`、`@RequestBody` 等本质上都是由对应的参数解析器完成填充；当这些满足不了需求时，可以实现 `HandlerMethodArgumentResolver` 自定义任意参数的来源。

> 典型场景：从请求头 Token 解析出登录用户、注入当前租户、注入签名校验结果等。

## 一、执行原理

DispatcherServlet 在调用 Controller 方法前，需要为方法的每个参数找到合适的值，这个过程由一系列 `HandlerMethodArgumentResolver` 完成：

```text
请求 ──→ DispatcherServlet
              │
              ▼
     遍历方法参数 parameters[]
              │
              ▼
   对每个参数：按注册顺序找到第一个 supportsParameter()=true 的解析器
              │
              ▼
   调用 resolveArgument() 得到参数值 ──→ 注入 Controller 方法
```

- **内置解析器**：负责 `@RequestParam`、`@PathVariable`、`@RequestBody`、`@RequestHeader`、`HttpServletRequest` 等常见参数（详见 [Controller](./controller)）。
- **自定义解析器**：实现 `HandlerMethodArgumentResolver` 接口，并通过 `WebMvcConfigurer.addArgumentResolvers()` 注册。

## 二、HandlerMethodArgumentResolver 接口

```java
package org.springframework.web.method.support;

public interface HandlerMethodArgumentResolver {

    // 是否支持解析该参数（通常根据参数上的注解 + 参数类型判断）
    boolean supportsParameter(MethodParameter parameter);

    // 真正解析参数值
    @Nullable
    Object resolveArgument(MethodParameter parameter,
                           @Nullable ModelAndViewContainer mavContainer,
                           NativeWebRequest webRequest,
                           @Nullable WebDataBinderFactory binderFactory) throws Exception;
}
```

### 方法说明

| 方法 / 参数 | 说明 |
|-------------|------|
| `supportsParameter` | 返回 `true` 表示当前解析器负责该参数。通常用 `parameter.hasParameterAnnotation(Xxx.class)` 判断参数是否标注了某个注解 |
| `resolveArgument` | 解析并返回参数值，该返回值会注入到 Controller 方法形参 |
| `parameter` | 当前方法参数的元信息（类型、注解等），`MethodParameter` |
| `mavContainer` | 模型视图容器，一般无需使用 |
| `webRequest` | 当前 Web 请求，可从中获取 `HttpServletRequest`、请求头、参数等 |
| `binderFactory` | 数据绑定工厂，一般无需使用 |

> 只有 `supportsParameter` 返回 `true` 时，`resolveArgument` 才会被调用。

## 三、实战：Token 解析为登录用户

需求：Controller 方法中需要当前登录用户时，不必在每个方法里手动读请求头、解析 Token，而是用一个 `@LoginUser` 注解直接拿到 `LoginUser` 对象。

### 3.1 自定义注解 @LoginUser

```java
package com.example.resolver;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标注在 Controller 方法参数上，表示该参数需要注入登录用户
 */
@Target(ElementType.PARAMETER)        // 只能标注在参数上
@Retention(RetentionPolicy.RUNTIME)   // 运行时保留，解析器才能读取到
public @interface LoginUser {

    /** 是否必须登录（默认 true）；false 时未登录返回 null，不抛异常 */
    boolean required() default true;
}
```

| 元注解 | 作用 |
|--------|------|
| `@Target(ElementType.PARAMETER)` | 限定注解只能标注在方法参数上 |
| `@Retention(RetentionPolicy.RUNTIME)` | 运行时保留，反射（解析器）才能读到 |

### 3.2 登录用户持有类

```java
package com.example.resolver;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginUser {

    /** 用户 ID */
    private Long userId;

    /** 用户名 */
    private String username;
}
```

### 3.3 Token 解析工具

```java
package com.example.resolver;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class TokenUtils {

    /**
     * 解析 Token 为登录用户
     *
     * 演示格式：token = Base64("userId:username")
     * 真实项目可替换为 JWT(jjwt) 或 Sa-Token 的解析逻辑，解析器结构无需改动
     */
    public static LoginUser parse(String token) {
        try {
            String decoded = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);
            String[] parts = decoded.split(":");
            Long userId = Long.valueOf(parts[0]);
            String username = parts[1];
            return new LoginUser(userId, username);
        } catch (Exception e) {
            throw new BusinessException(401, "Token 非法或已过期");
        }
    }
}
```

> 提示：演示用的 Token 格式仅用于学习。生产环境通常使用 **JWT**（推荐 `jjwt`）或 **Sa-Token**（见 [Sa-Token](../dev-tools/sa-token)），解析失败统一抛业务异常，由[全局异常处理器](./exception)转为 401 响应。

### 3.4 自定义解析器

```java
package com.example.resolver;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import javax.servlet.http.HttpServletRequest;

@Component
public class LoginUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        // 参数标注了 @LoginUser 且类型是 LoginUser（或其父类）时才接管
        return parameter.hasParameterAnnotation(LoginUser.class)
                && LoginUser.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) throws Exception {

        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        String token = request.getHeader("X-Token");

        LoginUser loginUser = (token == null || token.isEmpty()) ? null : TokenUtils.parse(token);

        boolean required = parameter.getParameterAnnotation(LoginUser.class).required();
        if (required && loginUser == null) {
            throw new BusinessException(401, "未携带 Token，请先登录");
        }
        return loginUser;
    }
}
```

| 关键点 | 说明 |
|--------|------|
| `hasParameterAnnotation` | 判断参数是否标注 `@LoginUser`，是则接管该参数 |
| `getNativeRequest` | 从 `NativeWebRequest` 获取原生 `HttpServletRequest` |
| `getHeader("X-Token")` | 读取请求头中的 Token（与 [Interceptor](./interceptor) 示例保持一致） |
| 抛业务异常 | 解析失败抛 `BusinessException`，由全局异常处理器统一返回，避免返回 null 造成后续 NPE |

### 3.5 注册解析器

通过实现 `WebMvcConfigurer` 的 `addArgumentResolvers` 方法注册：

```java
package com.example.config;

import com.example.resolver.LoginUserArgumentResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final LoginUserArgumentResolver loginUserArgumentResolver;

    public WebMvcConfig(LoginUserArgumentResolver loginUserArgumentResolver) {
        this.loginUserArgumentResolver = loginUserArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(loginUserArgumentResolver);
    }
}
```

### 3.6 Controller 使用

```java
@RestController
@RequestMapping("/user")
public class UserController {

    @GetMapping("/profile")
    public Result<LoginUser> profile(@LoginUser LoginUser loginUser) {
        // loginUser 由 LoginUserArgumentResolver 自动注入
        return Result.success(loginUser);
    }

    @GetMapping("/optional")
    public Result<String> optional(@LoginUser(required = false) LoginUser loginUser) {
        // 未登录时 loginUser 为 null，不抛异常
        String name = loginUser == null ? "游客" : loginUser.getUsername();
        return Result.success(name);
    }
}
```

请求示例：

```text
GET /user/profile
X-Token: MTAwMTphbGljZQ==    （即 Base64("1001:alice")）

响应：
{ "code": 200, "message": "success", "data": { "userId": 1001, "username": "alice" } }
```

## 四、实战二：按类型解析（无注解）

实战一通过 `@LoginUser` 注解触发解析；本例改为**仅凭参数类型**匹配——只要 Controller 方法形参类型是 `LoginUser`（无需任何注解），就自动解析为登录用户。

### 4.1 自定义解析器（按类型）

```java
package com.example.resolver;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import javax.servlet.http.HttpServletRequest;

@Component
public class LoginUserByTypeArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        // 仅按参数类型判断，不检查任何注解
        return LoginUser.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) throws Exception {

        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        String token = request.getHeader("X-Token");

        LoginUser loginUser = (token == null || token.isEmpty()) ? null : TokenUtils.parse(token);
        if (loginUser == null) {
            throw new BusinessException(401, "未携带 Token，请先登录");
        }
        return loginUser;
    }
}
```

> 与注解版相比，唯一的区别在 `supportsParameter`：不再调用 `hasParameterAnnotation(LoginUser.class)`，而是直接判断参数类型是否为 `LoginUser`（或其子类）。

### 4.2 注册解析器

在同一个 `WebMvcConfig` 中追加该解析器（`loginUserByTypeArgumentResolver` 字段同样通过构造注入）：

```java
@Override
public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
    resolvers.add(loginUserArgumentResolver);          // 注解版（实战一）
    resolvers.add(loginUserByTypeArgumentResolver);   // 类型版（实战二）
}
```

> 说明：两个解析器**不会同时为同一个 `LoginUser` 参数生效**——`HandlerMethodArgumentResolverComposite` 按列表顺序取第一个 `supportsParameter` 返回 `true` 的解析器。类型版的 `supportsParameter` 对任何 `LoginUser` 参数都返回 `true`，会「吃掉」注解版。**实际项目二选一即可**，此处并列仅为展示。

### 4.3 Controller 使用（无注解）

```java
@RestController
@RequestMapping("/user")
public class UserController {

    // 形参无需任何注解，直接由 LoginUserByTypeArgumentResolver 按类型注入
    @GetMapping("/profile")
    public Result<LoginUser> profile(LoginUser loginUser) {
        return Result.success(loginUser);
    }
}
```

### 4.4 注解方案 vs 类型方案

| 维度 | 注解方案（`@LoginUser`） | 类型方案（无注解） |
|------|--------------------------|--------------------|
| 触发方式 | 形参标注 `@LoginUser` | 形参类型为 `LoginUser` |
| 选择性 | 可逐参数选择，灵活 | 对所有 `LoginUser` 参数全局生效 |
| 可读性 | 注解显式，意图明确 | 形参更简洁，但需知晓「魔法」来源 |
| 适用类型 | 任意类型（含标准类型） | 仅推荐自定义类型 |

注意事项：
- **全局生效**：类型方案会对项目中所有 `LoginUser` 形参生效，无法像注解那样逐方法开关。
- **内置注解优先级更高**：若参数标注了 `@RequestBody`、`@RequestParam` 等，会由对应的注解类内置解析器（排在前置）优先处理，类型解析器不会干扰——例如 `@RequestBody LoginUser` 仍走 JSON 反序列化。
- **仅对自定义类型可靠**：标准类型（`Map`、`HttpServletRequest`、`String`、`int` 等）会被前置的内置解析器抢先接管，类型解析器无法生效。关于解析器的精确顺序，见下一节。

## 五、注册顺序与注意事项

- **解析顺序**：通过 `addArgumentResolvers` 注册的自定义解析器，被插在「注解类内置解析器」（`@RequestParam`、`@PathVariable`、`@RequestBody` 等）与「兜底解析器」（`ModelAttributeMethodProcessor`，会对无注解 POJO 做表单绑定）**之间**。因此：自定义类型或自定义注解都能正常生效；自定义解析器**不会**抢走标注了内置注解的参数，但**会**优先于兜底的 ModelAttribute——这正是上一节按类型解析 `LoginUser` 能生效的原因。
- **失败处理**：必传参数解析失败时，应**抛异常**而非返回 `null`，由[全局异常处理](./exception)统一转为响应；可选参数通过 `required = false` 控制是否抛异常。
- **职责分离（推荐）**：鉴权「门禁」交给[拦截器](./interceptor)统一拦截，参数解析器只负责把已验证的用户**注入**到方法参数中，两者各司其职。

## 六、与 @RequestAttribute 方案对比

获取登录用户的常见做法有两种，对比如下：

| 维度 | 拦截器 + `@RequestAttribute("loginUser")` | 自定义参数解析器 `@LoginUser` |
|------|------------------------------------------|-------------------------------|
| 实现方式 | 拦截器解析 Token 后 `request.setAttribute()` | 解析器直接解析 Token |
| 鉴权与解析 | 耦合在拦截器中 | 解析器负责注入，鉴权可独立交给拦截器 |
| 适用范围 | 必须先经过拦截器设置属性 | 自带解析逻辑，不依赖拦截器 |
| 灵活性 | 固定属性名 | 可定义 `required` 等参数，按需控制 |
| 推荐场景 | 鉴权与用户信息绑定、逻辑简单 | 参数可配置、多来源、解耦要求高 |

## 七、速查表

| 类 / 接口 / 注解 | 用途 |
|------------------|------|
| `HandlerMethodArgumentResolver` | 参数解析器接口，实现 `supportsParameter` + `resolveArgument` |
| `MethodParameter` | 方法参数元信息，可获取类型与注解 |
| `NativeWebRequest` | 当前 Web 请求，`getNativeRequest()` 获取原生 `HttpServletRequest` |
| `WebMvcConfigurer` | 通过 `addArgumentResolvers()` 注册自定义解析器 |
| `@Target(PARAMETER)` | 限定注解只能标注在参数上 |
| `@Retention(RUNTIME)` | 运行时保留注解，解析器才能通过反射读取 |
