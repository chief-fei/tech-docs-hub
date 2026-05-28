# cola-component-catchlog 日志切面组件

## 概述

`cola-component-catchlog-starter` 是 COLA 框架的日志切面组件，提供了注解式的自动日志记录功能，无需在代码中手写重复的日志代码。

**Maven Artifact**: `com.alibaba.cola:cola-component-catchlog-starter`

## 核心特性

- 自动记录方法入参、返回值、异常
- 注解驱动，无侵入式
- 支持在类和方法级别使用
- 自动计算方法执行时间
- 易于整合 Spring Boot 日志框架

## 核心注解

### @CatchAndLog 注解

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface CatchAndLog {
    // 用于标记需要自动日志记录的类或方法
    // 没有其他属性，使用默认行为
}
```

**特点**：
- 可以在类上使用（对所有 public 方法生效）
- 可以在方法上使用（仅对该方法生效）
- 方法级别的 @CatchAndLog 优先于类级别
- 自动记录入参、返回值、异常和耗时

## 使用示例

### 1. 在服务类上使用

最常见的用法：在 Service 类上标注，所有 public 方法都会自动记录日志。

```java
import com.alibaba.cola.catchlog.CatchAndLog;
import org.springframework.stereotype.Service;

@Service
@CatchAndLog  // 类级别：对所有 public 方法生效
public class CustomerServiceImpl implements CustomerServiceI {
    
    @Autowired
    private CustomerAddCmdExe customerAddCmdExe;
    
    @Autowired
    private CustomerListByNameQryExe customerListByNameQryExe;
    
    @Override
    public Response addCustomer(CustomerAddCmd customerAddCmd) {
        // 入参、返回值、异常都会自动被记录
        return customerAddCmdExe.execute(customerAddCmd);
    }
    
    @Override
    public MultiResponse<CustomerDTO> listByName(CustomerListByNameQry customerListByNameQry) {
        // 自动记录
        return customerListByNameQryExe.execute(customerListByNameQry);
    }
}
```

**自动生成的日志**：

```
开始日志 (INFO):
[CustomerServiceImpl.addCustomer] 开始执行
[参数] com.alibaba.demo.customer.CustomerServiceImpl.addCustomer
{
    "customerDTO": {
        "customerId": "C001",
        "companyName": "ABC Company",
        "registeredCapital": 10000000
    }
}

成功日志 (INFO):
[CustomerServiceImpl.addCustomer] 成功
[返回值] com.alibaba.demo.customer.CustomerServiceImpl.addCustomer
{
    "success": true,
    "errCode": null,
    "errMsg": null
}
耗时: 125 ms

异常日志 (ERROR):
[CustomerServiceImpl.addCustomer] 异常
[异常信息] com.alibaba.demo.customer.CustomerServiceImpl.addCustomer
com.alibaba.cola.exception.BizException: 公司名已存在
    at com.alibaba.demo.customer.executor.CustomerAddCmdExe.execute(...)
    ...
```

### 2. 在执行器上使用

在 CmdExe 和 QryExe 上也可以使用，记录用例执行的细节。

```java
import com.alibaba.cola.catchlog.CatchAndLog;
import org.springframework.stereotype.Component;

@Component
@CatchAndLog  // 记录所有用例执行
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerGateway customerGateway;
    
    @Autowired
    private CustomerValidatingExtPt customerValidatingExtPt;
    
    public Response execute(CustomerAddCmd cmd) {
        // 所有业务逻辑都在日志记录下
        customerValidatingExtPt.validate(cmd);
        
        Customer customer = new Customer();
        customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
        customer.setRegisteredCapital(cmd.getCustomerDTO().getRegisteredCapital());
        customer.checkConflict();
        
        customerGateway.save(customer);
        
        return Response.buildSuccess();
    }
}
```

### 3. 在特定方法上使用

如果只想记录特定方法，可以在方法级别使用。

```java
@Service
public class OrderServiceImpl {
    
    // 只为这个方法记录日志
    @CatchAndLog
    public Response createOrder(OrderCreateCmd cmd) {
        // 记录日志
        return orderCreateExe.execute(cmd);
    }
    
    // 这个方法不会记录日志（除非类级别有 @CatchAndLog）
    public void internalMethod() {
        // ...
    }
}
```

### 4. 方法级别优先于类级别

```java
@Service
@CatchAndLog  // 默认记录所有 public 方法
public class PaymentServiceImpl {
    
    // 这个方法会被记录（继承类级别的 @CatchAndLog）
    public Response pay(PaymentCmd cmd) {
        return paymentExe.execute(cmd);
    }
    
    // 虽然类级别有注解，但方法级别的注解会覆盖
    // 实际上，方法级别的 @CatchAndLog 表示明确启用记录
    @CatchAndLog
    public Response queryBalance(String accountId) {
        // 明确标记为需要记录
        return queryBalanceExe.execute(accountId);
    }
}
```

## 自动记录的内容详解

### 入参日志

记录所有 public 方法的参数值。

```text
日志示例：
2024-04-15 10:30:45,123 [http-nio-8080-exec-1] INFO CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 开始执行
入参: {
    "customerDTO": {
        "customerId": "C001",
        "companyName": "ABC Company",
        "registeredCapital": 10000000,
        "source": "WEB"
    }
}
```

### 返回值日志

记录方法的返回值（Response 对象）。

```text
日志示例：
2024-04-15 10:30:45,248 [http-nio-8080-exec-1] INFO CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 成功
返回值: {
    "success": true,
    "errCode": null,
    "errMsg": null
}
耗时: 125 ms
```

### 异常日志

自动捕获和记录异常信息。

```text
日志示例：
2024-04-15 10:30:45,200 [http-nio-8080-exec-1] ERROR CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 异常
com.alibaba.cola.exception.BizException: 公司名已存在
    at com.alibaba.demo.customer.executor.CustomerAddCmdExe.execute(CustomerAddCmdExe.java:20)
    at com.alibaba.demo.customer.CustomerServiceImpl.addCustomer(CustomerServiceImpl.java:30)
    at com.alibaba.demo.web.CustomerController.addCustomer(CustomerController.java:40)
    ...
```

### 耗时记录

自动计算方法执行时间。

```text
耗时: 125 ms
```

## 日志配置

### 1. 日志级别配置

在 `application.properties` 或 `application.yml` 中配置：

```properties
# 全局日志级别
logging.level.root=INFO

# 应用日志级别
logging.level.com.alibaba.demo=DEBUG

# COLA 日志级别（如需要）
logging.level.com.alibaba.cola=INFO
```

或使用 YAML:

```yaml
logging:
  level:
    root: INFO
    com.alibaba.demo: DEBUG
    com.alibaba.cola: INFO
```

### 2. 日志格式配置

```properties
# 控制台日志格式
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n

# 文件日志格式
logging.pattern.file=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n

# 日志输出到文件
logging.file.name=logs/application.log

# 日志文件大小达到 10MB 时转存
logging.file.max-size=10MB

# 最多保留 10 个日志文件
logging.file.max-history=10
```

### 3. Logback 配置示例

创建 `logback-spring.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <!-- 引入 Spring Boot 默认配置 -->
    <include resource="org/springframework/boot/logging/logback/defaults.xml" />
    
    <!-- 定义变量 -->
    <property name="LOG_FILE" value="${user.home}/logs/application.log" />
    
    <!-- 控制台输出 -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${CONSOLE_LOG_PATTERN}</pattern>
        </encoder>
    </appender>
    
    <!-- 文件输出 -->
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_FILE}</file>
        <encoder>
            <pattern>${FILE_LOG_PATTERN}</pattern>
        </encoder>
        <!-- 滚动策略：日期 + 大小 -->
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_FILE}.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxHistory>30</maxHistory>
            <maxFileSize>100MB</maxFileSize>
            <totalSizeCap>10GB</totalSizeCap>
        </rollingPolicy>
    </appender>
    
    <!-- 应用日志级别 -->
    <logger name="com.alibaba.demo" level="DEBUG" />
    
    <!-- MyBatis 日志 -->
    <logger name="com.apache.ibatis" level="DEBUG" />
    
    <!-- SQL 日志 -->
    <logger name="org.springframework.jdbc.core" level="DEBUG" />
    
    <!-- 关闭第三方库的冗余日志 -->
    <logger name="org.springframework" level="WARN" />
    <logger name="org.hibernate" level="WARN" />
    <logger name="org.apache.catalina" level="WARN" />
    
    <!-- 根日志 -->
    <root level="INFO">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="FILE" />
    </root>
</configuration>
```

## POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-catchlog-starter</artifactId>
</dependency>

<!-- Logback 会通过 Spring Boot 自动引入，无需显式添加 -->
```

## 最佳实践

### 1. 在哪些层使用 @CatchAndLog

| 层级 | 是否使用 | 说明 |
|------|---------|------|
| Controller | ❌ 可选 | 通常由 @ControllerAdvice 处理异常 |
| Service | ✅ 强烈推荐 | 应用层的关键操作点 |
| CmdExe / QryExe | ✅ 推荐 | 用例执行的具体逻辑 |
| Gateway | ❌ 可选 | 如果 Gateway 很复杂，可以加 |
| Mapper / DAO | ❌ 不推荐 | 通常由 Gateway 包装 |

### 2. 使用类级别而不是方法级别

```java
// ✅ 推荐：在类上标注
@Service
@CatchAndLog
public class CustomerServiceImpl implements CustomerServiceI {
    // 所有 public 方法都会被记录
}

// ❌ 不推荐：在每个方法上标注
@Service
public class CustomerServiceImpl implements CustomerServiceI {
    @CatchAndLog
    public Response addCustomer(...) { }
    
    @CatchAndLog
    public MultiResponse<CustomerDTO> listByName(...) { }
}
```

### 3. 敏感信息处理

@CatchAndLog 会序列化和记录所有参数，对于包含敏感信息的操作，需要特别处理。

```java
// ✅ 好的做法：定义专用的 DTO，只包含非敏感字段
@Data
public class PasswordChangeCmd implements Command {
    private String userId;
    // 注意：不包含oldPassword, newPassword等敏感信息
}

// 在业务逻辑中直接从 request body 读取敏感信息，不经过日志
@PostMapping("/password")
public Response changePassword(
    @RequestBody Map<String, String> requestBody) {
    
    String userId = requestBody.get("userId");
    String oldPassword = requestBody.get("oldPassword");  // 不记录
    String newPassword = requestBody.get("newPassword");  // 不记录
    
    return passwordChangeService.changePassword(userId, oldPassword, newPassword);
}

// ❌ 不好的做法：命令对象包含敏感信息
@Data
public class PasswordChangeCmd implements Command {
    private String userId;
    private String oldPassword;  // 会被记录到日志
    private String newPassword;  // 会被记录到日志
}
```

### 4. 性能考虑

@CatchAndLog 会反射和序列化对象，对于以下场景要考虑性能：

```java
// ⚠️ 高频调用的方法，性能影响较大
@Service
@CatchAndLog
public class QueryServiceImpl {
    
    // 如果这个方法每秒被调用数千次，考虑不用 @CatchAndLog
    // 或者在方法级别移除注解
    @Override
    public boolean exists(String id) {
        return repository.count(id) > 0;
    }
}

// 解决方案：类级别加注解，但在高频方法上移除
@Service
@CatchAndLog
public class QueryServiceImpl {
    
    @CatchAndLog(disable = true)  // 假设未来支持这样的属性
    public boolean exists(String id) {
        return repository.count(id) > 0;
    }
}

// 或者：分离 Service，只对部分操作记录
@Service
public class QueryServiceImpl {
    // 不加 @CatchAndLog
}

@Service
@CatchAndLog
public class CustomerServiceImpl {
    // 加 @CatchAndLog
}
```

### 5. 结合全局异常处理

@CatchAndLog 会记录异常，但异常最终还需要由全局异常处理器处理并返回给客户端。

```java
// 日志流程：
// 1. @CatchAndLog 捕获异常并记录 ERROR 级别日志
// 2. 异常继续向上抛出
// 3. @ControllerAdvice 捕获异常
// 4. 返回错误响应给客户端

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BizException.class)
    @ResponseBody
    public Response handleBizException(BizException e) {
        // 这里可以再记录一次 WARN 级别的日志（作为总结）
        // 或者只依赖 @CatchAndLog 的记录
        return Response.buildFailure(e.getErrCode(), e.getErrMessage());
    }
}
```

## 日志输出示例

### 成功场景

```text
2024-04-15 10:30:45,125 [http-nio-8080-exec-1] INFO  c.a.d.c.CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 开始执行
入参: {
    "customerDTO": {
        "companyName": "ABC Company",
        "registeredCapital": 10000000
    }
}

2024-04-15 10:30:45,248 [http-nio-8080-exec-1] INFO  c.a.d.c.CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 成功
返回值: {
    "success": true,
    "errCode": null,
    "errMsg": null
}
耗时: 123 ms
```

### 业务异常场景

```text
2024-04-15 10:30:45,125 [http-nio-8080-exec-1] INFO  c.a.d.c.CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 开始执行
入参: {
    "customerDTO": {
        "companyName": "ABC Company",
        "registeredCapital": 10000000
    }
}

2024-04-15 10:30:45,180 [http-nio-8080-exec-1] ERROR c.a.d.c.CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 异常
com.alibaba.cola.exception.BizException: 公司名已存在
    at c.a.d.c.e.CustomerAddCmdExe.execute(CustomerAddCmdExe.java:45)
    at c.a.d.c.CustomerServiceImpl.addCustomer(CustomerServiceImpl.java:30)
    ...
```

### 系统异常场景

```text
2024-04-15 10:30:45,125 [http-nio-8080-exec-1] INFO  c.a.d.c.CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 开始执行
入参: { ... }

2024-04-15 10:30:45,500 [http-nio-8080-exec-1] ERROR c.a.d.c.CustomerServiceImpl - 
[CustomerServiceImpl.addCustomer] 异常
com.alibaba.cola.exception.SysException: 数据库异常
    at c.a.d.c.g.CustomerGatewayImpl.save(CustomerGatewayImpl.java:20)
    at c.a.d.c.e.CustomerAddCmdExe.execute(CustomerAddCmdExe.java:50)
    at c.a.d.c.CustomerServiceImpl.addCustomer(CustomerServiceImpl.java:30)
    ...
```

## 常见问题

**Q: @CatchAndLog 会记录 private 方法吗？**
A: 不会。@CatchAndLog 只会记录 public 方法。Private 方法由于不要暴露给外部，一般不需要单独记录。

**Q: 实现类和接口都有 @CatchAndLog，会被记录两次吗？**
A: 不会。Spring AOP 只会对实现的类应用一次切面。

**Q: @CatchAndLog 会影响方法性能吗？**
A: 会有一定影响，因为需要反射和序列化。但在 O(毫秒级)的方法中，影响通常小于 10%。对于 O(微秒级)的高频方法，可能有明显影响。

**Q: 能否自定义日志格式？**
A: 目前 @CatchAndLog 的格式是固定的。如需自定义，可以扩展或自己实现切面。

## 参考资源

- COLA 官方项目：https://github.com/alibaba/COLA
- Logback 配置指南：http://logback.qos.ch/manual/configuration.html
- Spring Boot 日志文档：https://spring.io/guides/gs/logging-log4j/


