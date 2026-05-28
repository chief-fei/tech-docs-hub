# COLA 5.0.0 组件使用指南

## 概述

COLA（Clean Object Layer Architecture）是阿里巴巴开源的一套应用架构，提供了一系列组件来支持分层架构的落地实现。COLA 5.0.0 提供了多个独立的、可组合的组件，每个组件都可以单独使用，也可以搭配其他组件使用。

**COLA 官方项目**：https://github.com/alibaba/COLA

---

## COLA 核心组件总览

| 组件类别 | 组件名称 | Maven Artifact | 版本 | 用途 |
|---------|--------|----------------|------|------|
| **数据传输** | cola-component-dto | com.alibaba.cola:cola-component-dto | 5.0.0 | DTO 定义和响应封装 |
| **领域驱动** | cola-component-domain-starter | com.alibaba.cola:cola-component-domain-starter | 5.0.0 | 领域模型支持 |
| **异常处理** | cola-component-exception | com.alibaba.cola:cola-component-exception | 5.0.0 | 业务异常和异常转换 |
| **日志切面** | cola-component-catchlog-starter | com.alibaba.cola:cola-component-catchlog-starter | 5.0.0 | 注解式日志记录 |
| **扩展点** | cola-component-extension | com.alibaba.cola:cola-component-extension | 5.0.0 | 扩展点和实现点 |
| **状态机** | cola-component-statemachine | com.alibaba.cola:cola-component-statemachine | 4.3.2 | 轻量级状态流转 |
| **规则引擎** | cola-component-ruleengine | com.alibaba.cola:cola-component-ruleengine | 5.0.0 | 声明式业务规则 |
| **分布式锁** | cola-component-lock-starter | com.alibaba.cola:cola-component-lock-starter | 5.0.0 | 分布式锁（可选） |

---

## 1. cola-component-dto（数据传输组件）

### 概述

这是 COLA 中最基础的组件，提供了标准的 DTO 和响应对象，用于在不同层之间传递数据。

**👉 详细文档**：[docs/COLA_DTO_COMPONENT.md](./dto.md)

### 核心类

#### 1.1 `Command` - 命令接口
```java
public interface Command extends Serializable {
    // 标记接口，所有命令对象应该实现此接口
}
```

**用途**：标记一个对象是命令（包含对系统状态的修改）

**使用示例**：
```java
import com.alibaba.cola.dto.Command;

@Data
public class CustomerAddCmd implements Command {
    private static final long serialVersionUID = 1L;
    
    private CustomerDTO customerDTO;
    
    public CustomerAddCmd() {
    }
}
```

#### 1.2 `Query` - 查询接口
```java
public abstract class Query implements Serializable {
    // 基类，所有查询对象应该继承此类
}
```

**用途**：标记一个对象是查询（只读，不修改系统状态）

**使用示例**：
```java
import com.alibaba.cola.dto.Query;

@Data
public class CustomerListByNameQry extends Query {
    private static final long serialVersionUID = 1L;
    
    private String name;
}
```

#### 1.3 `Response` - 单一返回值
```java
public class Response implements Serializable {
    private String errCode;   // 错误码
    private String errMsg;    // 错误信息
    private boolean success;  // 是否成功
    
    // 工厂方法
    public static Response buildSuccess();
    public static Response buildSuccess(String msg);
    public static Response buildFailure(String code, String msg);
}
```

**用途**：包装单个操作的返回结果，包含成功/失败、错误码、错误信息

**使用示例**：
```java
@Component
public class CustomerAddCmdExe {
    public Response execute(CustomerAddCmd cmd) {
        if (cmd.getCustomerDTO().getCompanyName().equals("ConflictCompanyName")) {
            return Response.buildFailure(
                ErrorCode.B_CUSTOMER_companyNameConflict.getErrCode(), 
                "公司名冲突"
            );
        }
        return Response.buildSuccess();
    }
}
```

#### 1.4 `MultiResponse` - 多个返回值
```java
public class MultiResponse<T> extends Response {
    private List<T> data;
    
    // 工厂方法
    public static <T> MultiResponse<T> of(List<T> data);
    public static <T> MultiResponse<T> buildSuccess();
    public static <T> MultiResponse<T> buildSuccess(List<T> data);
    public static <T> MultiResponse<T> buildFailure(String code, String msg);
}
```

**用途**：包装多个对象的返回结果，通常用于查询接口

**使用示例**：
```java
@Component
public class CustomerListByNameQryExe {
    public MultiResponse<CustomerDTO> execute(CustomerListByNameQry qry) {
        List<CustomerDTO> customers = customerMapper.listByName(qry.getName());
        return MultiResponse.of(customers);
    }
}
```

#### 1.5 `SingleResponse` - 单个对象返回值
```java
public class SingleResponse<T> extends Response {
    private T data;
    
    // 工厂方法
    public static <T> SingleResponse<T> of(T data);
    public static <T> SingleResponse<T> buildSuccess(T data);
    public static <T> SingleResponse<T> buildFailure(String code, String msg);
}
```

**用途**：包装单个复杂对象的返回结果

**使用示例**：
```java
@Component
public class CustomerGetQryExe {
    @Autowired
    private CustomerGateway customerGateway;
    
    public SingleResponse<CustomerDTO> execute(CustomerGetQry qry) {
        Customer customer = customerGateway.getByById(qry.getCustomerId());
        CustomerDTO dto = convert(customer);
        return SingleResponse.of(dto);
    }
}
```

#### 1.6 `PageResponse` - 分页返回值
```java
public class PageResponse<T> extends Response {
    private List<T> data;
    private long pageIndex;   // 当前页
    private long pageSize;    // 每页大小
    private long totalCount;  // 总数
    
    // 工厂方法
    public static <T> PageResponse<T> of(List<T> data, long pageIndex, long pageSize, long totalCount);
}
```

**用途**：包装分页查询的结果

**使用示例**：
```java
@Component
public class CustomerPageQryExe {
    public PageResponse<CustomerDTO> execute(CustomerPageQry qry) {
        List<CustomerDTO> customers = customerMapper.pageList(
            qry.getPageIndex(), 
            qry.getPageSize()
        );
        long totalCount = customerMapper.countAll();
        return PageResponse.of(customers, qry.getPageIndex(), qry.getPageSize(), totalCount);
    }
}
```

### POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-dto</artifactId>
    <!-- 版本由 cola-components-bom 管理 -->
</dependency>
```

### 最佳实践

1. **Command 和 Query 分离**
   - Command：修改数据的操作，返回 `Response` 或 `SingleResponse`
   - Query：查询数据的操作，返回 `MultiResponse` 或 `PageResponse`

2. **使用工厂方法**
   - 不要直接 new Response 对象
   - 使用 `buildSuccess()`、`buildFailure()` 等工厂方法

3. **设置 serialVersionUID**
   - 所有 Cmd/Qry/DTO 都应设置 `serialVersionUID`
   - 便于版本管理和序列化

---

## 2. cola-component-domain-starter（领域模型组件）

### 概述

提供了领域驱动设计中的基础支持，包括实体、值对象等基类和注解。

**👉 详细文档**：[docs/COLA_DOMAIN_COMPONENT.md](./domain.md)

### 核心类

#### 2.1 `@Entity` - 实体注解
```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Entity {
    // 标记一个类是领域实体
}
```

**用途**：标记一个类为领域实体，使其被识别为有生命周期和业务行为的对象

**使用示例**：
```java
import com.alibaba.cola.domain.Entity;

@Entity
@Data
public class Customer {
    private String customerId;
    private String companyName;
    private long registeredCapital;
    
    // 业务行为
    public boolean isBigCompany() {
        return registeredCapital > 10000000;
    }
    
    public void checkConflict() {
        if ("ConflictCompanyName".equals(this.companyName)) {
            throw new BizException("公司名已存在");
        }
    }
}
```

#### 2.2 `@ValueObject` - 值对象注解
```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValueObject {
    // 标记一个类是值对象（不可变）
}
```

**用途**：标记一个类为值对象，值对象没有生命周期和身份，只关心值本身

**使用示例**：
```java
import com.alibaba.cola.domain.ValueObject;

@ValueObject
@Data
public class Money {
    private BigDecimal amount;
    private String currency;
    
    // 值对象通常是不可变的
}
```

#### 2.3 `@Repository` - 仓储接口注解
```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Repository {
    // 标记一个接口是仓储接口
}
```

**用途**：标记一个接口为仓储接口，系统可以自动识别并处理

**使用示例**：
```java
import com.alibaba.cola.domain.Repository;

@Repository
public interface CustomerRepository {
    Customer getById(String customerId);
    void save(Customer customer);
    void delete(String customerId);
}
```

#### 2.4 `EntityDO` - DO 转换基类（可选）
```java
public abstract class EntityDO implements Serializable {
    // 基类，可用于 DO 对象
}
```

**用途**：为 DO 对象提供公共基类

**使用示例**：
```java
@Data
public class CustomerDO extends EntityDO {
    private String customerId;
    private String memberId;
    private String globalId;
    private long registeredCapital;
    private String companyName;
}
```

### POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-domain-starter</artifactId>
</dependency>
```

### 最佳实践

1. **区分实体和值对象**
   - 实体有身份和生命周期
   - 值对象是不可变的，只关心值

2. **实体不应该贫血**
   - 实体应该包含业务行为，不只是 getter/setter
   - 业务规则应该在实体中实现

3. **仓储用于持久化**
   - 不要在实体中写数据库访问代码
   - 通过网关接口定义所需的持久化操作

---

## 3. cola-component-exception（异常处理组件）

### 概述

提供统一的异常模型，区分业务异常和系统异常，支持自定义异常转换。

**👉 详细文档**：[docs/COLA_EXCEPTION_COMPONENT.md](./exception.md)

### 核心类

#### 3.1 `BizException` - 业务异常
```java
public class BizException extends RuntimeException {
    private String errCode;     // 业务错误码
    private String errMessage;  // 错误信息
    
    public BizException(String code, String message);
    public BizException(String code, String message, Throwable cause);
    
    public String getErrCode();
    public String getErrMessage();
}
```

**用途**：表示预期的业务异常，如数据冲突、业务规则校验失败

**使用示例**：
```java
@Component
public class CustomerAddCmdExe {
    public Response execute(CustomerAddCmd cmd) {
        Customer customer = new Customer();
        customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
        
        try {
            customer.checkConflict();
        } catch (Exception e) {
            throw new BizException(
                "B_CUSTOMER_CONFLICT", 
                "公司名已存在，无法添加"
            );
        }
        
        return Response.buildSuccess();
    }
}
```

#### 3.2 `SysException` - 系统异常
```java
public class SysException extends RuntimeException {
    private String errCode = "SYSTEM_ERROR";
    private String errMessage;
    
    public SysException(String message);
    public SysException(String code, String message);
    public SysException(String message, Throwable cause);
}
```

**用途**：表示不可预期的系统异常，如数据库连接失败

**使用示例**：
```java
@Component
public class CustomerGatewayImpl implements CustomerGateway {
    @Autowired
    private CustomerMapper mapper;
    
    public Customer getByById(String customerId) {
        try {
            CustomerDO customerDO = mapper.getById(customerId);
            return convert(customerDO);
        } catch (Exception e) {
            throw new SysException("QUERY_DATABASE_ERROR", "查询数据库异常", e);
        }
    }
}
```

#### 3.3 `ExceptionFactory` - 异常工厂（可选）
```java
public class ExceptionFactory {
    // 创建业务异常
    public static BizException buildBizException(String code, String message);
    
    // 创建系统异常
    public static SysException buildSysException(String message);
}
```

**使用示例**：
```java
throw ExceptionFactory.buildBizException("B_CUSTOMER_CONFLICT", "公司名冲突");
```

### POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-exception</artifactId>
</dependency>
```

### 异常处理流程

```text
业务异常 (BizException)
    ↓
@ControllerAdvice 捕获
    ↓
返回错误码和错误信息给调用方
    ↓
用户看到业务友好提示

系统异常 (SysException / 其他)
    ↓
@ControllerAdvice 捕获
    ↓
记录日志（ERROR 级别）
    ↓
返回通用系统错误信息给调用方
    ↓
管理员在日志中查看详细堆栈
```

### 全局异常处理器示例

```java
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import lombok.extern.slf4j.Slf4j;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    // 处理业务异常
    @ExceptionHandler(BizException.class)
    @ResponseBody
    public Response handleBizException(BizException e) {
        log.warn("业务异常：{}", e.getErrMessage());
        return Response.buildFailure(e.getErrCode(), e.getErrMessage());
    }
    
    // 处理系统异常
    @ExceptionHandler(SysException.class)
    @ResponseBody
    public Response handleSysException(SysException e) {
        log.error("系统异常", e);
        return Response.buildFailure(
            e.getErrCode(), 
            "系统内部错误，请联系管理员"
        );
    }
    
    // 处理其他未预期的异常
    @ExceptionHandler(Exception.class)
    @ResponseBody
    public Response handleException(Exception e) {
        log.error("未知异常", e);
        return Response.buildFailure(
            "SYSTEM_ERROR", 
            "系统内部错误"
        );
    }
}
```

### 最佳实践

1. **预期异常用 BizException**
   - 业务规则违反
   - 数据校验失败
   - 并发版本冲突

2. **非预期异常用 SysException**
   - 数据库错误
   - 网络错误
   - 缓存错误

3. **异常code 要规范**
   - 业务异常：`B_MODULE_REASON`（B 前缀）
   - 系统异常：`S_MODULE_REASON`（S 前缀）

---

## 4. cola-component-catchlog-starter（日志切面组件）

### 概述

提供注解式的方法日志记录，无需手写繁琐的日志代码。

**👉 详细文档**：[docs/COLA_CATCHLOG_COMPONENT.md](./catchlog.md)

### 核心注解

#### 4.1 `@CatchAndLog` - 方法日志注解
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface CatchAndLog {
    // 在类或方法上使用，自动记录方法的入参、返回值和异常
}
```

**用途**：自动记录方法的执行过程，包括入参、返回值、异常

**使用示例**：
```java
import com.alibaba.cola.catchlog.CatchAndLog;

@Service
@CatchAndLog  // 在类上标注，所有 public 方法都会被记录
public class CustomerServiceImpl implements CustomerServiceI {
    
    @Autowired
    private CustomerAddCmdExe customerAddCmdExe;
    
    @Override
    public Response addCustomer(CustomerAddCmd customerAddCmd) {
        // 入参自动被记录
        // 返回值自动被记录
        // 异常自动被记录
        return customerAddCmdExe.execute(customerAddCmd);
    }
}
```

或在方法上标注：

```java
@Service
public class CustomerServiceImpl implements CustomerServiceI {
    
    @CatchAndLog  // 在方法上标注，只有该方法被记录
    @Override
    public Response addCustomer(CustomerAddCmd customerAddCmd) {
        return customerAddCmdExe.execute(customerAddCmd);
    }
}
```

#### 4.2 自动记录的内容

当使用 `@CatchAndLog` 时，以下信息会自动被记录：

```text
开始日志（INFO 级别）：
    方法名: com.alibaba.demo.customer.CustomerServiceImpl.addCustomer
    入参: {
        "customerDTO": {
            "companyName": "TestCompany",
            ...
        }
    }

返回日志（INFO 级别）：
    方法名: com.alibaba.demo.customer.CustomerServiceImpl.addCustomer
    返回值: {
        "success": true,
        "errCode": null,
        "errMsg": null
    }
    耗时: 150ms

异常日志（ERROR 级别）：
    方法名: com.alibaba.demo.customer.CustomerServiceImpl.addCustomer
    异常信息: BizException: 公司名冲突
    堆栈信息: ...
```

### POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-catchlog-starter</artifactId>
</dependency>
```

需要在 `application.properties` 中配置：

```properties
# 日志级别
logging.level.root=INFO
logging.level.com.alibaba.demo=DEBUG

# 日志输出位置
logging.file.name=logs/application.log

# 日志格式
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n
```

### 日志配置示例（logback-spring.xml）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <!-- 应用日志 -->
    <logger name="com.alibaba.demo" level="DEBUG"/>
    
    <!-- MyBatis 日志 -->
    <logger name="com.apache.ibatis" level="DEBUG"/>
    
    <!-- SQL 日志 -->
    <logger name="org.springframework.jdbc.core" level="DEBUG"/>
    
    <!-- 关闭第三方库噪声 -->
    <logger name="org.springframework" level="WARN"/>
    <logger name="org.hibernate" level="WARN"/>
</configuration>
```

### 最佳实践

1. **在服务层和执行器上使用**
   - 适合在 Service 和 CmdExe/QryExe 上使用
   - 不需要在 DAO 层重复使用

2. **注意敏感信息**
   - 可能需要定制日志以隐藏密钥、密码等敏感信息
   - COLA 不自动隐藏，需要手动处理

3. **性能考虑**
   - @CatchAndLog 会序列化入参和返回值
   - 对于大对象或频繁调用的方法，可能有性能影响

4. **与全局异常处理器配合**
   - @CatchAndLog 负责记录调用过程
   - GlobalExceptionHandler 负责处理异常返回

---

## 5. cola-component-extension（扩展点组件）

### 概述

提供扩展点和实现点机制，支持插件式扩展，无需修改核心代码。

**👉 详细文档**：[docs/COLA_EXTENSION_COMPONENT.md](./extension.md)

### 核心注解

#### 5.1 `@Extension` - 扩展点注解
```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Extension {
    String bizCode();      // 业务代码
    String useCase();      // 使用场景
    int order() default 0; // 执行顺序
}
```

**用途**：标记一个类是某个扩展点的实现

**使用示例**：

首先定义扩展点接口：

```java
public interface CustomerValidatingExtPt {
    void validate(CustomerAddCmd cmd);
}
```

然后提供基础实现：

```java
@Component
@Extension(bizCode = "customer", useCase = "add")
public class CustomerValidatingImpl implements CustomerValidatingExtPt {
    
    @Override
    public void validate(CustomerAddCmd cmd) {
        if (cmd.getCustomerDTO().getCompanyName() == null) {
            throw new BizException("B_COMPANY_NAME_EMPTY", "公司名不能为空");
        }
    }
}
```

不同业务线可以提供自己的实现：

```java
@Component
@Extension(bizCode = "customerVip", useCase = "add", order = 1)
public class CustomerVipValidatingImpl implements CustomerValidatingExtPt {
    
    @Override
    public void validate(CustomerAddCmd cmd) {
        // VIP 客户有自己的验证规则
        if (cmd.getCustomerDTO().getCompanyName().length() < 10) {
            throw new BizException("B_COMPANY_NAME_TOO_SHORT", "VIP 客户公司名必须至少 10 个字");
        }
    }
}
```

#### 5.2 `@ExtensionExecutor` - 扩展点执行器注解
```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ExtensionExecutor {
    // 标记一个类为扩展点执行器
}
```

**用途**：标记执行扩展点的执行器

### 在执行器中使用扩展点

```java
@Component
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerValidatingExtPt customerValidatingExtPt;
    
    public Response execute(CustomerAddCmd cmd) {
        // 1. 执行扩展点
        customerValidatingExtPt.validate(cmd);
        
        // 2. 执行核心业务逻辑
        Customer customer = new Customer();
        customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
        customer.checkConflict();
        
        // 3. 持久化
        return Response.buildSuccess();
    }
}
```

### POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-extension</artifactId>
</dependency>
```

### 最佳实践

1. **定义清晰的扩展点接口**
   - 接口名称以 ExtPt 结尾
   - 接口职责单一、清晰

2. **使用 bizCode 区分不同场景**
   - 允许不同业务线有不同实现
   - 可以通过配置切换实现

3. **异常处理**
   - 扩展点中的异常会立即中断流程
   - 如果需要继续执行，使用 try-catch 包裹

---

## 6. cola-component-lock-starter（分布式锁组件）（可选）

### 概述

提供分布式锁支持，用于在分布式环境中保护共享资源。

**👉 详细文档**：[docs/COLA_LOCK_COMPONENT.md](./lock.md)

### 核心注解

#### 6.1 `@DistributedLock` - 分布式锁注解
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedLock {
    String lockKey();           // 锁的 key
    long waitTime() default 0;  // 等待时间（毫秒）
    long leaseTime() default -1; // 锁过期时间（毫秒）
}
```

**用途**：在方法执行期间获取分布式锁，防止并发冲突

**使用示例**：
```java
import com.alibaba.cola.lock.DistributedLock;

@Component
public class CustomerAddCmdExe {
    
    @DistributedLock(
        lockKey = "customer:company:#{cmd.getCustomerDTO().getCompanyName()}",
        waitTime = 3000,
        leaseTime = 5000
    )
    public Response execute(CustomerAddCmd cmd) {
        // 在这个区间，同一公司名的并发请求会被锁定
        Customer customer = new Customer();
        customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
        customer.checkConflict();  // 检查冲突
        
        // 持久化
        return Response.buildSuccess();
    }
}
```

### POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-lock-starter</artifactId>
</dependency>
```

需要有 Redis 支持：

```xml
<!-- Redis 客户端 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 配置示例

```properties
# Redis 连接
spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=
spring.redis.database=0

# 连接池
spring.redis.jedis.pool.max-active=8
spring.redis.jedis.pool.max-idle=8
spring.redis.jedis.pool.min-idle=0
```

### 最佳实践

1. **锁的粒度要合适**
   - 太粗粒度：影响并发性能
   - 太细粒度：无法保护共享资源

2. **避免死锁**
   - 设置合理的 leaseTime
   - 不要在锁内做耗时操作

3. **锁的 key 要唯一**
   - 不同操作使用不同的 key
   - 考虑使用业务 ID 作为 key

---

## COLA 组件间的整合

### 完整的命令执行流程

```
Request
   ↓
@RestController (spring-web)
   ↓
CustomerServiceImpl
  ├─ @CatchAndLog (cola-component-catchlog)
  └─→ CustomerAddCmdExe
      ├─ @DistributedLock (cola-component-lock) [可选]
      ├─ customerValidatingExtPt.validate() (cola-component-extension)
      ├─ Customer.checkConflict() (cola-component-domain)
      └─→ CustomerGatewayImpl (cola-component-exception for BizException)
         └─→ CustomerMapper
            └─→ Database
   ↓
Response (cola-component-dto)
   ↓
@ControllerAdvice (GlobalExceptionHandler)
   ├─ Catch BizException (cola-component-exception)
   └─ Return error response
   ↓
HTTP Response
```

### 完整示例代码

```java
// ==== client 层 ====
@Data
public class CustomerAddCmd implements Command {
    private static final long serialVersionUID = 1L;
    private CustomerDTO customerDTO;
}

@Data
public class CustomerDTO {
    private String companyName;
    private long registeredCapital;
}

// ==== adapter 层 ====
@RestController
public class CustomerController {
    
    @Autowired
    private CustomerServiceI customerService;
    
    @PostMapping(value = "/customer")
    public Response addCustomer(@RequestBody CustomerAddCmd customerAddCmd) {
        return customerService.addCustomer(customerAddCmd);
    }
}

// ==== app 层 ====
@Service
@CatchAndLog  // cola-component-catchlog
public class CustomerServiceImpl implements CustomerServiceI {
    
    @Resource
    private CustomerAddCmdExe customerAddCmdExe;
    
    @Override
    public Response addCustomer(CustomerAddCmd customerAddCmd) {
        return customerAddCmdExe.execute(customerAddCmd);
    }
}

@Component
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerValidatingExtPt customerValidatingExtPt;
    
    @Autowired
    private CustomerGateway customerGateway;
    
    @DistributedLock(  // cola-component-lock [可选]
        lockKey = "customer:add:#{cmd.getCustomerDTO().getCompanyName()}",
        waitTime = 3000,
        leaseTime = 5000
    )
    public Response execute(CustomerAddCmd cmd) {
        try {
            // 1. 扩展点：校验 (cola-component-extension)
            customerValidatingExtPt.validate(cmd);
            
            // 2. 领域对象：业务规则 (cola-component-domain)
            Customer customer = new Customer();
            customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
            customer.setRegisteredCapital(cmd.getCustomerDTO().getRegisteredCapital());
            customer.checkConflict();  // 业务规则检查
            
            // 3. 网关：持久化
            customerGateway.save(customer);
            
            // 4. 返回成功 (cola-component-dto)
            return Response.buildSuccess();
            
        } catch (BizException e) {  // cola-component-exception
            throw e;  // 让全局异常处理器处理
        }
    }
}

// ==== domain 层 ====
@Entity
@Data
public class Customer {
    private String customerId;
    private String companyName;
    private long registeredCapital;
    
    public void checkConflict() {
        if ("ConflictCompanyName".equals(this.companyName)) {
            throw new BizException("B_CUSTOMER_CONFLICT", "公司名已存在");
        }
    }
}

@Repository
public interface CustomerValidatingExtPt {
    void validate(CustomerAddCmd cmd);
}

@Component
@Extension(bizCode = "customer", useCase = "add")
public class CustomerValidatingImpl implements CustomerValidatingExtPt {
    
    @Override
    public void validate(CustomerAddCmd cmd) {
        if (cmd.getCustomerDTO().getCompanyName() == null) {
            throw new BizException("B_EMPTY_COMPANY_NAME", "公司名不能为空");
        }
    }
}

public interface CustomerGateway {
    void save(Customer customer);
    Customer getByCompanyName(String companyName);
}

// ==== infrastructure 层 ====
@Component
public class CustomerGatewayImpl implements CustomerGateway {
    
    @Autowired
    private CustomerMapper customerMapper;
    
    @Override
    public void save(Customer customer) {
        try {
            CustomerDO customerDO = convert(customer);
            customerMapper.insert(customerDO);
        } catch (Exception e) {
            throw new SysException("INSERT_DATABASE_ERROR", "保存数据库异常", e);
        }
    }
    
    private CustomerDO convert(Customer customer) {
        CustomerDO customerDO = new CustomerDO();
        customerDO.setCustomerId(customer.getCustomerId());
        customerDO.setCompanyName(customer.getCompanyName());
        customerDO.setRegisteredCapital(customer.getRegisteredCapital());
        return customerDO;
    }
}

// ==== 全局异常处理 ====
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BizException.class)
    @ResponseBody
    public Response handleBizException(BizException e) {
        log.warn("业务异常：{}", e.getErrMessage());
        return Response.buildFailure(e.getErrCode(), e.getErrMessage());
    }
    
    @ExceptionHandler(Exception.class)
    @ResponseBody
    public Response handleException(Exception e) {
        log.error("系统异常", e);
        return Response.buildFailure("SYSTEM_ERROR", "系统内部错误");
    }
}
```

---

## 组件选择指南

### 必选组件
- **cola-component-dto**：所有项目都需要
- **cola-component-domain-starter**：实现 DDD 的必需
- **cola-component-exception**：异常处理的必需

### 推荐组件
- **cola-component-catchlog-starter**：提高可观测性，强烈推荐

### 可选组件
- **cola-component-extension**：如果需要插件式扩展
- **cola-component-lock-starter**：如果需要分布式并发控制

---

## 常见问题

### Q1: 我的项目没有用到某些组件，能否不引入？
**A**: 可以的。COLA 的设计理念就是模块化和可组合。你可以只引入需要的组件，其他组件不是强制依赖。

### Q2: 不同的 Command/Query 执行器能否共存？
**A**: 完全可以。这是 COLA 推荐的做法，使用不同的 Exe 类来处理不同的业务用例。

### Q3: @CatchAndLog 会影响性能吗？
**A**: 会有一定影响，因为需要序列化拦截参数和返回值。对于高频调用的方法，可以选择不使用，改为手动日志。

### Q4: 分布式锁的 key 如何设计？
**A**: 根据业务语义设计，例如：
- `customer:add:${companyName}` - 保护特定公司名的新增
- `customer:${customerId}:update` - 保护特定客户的更新

### Q5: 扩展点如何测试？
**A**: 扩展点实现也是 Bean，可以通过 Mock 或提供测试实现来验证。

---

## 版本兼容性

本指南基于 **COLA 5.0.0** 版本编写。

如果使用其他版本（如 4.x 或 3.x），部分 API 可能有所不同。建议：
1. 查看官方 GitHub 项目的 release notes
2. 查看对应版本的 Javadoc
3. 查看示例项目的代码

---

## 参考资源

- **COLA 官方**：https://github.com/alibaba/COLA
- **COLA 架构指南**：在 GitHub 项目的 wiki 或文档目录中
- **组件源码 Javadoc**：在各组件 jar 包中

---

## 总结

COLA 5.0.0 提供的核心组件分别负责：

| 组件 | 职责 | 关键类 |
|------|------|--------|
| **dto** | 数据传输 | Response, MultiResponse, Command, Query |
| **domain-starter** | 领域建模 | @Entity, @ValueObject, @Repository |
| **exception** | 异常处理 | BizException, SysException |
| **catchlog-starter** | 方法日志 | @CatchAndLog |
| **extension** | 扩展点 | @Extension, @ExtensionExecutor |
| **lock-starter** | 分布式锁 | @DistributedLock |
| **statemachine** | 状态流转 | StateMachine, StateMachineFactory |
| **ruleengine** | 业务规则 | Rule, RuleBuilder, RuleEngine |

通过合理组合这些组件，可以快速构建规范、可维护、高可扩展的应用系统。

## 7. cola-component-statemachine（状态机组件）

### 概述

轻量级、无状态的状态机 DSL 实现，用于解决业务中的状态流转问题（如订单状态、审批流程等）。

**特点**：流式 API 定义状态流转、支持 PlantUML 可视化、支持条件分支。

**👉 详细文档**：[statemachine.md](./statemachine.md)

## 8. cola-component-ruleengine（规则引擎组件）

### 概述

轻量级规则引擎，将业务规则从代码中解耦，支持规则的声明式定义和组合使用。

**特点**：规则优先级排序、CompositeRule 组合规则、与扩展点机制配合。

**👉 详细文档**：[ruleengine.md](./ruleengine.md)


