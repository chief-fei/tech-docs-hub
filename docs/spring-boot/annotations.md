# Spring Boot 注解速查手册

本文汇总 Spring Boot 2.7.x 业务开发中最常用的注解及其参数。

## 一、启动与核心注解

| 注解 | 参数 | 说明 |
|------|------|------|
| `@SpringBootApplication` | `exclude`, `excludeName`, `scanBasePackages` | 组合：`@SpringBootConfiguration` + `@EnableAutoConfiguration` + `@ComponentScan` |
| `@EnableAutoConfiguration` | `exclude`, `excludeName` | 启用自动配置，排除指定配置类用 `exclude` |
| `@ComponentScan` | `basePackages`, `basePackageClasses`, `includeFilters`, `excludeFilters` | 指定组件扫描范围 |

## 二、Controller & Web 层注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@RestController` | `value`（Bean 名） | `@Controller` + `@ResponseBody`，返回 JSON |
| `@Controller` | `value` | 传统 MVC 控制器，返回视图名 |
| `@RequestMapping` | `value`/`path`, `method`, `params`, `headers`, `consumes`, `produces` | 通用请求映射 |
| `@GetMapping` | `value`/`path`, `params`, `headers`, `consumes`, `produces` | GET 请求映射 |
| `@PostMapping` | 同上 | POST 请求映射 |
| `@PutMapping` | 同上 | PUT 请求映射 |
| `@DeleteMapping` | 同上 | DELETE 请求映射 |
| `@PatchMapping` | 同上 | PATCH 请求映射 |
| `@PathVariable` | `value`/`name`, `required`(默认 true) | 提取 URL 路径中的变量 |
| `@RequestParam` | `value`/`name`, `required`(默认 true), `defaultValue` | 提取查询参数 |
| `@RequestBody` | `required`(默认 true) | 将请求体 JSON 反序列化为 Java 对象 |
| `@RequestHeader` | `value`/`name`, `required`(默认 true) | 提取 HTTP 请求头 |
| `@CookieValue` | `value`/`name`, `required`(默认 true) | 提取 Cookie |
| `@RequestAttribute` | `value`/`name`, `required`(默认 true) | 提取 request 域属性 |
| `@ModelAttribute` | `value`/`name`, `binding` | 绑定或添加 Model 数据 |
| `@ResponseBody` | — | 返回值写入响应体 |
| `@ResponseStatus` | `value`(HttpStatus), `code`, `reason` | 自定义 HTTP 响应状态码 |
| `@CrossOrigin` | `origins`, `methods`, `allowedHeaders`, `allowCredentials`, `maxAge` | 跨域访问 |
| `@InitBinder` | `value` | 自定义参数绑定器 |
| `@Valid` | — | 触发 JSR-303 校验（参数校验） |
| `@Validated` | `value`（分组接口） | Spring 校验注解，支持分组校验 |

## 三、Filter & Interceptor 注解

| 注解 / 类 | 关键参数 | 说明 |
|----------|---------|------|
| `@WebFilter` | `filterName`, `urlPatterns`, `initParams`, `dispatcherTypes` | 声明式 Filter 注册（需配合 `@ServletComponentScan`） |
| `@ServletComponentScan` | `basePackages`, `value` | 扫描 `@WebFilter`、`@WebListener` |
| `@Order` | `value`(int) | 控制拦截器执行顺序 |
| `OncePerRequestFilter` | — | Spring 提供，保证单次过滤 |
| `WebMvcConfigurer` | — | 通过 `addInterceptors()` 注册拦截器 |
| `HandlerInterceptor` | — | 拦截器接口：`preHandle`/`postHandle`/`afterCompletion` |

## 四、异常处理注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@ControllerAdvice` | `basePackages`, `basePackageClasses`, `assignableTypes`, `annotations` | 全局 Controller 异常增强 |
| `@RestControllerAdvice` | 同上 | `@ControllerAdvice` + `@ResponseBody` |
| `@ExceptionHandler` | `value`(Class<?>[]) | 声明处理何种异常 |
| `@ResponseStatus` | `value`, `reason` | 标注在异常类上，指定 HTTP 状态码 |

## 五、事务注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@Transactional` | 见下方 | 声明式事务 |
| `@EnableTransactionManagement` | `proxyTargetClass`, `mode`, `order` | 手动启用事务管理（Spring Boot 已自动） |

### @Transactional 完整参数

| 参数 | 类型 | 默认值 |
|------|------|--------|
| `propagation` | `Propagation` | `REQUIRED` |
| `isolation` | `Isolation` | `DEFAULT` |
| `timeout` | `int` | `-1`（不超时） |
| `readOnly` | `boolean` | `false` |
| `rollbackFor` | `Class<?>[]` | `{}` |
| `noRollbackFor` | `Class<?>[]` | `{}` |
| `transactionManager` | `String` | `""` |

## 六、AOP 注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@Aspect` | `value` | 声明切面类 |
| `@Pointcut` | `value`(表达式) | 定义切入点 |
| `@Before` | `value`/`pointcut` | 前置通知 |
| `@After` | `value`/`pointcut` | 后置通知（finally） |
| `@AfterReturning` | `value`/`pointcut`, `returning`(绑定返回值) | 返回通知 |
| `@AfterThrowing` | `value`/`pointcut`, `throwing`(绑定异常) | 异常通知 |
| `@Around` | `value`/`pointcut` | 环绕通知 |
| `@Order` | `value`(int) | 切面执行顺序 |

## 七、Bean 管理注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@Component` | `value`(Bean 名) | 通用 Bean 组件 |
| `@Service` | `value` | 业务层 Bean |
| `@Repository` | `value` | 数据访问层 Bean，异常翻译 |
| `@Controller` | `value` | 控制器 Bean |
| `@Bean` | `name`/`value`, `initMethod`, `destroyMethod`, `autowireCandidate` | 方法级 Bean 声明 |
| `@Configuration` | `proxyBeanMethods`(默认 true), `value` | 配置类 |
| `@Autowired` | `required`(默认 true) | 按类型自动装配 |
| `@Qualifier` | `value`(Bean 名) | 按名称精确装配 |
| `@Primary` | — | 标记首选 Bean |
| `@Resource` | `name`, `type`, `lookup`, `authenticationType` | JSR-250 注入 |
| `@Scope` | `value`(scopeName), `proxyMode` | Bean 作用域 |
| `@Lazy` | `value`(默认 true) | 延迟初始化 |
| `@PostConstruct` | — | 初始化回调 |
| `@PreDestroy` | — | 销毁回调 |
| `@DependsOn` | `value`(bean names) | 声明 Bean 依赖顺序 |

## 八、配置与属性注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@Value` | `value`(SpEL) | 注入单个属性 |
| `@ConfigurationProperties` | `prefix`, `ignoreInvalidFields`, `ignoreUnknownFields` | 批量绑定配置 |
| `@EnableConfigurationProperties` | `value`(Class<?>[]) | 启用指定配置类 |
| `@Profile` | `value`(profile name) | 环境条件注解 |
| `@PropertySource` | `value`(path), `ignoreResourceNotFound`, `encoding` | 加载自定义 properties |
| `@ConditionalOnClass` | `value`, `name` | classpath 条件 |
| `@ConditionalOnMissingClass` | `value`, `name` | 类缺失条件 |
| `@ConditionalOnBean` | `value`, `type`, `name`, `search`, `parameterizedContainer` | Bean 存在条件 |
| `@ConditionalOnMissingBean` | 同上 | Bean 缺失条件 |
| `@ConditionalOnProperty` | `name`, `prefix`, `havingValue`, `matchIfMissing` | 属性条件 |
| `@ConditionalOnExpression` | `value`(SpEL) | SpEL 表达式条件 |
| `@ConditionalOnWebApplication` | `type` (SERVLET/REACTIVE/ANY) | Web 环境条件 |

## 九、任务调度注解

| 注解 | 关键参数 | 说明 |
|------|---------|------|
| `@Scheduled` | `cron`, `fixedDelay`, `fixedRate`, `initialDelay`, `timeUnit` | 定时任务 |
| `@EnableScheduling` | — | 启用定时任务 |
| `@Async` | `value`(线程池名称) | 异步方法 |
| `@EnableAsync` | `proxyTargetClass`, `mode`, `order` | 启用异步执行 |

## 十、其他常用注解

| 注解 | 说明 |
|------|------|
| `@SpringBootTest` | 集成测试 |
| `@DataJpaTest` | JPA 测试（自动回滚） |
| `@JdbcTest` | JDBC 测试（自动回滚） |
| `@WebMvcTest` | MVC 切片测试 |
| `@MockBean` | Mockito Mock Bean |
| `@SpyBean` | Mockito Spy Bean |
| `@Slf4j` | Lombok 日志 |
| `@Data` | Lombok: `@Getter`+`@Setter`+`@ToString`+`@EqualsAndHashCode`+`@RequiredArgsConstructor` |
| `@Builder` | Lombok: 建造者模式 |
| `@AllArgsConstructor` | Lombok: 全参构造 |
| `@NoArgsConstructor` | Lombok: 无参构造 |