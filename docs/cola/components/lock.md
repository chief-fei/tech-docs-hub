# cola-component-lock-starter 分布式锁组件

## 概述

`cola-component-lock-starter` 是 COLA 框架的分布式锁组件，提供了通过注解的方式轻松实现分布式锁功能，用于在分布式环境中保护共享资源。

**Maven Artifact**: `com.alibaba.cola:cola-component-lock-starter`

**前置条件**：需要有 Redis 或其他支持的分布式存储

## 核心注解

### @DistributedLock - 分布式锁注解

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedLock {
    
    /**
     * 锁的 key，支持 SpEL 表达式
     * 例如："customer:#{cmd.getCustomerId()}"
     * 例如："order:#{id}"
     */
    String lockKey();
    
    /**
     * 等待获取锁的时间（毫秒）
     * -1 表示永不超时（不推荐）
     * 0 表示不等待，获取不到直接失败
     * 默认为 3000ms
     */
    long waitTime() default 3000;
    
    /**
     * 锁过期时间（毫秒）
     * -1 表示永不过期（危险，可能导致死锁）
     * 0 表示使用默认值（通常是 10 秒）
     * 建议设置一个合理的值，稍大于业务耗时
     */
    long leaseTime() default -1;
    
    /**
     * 锁的超时时间单位
     * 默认为 TimeUnit.MILLISECONDS
     */
    TimeUnit timeUnit() default TimeUnit.MILLISECONDS;
}
```

**概念**：
- 分布式锁用于在多个进程/线程间保护共享资源
- 通过 lockKey 唯一标识被保护的资源
- waitTime 是等待获取锁的时间
- leaseTime 是获取后锁的过期时间

**使用场景**：
- 防止并发新增重复数据
- 保护库存数量确保不超售
- 防止重复支付
- 分布式计数器的原子更新
- 分布式 ID 生成器

## 基础使用示例

### 1. 防止公司名重复

```java
import com.alibaba.cola.lock.DistributedLock;
import org.springframework.stereotype.Component;

@Component
public class CustomerAddCmdExe {
    
    @Autowired
    private CustomerGateway customerGateway;
    
    /**
     * 防止同一公司名的并发新增
     * lockKey 使用公司名作为 key，确保不同公司可以并发添加
     */
    @DistributedLock(
        lockKey = "customer:company:#{cmd.getCustomerDTO().getCompanyName()}",
        waitTime = 3000,
        leaseTime = 5000
    )
    public Response execute(CustomerAddCmd cmd) {
        // 在这个方法执行期间，相同公司名的请求会被阻塞
        
        // 1. 再次检查是否已存在（double-check）
        Customer existing = customerGateway
            .getByCompanyName(cmd.getCustomerDTO().getCompanyName());
        
        if (existing != null) {
            throw new BizException("B_CUSTOMER_CONFLICT", "公司已存在");
        }
        
        // 2. 创建新客户
        Customer customer = new Customer();
        customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
        customer.setRegisteredCapital(cmd.getCustomerDTO().getRegisteredCapital());
        
        // 3. 保存
        customerGateway.save(customer);
        
        return Response.buildSuccess();
    }
}
```

### 2. 防止库存超售

```java
@Component
public class OrderCreateCmdExe {
    
    @Autowired
    private InventoryGateway inventoryGateway;
    
    /**
     * 防止库存超售
     * 使用商品ID作为锁的 key
     */
    @DistributedLock(
        lockKey = "inventory:product:#{cmd.getProductId()}",
        waitTime = 5000,
        leaseTime = 2000  // 业务耗时预计不超过 2 秒
    )
    public Response execute(OrderCreateCmd cmd) {
        
        // 1. 查询当前库存
        long currentInventory = inventoryGateway
            .getInventory(cmd.getProductId());
        
        // 2. 检查库存是否充足
        if (currentInventory < cmd.getQuantity()) {
            throw new BizException("B_STOCK_INSUFFICIENT", "库存不足");
        }
        
        // 3. 扣减库存
        inventoryGateway.decreaseInventory(
            cmd.getProductId(),
            cmd.getQuantity()
        );
        
        // 4. 创建订单
        Order order = new Order();
        order.setProductId(cmd.getProductId());
        order.setQuantity(cmd.getQuantity());
        
        return Response.buildSuccess();
    }
}
```

### 3. 防止重复支付

```java
@Component
public class PaymentProcessCmdExe {
    
    @Autowired
    private PaymentGateway paymentGateway;
    
    /**
     * 防止同一订单被重复支付
     * 使用订单ID和金额组合作为 key
     */
    @DistributedLock(
        lockKey = "payment:order:#{cmd.getOrderId()}:#{cmd.getAmount()}",
        waitTime = 10000,
        leaseTime = 10000  // 支付可能需要更长的时间
    )
    public Response execute(PaymentProcessCmd cmd) {
        
        // 1. 检查是否已经支付过
        Payment existingPayment = paymentGateway
            .getByOrderIdAndAmount(cmd.getOrderId(), cmd.getAmount());
        
        if (existingPayment != null) {
            // 已经支付过，返回原结果
            if (existingPayment.isSuccessful()) {
                return Response.buildSuccess();
            } else {
                throw new BizException("B_PAYMENT_FAILED", "上次支付失败，请重试");
            }
        }
        
        // 2. 调用第三方支付接口
        boolean paymentSuccess = paymentGateway.process(cmd);
        
        if (!paymentSuccess) {
            throw new BizException("B_PAYMENT_FAILED", "支付失败");
        }
        
        return Response.buildSuccess();
    }
}
```

## 高级使用示例

### 1. 使用 SpEL 表达式

```java
@DistributedLock(
    lockKey = "user:#{#cmd.userId}:#{#cmd.operation}",
    waitTime = 5000
)
public Response execute(UserOperationCmd cmd) {
    // lockKey 会被解析为：
    // "user:U001:update" （假设 userId=U001, operation=update）
    
    // 业务逻辑
    return Response.buildSuccess();
}
```

支持的 SpEL 变量：
- `#this` - 当前对象
- `#root` - 根对象
- `#param` - 方法参数的名称
- 方法参数直接通过名称或 `#` 前缀访问

### 2. 多层级锁（Lock Hierarchy）

```java
@Component
public class TransferCmdExe {
    
    @Autowired
    private AccountGateway accountGateway;
    
    /**
     * 转账操作，需要同时锁定两个账户
     * 为了防止死锁，应该按 ID 大小排序
     */
    @DistributedLock(
        lockKey = "account:#{T(java.util.Arrays).compare(
            #cmd.fromAccountId(), 
            #cmd.toAccountId()) < 0 
            ? (#cmd.fromAccountId() + ':' + #cmd.toAccountId()) 
            : (#cmd.toAccountId() + ':' + #cmd.fromAccountId())}",
        waitTime = 5000,
        leaseTime = 3000
    )
    public Response execute(TransferCmd cmd) {
        // 确保不同转账对都按相同顺序获取锁，避免死锁
        
        Account fromAccount = accountGateway.getById(cmd.getFromAccountId());
        Account toAccount = accountGateway.getById(cmd.getToAccountId());
        
        if (fromAccount.getBalance() < cmd.getAmount()) {
            throw new BizException("B_INSUFFICIENT_BALANCE", "余额不足");
        }
        
        fromAccount.debit(cmd.getAmount());
        toAccount.credit(cmd.getAmount());
        
        accountGateway.save(fromAccount);
        accountGateway.save(toAccount);
        
        return Response.buildSuccess();
    }
}
```

### 3. 条件式锁（Optional Lock）

```java
@Component
public class OrderProcessCmdExe {
    
    @Autowired
    private OrderGateway orderGateway;
    
    /**
     * 只有某些订单需要加锁（例如大订单）
     */
    public Response execute(OrderProcessCmd cmd) {
        Order order = orderGateway.getById(cmd.getOrderId());
        
        if (order.getAmount() > 10000) {
            // 大订单需要加锁处理
            return processWithLock(order);
        } else {
            // 小订单无需加锁
            return processWithoutLock(order);
        }
    }
    
    @DistributedLock(
        lockKey = "order:#{#order.id}",
        waitTime = 5000
    )
    private Response processWithLock(Order order) {
        // 处理大订单
        return Response.buildSuccess();
    }
    
    private Response processWithoutLock(Order order) {
        // 处理小订单
        return Response.buildSuccess();
    }
}
```

## POM 配置

### 基础配置（使用 Redis）

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-lock-starter</artifactId>
</dependency>

<!-- Redis 客户端（Lettuce） -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- 可选：使用 Jedis 代替 Lettuce -->
<!--
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
</dependency>
-->
```

### 配置文件（application.properties）

```properties
# Redis 连接信息
spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=
spring.redis.database=0
spring.redis.timeout=10000

# 连接池配置（Lettuce）
spring.redis.lettuce.pool.max-active=20
spring.redis.lettuce.pool.max-idle=10
spring.redis.lettuce.pool.min-idle=5

# 连接池配置（Jedis）
# spring.redis.jedis.pool.max-active=20
# spring.redis.jedis.pool.max-idle=10
```

或使用 YAML 格式：

```yaml
spring:
  redis:
    host: localhost
    port: 6379
    password: ~
    database: 0
    timeout: 10000ms
    lettuce:
      pool:
        max-active: 20
        max-idle: 10
        min-idle: 5
```

## 最佳实践

### 1. 锁的 key 要具有代表性

```java
// ✅ 好的做法：清晰的业务含义
@DistributedLock(lockKey = "customer:company:#{cmd.getCompanyName()}")

@DistributedLock(lockKey = "order:#{cmd.getOrderId()}")

@DistributedLock(lockKey = "inventory:product:#{cmd.getProductId()}")

// ❌ 不好的做法：模糊的 key
@DistributedLock(lockKey = "#cmd")  // 序列化 cmd 作为 key，不清晰

@DistributedLock(lockKey = "lock1")  // 所有请求都争夺同一把锁

@DistributedLock(lockKey = "#{System.currentTimeMillis()}")  // 每次都是不同的 key
```

### 2. 设置合理的超时时间

```java
// ✅ 好的做法：根据业务耗时设置
// 创建客户，预计耗时 1 秒
@DistributedLock(lockKey = "customer:#{id}", leaseTime = 3000)

// 支付处理，预计耗时 5 秒
@DistributedLock(lockKey = "payment:#{id}", leaseTime = 10000)

// 库存扣减，预计耗时 100ms
@DistributedLock(lockKey = "inventory:#{id}", leaseTime = 1000)

// ❌ 不好的做法：不合理的超时时间
@DistributedLock(lockKey = "lock", leaseTime = -1)  // 永远不过期，可能死锁

@DistributedLock(lockKey = "lock", leaseTime = 100)  // 太短，业务可能未完成就解锁
```

### 3. 合理的等待时间

```java
// ✅ 好的做法：不同场景的等待时间
// 用户操作，应该快速响应
@DistributedLock(lockKey = "user:#{id}", waitTime = 2000)

// 支付操作，可以等待更长
@DistributedLock(lockKey = "payment:#{id}", waitTime = 10000)

// 库存扣减，应该快速
@DistributedLock(lockKey = "inventory:#{id}", waitTime = 1000)

// ❌ 不好的做法：所有操作都用同样的等待时间
@DistributedLock(lockKey = "lock", waitTime = 5000)  // 统一，不合理
```

### 4. 异常处理

```java
@DistributedLock(lockKey = "order:#{cmd.id}")
public Response execute(OrderCreateCmd cmd) {
    try {
        // 业务逻辑
        return Response.buildSuccess();
    } catch (BizException e) {
        // 业务异常不需要特殊处理
        throw e;
    } catch (TimeoutException e) {
        // 获取锁超时
        log.warn("获取锁超时，订单 ID: {}", cmd.getId());
        throw new BizException("B_LOCK_TIMEOUT", "系统繁忙，请稍后重试");
    } catch (Exception e) {
        // 系统异常
        log.error("执行出错", e);
        throw new SysException("S_SYSTEM_ERROR", "系统内部错误", e);
    }
}
```

### 5. 避免死锁

**死锁场景**：A 等待 B 的锁，B 等待 A 的锁

```java
// ❌ 容易导致死锁的写法
@Component
public class ExecutorA {
    @DistributedLock(lockKey = "account:A")
    public void transferAToB() {
        // 先锁 A，后需要操作 B
        accountGateway.update("A");  // 在新线程中会尝试锁 B
        serviceB.transferB();  // 尝试锁账户 B
    }
}

@Component
public class ExecutorB {
    @DistributedLock(lockKey = "account:B")
    public void transferBToA() {
        // 先锁 B，后需要操作 A
        accountGateway.update("B");
        serviceA.transferA();  // 尝试锁账户 A，如果 A 已被其他线程锁定，就死锁了
    }
}

// ✅ 避免死锁的写法：确保所有地方都按相同顺序获取锁
@Component
public class ExecutorA {
    @DistributedLock(lockKey = "account:A:B")  // 按顺序 A, B
    public void transferAToB() {
        accountGateway.update("A");
        accountGateway.update("B");
    }
}

@Component
public class ExecutorB {
    @DistributedLock(lockKey = "account:A:B")  // 也是按顺序 A, B
    public void transferBToA() {
        accountGateway.update("B");
        accountGateway.update("A");
    }
}
```

## 分布式锁 vs 本地锁

| 特性 | 分布式锁 | 本地锁 (synchronized) |
|------|---------|-----------------|
| **跨进程** | 支持 | 不支持 |
| **分布式环境** | 支持 | 不支持 |
| **性能** | 低（网络开销） | 高 |
| **复杂度** | 中等 | 低 |
| **使用场景** | 分布式系统 | 单机应用 |
| **实现** | Redisson, Zookeeper | 内置 |

## 监控和故障排查

### 监控锁的使用

```java
@Component
public class LockMonitor {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public void monitorLocks() {
        // 扫描所有以 "lock:" 开头的 key
        Set<String> keys = redisTemplate.keys("lock:*");
        for (String key : keys) {
            Long ttl = redisTemplate.getExpire(key);
            if (ttl != null && ttl < 1000) {
                log.warn("锁 {} 即将过期，TTL: {}ms", key, ttl);
            }
        }
    }
}
```

### 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| TimeoutException | 等待时间不足 | 增加 waitTime |
| 锁未释放 | leaseTime 设置过长或异常未释放 | 减少 leaseTime，使用 try-finally |
| 死锁 | 多把锁获取顺序不一致 | 统一锁的获取顺序 |
| Redis 连接失败 | 网络问题或 Redis 宕机 | 检查 Redis 连接和健康 |

## POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-lock-starter</artifactId>
</dependency>
```

> **注意**：COLA 5.0.0 要求 JDK 17+，仅支持 Spring Boot 3.x。如需 Spring Boot 2.7.x 支持，请使用 COLA 4.x 版本。

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

## 常见问题

**Q: 能否在没有 Redis 的情况下使用分布式锁？**
A: 不能。分布式锁必须依赖 Redis 或类似的中间件。单机应用可以使用 synchronized。

**Q: lockKey 能否使用非字符串类型？**
A: 不推荐。lockKey 最终会转成字符串存储在 Redis，直接使用字符串或 SpEL 表达式更清晰。

**Q: leaseTime = -1 表示永不过期，这安全吗？**
A: 不安全。永不过期可能导致死锁。应该设置一个合理的值。

**Q: 是否支持尝试一次就失败（不等待）？**
A: 支持，设置 `waitTime = 0` 即可。

**Q: 如何调试分布式锁问题？**
A: 连接 Redis 查看实时的 key，使用 `redis-cli KEYS "lock:*"` 查看所有锁。

## 参考

- COLA 官方项目：https://github.com/alibaba/COLA
- Redisson 用户指南：https://github.com/redisson/redisson/wiki
- 分布式锁最佳实践：https://redis.io/topics/patterns-distributed-locks


