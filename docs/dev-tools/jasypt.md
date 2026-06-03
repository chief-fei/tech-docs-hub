# Jasypt 3.0.5 完全指南

## 概述

Jasypt（Java Simplified Encryption）是一个 Java 加密库，主要用于加密配置文件中的敏感信息（如数据库密码、API 密钥等）。它通过 `ENC(...)` 占位符在配置文件中存储加密值，在应用启动时自动解密。

> **兼容性**：Jasypt 3.0.5 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

### 为什么需要 Jasypt

```yaml
# ❌ 不安全：密码明文
spring:
  datasource:
    password: my_secret_password_123

# ✅ 安全：密码加密
spring:
  datasource:
    password: ENC(ASkdfj3k4j5k3j4k5j3k4j5)
```

---

## 一、快速开始

### 1.1 Maven 依赖

```xml
<dependency>
    <groupId>com.github.ulisesbocchio</groupId>
    <artifactId>jasypt-spring-boot-starter</artifactId>
    <version>3.0.5</version>
</dependency>
```

### 1.2 加密密码配置

Jasypt 需要一个"加密密码"来加解密配置值。有以下几种方式提供：

```yaml
# application.yml
jasypt:
  encryptor:
    password: my-secret-key    # ⚠️ 不推荐！不要硬编码
```

```bash
# 方式一：JVM 启动参数（推荐）
java -jar app.jar --jasypt.encryptor.password=my-secret-key

# 方式二：系统属性
java -Djasypt.encryptor.password=my-secret-key -jar app.jar

# 方式三：环境变量（生产环境推荐）
export JASYPT_ENCRYPTOR_PASSWORD=my-secret-key
java -jar app.jar
```

::: danger 安全警告
永远不要将加密密码硬编码在配置文件中！加密密码是解开所有加密值的钥匙，泄露后所有加密值都将暴露。
:::

---

## 二、加密配置值

### 2.1 使用 jasypt CLI 工具加密

```bash
# 下载 jasypt JAR
wget https://repo1.maven.org/maven2/org/jasypt/jasypt/1.9.3/jasypt-1.9.3.jar

# 加密
java -cp jasypt-1.9.3.jar org.jasypt.intf.cli.JasyptPBEStringEncryptionCLI \
  input="my_password" \
  password="my-secret-key" \
  algorithm="PBEWithMD5AndDES"

# 输出
# ----ENVIRONMENT-----------------
# input: my_password
# password: my-secret-key
# ----OUTPUT----------------------
# ASkdfj3k4j5k3j4k5j3k4j5
```

### 2.2 使用 Maven 插件加密

```xml
<!-- pom.xml -->
<plugin>
    <groupId>com.github.ulisesbocchio</groupId>
    <artifactId>jasypt-maven-plugin</artifactId>
    <version>3.0.5</version>
</plugin>
```

```bash
# 加密
mvn jasypt:encrypt-value \
  -Djasypt.encryptor.password=my-secret-key \
  -Djasypt.plugin.value=my_password

# 输出
# ENC(ASkdfj3k4j5k3j4j5k3j4k5)

# 解密
mvn jasypt:decrypt-value \
  -Djasypt.encryptor.password=my-secret-key \
  -Djasypt.plugin.value=ENC(ASkdfj3k4j5k3j4j5k3j4k5)
```

### 2.3 使用代码加密

```java
public class JasyptUtil {

    public static void main(String[] args) {
        PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        config.setPassword("my-secret-key");
        config.setAlgorithm("PBEWithMD5AndDES");
        config.setPoolSize("1");
        encryptor.setConfig(config);

        String plain = "my_password";
        String encrypted = encryptor.encrypt(plain);
        System.out.println("ENC(" + encrypted + ")");

        String decrypted = encryptor.decrypt(encrypted);
        System.out.println(decrypted);  // my_password
    }
}
```

---

## 三、在配置文件中使用

### 3.1 application.yml

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/demo_db
    username: root
    password: ENC(ASkdfj3k4j5k3j4j5k3j4k5)   # 加密后的密码

  redis:
    host: localhost
    port: 6379
    password: ENC(Bk4j5k3j4k5j3k4j5k3j4k6)   # 加密后的 Redis 密码
```

### 3.2 application.properties

```properties
spring.datasource.password=ENC(ASkdfj3k4j5k3j4j5k3j4k5)
spring.redis.password=ENC(Bk4j5k3j4k5j3k4j5k3j4k6)
```

### 3.3 自定义属性

```java
@Component
@ConfigurationProperties(prefix = "api")
@Data
public class ApiConfig {

    private String key;       // 自动解密 ENC(...)
    private String secret;    // 自动解密 ENC(...)
}
```

```yaml
api:
  key: ENC(Xkdfj3k4j5k3j4k5)
  secret: ENC(Yk4j5k3j4k5j3k4k5)
```

---

## 四、自定义加密器配置

### 4.1 配置加密算法

```yaml
jasypt:
  encryptor:
    password: ${JASYPT_ENCRYPTOR_PASSWORD}
    # 加密算法
    algorithm: PBEWithMD5AndDES
    # 密钥迭代次数
    key-obtention-iterations: 1000
    # 池大小
    pool-size: 1
    # 盐生成器类名
    salt-generator-classname: org.jasypt.salt.RandomSaltGenerator
    # 输出类型
    iv-generator-classname: org.jasypt.iv.RandomIvGenerator
    # 输出编码格式
    property:
      prefix: ENC(
      suffix: )
```

### 4.2 使用更强的算法

```yaml
jasypt:
  encryptor:
    password: ${JASYPT_ENCRYPTOR_PASSWORD}
    algorithm: PBEWITHHMACSHA512ANDAES_256
    key-obtention-iterations: 1000
    pool-size: 1
    iv-generator-classname: org.jasypt.iv.RandomIvGenerator
```

### 4.3 代码方式配置

```java
@Configuration
public class JasyptConfig {

    @Value("${JASYPT_ENCRYPTOR_PASSWORD}")
    private String encryptorPassword;

    @Bean
    public StringEncryptor stringEncryptor() {
        PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        config.setPassword(encryptorPassword);
        config.setAlgorithm("PBEWITHHMACSHA512ANDAES_256");
        config.setKeyObtentionIterations("1000");
        config.setPoolSize("1");
        config.setProviderName("SunJCE");
        config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        config.setIvGeneratorClassName("org.jasypt.iv.RandomIvGenerator");
        config.setStringOutputType("base64");
        encryptor.setConfig(config);
        return encryptor;
    }
}
```

---

## 五、Spring Boot 2.7.x 完整集成示例

### 5.1 依赖

```xml
<dependencies>
    <!-- Spring Boot -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Jasypt -->
    <dependency>
        <groupId>com.github.ulisesbocchio</groupId>
        <artifactId>jasypt-spring-boot-starter</artifactId>
        <version>3.0.5</version>
    </dependency>

    <!-- Druid -->
    <dependency>
        <groupId>com.alibaba</groupId>
        <artifactId>druid-spring-boot-starter</artifactId>
        <version>1.2.20</version>
    </dependency>

    <!-- MySQL -->
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>8.0.33</version>
    </dependency>
</dependencies>
```

### 5.2 application.yml

```yaml
spring:
  datasource:
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      url: jdbc:mysql://localhost:3306/demo_db?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
      username: ENC(encrypted_username)
      password: ENC(encrypted_password)
      driver-class-name: com.mysql.cj.jdbc.Driver

  redis:
    host: localhost
    port: 6379
    password: ENC(encrypted_redis_password)

jasypt:
  encryptor:
    algorithm: PBEWITHHMACSHA512ANDAES_256
    key-obtention-iterations: 1000
    pool-size: 1
    iv-generator-classname: org.jasypt.iv.RandomIvGenerator
```

### 5.3 启动命令

```bash
# 使用环境变量（生产环境推荐）
export JASYPT_ENCRYPTOR_PASSWORD=my-secret-key
java -jar app.jar

# 或使用 JVM 参数
java -jar app.jar --jasypt.encryptor.password=my-secret-key
```

### 5.4 测试加密解密

```java
@RestController
@RequestMapping("/api")
@Slf4j
public class JasyptTestController {

    @Autowired
    private StringEncryptor stringEncryptor;

    @Value("${spring.datasource.druid.password}")
    private String dbPassword;  // 自动解密

    /**
     * 加密字符串
     */
    @GetMapping("/encrypt")
    public String encrypt(@RequestParam String text) {
        return "ENC(" + stringEncryptor.encrypt(text) + ")";
    }

    /**
     * 解密字符串
     */
    @GetMapping("/decrypt")
    public String decrypt(@RequestParam String text) {
        return stringEncryptor.decrypt(text);
    }

    /**
     * 验证配置解密
     */
    @GetMapping("/config-check")
    public String checkConfig() {
        return "数据库密码解密成功: " + dbPassword;
    }
}
```

---

## 六、最佳实践

### 6.1 加密密码管理

| 环境 | 推荐方式 | 命令示例 |
|------|---------|---------|
| 开发 | JVM 参数 | `java -jar app.jar --jasypt.encryptor.password=dev-key` |
| 测试 | 环境变量 | `export JASYPT_ENCRYPTOR_PASSWORD=test-key` |
| 生产 | 环境变量 / K8s Secret | `kubectl create secret generic jasypt-secret --from-literal=password=prod-key` |

### 6.2 避免的坑

1. **不要硬编码加密密码** — 加密密码泄露等于所有加密值泄露
2. **不要将加密密码提交到 Git** — 使用 `.gitignore` 排除或使用环境变量
3. **算法选择** — 推荐 `PBEWITHHMACSHA512ANDAES_256` 而非 `PBEWithMD5AndDES`
4. **加密值格式** — 必须是 `ENC(加密内容)` 格式，Jasypt 才会自动解密
5. **加密密码一致** — 加密和解密必须使用相同的密码

### 6.3 持续集成中的处理

```yaml
# .gitlab-ci.yml
variables:
  JASYPT_ENCRYPTOR_PASSWORD: $CI_JASYPT_PASSWORD  # 从 CI 变量中获取

script:
  - mvn jasypt:encrypt-value -Djasypt.encryptor.password=$JASYPT_ENCRYPTOR_PASSWORD -Djasypt.plugin.value=$DB_PASSWORD
  - mvn package
  - java -jar target/app.jar --jasypt.encryptor.password=$JASYPT_ENCRYPTOR_PASSWORD
```

---

## 七、常见问题

**Q: 启动报错 `Unable to decrypt: ENC(...)`？**

可能原因：
- 加密密码不一致（加密时用的密码和启动时用的密码不同）
- 加密算法不匹配
- `ENC(...)` 格式错误（注意括号和大小写）

**Q: 如何批量加密配置文件中的值？**

使用 `jasypt-maven-plugin`：

```bash
# 加密整个配置文件
mvn jasypt:encrypt -Djasypt.encryptor.password=my-secret-key
```

**Q: 加密后的值太长，不方便管理？**

Jasypt 使用 Base64 编码，加密后的值确实较长。这是正常的，无法缩短。

**Q: 如何在 Docker 中启动？**

```dockerfile
# Dockerfile
FROM openjdk:8-jre
COPY target/app.jar /app.jar
ENV JASYPT_ENCRYPTOR_PASSWORD=change-me
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

```bash
# 运行
docker run -e JASYPT_ENCRYPTOR_PASSWORD=prod-secret-key my-app
```

**Q: 可以加密除了 `application.yml` 之外的文件吗？**

可以，Jasypt 会自动解密所有 Spring 管理的配置属性，包括 `@ConfigurationProperties`、`@Value` 等。

**Q: 加密密码在哪里设置最安全？**

环境变量是最安全的方式，K8s Secret、Vault 等密钥管理工具更加安全。

---

## 参考资源

- [Jasypt Spring Boot 文档](https://github.com/ulisesbocchio/jasypt-spring-boot)
- [Jasypt 官方文档](http://www.jasypt.org/)
- [Druid 密码加密](../dev-tools/druid.md)
- [Spring Boot 2.7.x 文档](../spring-boot/)