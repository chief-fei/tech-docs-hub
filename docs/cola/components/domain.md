# cola-component-domain-starter 领域建模组件

## 概述

`cola-component-domain-starter` 是 COLA 框架的领域建模组件，提供了领域驱动设计（DDD）中的核心注解和基类支持，帮助你更好地实现领域中的概念。

**Maven Artifact**: `com.alibaba.cola:cola-component-domain-starter`

## 核心注解

### 1. @Entity - 实体注解

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Entity {
    // 用于标记一个类是领域实体
    // 没有任何属性，仅作为标记
}
```

**概念**：
- 领域实体是 DDD 中的核心概念
- 实体具有身份（identity），不同的实体即使属性相同也仍然是不同的
- 实体有生命周期（创建、修改、删除）
- 实体应该包含业务行为，而不仅仅是数据字段

**特点**：
- 可变的（mutable）
- 有身份和生命周期
- 包含业务规则和业务行为
- 通常对应数据库中的一条记录

**使用示例**：

```java
import com.alibaba.cola.domain.Entity;
import com.alibaba.cola.exception.BizException;
import lombok.Data;

@Entity
@Data
public class Customer {
    // 身份识别字段
    private String customerId;
    
    // 业务属性
    private String companyName;
    private long registeredCapital;
    private String memberType;
    private LocalDateTime createdTime;
    private LocalDateTime updatedTime;
    
    // 值对象字段
    private Address address;
    private Contact contact;
    
    // ========== 业务规则和行为开始 ==========
    
    /**
     * 业务规则：判断是否是大企业
     * 规则：注册资金大于1000万
     */
    public boolean isBigCompany() {
        return registeredCapital > 10000000;
    }
    
    /**
     * 业务规则：判断是否是中小企业
     * 规则：注册资金大于10万且小于100万
     */
    public boolean isSME() {
        return registeredCapital > 100000 && registeredCapital < 1000000;
    }
    
    /**
     * 业务规则：检查公司名是否冲突
     * 此规则定义在实体中，而不是 Service 中
     * 这是 DDD 的核心理念
     */
    public void checkConflict() {
        if ("ConflictCompanyName".equals(this.companyName)) {
            throw new BizException(
                "B_CUSTOMER_CONFLICT",
                "公司名 '" + this.companyName + "' 已存在"
            );
        }
    }
    
    /**
     * 业务规则：检查公司名是否满足格式要求
     */
    public void validateCompanyName() {
        if (this.companyName == null || this.companyName.trim().isEmpty()) {
            throw new BizException("B_EMPTY_COMPANY_NAME", "公司名不能为空");
        }
        if (this.companyName.length() > 100) {
            throw new BizException("B_COMPANY_NAME_TOO_LONG", "公司名长度不能超过100个字符");
        }
    }
    
    /**
     * 业务规则：检查客户是否可以升级
     * 规则：只有类型为 VIP 的客户才能升级
     */
    public void checkCanupgrade() {
        if (!"VIP".equals(this.memberType)) {
            throw new BizException(
                "B_CUSTOMER_TYPE_INVALID",
                "只有 VIP 客户才能升级"
            );
        }
    }
    
    /**
     * 业务行为：升级客户等级
     */
    public void upgrade() {
        checkCanupgrade();
        this.memberType = "SENIOR_VIP";
        this.updatedTime = LocalDateTime.now();
    }
    
    /**
     * 业务行为：绑定地址
     */
    public void bindAddress(Address newAddress) {
        if (newAddress == null) {
            throw new BizException("B_EMPTY_ADDRESS", "地址不能为空");
        }
        this.address = newAddress;
        this.updatedTime = LocalDateTime.now();
    }
    
    /**
     * 业务行为：更新联系方式
     */
    public void updateContact(Contact newContact) {
        if (newContact == null || !newContact.isValid()) {
            throw new BizException("B_INVALID_CONTACT", "有效的联系方式不能为空");
        }
        this.contact = newContact;
        this.updatedTime = LocalDateTime.now();
    }
    
    /**
     * 业务行为：冻结客户账户
     */
    public void freeze() {
        this.memberType = "FROZEN";
        this.updatedTime = LocalDateTime.now();
    }
    
    /**
     * 业务行为：解冻客户账户
     */
    public void unfreeze() {
        // 解冻后需要恢复到之前的类型
        // 这里简化处理
        this.memberType = "NORMAL";
        this.updatedTime = LocalDateTime.now();
    }
    
    // ========== 业务规则和行为结束 ==========
}
```

**领域实体 vs 数据对象的区别**：

| 方面 | 领域实体 (@Entity) | 数据对象 (DO) |
|------|------------------|-------|
| **位置** | domain 层 | infrastructure 层 |
| **职责** | 实现业务规则 | 与数据库表映射 |
| **内容** | 业务属性 + 业务方法 | 业务属性 |
| **可变性** | 可变（有业务操作） | 可变（SQL 更新） |
| **生命周期** | 业务生命周期 | 数据库生命周期 |
| **示例** | Customer 带 isBigCompany() | CustomerDO |

**实体设计原则**：

1. **实体应该是自治的**
```java
// ✅ 好：实体定义自己的规则
@Entity
public class Customer {
    public void checkConflict() {
        if ("ConflictName".equals(name)) {
            throw new BizException(...);
        }
    }
}

// ❌ 不好：规则定义在 Service 中
@Service
public class CustomerService {
    public void addCustomer(Customer customer) {
        if ("ConflictName".equals(customer.getName())) {  // 不应该这样
            throw new BizException(...);
        }
    }
}
```

2. **实体应该确保数据一致性**
```java
@Entity
public class Customer {
    public void updateCapital(long newCapital) {
        if (newCapital < 0) {
            throw new BizException("B_INVALID_CAPITAL", "资金不能为负数");
        }
        this.registeredCapital = newCapital;
    }
}
```

3. **实体的方法应该表达业务意图**
```java
@Entity
public class Customer {
    // ✅ 好：明确的业务意图
    public void upgrade() { }
    public void freeze() { }
    public void updateContact(Contact contact) { }
    
    // ❌ 不好：只是 setter，没有业务意图
    public void setMemberType(String type) { }
    public void setStatus(String status) { }
}
```

---

### 2. @ValueObject - 值对象注解

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValueObject {
    // 用于标记一个类是值对象
    // 值对象没有身份，只关心值本身
}
```

**概念**：
- 值对象是 DDD 中的重要概念
- 值对象没有身份，两个值对象如果属性完全相同就认为它们相等
- 值对象是不可变的（immutable）
- 值对象可以被多个实体共享

**特点**：
- 不可变的（immutable）
- 没有身份，只关心值
- 可以被多个实体使用
- 通常是比较小的对象

**值对象示例**：

```java
import com.alibaba.cola.domain.ValueObject;
import lombok.Value;

/**
 * 地址值对象
 * - 不可变
 * - 两个地址如果属性相同就认为相等
 * - 可以被多个实体（如 Customer, Supplier）使用
 */
@ValueObject
@Value  // Lombok 提供不可变的 getter
public class Address {
    private String provinceCode;  // 省代码
    private String cityCode;       // 市代码
    private String districtCode;   // 区代码
    private String detailedAddress; // 详细地址
    
    // 值对象应该验证自己的数据完整性
    public Address(String provinceCode, String cityCode, 
                   String districtCode, String detailedAddress) {
        if (provinceCode == null || provinceCode.trim().isEmpty()) {
            throw new IllegalArgumentException("省代码不能为空");
        }
        if (cityCode == null || cityCode.trim().isEmpty()) {
            throw new IllegalArgumentException("市代码不能为空");
        }
        
        this.provinceCode = provinceCode;
        this.cityCode = cityCode;
        this.districtCode = districtCode;
        this.detailedAddress = detailedAddress;
    }
    
    // 值对象提供有意义的方法
    public String getFullAddress() {
        return provinceCode + cityCode + (districtCode != null ? districtCode : "") 
               + detailedAddress;
    }
    
    public boolean isValidCity(String city) {
        // 验证城市是否有效
        return true;
    }
}

/**
 * 联系方式值对象
 */
@ValueObject
@Value
public class Contact {
    private String name;           // 联系人名称
    private String phoneNumber;    // 电话号码
    private String email;          // 邮箱
    
    public Contact(String name, String phoneNumber, String email) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("联系人名称不能为空");
        }
        if (phoneNumber == null || !isValidPhone(phoneNumber)) {
            throw new IllegalArgumentException("电话号码格式不正确");
        }
        
        this.name = name;
        this.phoneNumber = phoneNumber;
        this.email = email;
    }
    
    public boolean isValid() {
        return name != null && phoneNumber != null;
    }
    
    private static boolean isValidPhone(String phone) {
        return phone.matches("^\\d{7,15}$");
    }
}

/**
 * 金钱值对象
 * - 包含金额和货币单位
 * - 提供数学运算方法
 */
@ValueObject
@Value
public class Money {
    private BigDecimal amount;
    private String currency; // "CNY", "USD" 等
    
    public Money(BigDecimal amount, String currency) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("金额不能为负数");
        }
        this.amount = amount;
        this.currency = currency;
    }
    
    // 加法
    public Money plus(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("不同货币无法相加");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }
    
    // 减法
    public Money minus(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("不同货币无法相减");
        }
        BigDecimal result = this.amount.subtract(other.amount);
        if (result.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("结果金额不能为负数");
        }
        return new Money(result, this.currency);
    }
    
    // 比较
    public boolean isGreaterThan(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("不同货币无法比较");
        }
        return this.amount.compareTo(other.amount) > 0;
    }
}
```

**实体与值对象的区别表**：

| 特性 | 实体 (@Entity) | 值对象 (@ValueObject) |
|------|-----------|----|
| **身份** | 有唯一身份 | 没有身份 |
| **相等性** | 基于身份（ID） | 基于属性值 |
| **可变性** | 可变 | 不可变 |
| **生命周期** | 有生命周期 | 无生命周期 |
| **是否独立** | 可独立存在 | 通常附属于实体 |
| **示例** | Customer, Order | Money, Address |

---

### 3. @Repository - 仓储接口注解

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Repository {
    // 用于标记一个接口是仓储接口
    // 仓储负责实体的生命周期管理
}
```

**概念**：
- 仓储是 DDD 中的出站端口（Port）
- 仓储只定义在 domain 层，实现在 infrastructure 层
- 仓储隔离了实体与数据库的耦合
- 仓储提供的方法应该用业务语言表述

**特点**：
- 定义在 domain 层（interface）
- 实现在 infrastructure 层
- 操作的对象是聚合根（Aggregate Root）
- 方法名应该体现业务意图

**仓储接口示例**：

```java
import com.alibaba.cola.domain.Repository;

@Repository
public interface CustomerRepository {
    
    // ========== 查询操作 ==========
    
    /**
     * 根据客户ID获取客户
     * 只加载聚合根，不加载所有关联对象
     */
    Customer getById(String customerId);
    
    /**
     * 根据公司名获取客户
     * 业务规则：公司名唯一
     */
    Customer getByCompanyName(String companyName);
    
    /**
     * 获取所有 VIP 客户
     */
    List<Customer> getAllVipCustomers();
    
    /**
     * 根据类型获取客户列表
     */
    List<Customer> getByMemberType(String memberType);
    
    /**
     * 分页查询客户
     */
    PageResult<Customer> queryByCondition(CustomerQueryCondition condition);
    
    // ========== 保存操作 ==========
    
    /**
     * 保存（新增或更新）
     */
    void save(Customer customer);
    
    /**
     * 批量保存
     */
    void saveBatch(List<Customer> customers);
    
    // ========== 删除操作 ==========
    
    /**
     * 删除客户
     */
    void delete(String customerId);
    
    /**
     * 根据条件删除
     */
    void deleteByCondition(CustomerQueryCondition condition);
    
    // ========== 存在性检查 ==========
    
    /**
     * 检查公司名是否已存在
     */
    boolean existsByCompanyName(String companyName);
    
    /**
     * 检查客户是否存在
     */
    boolean existsById(String customerId);
    
    // ========== 计数 ==========
    
    /**
     * 获取全部客户数
     */
    long countAll();
    
    /**
     * 根据条件计数
     */
    long countByCondition(CustomerQueryCondition condition);
}
```

**在 infrastructure 层的实现**：

```java
import org.springframework.stereotype.Component;

@Component
public class CustomerRepositoryImpl implements CustomerRepository {
    
    @Autowired
    private CustomerMapper customerMapper;
    
    @Override
    public Customer getById(String customerId) {
        try {
            CustomerDO customerDO = customerMapper.getById(customerId);
            return convert(customerDO);  // DO 转 Entity
        } catch (Exception e) {
            throw new SysException("S_QUERY_ERROR", "查询客户失败", e);
        }
    }
    
    @Override
    public void save(Customer customer) {
        try {
            CustomerDO customerDO = convertTo(customer);  // Entity 转 DO
            if (customer.getId() == null) {
                customerMapper.insert(customerDO);
            } else {
                customerMapper.update(customerDO);
            }
        } catch (Exception e) {
            throw new SysException("S_SAVE_ERROR", "保存客户失败", e);
        }
    }
    
    // ... 其他方法实现
    
    private Customer convert(CustomerDO customerDO) {
        if (customerDO == null) return null;
        Customer customer = new Customer();
        customer.setCustomerId(customerDO.getCustomerId());
        customer.setCompanyName(customerDO.getCompanyName());
        // ... 其他转换
        return customer;
    }
}
```

**仓储设计原则**：

1. **仓储操作的对象应该是聚合根**
```java
// ✅ 正确：操作 Customer（聚合根）
public interface CustomerRepository {
    Customer getById(String customerId);
    void save(Customer customer);
}

// ❌ 不对：操作地址（应该通过 Customer 改变）
public interface AddressRepository {
    Address getById(String addressId);
    void save(Address address);  // 应该通过 Customer 修改
}
```

2. **仓储方法名应该用业务语言**
```java
@Repository
public interface OrderRepository {
    
    // ✅ 业务语言
    List<Order> getUnpaidOrders();
    List<Order> getShippedOrders();
    Order getLatestOrderByCustomer(String customerId);
    
    // ❌ 技术语言
    // List<Order> getByStatusCode("0");
    // List<Order> getByStatusCode("1");
}
```

3. **仓储不应该暴露底层查询语言**
```java
@Repository
public interface CustomerRepository {
    
    // ✅ 隐藏 SQL 细节
    List<Customer> getVipCustomers();
    List<Customer> getByMemberType(String type);
    
    // ❌ 暴露底层实现
    List<Customer> queryBySql(String sql);
    List<Customer> queryByExample(Example example);
}
```

---

## POM 配置

```xml
<dependency>
    <groupId>com.alibaba.cola</groupId>
    <artifactId>cola-component-domain-starter</artifactId>
</dependency>
```

## 最佳实践

### 1. 设计聚合根

一个聚合通常包含一个实体（聚合根）和若干值对象。

```java
/**
 * Order 聚合根
 * 聚合内部的对象：
 * - Order（实体，聚合根）
 * - OrderItem（实体，但不是聚合根）
 * - Money（值对象）
 * - Address（值对象）
 */
@Entity
@Data
public class Order {
    private String orderId;           // 聚合根ID
    private List<OrderItem> items;    // 聚合内成员
    private Money totalAmount;        // 值对象
    private Address shippingAddress;  // 值对象
    
    public void addItem(OrderItem item) {
        // 操作聚合内的对象时
        // 通过聚合根进行
        this.items.add(item);
        recalculateTotal();
    }
    
    private void recalculateTotal() {
        Money total = new Money(BigDecimal.ZERO, "CNY");
        for (OrderItem item : items) {
            total = total.plus(item.getSubtotal());
        }
        this.totalAmount = total;
    }
}
```

### 2. 值对象应该不可变

```java
// ✅ 好的做法：使用 @Value 或 final 字段
@ValueObject
@Value
public class Contact {
    private final String phoneNumber;
    private final String email;
}

// ❌ 不好的做法：可变的值对象
@ValueObject
@Data
public class Contact {
    private String phoneNumber;  // 可变，不对
    private String email;
    
    public void setPhoneNumber(String newPhone) {  // 值对象不应该有 setter
        this.phoneNumber = newPhone;
    }
}
```

### 3. 仓储只为聚合根操作

```java
// 聚合：Customer（根）+ Address（值对象）+ Contact（值对象）
public interface CustomerRepository {
    // ✅ 操作聚合根
    Customer getById(String customerId);
    void save(Customer customer);  // 级联保存 Address 和 Contact
    
    // ❌ 不应该有这些
    // void saveAddress(Address address);
    // void saveContact(Contact contact);
    // 应该通过 Customer 修改
}
```

---

## 常见问题

**Q: @Entity 和真实的 JPA @Entity 有什么区别？**
A: COLA 的 @Entity 是纯标记注解，只用于识别和文档目的。JPA 的 @Entity 是功能性注解，用于 ORM 映射。在 COLA 项目中，通常同时使用两个（如果使用 Spring Data JPA）。

**Q: 值对象一定要不可变吗？**
A: 在纯 DDD 理论中，值对象应该是不可变的。但在实践中，如果频繁创建新对象会有性能问题。可以在实体内保护值对象的修改（如通过方法而不是直接 setter）。

**Q: 仓储是否应该支持 SQL 查询？**
A: 不推荐。仓储应该隐藏数据访问细节。复杂的查询应该通过用业务意义的查询方法暴露，而不是原始 SQL。

**Q: 实体和聚合根是同一个概念吗？**
A: 不完全相同。聚合根是实体，但不是所有实体都是聚合根。聚合根是从仓储操作的角度出发的概念。

## 参考

- COLA 官方项目：https://github.com/alibaba/COLA
- DDD 官方著作：《领域驱动设计》- Eric Evans
- DDD 对象模式：https://www.domainlanguage.com/ddd/


