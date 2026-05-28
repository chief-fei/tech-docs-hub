# COLA 架构详解

## 项目概述

这是一个基于 **COLA（Clean Object Layer Architecture）** 架构的 Java 多模块项目示例。项目使用 Spring Boot + MyBatis + Maven 进行构建，演示了如何在实际工程中应用 DDD（领域驱动设计）和分层架构思想。

### 项目信息
- **框架**：Spring Boot 2.7.2
- **构建工具**：Maven
- **数据库**：MySQL
- **ORM**：MyBatis 2.2.2
- **COLA 版本**：5.0.0

---

## 整体架构视图

这个项目遵循 COLA 标准分层，从上到下的调用流程是：

```text
外部请求 (HTTP/RPC/MQ)
         ↓
┌─────────────────────────────────────┐
│ adapter（接入层）                    │ ← 适配不同终端协议
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ app（应用层）                        │ ← 编排用例流程
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ domain（领域层）                     │ ← 核心业务规则
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ infrastructure（基础设施层）          │ ← 技术细节实现
└─────────────────────────────────────┘
         ↓
    数据库 / 外部系统
```

---

## 六大模块详解

### 1. demo-web-client（客户端契约层）

**位置**：`demo-web-client/`

**核心职责**：
- 定义对外暴露的服务接口
- 定义 Command（命令）对象
- 定义 Query（查询）对象
- 定义 DTO（数据传输对象）和错误码
- 提供统一的应用边界协议

**关键文件**：

| 文件 | 说明 |
|------|------|
| `api/CustomerServiceI.java` | 服务接口定义，是约定 |
| `dto/CustomerAddCmd.java` | 新增客户命令对象 |
| `dto/CustomerListByNameQry.java` | 按名称查询客户查询对象 |
| `dto/data/CustomerDTO.java` | 客户数据传输对象 |
| `dto/data/ErrorCode.java` | 错误码枚举 |
| `dto/event/DomainEventConstant.java` | 领域事件常量 |

**设计理念**：
- 充当 adapter 和 app 的通信协议
- 使不同实现者和调用者通过稳定的接口和 DTO 解耦
- 所有跨层调用都应该通过这里定义的类型

**一句话**：系统对外的"承诺"或"契约"。

---

### 2. demo-web-adapter（适配层）

**位置**：`demo-web-adapter/`

**核心职责**：
- 接收外部请求（HTTP、RPC、MQ 等）
- 将协议和格式进行适配转换
- 将请求参数转换为 Command/Query 对象
- 调用 client 层定义的服务接口
- 返回响应

**关键文件**：

| 文件 | 说明 |
|------|------|
| `web/CustomerController.java` | Web 接口入口，HTTP 协议适配 |
| `mobile/CustomerMobileAdaptor.java` | 移动端适配器（示例占位） |
| `wap/CustomerWapAdaptor.java` | WAP 端适配器（示例占位） |

**示例代码解读**：

```java
@GetMapping(value = "/customer")
public MultiResponse<CustomerDTO> listCustomerByName(@RequestParam(required = false) String name){
    // 1. 接收 HTTP 参数
    // 2. 组装成 Query 对象
    CustomerListByNameQry customerListByNameQry = new CustomerListByNameQry();
    customerListByNameQry.setName(name);
    // 3. 调用 client 层定义的接口
    return customerService.listByName(customerListByNameQry);
}
```

**设计理念**：
- 不因承载的入口而暴露内层逻辑
- 多个终端可以共享同一套 app/domain 逻辑
- 充当"协议翻译官"，而非业务实现者

**一句话**：把外部请求"翻译"成系统可理解的内部消息。

---

### 3. demo-web-app（应用层）

**位置**：`demo-web-app/`

**核心职责**：
- 实现 client 层定义的服务接口
- 编排业务用例的执行流程
- 控制事务、日志、校验、异常处理等应用级关注点
- 调用领域对象、领域服务、网关
- 区分 Command（命令）和 Query（查询）的处理

**关键文件**：

| 文件 | 说明 |
|------|------|
| `customer/CustomerServiceImpl.java` | 应用服务门面，实现 CustomerServiceI |
| `customer/executor/CustomerAddCmdExe.java` | 新增客户用例执行器 |
| `customer/executor/query/CustomerListByNameQryExe.java` | 查询客户用例执行器 |
| `order/OrderServiceImpl.java` | 订单应用服务（示例占位） |

**示例代码解读**：

```java
@Service
@CatchAndLog
public class CustomerServiceImpl implements CustomerServiceI {
    @Resource
    private CustomerAddCmdExe customerAddCmdExe;
    
    @Resource
    private CustomerListByNameQryExe customerListByNameQryExe;
    
    // 应用服务不直接写业务，而是分发给具体执行器
    public Response addCustomer(CustomerAddCmd customerAddCmd) {
        return customerAddCmdExe.execute(customerAddCmd);
    }
}
```

```java
@Component
public class CustomerAddCmdExe {
    public Response execute(CustomerAddCmd cmd) {
        // 编织用例流程
        if(cmd.getCustomerDTO().getCompanyName().equals("ConflictCompanyName")){
            throw new BizException(ErrorCode.B_CUSTOMER_companyNameConflict.getErrCode(), "公司名冲突");
        }
        return Response.buildSuccess();
    }
}
```

**设计理念**：
- CQRS 分离：Command 和 Query 有独立的执行器
- 用例编排不等于业务规则实现
- 应该通过调用 domain 层来完成业务逻辑
- 应用级横切关注点（日志、异常、事务）在这一层处理

**当前状态**：
- ✅ 结构正确（ServiceImpl 分发给 CmdExe/QryExe）
- ❌ 业务规则还比较简单，未充分利用 domain 层能力

**一句话**：定义"这个业务用例怎样一步步走下去"。

---

### 4. demo-web-domain（领域层）

**位置**：`demo-web-domain/`

**核心职责**：
- 承载系统最核心、最稳定的业务知识
- 定义领域实体（Entity）
- 定义值对象和枚举
- 定义领域服务
- 定义领域网关接口（抽象，不涉及技术实现）
- 实现核心的业务规则和业务行为

**关键文件**：

| 文件 | 说明 |
|------|------|
| `domain/customer/Customer.java` | 客户领域实体，包含业务规则 |
| `domain/customer/Credit.java` | 信用领域实体 |
| `domain/customer/CustomerType.java` | 客户类型枚举 |
| `domain/customer/CompanyType.java` | 公司类型枚举 |
| `domain/customer/SourceType.java` | 来源类型枚举 |
| `domain/customer/gateway/CustomerGateway.java` | 客户网关抽象 |
| `domain/customer/gateway/CreditGateway.java` | 信用网关抽象 |
| `domain/customer/domainservice/CreditChecker.java` | 信用检查领域服务 |
| `domain/order/Order.java` | 订单领域实体（示例占位） |

**示例代码解读**：

```java
@Entity
@Data
public class Customer {
    private String customerId;
    private String memberId;
    private String globalId;
    private long registeredCapital;
    private String companyName;
    private SourceType sourceType;
    private CompanyType companyType;
    
    // 业务行为：判断是否大企业
    public boolean isBigCompany() {
        return registeredCapital > 10000000; // 注册资金大于1000万
    }
    
    // 业务行为：判断是否中小企业
    public boolean isSME() {
        return registeredCapital > 10000 && registeredCapital < 1000000;
    }
    
    // 业务行为：检查冲突
    public void checkConflict(){
        if("ConflictCompanyName".equals(this.companyName)){
            throw new BizException(this.companyName+" has already existed, you can not add it");
        }
    }
}
```

**网关接口**：

```java
// 领域层只定义抽象，不涉及技术细节
public interface CustomerGateway {
    Customer getByById(String customerId);
}

public interface CreditGateway {
    Credit getCredit(String customerId);
}
```

**设计理念**：
- 实体不是贫血对象，而是包装了业务规则的富领域对象
- 网关定义领域需要什么，由 infrastructure 负责落地
- 这是 DDD 和依赖倒置的核心体现
- 领域层不依赖任何技术框架（不 import MyBatis、Spring 等）

**当前状态**：
- ✅ 领域模型已有良好的业务抽象
- ✅ 网关接口清晰
- ❌ 业务规则还没有被充分调用（app 层应该更多地委托给 domain）

**一句话**：承载系统最有价值的业务知识，是稳定的、复用的核心资产。

---

### 5. demo-web-infrastructure（基础设施层）

**位置**：`demo-web-infrastructure/`

**核心职责**：
- 实现 domain 层定义的网关接口
- 处理数据库访问（MyBatis）
- 处理外部系统调用
- 提供配置和技术细节
- 定义 DO（Data Object）对象
- 提供日志、资源等技术配置

**关键文件**：

| 文件 | 说明 |
|------|------|
| `customer/CustomerGatewayImpl.java` | 实现 CustomerGateway，提供客户查询 |
| `customer/CreditGatewayImpl.java` | 实现 CreditGateway，调用外部服务 |
| `customer/CustomerMapper.java` | MyBatis Mapper，数据库访问接口 |
| `customer/CustomerDO.java` | 数据库对象，与表结构映射 |
| `config/DiamondConfig.java` | 配置管理 |
| `order/OrderGatewayImpl.java` | 订单网关实现（示例占位） |
| `resources/mybatis/customer-mapper.xml` | MyBatis 映射配置 |
| `resources/mybatis/mybatis-config.xml` | MyBatis 全局配置 |
| `resources/logback-spring.xml` | 日志配置 |

**示例代码解读**：

```java
@Component
public class CustomerGatewayImpl implements CustomerGateway {
    @Autowired
    private CustomerMapper customerMapper;
    
    public Customer getByById(String customerId){
        // 1. 调用 Mapper 查数据库
        CustomerDO customerDO = customerMapper.getById(customerId);
        // 2. DO 转换为领域实体
        // Convert to Customer
        return null; // TODO: 补全转换逻辑
    }
}
```

**DO 和 Entity 的区别**：

```java
// DO：贴近数据库表结构
@Data
public class CustomerDO {
    private String customerId;
    private String memberId;
    private String globalId;
    private long registeredCapital;
    private String companyName;
}

// Entity：体现业务语义，包含业务行为
@Entity
@Data
public class Customer {
    // 同样的字段
    private String customerId;
    // ... 
    
    // 但还有业务行为
    public boolean isBigCompany() { ... }
    public void checkConflict() { ... }
}
```

**设计理念**：
- infrastructure 只负责实现细节，不决定业务逻辑
- DO 和 Entity 分离，避免数据结构和业务逻辑缠绑
- 网关实现是技术细节，可以替换（比如从 DB 换成缓存）
- 配置、日志等横切关注点也放在这一层

**当前状态**：
- ✅ 结构正确（有 Mapper、DO、GatewayImpl）
- ⚠️ 示例性质较重，部分 XML 配置与代码不同步
- ❌ DO → Entity 转换还未补完
- ❌ CreditGatewayImpl、OrderGatewayImpl 暂未实现

**一句话**：把技术框架和外部依赖隐藏在这一层，让上层专注业务。

---

### 6. start（启动装配层）

**位置**：`start/`

**核心职责**：
- Spring Boot 应用启动入口
- Bean 扫描和 Spring 容器装配
- 运行时配置加载
- 提供集成测试启动上下文
- 将前面五层的所有 Bean 整合在一起

**关键文件**：

| 文件 | 说明 |
|------|------|
| `src/main/java/com/alibaba/demo/Application.java` | 启动主类 |
| `src/main/resources/application.properties` | 运行时配置（数据库等） |
| `src/main/resources/logback-spring.xml` | 日志配置 |
| `src/test/java/com/alibaba/demo/test/CustomerServiceTest.java` | 集成测试示例 |
| `src/test/java/com/alibaba/demo/TestApplication.java` | 测试启动类 |

**示例代码解读**：

```java
@SpringBootApplication(scanBasePackages = {"com.alibaba.demo", "com.alibaba.cola"})
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

```properties
# 运行时环境配置
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.url=jdbc:mysql://localhost:3306/test
spring.datasource.username=root
spring.datasource.password=root
```

**集成测试**：

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class CustomerServiceTest {
    @Autowired
    private CustomerServiceI customerService;
    
    @Test
    public void testCustomerAddSuccess(){
        CustomerAddCmd cmd = new CustomerAddCmd();
        // ... 准备数据
        Response response = customerService.addCustomer(cmd);
        Assert.assertTrue(response.isSuccess());
    }
}
```

**设计理念**：
- 不应该在这里写业务逻辑
- 这里的职责就是"启动"和"装配"
- 集成测试依赖这一层的完整上下文

**当前状态**：
- ✅ 启动类标准规范
- ✅ 集成测试框架就绪

**一句话**：程序真正运行的地方，负责把所有组件拼装起来。

---

## 模块间的依赖关系

### POM 依赖图

```
start
  ├── adapter
  │     └── app
  │           ├── client
  │           └── infrastructure
  │                 └── domain
  │                       └── client
  ├── infrastructure
  └── MyBatis, Spring Boot, MySQL
```

### 关键依赖方向

| 上层 | 依赖 | 下层 | 说明 |
|------|------|------|------|
| adapter | → | client, app | 不应该直接调用 domain 或 infrastructure |
| app | → | client, domain, infrastructure | 应用层是编排中枢 |
| infrastructure | → | domain | 底层实现上层的抽象 |
| domain | → | client | 可复用 client 的 DTO（可选） |

---

## 典型调用链示例

以 `POST /customer` （新增客户）为例：

### Step 1: 请求进入适配层

```
HTTP POST /customer
    ↓
CustomerController.addCustomer(@RequestBody CustomerAddCmd)
    ↓
new CustomerAddCmd() // 已由 Spring 反序列化
```

### Step 2: 适配层调用应用服务

```
customerService.addCustomer(customerAddCmd)
    ↓
调用 client 层定义的 CustomerServiceI 接口
```

### Step 3: 请求进入应用层

```
CustomerServiceImpl.addCustomer(customerAddCmd)
    ↓
分发给 CustomerAddCmdExe.execute()
```

### Step 4: 执行器处理用例

```
CustomerAddCmdExe.execute(cmd) {
    // 当前实现：简单规则检查
    if (cmd.getCustomerDTO().getCompanyName().equals("ConflictCompanyName")) {
        throw new BizException(...)
    }
    return Response.buildSuccess()
}
```

### Step 5: 理想的 COLA 实现应该是

```
CustomerAddCmdExe.execute(cmd) {
    // 1. 组装领域对象
    Customer customer = new Customer();
    customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
    // ...
    
    // 2. 调用领域对象的业务规则
    customer.checkConflict();
    
    // 3. 通过网关持久化
    customerGateway.save(customer);
    
    // 4. 可能调用其他领域服务或网关
    Credit credit = creditGateway.getCredit(customerId);
    
    // 5. 返回应用级响应
    return Response.buildSuccess();
}
```

---

## 现状评估（贴合 COLA 的程度）

### ✅ 做得很好的地方

| 项 | 情况 |
|----|----|
| **模块分层** | 六层结构标准规范 |
| **接口分离** | client 层定义接口，app 层实现，很清晰 |
| **Command/Query 分离** | 已有 CmdExe、QryExe 区分 |
| **网关模式** | domain 定义网关接口，infrastructure 实现 |
| **领域实体** | Customer 已有业务行为（isBigCompany、checkConflict 等） |
| **依赖倒置** | 领域层不依赖技术框架 |
| **多端支持** | Mobile、WAP Adaptor 体现了共享能力的思路 |

### ⚠️ 可以改进的地方

| 项 | 现状 | 改进建议 |
|----|----|---------|
| **业务逻辑下沉** | app 层还在直接写冲突检查 | 应该由 app 调用 `customer.checkConflict()` |
| **DO → Entity 转换** | CustomerGatewayImpl 未完成转换 | 需要补完 DO → Entity 的转换逻辑 |
| **网关实现** | CreditGatewayImpl、OrderGatewayImpl 还是空 | 补充具体实现 |
| **MyBatis 配置** | customer-mapper.xml 与实际代码不一致 | 对齐 namespace、select id、resultType |
| **查询示例** | CustomerListByNameQryExe 返回硬编码数据 | 应该调用 Mapper 和网关 |
| **多端适配器** | Mobile、WAP Adaptor 还是空类 | 补充实现或删除示例占位 |

---

## 最后总结：每个模块用一句话说清楚

| 模块 | 一句话 |
|------|--------|
| **client** | **定义系统提供什么服务、参数和返回值。** |
| **adapter** | **接收外部请求，翻译成系统内部命令/查询。** |
| **app** | **编织一个业务用例从开始到结束要如何执行。** |
| **domain** | **承载核心业务概念、业务规则和业务行为。** |
| **infrastructure** | **实现技术细节，把领域抽象接上数据库/外部系统。** |
| **start** | **作为启动入口，负责装配和初始化整个应用。** |

---

## 快速开始

### 环境要求
- Java 8+
- Maven 3.6+
- MySQL 5.7+ (配置的数据库)

### 编译与运行
```bash
# 编译整个项目
mvn clean install

# 运行应用（需要先启动 MySQL）
mvn -pl start spring-boot:run

# 运行测试
mvn test
```

### 验证应用
```bash
# 测试 Hello 接口
curl http://localhost:8080/helloworld

# 添加客户（成功）
curl -X POST http://localhost:8080/customer \
  -H "Content-Type: application/json" \
  -d '{"customerDTO":{"companyName":"NormalCompany"}}'

# 添加客户（冲突）
curl -X POST http://localhost:8080/customer \
  -H "Content-Type: application/json" \
  -d '{"customerDTO":{"companyName":"ConflictCompanyName"}}'
```

---

## 相关资源

- **COLA 官方**：https://github.com/alibaba/COLA
- **DDD 参考**：《领域驱动设计》- Eric Evans
- **项目测试**：`start/src/test/java/com/alibaba/demo/test/CustomerServiceTest.java`

---

## 文档维护

本 README 基于代码现状编写，包含：
- ✅ 6 个模块的职责和代表文件
- ✅ COLA 架构的解释和映射
- ✅ 典型调用链的说明
- ✅ 当前项目的优势和改进建议
- ⚠️ 某些实现为示例骨架，非完整生产代码

如有改进，请及时更新本文档。


