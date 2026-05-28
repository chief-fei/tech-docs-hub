# Dubbo 使用指南

Dubbo 是阿里巴巴开源的高性能 RPC 框架。

## 一、Maven 依赖

```xml
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-spring-boot-starter</artifactId>
    <version>3.3.0</version>
</dependency>
<!-- Nacos 注册中心 -->
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-registry-nacos</artifactId>
</dependency>
```

## 二、application.yml

```yaml
dubbo:
  application:
    name: user-service
  protocol:
    name: dubbo          # dubbo/tri/rest
    port: 20880          # -1=自动分配
  registry:
    address: nacos://127.0.0.1:8848
    parameters:
      namespace: dev
```

## 三、定义服务接口（公共 api 模块）

```java
// user-api 模块
public interface UserService {
    UserDTO getById(Long id);
    Result<Long> create(UserCreateCmd cmd);
    List<UserDTO> listByCondition(UserQuery query);
}
```

## 四、Provider（提供者）

```java
@DubboService
public class UserServiceImpl implements UserService {

    @Override
    public UserDTO getById(Long id) {
        return userMapper.selectById(id);
    }
}

@EnableDubbo
@SpringBootApplication
public class UserServiceApplication { }
```

## 五、Consumer（消费者）

```java
@RestController
public class OrderController {

    @DubboReference
    private UserService userService;

    @PostMapping("/orders")
    public Result<Long> createOrder(@RequestBody OrderCmd cmd) {
        UserDTO user = userService.getById(cmd.getUserId());
        // ...
    }
}
```

## 六、@DubboService 参数

| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `version` | 版本号 | — |
| `group` | 分组 | — |
| `timeout` | 超时 ms | 1000 |
| `retries` | 重试次数 | 2 |
| `loadbalance` | 负载均衡 | random |
| `weight` | 权重 | 100 |
| `cluster` | 集群容错 | failover |
| `executes` | 并发限制 | — |
| `delay` | 延迟暴露 ms | 0 |

## 七、@DubboReference 参数

| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `version` | 目标版本 | — |
| `timeout` | 超时 ms | 1000 |
| `retries` | 重试 | 2 |
| `loadbalance` | 负载均衡 | random |
| `cluster` | 集群容错 | failover |
| `check` | 启动检查可用性 | true |
| `async` | 异步调用 | false |
| `lazy` | 延迟连接 | false |
| `injvm` | 优先本地调用 | true |

## 八、负载均衡

| 策略 | 说明 |
|------|------|
| `random` | 按权重随机（默认） |
| `roundrobin` | 按权重轮询 |
| `leastactive` | 最少活跃调用 |
| `consistenthash` | 一致性 Hash |
| `shortestresponse` | 最短响应时间 |

## 九、集群容错

| 策略 | 说明 |
|------|------|
| `failover` | 失败重试其他节点（默认） |
| `failfast` | 快速失败 |
| `failsafe` | 忽略异常 |
| `failback` | 后台记录补偿 |
| `forking` | 并行调用取第一个成功 |
| `broadcast` | 广播所有节点 |

## 十、版本与分组

```java
// Provider
@DubboService(version = "1.0.0", group = "stable")
public class UserServiceImplV1 { }

// Consumer 指定版本
@DubboReference(version = "1.0.0", group = "stable")
private UserService userService;
```

## 十一、异步调用

```java
@DubboReference(async = true)
private UserService userService;

public void process() {
    userService.getById(1001L);  // 立即返回
    FutureAdapter<UserDTO> future = RpcContext.getServiceContext().getFuture();
    // 做其他事...
    UserDTO result = future.get();  // 阻塞获取
}
```
