# Redis ZSet 有序集合操作

ZSet（Sorted Set）是带分数的有序集合。每个成员关联一个 score，按 score 排序。适合排行榜、延迟队列等。

## 获取操作接口

```java
ZSetOperations<String, Object> ops = redisTemplate.opsForZSet();
```

## ZADD — 添加元素

```java
// ZADD key score member — 添加单个，存在则更新分数
Boolean add(K key, V value, double score);

// ZADD key score1 member1 ... — 批量添加
Long add(K key, Set<TypedTuple&lt;V&gt;> tuples);

ops.add("rank:game", "player1", 1000);
ops.add("rank:game", "player2", 1500);

// 批量
DefaultTypedTuple<Object> t1 = new DefaultTypedTuple<>("p1", 1000.0);
DefaultTypedTuple<Object> t2 = new DefaultTypedTuple<>("p2", 1500.0);
ops.add("rank:game", new HashSet<>(Arrays.asList(t1, t2)));
```

## ZREM — 删除元素

```java
// ZREM key member...
Long remove(K key, Object... values);
```

## 分数操作

```java
// ZSCORE — 获取分数
Double score(K key, Object o);          // 不存在返回 null

// ZINCRBY — 增减分数
Double incrementScore(K key, V value, double delta);

ops.incrementScore("rank:game", "player1", 50);   // 1050.0
ops.incrementScore("rank:game", "player1", -30);  // 1020.0
```

## 排名操作

```java
// ZRANK — 正序排名（分数从小到大，0 起始）
Long rank(K key, Object o);

// ZREVRANK — 倒序排名（分数从大到小，0 起始）
Long reverseRank(K key, Object o);

// 获取玩家第几名（从高到低）
Long rank = ops.reverseRank("rank:game", "player1");  // 返回 null 表示不存在
// rank == 0 → 第 1 名
```

## 获取操作

```java
// ZCARD — 成员数量
Long size(K key);

// ZCOUNT — 按分数范围计数
Long count(K key, double min, double max);
ops.count("rank:game", 800, 1200);  // 800-1200 分的人数
```

### 按排名范围获取

```java
// ZRANGE — 正序按排名获取
Set&lt;V&gt; range(K key, long start, long end);
Set<TypedTuple&lt;V&gt;> rangeWithScores(K key, long start, long end);

// ZREVRANGE — 倒序按排名获取（排行榜常用）
Set&lt;V&gt; reverseRange(K key, long start, long end);
Set<TypedTuple&lt;V&gt;> reverseRangeWithScores(K key, long start, long end);

// TOP 10 排行榜（含分数）
Set<TypedTuple<Object>> top = ops.reverseRangeWithScores("rank:game", 0, 9);
int rank = 1;
for (TypedTuple<Object> t : top) {
    System.out.printf("第%d名: %s - %d分%n",
        rank++, t.getValue(), t.getScore().longValue());
}
```

### 按分数范围获取

```java
// ZRANGEBYSCORE — 按分数范围
Set&lt;V&gt; rangeByScore(K key, double min, double max);
Set<TypedTuple&lt;V&gt;> rangeByScoreWithScores(K key, double min, double max);

// 分页（offset + count）
Set&lt;V&gt; rangeByScore(K key, double min, double max, long offset, long count);

// ZREVRANGEBYSCORE — 倒序按分数范围
Set&lt;V&gt; reverseRangeByScore(K key, double min, double max);
Set&lt;V&gt; reverseRangeByScore(K key, double min, double max, long offset, long count);
Set<TypedTuple&lt;V&gt;> reverseRangeByScoreWithScores(K key, double min, double max);
```

### 按范围删除

```java
// ZREMRANGEBYRANK — 按排名删除
Long removeRange(K key, long start, long end);
ops.removeRange("rank:game", 100, -1);  // 只保留前 100 名

// ZREMRANGEBYSCORE — 按分数删除
Long removeRangeByScore(K key, double min, double max);
ops.removeRangeByScore("rank:game", -Double.MAX_VALUE, 0);  // 删 0 分以下
```

## 集合运算

```java
// 交集
Long intersectAndStore(K key, K otherKey, K destKey);
Long intersectAndStore(K key, Collection&lt;K&gt; otherKeys, K destKey);

// 并集
Long unionAndStore(K key, K otherKey, K destKey);
Long unionAndStore(K key, Collection&lt;K&gt; otherKeys, K destKey);
```

## 方法速查表

| 方法 | Redis 命令 | 返回值 |
|------|-----------|--------|
| `add(K, V, double)` | ZADD | Boolean |
| `add(K, Set&lt;TypedTuple&gt;)` | ZADD | Long |
| `remove(K, Object...)` | ZREM | Long |
| `score(K, Object)` | ZSCORE | Double |
| `incrementScore(K, V, double)` | ZINCRBY | Double |
| `rank(K, Object)` | ZRANK | Long |
| `reverseRank(K, Object)` | ZREVRANK | Long |
| `size(K)` | ZCARD | Long |
| `count(K, double, double)` | ZCOUNT | Long |
| `range(K, long, long)` | ZRANGE | `Set&lt;V&gt;` |
| `rangeWithScores(K, long, long)` | ZRANGE | Set\<TypedTuple\> |
| `reverseRange(K, long, long)` | ZREVRANGE | `Set&lt;V&gt;` |
| `reverseRangeWithScores(K, long, long)` | ZREVRANGE | Set\<TypedTuple\> |
| `rangeByScore(K, double, double)` | ZRANGEBYSCORE | `Set&lt;V&gt;` |
| `rangeByScore(K, d, d, long, long)` | ZRANGEBYSCORE | `Set&lt;V&gt;` |
| `reverseRangeByScore(K, double, double)` | ZREVRANGEBYSCORE | `Set&lt;V&gt;` |
| `removeRange(K, long, long)` | ZREMRANGEBYRANK | Long |
| `removeRangeByScore(K, double, double)` | ZREMRANGEBYSCORE | Long |

## 实战：游戏排行榜

```java
@Service
public class LeaderboardService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    private static final String KEY = "game:leaderboard";

    public void updateScore(String playerId, double score) {
        ops.add(KEY, playerId, score);
    }

    public void addScore(String playerId, double delta) {
        ops.incrementScore(KEY, playerId, delta);
    }

    public List<Map<String, Object>> getTopN(int n) {
        Set<TypedTuple<Object>> top = ops.reverseRangeWithScores(KEY, 0, n - 1);
        List<Map<String, Object>> result = new ArrayList<>();
        int rank = 1;
        for (TypedTuple<Object> t : top) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("rank", rank++);
            item.put("playerId", t.getValue());
            item.put("score", t.getScore().longValue());
            result.add(item);
        }
        return result;
    }

    public Long getPlayerRank(String playerId) {
        Long rank = ops.reverseRank(KEY, playerId);
        return rank == null ? null : rank + 1;
    }
}
```

## 实战：延迟队列

```java
@Component
public class DelayQueueService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    private static final String KEY = "delay:queue";

    // 添加延迟任务（executeAt = 执行时间戳毫秒）
    public void addTask(String taskId, long executeAtMillis) {
        ops.add(KEY, taskId, executeAtMillis);
    }

    // N 秒后执行
    public void addTaskDelay(String taskId, long delaySeconds) {
        ops.add(KEY, taskId, System.currentTimeMillis() + delaySeconds * 1000);
    }

    // 获取并移除到期任务
    public Set<Object> pollDueTasks() {
        long now = System.currentTimeMillis();
        Set<Object> tasks = ops.rangeByScore(KEY, 0, now);
        if (!tasks.isEmpty()) ops.remove(KEY, tasks.toArray());
        return tasks;
    }
}
```
