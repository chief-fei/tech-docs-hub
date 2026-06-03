# Druid 1.2.x 完全指南

## 概述

Druid 是阿里巴巴开源的高性能数据库连接池，提供了强大的监控和扩展能力。相比 HikariCP，Druid 内置了 SQL 监控、SQL 防火墙、Web 监控页面等功能，是生产环境的最佳选择。

> **兼容性**：Druid 1.2.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

### Druid vs HikariCP

| 对比维度 | Druid | HikariCP |
|---------|-------|----------|
| 性能 | 🟢 优秀 | 🟢 非常优秀 |
| SQL 监控 | 🟢 内置 | 🔴 无 |
| SQL 防火墙 | 🟢 内置 WallFilter | 🔴 无 |
| Web 监控页面 | 🟢 内置 StatViewServlet | 🔴 无 |
| 慢 SQL 记录 | 🟢 内置 | 🔴 需额外配置 |
| 连接泄漏检测 | 🟢 内置 | 🟡 需配置 |
| Spring Boot 集成 | 🟡 需手动配置 | 🟢 自动配置 |

---

## 一、快速开始

### 1.1 Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid-spring-boot-starter</artifactId>
    <version>1.2.20</version>
</dependency>
```

### 1.2 application.yml

```yaml
spring:
  datasource:
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      url: jdbc:mysql://localhost:3306/demo_db?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
      username: root
      password: root
      driver-class-name: com.mysql.cj.jdbc.Driver
```

### 1.3 验证

```java
@RestController
public class TestController {

    @Autowired
    private DataSource dataSource;

    @GetMapping("/datasource")
    public String getDataSourceType() {
        return "数据源类型：" + dataSource.getClass().getName();
        // 输出：com.alibaba.druid.pool.DruidDataSource
    }
}
```

---

## 二、核心配置

### 2.1 连接池大小

```yaml
spring:
  datasource:
    druid:
      # 初始化连接数
      initial-size: 5
      # 最小空闲连接数
      min-idle: 5
      # 最大活跃连接数
      max-active: 20
      # 获取连接超时时间（毫秒）
      max-wait: 60000
```

### 2.2 连接检测

```yaml
spring:
  datasource:
    druid:
      # 申请连接时检测连接是否有效（会影响性能）
      test-on-borrow: false
      # 归还连接时检测
      test-on-return: false
      # 空闲时检测
      test-while-idle: true
      # 检测 SQL
      validation-query: SELECT 1
      # 检测间隔（毫秒）
      time-between-eviction-runs-millis: 60000
      # 连接最小空闲时间
      min-evictable-idle-time-millis: 300000
```

### 2.3 连接泄漏检测

```yaml
spring:
  datasource:
    druid:
      # 开启连接泄漏检测
      remove-abandoned: true
      # 泄漏超时时间（秒）
      remove-abandoned-timeout: 180
      # 检测到泄漏时输出日志
      log-abandoned: true
```

### 2.4 连接池大小最佳实践

```yaml
# 通用公式
# 核心数 = CPU 核心数
# 连接数 = ((核心数 * 2) + 有效磁盘数)

# 例如：4 核 CPU，1 个磁盘
# 连接数 = (4 * 2) + 1 = 9
```

---

## 三、内置监控

### 3.1 StatFilter（SQL 统计）

```yaml
spring:
  datasource:
    druid:
      filter:
        stat:
          enabled: true
          # 慢 SQL 阈值（毫秒）
          log-slow-sql: true
          slow-sql-millis: 2000
          # 合并 SQL（参数化）
          merge-sql: true
```

### 3.2 WallFilter（SQL 防火墙）

```yaml
spring:
  datasource:
    druid:
      filter:
        wall:
          enabled: true
          config:
            # 禁止执行 DROP TABLE
            drop-table-allow: false
            # 禁止执行 TRUNCATE
            truncate-allow: false
            # 是否允许多语句
            multi-statement-allow: false
```

### 3.3 Log4jFilter（日志）

```yaml
spring:
  datasource:
    druid:
      filter:
        log4j2:
          enabled: true
          # 语句可执行 SQL 后输出日志
          statement-executable-sql-log-enable: true
```

### 3.4 完整 Filter 配置

```yaml
spring:
  datasource:
    druid:
      filters: stat,wall,log4j2
      # 或分开配置每个 filter
      filter:
        stat:
          enabled: true
          log-slow-sql: true
          slow-sql-millis: 2000
          merge-sql: true
        wall:
          enabled: true
          config:
            drop-table-allow: false
            multi-statement-allow: false
        log4j2:
          enabled: true
```

---

## 四、监控页面

### 4.1 StatViewServlet

```yaml
spring:
  datasource:
    druid:
      stat-view-servlet:
        enabled: true
        # 访问路径
        url-pattern: /druid/*
        # 登录账号
        login-username: admin
        login-password: admin123
        # IP 白名单（为空则允许所有）
        allow: 127.0.0.1,192.168.0.0/16
        # IP 黑名单（优先级高于 allow）
        deny: 192.168.1.100
        # 重置按钮
        reset-enable: false
```

访问 `http://localhost:8080/druid/`，使用配置的账号密码登录。

### 4.2 WebStatFilter（Web 请求统计）

```yaml
spring:
  datasource:
    druid:
      web-stat-filter:
        enabled: true
        # 拦截路径
        url-pattern: /*
        # 排除路径
        exclusions: '*.js,*.gif,*.jpg,*.png,*.css,*.ico,/druid/*'
        # 会话统计
        session-stat-enable: true
        # 最大会话数
        session-stat-max-count: 1000
```

### 4.3 Spring Boot 配置方式（Filter 方式）

```java
@Configuration
public class DruidConfig {

    /**
     * 配置 Druid 监控页面
     */
    @Bean
    public ServletRegistrationBean<StatViewServlet> statViewServlet() {
        ServletRegistrationBean<StatViewServlet> bean =
            new ServletRegistrationBean<>(new StatViewServlet(), "/druid/*");

        Map<String, String> initParams = new HashMap<>();
        initParams.put("loginUsername", "admin");
        initParams.put("loginPassword", "admin123");
        initParams.put("allow", "127.0.0.1");
        initParams.put("deny", "");
        initParams.put("resetEnable", "false");

        bean.setInitParameters(initParams);
        return bean;
    }

    /**
     * 配置 Web 统计 Filter
     */
    @Bean
    public FilterRegistrationBean<WebStatFilter> webStatFilter() {
        FilterRegistrationBean<WebStatFilter> bean =
            new FilterRegistrationBean<>(new WebStatFilter());

        Map<String, String> initParams = new HashMap<>();
        initParams.put("exclusions", "*.js,*.gif,*.jpg,*.png,*.css,*.ico,/druid/*");

        bean.setInitParameters(initParams);
        bean.setUrlPatterns(Collections.singletonList("/*"));
        return bean;
    }
}
```

---

## 五、慢 SQL 日志

### 5.1 配置方式

```yaml
spring:
  datasource:
    druid:
      filter:
        stat:
          log-slow-sql: true
          slow-sql-millis: 2000     # 超过 2 秒的 SQL 记录为慢 SQL
          merge-sql: true           # 合并参数化 SQL
```

### 5.2 日志输出示例

```text
[ERROR] slow sql 2005 millis. SELECT * FROM users WHERE id = 1 []
```

### 5.3 自定义慢 SQL 处理

```java
@Configuration
public class DruidSlowSqlConfig {

    @PostConstruct
    public void init() {
        // 获取 Druid 数据源
        DruidDataSource dataSource = DruidDataSourceBuilder.create().build();

        // 设置慢 SQL 监听
        List<Filter> filters = dataSource.getProxyFilters();
        for (Filter filter : filters) {
            if (filter instanceof StatFilter) {
                StatFilter statFilter = (StatFilter) filter;
                statFilter.setLogSlowSql(true);
                statFilter.setSlowSqlMillis(1000);
                statFilter.setMergeSql(true);
            }
        }
    }
}
```

---

## 六、多数据源

### 6.1 配置主从数据源

```yaml
spring:
  datasource:
    druid:
      master:
        url: jdbc:mysql://localhost:3306/demo_db?useUnicode=true&characterEncoding=UTF-8
        username: root
        password: root
        driver-class-name: com.mysql.cj.jdbc.Driver
      slave:
        url: jdbc:mysql://localhost:3307/demo_db?useUnicode=true&characterEncoding=UTF-8
        username: root
        password: root
        driver-class-name: com.mysql.cj.jdbc.Driver
```

### 6.2 配置类

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.druid.master")
    public DataSource masterDataSource() {
        return DruidDataSourceBuilder.create().build();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.druid.slave")
    public DataSource slaveDataSource() {
        return DruidDataSourceBuilder.create().build();
    }

    @Bean
    @Primary
    public DataSource dynamicDataSource() {
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put("master", masterDataSource());
        targetDataSources.put("slave", slaveDataSource());

        DynamicDataSource dataSource = new DynamicDataSource();
        dataSource.setDefaultTargetDataSource(masterDataSource());
        dataSource.setTargetDataSources(targetDataSources);
        return dataSource;
    }
}
```

---

## 七、密码加密

### 7.1 生成加密密码

```bash
# 使用 Druid 命令行工具
java -cp druid-1.2.20.jar com.alibaba.druid.filter.config.ConfigTools your_password

# 输出示例
# privateKey: MIIBVQIBADAN...   (保存好私钥)
# publicKey: MFwwDQYJKo...     (公钥)
# password: XK7kT...            (加密后的密码)
```

### 7.2 配置加密连接

```yaml
spring:
  datasource:
    druid:
      url: jdbc:mysql://localhost:3306/demo_db
      username: root
      password: XK7kT...          # 加密后的密码
      public-key: MFwwDQYJKo...    # 公钥

      filter:
        config:
          enabled: true

      # 方式二：通过 connection-properties
      connection-properties: config.decrypt=true;config.decrypt.key=${public-key}
```

### 7.3 生产环境最佳实践

::: danger 安全警告
永远不要将数据库密码明文存储在配置文件中！
:::

```bash
# 启动时传入 JVM 参数
java -jar app.jar \
  --spring.datasource.druid.password=ENC(...) \
  --spring.datasource.druid.public-key=MFwwDQ...
```

---

## 八、Spring Boot 2.7.x + MyBatis-Plus 完整集成

### 8.1 依赖

```xml
<dependencies>
    <!-- Druid -->
    <dependency>
        <groupId>com.alibaba</groupId>
        <artifactId>druid-spring-boot-starter</artifactId>
        <version>1.2.20</version>
    </dependency>

    <!-- MyBatis-Plus -->
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-boot-starter</artifactId>
        <version>3.5.5</version>
    </dependency>

    <!-- MySQL -->
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>8.0.33</version>
    </dependency>
</dependencies>
```

### 8.2 application.yml

```yaml
spring:
  datasource:
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      url: jdbc:mysql://localhost:3306/demo_db?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&useSSL=false
      username: root
      password: root
      driver-class-name: com.mysql.cj.jdbc.Driver

      # 连接池
      initial-size: 5
      min-idle: 5
      max-active: 20
      max-wait: 60000

      # 检测
      validation-query: SELECT 1
      test-while-idle: true
      test-on-borrow: false
      test-on-return: false
      time-between-eviction-runs-millis: 60000
      min-evictable-idle-time-millis: 300000

      # 监控
      filters: stat,wall,log4j2
      filter:
        stat:
          log-slow-sql: true
          slow-sql-millis: 2000
          merge-sql: true
        wall:
          config:
            drop-table-allow: false
            multi-statement-allow: false

      # 监控页面
      stat-view-servlet:
        enabled: true
        url-pattern: /druid/*
        login-username: admin
        login-password: admin123
        reset-enable: false

      web-stat-filter:
        enabled: true
        url-pattern: /*
        exclusions: '*.js,*.gif,*.jpg,*.png,*.css,*.ico,/druid/*'

# MyBatis-Plus
mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
    map-underscore-to-camel-case: true
  global-config:
    db-config:
      id-type: auto
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
```

### 8.3 启动类

```java
@SpringBootApplication
@MapperScan("com.example.demo.mapper")
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

---

## 九、最佳实践

### 9.1 连接池大小建议

| 场景 | 建议值 | 说明 |
|------|------|------|
| 开发环境 | 5-10 | 无需太大 |
| 测试环境 | 10-20 | 模拟一定并发 |
| 生产环境（低并发） | 20-50 | 根据压测调整 |
| 生产环境（高并发） | 50-200 | 监控后再调整 |

### 9.2 检测策略

| 策略 | 建议值 | 说明 |
|------|------|------|
| `test-on-borrow` | false | 影响性能，仅在必要场景开启 |
| `test-on-return` | false | 同上 |
| `test-while-idle` | true | 推荐，不影响性能 |
| `validation-query` | `SELECT 1` | 轻量级检测 |

### 9.3 监控页面安全

- 生产环境务必设置强密码
- 配置 IP 白名单，只允许内网访问
- 设置 `reset-enable: false` 防止误操作
- 可结合 Spring Security 做额外保护

---

## 十、常见问题

**Q: 如何替换 Spring Boot 默认的 HikariCP？**

引入 `druid-spring-boot-starter` 后，设置 `spring.datasource.type=com.alibaba.druid.pool.DruidDataSource`，Druid 会自动替换 HikariCP。

**Q: 连接泄漏如何排查？**

开启 `remove-abandoned: true` 和 `log-abandoned: true`，Druid 会自动检测并记录泄漏的连接。

**Q: 监控页面 `active count` 为负数？**

这是 Druid 已知的显示问题，不影响实际使用。升级到最新版本可修复。

**Q: Druid 和 MyBatis-Plus 的 SQL 日志冲突？**

关闭 MyBatis-Plus 的 SQL 日志输出，使用 Druid 的 StatFilter 统一管理 SQL 日志：

```yaml
mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.nologging.NoLoggingImpl
```

**Q: 如何查看 SQL 执行统计？**

访问 `http://localhost:8080/druid/sql.html`，在 SQL 监控页面查看所有 SQL 的执行次数、执行时间、并发数等。

---

## 参考资源

- [Druid 官方文档](https://github.com/alibaba/druid/wiki)
- [Druid GitHub](https://github.com/alibaba/druid)
- [MyBatis-Plus 文档](../mysql/mybatis-plus-integration.md)
- [Spring Boot 2.7.x 文档](../spring-boot/)