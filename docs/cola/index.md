# COLA 组件使用文档完整索引

本文档汇总了所有 COLA 5.0.0 组件的详细使用指南，方便快速查找。

> **版本兼容说明**：本文档基于 COLA 5.0.0 + Spring Boot 3.x 编写。COLA 5.0.0 要求 **JDK 17+**，仅支持 **Spring Boot 3.x**（使用 `jakarta.*` 命名空间）。如需在 Spring Boot 2.7.x（JDK 8）环境下使用，请选择 COLA 4.x 版本。相关 Spring Boot 文档请参考 [Spring Boot 2.7.x 文档](../spring-boot/index.md)。

## 📚 目录

### 1. 总体指南

| 文档 | 描述 | 用途 |
|------|------|------|
| [./components/index.md](./components/index.md) | COLA 5.0.0 全组件使用指南 | 了解所有组件的整体概述和整合方式 |

### 2. 按组件分类的详细文档

#### 📦 **核心数据传输组件**

| 组件 | 文件 | 主要内容 | 何时使用 |
|------|------|--------|---------|
| `cola-component-dto` | [./components/dto.md](././components/dto.md) | Command, Query, Response 等 DTO 定义和使用 | 定义 API 契约, 传输数据, 包装响应 |

**核心类**：Command, Query, Response, SingleResponse, MultiResponse, PageResponse

**典型使用**：
```java
@PostMapping("/customer")
public Response addCustomer(@RequestBody CustomerAddCmd cmd) {
    return customerService.addCustomer(cmd);
}
```

---

#### 🏗️ **领域建模组件**

| 组件 | 文件 | 主要内容 | 何时使用 |
|------|------|--------|---------|
| `cola-component-domain-starter` | [./components/domain.md](././components/domain.md) | @Entity, @ValueObject, @Repository 注解详解 | 定义领域模型, 实现业务规则, DDD 实施 |

**核心注解**：@Entity, @ValueObject, @Repository

**典型使用**：
```java
@Entity
@Data
public class Customer {
    public boolean isBigCompany() { return registeredCapital > 1000万; }
    public void checkConflict() { /* 业务规则 */ }
}

@ValueObject
@Value
public class Address {
    private String province;
    private String city;
}
```

---

#### ⚠️ **异常处理组件**

| 组件 | 文件 | 主要内容 | 何时使用 |
|------|------|--------|---------|
| `cola-component-exception` | [./components/exception.md](././components/exception.md) | BizException, SysException 定义和使用 | 抛出业务异常, 抛出系统异常, 异常分类处理 |

**核心类**：BizException, SysException

**典型使用**：
```java
if (existingCustomer != null) {
    throw new BizException("B_CONFLICT", "公司名已存在");
}
```

---

#### 📊 **日志切面组件**

| 组件 | 文件 | 主要内容 | 何时使用 |
|------|------|--------|---------|
| `cola-component-catchlog-starter` | [./components/catchlog.md](././components/catchlog.md) | @CatchAndLog 注解使用和日志配置 | 自动记录方法日志, 记录入参和返回值, 配置日志级别 |

**核心注解**：@CatchAndLog

**典型使用**：
```java
@Service
@CatchAndLog
public class CustomerServiceImpl {
    // 自动记录所有方法的入参、返回值、异常
}
```

---

#### 🔌 **扩展点组件**

| 组件 | 文件 | 主要内容 | 何时使用 |
|------|------|--------|---------|
| `cola-component-extension` | [./components/extension.md](././components/extension.md) | @Extension, @ExtensionExecutor 注解详解 | 定义扩展点, 提供多个实现, 支持插件式开发 |

**核心注解**：@Extension, @ExtensionExecutor

**典型使用**：
```java
@Extension(bizCode = "customer", useCase = "add")
public class CustomerValidatingImpl implements CustomerValidatingExtPt {
    public void validate(CustomerAddCmd cmd) { /* 验证逻辑 */ }
}
```

---

#### 🔒 **分布式锁组件**

| 组件 | 文件 | 主要内容 | 何时使用 |
|------|------|--------|---------|
| `cola-component-lock-starter` | [./components/lock.md](././components/lock.md) | @DistributedLock 注解详解 | 防止并发冲突, 保护共享资源, 分布式环境同步 |

**核心注解**：@DistributedLock

**典型使用**：
```java
@DistributedLock(
    lockKey = "customer:#{cmd.getCompanyName()}",
    waitTime = 3000,
    leaseTime = 5000
)
public Response execute(CustomerAddCmd cmd) {
    // 同一公司名的并发请求被锁定
}
```

---

## 🎯 快速选择指南

### 根据场景选择组件

#### 场景 1: 新增客户（创建操作）

```
✅ cola-component-dto
   ├─ CustomerAddCmd (输入)
   └─ Response (输出)

✅ cola-component-exception
   └─ BizException (冲突时抛出)

✅ cola-component-catchlog-starter
   └─ @CatchAndLog (记录执行过程)

✅ cola-component-domain-starter
   └─ Customer.checkConflict() (业务规则)

✅ cola-component-lock-starter (可选)
   └─ @DistributedLock (防止并发)
```

#### 场景 2: 查询列表（查询操作）

```
✅ cola-component-dto
   ├─ CustomerListByNameQry (查询条件)
   └─ MultiResponse<CustomerDTO> (返回列表)

✅ cola-component-catchlog-starter
   └─ @CatchAndLog (记录执行)
```

#### 场景 3: 复杂的业务规则（业务逻辑）

```
✅ cola-component-domain-starter
   └─ Customer 实体及其业务方法

✅ cola-component-extension
   └─ CustomerValidatingExtPt (扩展验证)

✅ cola-component-exception
   └─ BizException (业务异常)
```

---

## 📖 分阶段学习路线

### 初级（基础使用）

1. **第一步**：读 [./components/index.md](./components/index.md)
   - 了解 COLA 的整体架构
   - 理解 6 个组件的定位

2. **第二步**：学 [./components/dto.md](././components/dto.md)
   - 理解 Command/Query/Response
   - 定义第一个 DTO

3. **第三步**：学 [./components/exception.md](././components/exception.md)
   - 理解业务异常和系统异常的区分
   - 在代码中开始使用 BizException/SysException

### 中级（最佳实践）

4. **第四步**：学 [./components/catchlog.md](././components/catchlog.md)
   - 在 Service 上加 @CatchAndLog
   - 配置日志输出

5. **第五步**：学领域驱动设计
   - 将业务规则下沉到领域层
   - 使用 @Entity 和业务方法

6. **第六步**：学扩展点设计
   - 如何使用 @Extension 进行插件式扩展
   - 在不修改核心代码的情况下扩展功能

### 高级（高可用性）

7. **第七步**：学分布式锁
   - 使用 @DistributedLock 防止并发问题
   - 理解锁的粒度和超时设置

---

## 🔍 按需查找

### 我要上手一个新项目

```
建议阅读顺序：
1️⃣ ./components/index.md（5 分钟）
   → 了解全局架构

2️⃣ ./components/dto.md（10 分钟）
   → 从 Controller 开始定义 API

3️⃣ ./components/exception.md（8 分钟）
   → 建立异常处理机制

4️⃣ [demo-web README.md](../README.md)（15 分钟）
   → 查看实际项目示例

5️⃣ 开始编写代码！
```

### 我要处理某个具体问题

| 问题 | 查看文档 |
|------|---------|
| 如何定义 API 的输入和输出？ | [./components/dto.md](././components/dto.md) |
| 如何处理业务异常？ | [./components/exception.md](././components/exception.md) |
| 如何添加日志记录？ | [./components/catchlog.md](././components/catchlog.md) |
| 如何实现业务规则？ | [./components/domain.md](././components/domain.md) |
| 如何支持不同的业务模式？ | [./components/extension.md](././components/extension.md) |
| 如何防止并发冲突？ | [./components/lock.md](././components/lock.md) |

---

## 🛠️ POM 配置模板

### 最小化配置（只用 DTO 和异常处理）

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
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-exception</artifactId>
    </dependency>
</dependencies>
```

### 完整配置（推荐）

```xml
<dependencies>
    <!-- DTO 和响应 -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-dto</artifactId>
    </dependency>
    
    <!-- 异常处理 -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-exception</artifactId>
    </dependency>
    
    <!-- 领域建模 -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-domain-starter</artifactId>
    </dependency>
    
    <!-- 日志切面 -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-catchlog-starter</artifactId>
    </dependency>
    
    <!-- 扩展点（可选） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-extension</artifactId>
    </dependency>
    
    <!-- 分布式锁（可选） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-lock-starter</artifactId>
    </dependency>
</dependencies>
```

---

## 📚 相关资源

### 官方资源

| 资源 | 链接 |
|------|------|
| COLA 官方项目 | https://github.com/alibaba/COLA |
| COLA GitHub Releases | https://github.com/alibaba/COLA/releases |
| COLA 官方文档 | 在 GitHub 项目的 wiki 或 docs 目录 |

### 扩展阅读

| 话题 | 推荐阅读 |
|------|---------|
| DDD (领域驱动设计) | 《领域驱动设计》- Eric Evans |
| CQRS (命令查询职责分离) | https://martinfowler.com/bliki/CQRS.html |
| 微服务架构 | https://martinfowler.com/microservices/ |
| 日志最佳实践 | 《Java Logging Best Practices》 |
