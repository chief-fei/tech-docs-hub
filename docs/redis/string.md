# Redis String 字符串操作

String 是 Redis 最基本的数据类型，一个 Key 对应一个 Value。

## 获取操作接口

```java
ValueOperations<String, Object> ops = redisTemplate.opsForValue();
```

## SET — 设置键值

### set(K key, V value) — 基本设置

```java
// 无过期时间
void set(K key, V value);
ops.set("user:1001:name", "张三");
```

### set(K key, V value, long timeout, TimeUnit unit) — 带过期时间

```java
// SETEX key seconds value
void set(K key, V value, long timeout, TimeUnit unit);

ops.set("sms:13800138000", "123456", 30, TimeUnit.SECONDS);  // 30秒后过期
ops.set("session:abc123", userJson, 5, TimeUnit.MINUTES);    // 5分钟后过期
ops.set("temp:data", value, 2, TimeUnit.HOURS);             // 2小时后过期
ops.set("persist:data", value, 7, TimeUnit.DAYS);           // 7天后过期
```

### set(K key, V value, long offset) — 偏移量写入

```java
// SETRANGE key offset value — 从指定偏移量开始覆盖
void set(K key, V value, long offset);

ops.set("greeting", "Hello World");
ops.set("greeting", "Redis", 6);  // → "Hello Redis"
```

### setIfAbsent(K key, V value) — 不存在时设置

```java
// SETNX key value — 仅当 key 不存在时设置，返回是否成功
Boolean setIfAbsent(K key, V value);

// 简单分布式锁
Boolean locked = ops.setIfAbsent("lock:order:1001", "1");
if (Boolean.TRUE.equals(locked)) {
    try { processOrder(); }
    finally { redisTemplate.delete("lock:order:1001"); }
}
```

### setIfAbsent(K key, V value, long timeout, TimeUnit unit) — SETNX + 过期

```java
// SET key value NX EX seconds — 原子操作：不存在则设置 + 过期时间
Boolean setIfAbsent(K key, V value, long timeout, TimeUnit unit);

Boolean locked = ops.setIfAbsent("lock:order:1001", "1", 10, TimeUnit.SECONDS);
```

### setIfPresent(K key, V value) — 存在时设置

```java
// SET key value XX — 仅当 key 存在时设置
Boolean setIfPresent(K key, V value);

// 仅更新已有缓存
ops.setIfPresent("user:1001:cache", newData);
```

### setIfPresent(K key, V value, long timeout, TimeUnit unit) — 存在时设置+过期

```java
// SET key value XX EX seconds
Boolean setIfPresent(K key, V value, long timeout, TimeUnit unit);

// 更新缓存并刷新过期时间
ops.setIfPresent("user:1001:cache", newData, 30, TimeUnit.MINUTES);
```

### multiSet(Map) — 批量设置

```java
// MSET key1 value1 key2 value2 ...
void multiSet(Map<? extends K, ? extends V> map);

Map<String, String> map = new HashMap<>();
map.put("user:1001:name", "张三");
map.put("user:1001:age", "25");
ops.multiSet(map);
```

### multiSetIfAbsent(Map) — 批量 SETNX

```java
// MSETNX — 全部 key 都不存在才设置
Boolean multiSetIfAbsent(Map<? extends K, ? extends V> map);
```

## GET — 获取键值

### get(Object key) — 基本获取

```java
// GET key
V get(Object key);

String name = (String) ops.get("user:1001:name");
```

### get(K key, long start, long end) — 获取子字符串

```java
// GETRANGE key start end — 支持负数索引
String get(K key, long start, long end);

ops.set("greeting", "Hello World");
ops.get("greeting", 0, 4);   // "Hello"
ops.get("greeting", 6, -1);  // "World"
```

### getAndSet(K key, V value) — 获取旧值并设新值

```java
// GETSET key value — 原子操作
V getAndSet(K key, V value);

Object old = ops.getAndSet("counter:daily", "0");  // 获取旧值并重置
```

### getAndPersist(K key, V value) — Redis 6.2.0+ GET 选项

```java
// SET key value GET — 返回旧值（仅 key 存在时）
V getAndPersist(K key, V value);
```

### multiGet(Collection&lt;K&gt; keys) — 批量获取

```java
// MGET key1 key2 ...
List&lt;V&gt; multiGet(Collection&lt;K&gt; keys);

List<String> keys = Arrays.asList("user:1001:name", "user:1001:age");
List<Object> values = ops.multiGet(keys);
```

## INCR / DECR — 自增自减

```java
// INCR key — 自增 1
Long increment(K key);

// INCRBY key delta — 自增指定值
Long increment(K key, long delta);

// INCRBYFLOAT key delta — 浮点自增
Double increment(K key, double delta);

// DECR / DECRBY — 自减（实际是传负值给 increment）
Long decrement(K key);         // 等价于 increment(key, -1L)
Long decrement(K key, long delta);  // 等价于 increment(key, -delta)

// 示例
ops.set("article:1001:views", "0");
ops.increment("article:1001:views");         // 1
ops.increment("article:1001:views", 10);     // 11
ops.increment("article:1001:views", -5);     // 6

ops.set("price:btc", "50000.00");
ops.increment("price:btc", 1500.50);         // 51500.50
```

## APPEND — 追加字符串

```java
// APPEND key value — 返回追加后的总长度
Integer append(K key, String value);

ops.set("log", "2024-01-01 ");
ops.append("log", "user login");  // → "2024-01-01 user login"
```

## SIZE — 获取值的长度

```java
// STRLEN key
Long size(K key);

ops.set("greeting", "Hello");
ops.size("greeting");  // 5
```

## 通用键操作

```java
redisTemplate.hasKey("user:1001:name");           // 是否存在
redisTemplate.delete("user:1001:name");           // 删除单个
redisTemplate.delete(Arrays.asList("k1","k2"));  // 批量删除
redisTemplate.expire("key", 60, TimeUnit.SECONDS); // 设置过期
redisTemplate.getExpire("key", TimeUnit.SECONDS);  // 获取剩余时间(-1=永久,-2=不存在)
```

## 重载方法速查

| 方法签名 | Redis 命令 | 返回值 |
|----------|-----------|--------|
| `set(K, V)` | SET | void |
| `set(K, V, long, TimeUnit)` | SETEX | void |
| `set(K, V, long)` | SETRANGE | void |
| `setIfAbsent(K, V)` | SETNX | Boolean |
| `setIfAbsent(K, V, long, TimeUnit)` | SET NX EX | Boolean |
| `setIfPresent(K, V)` | SET XX | Boolean |
| `setIfPresent(K, V, long, TimeUnit)` | SET XX EX | Boolean |
| `multiSet(Map)` | MSET | void |
| `multiSetIfAbsent(Map)` | MSETNX | Boolean |
| `get(Object)` | GET | V |
| `get(K, long, long)` | GETRANGE | String |
| `getAndSet(K, V)` | GETSET | V |
| `getAndPersist(K, V)` | SET GET（6.2.0+） | V |
| `multiGet(Collection)` | MGET | `List&lt;V&gt;` |
| `increment(K)` | INCR | Long |
| `increment(K, long)` | INCRBY | Long |
| `increment(K, double)` | INCRBYFLOAT | Double |
| `decrement(K)` | DECR | Long |
| `append(K, String)` | APPEND | Integer |
| `size(K)` | STRLEN | Long |

## 实战示例

### 短信验证码

```java
@Service
public class SmsService {
    @Autowired
    private StringRedisTemplate redisTemplate;

    public void sendCode(String phone) {
        String code = String.valueOf((int)(Math.random() * 9000) + 1000);
        redisTemplate.opsForValue().set("sms:" + phone, code, 5, TimeUnit.MINUTES);
    }

    public boolean verifyCode(String phone, String code) {
        String stored = redisTemplate.opsForValue().get("sms:" + phone);
        return code.equals(stored);
    }
}
```

### 文章阅读量统计

```java
@Service
public class ArticleService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public Long recordView(Long articleId) {
        return redisTemplate.opsForValue()
            .increment("article:" + articleId + ":views");
    }

    public Long getViews(Long articleId) {
        Object v = redisTemplate.opsForValue().get("article:" + articleId + ":views");
        return v == null ? 0L : Long.parseLong(v.toString());
    }
}
```

### 用户缓存（带过期 + 数据库回源）

```java
@Service
public class UserCacheService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public User getUser(Long userId) {
        String key = "user:" + userId;
        User user = (User) redisTemplate.opsForValue().get(key);
        if (user != null) return user;

        user = userMapper.selectById(userId);
        if (user != null) {
            redisTemplate.opsForValue().set(key, user, 30, TimeUnit.MINUTES);
        }
        return user;
    }
}
```
