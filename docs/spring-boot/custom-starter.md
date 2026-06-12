# 自定义 spring-boot-starter

Spring Boot 的自动配置机制允许我们将可复用的功能封装成 starter，像官方 starter 一样开箱即用。本章以「短信发送」为例，完整演示自定义 starter 的创建流程。

## 一、命名规范

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 官方 Starter | `spring-boot-starter-{模块}` | `spring-boot-starter-web`、`spring-boot-starter-data-redis` |
| 自定义 Starter | `{模块}-spring-boot-starter` | `sms-spring-boot-starter`、`mybatis-spring-boot-starter` |

> 官方建议自定义 starter 使用 `xxx-spring-boot-starter` 格式，与官方命名空间区分开。

## 二、整体流程

```text
创建 Maven 项目
    │
    ▼
定义属性类（@ConfigurationProperties）
    │
    ▼
编写核心业务类
    │
    ▼
编写自动配置类（@Configuration + @Bean + 条件注解）
    │
    ▼
注册自动配置（spring.factories + AutoConfiguration.imports）
    │
    ▼
打包发布（mvn install / deploy）
    │
    ▼
使用方引入依赖 → 配置 application.yml → 直接 @Autowired 注入
```

## 三、Maven 项目结构

```text
sms-spring-boot-starter/
└── src/main/java/com/example/sms/
    ├── SmsProperties.java          # 配置属性类
    ├── SmsSender.java              # 核心业务接口
    ├── SmsSenderImpl.java          # 接口实现
    └── autoconfigure/
        └── SmsAutoConfiguration.java   # 自动配置类
    └── resources/
        └── META-INF/
            ├── spring.factories
            └── spring/
                └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

### 3.1 pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.18</version>
        <relativePath/>
    </parent>

    <properties>
        <java.version>1.8</java.version>
    </properties>

    <dependencies>
        <!-- 核心依赖：自动配置注解 + 条件注解 + ConfigurationProperties -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-autoconfigure</artifactId>
        </dependency>

        <!-- 可选：生成 META-INF/spring-configuration-metadata.json，实现 IDE 配置提示 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-configuration-processor</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>
```

> `spring-boot-autoconfigure` 是 starter 的核心依赖，提供 `@ConfigurationProperties`、`@ConditionalOnClass` 等注解。**不要引入 `spring-boot-starter` 依赖**，因为 starter 本身只是一个配置模块，不需要嵌入式容器等能力。

## 四、定义属性类

使用 `@ConfigurationProperties` 将 `application.yml` 中的配置自动绑定到 POJO。

```java
package com.example.sms;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 短信发送配置属性
 *
 * 对应 application.yml 中 sms 前缀的配置项
 */
@ConfigurationProperties(prefix = "sms")
public class SmsProperties {

    /** 是否启用短信功能（默认 true） */
    private boolean enabled = true;

    /** 短信服务商 API 地址 */
    private String apiUrl = "https://api.example.com/sms/send";

    /** 短信服务商分配的 AppKey */
    private String appKey;

    /** 短信服务商分配的 AppSecret */
    private String appSecret;

    /** 短信签名（如：【XX公司】） */
    private String signName;

    /** 连接超时时间（毫秒） */
    private int connectTimeout = 5000;

    /** 读取超时时间（毫秒） */
    private int readTimeout = 10000;

    // ========== getter / setter ==========

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getApiUrl() {
        return apiUrl;
    }

    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }

    public String getAppKey() {
        return appKey;
    }

    public void setAppKey(String appKey) {
        this.appKey = appKey;
    }

    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(String appSecret) {
        this.appSecret = appSecret;
    }

    public String getSignName() {
        return signName;
    }

    public void setSignName(String signName) {
        this.signName = signName;
    }

    public int getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(int connectTimeout) {
        this.connectTimeout = connectTimeout;
    }

    public int getReadTimeout() {
        return readTimeout;
    }

    public void setReadTimeout(int readTimeout) {
        this.readTimeout = readTimeout;
    }
}
```

| @ConfigurationProperties 参数 | 类型 | 说明 |
|---------------------------|------|------|
| `prefix` | `String` | 配置前缀，此处为 `sms`，对应 `application.yml` 中的 `sms.xxx` |

> 属性的注释文档（`/** ... */`）会被 `spring-boot-configuration-processor` 读取并生成 `spring-configuration-metadata.json`，从而在 IDE 中编写配置时显示提示信息。

## 五、编写核心业务类

### 5.1 接口定义

```java
package com.example.sms;

/**
 * 短信发送接口
 */
public interface SmsSender {

    /**
     * 发送短信
     *
     * @param phoneNumber 手机号
     * @param content     短信内容
     * @return true 发送成功，false 发送失败
     */
    boolean send(String phoneNumber, String content);
}
```

### 5.2 实现类

```java
package com.example.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * 短信发送实现（基于 HTTP 调用第三方短信服务商 API）
 */
public class SmsSenderImpl implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(SmsSenderImpl.class);

    private final SmsProperties properties;

    public SmsSenderImpl(SmsProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean send(String phoneNumber, String content) {
        if (!properties.isEnabled()) {
            log.warn("短信功能未启用，跳过发送");
            return false;
        }

        try {
            // 构造请求参数
            String body = String.format(
                "appKey=%s&appSecret=%s&phone=%s&signName=%s&content=%s",
                properties.getAppKey(),
                properties.getAppSecret(),
                phoneNumber,
                properties.getSignName(),
                content
            );

            URL url = new URL(properties.getApiUrl());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(properties.getConnectTimeout());
            conn.setReadTimeout(properties.getReadTimeout());
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            boolean success = (code == 200);
            log.info("短信发送结果: phone={}, success={}, httpCode={}", phoneNumber, success, code);
            return success;

        } catch (Exception e) {
            log.error("短信发送异常: phone={}", phoneNumber, e);
            return false;
        }
    }
}
```

## 六、编写自动配置类

自动配置类是 starter 的核心，通过条件注解决定何时创建 Bean。

```java
package com.example.sms.autoconfigure;

import com.example.sms.SmsProperties;
import com.example.sms.SmsSender;
import com.example.sms.SmsSenderImpl;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 短信自动配置类
 *
 * 当满足条件时，自动创建 SmsSender Bean
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(SmsSender.class)                          // ① 类路径存在 SmsSender
@EnableConfigurationProperties(SmsProperties.class)            // ② 启用 @ConfigurationProperties
@ConditionalOnProperty(prefix = "sms", name = "enabled",       // ③ 配置文件中 sms.enabled=true（默认 true）
                       havingValue = "true", matchIfMissing = true)
public class SmsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(SmsSender.class)                 // ④ 用户未自定义 SmsSender 时才创建
    public SmsSender smsSender(SmsProperties properties) {
        return new SmsSenderImpl(properties);
    }
}
```

### 条件注解详解

| 注解 | 作用 | 示例 |
|------|------|------|
| `@ConditionalOnClass` | 类路径存在指定类时生效 | `@ConditionalOnClass(SmsSender.class)` |
| `@ConditionalOnMissingClass` | 类路径**不存在**指定类时生效 | `@ConditionalOnMissingClass("com.example.SomeClass")` |
| `@ConditionalOnBean` | 容器中存在指定 Bean 时生效 | `@ConditionalOnBean(DataSource.class)` |
| `@ConditionalOnMissingBean` | 容器中**不存在**指定 Bean 时生效 | `@ConditionalOnMissingBean(SmsSender.class)` |
| `@ConditionalOnProperty` | 配置文件中存在指定属性时生效 | `@ConditionalOnProperty(prefix = "sms", name = "enabled")` |
| `@ConditionalOnExpression` | SpEL 表达式为 true 时生效 | `@ConditionalOnExpression("${sms.enabled:true}")` |
| `@ConditionalOnWebApplication` | 当前是 Web 应用时生效 | `@ConditionalOnWebApplication` |

| @ConditionalOnProperty 参数 | 类型 | 说明 |
|--------------------------|------|------|
| `prefix` | `String` | 配置前缀（如 `"sms"`） |
| `name` / `value` | `String` / `String[]` | 属性名（如 `"enabled"`） |
| `havingValue` | `String` | 属性值匹配时才生效（如 `"true"`） |
| `matchIfMissing` | `boolean` | 配置文件中未配置该属性时，是否匹配（默认 `false`） |

> `@Configuration(proxyBeanMethods = false)`：自动配置类推荐使用 Lite 模式，因为 `@Bean` 方法间通常无依赖，性能更好。

## 七、注册自动配置

Spring Boot 在启动时扫描 `META-INF/spring.factories` 或 `AutoConfiguration.imports` 文件，加载其中的自动配置类。

### 7.1 spring.factories（2.x 标准方式）

`src/main/resources/META-INF/spring.factories`：

```properties
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.sms.autoconfigure.SmsAutoConfiguration
```

### 7.2 AutoConfiguration.imports（2.7.x 新增，3.x 唯一方式）

`src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`：

```text
com.example.sms.autoconfigure.SmsAutoConfiguration
```

> Spring Boot 2.7.x **同时支持两种方式**，3.x 仅支持 `AutoConfiguration.imports`。建议两种都配置，兼顾兼容性和向前迁移。

### 两种方式对比

| 方式 | 引入版本 | 文件位置 | 格式 |
|------|---------|---------|------|
| `spring.factories` | 1.x 起 | `META-INF/spring.factories` | `key=value` 格式，支持多行 `\` 续写 |
| `AutoConfiguration.imports` | 2.7.x 新增 | `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` | 每行一个全限定类名 |

## 八、使用方引入

### 8.1 引入依赖

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

### 8.2 配置 application.yml

```yaml
sms:
  enabled: true
  api-url: https://sms.example.com/api/send
  app-key: your-app-key
  app-secret: your-app-secret
  sign-name: 【XX公司】
  connect-timeout: 5000
  read-timeout: 10000
```

> 引入 `spring-boot-configuration-processor` 后，IDE 编写配置时会自动提示 `sms.xxx` 下有哪些属性及其说明。

### 8.3 注入使用

```java
@RestController
@RequestMapping("/sms")
public class SmsController {

    @Autowired
    private SmsSender smsSender;

    @PostMapping("/send")
    public String send(@RequestParam String phone, @RequestParam String content) {
        boolean result = smsSender.send(phone, content);
        return result ? "发送成功" : "发送失败";
    }
}
```

### 8.4 自定义覆盖（高级）

如果用户需要自定义 `SmsSender` 实现，只需在自己的项目中声明同名 Bean 即可覆盖：

```java
@Configuration
public class MySmsConfig {

    @Bean
    public SmsSender smsSender(SmsProperties properties) {
        return new MyCustomSmsSender(properties);  // 自定义实现
    }
}
```

> 自动配置类上的 `@ConditionalOnMissingBean(SmsSender.class)` 保证了用户自定义 Bean 优先，不会被自动配置覆盖。

## 九、可选：IDE 配置元数据

引入 `spring-boot-configuration-processor` 后，编译时会自动生成 `META-INF/spring-configuration-metadata.json`，内容如下：

```json
{
  "properties": [
    {
      "name": "sms.enabled",
      "type": "java.lang.Boolean",
      "description": "是否启用短信功能（默认 true）",
      "defaultValue": true
    },
    {
      "name": "sms.api-url",
      "type": "java.lang.String",
      "description": "短信服务商 API 地址",
      "defaultValue": "https://api.example.com/sms/send"
    }
  ]
}
```

IDE 会读取该文件，在编写 `application.yml` 时提供自动补全和文档提示。

> 该依赖**必须**设为 `<optional>true</optional>`，否则会传递到使用方，造成不必要的依赖污染。

## 十、总结

```text
┌────────────────────────────────────────────────────────────────┐
│                    自定义 Starter 核心要素                      │
├────────────────────────────────────────────────────────────────┤
│  1. 属性类        @ConfigurationProperties(prefix = "xxx")     │
│  2. 自动配置类    @Configuration + @Bean + 条件注解             │
│  3. 注册文件      spring.factories / AutoConfiguration.imports  │
│  4. 配置处理器    spring-boot-configuration-processor（可选）    │
│  5. 依赖          spring-boot-autoconfigure（仅此一个）          │
└────────────────────────────────────────────────────────────────┘
```

遵循以上流程，你可以将任何可复用的功能封装成 starter，实现真正的「一次编写，到处使用」。