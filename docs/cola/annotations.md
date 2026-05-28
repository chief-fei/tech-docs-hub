# COLA 注解完全手册

本手册汇总了所有 COLA 框架提供的注解，便于快速查找和使用。

## 📋 所有注解速查表

| 注解 | 组件 | 用途 | 作用范围 | 文档 |
|------|------|------|---------|------|
| **@Entity** | domain-starter | 标记领域实体 | 类 | [./components/domain.md](./components/domain.md) |
| **@ValueObject** | domain-starter | 标记值对象 | 类 | [./components/domain.md](./components/domain.md) |
| **@Repository** | domain-starter | 标记仓储接口 | 接口 | [./components/domain.md](./components/domain.md) |
| **@CatchAndLog** | catchlog-starter | 自动记录方法日志 | 类/方法 | [docs/./components/catchlog.md](./components/catchlog.md) |
| **@Extension** | extension | 标记扩展点实现 | 类 | [docs/./components/extension.md](./components/extension.md) |
| **@ExtensionExecutor** | extension | 标记扩展点执行器 | 类 | [docs/./components/extension.md](./components/extension.md) |
| **@DistributedLock** | lock-starter | 分布式锁保护 | 方法 | [docs/./components/lock.md](./components/lock.md) |

## 分类速查

### 🏗️ 领域建模注解

#### @Entity - 实体注解

**功能**：标记一个类为领域实体

**用法**：
```java
@Entity
@Data
public class Customer {
    private String customerId;
    private String companyName;
    
    // 业务行为
    public void checkConflict() { }
    public boolean isBigCompany() { return true; }
}
```

**属性**：无

**详细文档**：[./components/domain.md](./components/domain.md#1-entity-实体注解)

---

#### @ValueObject - 值对象注解

**功能**：标记一个类为值对象（不可变）

**用法**：
```java
@ValueObject
@Value
public class Address {
    private final String city;
    private final String detail;
}
```

**属性**：无

**详细文档**：[./components/domain.md](./components/domain.md#2-valueobject-值对象注解)

---

#### @Repository - 仓储注解

**功能**：标记一个接口为仓储接口

**用法**：
```java
@Repository
public interface CustomerRepository {
    Customer getById(String id);
    void save(Customer customer);
}
```

**属性**：无

**详细文档**：[./components/domain.md](./components/domain.md#3-repository-仓储接口注解)

---

### 📊 功能性注解

#### @CatchAndLog - 日志注解

**功能**：自动记录方法的入参、返回值和异常

**用法**：
```java
@Service
@CatchAndLog  // 记录所有 public 方法
public class CustomerServiceImpl {
    
    @CatchAndLog  // 可选：只记录该方法
    public Response addCustomer(CustomerAddCmd cmd) {
        // 自动记录日志
    }
}
```

**属性**：
- 无属性，只有两种作用范围：
  - 在类上使用：记录该类的所有 public 方法
  - 在方法上使用：仅记录该方法

**日志输出**：
```text
[方法名] 开始执行
入参: {...}

[方法名] 成功
返回值: {...}
耗时: 123 ms
```

**详细文档**：[docs/./components/catchlog.md](./components/catchlog.md)

---

#### @Extension - 扩展点实现注解

**功能**：标记一个类为某个扩展点的实现

**用法**：
```java
@Component
@Extension(bizCode = "customer", useCase = "add")
public class CustomerValidatingImpl implements CustomerValidatingExtPt {
    @Override
    public void validate(CustomerAddCmd cmd) {
        // 验证逻辑
    }
}
```

**属性**：
- `bizCode` (必须)：业务代码，如 "customer", "order"
- `useCase` (必须)：使用场景，如 "add", "update"
- `order` (可选)：执行顺序，默认 0，数字越小优先级越高

**用意**：
- 不同 bizCode 的实现独立存在
- 同一接口可有多个 bizCode 的实现
- order 属性控制执行顺序

**详细文档**：[docs/./components/extension.md](./components/extension.md#1-extension-扩展点实现注解)

---

#### @ExtensionExecutor - 扩展点执行器注解

**功能**：标记一个类为扩展点执行器（可选标签）

**用法**：
```java
@Component
@ExtensionExecutor
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerValidatingExtPt validatingExtPt;  // @Extension 的实现
    
    public Response execute(CustomerAddCmd cmd) {
        validatingExtPt.validate(cmd);  // 调用扩展点
        // 业务逻辑
    }
}
```

**属性**：无

**用意**：主要用于标记和文档，让人一眼看出该类会调用扩展点

**详细文档**：[docs/./components/extension.md](./components/extension.md#2-extensionexecutor-扩展点执行器注解可选)

---

#### @DistributedLock - 分布式锁注解

**功能**：在方法执行期间获取分布式锁，防止并发冲突

**用法**：
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

**属性**：
- `lockKey` (必须)：锁的 key，支持 SpEL 表达式
  - 例如：`"customer:#{id}"`
  - 例如：`"order:#{cmd.getOrderId()}"`
- `waitTime` (可选)：等待获取锁的时间（毫秒），默认 3000
  - 0 = 不等待，获取不到直接失败
  - -1 = 永远等待（不推荐）
- `leaseTime` (可选)：锁过期时间（毫秒），默认 -1
  - 应设置为略大于业务耗时
  - -1 = 永不过期（危险）

**用意**：
- 防止公司名重复
- 防止库存超售
- 防止重复支付
- 分布式计数器原子操作

**最佳实践**：
- waitTime：用户级操作 2000ms，支付级 10000ms
- leaseTime：预计耗时 + 1 秒作为缓冲

**详细文档**：[docs/./components/lock.md](./components/lock.md)

---

## 💡 常见组合使用

### 场景 1：简单的创建操作

```java
@Service
@CatchAndLog
public class CustomerServiceImpl {
    
    @Resource
    private CustomerAddCmdExe customerAddCmdExe;
    
    public Response addCustomer(CustomerAddCmd cmd) {
        return customerAddCmdExe.execute(cmd);
    }
}

@Component
@ExtensionExecutor
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerValidatingExtPt validatingExtPt;  // @Extension 实现
    
    @DistributedLock(lockKey = "customer:#{cmd.getCompanyName()}")
    public Response execute(CustomerAddCmd cmd) {
        // 1. 验证（扩展点）
        validatingExtPt.validate(cmd);
        
        // 2. 创建实体（@Entity）
        Customer customer = new Customer();
        customer.setCompanyName(cmd.getCompanyName());
        
        // 3. 业务规则检查
        customer.checkConflict();  // @Entity 的方法
        
        // 4. 保存
        return Response.buildSuccess();
    }
}
```

### 场景 2：复杂的库存操作

```java
@Component
public class OrderCreateCmdExe {
    
    @Autowired
    private InventoryRepository inventoryRepo;  // @Repository 实现
    
    @DistributedLock(
        lockKey = "inventory:#{cmd.getProductId()}",
        waitTime = 5000,
        leaseTime = 2000
    )
    public Response execute(OrderCreateCmd cmd) {
        // 在锁的保护下，查询和扣减库存是原子操作
        Inventory inv = inventoryRepo.getById(cmd.getProductId());
        
        if (inv.getStock() < cmd.getQuantity()) {
            throw new BizException("B_STOCK_INSUFFICIENT", "库存不足");
        }
        
        inv.decrease(cmd.getQuantity());  // @Entity 的方法
        inventoryRepo.save(inv);
        
        return Response.buildSuccess();
    }
}
```

### 场景 3：多业务线的验证

```java
// 定义扩展点接口
public interface OrderValidatingExtPt {
    void validate(Order order);
}

// B2B 客户的实现
@Component
@Extension(bizCode = "orderB2B", useCase = "create")
public class B2bOrderValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        if (order.getAmount() < 10000) {
            throw new BizException("B_INVALID_AMOUNT", "B2B 最小订单 10000");
        }
    }
}

// B2C 客户的实现
@Component
@Extension(bizCode = "orderB2C", useCase = "create")
public class B2cOrderValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        if (order.getAmount() <= 0) {
            throw new BizException("B_INVALID_AMOUNT", "订单金额需大于 0");
        }
    }
}

// 执行器中使用
@Component
@ExtensionExecutor
public class OrderCreateCmdExe {
    
    @Autowired
    private OrderValidatingExtPt validatingExtPt;  // 自动选择对应实现
    
    public Response execute(OrderCreateCmd cmd) {
        validatingExtPt.validate(cmd.getOrder());
        // ...
    }
}
```

## 🎯 按场景选择注解

| 需求 | 对应注解 |
|------|---------|
| 定义实体和业务规则 | @Entity |
| 定义不可变的值 | @ValueObject |
| 定义数据访问接口 | @Repository |
| 自动记录日志 | @CatchAndLog |
| 支持多个业务实现 | @Extension + @ExtensionExecutor |
| 防止并发冲突 | @DistributedLock |

## 📚 对应详细文档

| 注解 | 文档位置 | 学习重点 |
|------|---------|---------|
| @Entity | [./components/domain.md](./components/domain.md) | 实体不是贫血对象，应包含业务行为 |
| @ValueObject | [./components/domain.md](./components/domain.md) | 值对象不可变，没有身份 |
| @Repository | [./components/domain.md](./components/domain.md) | 仓储隐藏数据访问细节 |
| @CatchAndLog | [docs/./components/catchlog.md](./components/catchlog.md) | 在类和方法级别都可用 |
| @Extension | [docs/./components/extension.md](./components/extension.md) | 支持多实现，order 控制顺序 |
| @ExtensionExecutor | [docs/./components/extension.md](./components/extension.md) | 可选标签，用于代码可读性 |
| @DistributedLock | [docs/./components/lock.md](./components/lock.md) | SpEL 表达式，合理设置超时 |

## ⚠️ 常见错误

**错误 1：用了 @Entity 但没有业务方法**
```java
// ❌ 错误
@Entity
@Data
public class Order {
    private String id;
    private BigDecimal amount;
    // 只有 getter/setter，没有业务方法
}

// ✅ 正确
@Entity
@Data
public class Order {
    public void checkAmount() {
        if (amount <= 0) throw new BizException(...);
    }
    
    public void ship() {
        // 发货逻辑
    }
}
```

**错误 2：@CatchAndLog 在所有地方都用**
```java
// ❌ 不推荐
@CatchAndLog
public class OrderDAO {
    @CatchAndLog
    public Order getById(String id) { }
}

// ✅ 推荐用在应用层
@Service
@CatchAndLog
public class OrderServiceImpl { }
```

**错误 3：@DistributedLock 的 key 重复**
```java
// ❌ 所有订单都争夺同一把锁
@DistributedLock(lockKey = "order")

// ✅ 不同订单用不同的锁
@DistributedLock(lockKey = "order:#{cmd.getOrderId()}")
```

## 📖 进一步学习

1. **读完本手册后**，可以查看具体的组件文档深入理解
2. **实践为主**，在项目中使用这些注解
3. **遇到问题时**，查阅对应的详细文档和最佳实践

---

**最后更新**：2024年4月


