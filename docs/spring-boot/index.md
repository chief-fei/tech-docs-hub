# Spring Boot 2.7.x 核心使用指南

Spring Boot 2.7.x 是 Spring Boot 2.x 系列的最终生产版（最终版本 2.7.18），提供了自动配置、起步依赖和嵌入式服务器等特性，大幅简化了 Spring 应用的搭建和开发。

> 本文档基于 **Spring Boot 2.7.x** 版本，配套使用 **JDK 1.8** 或以上。

## Maven 坐标

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>
```

## 核心 Starter

| Starter | 说明 |
|---------|------|
| `spring-boot-starter-web` | Web 应用（Spring MVC + 嵌入式 Tomcat） |
| `spring-boot-starter-aop` | AOP 支持（AspectJ） |
| `spring-boot-starter-validation` | 参数校验（JSR-303/Hibernate Validator） |
| `spring-boot-starter-jdbc` | JDBC + 事务管理 |
| `spring-boot-starter-data-jpa` | JPA + Hibernate |

## 文档目录

| 主题 | 说明 |
|------|------|
| [Controller & 请求处理](./controller) | @RestController、@RequestMapping、参数绑定 |
| [自定义参数解析器](./argument-resolver) | HandlerMethodArgumentResolver、@LoginUser 注入登录用户 |
| [Filter 过滤器](./filter) | 实现 Filter、OncePerRequestFilter、注册方式 |
| [Interceptor 拦截器](./interceptor) | HandlerInterceptor、路径匹配、执行顺序 |
| [全局异常处理](./exception) | @ControllerAdvice、@ExceptionHandler、统一响应 |
| [事务管理](./transaction) | @Transactional 参数详解、传播行为、隔离级别 |
| [AOP 切面编程](./aop) | @Aspect、@Before、@After、@Around |
| [Bean 管理与注入](./bean) | @Bean、@Component、@Autowired 注入方式 |
| [配置类与属性绑定](./config) | @Configuration、@ConfigurationProperties、@Value |
| [javax.validation 校验](./validation) | 参数校验注解、@Validated、@Valid 使用 |
| [自定义 Starter](./custom-starter) | 完整创建流程、自动配置、条件注解、实战示例 |
| [注解速查手册](./annotations) | 业务常用注解速查，含参数解析 |

## 自动配置原理

Spring Boot 的 `@SpringBootApplication` 是一个组合注解：

```
@SpringBootApplication
├── @SpringBootConfiguration    # 标记为配置类
├── @EnableAutoConfiguration    # 启用自动配置
└── @ComponentScan              # 组件扫描
```

- **@EnableAutoConfiguration**：通过 `spring.factories` 加载各 Starter 的自动配置类
- **自动配置入口**：`META-INF/spring.factories` → `XXXAutoConfiguration`（2.7.x 同时支持 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`）
- **条件注解**：`@ConditionalOnClass`、`@ConditionalOnMissingBean`、`@ConditionalOnProperty` 等按需启用
- **自定义 Starter**：遵循以上自动配置规则，可将任意功能封装为 Starter，详见 [自定义 Starter](./custom-starter)

## 版本注意事项

- Spring Boot 2.7.x 中 `javax.*` 仍为标准包名（3.x 迁移为 `jakarta.*`）
- 事务代理默认使用 CGLIB（`spring.aop.proxy-target-class=true` 默认匹配）
- Spring Boot 2.7.18 为 2.x 系列最终版，建议使用此版本
- **自动配置注册机制**：Spring Boot 2.7.x 同时支持 `META-INF/spring.factories` 和新的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 两种方式，方便向 3.x 迁移
- 2.7.x 是 3.x 迁移的准备版本，建议逐步将 `spring.factories` 中的自动配置类迁移到新的 imports 文件格式
