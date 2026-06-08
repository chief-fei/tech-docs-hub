# cola-component-exception 异常处理组件

## 概述

`cola-component-exception` 是 COLA 框架的异常处理组件，提供了统一的异常体系，区分业务异常和系统异常，使异常处理更加规范和优雅。

**Maven Artifact**: `com.alibaba.cola:cola-component-exception`

## 核心特性

- 业务异常（BizException）和系统异常（SysException）分离
- 异常包含错误码和错误信息
- 异常可以链传播
- 支持全局异常处理

## 异常体系

```text
Throwable
    ├── Exception
    │   ├── BizException (业务异常) ← 预期的异常
    │   └── SysException (系统异常) ← 非预期的异常
    └── Error
        └── （系统级错误，不应捕获）
```

## 核心类

### 1. BizException - 业务异常

```java
public class BizException extends RuntimeException {
    private String errCode;      // 业务错误码
    private String errMessage;   // 错误信息
    
    public BizException(String code, String message);
    public BizException(String code, String message, Throwable cause);
    
    public String getErrCode();
    public String getErrMessage();
}
```

**特点**：
- 表示可预期的业务异常
- 包含业务错误码（如 B_CUSTOMER_CONFLICT）
- 用户友好的错误信息
- 不记录栈详密的栈跟踪（属于正常业务流程）

**常见业务异常场景**：

```java
// 1. 数据冲突
throw new BizException("B_CUSTOMER_CONFLICT", "公司名已存在");

// 2. 数据校验失败
throw new BizException("B_INVALID_AMOUNT", "金额必须大于0");

// 3. 业务规则违反
throw new BizException("B_STOCK_INSUFFICIENT", "库存不足");

// 4. 业务状态异常
throw new BizException("B_ORDER_ALREADY_SHIPPED", "订单已发货，无法取消");

// 5. 权限不足（业务级）
throw new BizException("B_NO_PERMISSION", "您没有权限执行此操作");
```

**使用示例**：

```java
@Component
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerGateway customerGateway;
    
    public Response execute(CustomerAddCmd cmd) {
        // 检查公司名是否已存在
        Customer existingCustomer = customerGateway
            .getByCompanyName(cmd.getCustomerDTO().getCompanyName());
        
        if (existingCustomer != null) {
            throw new BizException(
                "B_CUSTOMER_CONFLICT",
                "公司 " + cmd.getCustomerDTO().getCompanyName() + " 已存在"
            );
        }
        
        // 验证注册资金
        if (cmd.getCustomerDTO().getRegisteredCapital() <= 0) {
            throw new BizException(
                "B_INVALID_CAPITAL",
                "注册资金必须大于0"
            );
        }
        
        // 继续业务逻辑
        return Response.buildSuccess();
    }
}
```

**在全局异常处理器中的处理**：

```java
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BizException.class)
    @ResponseBody
    public Response handleBizException(BizException e) {
        // 业务异常只记录 WARN 级别（属于正常业务逻辑）
        log.warn("业务异常 - 错误码: {}, 错误信息: {}", e.getErrCode(), e.getErrMessage());
        
        // 直接返回错误信息给用户
        return Response.buildFailure(e.getErrCode(), e.getErrMessage());
    }
}
```

### 2. SysException - 系统异常

```java
public class SysException extends RuntimeException {
    private String errCode = "SYSTEM_ERROR";  // 默认系统错误码
    private String errMessage;
    
    public SysException(String message);
    public SysException(String code, String message);
    public SysException(String message, Throwable cause);
    public SysException(String code, String message, Throwable cause);
    
    public String getErrCode();
    public String getErrMessage();
}
```

**特点**：
- 表示非预期的系统异常
- 包含系统错误码（如 S_DATABASE_ERROR）
- 不友好的错误信息通常不暴露给用户
- 需要记录详细的栈跟踪用于问题诊断

**常见系统异常场景**：

```java
// 1. 数据库异常
try {
    customerMapper.insert(customerDO);
} catch (Exception e) {
    throw new SysException("S_DATABASE_ERROR", "保存客户到数据库失败", e);
}

// 2. 网络异常
try {
    creditService.getCredit(customerId);
} catch (IOException e) {
    throw new SysException("S_NETWORK_ERROR", "调用信用服务失败", e);
}

// 3. 缓存异常
try {
    redis.set(key, value);
} catch (RedisConnectionException e) {
    throw new SysException("S_REDIS_ERROR", "Redis 操作失败", e);
}

// 4. 文件操作异常
try {
    Files.write(path, content.getBytes());
} catch (IOException e) {
    throw new SysException("S_FILE_ERROR", "文件写入失败", e);
}

// 5. 配置加载异常
try {
    loadConfig();
} catch (Exception e) {
    throw new SysException("S_CONFIG_ERROR", "配置加载失败", e);
}
```

**使用示例**：

```java
@Component
public class CustomerGatewayImpl implements CustomerGateway {
    
    @Autowired
    private CustomerMapper customerMapper;
    
    @Override
    public void save(Customer customer) {
        try {
            CustomerDO customerDO = convert(customer);
            customerMapper.insert(customerDO);
        } catch (DataIntegrityViolationException e) {
            // 数据库约束冲突 - 这是系统级异常
            throw new SysException(
                "S_DATABASE_CONSTRAINT",
                "数据库约束冲突：" + e.getMessage(),
                e
            );
        } catch (Exception e) {
            // 其他数据库异常
            throw new SysException(
                "S_DATABASE_ERROR",
                "保存客户信息失败",
                e
            );
        }
    }
    
    @Override
    public Customer getByCompanyName(String companyName) {
        try {
            CustomerDO customerDO = customerMapper.getByCompanyName(companyName);
            return convert(customerDO);
        } catch (Exception e) {
            throw new SysException(
                "S_QUERY_ERROR",
                "查询客户失败",
                e
            );
        }
    }
}
```

**在全局异常处理器中的处理**：

```java
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(SysException.class)
    @ResponseBody
    public Response handleSysException(SysException e) {
        // 系统异常记录 ERROR 级别和完整堆栈（用于问题诊断）
        log.error("系统异常 - 错误码: {}, 错误信息: {}", e.getErrCode(), e.getErrMessage(), e);
        
        // 不向用户暴露详细的系统错误信息
        return Response.buildFailure(
            e.getErrCode(),
            "系统内部错误，请联系管理员"
            // 或者返回一个通用的错误信息，不暴露具体原因
        );
    }
}
```

## 完整的全局异常处理器示例

```java
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.method.annotation.MethodArgumentNotValidException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import com.alibaba.cola.dto.Response;
import com.alibaba.cola.exception.BizException;
import com.alibaba.cola.exception.SysException;
import lombok.extern.slf4j.Slf4j;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    /**
     * 处理业务异常
     * - 如：数据冲突、校验失败、业务规则违反
     */
    @ExceptionHandler(BizException.class)
    @ResponseBody
    public Response handleBizException(BizException e) {
        log.warn("业务异常 - 错误码: {}, 消息: {}", e.getErrCode(), e.getErrMessage());
        return Response.buildFailure(e.getErrCode(), e.getErrMessage());
    }
    
    /**
     * 处理系统异常
     * - 如：数据库错误、网络错误、缓存错误
     */
    @ExceptionHandler(SysException.class)
    @ResponseBody
    public Response handleSysException(SysException e) {
        log.error("系统异常 - 错误码: {}, 消息: {}", e.getErrCode(), e.getErrMessage(), e);
        return Response.buildFailure(
            e.getErrCode(),
            "系统内部错误，请稍后重试"
        );
    }
    
    /**
     * 处理参数验证异常
     * - 如：@NotNull, @NotEmpty 验证失败
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseBody
    public Response handleValidationException(MethodArgumentNotValidException e) {
        String errorMsg = e.getBindingResult()
            .getFieldError()
            .getDefaultMessage();
        log.warn("参数验证失败: {}", errorMsg);
        return Response.buildFailure("P_PARAM_INVALID", errorMsg);
    }
    
    /**
     * 处理所有其他异常
     * - 捕获所有未处理的异常
     */
    @ExceptionHandler(Exception.class)
    @ResponseBody
    public Response handleException(Exception e) {
        log.error("未知异常", e);
        return Response.buildFailure(
            "SYSTEM_ERROR",
            "系统内部错误，请联系管理员"
        );
    }
}
```

## 异常处理流程图

```text
Request
  ↓
@Service
  ├─ 业务规则检查 ← 抛出 BizException
  │    ↓
  │ checkConflict() → throw new BizException("B_xx", "msg")
  │
  ├─ 数据库操作 ← 抛出 SysException
  │    ↓
  │ customerMapper.insert() → throw new SysException("S_xx", "msg", e)
  │
  └─ 响应处理
       ↓
@ControllerAdvice GlobalExceptionHandler
  ├─ @ExceptionHandler(BizException.class)
  │    → 记录 WARN
  │    → 返回业务错误信息给用户
  │
  ├─ @ExceptionHandler(SysException.class)
  │    → 记录 ERROR + 堆栈
  │    → 返回通用错误信息给用户
  │
  └─ @ExceptionHandler(Exception.class)
       → 记录 ERROR + 堆栈
       → 返回通用错误信息给用户
  ↓
Response
  ↓
HTTP Response (JSON)
```

## 错误码规范

建议建立统一的错误码规范：

```java
public enum ErrorCode {
    // 业务异常 (B_)
    B_CUSTOMER_CONFLICT("B_CUSTOMER_CONFLICT", "客户信息冲突"),
    B_CUSTOMER_NOT_FOUND("B_CUSTOMER_NOT_FOUND", "客户不存在"),
    B_INVALID_AMOUNT("B_INVALID_AMOUNT", "金额无效"),
    B_STOCK_INSUFFICIENT("B_STOCK_INSUFFICIENT", "库存不足"),
    B_ORDER_STATUS_INVALID("B_ORDER_STATUS_INVALID", "订单状态不合法"),
    
    // 参数异常 (P_)
    P_PARAM_EMPTY("P_PARAM_EMPTY", "必填参数为空"),
    P_PARAM_INVALID("P_PARAM_INVALID", "参数格式无效"),
    P_PARAM_OUT_OF_RANGE("P_PARAM_OUT_OF_RANGE", "参数超过范围"),
    
    // 系统异常 (S_)
    S_DATABASE_ERROR("S_DATABASE_ERROR", "数据库异常"),
    S_NETWORK_ERROR("S_NETWORK_ERROR", "网络异常"),
    S_REDIS_ERROR("S_REDIS_ERROR", "缓存异常"),
    S_FILE_ERROR("S_FILE_ERROR", "文件操作异常"),
    S_CONFIG_ERROR("S_CONFIG_ERROR", "配置异常"),
    
    // 权限异常（可选 - A_）
    A_NO_PERMISSION("A_NO_PERMISSION", "权限不足"),
    A_NOT_AUTHENTICATED("A_NOT_AUTHENTICATED", "未认证");
    
    private final String code;
    private final String message;
    
    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }
    
    public String getCode() {
        return code;
    }
    
    public String getMessage() {
        return message;
    }
}
```

使用错误码枚举：

```java
// 不好的做法
throw new BizException("B_CUSTOMER_CONFLICT", "公司名已存在");

// 好的做法
throw new BizException(
    ErrorCode.B_CUSTOMER_CONFLICT.getCode(),
    ErrorCode.B_CUSTOMER_CONFLICT.getMessage()
);
```

## 异常链传播

异常链传播示例：

```java
// 1. 最底层 - DAO 层
@Component
public class CustomerGatewayImpl {
    @Autowired
    private CustomerMapper customerMapper;
    
    public void save(Customer customer) {
        try {
            customerMapper.insert(convert(customer));
        } catch (DataAccessException e) {
            // 捕获 Spring 的数据访问异常，转换为系统异常
            throw new SysException("S_DATABASE_ERROR", "保存失败", e);
        }
    }
}

// 2. 中间层 - 业务逻辑
@Component
public class CustomerAddCmdExe {
    @Autowired
    private CustomerGateway customerGateway;
    @Autowired
    private CustomerValidator validator;
    
    public Response execute(CustomerAddCmd cmd) {
        try {
            // 业务校验
            validator.validate(cmd);
            
            // 持久化 - 这里如果 save 抛出 SysException，会直接外抛
            customerGateway.save(convert(cmd));
            
            return Response.buildSuccess();
        } catch (BizException e) {
            // 业务异常直接外抛
            throw e;
        }
        // SysException 和其他异常也会直接外抛
    }
}

// 3. 最外层 - Controller 和全局异常处理器
@RestController
public class CustomerController {
    @Autowired
    private CustomerServiceI customerService;
    
    @PostMapping("/customer")
    public Response addCustomer(@RequestBody CustomerAddCmd cmd) {
        // 异常会被 GlobalExceptionHandler 捕获和处理
        return customerService.addCustomer(cmd);
    }
}

// 异常处理链：
// SysException (from CustomerGateway)
//   ↓
// 传播到 CustomerAddCmdExe
//   ↓
// 传播到 CustomerService
//   ↓
// 传播到 CustomerController
//   ↓
// @ControllerAdvice GlobalExceptionHandler
//   ↓
// handleSysException() 处理
//   ↓
// 返回错误响应给用户
```

## 最佳实践

### 1. 明确区分异常类型

```java
// ✅ 正确：公司名冲突是业务异常
if (existingCustomer != null) {
    throw new BizException("B_CONFLICT", "公司名已存在");
}

// ❌ 错误：数据库访问错误是系统异常，不是业务异常
try {
    customerMapper.getByName(name);
} catch (Exception e) {
    throw new BizException("B_QUERY_ERROR", "查询失败", e);  // 不对！
}
```

### 2. 异常中包含关键信息

```java
// ❌ 不好：信息模糊
throw new BizException("B_ERROR", "错误");

// ✅ 好：信息具体
throw new BizException(
    "B_CUSTOMER_CONFLICT",
    "公司名 '" + companyName + "' 已存在，请使用其他名称"
);
```

### 3. 保留原始异常链

```java
// ✅ 正确：保留原始异常，便于诊断
try {
    customerMapper.insert(customerDO);
} catch (Exception e) {
    throw new SysException("S_DATABASE_ERROR", "保存失败", e);
}

// ❌ 错误：丢失原始异常信息
try {
    customerMapper.insert(customerDO);
} catch (Exception e) {
    throw new SysException("S_DATABASE_ERROR", "保存失败");
}
```

### 4. 日志级别使用规范

```java
// 业务异常：WARN 级别（属于正常业务流程）
log.warn("业务异常", bizException);

// 系统异常：ERROR 级别（需要关注）
log.error("系统异常", sysException);

// 堆栈信息：只在系统异常时记录
log.error("系统异常", sysException);  // 会包含堆栈
log.warn("业务异常", bizException);   // 可以不包含堆栈
```

## POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-exception</artifactId>
</dependency>
```

> **注意**：COLA 5.0.0 要求 JDK 17+，仅支持 Spring Boot 3.x。如需 Spring Boot 2.7.x 支持，请使用 COLA 4.x 版本。

## 常见问题

**Q: 何时使用 BizException，何时使用 SysException？**
A: 
- BizException：预期会发生的业务异常，用户可以理解的错误
- SysException：意外发生的系统异常，用户不需要了解详情

**Q: 能否在 BizException 中使用 cause？**
A: 可以，但通常不需要。BizException 表示业务检查结果，通常不是由其他异常引起的。

**Q: 异常信息中能否包含敏感信息？**
A: 业务异常（BizException）的信息会返回给用户，不能包含敏感信息。系统异常（SysException）只在日志中记录，可以包含详细信息。

## 参考

- COLA 官方项目：https://github.com/alibaba/COLA


