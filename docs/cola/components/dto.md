# cola-component-dto 数据传输组件

## 概述

`cola-component-dto` 是 COLA 框架的数据传输核心组件，提供了标准的 DTO 和响应对象包装，用于统一系统各层之间的数据传输格式。

**Maven Artifact**: `com.alibaba.cola:cola-component-dto`

## 核心概念

### DTO（Data Transfer Object）
数据传输对象，用于在不同层之间传递数据。在 COLA 中，DTO 有特定的分类：

- **Command**: 表示对系统状态的修改请求
- **Query**: 表示对系统状态的查询请求  
- **DTO**: 通用数据传输对象

### Response 对象
统一的响应格式，包含成功/失败状态、错误码和错误信息。

## API 文档

### 1. Command 接口

```java
public interface Command extends Serializable {
    // 标记接口，用于标记命令对象
}
```

**特点**：
- 负责触发系统状态变更
- 通常在 adapter 层接收，app 层处理
- 应该携带足够的信息完成一个完整的业务操作

**最佳实践**：

```java
@Data
@NoArgsConstructor
public class CustomerAddCmd implements Command {
    private static final long serialVersionUID = 1L;
    
    private CustomerDTO customerDTO;
    
    // 或者更详细的字段
    private String customerId;
    private String companyName;
    private long registeredCapital;
}
```

### 2. Query 抽象类

```java
public abstract class Query implements Serializable {
    // 基类，所有查询对象应继承此类
    private static final long serialVersionUID = 1L;
}
```

**特点**：
- 负责查询系统状态
- 不会修改系统状态
- 可能需要分页、排序等查询条件

**最佳实践**：

```java
@Data
@NoArgsConstructor
public class CustomerListByNameQry extends Query {
    private static final long serialVersionUID = 1L;
    
    private String name;
    private String customerType;
    
    // 分页参数
    private int pageIndex = 1;
    private int pageSize = 10;
}

@Data
@NoArgsConstructor
public class CustomerDetailQry extends Query {
    private static final long serialVersionUID = 1L;
    
    private String customerId;
}
```

### 3. Response 类

```java
public class Response implements Serializable {
    private String errCode;
    private String errMsg;
    private boolean success;
    
    // 工厂方法
    public static Response buildSuccess();
    public static Response buildSuccess(String msg);
    public static Response buildFailure(String code, String msg);
    
    // getter/setter（省略）
}
```

**使用场景**: 返回单个操作的结果，不包含数据

**常见使用**：

```java
// 成功
Response.buildSuccess()
Response.buildSuccess("添加成功")

// 失败
Response.buildFailure("B_CUSTOMER_CONFLICT", "公司名已存在")
Response.buildFailure("SYS_ERROR", "系统错误")
```

**在 Controller 中的使用**：

```java
@PostMapping(value = "/customer")
public Response addCustomer(@RequestBody CustomerAddCmd cmd) {
    try {
        return customerService.addCustomer(cmd);
    } catch (Exception e) {
        return Response.buildFailure("SYSTEM_ERROR", "系统异常");
    }
}
```

### 4. SingleResponse 类

```java
public class SingleResponse<T> extends Response {
    private T data;
    
    public static <T> SingleResponse<T> of(T data);
    public static <T> SingleResponse<T> buildSuccess(T data);
    public static <T> SingleResponse<T> buildFailure(String code, String msg);
}
```

**使用场景**: 返回单个复杂对象

**使用示例**：

```java
@Component
public class CustomerGetQryExe {
    
    @Autowired
    private CustomerGateway customerGateway;
    
    public SingleResponse<CustomerDTO> execute(CustomerDetailQry qry) {
        Customer customer = customerGateway.getByById(qry.getCustomerId());
        if (customer == null) {
            return SingleResponse.buildFailure("CUSTOMER_NOT_FOUND", "客户不存在");
        }
        
        CustomerDTO dto = convertToDTO(customer);
        return SingleResponse.of(dto);
    }
}
```

**在 Controller 中的使用**：

```java
@GetMapping(value = "/customer/{customerId}")
public SingleResponse<CustomerDTO> getCustomer(@PathVariable String customerId) {
    CustomerDetailQry qry = new CustomerDetailQry();
    qry.setCustomerId(customerId);
    return customerService.getCustomer(qry);
}
```

### 5. MultiResponse 类

```java
public class MultiResponse<T> extends Response {
    private List<T> data;
    
    public static <T> MultiResponse<T> of(List<T> data);
    public static <T> MultiResponse<T> buildSuccess();
    public static <T> MultiResponse<T> buildSuccess(List<T> data);
    public static <T> MultiResponse<T> buildFailure(String code, String msg);
}
```

**使用场景**: 返回多个对象列表

**使用示例**：

```java
@Component
public class CustomerListByNameQryExe {
    
    @Autowired
    private CustomerMapper customerMapper;
    
    public MultiResponse<CustomerDTO> execute(CustomerListByNameQry qry) {
        // 查询数据
        List<CustomerDO> customerDOs = customerMapper.listByName(qry.getName());
        
        if (customerDOs == null || customerDOs.isEmpty()) {
            return MultiResponse.buildSuccess(Collections.emptyList());
        }
        
        // 转换为 DTO
        List<CustomerDTO> customerDTOs = customerDOs.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
        
        return MultiResponse.of(customerDTOs);
    }
    
    private CustomerDTO convertToDTO(CustomerDO customerDO) {
        CustomerDTO dto = new CustomerDTO();
        dto.setCustomerId(customerDO.getCustomerId());
        dto.setCompanyName(customerDO.getCompanyName());
        return dto;
    }
}
```

**在 Controller 中的使用**：

```java
@GetMapping(value = "/customers")
public MultiResponse<CustomerDTO> listCustomers(
    @RequestParam(required = false) String name) {
    
    CustomerListByNameQry qry = new CustomerListByNameQry();
    qry.setName(name);
    return customerService.listByName(qry);
}
```

### 6. PageResponse 类

```java
public class PageResponse<T> extends Response {
    private List<T> data;
    private long pageIndex;
    private long pageSize;
    private long totalCount;
    
    public static <T> PageResponse<T> of(
        List<T> data, 
        long pageIndex, 
        long pageSize, 
        long totalCount
    );
}
```

**使用场景**: 返回分页查询结果

**使用示例**：

```java
@Data
@NoArgsConstructor
public class CustomerPageQry extends Query {
    private static final long serialVersionUID = 1L;
    
    private String name;
    private int pageIndex = 1;
    private int pageSize = 10;
}

@Component
public class CustomerPageQryExe {
    
    @Autowired
    private CustomerMapper customerMapper;
    
    public PageResponse<CustomerDTO> execute(CustomerPageQry qry) {
        // 计算分页数据库查询偏移量
        int offset = (qry.getPageIndex() - 1) * qry.getPageSize();
        
        // 查询数据
        List<CustomerDO> customerDOs = customerMapper.listByNamePage(
            qry.getName(), 
            offset, 
            qry.getPageSize()
        );
        
        // 查询总数
        long totalCount = customerMapper.countByName(qry.getName());
        
        // 转换为 DTO
        List<CustomerDTO> customerDTOs = customerDOs.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
        
        return PageResponse.of(customerDTOs, qry.getPageIndex(), qry.getPageSize(), totalCount);
    }
    
    private CustomerDTO convertToDTO(CustomerDO customerDO) {
        CustomerDTO dto = new CustomerDTO();
        dto.setCustomerId(customerDO.getCustomerId());
        dto.setCompanyName(customerDO.getCompanyName());
        return dto;
    }
}
```

**在 Controller 中的使用**：

```java
@GetMapping(value = "/customers/page")
public PageResponse<CustomerDTO> pageCustomers(
    @RequestParam(required = false) String name,
    @RequestParam(defaultValue = "1") int pageIndex,
    @RequestParam(defaultValue = "10") int pageSize) {
    
    CustomerPageQry qry = new CustomerPageQry();
    qry.setName(name);
    qry.setPageIndex(pageIndex);
    qry.setPageSize(pageSize);
    
    return customerService.page(qry);
}
```

## 完整的命令和查询流程

### 命令流程示例

```text
POST /customer
    ↓
@RequestBody CustomerAddCmd
    ↓
Spring 反序列化为 Command 对象
    ↓
CustomerController.addCustomer(cmd)
    ↓
CustomerService.addCustomer(cmd)
    ↓
CustomerAddCmdExe.execute(cmd)
    ↓
return Response.buildSuccess() 或 buildFailure()
    ↓
@ResponseBody 序列化为 JSON
    ↓
{
    "errCode": null,
    "errMsg": null,
    "success": true
}
```

### 查询流程示例

```text
GET /customers?name=xxx
    ↓
CustomerController.listCustomers(name)
    ↓
new CustomerListByNameQry()
    ↓
CustomerService.listByName(qry)
    ↓
CustomerListByNameQryExe.execute(qry)
    ↓
return MultiResponse.of(list)
    ↓
@ResponseBody 序列化为 JSON
    ↓
{
    "success": true,
    "errCode": null,
    "errMsg": null,
    "data": [
        {"customerId": "1", "companyName": "Company A"},
        {"customerId": "2", "companyName": "Company B"}
    ]
}
```

## DTO 最佳实践

### 1. 定义清晰的 DTO

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerDTO {
    private static final long serialVersionUID = 1L;
    
    // 基本信息
    @NotEmpty(message = "客户ID不能为空")
    private String customerId;
    
    @NotEmpty(message = "公司名不能为空")
    private String companyName;
    
    @NotNull(message = "注册资金不能为空")
    @Min(value = 0, message = "注册资金必须大于0")
    private long registeredCapital;
    
    // 扩展字段
    private String customerType;
    private String source;
}
```

### 2. 使用验证注解

```java
import javax.validation.constraints.*;

@Data
public class CustomerAddCmd implements Command {
    private static final long serialVersionUID = 1L;
    
    @Valid  // 级联验证
    @NotNull(message = "客户信息不能为空")
    private CustomerDTO customerDTO;
}
```

### 3. 在 Controller 中启用验证

```java
@PostMapping(value = "/customer")
public Response addCustomer(@Valid @RequestBody CustomerAddCmd cmd, BindingResult bindingResult) {
    if (bindingResult.hasErrors()) {
        String errorMsg = bindingResult.getFieldError().getDefaultMessage();
        return Response.buildFailure("PARAM_ERROR", errorMsg);
    }
    return customerService.addCustomer(cmd);
}
```

### 4. 分离不同用途的 DTO

```java
// 创建时的 DTO（用于 POST）
@Data
public class CustomerCreateDTO {
    private String companyName;
    private long registeredCapital;
}

// 更新时的 DTO（用于 PUT）
@Data
public class CustomerUpdateDTO {
    private String customerId;
    private String companyName;
    private long registeredCapital;
}

// 返回时的 DTO（用于响应）
@Data
public class CustomerResponseDTO {
    private String customerId;
    private String companyName;
    private long registeredCapital;
    private LocalDateTime createdTime;
    private LocalDateTime updatedTime;
}
```

## 错误码规范

在使用 Response 返回错误时，应该遵循统一的错误码规范：

```java
public enum ErrorCode {
    // 业务异常（B_）
    B_CUSTOMER_CONFLICT("B_CUSTOMER_CONFLICT", "客户公司名冲突"),
    B_CUSTOMER_NOT_FOUND("B_CUSTOMER_NOT_FOUND", "客户不存在"),
    
    // 参数错误（P_）
    P_PARAM_EMPTY("P_PARAM_EMPTY", "参数为空"),
    P_PARAM_INVALID("P_PARAM_INVALID", "参数无效"),
    
    // 系统错误（S_）
    S_DATABASE_ERROR("S_DATABASE_ERROR", "数据库异常"),
    S_NETWORK_ERROR("S_NETWORK_ERROR", "网络异常"),
    
    // 权限错误（A_）
    A_PERMISSION_DENIED("A_PERMISSION_DENIED", "权限不足");
    
    private final String code;
    private final String message;
    
    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }
}
```

## POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-dto</artifactId>
    <!-- 版本由 cola-components-bom 管理 -->
</dependency>
```

如果使用 BOM 管理版本：

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.alibaba.cola</groupId>
            <artifactId>cola-components-bom</artifactId>
            <version>5.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-dto</artifactId>
    </dependency>
</dependencies>
```

> **注意**：COLA 5.0.0 要求 JDK 17+，仅支持 Spring Boot 3.x。如需 Spring Boot 2.7.x 支持，请使用 COLA 4.x 版本。

## 常见问题

**Q: 为什么需要 Command 和 Query 分离？**
A: 这是 CQRS（Command Query Responsibility Segregation）模式，优势包括：
- 语义清晰：一眼能看出是修改还是查询操作
- 可以对 Command 和 Query 应用不同的处理策略（事务、缓存等）
- 便于扩展：可以独立地扩展命令和查询的能力

**Q: Response 返回的 data 是什么？**
A: Response 本身不含 data，是基类。data 字段存在于：
- `SingleResponse<T>`：单个对象
- `MultiResponse<T>`：多个对象列表
- `PageResponse<T>`：分页结果

**Q: 能否直接返回业务对象而不是 DTO？**
A: 不推荐。原因包括：
- 不同的调用方可能需要不同的字段
- 业务对象和 DTO 耦合，难以独立演进
- 可能暴露内部实现细节

**Q: serialVersionUID 有什么用？**
A: 用于对象序列化和反序列化：
- 当类结构改变时，能检测出不兼容的版本
- 分布式系统中重要（如消息队列、缓存）
- 建议每个 Command/Query/DTO 都设置

## 参考

- COLA 官方项目：https://github.com/alibaba/COLA
- CQRS 模式：https://martinfowler.com/bliki/CQRS.html


