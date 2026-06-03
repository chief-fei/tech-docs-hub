# Filter 过滤器

Filter 是 Servlet 规范中的组件，在请求到达 Servlet（Controller）**之前**和**之后**对请求/响应进行处理。

## 一、执行流程

```text
Client ──→ Filter ──→ Filter ──→ DispatcherServlet ──→ Interceptor ──→ Controller
  ↑          ↑            ↑
  └── 响应按逆序经过各 Filter ───────────────────────────────────────────┘
```

## 二、Filter 生命周期方法

```java
public interface Filter {

    // Filter 被创建时调用（只执行一次），用于初始化
    default void init(FilterConfig filterConfig) throws ServletException {}

    // 每次拦截到请求时调用
    void doFilter(ServletRequest request, ServletResponse response,
                  FilterChain chain) throws IOException, ServletException;

    // Filter 被销毁时调用（只执行一次）
    default void destroy() {}
}
```

### 参数说明

| 方法参数 | 类型 | 说明 |
|---------|------|------|
| `request` | `ServletRequest` | 请求对象，可强制转换为 `HttpServletRequest` |
| `response` | `ServletResponse` | 响应对象，可强制转换为 `HttpServletResponse` |
| `chain` | `FilterChain` | 过滤器链，必须调用 `chain.doFilter()` 放行 |
| `filterConfig` | `FilterConfig` | Filter 配置对象（初始化参数） |

## 三、自定义 Filter

### 3.1 实现 Filter 接口

```java
import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

@Component
public class LogFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // 初始化逻辑（如读取配置参数）
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String uri = httpRequest.getRequestURI();
        System.out.println("请求进入 Filter → " + uri);

        long start = System.currentTimeMillis();
        chain.doFilter(request, response);  // ❗ 必须调用放行
        long end = System.currentTimeMillis();

        System.out.println("请求处理完成 → " + uri + "，耗时：" + (end - start) + "ms");
    }

    @Override
    public void destroy() {
        // 销毁逻辑（应用关闭时释放资源）
    }
}
```

> 如果未调用 `chain.doFilter()`，请求将被阻断，Controller 不会执行。

### 3.2 继承 OncePerRequestFilter

Spring 提供的便捷基类，**保证每个请求只经过一次过滤**（解决内部 forward 导致重复过滤的问题）。推荐使用。

```java
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class AuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
                                    throws ServletException, IOException {
        String token = request.getHeader("X-Token");
        if (token == null || token.isEmpty()) {
            response.setStatus(401);
            response.getWriter().write("{\"code\":401,\"message\":\"未登录\"}");
            return;  // 不放行，直接返回
        }
        filterChain.doFilter(request, response);
    }

    // 排除不需要过滤的路径（可选）
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/public/") || path.startsWith("/login");
    }
}
```

### 3.3 实现 Ordered 接口

多个 Filter 需要控制执行顺序时实现：

```java
@Component
public class FirstFilter extends OncePerRequestFilter implements Ordered {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) {
        // 业务逻辑
        filterChain.doFilter(request, response);
    }

    @Override
    public int getOrder() {
        return 1; // 值越小优先级越高
    }
}
```

## 四、注册 Filter 的三种方式

### 方式一：@Component 直接注册

```java
@Component
public class MyFilter implements Filter { ... }
```

最简单的方式，但拦截路径默认为 `/*`，无法自定义。

### 方式二：FilterRegistrationBean（推荐）

在配置类中通过 `FilterRegistrationBean` 手动注册，**精确控制路径和顺序**。

```java
@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<AuthFilter> authFilterRegistration() {
        FilterRegistrationBean<AuthFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new AuthFilter());
        registration.addUrlPatterns("/api/*");         // 拦截路径
        registration.setOrder(1);                      // 执行顺序
        registration.setName("authFilter");            // Filter 名称
        registration.addInitParameter("excludeUrls", "/api/login,/api/public");
        return registration;
    }
}
```

| FitlerRegistrationBean 参数 | 类型 | 说明 |
|--------------------------|------|------|
| `addUrlPatterns` | `String...` | 拦截的 URL 模式 |
| `setOrder` | `int` | 执行顺序，值越小越优先 |
| `setName` | `String` | Filter 名称 |
| `addInitParameter` | `String, String` | 初始化参数（通过 `FilterConfig` 获取） |
| `setDispatcherTypes` | `EnumSet<DispatcherType>` | 调度类型：REQUEST/FORWARD/INCLUDE/ERROR/ASYNC |

### 方式三：@WebFilter + @ServletComponentScan

```java
@WebFilter(urlPatterns = "/api/*", filterName = "authFilter")
public class AuthFilter extends OncePerRequestFilter { ... }

// 启动类上添加 ↓
@SpringBootApplication
@ServletComponentScan("com.example.filter")
public class Application { ... }
```

### 对比

| 方式 | 路径控制 | 顺序控制 | 推荐场景 |
|------|---------|---------|---------|
| `@Component` | 默认 `/*` | 不支持 | 简单过滤 |
| `FilterRegistrationBean` | ✅ 精确 | ✅ 精确 | **推荐**，生产级 |
| `@WebFilter` | 注解配置 | `@Order` | 简单场景 |

## 五、Filter vs Interceptor

| 维度 | Filter | Interceptor |
|------|--------|-------------|
| 规范 | Servlet 规范 | Spring 框架 |
| 作用范围 | 所有请求（含静态资源） | 仅经过 DispatcherServlet 的请求 |
| 依赖注入 | 不支持 @Autowired | 支持 Spring Bean 注入 |
| 功能 | 请求/响应包装、编码、安全 | 权限校验、日志、性能监控 |
| 执行顺序 | 先于 Interceptor | 后于 Filter |

## 六、速查表

| 类/接口 | 用途 |
|---------|------|
| `javax.servlet.Filter` | Filter 接口，需实现 `doFilter()` |
| `OncePerRequestFilter` | Spring 提供，保证单次执行（推荐） |
| `FilterChain` | 过滤器链，调用 `doFilter()` 放行 |
| `FilterRegistrationBean` | 精确注册 Filter（路径/顺序） |
| `Ordered` | 控制多个 Filter 执行顺序 |
| `@WebFilter` | Servlet 注解方式注册 Filter |
| `@ServletComponentScan` | 配合 `@WebFilter` 扫描包路径 |