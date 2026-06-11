# Sentinel 使用指南

Sentinel 是阿里巴巴开源的流量治理组件，以流量为切入点，提供**流量控制、熔断降级、系统负载保护**等多种维度来保障微服务的稳定性。

> 适用版本：Sentinel 1.8.6 + Spring Cloud Alibaba 2021.0.6.0（Spring Boot 2.7.x）

## 一、核心概念

Sentinel 的核心理念是：**一切皆为资源（Resource）**。你需要保护什么，就把它定义为资源，然后围绕资源配置各种规则。

### 1.1 Resource（资源）

资源是 Sentinel 中最核心的概念，它可以是任何需要保护的东西——一段代码、一个方法、一个接口。

```java
// 把一段代码定义为资源
try (Entry entry = SphU.entry("resourceName")) {
    // 被保护的业务逻辑
    return doSomething();
} catch (BlockException e) {
    // 被限流/降级后的处理逻辑
    return "服务繁忙，请稍后再试";
}
```

在 Spring Cloud Alibaba 中，Controller 的每个 `@RequestMapping` 方法都会**自动**被定义为资源，你不需要手动调用 `SphU.entry()`。

### 1.2 Rule（规则）

规则定义了**如何保护资源**。围绕资源的实时状态（如 QPS、线程数、响应时间等），Sentinel 可以配置多种规则：

| 规则类型 | 说明 | 典型场景 |
|---------|------|---------|
| **FlowRule**（流控规则） | 根据 QPS 或线程数限制流量 | 防止突发流量冲垮服务 |
| **DegradeRule**（降级规则） | 根据响应时间或异常比例熔断 | 慢调用/异常过多时自动降级 |
| **ParamFlowRule**（热点规则） | 对 frequent 参数值单独限流 | 限制某个热门商品 ID 的访问频率 |
| **SystemRule**（系统规则） | 从系统整体 Load/CPU 维度保护 | 防止系统整体过载 |
| **AuthorityRule**（授权规则） | 根据调用来源（origin）黑白名单控制 | 限制特定来源的调用 |

### 1.3 Entry（入口）

`Entry` 是 Sentinel 中表示"一次资源调用"的对象。当你调用 `SphU.entry("resourceName")` 时，Sentinel 会检查该资源的所有规则，判断是否放行。如果被拦截，会抛出 `BlockException`。

```java
// 一个 Entry 就代表一次资源调用
try (Entry entry = SphU.entry("getUserById")) {
    // 规则检查通过，执行正常逻辑
    return userService.getById(id);
} catch (BlockException e) {
    // 规则检查不通过，执行降级逻辑
    return Result.error("请求过于频繁");
}
```

### 1.4 工作原理

```text
请求进入 → 构建 Entry（SphU.entry）
                    ↓
          Sentinel 责任链逐个检查规则
                    ↓
          ┌─ 所有规则通过 → 执行业务逻辑
          │
          └─ 某规则拦截 → 抛出 BlockException → 执行降级处理
```

---

## 二、快速集成

### 2.1 Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```

::: tip 版本说明
`spring-cloud-starter-alibaba-sentinel` 的版本由 `spring-cloud-alibaba-dependencies`（2021.0.6.0）统一管理，无需手动指定。
:::

### 2.2 bootstrap.yml 配置

```yaml
spring:
  application:
    name: order-service
  cloud:
    sentinel:
      # 是否启用 Sentinel。默认 true
      enabled: true
      # Sentinel 控制台地址
      transport:
        dashboard: 127.0.0.1:8080
        # 与控制台通信的端口（默认 8719），会被控制台用来获取监控数据
        port: 8719
      # 取消控制台懒加载（默认 true，即首次访问时才创建客户端连接）
      eager: true
      # Sentinel 数据源配置（从 Nacos 拉取规则）
      datasource:
        ds1:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: order-service-flow-rules
            group-id: DEFAULT_GROUP
            data-type: json
            rule-type: flow
```

### 2.3 启动后验证

启动应用后，访问任意 Controller 接口，然后打开 Sentinel 控制台 `http://127.0.0.1:8080`，即可看到 `order-service` 出现在服务列表中。

::: warning 常见问题
如果控制台看不到服务，请检查：
1. `spring.cloud.sentinel.transport.dashboard` 地址是否正确
2. 控制台和应用的网络是否互通
3. 是否先调用了一次接口（触发 Sentinel 客户端初始化）
4. 如果设置了 `eager: true`，则无需先调用接口
:::

---

## 三、流控规则（Flow Control）

流控规则是 Sentinel 最核心的功能，用于控制资源的调用频率。

### 3.1 核心参数

| 参数 | 说明 | 可选值 |
|------|------|-------|
| `resource` | 资源名（通常是 URL 路径） | — |
| `grade` | 限流阈值类型 | `FLOW_GRADE_QPS`（QPS）、`FLOW_GRADE_THREAD`（线程数） |
| `count` | 限流阈值 | 数字 |
| `strategy` | 调用关系限流策略 | `STRATEGY_DIRECT`（直接）、`STRATEGY_RELATE`（关联）、`STRATEGY_CHAIN`（链路） |
| `controlBehavior` | 流控效果 | `CONTROL_BEHAVIOR_DEFAULT`（快速失败）、`CONTROL_BEHAVIOR_WARM_UP`（预热）、`CONTROL_BEHAVIOR_RATE_LIMITER`（排队等待） |
| `limitApp` | 针对调用来源 | `default`（不区分来源） |

### 3.2 QPS 限流（快速失败）

当 QPS 超过阈值时，直接拒绝新请求，抛出 `FlowException`。

**控制台配置示例：**

| 配置项 | 值 |
|--------|-----|
| 资源名 | `/order/create` |
| 阈值类型 | QPS |
| QPS 阈值 | 10 |
| 流控模式 | 直接 |
| 流控效果 | 快速失败 |

**效果：** 当每秒请求数超过 10 时，多余的请求会被直接拒绝。

### 3.3 线程数限流

当处理该资源的线程数超过阈值时，拒绝新请求。

| 配置项 | 值 |
|--------|-----|
| 阈值类型 | 线程数 |
| 线程数阈值 | 5 |

**效果：** 同时处理该接口的线程数不超过 5 个，超过则拒绝。

::: tip QPS vs 线程数
- **QPS 限流**：适合大多数场景，统计的是"每秒进来的请求数"
- **线程数限流**：适合处理耗时不均匀的场景。比如有的请求 10ms 处理完，有的要 10s，QPS 限流可能让慢请求挤占所有线程
:::

### 3.4 Warm Up（预热/冷启动）

系统刚启动时，允许的 QPS 从 `count / coldFactor` 开始，逐渐增加到 `count`。防止系统在冷启动时被突然的流量冲垮。

**控制台配置：**

| 配置项 | 值 |
|--------|-----|
| 阈值类型 | QPS |
| QPS 阈值 | 100 |
| 流控效果 | Warm Up |
| 预热时长 | 10 秒 |

**效果：** 前 10 秒内，允许的 QPS 从 33（100/3）逐步增加到 100。

::: tip 预热原理
默认 `coldFactor = 3`，即初始阈值 = QPS 阈值 / 3。预热时长的曲线是平滑的，不是阶梯式。
:::

### 3.5 排队等待（Rate Limiter / 匀速器）

请求以固定的速率通过，多余的请求排队等待，而不是直接拒绝。等待超时后仍未被处理则拒绝。

**控制台配置：**

| 配置项 | 值 |
|--------|-----|
| 阈值类型 | QPS |
| QPS 阈值 | 10 |
| 流控效果 | 排队等待 |
| 超时时间 | 500 毫秒 |

**效果：** 请求以每 100ms 一个的匀速通过。如果某个请求预计要等超过 500ms，则直接拒绝。

::: tip 排队等待 vs 快速失败
- **快速失败**：超过阈值直接拒绝，适合对响应时间敏感的场景
- **排队等待**：适合处理突发流量，如秒杀场景，让请求排队而不是直接拒绝
:::

### 3.6 关联模式（关联流控）

当**关联资源**达到阈值时，限流**当前资源**。适用于资源之间具有依赖或争抢关系的场景。

**场景：** 两个接口 `/order/query`（查询）和 `/order/create`（写入）共享数据库连接池。当写入操作繁忙时，限制查询操作，保证写入优先。

**控制台配置：**

| 配置项 | 值 |
|--------|-----|
| 资源名 | `/order/query` |
| 阈值类型 | QPS |
| QPS 阈值 | 100 |
| 流控模式 | 关联 |
| 关联资源 | `/order/create` |

**效果：** 当 `/order/create` 的 QPS 超过 100 时，`/order/query` 被限流。

### 3.7 链路模式（链路流控）

只记录**指定入口**的流量，而不是所有入口的流量总和。

**场景：** 一个 Service 方法 `getUserById()` 被两个 Controller 调用——`/user/info` 和 `/admin/user/info`。你想限制管理后台的调用频率，但不影响普通用户。

**控制台配置：**

| 配置项 | 值 |
|--------|-----|
| 资源名 | `getUserById` |
| 入口资源 | `/admin/user/info` |
| 流控模式 | 链路 |
| 阈值类型 | QPS |
| QPS 阈值 | 5 |

**效果：** 只有从 `/admin/user/info` 进来的调用才被统计和限流，从 `/user/info` 进来的不受影响。

### 3.8 代码方式配置流控规则

除了 Sentinel 控制台，也可以在代码中硬编码规则：

```java
@PostConstruct
public void initFlowRules() {
    List<FlowRule> rules = new ArrayList<>();

    FlowRule rule = new FlowRule();
    rule.setResource("getUserById");         // 资源名
    rule.setGrade(RuleConstant.FLOW_GRADE_QPS); // QPS 限流
    rule.setCount(10);                       // 阈值 10
    rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_DEFAULT); // 快速失败
    rules.add(rule);

    FlowRuleManager.loadRules(rules);
}
```

::: warning 代码方式 vs 控制台
代码方式配置的规则**不会**同步到 Sentinel 控制台，且重启后需要重新加载。生产环境推荐使用控制台 + Nacos 持久化方式。
:::

---

## 四、熔断降级（Circuit Breaking）

熔断降级用于在**服务调用出现不稳定**时（如慢调用增多、异常比例升高），暂时切断对该资源的调用，快速失败，避免级联故障。

### 4.1 核心参数

| 参数 | 说明 | 可选值 |
|------|------|-------|
| `resource` | 资源名 | — |
| `grade` | 熔断策略 | `DEGRADE_GRADE_RT`（慢调用比例）、`DEGRADE_GRADE_EXCEPTION_RATIO`（异常比例）、`DEGRADE_GRADE_EXCEPTION_COUNT`（异常数） |
| `count` | 阈值 | 慢调用最大 RT（毫秒）/ 异常比例（0~1）/ 异常数 |
| `timeWindow` | 熔断时长（秒） | 熔断触发后，多久之后尝试恢复 |
| `minRequestAmount` | 最小请求数 | 统计窗口内至少有多少请求才触发熔断 |
| `statIntervalMs` | 统计时长（毫秒） | 默认 1000ms |
| `slowRatioThreshold` | 慢调用比例阈值 | 仅 `DEGRADE_GRADE_RT` 策略使用 |

### 4.2 慢调用比例（Slow Call Ratio）

当统计窗口内，请求数达到 `minRequestAmount`，且**慢调用比例**超过 `slowRatioThreshold` 时，触发熔断。

**控制台配置：**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 资源名 | `/order/create` | — |
| 熔断策略 | 慢调用比例 | — |
| 最大 RT | 200ms | 响应时间超过此值即为"慢调用" |
| 比例阈值 | 0.5 | 50% 的请求是慢调用时触发熔断 |
| 熔断时长 | 10s | 熔断 10 秒后尝试恢复 |
| 最小请求数 | 5 | 至少 5 个请求才统计 |
| 统计时长 | 1000ms | 每秒统计一次 |

**效果：** 每秒统计一次，如果请求数 ≥ 5 且超过 50% 的请求响应时间 > 200ms，则触发熔断，10 秒内所有请求快速失败。10 秒后进入"半开"状态，放行一个请求探测，如果恢复正常则关闭熔断。

### 4.3 异常比例（Exception Ratio）

当统计窗口内，请求数达到 `minRequestAmount`，且**异常比例**超过阈值时，触发熔断。

**控制台配置：**

| 配置项 | 值 |
|--------|-----|
| 熔断策略 | 异常比例 |
| 异常比例阈值 | 0.5 |
| 熔断时长 | 10s |
| 最小请求数 | 5 |

**效果：** 每秒统计一次，如果请求数 ≥ 5 且超过 50% 的请求抛出异常，则触发熔断。

### 4.4 异常数（Exception Count）

当统计窗口内，**异常数量**超过阈值时，触发熔断。

**控制台配置：**

| 配置项 | 值 |
|--------|-----|
| 熔断策略 | 异常数 |
| 异常数阈值 | 5 |
| 熔断时长 | 10s |
| 最小请求数 | 5 |

**效果：** 每分钟统计一次（注意：异常数策略的统计窗口是**分钟级**），如果请求数 ≥ 5 且异常数 ≥ 5，则触发熔断。

### 4.5 三种熔断策略对比

| 策略 | 统计维度 | 适用场景 |
|------|---------|---------|
| 慢调用比例 | 响应时间 | 发现下游服务变慢时自动熔断，防止线程堆积 |
| 异常比例 | 异常占比 | 下游服务间歇性故障，按比例熔断 |
| 异常数 | 异常绝对数 | 对异常敏感，少量异常就熔断 |

### 4.6 熔断状态机

```text
         ┌──────────┐
         │  CLOSED  │ ← 正常状态，所有请求通过
         └─────┬────┘
               │ 触发条件满足（慢调用/异常比例/异常数超阈值）
               ▼
         ┌──────────┐
         │   OPEN   │ ← 熔断状态，所有请求快速失败
         └─────┬────┘
               │ 经过 timeWindow 时间
               ▼
         ┌──────────┐
         │ HALF_OPEN │ ← 半开状态，放行一个请求探测
         └─────┬────┘
               │
      ┌────────┴────────┐
      │ 探测成功         │ 探测失败
      ▼                  ▼
  CLOSED              OPEN（重新计时）
```

### 4.7 代码方式配置降级规则

```java
@PostConstruct
public void initDegradeRules() {
    List<DegradeRule> rules = new ArrayList<>();

    DegradeRule rule = new DegradeRule();
    rule.setResource("getUserById");
    // 慢调用比例策略
    rule.setGrade(RuleConstant.DEGRADE_GRADE_RT);
    // 最大 RT 200ms
    rule.setCount(200);
    // 慢调用比例阈值 0.5
    rule.setSlowRatioThreshold(0.5);
    // 熔断 10 秒
    rule.setTimeWindow(10);
    // 最小请求数 5
    rule.setMinRequestAmount(5);
    // 统计时长 1 秒
    rule.setStatIntervalMs(1000);
    rules.add(rule);

    DegradeRuleManager.loadRules(rules);
}
```

---

## 五、热点参数限流（Hotspot Parameter Flow Control）

热点参数限流会对**频繁访问的参数值**进行更精细的限流。例如，你有一个 `/goods/detail?id=100` 接口，其中商品 ID `100` 是热门商品，你想对它的访问频率单独限制。

### 5.1 核心参数

| 参数 | 说明 |
|------|------|
| `resource` | 资源名 |
| `paramIdx` | 参数索引（从 0 开始），标识哪个参数是热点参数 |
| `grade` | 限流类型（QPS） |
| `count` | 阈值 |
| `durationInSec` | 统计窗口时长（秒） |
| `paramFlowItemList` | 特定参数值的特殊阈值（可覆盖全局阈值） |

### 5.2 控制台配置

**场景：** `/goods/detail` 接口，第一个参数是商品 ID。默认 QPS 限制为 50，但热门商品 ID `100` 和 `200` 限制为 5。

| 配置项 | 值 |
|--------|-----|
| 资源名 | `/goods/detail` |
| 限流模式 | QPS |
| 参数索引 | 0（第一个参数） |
| 单机阈值 | 50 |
| 统计窗口时长 | 1 |
| 参数例外项 | `100` → 5, `200` → 5 |

**效果：** 商品 ID `100` 和 `200` 的 QPS 上限为 5，其他商品 ID 的 QPS 上限为 50。

### 5.3 代码方式配置

```java
@PostConstruct
public void initParamFlowRules() {
    List<ParamFlowRule> rules = new ArrayList<>();

    ParamFlowRule rule = new ParamFlowRule();
    rule.setResource("getGoodsDetail");
    // 参数索引 0（第一个参数）
    rule.setParamIdx(0);
    // 默认 QPS 阈值
    rule.setCount(50);
    // 1 秒统计窗口
    rule.setDurationInSec(1);

    // 特定参数值的特殊阈值
    ParamFlowItem item1 = new ParamFlowItem();
    item1.setObject("100");  // 商品 ID 100
    item1.setClassType(String.class.getName());
    item1.setCount(5);       // 限制为 5

    ParamFlowItem item2 = new ParamFlowItem();
    item2.setObject("200");
    item2.setClassType(String.class.getName());
    item2.setCount(5);

    rule.setParamFlowItemList(Arrays.asList(item1, item2));
    rules.add(rule);

    ParamFlowRuleManager.loadRules(rules);
}
```

::: warning 热点参数限流必须配合 @SentinelResource 使用
热点参数限流**不会自动生效于 Controller 方法**。你需要使用 `@SentinelResource` 注解来标记资源，否则 Sentinel 无法知道哪个参数是热点参数。详见 [七、@SentinelResource 注解](#七、sentinelresource-注解)。
:::

---

## 六、系统自适应保护（System Adaptive Protection）

系统规则从**系统整体负载**维度进行保护，防止系统被拖垮。与流控规则不同，系统规则不针对具体资源，而是从入口流量整体控制。

### 6.1 核心参数

| 参数 | 说明 | 适用场景 |
|------|------|---------|
| `highestSystemLoad` | 系统最大 Load（仅 Linux/Unix） | 防止 CPU 过载 |
| `highestCpuUsage` | 系统最大 CPU 使用率（0~1） | 防止 CPU 过载 |
| `avgRt` | 所有入口流量的平均 RT（毫秒） | 防止慢请求堆积 |
| `maxThread` | 所有入口流量的最大并行线程数 | 防止线程池耗尽 |
| `qps` | 所有入口流量的最大 QPS | 流量兜底保护 |

### 6.2 控制台配置

**场景：** 保护系统整体不被过载，配置多层防线。

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Load | 2.0 | 系统 Load 超过 2.0 时触发保护 |
| CPU 使用率 | 0.7 | CPU 使用率超过 70% 时触发保护 |
| 平均 RT | 100ms | 平均响应时间超过 100ms 时触发保护 |
| 线程数 | 200 | 并发线程数超过 200 时触发保护 |
| 入口 QPS | 1000 | 总 QPS 超过 1000 时触发保护 |

::: tip 系统规则触发条件
系统规则**不是"全部满足"才触发，而是"任一满足"就触发**。也就是说，只要 Load 超过 2.0 **或者** CPU 超过 70% **或者** 平均 RT 超过 100ms，都会触发保护。
:::

### 6.3 代码方式配置

```java
@PostConstruct
public void initSystemRules() {
    List<SystemRule> rules = new ArrayList<>();

    SystemRule rule = new SystemRule();
    // 系统最大 Load
    rule.setHighestSystemLoad(2.0);
    // 最大 CPU 使用率
    rule.setHighestCpuUsage(0.7);
    // 平均 RT
    rule.setAvgRt(100);
    // 最大线程数
    rule.setMaxThread(200);
    // 入口 QPS
    rule.setQps(1000);
    rules.add(rule);

    SystemRuleManager.loadRules(rules);
}
```

---

## 七、@SentinelResource 注解

`@SentinelResource` 是 Sentinel 提供的最核心注解，用于**定义资源、配置降级处理和异常处理**。它比自动资源定义（Controller 方法）更灵活，可以用于任意方法。

### 7.1 注解参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | String | 资源名称（必填） |
| `entryType` | EntryType | 入口类型（`IN` 入站 / `OUT` 出站），默认 `OUT` |
| `blockHandler` | String | 处理 `BlockException` 的方法名（必须在同一个类中） |
| `blockHandlerClass` | Class<?> | `blockHandler` 方法所在的类（默认本类） |
| `fallback` | String | 处理**所有异常**（包括业务异常）的方法名 |
| `fallbackClass` | Class<?> | `fallback` 方法所在的类（默认本类） |
| `defaultFallback` | String | 默认的 fallback 方法名（当未指定 `fallback` 时生效） |
| `exceptionsToIgnore` | Class<? extends Throwable>[] | 需要**忽略**的异常类型（不触发 fallback） |
| `exceptionsToTrace` | Class<? extends Throwable>[] | 需要**追踪**的异常类型 |

### 7.2 blockHandler vs fallback

::: tip 关键区别
- **blockHandler**：只处理 `BlockException`（被 Sentinel 规则拦截），**不处理业务异常**
- **fallback**：处理**所有异常**（包括 `BlockException` 和业务异常），范围更大
- 如果同时配置了 `blockHandler` 和 `fallback`，`BlockException` 优先走 `blockHandler`，其他异常走 `fallback`
:::

### 7.3 blockHandler 示例

```java
@RestController
public class OrderController {

    @GetMapping("/order/{id}")
    @SentinelResource(
        value = "getOrderById",
        blockHandler = "handleBlock",
        blockHandlerClass = BlockHandlerClass.class
    )
    public Result<Order> getOrderById(@PathVariable Long id) {
        // 正常业务逻辑
        return Result.success(orderService.getById(id));
    }
}

// BlockHandler 处理方法（独立类）
public class BlockHandlerClass {

    // 方法签名要求：返回值、参数列表必须和原方法一致，最后多一个 BlockException 参数
    // 方法必须是 static 的
    public static Result<Order> handleBlock(Long id, BlockException e) {
        log.warn("被限流或降级: id={}, rule={}", id, e.getRule());
        return Result.error("系统繁忙，请稍后再试");
    }
}
```

### 7.4 fallback 示例

```java
@RestController
public class OrderController {

    @GetMapping("/order/{id}")
    @SentinelResource(
        value = "getOrderById",
        fallback = "handleFallback",
        fallbackClass = FallbackHandlerClass.class
    )
    public Result<Order> getOrderById(@PathVariable Long id) {
        // 可能抛出业务异常
        if (id <= 0) {
            throw new IllegalArgumentException("无效的商品 ID");
        }
        return Result.success(orderService.getById(id));
    }
}

public class FallbackHandlerClass {

    // 方法签名：返回值、参数列表必须和原方法一致，最后可以加一个 Throwable 参数
    // 方法必须是 static 的
    public static Result<Order> handleFallback(Long id, Throwable e) {
        log.error("业务处理异常: id={}", id, e);
        return Result.error("服务异常，请稍后再试");
    }
}
```

### 7.5 blockHandler + fallback 同时使用

```java
@RestController
public class OrderController {

    @GetMapping("/order/{id}")
    @SentinelResource(
        value = "getOrderById",
        blockHandler = "handleBlock",
        fallback = "handleFallback"
    )
    public Result<Order> getOrderById(@PathVariable Long id) {
        // 正常业务逻辑
        return Result.success(orderService.getById(id));
    }

    // 被 Sentinel 限流/降级 → 走 blockHandler
    public Result<Order> handleBlock(Long id, BlockException e) {
        return Result.error("流量过大，请稍后再试");
    }

    // 业务异常（如数据库异常）→ 走 fallback
    public Result<Order> handleFallback(Long id, Throwable e) {
        log.error("getOrderById 异常: id={}", id, e);
        return Result.error("服务异常，请稍后再试");
    }
}
```

### 7.6 exceptionsToIgnore

某些业务异常你希望**原样抛出**而不是被 fallback 吞掉：

```java
@SentinelResource(
    value = "getOrderById",
    fallback = "handleFallback",
    // IllegalArgumentException 不会被 fallback 处理，会原样抛出
    exceptionsToIgnore = {IllegalArgumentException.class}
)
public Result<Order> getOrderById(@PathVariable Long id) {
    if (id <= 0) {
        throw new IllegalArgumentException("ID 不能为负数"); // 这个异常不会被 fallback 吞掉
    }
    return Result.success(orderService.getById(id));
}
```

### 7.7 defaultFallback

当多个方法需要相同的降级逻辑时，可以定义一个全局 fallback：

```java
@RestController
public class OrderController {

    @GetMapping("/order/{id}")
    @SentinelResource(value = "getOrderById", defaultFallback = "globalFallback")
    public Result<Order> getOrderById(@PathVariable Long id) {
        return Result.success(orderService.getById(id));
    }

    @GetMapping("/order/list")
    @SentinelResource(value = "listOrders", defaultFallback = "globalFallback")
    public Result<List<Order>> listOrders() {
        return Result.success(orderService.listAll());
    }

    // 全局 fallback 方法
    // 注意：defaultFallback 方法的参数列表必须为空（除了可选的 Throwable）
    public Result<?> globalFallback(Throwable e) {
        log.error("全局降级处理", e);
        return Result.error("服务暂时不可用");
    }
}
```

### 7.8 blockHandler / fallback 方法签名规则

| 场景 | 参数要求 |
|------|---------|
| blockHandler（本类） | 参数 = 原方法参数 + `BlockException` |
| blockHandler（指定类） | 参数 = 原方法参数 + `BlockException`，方法必须是 `static` |
| fallback（本类） | 参数 = 原方法参数（可选 `Throwable`） |
| fallback（指定类） | 参数 = 原方法参数（可选 `Throwable`），方法必须是 `static` |
| defaultFallback | 参数 = 空（可选 `Throwable`），返回值必须兼容 |

---

## 八、Feign 集成 Sentinel 熔断

OpenFeign 集成 Sentinel 后，当被调用的服务不可用或响应过慢时，自动触发熔断降级。

### 8.1 开启 Feign Sentinel 支持

```yaml
spring:
  cloud:
    sentinel:
      enabled: true
feign:
  sentinel:
    # 开启 Feign 对 Sentinel 的支持（默认 false）
    enabled: true
```

### 8.2 Feign 接口定义 fallback

```java
@FeignClient(
    name = "user-service",
    url = "http://localhost:8081",
    fallback = UserServiceFallback.class   // 熔断后调用此实现类
)
public interface UserServiceClient {

    @GetMapping("/user/{id}")
    Result<UserDTO> getUserById(@PathVariable("id") Long id);
}
```

```java
@Component
public class UserServiceFallback implements UserServiceClient {

    @Override
    public Result<UserDTO> getUserById(Long id) {
        // 降级逻辑：返回兜底数据
        log.warn("user-service 调用失败，执行降级: userId={}", id);
        return Result.error("用户服务暂时不可用");
    }
}
```

### 8.3 Feign fallbackFactory（推荐）

`fallbackFactory` 可以获取到调用失败的原因，比 `fallback` 更灵活：

```java
@FeignClient(
    name = "user-service",
    url = "http://localhost:8081",
    fallbackFactory = UserServiceFallbackFactory.class
)
public interface UserServiceClient {

    @GetMapping("/user/{id}")
    Result<UserDTO> getUserById(@PathVariable("id") Long id);
}
```

```java
@Component
@Slf4j
public class UserServiceFallbackFactory implements FallbackFactory<UserServiceClient> {

    @Override
    public UserServiceClient create(Throwable cause) {
        // 记录异常信息，便于排查问题
        log.error("user-service 调用失败，触发熔断", cause);

        return new UserServiceClient() {
            @Override
            public Result<UserDTO> getUserById(Long id) {
                // 可以根据不同的异常类型做不同的降级处理
                if (cause instanceof DegradeException) {
                    return Result.error("用户服务已熔断，请稍后重试");
                }
                if (cause instanceof FlowException) {
                    return Result.error("用户服务流量过大，请稍后重试");
                }
                return Result.error("用户服务不可用");
            }
        };
    }
}
```

::: tip fallback vs fallbackFactory
- `fallback`：简单，但无法获取失败原因
- `fallbackFactory`：可以获取 `Throwable`，根据异常类型做差异化降级处理，**推荐使用**
:::

### 8.4 Feign 全局降级配置

如果不想在每个 `@FeignClient` 上单独配置，可以通过配置文件统一指定：

```yaml
feign:
  sentinel:
    enabled: true
  circuitbreaker:
    enabled: true
  client:
    config:
      default:
        connectTimeout: 5000
        readTimeout: 10000
```

---

## 九、Sentinel 控制台（Dashboard）

Sentinel 控制台是一个独立的 Web 应用，提供**规则管理、实时监控、机器发现**等功能。

### 9.1 下载与启动

```bash
# 下载 Sentinel Dashboard JAR
wget https://github.com/alibaba/Sentinel/releases/download/1.8.6/sentinel-dashboard-1.8.6.jar

# 启动（默认端口 8080，用户名/密码均为 sentinel）
java -Dserver.port=8080 \
     -Dsentinel.dashboard.auth.username=sentinel \
     -Dsentinel.dashboard.auth.password=sentinel \
     -jar sentinel-dashboard-1.8.6.jar
```

::: tip 启动参数说明
| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `-Dserver.port` | 控制台端口 | 8080 |
| `-Dsentinel.dashboard.auth.username` | 登录用户名 | sentinel |
| `-Dsentinel.dashboard.auth.password` | 登录密码 | sentinel |
| `-Dcsp.sentinel.dashboard.server` | 控制台自身地址 | localhost:8080 |
:::

### 9.2 接入应用

应用通过 `bootstrap.yml` 配置连接到控制台：

```yaml
spring:
  cloud:
    sentinel:
      transport:
        # 控制台地址
        dashboard: 127.0.0.1:8080
        # 与控制台通信的端口（应用会起一个 HTTP Server 供控制台拉取数据）
        port: 8719
      # 取消懒加载，启动时立即注册到控制台
      eager: true
```

### 9.3 控制台功能概览

| 功能 | 说明 |
|------|------|
| **实时监控** | 查看每个资源的 QPS、响应时间、通过/拒绝请求数 |
| **簇点链路** | 展示所有资源的调用链路树 |
| **流控规则** | 管理 QPS/线程数限流规则 |
| **降级规则** | 管理熔断降级规则 |
| **热点规则** | 管理热点参数限流规则 |
| **系统规则** | 管理系统保护规则 |
| **授权规则** | 管理黑白名单规则 |
| **机器列表** | 查看接入的应用实例 |

### 9.4 访问控制台

启动后访问 `http://localhost:8080`，使用 `sentinel/sentinel` 登录。

::: warning 控制台是内存存储
**默认情况下，Sentinel 控制台将规则存储在内存中**。重启控制台后，所有规则会丢失。生产环境必须将规则持久化到 Nacos 等外部存储。
:::

---

## 十、规则持久化到 Nacos

默认情况下，Sentinel 控制台添加的规则存储在内存中，应用和控制台重启后都会丢失。通过将规则推送到 Nacos，可以实现规则的持久化存储和动态更新。

### 10.1 工作原理

```text
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Sentinel     │───▶│   Nacos      │◀───│  Sentinel    │
│ Dashboard    │    │  Config      │    │  Client      │
│ (控制台)      │    │  (配置中心)   │    │  (应用)       │
└──────────────┘    └──────────────┘    └──────────────┘
     写入规则             持久化存储           监听并加载规则
```

### 10.2 应用端配置（Nacos 数据源）

在 `bootstrap.yml` 中配置 Nacos 作为 Sentinel 规则的数据源：

```yaml
spring:
  application:
    name: order-service
  cloud:
    sentinel:
      transport:
        dashboard: 127.0.0.1:8080
        port: 8719
      eager: true
      # 配置 Nacos 数据源
      datasource:
        # 流控规则数据源
        flow:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-flow-rules
            data-type: json
            rule-type: flow
        # 降级规则数据源
        degrade:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-degrade-rules
            data-type: json
            rule-type: degrade
        # 系统规则数据源
        system:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-system-rules
            data-type: json
            rule-type: system
        # 授权规则数据源
        authority:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-authority-rules
            data-type: json
            rule-type: authority
        # 热点参数规则数据源
        param-flow:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-param-flow-rules
            data-type: json
            rule-type: param-flow
```

### 10.3 Nacos 中创建规则

在 Nacos 控制台创建配置，Data ID 为 `order-service-flow-rules`，内容为 JSON 格式的流控规则数组：

```json
[
    {
        "resource": "/order/create",
        "limitApp": "default",
        "grade": 1,
        "count": 10,
        "strategy": 0,
        "controlBehavior": 0
    },
    {
        "resource": "/order/query",
        "limitApp": "default",
        "grade": 1,
        "count": 100,
        "strategy": 0,
        "controlBehavior": 0
    }
]
```

### 10.4 规则字段说明

| 字段 | 类型 | 说明 | 可选值 |
|------|------|------|-------|
| `resource` | String | 资源名 | — |
| `grade` | int | 限流阈值类型 | `0`（线程数）、`1`（QPS） |
| `count` | double | 阈值 | — |
| `strategy` | int | 流控模式 | `0`（直接）、`1`（关联）、`2`（链路） |
| `controlBehavior` | int | 流控效果 | `0`（快速失败）、`1`（Warm Up）、`2`（排队等待） |
| `warmUpPeriodSec` | int | 预热时长（秒） | 仅 Warm Up 模式 |
| `maxQueueingTimeMs` | int | 排队等待超时（毫秒） | 仅排队等待模式 |
| `limitApp` | String | 调用来源 | `default`（不区分） |
| `refResource` | String | 关联资源 | 仅关联模式 |

### 10.5 降级规则 JSON 格式

```json
[
    {
        "resource": "/order/create",
        "grade": 0,
        "count": 200,
        "timeWindow": 10,
        "minRequestAmount": 5,
        "statIntervalMs": 1000,
        "slowRatioThreshold": 0.5
    }
]
```

`grade` 取值：`0`（慢调用比例）、`1`（异常比例）、`2`（异常数）。

### 10.6 改造 Dashboard 实现双向同步

::: danger 默认限制
Sentinel Dashboard 默认将规则写入应用**内存**，不会自动写入 Nacos。要实现"控制台写规则 → Nacos 持久化 → 所有应用实例同步"，需要改造 Dashboard 源码。
:::

#### 改造原理

```text
改造前：Dashboard ──写入──▶ 应用内存（单实例，重启丢失）

改造后：Dashboard ──写入──▶ Nacos Config ──监听──▶ 所有应用实例同步
```

#### 步骤一：下载并导入 Dashboard 源码

```bash
# 下载 Sentinel 1.8.6 源码
git clone https://github.com/alibaba/Sentinel.git
cd Sentinel
git checkout v1.8.6

# 将 sentinel-dashboard 模块导入 IDE
```

#### 步骤二：添加 Nacos 依赖

在 `sentinel-dashboard/pom.xml` 中添加：

```xml
<dependency>
    <groupId>com.alibaba.nacos</groupId>
    <artifactId>nacos-client</artifactId>
    <version>2.2.4</version>
</dependency>
```

#### 步骤三：创建 Nacos 配置推送工具类

```java
// sentinel-dashboard/src/main/java/com/alibaba/csp/sentinel/dashboard/rule/nacos/NacosConfigUtil.java
public final class NacosConfigUtil {

    public static final String GROUP_ID = "DEFAULT_GROUP";

    // 以下四个 Data ID 后缀与 bootstrap.yml 中配置的 rule-type 对应
    public static final String FLOW_DATA_ID_POSTFIX = "-flow-rules";
    public static final String DEGRADE_DATA_ID_POSTFIX = "-degrade-rules";
    public static final String SYSTEM_DATA_ID_POSTFIX = "-system-rules";
    public static final String PARAM_FLOW_DATA_ID_POSTFIX = "-param-flow-rules";
    public static final String AUTHORITY_DATA_ID_POSTFIX = "-authority-rules";

    private NacosConfigUtil() {}
}
```

#### 步骤四：实现流控规则的 Nacos 读写

```java
// FlowRuleNacosProvider.java —— 从 Nacos 读取规则
@Component("flowRuleNacosProvider")
public class FlowRuleNacosProvider implements DynamicRuleProvider<List<FlowRuleEntity>> {

    @Autowired
    private ConfigService configService;

    @Override
    public List<FlowRuleEntity> getRules(String appName) throws Exception {
        String dataId = appName + NacosConfigUtil.FLOW_DATA_ID_POSTFIX;
        String rules = configService.getConfig(dataId, NacosConfigUtil.GROUP_ID, 3000);
        if (StringUtil.isEmpty(rules)) {
            return new ArrayList<>();
        }
        return JSON.parseArray(rules, FlowRuleEntity.class);
    }
}
```

```java
// FlowRuleNacosPublisher.java —— 将规则写入 Nacos
@Component("flowRuleNacosPublisher")
public class FlowRuleNacosPublisher implements DynamicRulePublisher<List<FlowRuleEntity>> {

    @Autowired
    private ConfigService configService;

    @Override
    public void publish(String appName, List<FlowRuleEntity> rules) throws Exception {
        String dataId = appName + NacosConfigUtil.FLOW_DATA_ID_POSTFIX;
        configService.publishConfig(dataId, NacosConfigUtil.GROUP_ID,
                JSON.toJSONString(rules));
    }
}
```

#### 步骤五：替换默认 Controller 的规则读写逻辑

修改 `FlowControllerV2`（或创建新的 Controller），将原来写入内存的代码替换为调用 Nacos Provider/Publisher：

```java
@RestController
@RequestMapping("/v2/flow")
public class FlowControllerV2 {

    @Autowired
    @Qualifier("flowRuleNacosProvider")
    private DynamicRuleProvider<List<FlowRuleEntity>> ruleProvider;

    @Autowired
    @Qualifier("flowRuleNacosPublisher")
    private DynamicRulePublisher<List<FlowRuleEntity>> rulePublisher;

    @GetMapping("/rules")
    public Result<List<FlowRuleEntity>> apiQueryRules(@RequestParam String app) {
        try {
            List<FlowRuleEntity> rules = ruleProvider.getRules(app);
            return Result.ofSuccess(rules);
        } catch (Exception e) {
            return Result.ofThrowable(-1, e);
        }
    }

    @PostMapping("/rule")
    public Result<FlowRuleEntity> apiAddRule(@RequestBody FlowRuleEntity entity) {
        // ... 校验、添加到列表 ...
        try {
            rulePublisher.publish(entity.getApp(), rules);
            return Result.ofSuccess(entity);
        } catch (Exception e) {
            return Result.ofThrowable(-1, e);
        }
    }
}
```

#### 步骤六：Nacos 配置注入

在 `application.properties` 中配置 Nacos 地址：

```properties
# sentinel-dashboard/src/main/resources/application.properties
nacos.server-addr=127.0.0.1:8848
nacos.namespace=
```

创建 ConfigService Bean：

```java
@Configuration
public class NacosConfig {

    @Value("${nacos.server-addr}")
    private String serverAddr;

    @Value("${nacos.namespace:}")
    private String namespace;

    @Bean
    public ConfigService configService() throws Exception {
        Properties properties = new Properties();
        properties.put("serverAddr", serverAddr);
        if (StringUtils.isNotBlank(namespace)) {
            properties.put("namespace", namespace);
        }
        return ConfigFactory.createConfigService(properties);
    }
}
```

::: tip 降级/系统/热点/授权规则同理
以上示例以流控规则为例，其他规则类型（降级、系统、热点、授权）的改造方式完全相同，只需要替换对应的 Data ID 后缀和实体类即可。
:::

#### 简化方案（无需改造源码）

如果不想改造 Dashboard，可以采用以下简化方案：

1. **在 Nacos 控制台手动编辑规则**：直接在 Nacos 中创建 JSON 格式的规则配置
2. **应用端通过 datasource 配置监听 Nacos**：使用 10.2 节的配置方式
3. **Dashboard 仅用于监控**：使用 Dashboard 查看实时监控数据，不通过 Dashboard 管理规则

> 简化方案适用于开发/测试环境。生产环境建议改造 Dashboard 实现完整的规则管理闭环。

---

## 十一、Gateway 网关流控

Spring Cloud Gateway 也支持集成 Sentinel 进行网关层面的流量控制。

### 11.1 Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-alibaba-sentinel-gateway</artifactId>
</dependency>
```

::: warning 注意
`spring-cloud-alibaba-sentinel-gateway` 需要和 `spring-cloud-starter-alibaba-sentinel` 配合使用，前者提供网关专用的流控能力。
:::

### 11.2 Gateway 配置

```yaml
spring:
  application:
    name: api-gateway
  cloud:
    sentinel:
      transport:
        dashboard: 127.0.0.1:8080
        port: 8719
      eager: true
      # Gateway 流控数据源
      datasource:
        gw-flow:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: api-gateway-flow-rules
            group-id: DEFAULT_GROUP
            data-type: json
            rule-type: gw-flow
        # API 分组数据源
        gw-api-group:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: api-gateway-api-groups
            group-id: DEFAULT_GROUP
            data-type: json
            rule-type: gw-api-group
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/order/**
```

### 11.3 Gateway 流控规则 JSON

```json
[
    {
        "resource": "order-service",
        "resourceMode": 0,
        "count": 10,
        "grade": 1,
        "intervalSec": 1,
        "controlBehavior": 0,
        "burst": 0
    },
    {
        "resource": "user-api",
        "resourceMode": 1,
        "count": 100,
        "grade": 1,
        "intervalSec": 1,
        "controlBehavior": 0
    }
]
```

| 字段 | 说明 |
|------|------|
| `resource` | 资源名（路由 ID 或 API 分组名） |
| `resourceMode` | `0`（路由 ID 模式）、`1`（API 分组模式） |
| `count` | 阈值 |
| `grade` | `0`（线程数）、`1`（QPS） |
| `intervalSec` | 统计窗口（秒） |
| `controlBehavior` | `0`（快速失败）、`1`（Warm Up）、`2`（排队等待） |
| `burst` | 应对突发请求时额外允许的请求数 |

### 11.4 自定义 Gateway 限流异常处理

```java
@Configuration
public class GatewaySentinelConfig {

    @PostConstruct
    public void initBlockHandlers() {
        // 自定义限流响应
        BlockRequestHandler blockRequestHandler = (exchange, t) -> {
            Map<String, Object> result = new HashMap<>();
            result.put("code", 429);
            result.put("message", "请求过于频繁，请稍后重试");
            return ServerResponse.status(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body(BodyInserters.fromValue(result));
        };
        GatewayCallbackManager.setBlockHandler(blockRequestHandler);
    }
}
```

---

## 十二、完整 YAML 配置参考

```yaml
spring:
  application:
    name: order-service
  cloud:
    sentinel:
      # ========== 基础配置 ==========
      # 是否启用 Sentinel（默认 true）
      enabled: true
      # 是否取消控制台懒加载（默认 false）
      eager: true
      # 过滤器执行顺序（默认 Ordered.LOWEST_PRECEDENCE）
      filter:
        order: -2147483647

      # ========== 控制台通信 ==========
      transport:
        # 控制台地址
        dashboard: 127.0.0.1:8080
        # 与控制台通信的端口（默认 8719）
        port: 8719
        # 本机 IP（默认自动获取，Docker 环境下可能需要手动指定）
        client-ip: 192.168.1.100
        # 心跳间隔（毫秒，默认 10000）
        heartbeat-interval-ms: 10000

      # ========== 日志配置 ==========
      log:
        # 日志目录
        dir: /var/log/sentinel
        # 是否记录 BlockException 日志（默认 false）
        log-with-pid: false

      # ========== 数据源配置（Nacos 持久化） ==========
      datasource:
        # 流控规则
        flow:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-flow-rules
            data-type: json
            rule-type: flow
            username: nacos
            password: nacos
        # 降级规则
        degrade:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-degrade-rules
            data-type: json
            rule-type: degrade
            username: nacos
            password: nacos
        # 系统规则
        system:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-system-rules
            data-type: json
            rule-type: system
            username: nacos
            password: nacos
        # 授权规则
        authority:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-authority-rules
            data-type: json
            rule-type: authority
            username: nacos
            password: nacos
        # 热点参数规则
        param-flow:
          nacos:
            server-addr: 127.0.0.1:8848
            namespace: public
            group-id: DEFAULT_GROUP
            data-id: ${spring.application.name}-param-flow-rules
            data-type: json
            rule-type: param-flow
            username: nacos
            password: nacos

# ========== Feign Sentinel 配置 ==========
feign:
  sentinel:
    # 开启 Feign 对 Sentinel 的支持（默认 false）
    enabled: true
  client:
    config:
      default:
        connectTimeout: 5000
        readTimeout: 10000

# ========== Sentinel 日志 ==========
logging:
  level:
    com.alibaba.csp.sentinel: DEBUG
```

---

## 十三、常见问题排查

### 13.1 Sentinel 控制台看不到应用

1. 确认 `spring.cloud.sentinel.transport.dashboard` 配置正确
2. 确认应用与控制台的网络互通（`telnet 127.0.0.1 8080`）
3. 确认应用已访问过至少一次接口（或设置了 `eager: true`）
4. 查看应用日志中是否有 `[Sentinel]` 相关的错误信息

### 13.2 Nacos 中的规则不生效

1. 确认 Nacos 中 Data ID 与 `bootstrap.yml` 中配置一致
2. 确认 `data-type` 为 `json`，规则格式正确
3. 确认 `rule-type` 与规则内容匹配
4. 开启 DEBUG 日志排查：`logging.level.com.alibaba.csp.sentinel: DEBUG`

### 13.3 @SentinelResource 不生效

1. 确认 `@SentinelResource` 注解的方法**不是 private 的**
2. 确认 `blockHandler` / `fallback` 方法签名正确（参数列表、返回值类型必须匹配）
3. 如果 `blockHandlerClass` 指定了类，确保该类中的方法是 `static` 的
4. 确认 `spring.cloud.sentinel.enabled=true`（默认就是 true）

### 13.4 Feign 熔断不生效

1. 确认 `feign.sentinel.enabled=true`
2. 确认 `fallback` 或 `fallbackFactory` 实现类被注册为 Spring Bean（加了 `@Component`）
3. 确认 Sentinel 依赖已正确引入

---

## 十四、总结

Sentinel 作为流量治理组件，提供了从**接口级**到**系统级**的多层防护：

```text
┌────────────────────────────────────────────┐
│              系统自适应保护                   │  ← 系统整体维度
│          (Load / CPU / RT / QPS)           │
├────────────────────────────────────────────┤
│         网关流控 (Gateway Flow)              │  ← 网关层
├────────────────────────────────────────────┤
│   流控规则  │  熔断降级  │  热点参数限流       │  ← 接口/方法维度
│  (Flow)    │ (Degrade) │ (ParamFlow)       │
├────────────────────────────────────────────┤
│         @SentinelResource 注解              │  ← 代码层面
│    (blockHandler / fallback / Feign)       │
└────────────────────────────────────────────┘
```

- **流控规则**：防止突发流量，保障服务稳定
- **熔断降级**：快速失败，避免级联故障
- **热点限流**：对高频参数精准控制
- **系统规则**：从整体维度兜底保护
- **Nacos 持久化**：规则不丢失，动态更新