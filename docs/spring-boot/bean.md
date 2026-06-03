# Bean 管理与注入

Spring IoC 容器负责管理 Bean 的生命周期和依赖注入。Spring Boot 通过 `@ComponentScan` 自动扫描并注册 Bean。

## 一、Bean 声明注解

### 1.1 核心声明注解

| 注解 | 说明 | 层级 |
|------|------|------|
| `@Component` | 通用组件，Spring 管理的 Bean | 通用 |
| `@Service` | 业务逻辑层组件 | Service 层 |
| `@Repository` | 数据访问层组件，自动翻译持久层异常 | DAO/Repository 层 |
| `@Controller` | 控制器组件（Spring MVC） | Controller 层 |
| `@RestController` | REST 控制器 = `@Controller` + `@ResponseBody` | Controller 层 |
| `@Configuration` | 配置类，内部 `@Bean` 方法会被 Spring 管理 | 配置层 |

> `@Service`、`@Repository`、`@Controller` 本质上都是 `@Component` 的特化。`@Repository` 额外提供持久层异常转换功能。

### 1.2 @ComponentScan

Spring Boot 默认扫描启动类所在包及其子包。如需扫描额外包：

```java
@SpringBootApplication
@ComponentScan(basePackages = {"com.example", "com.thirdparty"})
public class Application { ... }
```

### 1.3 @Bean

在 `@Configuration` 类中通过方法声明 Bean，适合引入第三方库中的类。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `name` | `String[]` | Bean 名称（可多个别名） |
| `initMethod` | `String` | 初始化方法名 |
| `destroyMethod` | `String` | 销毁方法名 |
| `autowireCandidate` | `boolean` | 是否作为自动装配候选（默认 `true`） |

```java
@Configuration
public class AppConfig {

    @Bean(name = "myRestTemplate")
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean(initMethod = "start", destroyMethod = "stop")
    public DataSource customDataSource() {
        return new HikariDataSource();
    }
}
```

## 二、依赖注入方式

Spring 推荐使用**构造器注入**，官方也正逐步推行此方式。

### 2.1 构造器注入（推荐）

```java
@Service
public class UserService {

    private final UserMapper userMapper;  // final 保证不可变性

    // Spring 4.3+ 单构造器无需写 @Autowired
    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }
}
```

**优点**：不可变性（`final`）、依赖清晰、易于单元测试、避免循环依赖。

### 2.2 @Autowired 字段注入

```java
@Service
public class UserService {

    @Autowired
    private UserMapper userMapper;  // 字段注入
}
```

**缺点**：破坏封装性、无法声明 `final`、单元测试需要反射注入。

### 2.3 @Autowired Setter 注入

```java
@Service
public class UserService {

    private UserMapper userMapper;

    @Autowired  // 可选依赖时使用 required = false
    public void setUserMapper(UserMapper userMapper) {
        this.userMapper = userMapper;
    }
}
```

### 2.4 多构造器场景需显式 @Autowired

```java
@Service
public class UserService {

    private final UserMapper userMapper;
    private final LogService logService;

    // 无参构造
    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
        this.logService = null;
    }

    @Autowired  // ❗ 必须标明，否则 Spring 不知道用哪个
    public UserService(UserMapper userMapper, LogService logService) {
        this.userMapper = userMapper;
        this.logService = logService;
    }
}
```

## 三、@Autowired 详解

### 3.1 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `required` | `boolean` | 是否必须（默认 `true`）。设为 `false` 时找不到 Bean 不会抛异常 |

```java
@Autowired(required = false)
private OptionalService optionalService;  // 可选依赖
```

### 3.2 装配策略

当有多个同类型 Bean 时，Spring 按以下优先级装配：

1. 按 **类型** 匹配
2. 类型匹配多个时，按 **名称** 匹配（`@Qualifier` 指定或参数名匹配）
3. 仍无法决定时，使用 `@Primary` 标记的 Bean

### 3.3 @Qualifier

有多个同类型 Bean 时通过名称精确指定：

```java
@Configuration
public class AppConfig {
    @Bean("userCache")
    public Cache<String, User> userCache() {
        return new LocalCache<>();
    }

    @Bean("orderCache")
    public Cache<String, Order> orderCache() {
        return new LocalCache<>();
    }
}

@Service
public class UserService {
    private final Cache<String, User> cache;

    public UserService(@Qualifier("userCache") Cache<String, User> cache) {
        this.cache = cache;
    }
}
```

### 3.4 @Primary

有多个同类型 Bean 时，标记一个为首选：

```java
@Configuration
public class AppConfig {
    @Bean
    @Primary  // 没有 @Qualifier 时默认装配这个
    public UserService userServiceImplA() {
        return new UserServiceImplA();
    }

    @Bean
    public UserService userServiceImplB() {
        return new UserServiceImplB();
    }
}
```

### 3.5 @Autowired 注入集合

可一次性注入同类型的所有 Bean：

```java
@Component
public class TaskRunner {

    @Autowired
    private List<Task> tasks;  // 注入所有 Task 接口的实现 Bean

    @Autowired
    private Map<String, Task> taskMap;  // Bean 名 → Bean 实例

    public void runAll() {
        tasks.forEach(Task::execute);
    }
}
```

## 四、@Resource 和 @Inject

| 注解 | 来源 | 装配方式 |
|------|------|---------|
| `@Autowired` | Spring | 默认按类型，配合 `@Qualifier` 按名称 |
| `@Resource` | JSR-250（JDK 内置） | 默认按名称，找不到再按类型 |
| `@Inject` | JSR-330 | 同 `@Autowired`，需额外引入依赖 |

```java
@Resource(name = "userCache")
private Cache<String, User> cache;
```

## 五、Bean 作用域

| 作用域 | 说明 |
|--------|------|
| `singleton`（默认） | 单例，整个 IoC 容器只有一个实例 |
| `prototype` | 原型，每次获取都创建新实例 |
| `request` | 每个 HTTP 请求一个实例（Web 环境） |
| `session` | 每个 HTTP 会话一个实例（Web 环境） |
| `application` | 每个 ServletContext 一个实例（Web 环境） |

```java
@Component
@Scope("prototype")  // 或 @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
public class TaskProcessor { ... }
```

> 注意：`prototype` Bean 的生命周期由调用者管理，Spring 不负责销毁。

## 六、Bean 生命周期回调

| 注解 | 说明 |
|------|------|
| `@PostConstruct` | 依赖注入完成后执行（JSR-250） |
| `@PreDestroy` | Bean 销毁前执行（JSR-250） |

```java
@Component
public class DataInitializer {

    @PostConstruct
    public void init() {
        System.out.println("Bean 初始化完成，开始加载数据...");
    }

    @PreDestroy
    public void destroy() {
        System.out.println("Bean 即将销毁，释放资源...");
    }
}
```

也可通过 `@Bean` 的 `initMethod`/`destroyMethod` 属性指定：

```java
@Bean(initMethod = "init", destroyMethod = "destroy")
public MyService myService() {
    return new MyService();
}
```

## 七、@Conditional 条件注解

| 注解 | 说明 |
|------|------|
| `@ConditionalOnClass` | classpath 中存在指定类时才装配 |
| `@ConditionalOnMissingClass` | classpath 中不存在指定类时才装配 |
| `@ConditionalOnBean` | 存在指定 Bean 时才装配 |
| `@ConditionalOnMissingBean` | 不存在指定 Bean 时才装配 |
| `@ConditionalOnProperty` | 指定属性有特定值时才装配 |
| `@ConditionalOnResource` | 存在指定资源文件时才装配 |
| `@ConditionalOnExpression` | SpEL 表达式为 true 时才装配 |
| `@ConditionalOnWebApplication` | 在 Web 环境中才装配 |

```java
@Configuration
public class ConditionalConfig {

    @Bean
    @ConditionalOnMissingBean(UserService.class)
    public UserService defaultUserService() {
        return new DefaultUserService();  // 用户没有自定义时才生效
    }

    @Bean
    @ConditionalOnProperty(name = "feature.cache.enabled", havingValue = "true")
    public CacheService cacheService() {
        return new RedisCacheService();  // feature.cache.enabled=true 才启用缓存
    }
}
```

## 八、速查表

| 注解 | 用途 |
|------|------|
| `@Component` | 通用组件 |
| `@Service` | 业务层组件 |
| `@Repository` | 数据访问层组件 |
| `@Controller` / `@RestController` | 控制器组件 |
| `@Bean` | 方法级 Bean 声明 |
| `@Configuration` | 配置类声明 |
| `@Autowired` | 自动装配（按类型） |
| `@Qualifier` | 按名称精确装配 |
| `@Primary` | 标记首选 Bean |
| `@Resource` | JSR-250 注入（按名称优先） |
| `@Scope` | 声明 Bean 作用域 |
| `@PostConstruct` | 初始化回调 |
| `@PreDestroy` | 销毁回调 |
| `@ComponentScan` | 组件扫描包路径 |
| `@ConditionalOnClass` | classpath 条件注解 |
| `@ConditionalOnMissingBean` | 缺失 Bean 条件注解 |
| `@ConditionalOnProperty` | 属性条件注解 |