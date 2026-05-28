# RocketMQ 使用指南

RocketMQ 是阿里巴巴开源的分布式消息中间件，支持高吞吐、低延迟。

## 一、基础概念

| 概念 | 说明 |
|------|------|
| **Producer** | 消息生产者 |
| **Consumer** | 消息消费者 |
| **Topic** | 消息主题 |
| **Tag** | Topic 下的二级分类 |
| **NameServer** | 路由注册中心 |
| **Broker** | 消息存储与转发 |
| **Group** | 生产者/消费者组 |

## 二、Producer（生产者）

### Maven 依赖

```xml
<dependency>
    <groupId>org.apache.rocketmq</groupId>
    <artifactId>rocketmq-spring-boot-starter</artifactId>
    <version>2.3.0</version>
</dependency>
```

### application.yml

```yaml
rocketmq:
  name-server: 127.0.0.1:9876
  producer:
    group: order-producer-group
    send-message-timeout: 3000
    retry-times-when-send-failed: 2
    retry-times-when-send-async-failed: 2
    max-message-size: 4194304          # 默认 4M
    compress-message-body-threshold: 4096
```

### 同步发送

```java
@Autowired
private RocketMQTemplate rocketMQTemplate;

// destination 格式：topic:tag
SendResult result = rocketMQTemplate.syncSend(
    "order-topic:paid",       // topic:tag
    orderMessage               // 消息体
);
// result.getSendStatus() → SEND_OK
// result.getMsgId()      → 消息 ID
```

同步发送参数：
| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `destination` | `topic[:tag]` | 必填 |
| `message` | 消息体 Object/Message | 必填 |
| `timeout` | 超时 ms | 3000 |
| `delayLevel` | 延迟级别 0-18 | 0 |

### 异步发送

```java
rocketMQTemplate.asyncSend("order-topic", message, new SendCallback() {
    @Override
    public void onSuccess(SendResult result) { }
    @Override
    public void onException(Throwable e) { }
}, 3000);
```

### 单向发送（最高吞吐）

```java
rocketMQTemplate.sendOneWay("order-topic", message);
```

### 顺序消息

```java
// 同 hashKey 发到同一队列，保证消费顺序
rocketMQTemplate.syncSendOrderly("order-topic", message, orderId);
```

### 延迟消息

delayLevel 对照：
| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9-14 | 15 | 16 | 17 | 18 |
|-------|---|---|---|---|---|---|---|---|------|----|----|----|----|
| 时间 | 1s | 5s | 10s | 30s | 1m | 2m | 3m | 4m | 5-10m | 20m | 30m | 1h | 2h |

```java
rocketMQTemplate.syncSend("order-topic",
    MessageBuilder.withPayload(order).build(), 3000, 3);  // level=3 → 10s
```

### 事务消息

```java
// 1. 发送半消息
rocketMQTemplate.sendMessageInTransaction(
    "order-topic", MessageBuilder.withPayload(order).build(), null);

// 2. 实现事务监听器
@RocketMQTransactionListener
public class OrderListener implements RocketMQLocalTransactionListener {
    public RocketMQLocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        try {
            orderService.createOrder(msg);
            return RocketMQLocalTransactionState.COMMIT;
        } catch (Exception e) {
            return RocketMQLocalTransactionState.ROLLBACK;
        }
    }
    public RocketMQLocalTransactionState checkLocalTransaction(Message msg) {
        return orderService.checkStatus(msg);
    }
}
```

---

## 三、Consumer（消费者）

```java
@Service
@RocketMQMessageListener(
    topic = "order-topic",
    consumerGroup = "order-consumer",
    selectorExpression = "paid||cancelled",     // Tag 过滤，默认 *
    consumeMode = ConsumeMode.CONCURRENTLY,      // 并发消费
    messageModel = MessageModel.CLUSTERING,      // 集群模式
    maxReconsumeTimes = 3
)
public class OrderConsumer implements RocketMQListener<MessageExt> {
    @Override
    public void onMessage(MessageExt msg) {
        String body = new String(msg.getBody());
        String topic = msg.getTopic();
        String tags = msg.getTags();
        String keys = msg.getKeys();

        try {
            processOrder(body);
        } catch (Exception e) {
            throw new RuntimeException("消费失败触发重试", e);
        }
    }
}
```

消费者参数：
| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `topic` | 订阅主题 | 必填 |
| `consumerGroup` | 消费者组 | 必填 |
| `selectorExpression` | Tag 过滤 | `*` |
| `consumeMode` | CONCURRENTLY / ORDERLY | CONCURRENTLY |
| `messageModel` | CLUSTERING / BROADCASTING | CLUSTERING |
| `maxReconsumeTimes` | 最大重试 | 16 |
| `consumeThreadMax` | 消费线程数 | 64 |

### 消费模式

| 模式 | 说明 | 场景 |
|------|------|------|
| CLUSTERING | 同 Group 均摊消费 | 通用 |
| BROADCASTING | 每个实例消费全量 | 缓存刷新 |

### 重试机制

消费失败后自动重试，间隔递增（10s→30s→1m→2m→...→2h）。最多 16 次后进入死信队列 `%DLQ%{consumerGroup}`。
