# cola-component-extension 扩展点组件

## 概述

`cola-component-extension` 是 COLA 框架的扩展点组件，提供了插件式扩展机制，使得在不修改核心代码的情况下，为系统添加新的功能或实现。

**Maven Artifact**: `com.alibaba.cola:cola-component-extension`

## 核心注解

### 1. @Extension - 扩展点实现注解

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Extension {
    /**
     * 业务代码，用于区分不同的业务线
     * 例如："customer", "order", "payment"
     */
    String bizCode();
    
    /**
     * 使用场景，用于区分同一业务下的不同操作
     * 例如："add", "update", "delete"
     */
    String useCase();
    
    /**
     * 执行顺序，数字越小越先执行
     * 默认为 0
     */
    int order() default 0;
}
```

**概念**：
- 扩展点实现是对某个功能的具体实现
- 一个扩展点接口可以有多个实现
- 通过 bizCode 和 useCase 区分不同的实现
- 通过 order 属性控制多个实现的执行顺序

**使用场景**：
- 业务规则验证（不同业务不同规则）
- 业务前置处理（数据清洗、转换）
- 业务后置处理（日志、通知）
- 条件分支处理（A/B 测试、灰度发布）

**扩展点接口定义示例**：

首先定义扩展点接口：

```java
/**
 * 客户验证扩展点接口
 * 定义在 domain 层，因为它代表业务规则
 */
public interface CustomerValidatingExtPt {
    /**
     * 验证客户输入
     * @param cmd 客户命令
     * @throws BizException 验证失败时抛出
     */
    void validate(CustomerAddCmd cmd);
}
```

然后提供不同业务的实现：

```java
import org.springframework.stereotype.Component;
import com.alibaba.cola.extension.Extension;

/**
 * 基础客户验证实现
 * bizCode = "customer" 表示这是通用的客户验证
 * useCase = "add" 表示这是新增客户时的验证
 */
@Component
@Extension(bizCode = "customer", useCase = "add")
public class CustomerValidatingImpl implements CustomerValidatingExtPt {
    
    @Override
    public void validate(CustomerAddCmd cmd) {
        // 通用的验证规则
        if (cmd.getCustomerDTO() == null) {
            throw new BizException("B_EMPTY_CUSTOMER", "客户信息不能为空");
        }
        
        if (cmd.getCustomerDTO().getCompanyName() == null 
            || cmd.getCustomerDTO().getCompanyName().trim().isEmpty()) {
            throw new BizException("B_EMPTY_COMPANY_NAME", "公司名不能为空");
        }
        
        if (cmd.getCustomerDTO().getRegisteredCapital() <= 0) {
            throw new BizException("B_INVALID_CAPITAL", "注册资金必须大于0");
        }
    }
}

/**
 * VIP 客户验证实现
 * bizCode = "customerVip" 表示这是 VIP 客户的验证
 * 注意：bizCode 不同，说明这个实现只对 VIP 客户适用
 */
@Component
@Extension(bizCode = "customerVip", useCase = "add", order = 1)
public class CustomerVipValidatingImpl implements CustomerValidatingExtPt {
    
    @Override
    public void validate(CustomerAddCmd cmd) {
        // VIP 客户的特殊验证规则
        if (cmd.getCustomerDTO().getCompanyName().length() < 10) {
            throw new BizException(
                "B_COMPANY_NAME_TOO_SHORT", 
                "VIP 客户公司名必须至少 10 个字符"
            );
        }
        
        if (cmd.getCustomerDTO().getRegisteredCapital() < 1000000) {
            throw new BizException(
                "B_CAPITAL_TOO_SMALL",
                "VIP 客户注册资金必须至少 100 万"
            );
        }
    }
}

/**
 * 大企业客户验证实现
 * bizCode = "customerLarge" 表示这是大企业客户的验证
 * order = 2 表示执行顺序
 */
@Component
@Extension(bizCode = "customerLarge", useCase = "add", order = 2)
public class CustomerLargeValidatingImpl implements CustomerValidatingExtPt {
    
    @Override
    public void validate(CustomerAddCmd cmd) {
        // 大企业客户的特殊验证规则
        if (cmd.getCustomerDTO().getRegisteredCapital() < 50000000) {
            throw new BizException(
                "B_CAPITAL_TOO_SMALL",
                "大企业客户注册资金必须至少 5000 万"
            );
        }
        
        // 大企业需要额外的复杂验证
        if (!hasValidCreditRating(cmd.getCustomerDTO())) {
            throw new BizException(
                "B_INVALID_CREDIT_RATING",
                "大企业客户必须具有有效的信用评级"
            );
        }
    }
    
    private boolean hasValidCreditRating(CustomerDTO dto) {
        // 检查信用评级
        return true;
    }
}
```

**在执行器中使用扩展点**：

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class CustomerAddCmdExe {
    
    /**
     * 注入扩展点接口，不需要知道具体实现
     * Spring 会根据 bizCode 和 useCase 查找对应的实现
     */
    @Autowired(required = false)
    private CustomerValidatingExtPt customerValidatingExtPt;
    
    @Autowired
    private CustomerGateway customerGateway;
    
    public Response execute(CustomerAddCmd cmd) {
        try {
            // 1. 执行扩展点验证
            // 框架会根据当前的 bizCode 选择对应的实现
            if (customerValidatingExtPt != null) {
                customerValidatingExtPt.validate(cmd);
            }
            
            // 2. 执行核心业务逻辑
            Customer customer = new Customer();
            customer.setCompanyName(cmd.getCustomerDTO().getCompanyName());
            customer.setRegisteredCapital(cmd.getCustomerDTO().getRegisteredCapital());
            
            // 3. 业务规则检查
            customer.checkConflict();
            
            // 4. 持久化
            customerGateway.save(customer);
            
            return Response.buildSuccess();
            
        } catch (BizException e) {
            throw e;
        }
    }
}
```

**多个扩展点实现的执行顺序**：

```java
/**
 * 如果定义了多个扩展点实现，可以通过 order 属性控制执行顺序
 */
@Component
@Extension(bizCode = "payment", useCase = "process", order = 1)
public class PaymentValidatingImpl implements PaymentProcessExtPt {
    // 第一个执行
}

@Component
@Extension(bizCode = "payment", useCase = "process", order = 2)
public class PaymentFraudCheckImpl implements PaymentProcessExtPt {
    // 第二个执行
}

@Component
@Extension(bizCode = "payment", useCase = "process", order = 3)
public class PaymentNotificationImpl implements PaymentProcessExtPt {
    // 第三个执行
}
```

### 2. @ExtensionExecutor - 扩展点执行器注解（可选）

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ExtensionExecutor {
    // 用于标记一个类为扩展点执行器
    // 这是一个可选注解，主要用于文档和容器识别
}
```

**概念**：
- 扩展点执行器是调用扩展点实现的地方
- 通常不需要显式使用这个注解（自动识别）
- 主要用于标签和文档目的

**使用示例**：

```java
import org.springframework.stereotype.Component;
import com.alibaba.cola.extension.ExtensionExecutor;

/**
 * 订单处理执行器
 * 这个class 会调用多个扩展点
 */
@Component
@ExtensionExecutor
public class OrderProcessCmdExe {
    
    @Autowired(required = false)
    private OrderValidatingExtPt orderValidatingExtPt;
    
    @Autowired(required = false)
    private OrderProcessExtPt orderProcessExtPt;
    
    @Autowired(required = false)
    private OrderNotificationExtPt orderNotificationExtPt;
    
    public Response execute(OrderProcessCmd cmd) {
        // 1. 验证
        if (orderValidatingExtPt != null) {
            orderValidatingExtPt.validate(cmd);
        }
        
        // 2. 处理
        Order order = cmd.getOrder();
        if (orderProcessExtPt != null) {
            orderProcessExtPt.process(order);
        }
        
        // 3. 通知
        if (orderNotificationExtPt != null) {
            orderNotificationExtPt.notify(order);
        }
        
        return Response.buildSuccess();
    }
}
```

---

## 完整示例：支持多业务线的验证系统

### 1. 定义通用的扩展点接口

```java
/**
 * 订单验证扩展点
 * 定义订单验证的规则，不涉及具体实现
 */
public interface OrderValidatingExtPt {
    void validate(Order order);
}
```

### 2. 不同业务线提供不同实现

```java
/**
 * 标准订单验证
 */
@Component
@Extension(bizCode = "order", useCase = "create")
public class StandardOrderValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        if (order.getTotalAmount() <= 0) {
            throw new BizException("B_EMPTY_AMOUNT", "订单金额必须大于0");
        }
    }
}

/**
 * B2B 订单验证（针对企业客户）
 */
@Component
@Extension(bizCode = "orderB2B", useCase = "create")
public class B2bOrderValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        if (order.getTotalAmount() < 10000) {
            throw new BizException("B_AMOUNT_TOO_SMALL", "B2B 订单金额必须至少 10000 元");
        }
        
        if (!order.hasValidTaxId()) {
            throw new BizException("B_INVALID_TAX_ID", "B2B 订单必须提供有效的税号");
        }
    }
}

/**
 * B2C 订单验证（针对个人消费者）
 */
@Component
@Extension(bizCode = "orderB2C", useCase = "create")
public class B2cOrderValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        // B2C 订单的验证规则相对简单
        if (order.getTotalAmount() <= 0) {
            throw new BizException("B_EMPTY_AMOUNT", "订单金额必须大于0");
        }
    }
}
```

### 3. 在执行器中使用扩展点

```java
@Component
public class OrderCreateCmdExe {
    
    @Autowired
    private OrderValidatingExtPt orderValidatingExtPt;
    
    @Autowired
    private OrderGateway orderGateway;
    
    public Response execute(OrderCreateCmd cmd) {
        Order order = cmd.getOrder();
        
        // 自动调用对应的扩展实现（基于 bizCode）
        orderValidatingExtPt.validate(order);
        
        // 继续业务逻辑
        orderGateway.save(order);
        
        return Response.buildSuccess();
    }
}
```

---

## 扩展点 vs 继承 vs 策略模式

### 使用扩展点的优势

| 方面 | 扩展点 | 继承 | 策略模式 |
|------|--------|------|---------|
| **修改核心代码** | 否 | 是 | 否 |
| **支持多个实现** | 是 | 否（只能单继承） | 是 |
| **框架支持** | 是（内置） | 无 | 无 |
| **运行时选择** | 是（根据 bizCode） | 否 | 是 |
| **易用性** | 高（只需注解） | 低（需要手动管理） | 中 |
| **类型安全** | 高 | 高 | 高 |

**对比示例**：

```java
// ❌ 不好的做法：继承
public abstract class OrderValidator {
    abstract void validate(Order order);
}

public class StandardOrderValidator extends OrderValidator {
    @Override
    void validate(Order order) { }
}

public class B2bOrderValidator extends OrderValidator {
    @Override
    void validate(Order order) { }
}

// 使用时需要判断类型并创建实例
OrderValidator validator;
if ("B2B".equals(order.getType())) {
    validator = new B2bOrderValidator();
} else {
    validator = new StandardOrderValidator();
}
validator.validate(order);


// ✅ 好的做法：扩展点
@Extension(bizCode = "orderB2B", useCase = "create")
public class B2bOrderValidatingImpl implements OrderValidatingExtPt { }

// 直接注入，框架自动选择
@Autowired
private OrderValidatingExtPt orderValidatingExtPt;

orderValidatingExtPt.validate(order);  // 框架自动选择正确的实现
```

---

## 最佳实践

### 1. 扩展点接口应该清晰和专注

```java
// ✅ 好的做法：职责单一
public interface OrderValidatingExtPt {
    void validate(Order order);  // 只负责验证
}

// ❌ 不好的做法：职责混乱
public interface OrderProcessExtPt {
    void validate(Order order);   // 验证
    void process(Order order);    // 处理
    void notify(Order order);     // 通知
}
```

### 2. 扩展点实现应该独立

```java
// ✅ 好的做法：扩展点实现之间没有依赖
@Component
@Extension(bizCode = "order", useCase = "validate", order = 1)
public class BasicValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        // 基础验证，不依赖其他实现
    }
}

@Component
@Extension(bizCode = "order", useCase = "validate", order = 2)
public class AdvancedValidatingImpl implements OrderValidatingExtPt {
    @Override
    public void validate(Order order) {
        // 高级验证，不依赖 BasicValidatingImpl
    }
}

// ❌ 不好的做法：扩展点实现之间有依赖
@Extension(bizCode = "order", useCase = "validate", order = 2)
public class DependentValidatingImpl implements OrderValidatingExtPt {
    @Autowired
    private BasicValidatingImpl basicValidating;  // 不应该这样
    
    @Override
    public void validate(Order order) {
        basicValidating.validate(order);  // 不应该直接调用其他实现
    }
}
```

### 3. 使用有意义的 bizCode 和 useCase

```java
// ✅ 好的做法：清晰的业务含义
@Extension(bizCode = "customer", useCase = "add")       // 客户添加
@Extension(bizCode = "order", useCase = "ship")         // 订单发货
@Extension(bizCode = "payment", useCase = "process")    // 支付处理

// ❌ 不好的做法：含义不清
@Extension(bizCode = "op1", useCase = "act1")
@Extension(bizCode = "mod2", useCase = "func2")
```

### 4. 正确处理异常

```java
@Component
@Extension(bizCode = "order", useCase = "validate")
public class OrderValidatingImpl implements OrderValidatingExtPt {
    
    @Override
    public void validate(Order order) {
        // ✅ 好的做法：直接抛出业务异常
        if (order.getTotalAmount() <= 0) {
            throw new BizException("B_INVALID_AMOUNT", "订单金额必须大于0");
        }
        
        // ❌ 不好的做法：捕获异常再处理
        try {
            callExternalService(order);
        } catch (Exception e) {
            // 吞掉异常，导致问题无法感知
        }
    }
}
```

---

## POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-extension</artifactId>
</dependency>
```

> **注意**：COLA 5.0.0 要求 JDK 17+，仅支持 Spring Boot 3.x。如需 Spring Boot 2.7.x 支持，请使用 COLA 4.x 版本。

## 常见问题

**Q: 如何动态选择扩展点实现？**
A: 框架会根据当前的 `bizCode` 上下文自动选择。如果需要手动选择，可以使用 Spring 的多个 bean 注入方式。

**Q: 一个扩展点接口可以有多少个实现？**
A: 理论上无限制。但建议不超过 10 个，否则说明设计出现了问题。

**Q: 扩展点实现的执行顺序如何控制？**
A: 使用 `@Extension` 的 `order` 属性。数字越小优先级越高。

**Q: 能否在扩展点实现中调用另一个扩展点实现？**
A: 不推荐。应该保持扩展点实现的独立性。如果需要复杂的业务流程，应该在执行器中组织。

**Q: 如果没有找到对应的扩展点实现怎么办？**
A: 使用 `@Autowired(required = false)` 使注入可选，然后判空。或者提供一个默认实现。

## 参考

- COLA 官方项目：https://github.com/alibaba/COLA
- 策略模式：https://refactoring.guru/design-patterns/strategy


