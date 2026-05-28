# Redisson 分布式锁

Redisson 是 Redis 的 Java 客户端，提供丰富的分布式数据结构和服务。其分布式锁功能最为常用。

## Maven 依赖

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.27.0</version>
</dependency>
```

## application.yml 配置

```yaml
spring:
  redis:
      host: localhost
      port: 6379
      password:
      database: 0
```

Spring Boot Starter 会自动创建 `RedissonClient` Bean，直接注入即可使用。

---

## 一、RLock — 可重入分布式锁

### 基本用法

```java
@Autowired
private RedissonClient redisson;

public void process(String orderId) {
    RLock lock = redisson.getLock("lock:order:" + orderId);
    lock.lock();
    try {
        // 业务逻辑
    } finally {
        lock.unlock();
    }
}
```

### lock() 重载方法

```java
// lock() — 一直阻塞直到获取锁，看门狗自动续期（默认 30 秒过期，每 10 秒续期一次）
void lock();

// lock(long leaseTime, TimeUnit unit) — 指定租约时间，到期自动释放，无看门狗
void lock(long leaseTime, TimeUnit unit);

lock.lock(10, TimeUnit.SECONDS);  // 10 秒后自动释放
lock.lock(300, TimeUnit.SECONDS); // 300 秒后自动释放
```

### tryLock() 重载方法

```java
// tryLock() — 立即尝试，获取不到返回 false
boolean tryLock();

// tryLock(long waitTime, TimeUnit unit) — 等待指定时间
// 获取成功后有看门狗自动续期
boolean tryLock(long waitTime, TimeUnit unit);

// tryLock(long waitTime, long leaseTime, TimeUnit unit)
// 等待指定时间 + 固定租约（无看门狗）
boolean tryLock(long waitTime, long leaseTime, TimeUnit unit);

// 等待 3 秒获取，锁最多持有 10 秒
if (lock.tryLock(3, 10, TimeUnit.SECONDS)) {
    try { doWork(); } finally { lock.unlock(); }
}

// 等待 5 秒获取，看门狗自动续期
if (lock.tryLock(5, TimeUnit.SECONDS)) {
    try { doWork(); } finally { lock.unlock(); }
}

// 立即尝试
if (lock.tryLock()) {
    try { doWork(); } finally { lock.unlock(); }
}
```

### 看门狗（Watchdog）机制

| 调用方式 | 自动续期 | 锁超时 |
|----------|:--:|------|
| `lock()` | ✅ | 无 unlock → 进程挂掉后 30 秒释放 |
| `tryLock(waitTime, unit)` | ✅ | 同上 |
| `lock(leaseTime, unit)` | ❌ | leaseTime 后自动释放 |
| `tryLock(wt, lt, unit)` | ❌ | leaseTime 后自动释放 |

**关键点**：`lock()` 和 `tryLock(waitTime, unit)` 获取锁后，Redisson 内部每 `lockWatchdogTimeout/3`（默认 10 秒）自动续期锁到 30 秒，直到调用 `unlock()`。如果进程崩溃未调用 `unlock()`，锁将在 30 秒后自动释放。

### tryLock 最佳实践模板

```java
public Response safeProcess(String orderId) {
    RLock lock = redisson.getLock("lock:order:" + orderId);
    boolean acquired = false;
    try {
        // 等待 3 秒，锁最多持有 10 秒
        acquired = lock.tryLock(3, 10, TimeUnit.SECONDS);
        if (!acquired) {
            return Response.buildFailure("BUSY", "系统繁忙，请稍后重试");
        }
        // 业务逻辑
        return Response.buildSuccess();
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return Response.buildFailure("ERROR", "操作被中断");
    } finally {
        if (acquired) {
            lock.unlock();
        }
    }
}
```

---

## 二、RFairLock — 公平锁

按 FIFO 顺序排队获取锁，避免某些线程长期等待（饥饿）。

```java
RLock fairLock = redisson.getFairLock("fairLock:sendSms");

// 使用方式与 RLock 完全一致
fairLock.lock();
try { sendSms(); } finally { fairLock.unlock(); }

fairLock.tryLock(5, 30, TimeUnit.SECONDS);
```

---

## 三、RReadWriteLock — 读写锁

读锁允许多个线程同时持有，写锁独占。

```java
RReadWriteLock rwLock = redisson.getReadWriteLock("rwLock:config");

// 读操作（允许多个线程并发读取）
rwLock.readLock().lock();
try {
    String cfg = redisTemplate.opsForValue().get("app:config").toString();
} finally {
    rwLock.readLock().unlock();
}

// 写操作（独占，写时不允许读）
rwLock.writeLock().lock();
try {
    redisTemplate.opsForValue().set("app:config", newConfig);
} finally {
    rwLock.writeLock().unlock();
}
```

---

## 四、RMultiLock — 联锁

同时锁定多个锁，全部获取成功才算成功（原子性）。

```java
RLock lock1 = redisson.getLock("lock:order:1001");
RLock lock2 = redisson.getLock("lock:user:2001");
RLock lock3 = redisson.getLock("lock:inventory:3001");

RLock multiLock = redisson.getMultiLock(lock1, lock2, lock3);

multiLock.lock();
try {
    // 同时持有三个锁
    updateOrderUserAndInventory();
} finally {
    multiLock.unlock();
}
```

---

## 五、RSemaphore — 信号量

控制同时访问资源的线程数，适合限流场景。

```java
RSemaphore semaphore = redisson.getSemaphore("semaphore:apiLimit");
semaphore.trySetPermits(10);  // 初始化 10 个许可

// 获取 1 个许可（阻塞）
semaphore.acquire();
try { callApi(); } finally { semaphore.release(); }

// 获取 3 个许可
semaphore.acquire(3);

// 非阻塞尝试
boolean ok = semaphore.tryAcquire();

// 等待 5 秒尝试
boolean ok = semaphore.tryAcquire(5, TimeUnit.SECONDS);

// 必须释放
semaphore.release();
```

---

## 六、分布式锁选择指南

| 锁类型 | 使用场景 | 关键方法 |
|--------|---------|---------|
| **RLock** | 防止并发修改同一资源 | `lock()`, `tryLock()` |
| **RFairLock** | 需要公平排队（FIFO） | 同 RLock |
| **RReadWriteLock** | 读多写少（提高并发） | `readLock()`, `writeLock()` |
| **RMultiLock** | 同时锁定多个资源 | `getMultiLock()` |
| **RSemaphore** | 限制并发数量 | `acquire()`, `tryAcquire()` |

## 注意事项

1. **必须在 finally 中 unlock**：防止锁永不释放
2. **精确锁粒度**：Key 精确到业务对象，如 `lock:order:1001`，不要用 `lock:order`
3. **推荐 tryLock + leaseTime**：指定最大等待时间和持有时间，防止死锁
4. **不要长时间持有锁**：锁内只放必须互斥的核心逻辑
5. **看门狗续期需 unlock**：`lock()` 无 leaseTime 版本必须配对 `unlock()`，否则锁泄漏
