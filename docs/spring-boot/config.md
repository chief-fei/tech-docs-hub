# 配置类与属性绑定

Spring Boot 提供了强大的外部化配置和属性绑定机制，支持从 `application.properties`/`application.yml`、环境变量、命令行参数等来源读取配置。

## 一、配置文件

### 1.1 默认加载

Spring Boot 自动加载以下配置文件（按优先级从高到低）：

```
application-{profile}.yml / application-{profile}.properties  （环境特定）
application.yml / application.properties                      （默认）
```

> Spring Boot 2.7.x 默认不加载 `bootstrap.yml`，如需加载需引入 `spring-cloud-starter-bootstrap`。

### 1.2 YAML 示例

```yaml
# application.yml
app:
  name: MyApplication
  datasource:
    url: jdbc:mysql://localhost:3306/mydb
    username: root
    password: ${DB_PASSWORD:123456}  # 支持占位符和默认值
    hikari:
      maximum-pool-size: 20
```

### 1.3 Properties 示例

```properties
app.name=MyApplication
app.datasource.url=jdbc:mysql://localhost:3306/mydb
app.datasource.username=root
app.datasource.password=${DB_PASSWORD:123456}
app.datasource.hikari.maximum-pool-size=20
```

## 二、属性注入

### 2.1 @Value

直接注入单个属性值，支持 SpEL 表达式。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | SpEL 表达式，如 `"${app.name}"` |

```java
@Component
public class AppProperties {

    @Value("${app.name}")
    private String appName;

    @Value("${app.datasource.url}")
    private String dbUrl;

    @Value("${app.feature.enabled:false}")  // 提供默认值
    private boolean featureEnabled;

    // SpEL 表达式
    @Value("#{${app.timeout} * 1000}")  // 将秒转为毫秒
    private long timeoutMs;
}
```

**@Value vs @ConfigurationProperties 对比**：

| 特性 | `@ConfigurationProperties` | `@Value` |
|------|---------------------------|----------|
| 松散绑定（relaxed binding） | ✅ 支持 | ⚠️ 有限支持 |
| 元数据支持（IDE 提示） | ✅ 支持 | ❌ 不支持 |
| SpEL 表达式 | ❌ 不支持 | ✅ 支持 |
| 批量注入 | ✅ 一次注入整个 POJO | ❌ 需逐个字段标注 |
| JSR-303 校验 | ✅ 配合 `@Validated` | ❌ 不支持 |

### 2.2 @ConfigurationProperties（推荐）

将一组配置自动绑定到 POJO 类。

```java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.datasource")
public class DataSourceProperties {
    private String url;
    private String username;
    private String password;
    private HikariProperties hikari = new HikariProperties();

    // getter / setter 必须有

    public static class HikariProperties {
        private Integer maximumPoolSize;

        // getter / setter
    }
}
```

| @ConfigurationProperties 参数 | 类型 | 说明 |
|---------------------------|------|------|
| `prefix` | `String` | 配置前缀（如 `"app.datasource"`） |
| `ignoreInvalidFields` | `boolean` | 是否忽略类型不匹配的字段（默认 `false`） |
| `ignoreUnknownFields` | `boolean` | 是否忽略未知字段（默认 `true`） |

#### 松散绑定规则

Spring Boot 支持以下命名风格的互相转换：

```text
app.datasource.maximum-pool-size     ← kebab-case（推荐）
app.datasource.maximumPoolSize       ← camelCase
app.datasource.maximum_pool_size     ← snake_case
APP_DATASOURCE_MAXIMUM_POOL_SIZE     ← UPPER_CASE（环境变量）
```

#### 启用 ConfigurationProperties

方式一：`@Component` + `@ConfigurationProperties`（自动注册）

```java
@Component
@ConfigurationProperties(prefix = "app.datasource")
public class DataSourceProperties { ... }
```

方式二：`@EnableConfigurationProperties`（推荐，无需 `@Component`）

```java
@ConfigurationProperties(prefix = "app.datasource")
@Validated  // 开启 JSR-303 校验
public class DataSourceProperties {
    @NotNull
    private String url;
    // ...
}

// 在配置类或启动类上启用
@Configuration
@EnableConfigurationProperties(DataSourceProperties.class)
public class AppConfig { }
```

### 2.3 JSR-303 校验

配合 `@Validated` 对配置属性进行校验：

```java
@ConfigurationProperties(prefix = "app.datasource")
@Validated
public class DataSourceProperties {
    @NotNull(message = "数据库 URL 不能为空")
    private String url;

    @NotBlank
    private String username;

    @Min(1)
    @Max(100)
    private Integer maximumPoolSize;
}
```

## 三、@Configuration 配置类

```java
@Configuration
public class AppConfig {

    // 代理模式（默认）：@Bean 方法间的调用会走容器而非直接 Java 调用
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

> Spring Boot 2.7.x 中 `@Configuration` 默认使用 `proxyBeanMethods = true`（CGLIB 代理），确保单例语义。

### proxyBeanMethods 对比

| 模式 | 说明 | 场景 |
|------|------|------|
| `proxyBeanMethods = true`（默认） | CGLIB 代理，`@Bean` 方法调用走容器 | 存在 Bean 间依赖时必须使用 |
| `proxyBeanMethods = false` | 普通 Java 调用（Lite 模式），性能更好 | 无需 Bean 间依赖时 |

```java
@Configuration(proxyBeanMethods = false)
public class AppConfig {
    // 轻量级配置，Bean 方法间无依赖
    @Bean
    public A beanA() { return new A(); }

    @Bean
    public B beanB() { return new B(); }
}
```

## 四、多环境配置

### 4.1 application-{profile}.yml

```yaml
# application-dev.yml
app:
  datasource:
    url: jdbc:mysql://localhost:3306/dev_db

# application-prod.yml
app:
  datasource:
    url: jdbc:mysql://prod-server:3306/prod_db
```

### 4.2 激活 Profile

```yaml
# application.yml
spring:
  profiles:
    active: dev  # 或通过命令行: --spring.profiles.active=prod
```

```bash
java -jar app.jar --spring.profiles.active=prod
```

### 4.3 @Profile 注解

根据当前 Profile 决定是否创建 Bean：

```java
@Configuration
public class ProfileConfig {

    @Bean
    @Profile("dev")
    public DataSource devDataSource() { ... }

    @Bean
    @Profile("prod")
    public DataSource prodDataSource() { ... }
}
```

## 五、配置优先级

Spring Boot 从以下来源加载配置（**优先级从高到低**，数字越小优先级越高）：

1. 命令行参数（`--server.port=9000`）
2. `SPRING_APPLICATION_JSON` 环境变量
3. JNDI 属性（`java:comp/env`）
4. `System.getProperties()`
5. 操作系统环境变量
6. `application-{profile}.yml`（外部）
7. `application-{profile}.yml`（classpath 内部）
8. `application.yml`（外部）
9. `application.yml`（classpath 内部）
10. `@PropertySource` 导入的配置

### @PropertySource

加载自定义配置文件：

```java
@Configuration
@PropertySource("classpath:custom.properties")
@PropertySource("file:/etc/app/config.properties")  // 外部文件
public class CustomConfig {
    @Value("${custom.key}")
    private String customValue;
}
```

> YAML 文件不能用 `@PropertySource` 加载，只能用于 `application.yml` 及其 profile 文件。

## 六、随机值

```properties
app.secret=${random.value}
app.number=${random.int}
app.long-number=${random.long}
app.uuid=${random.uuid}
app.port=${random.int(1024,65535)}
```

## 七、速查表

| 注解 / 类 | 用途 |
|----------|------|
| `@Value` | 注入单个属性（支持 SpEL） |
| `@ConfigurationProperties` | 批量绑定配置到 POJO |
| `@EnableConfigurationProperties` | 启用指定配置类 |
| `@Validated` | 开启配置属性的 JSR-303 校验 |
| `@Configuration` | 声明配置类 |
| `@Profile` | 按环境决定是否创建 Bean |
| `@PropertySource` | 加载自定义 `.properties` 文件 |
| `@ConditionalOnProperty` | 按属性条件装配 Bean |