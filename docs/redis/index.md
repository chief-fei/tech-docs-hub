# Redis 使用指南

Redis 是一个开源的内存数据结构存储，用作数据库、缓存和消息代理。

## 文档目录

| 文档 | 说明 |
|------|------|
| [String 字符串操作](./string.md) | SET/GET/INCR/DECR/APPEND，含全部重载方法与参数说明 |
| [Hash 哈希操作](./hash.md) | HSET/HGET/HMSET 等，适合存储对象 |
| [List 列表操作](./list.md) | LPUSH/RPUSH/LPOP/RPOP/BLPOP，消息队列实现 |
| [Set 集合操作](./set.md) | SADD/SREM/SINTER/SUNION/SDIFF，标签与去重 |
| [ZSet 有序集合操作](./zset.md) | ZADD/ZRANGE/ZINCRBY，排行榜与延迟队列 |
| [Redisson 分布式锁](./redisson-lock.md) | 分布式锁、公平锁、读写锁、联锁 |

## Spring Boot 集成

### 1. 添加依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

### 2. application.yml 配置

```yaml
spring:
  redis:
      host: localhost
      port: 6379
      password:            # 有密码时填写
      database: 0
      timeout: 3000ms
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 0
          max-wait: -1ms
```

### 3. 配置 RedisTemplate

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        Jackson2JsonRedisSerializer<Object> jsonSerializer =
            new Jackson2JsonRedisSerializer<>(Object.class);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
```

### 4. 五大操作接口

```java
@Autowired
private RedisTemplate<String, Object> redisTemplate;

// 获取各类型操作接口
ValueOperations<String, Object> valueOps = redisTemplate.opsForValue();    // String
HashOperations<String, String, Object> hashOps = redisTemplate.opsForHash(); // Hash
ListOperations<String, Object> listOps = redisTemplate.opsForList();        // List
SetOperations<String, Object> setOps = redisTemplate.opsForSet();           // Set
ZSetOperations<String, Object> zsetOps = redisTemplate.opsForZSet();        // ZSet
```

## 快速选择：什么场景用什么类型？

| 场景 | 类型 | 示例 |
|------|------|------|
| 缓存单值、计数器、分布式锁 | **String** | `SET user:1001 'Tom'` |
| 缓存对象、购物车 | **Hash** | `HSET user:1001 name Tom` |
| 消息队列、最新动态时间线 | **List** | `LPUSH queue:tasks task1` |
| 标签系统、共同好友、抽奖 | **Set** | `SADD tags:article1 java` |
| 排行榜、延迟队列、优先级队列 | **ZSet** | `ZADD rank 100 player1` |
