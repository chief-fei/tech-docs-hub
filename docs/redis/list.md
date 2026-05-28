# Redis List 列表操作

List 是双向链表结构，支持从头部（left）和尾部（right）操作元素。适合消息队列、时间线等。

## 获取操作接口

```java
ListOperations<String, Object> ops = redisTemplate.opsForList();
```

## Push — 推入元素

### leftPush — 从左侧推入（头部）

```java
// LPUSH key value — 返回推入后列表长度
Long leftPush(K key, V value);

// LPUSH key v1 v2 ... — 批量推入
Long leftPushAll(K key, V... values);
Long leftPushAll(K key, Collection&lt;V&gt; values);

ops.leftPush("queue:tasks", "task3");         // [task3]
ops.leftPush("queue:tasks", "task2");         // [task2, task3]
ops.leftPush("queue:tasks", "task1");         // [task1, task2, task3]

ops.leftPushAll("queue", "c", "b", "a");      // [a, b, c]
```

### rightPush — 从右侧推入（尾部）

```java
// RPUSH key value
Long rightPush(K key, V value);
Long rightPushAll(K key, V... values);
Long rightPushAll(K key, Collection&lt;V&gt; values);

ops.rightPush("queue", "a");    // [a]
ops.rightPush("queue", "b");    // [a, b]
ops.rightPush("queue", "c");    // [a, b, c]
```

### leftPushIfPresent / rightPushIfPresent — 仅 key 存在时推入

```java
// LPUSHX / RPUSHX — key 不存在则不做任何操作
Long leftPushIfPresent(K key, V value);
Long rightPushIfPresent(K key, V value);
```

## Pop — 弹出元素

```java
// LPOP — 弹出并返回头部元素
V leftPop(K key);

// RPOP — 弹出并返回尾部元素
V rightPop(K key);

// BLPOP key timeout — 阻塞弹出，超时返回 null
V leftPop(K key, long timeout, TimeUnit unit);

// BRPOP key timeout
V rightPop(K key, long timeout, TimeUnit unit);

// 阻塞示例：等待 30 秒
String msg = (String) ops.leftPop("queue:orders", 30, TimeUnit.SECONDS);

// 一直阻塞（永不超时）
Object order = ops.leftPop("queue:orders", 0, TimeUnit.SECONDS);
```

### rightPopAndLeftPush — 原子转移

```java
// RPOPLPUSH source dest — 从 source 右侧弹出，推入 dest 左侧
V rightPopAndLeftPush(K sourceKey, K destinationKey);

// 可靠消息队列：处理中的消息移到 backup 队列
Object msg = ops.rightPopAndLeftPush("queue:pending", "queue:processing");
try {
    process(msg);
    redisTemplate.delete("queue:processing");
} catch (Exception e) {
    ops.rightPopAndLeftPush("queue:processing", "queue:pending"); // 恢复
}
```

## Range — 获取范围

```java
// LRANGE key start stop — 索引范围获取（-1 表示最后一个）
List&lt;V&gt; range(K key, long start, long end);

ops.range("list", 0, -1);   // 全部
ops.range("list", 0, 2);    // 前 3 个
ops.range("list", -3, -1);  // 最后 3 个
```

## 其他操作

```java
// LINDEX — 按索引获取
V index(K key, long index);

// LSET — 按索引设置（索引必须存在）
void set(K key, long index, V value);

// LREM — 删除匹配元素
//   count > 0: 从左删 count 个
//   count < 0: 从右删 |count| 个
//   count = 0: 全部删除
Long remove(K key, long count, Object value);

// LLEN — 列表长度
Long size(K key);

// LTRIM — 截取（保留范围内，删除其余）
void trim(K key, long start, long end);
ops.trim("timeline", 0, 499);  // 只保留最新 500 条

// LINSERT — 在 pivot 前后插入（需通过 RedisCallback）
redisTemplate.execute((RedisCallback<Long>) conn -> conn.listCommands()
    .lInsert(key.getBytes(), Position.AFTER, pivot.getBytes(), value.getBytes()));
```

## 方法速查表

| 方法 | Redis 命令 | 返回值 |
|------|-----------|--------|
| `leftPush(K, V)` | LPUSH | Long |
| `leftPushAll(K, V...)` | LPUSH | Long |
| `leftPushAll(K, Collection)` | LPUSH | Long |
| `rightPush(K, V)` | RPUSH | Long |
| `rightPushAll(K, V...)` | RPUSH | Long |
| `leftPushIfPresent(K, V)` | LPUSHX | Long |
| `rightPushIfPresent(K, V)` | RPUSHX | Long |
| `leftPop(K)` | LPOP | V |
| `rightPop(K)` | RPOP | V |
| `leftPop(K, long, TimeUnit)` | BLPOP | V |
| `rightPop(K, long, TimeUnit)` | BRPOP | V |
| `rightPopAndLeftPush(K, K)` | RPOPLPUSH | V |
| `range(K, long, long)` | LRANGE | `List&lt;V&gt;` |
| `index(K, long)` | LINDEX | V |
| `set(K, long, V)` | LSET | void |
| `remove(K, long, Object)` | LREM | Long |
| `size(K)` | LLEN | Long |
| `trim(K, long, long)` | LTRIM | void |

## 实战：消息队列

```java
@Component
public class MessageQueueService {
    @Autowired
    private StringRedisTemplate redisTemplate;

    // 生产者
    public void send(String queue, String msg) {
        redisTemplate.opsForList().leftPush("mq:" + queue, msg);
    }

    // 消费者（阻塞）
    public String receive(String queue, long timeoutSec) {
        return redisTemplate.opsForList()
            .rightPop("mq:" + queue, timeoutSec, TimeUnit.SECONDS);
    }

    public Long size(String queue) {
        return redisTemplate.opsForList().size("mq:" + queue);
    }
}
```

## 实战：用户动态时间线

```java
@Component
public class TimelineService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void postFeed(Long userId, Object feed) {
        String key = "timeline:" + userId;
        redisTemplate.opsForList().leftPush(key, feed);
        redisTemplate.opsForList().trim(key, 0, 499);  // 保留 500 条
    }

    public List<Object> getFeeds(Long userId, int page, int size) {
        int start = (page - 1) * size;
        int end = start + size - 1;
        return redisTemplate.opsForList().range("timeline:" + userId, start, end);
    }
}
```
