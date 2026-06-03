# COLA 架构详解

## 整体架构视图

COLA 标准分层架构，从上到下的调用流程：

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

**核心职责**：定义对外暴露的服务接口、Command/Query 对象、DTO 和错误码，充当系统边界的通信协议。

**关键文件**：

| 文件 | 说明 |
|------|------|
| `api/CustomerServiceI.java` | 服务接口定义 |
| `dto/CustomerAddCmd.java` | 新增客户命令对象 |
| `dto/CustomerListByNameQry.java` | 按名称查询客户查询对象 |
| `dto/data/CustomerDTO.java` | 客户数据传输对象 |
| `dto/data/ErrorCode.java` | 错误码枚举 |
| `dto/event/DomainEventConstant.java` | 领域事件常量 |

**一句话**：系统对外的"承诺"或"契约"。

---

### 2. demo-web-adapter（适配层）

**核心职责**：接收外部请求（HTTP/RPC/MQ），将协议和格式适配转换为 Command/Query 对象，调用 client 层接口并返回响应。

**关键文件**：

| 文件 | 说明 |
|------|------|
| `web/CustomerController.java` | Web 接口入口，HTTP 协议适配 |
| `mobile/CustomerMobileAdaptor.java` | 移动端适配器（示例占位） |
| `wap/CustomerWapAdaptor.java` | WAP 端适配器（示例占位） |

**一句话**：把外部请求"翻译"成系统可理解的内部消息。

---

### 3. demo-web-app（应用层）

**核心职责**：实现 client 层接口，编排业务用例执行流程，控制事务、日志、校验、异常处理等应用级横切关注点，区分 Command 和 Query 处理。

**关键文件**：

| 文件 | 说明 |
|------|------|
| `customer/CustomerServiceImpl.java` | 应用服务门面，实现 CustomerServiceI |
| `customer/executor/CustomerAddCmdExe.java` | 新增客户用例执行器 |
| `customer/executor/query/CustomerListByNameQryExe.java` | 查询客户用例执行器 |
| `order/OrderServiceImpl.java` | 订单应用服务（示例占位） |

**一句话**：定义"这个业务用例怎样一步步走下去"。

---

### 4. demo-web-domain（领域层）

**核心职责**：承载系统最核心、最稳定的业务知识。定义领域实体（Entity）、值对象、枚举、领域服务、网关接口（抽象），实现核心业务规则和行为。

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

**一句话**：承载系统最有价值的业务知识，是稳定的、复用的核心资产。

---

### 5. demo-web-infrastructure（基础设施层）

**核心职责**：实现 domain 层定义的网关接口，处理数据库访问（MyBatis）、外部系统调用、配置、日志等技术细节，定义 DO（Data Object）对象。

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

**一句话**：把技术框架和外部依赖隐藏在这一层，让上层专注业务。

---

### 6. start（启动装配层）

**核心职责**：Spring Boot 应用启动入口，负责 Bean 扫描和 Spring 容器装配，加载运行时配置，提供集成测试上下文。

**关键文件**：

| 文件 | 说明 |
|------|------|
| `src/main/java/com/alibaba/demo/Application.java` | 启动主类 |
| `src/main/resources/application.properties` | 运行时配置（数据库等） |
| `src/main/resources/logback-spring.xml` | 日志配置 |
| `src/test/java/com/alibaba/demo/test/CustomerServiceTest.java` | 集成测试示例 |
| `src/test/java/com/alibaba/demo/TestApplication.java` | 测试启动类 |

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

以 `POST /customer`（新增客户）为例：

```text
HTTP POST /customer
    ↓
[adapter] CustomerController.addCustomer(@RequestBody CustomerAddCmd)
    ↓  将 HTTP 参数反序列化为 Command，调用 client 层接口
[app] CustomerServiceImpl.addCustomer(customerAddCmd)
    ↓  分发给执行器
[app] CustomerAddCmdExe.execute(cmd)
    ↓  组装领域对象 → 调用领域规则 → 通过网关持久化
[domain] customer.checkConflict()
    ↓
[infrastructure] customerGateway.save(customer) → CustomerMapper → DB
    ↓
[app] Response.buildSuccess()
    ↓
[adapter] 返回 HTTP 200 响应
```

::: tip 要点
- adapter 只做协议转换，不写业务逻辑
- app 调用 domain 完成业务规则，而非自己实现
- domain 定义网关接口，infrastructure 负责落地
- 每层只依赖下层抽象，不跨层直接调用
:::
