# Interceptor 拦截器

Interceptor 是 Spring MVC 提供的拦截机制，工作在 DispatcherServlet 之后、Controller 之前，可以获取 Spring Bean，适合处理**权限校验、日志记录、性能监控**等与业务相关的操作。

## 一、执行流程

```text
Client ──→ Filter ──→ DispatcherServlet ──→ Interceptor.preHandle() ──→ Controller
                                                ↑
                        ┌───────────────────────┘
                        ↓
          Interceptor.postHandle()
                        ↓
          └──── 响应渲染 ────→ Interceptor.afterCompletion()
```

## 二、HandlerInterceptor 接口

```java
public interface HandlerInterceptor {

    // Controller 执行前（可决定是否放行）
    default boolean preHandle(HttpServletRequest request,
                              HttpServletResponse response,
                              Object handler) throws Exception {
        return true; // true=放行，false=中断
    }

    // Controller 执行后、视图渲染前
    default void postHandle(HttpServletRequest request,
                            HttpServletResponse response,
                            Object handler,
                            @Nullable ModelAndView modelAndView) throws Exception {
    }

    // 请求完成后（视图渲染完毕后）执行，常用于资源清理
    default void afterCompletion(HttpServletRequest request,
                                 HttpServletResponse response,
                                 Object handler,
                                 @Nullable Exception ex) throws Exception {
    }
}
```

### 方法参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `request` | `HttpServletRequest` | HTTP 请求对象 |
| `response` | `HttpServletResponse` | HTTP 响应对象 |
| `handler` | `Object` | 目标处理器（通常是 HandlerMethod） |
| `modelAndView` | `ModelAndView` | Controller 返回的模型视图（`postHandle` 中） |
| `ex` | `Exception` | 异常对象（`afterCompletion` 中；无异常为 null） |

### 返回值说明

- **`preHandle` 返回 `true`**：放行，继续执行后续拦截器和 Controller
- **`preHandle` 返回 `false`**：中断请求，`postHandle` 和 `afterCompletion` 只会调用当前拦截器中返回了 `false` 的拦截器之前的所有拦截器中的 `afterCompletion`

## 三、自定义 Interceptor

### 3.1 Token 认证拦截器

```java
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Component
public class TokenInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        String token = request.getHeader("X-Token");
        if (token == null || token.isEmpty()) {
            response.setStatus(401);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":401,\"message\":\"Token无效\"}");
            return false;  // 中断请求
        }
        // 验证通过后可将用户信息存入 request 属性
        request.setAttribute("loginUser", getUserByToken(token));
        return true;
    }
}
```

### 3.2 性能监控拦截器

```java
@Component
public class PerformanceInterceptor implements HandlerInterceptor {

    private static final ThreadLocal<Long> START_TIME = new ThreadLocal<>();

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        START_TIME.set(System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        Long start = START_TIME.get();
        if (start != null) {
            long duration = System.currentTimeMillis() - start;
            if (duration > 3000) {
                // 超过 3 秒打印慢请求告警
                System.err.println("慢请求: " + request.getRequestURI() + " → " + duration + "ms");
            }
            START_TIME.remove();
        }
    }
}
```

## 四、注册 Interceptor

通过实现 `WebMvcConfigurer` 接口的 `addInterceptors` 方法注册：

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final TokenInterceptor tokenInterceptor;
    private final PerformanceInterceptor performanceInterceptor;

    public WebMvcConfig(TokenInterceptor tokenInterceptor,
                        PerformanceInterceptor performanceInterceptor) {
        this.tokenInterceptor = tokenInterceptor;
        this.performanceInterceptor = performanceInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Token 校验：拦截 /api/** 所有请求
        registry.addInterceptor(tokenInterceptor)
                .addPathPatterns("/api/**")                  // 拦截路径
                .excludePathPatterns("/api/login", "/api/public/**")  // 排除路径
                .order(1);                                   // 执行顺序

        // 性能监控：拦截所有请求
        registry.addInterceptor(performanceInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/static/**", "/error")
                .order(2);
    }
}
```

### InterceptorRegistration 参数说明

| 方法 | 说明 |
|------|------|
| `addPathPatterns(String... patterns)` | 拦截的路径（支持 Ant 风格：`/**`、`/api/*`） |
| `excludePathPatterns(String... patterns)` | 排除的路径 |
| `order(int order)` | 执行顺序，值越小越优先 |

## 五、Interceptor 执行顺序

多个拦截器的执行顺序：

```text
preHandle   →  1 → 2 → 3
postHandle  →  3 → 2 → 1   （逆序）
afterCompletion → 3 → 2 → 1 （逆序）
```

## 六、Filter vs Interceptor

| 维度 | Filter | Interceptor |
|------|--------|-------------|
| 规范 | Servlet 规范 | Spring MVC 框架 |
| 作用范围 | 所有请求（含静态资源） | 经过 DispatcherServlet 的请求 |
| 依赖注入 | 不直接支持 @Autowired | 支持（通过 @Component + 构造注入） |
| 可中断性 | `chain.doFilter()` 放行 | `preHandle` 返回 `false` 中断 |
| Controller 信息 | 不可知 | `handler` 参数可获取方法元数据 |
| 业务场景 | 编码、安全、请求包装 | 权限校验、日志、性能 |
| 执行时机 | 进入 DispatcherServlet 前 | DispatcherServlet 内 |

## 七、速查表

| 类/接口 | 用途 |
|---------|------|
| `HandlerInterceptor` | 拦截器接口，实现 `preHandle`/`postHandle`/`afterCompletion` |
| `WebMvcConfigurer` | 通过 `addInterceptors()` 注册拦截器 |
| `InterceptorRegistry` | 拦截器注册器（`addInterceptor` + 路径匹配） |
| `InterceptorRegistration` | 注册配置（`order`/`addPathPatterns`/`excludePathPatterns`） |
| `HandlerMethod` | 可将 `handler` 参数强转获取 Controller 方法元数据 |