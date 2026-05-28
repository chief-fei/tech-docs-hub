# cola-component-statemachine 状态机组件

## 概述

`cola-component-statemachine` 是 COLA 框架提供的**轻量级、无状态、高性能**的状态机 DSL 实现，用于解决业务中的状态流转问题。

**Maven Artifact**: `com.alibaba.cola:cola-component-statemachine`

## 为什么选择 COLA 状态机

与其他状态机框架（Spring Statemachine、squirrel-foundation）相比：

| 特性 | COLA StateMachine | Spring Statemachine |
|------|:--:|:--:|
| 无状态（不需持久化） | ✅ | ❌（有状态） |
| 轻量级 | ✅ | ❌（较重） |
| DSL 流式定义 | ✅ | 一般 |
| PlantUML 可视化 | ✅ | ❌ |
| Spring Boot 集成 | 手动 | 自动 |

## 核心概念

| 概念 | 说明 |
|------|------|
| **State（状态）** | 业务对象的当前状态，如"待提交"、"审核中"、"已通过" |
| **Event（事件）** | 触发状态变更的动作，如"提交审核"、"通过"、"驳回" |
| **Transition（流转）** | 从一个状态到另一个状态的路径 |
| **Condition（条件）** | 状态流转的前置条件检查 |
| **Action（动作）** | 状态流转成功后执行的业务逻辑 |
| **Context（上下文）** | 传递业务数据 |

## Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-statemachine</artifactId>
    <version>4.3.2</version>
</dependency>
```

> COLA 5.0.0 版本的 artifactId 保持不变，版本号跟随主版本。

## 快速上手

### 步骤 1：定义状态和事件枚举

```java
// 状态枚举
public enum OrderStatus {
    PENDING_SUBMIT("待提审"),
    AUDITING("审核中"),
    APPROVED("已通过"),
    REJECTED("已驳回");

    private final String desc;
    OrderStatus(String desc) { this.desc = desc; }
    public String getDesc() { return desc; }
}

// 事件枚举
public enum OrderEvent {
    SUBMIT("提交审核"),
    PASS("通过"),
    REJECT("驳回"),
    CANCEL("撤销");
    // ...
}
```

### 步骤 2：定义业务上下文

```java
@Data
public class OrderContext {
    private String orderId;
    private String operator;
    private String reason;
}
```

### 步骤 3：构建状态机

```java
@Component
public class OrderStateMachineConfig {

    public static final String MACHINE_ID = "orderStateMachine";

    @PostConstruct
    public void init() {
        StateMachineBuilder<OrderStatus, OrderEvent, OrderContext> builder
            = StateMachineBuilderFactory.create();

        // 外部流转：待提审 → 审核中
        builder.externalTransition()
            .from(OrderStatus.PENDING_SUBMIT)
            .to(OrderStatus.AUDITING)
            .on(OrderEvent.SUBMIT)
            .when(checkPermission())
            .perform(doSubmit());

        // 外部流转：审核中 → 已通过
        builder.externalTransition()
            .from(OrderStatus.AUDITING)
            .to(OrderStatus.APPROVED)
            .on(OrderEvent.PASS)
            .when(checkPermission())
            .perform(doApprove());

        // 外部流转：审核中 → 已驳回
        builder.externalTransition()
            .from(OrderStatus.AUDITING)
            .to(OrderStatus.REJECTED)
            .on(OrderEvent.REJECT)
            .when(checkPermission())
            .perform(doReject());

        // 内部流转：同一状态内执行操作
        builder.internalTransition()
            .within(OrderStatus.AUDITING)
            .on(OrderEvent.CANCEL)
            .perform(doCancel());

        builder.build(MACHINE_ID);

        // 生成 PlantUML 状态图用于可视化
        StateMachine<OrderStatus, OrderEvent, OrderContext> machine
            = StateMachineFactory.get(MACHINE_ID);
        System.out.println(machine.generatePlantUML());
    }

    private Condition<OrderContext> checkPermission() {
        return context -> context.getOperator() != null;
    }

    private Action<OrderStatus, OrderEvent, OrderContext> doSubmit() {
        return (from, to, event, ctx) -> System.out.println(
            String.format("订单 %s 从 [%s] 变更为 [%s]",
                ctx.getOrderId(), from.getDesc(), to.getDesc())
        );
    }

    private Action<OrderStatus, OrderEvent, OrderContext> doApprove() {
        return (from, to, event, ctx) ->
            System.out.println("审核通过：" + ctx.getOrderId());
    }

    private Action<OrderStatus, OrderEvent, OrderContext> doReject() {
        return (from, to, event, ctx) ->
            System.out.println("驳回原因：" + ctx.getReason());
    }

    private Action<OrderStatus, OrderEvent, OrderContext> doCancel() {
        return (from, to, event, ctx) ->
            System.out.println("撤销审核：" + ctx.getOrderId());
    }
}
```

### 步骤 4：使用状态机

```java
@RestController
public class OrderController {

    @GetMapping("/order/submit")
    public Object submitOrder(@RequestParam String orderId) {
        OrderContext ctx = new OrderContext();
        ctx.setOrderId(orderId);
        ctx.setOperator("admin");

        StateMachine<OrderStatus, OrderEvent, OrderContext> machine
            = StateMachineFactory.get(OrderStateMachineConfig.MACHINE_ID);

        // 触发状态流转：当前状态 + 事件 → 新状态
        OrderStatus newStatus = machine.fireEvent(
            OrderStatus.PENDING_SUBMIT,
            OrderEvent.SUBMIT,
            ctx
        );

        return "新状态：" + newStatus.getDesc();
    }
}
```

## 高级用法

### 同一事件根据条件流转到不同状态

```java
// 审核事件可以根据不同条件到达不同目标状态
builder.externalTransitions()
    .fromAmong(OrderStatus.AUDITING)
    .to(OrderStatus.APPROVED)
    .on(OrderEvent.AUDIT)
    .when(ctx -> "PASS".equals(ctx.getResult()))
    .perform(doApprove());

builder.externalTransitions()
    .fromAmong(OrderStatus.AUDITING)
    .to(OrderStatus.REJECTED)
    .on(OrderEvent.AUDIT)
    .when(ctx -> "REJECT".equals(ctx.getResult()))
    .perform(doReject());
```

### PlantUML 可视化

```java
String plantUML = machine.generatePlantUML();
System.out.println(plantUML);
// 将输出粘贴到 http://www.plantuml.com/plantuml 即可看到状态图
```

## 注意事项

1. **状态机是单例的**：应用中每种状态机只需在 `@PostConstruct` 中构建一次
2. **无状态设计**：状态机本身不存储状态，状态由业务对象的数据库字段保存
3. **同步执行**：流转是同步的，适合快速执行的业务逻辑
4. **不适合长流程**：需要等待或人工节点的流程建议用工作流引擎（如 Activiti）
