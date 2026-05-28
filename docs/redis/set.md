# Redis Set 集合操作

Set 是无序不重复集合，支持交集、并集、差集运算。适合标签、共同好友、抽奖等。

## 获取操作接口

```java
SetOperations<String, Object> ops = redisTemplate.opsForSet();
```

## SADD — 添加元素

```java
// SADD key member... — 返回成功添加的数量
Long add(K key, V... values);

ops.add("user:1001:tags", "java", "spring", "redis");   // 3
ops.add("user:1001:tags", "java", "docker");            // 1（java 重复跳过）
```

## SREM — 删除元素

```java
// SREM key member... — 返回成功删除的数量
Long remove(K key, Object... values);

ops.remove("user:1001:tags", "docker");              // 1
ops.remove("user:1001:tags", "python", "docker");    // 0（都不存在）
```

## 查询操作

```java
// SMEMBERS — 获取所有成员
Set&lt;V&gt; members(K key);

// SISMEMBER — 判断是否为成员
Boolean isMember(K key, Object o);

// SCARD — 获取成员数量
Long size(K key);
```

## 随机操作

```java
// SRANDMEMBER — 随机获取（不移除）
V randomMember(K key);                          // 1 个
List&lt;V&gt; randomMembers(K key, long count);        // count 个（可能重复）
Set&lt;V&gt; distinctRandomMembers(K key, long count); // count 个（去重）

// SPOP — 随机弹出（移除）
V pop(K key);                    // 弹出 1 个
List&lt;V&gt; pop(K key, long count);  // 弹出 count 个

// 抽奖示例
String winner = (String) ops.pop("lottery:participants");
List<Object> winners = ops.pop("lottery:participants", 3);
```

## SMOVE — 移动元素

```java
// SMOVE source dest member
Boolean move(K key, V value, K destKey);

// 用户从"待审核"移到"已通过"
ops.move("set:pending", "user1001", "set:approved");
```

## 集合运算

### 差集 SDIFF

```java
// key1 有但 key2 没有的元素
Set&lt;V&gt; difference(K key, K otherKey);
Set&lt;V&gt; difference(K key, Collection&lt;K&gt; otherKeys);

// 差集存入目标 key
Long differenceAndStore(K key, K otherKey, K destKey);
Long differenceAndStore(K key, Collection&lt;K&gt; otherKeys, K destKey);

// 示例：查未读消息
ops.add("msg:all", "m1", "m2", "m3", "m4", "m5");
ops.add("msg:read", "m1", "m3", "m5");
Set<Object> unread = ops.difference("msg:all", "msg:read");  // [m2, m4]
```

### 交集 SINTER

```java
Set&lt;V&gt; intersect(K key, K otherKey);
Set&lt;V&gt; intersect(K key, Collection&lt;K&gt; otherKeys);
Long intersectAndStore(K key, K otherKey, K destKey);
Long intersectAndStore(K key, Collection&lt;K&gt; otherKeys, K destKey);

// 示例：计算共同好友
ops.add("friend:user1", "user2", "user3", "user4");
ops.add("friend:user2", "user1", "user3", "user5");
Set<Object> common = ops.intersect("friend:user1", "friend:user2");  // [user3]
```

### 并集 SUNION

```java
Set&lt;V&gt; union(K key, K otherKey);
Set&lt;V&gt; union(K key, Collection&lt;K&gt; otherKeys);
Long unionAndStore(K key, K otherKey, K destKey);
Long unionAndStore(K key, Collection&lt;K&gt; otherKeys, K destKey);

// 示例：合并多个标签
ops.add("tag:art1", "java", "spring");
ops.add("tag:art2", "redis", "spring");
Set<Object> allTags = ops.union("tag:art1", "tag:art2");  // [java, spring, redis]
```

## SSCAN — 分批遍历

```java
Cursor&lt;V&gt; scan(K key, ScanOptions options);

Cursor<Object> cursor = ops.scan("large:set",
    ScanOptions.scanOptions().count(100).build());
while (cursor.hasNext()) {
    process(cursor.next());
}
```

## 方法速查表

| 方法 | Redis 命令 | 返回值 |
|------|-----------|--------|
| `add(K, V...)` | SADD | Long |
| `remove(K, Object...)` | SREM | Long |
| `members(K)` | SMEMBERS | `Set&lt;V&gt;` |
| `isMember(K, Object)` | SISMEMBER | Boolean |
| `size(K)` | SCARD | Long |
| `pop(K)` | SPOP | V |
| `pop(K, long)` | SPOP | `List&lt;V&gt;` |
| `randomMember(K)` | SRANDMEMBER | V |
| `randomMembers(K, long)` | SRANDMEMBER | `List&lt;V&gt;` |
| `distinctRandomMembers(K, long)` | SRANDMEMBER | `Set&lt;V&gt;` |
| `move(K, V, K)` | SMOVE | Boolean |
| `difference(K, K)` | SDIFF | `Set&lt;V&gt;` |
| `difference(K, Collection)` | SDIFF | `Set&lt;V&gt;` |
| `intersect(K, K)` | SINTER | `Set&lt;V&gt;` |
| `intersect(K, Collection)` | SINTER | `Set&lt;V&gt;` |
| `union(K, K)` | SUNION | `Set&lt;V&gt;` |
| `union(K, Collection)` | SUNION | `Set&lt;V&gt;` |
| `*AndStore(...)` | *STORE | Long |
| `scan(K, ScanOptions)` | SSCAN | Cursor |

## 实战：共同关注

```java
@Service
public class FollowService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void follow(Long userId, Long targetId) {
        ops.add("follow:" + userId, targetId.toString());
    }

    public void unfollow(Long userId, Long targetId) {
        ops.remove("follow:" + userId, targetId.toString());
    }

    public Set<Object> commonFollowing(Long u1, Long u2) {
        return ops.intersect("follow:" + u1, "follow:" + u2);
    }

    // 你可能认识的人（二度好友）
    public Set<Object> recommend(Long userId) {
        Set<Object> recs = new HashSet<>();
        for (Object f : ops.members("follow:" + userId)) {
            Set<Object> theirs = ops.difference(
                "follow:" + f, "follow:" + userId);
            recs.addAll(theirs);
        }
        recs.remove(userId.toString());
        return recs;
    }
}
```

## 实战：抽奖

```java
@Service
public class LotteryService {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void enroll(String activityId, Long userId) {
        ops.add("lottery:" + activityId, userId.toString());
    }

    public List<Object> draw(String activityId, int count) {
        return ops.pop("lottery:" + activityId, count);
    }

    public Long count(String activityId) {
        return ops.size("lottery:" + activityId);
    }
}
```
