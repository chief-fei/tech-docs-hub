# 事务管理

Spring Boot 通过 AOP 机制提供声明式事务管理，使用 `@Transactional` 注解即可自动管理事务的开启、提交和回滚。

> Spring Boot 2.7.x 中事务代理默认使用 **CGLIB**（`spring.aop.proxy-target-class=true` 默认匹配），自动配置类只有在存在 `TransactionManager` Bean 时才会启用事务管理。

## 一、依赖

```xml
<!-- JDBC 场景会自动引入 spring-boot-starter-jdbc，内置事务支持 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>

<!-- JPA 或 MyBatis 场景 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

> 无需额外依赖，只要 classpath 中存在 `spring-tx` 且存在 `PlatformTransactionManager` Bean，`@Transactional` 即可使用。

## 二、@Transactional 详解

### 2.1 完整参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `propagation` | `Propagation` | `REQUIRED` | 事务传播行为 |
| `isolation` | `Isolation` | `DEFAULT` | 事务隔离级别 |
| `timeout` | `int` | `-1`（永不超时） | 事务超时时间（秒） |
| `readOnly` | `boolean` | `false` | 是否只读事务 |
| `rollbackFor` | `Class<?>[]` | `{}` | 触发回滚的异常类型 |
| `noRollbackFor` | `Class<?>[]` | `{}` | 不触发回滚的异常类型 |
| `rollbackForClassName` | `String[]` | `{}` | 触发回滚的异常类名（字符串） |
| `noRollbackForClassName` | `String[]` | `{}` | 不触发回滚的异常类名（字符串） |
| `transactionManager` | `String` | `""` | 指定事务管理器（多数据源时使用） |
| `label` | `String[]` | `{}` | 事务标签 |

### 2.2 使用示例

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(Order order) {
        // 操作1: 写订单表
        orderMapper.insert(order);
        // 操作2: 扣减库存
        inventoryService.deduct(order.getProductId(), order.getQuantity());
        // 任何 RuntimeException 都会触发回滚
    }

    @Transactional(rollbackFor = Exception.class)  // 受检异常也回滚
    public void importData(InputStream input) throws Exception {
        // 业务逻辑
    }

    @Transactional(readOnly = true)  // 只读事务，性能更高
    public List<Order> listOrders(Long userId) {
        return orderMapper.selectByUserId(userId);
    }

    @Transactional(timeout = 30)  // 30秒超时自动回滚
    public void batchProcess() {
        // 耗时操作
    }
}
```

### 2.3 默认回滚规则

| 异常类型 | 是否回滚 |
|---------|---------|
| `RuntimeException` 及其子类 | ✅ 回滚 |
| `Error` 及其子类 | ✅ 回滚 |
| `Exception`（受检异常，非 RuntimeException） | ❌ 不回滚 |

> 需要受检异常也回滚时：`@Transactional(rollbackFor = Exception.class)`

## 三、事务传播行为

| 传播行为 | 说明 |
|---------|------|
| `REQUIRED`（默认） | 存在事务则加入，不存在则新建 |
| `REQUIRES_NEW` | 总是新建事务，挂起当前事务 |
| `SUPPORTS` | 存在事务则加入，不存在则以非事务方式运行 |
| `NOT_SUPPORTED` | 以非事务方式运行，存在事务则挂起 |
| `MANDATORY` | 必须存在事务，否则抛异常 |
| `NEVER` | 必须以非事务方式运行，存在事务则抛异常 |
| `NESTED` | 存在事务则嵌套（savepoint），不存在则新建 |

### 传播行为场景示例

```java
@Service
public class OuterService {

    @Transactional(propagation = Propagation.REQUIRED)
    public void outerMethod() {
        // 外层事务 A
        innerService.innerMethod();  // 加入事务 A（REQUIRED）
        innerService.newMethod();    // 新建事务 B，挂起 A（REQUIRES_NEW）
    }
}
```

### 典型场景选择

| 场景 | 传播行为 |
|------|---------|
| 必须全部成功或全部回滚 | `REQUIRED`（默认） |
| 日志录入不受主事务影响 | `REQUIRES_NEW` |
| 某个操作即使失败也不影响主事务 | `REQUIRES_NEW` |
| 只读查询 | `SUPPORTS` |

## 四、事务隔离级别

| 隔离级别 | 说明 | 脏读 | 不可重复读 | 幻读 |
|---------|------|------|----------|------|
| `DEFAULT` | 使用数据库默认级别 | — | — | — |
| `READ_UNCOMMITTED` | 读未提交 | ❌ | ❌ | ❌ |
| `READ_COMMITTED` | 读已提交 | ✅ | ❌ | ❌ |
| `REPEATABLE_READ` | 可重复读（MySQL 默认） | ✅ | ✅ | ❌ |
| `SERIALIZABLE` | 串行化（最高级别） | ✅ | ✅ | ✅ |

```java
@Transactional(isolation = Isolation.REPEATABLE_READ)
public void transfer(Long fromId, Long toId, BigDecimal amount) {
    // 转账操作
}
```

## 五、@Transactional 失效场景

以下情况事务不会生效：

### 1. 同类内部方法调用

```java
@Service
public class UserService {

    // ❌ 事务失效！
    public void methodA() {
        this.methodB();  // this 调用绕过了 AOP 代理
    }

    @Transactional
    public void methodB() { ... }
}
```

**解决方案**：注入自身或抽离到另一个 Service

```java
@Service
public class UserService {

    private final UserService self;  // 注入自身

    public void methodA() {
        self.methodB();  // ✅ 通过代理调用
    }

    @Transactional
    public void methodB() { ... }
}
```

### 2. 方法非 public

```java
// ❌ 事务失效：CGLIB 代理只能拦截 public 方法
@Transactional
private void doSomething() { ... }
```

### 3. 异常被捕获

```java
@Transactional
public void save() {
    try {
        jdbcTemplate.update("INSERT ...");
        int i = 1 / 0; // ArithmeticException
    } catch (Exception e) {
        // ❌ 事务未回滚！异常被吞掉了
        log.error("保存失败", e);
    }
}
```

**解决方案**：在 catch 中手动回滚或重新抛出

```java
@Transactional
public void save() {
    try {
        jdbcTemplate.update("INSERT ...");
        int i = 1 / 0;
    } catch (Exception e) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        throw new BusinessException("保存失败", e);  // 或重新抛出
    }
}
```

### 4. 数据库引擎不支持

MySQL 的 MyISAM 引擎不支持事务，必须使用 **InnoDB**。

### 5. 多线程环境

```java
@Transactional
public void batchProcess() {
    // ❌ 新线程中的操作不在当前事务中
    new Thread(() -> {
        userMapper.insert(user);  // 不在事务中，不会回滚
    }).start();
}
```

**原因：** Spring 事务通过 `ThreadLocal` 绑定数据库连接，事务信息只存在于当前线程中。新线程无法获取当前事务。

### 6. @Transactional 方法被同一个类中的非事务方法调用

```java
@Service
public class UserService {

    // ❌ 事务失效！
    public void outerMethod() {
        // 通过 this 直接调用，绕过了代理
        this.innerMethod();
    }

    @Transactional
    public void innerMethod() {
        // 这里的 @Transactional 不会生效
    }
}
```

**原因：** Spring AOP 代理只能拦截从外部进入代理对象的方法调用。类内部通过 `this` 调用时，直接调用的是目标对象的方法，不会经过代理。

> 解决方法与"同类内部方法调用"一致：注入自身或抽离到另一个 Service。

### 7. 默认回滚策略：只回滚 RuntimeException 和 Error

Spring 默认只对 `RuntimeException` 和 `Error` 进行回滚，**受检异常（Checked Exception）不会触发回滚**：

```java
@Transactional
public void importData() throws IOException {
    fileMapper.insert(record);
    // ❌ 抛出 IOException（受检异常），事务不会回滚！
    throw new IOException("文件读取失败");
}
```

**解决方案：**

```java
// 方案一：指定 rollbackFor
@Transactional(rollbackFor = Exception.class)
public void importData() throws IOException {
    // ✅ 任何 Exception 都会回滚
}

// 方案二：将受检异常包装为 RuntimeException
@Transactional
public void importData() {
    try {
        // ...
    } catch (IOException e) {
        throw new RuntimeException("导入失败", e);  // ✅ 触发回滚
    }
}
```

### 失效场景速查

| 场景 | 原因 | 解决方案 |
|------|------|---------|
| 同类方法调用 | 绕过了 AOP 代理 | 注入自身 / 抽离 Service |
| 方法非 public | CGLIB 代理无法拦截 | 改为 public |
| 异常被捕获 | 代理感知不到异常 | 手动回滚或重新抛出 |
| 数据库引擎不支持 | MyISAM 不支持事务 | 使用 InnoDB |
| 多线程环境 | 事务绑定在线程上 | 使用分布式事务或手动管理 |
| 默认回滚策略 | 受检异常不回滚 | 指定 `rollbackFor` |

## 六、手动事务管理

```java
@Service
public class ManualTransactionService {

    private final TransactionTemplate transactionTemplate;

    public ManualTransactionService(TransactionTemplate transactionTemplate) {
        this.transactionTemplate = transactionTemplate;
    }

    public void doBusiness() {
        transactionTemplate.execute(status -> {
            // 业务操作...
            // RuntimeException 会自动回滚
            return null;
        });
    }
}
```

## 七、速查表

| 概念 | 说明 |
|------|------|
| `@Transactional` | 声明式事务注解 |
| `propagation` | 传播行为：`REQUIRED`(默认)/`REQUIRES_NEW`/`NESTED` 等 |
| `isolation` | 隔离级别：`DEFAULT`/`READ_COMMITTED`/`REPEATABLE_READ` 等 |
| `rollbackFor` | 指定回滚的异常类型 |
| `noRollbackFor` | 指定不回滚的异常类型 |
| `readOnly` | 只读事务，性能优化 |
| `timeout` | 超时时间（秒），超时自动回滚 |
| `TransactionTemplate` | 编程式事务管理 |
| `TransactionAspectSupport` | 手动设置回滚标记 |
| `@EnableTransactionManagement` | 手动启用事务（Spring Boot 已自动配置） |