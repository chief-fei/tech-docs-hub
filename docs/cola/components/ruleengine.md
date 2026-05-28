# cola-component-ruleengine 规则引擎组件

## 概述

`cola-component-ruleengine` 是 COLA 提供的**轻量级规则引擎**，用于将业务规则从代码中解耦，实现规则的声明式定义。

**Maven Artifact**: `com.alibaba.cola:cola-component-ruleengine`

## 核心概念

| 概念 | 说明 |
|------|------|
| **Facts（事实）** | 规则判断的输入数据，一个普通的 POJO 对象 |
| **Rule（规则）** | 一条独立业务规则，包含 `when` 条件和 `then` 动作 |
| **Rules（规则集）** | 一组规则的集合，按优先级排序执行 |
| **RuleEngine（规则引擎）** | 执行规则的引擎，`DefaultRuleEngine` 是默认实现 |
| **CompositeRule（组合规则）** | 可以包含多个子规则，支持组合策略 |

## Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-ruleengine</artifactId>
    <version>5.0.0</version>
</dependency>
```

## Hello World

```java
RuleEngine ruleEngine = new DefaultRuleEngine();

Rule rule = new RuleBuilder()
    .name("hello world rule")
    .description("总是打印 hello world")
    .priority(1)
    .when(facts -> true)
    .then(facts -> System.out.println("hello world"))
    .build();

Rules rules = new Rules();
rules.register(rule);

ruleEngine.fire(rules, null);  // 输出: hello world
```

## 实际场景：订单折扣计算

### 定义事实对象

```java
@Data
public class OrderFacts {
    private String userId;
    private double totalAmount;
    private int userLevel;       // 1=普通, 2=VIP, 3=SVIP
    private boolean isFirstOrder;
    private double discount = 1.0;
}
```

### 定义规则

```java
public double calculateDiscount(OrderFacts facts) {
    RuleEngine engine = new DefaultRuleEngine();
    Rules rules = new Rules();

    // 规则1：首单 9 折
    rules.register(new RuleBuilder()
        .name("首单优惠")
        .priority(1)
        .when(f -> f.isFirstOrder())
        .then(f -> f.setDiscount(0.9))
        .build());

    // 规则2：VIP 用户 8.5 折
    rules.register(new RuleBuilder()
        .name("VIP 折扣")
        .priority(2)
        .when(f -> f.getUserLevel() >= 2)
        .then(f -> f.setDiscount(0.85))
        .build());

    // 规则3：SVIP 用户 8 折
    rules.register(new RuleBuilder()
        .name("SVIP 折扣")
        .priority(3)
        .when(f -> f.getUserLevel() >= 3)
        .then(f -> f.setDiscount(0.80))
        .build());

    // 规则4：大额订单额外减 0.05
    rules.register(new RuleBuilder()
        .name("大额优惠")
        .priority(4)
        .when(f -> f.getTotalAmount() > 1000)
        .then(f -> f.setDiscount(f.getDiscount() - 0.05))
        .build());

    engine.fire(rules, facts);
    return facts.getDiscount();
}
```

**执行逻辑**：规则按 `priority` 从小到大依次执行，后执行的规则可能覆盖前面的结果。

## CompositeRule 组合规则

```java
CompositeRule compositeRule = new CompositeRule();
compositeRule.addRule(rule1);
compositeRule.addRule(rule2);

// 设置组合策略
// ALL_MATCH  - 所有子规则都需通过
// ANY_MATCH  - 任一子规则通过即可
// FIRST_MATCH - 第一个匹配的子规则
compositeRule.setStrategy(RuleStrategy.ALL_MATCH);

rules.register(compositeRule);
```

## 与扩展点配合使用

规则引擎常与 COLA 扩展点机制结合，实现不同业务场景的规则切换：

```java
@Extension(bizId = "standard", useCase = "pricing")
public class StandardPriceRuleExt implements PriceRuleExtPt {
    public double calculate(OrderFacts facts) {
        OrderDiscountRules rules = new OrderDiscountRules();
        return facts.getTotalAmount() * rules.calculateDiscount(facts);
    }
}

@Extension(bizId = "promotion", useCase = "pricing")
public class PromotionPriceRuleExt implements PriceRuleExtPt {
    // 促销期间使用不同的规则
}
```

## 注意事项

1. **优先级控制**：`priority` 越小的规则越先执行
2. **相互覆盖**：高优先级规则的 `then` 结果可能被低优先级规则覆盖
3. **适用规模**：适合 10-50 条规则的中小场景
4. **复杂场景**：需要规则热更新、规则持久化等特性时，建议使用 Drools
