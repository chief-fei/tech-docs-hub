# Redis Hash 哈希操作

Hash 是字段-值对的映射表，适合存储对象（可直接操作单个字段）。

## 获取操作接口

```java
// <K=key, HK=hashKey, HV=hashValue>
HashOperations<String, String, Object> ops = redisTemplate.opsForHash();
```

## HSET — 设置字段

### put(K key, HK hashKey, HV value) — 设置单个字段

```java
void put(K key, HK hashKey, HV value);

ops.put("user:1001", "name", "张三");
ops.put("user:1001", "age", "25");
```

### putIfAbsent(K key, HK hashKey, HV value) — 不存在时设置

```java
// HSETNX — 仅当字段不存在时设置
Boolean putIfAbsent(K key, HK hashKey, HV value);

Boolean ok = ops.putIfAbsent("user:1001", "id", "1001");  // true
Boolean fail = ops.putIfAbsent("user:1001", "id", "9999"); // false（已存在）
```

### putAll(K key, Map m) — 批量设置

```java
// HMSET — 一次性设置整个对象
void putAll(K key, Map<? extends HK, ? extends HV> m);

Map<String, Object> userMap = new HashMap<>();
userMap.put("id", 1001L);
userMap.put("name", "张三");
userMap.put("age", 25);
userMap.put("email", "zhangsan@example.com");
ops.putAll("user:1001", userMap);
```

## HGET — 获取字段

### get(K key, Object hashKey) — 获取单个字段

```java
// HGET
HV get(K key, Object hashKey);

String name = (String) ops.get("user:1001", "name");  // "张三"
```

### multiGet(K key, Collection&lt;HK&gt; hashKeys) — 批量获取

```java
// HMGET
List&lt;HV&gt; multiGet(K key, Collection&lt;HK&gt; hashKeys);

List<Object> values = ops.multiGet("user:1001",
    Arrays.asList("name", "age", "email"));
// ["张三", 25, "zhangsan@example.com"]
```

### entries(K key) — 获取所有字段和值

```java
// HGETALL
Map<HK, HV> entries(K key);

Map<String, Object> userMap = ops.entries("user:1001");
```

## 其他操作

```java
// HKEYS — 获取所有字段名
Set&lt;HK&gt; keys(K key);

// HVALS — 获取所有值
List&lt;HV&gt; values(K key);

// HEXISTS — 检查字段是否存在
Boolean hasKey(K key, Object hashKey);

// HDEL — 删除字段（支持多个）
Long delete(K key, Object... hashKeys);

// HLEN — 获取字段数量
Long size(K key);

// HINCRBY — 整数值递增
Long increment(K key, HK hashKey, long delta);

// HINCRBYFLOAT — 浮点值递增
Double increment(K key, HK hashKey, double delta);

// HSCAN — 分批遍历大 Hash
Cursor<Map.Entry<HK, HV>> scan(K key, ScanOptions options);

// 示例：递增积分
ops.increment("user:1001", "points", 10);   // +10
ops.increment("user:1001", "points", -5);   // -5

// 示例：分批遍历
Cursor<Map.Entry<String, Object>> cursor = ops.scan("big:hash",
    ScanOptions.scanOptions().count(100).build());
while (cursor.hasNext()) {
    Map.Entry<String, Object> e = cursor.next();
    System.out.println(e.getKey() + "=" + e.getValue());
}
```

## 方法速查表

| 方法 | Redis 命令 | 返回值 |
|------|-----------|--------|
| `put(K, HK, HV)` | HSET | void |
| `putIfAbsent(K, HK, HV)` | HSETNX | Boolean |
| `putAll(K, Map)` | HMSET | void |
| `get(K, Object)` | HGET | HV |
| `multiGet(K, Collection)` | HMGET | `List&lt;HV&gt;` |
| `entries(K)` | HGETALL | `Map<HK, HV>` |
| `keys(K)` | HKEYS | `Set&lt;HK&gt;` |
| `values(K)` | HVALS | `List&lt;HV&gt;` |
| `hasKey(K, Object)` | HEXISTS | Boolean |
| `delete(K, Object...)` | HDEL | Long |
| `size(K)` | HLEN | Long |
| `increment(K, HK, long)` | HINCRBY | Long |
| `increment(K, HK, double)` | HINCRBYFLOAT | Double |
| `scan(K, ScanOptions)` | HSCAN | Cursor |

## 实战：缓存用户对象

```java
@Service
public class UserCacheService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void cacheUser(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("age", user.getAge());
        map.put("email", user.getEmail());
        map.put("level", user.getLevel());

        String key = "user:" + user.getId();
        redisTemplate.opsForHash().putAll(key, map);
        redisTemplate.expire(key, 30, TimeUnit.MINUTES);
    }

    public User getUser(Long userId) {
        Map<Object, Object> entries = redisTemplate.opsForHash().entries("user:" + userId);
        if (entries.isEmpty()) return null;
        return convertToUser(entries);
    }

    public void updateLevel(Long userId, int newLevel) {
        // 只更新单个字段，无需序列化整个对象
        redisTemplate.opsForHash().put("user:" + userId, "level", newLevel);
    }
}
```

## 实战：购物车

```java
@Service
public class CartService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void addItem(String userId, Long productId, int quantity) {
        ops.put("cart:" + userId, String.valueOf(productId), quantity);
    }

    public void updateQuantity(String userId, Long productId, int delta) {
        ops.increment("cart:" + userId, String.valueOf(productId), delta);
    }

    public Map<String, Object> getCart(String userId) {
        return ops.entries("cart:" + userId);
    }

    public void removeItem(String userId, Long productId) {
        ops.delete("cart:" + userId, String.valueOf(productId));
    }

    public Long getCartSize(String userId) {
        return ops.size("cart:" + userId);
    }
}
```
