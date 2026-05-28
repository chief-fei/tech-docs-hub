# Lombok 注解说明（基于官方文档校对）

> 说明：本页依据 Project Lombok 官方特性页整理。
> - Stable: https://projectlombok.org/features/all
> - Experimental: https://projectlombok.org/features/experimental/all

## 1. 快速结论

- Lombok 的注解大致分为：`数据类`、`构造器`、`对象方法`、`构建器`、`空安全`、`并发/异常`、`日志`、`实验特性`。
- 你当前项目最常用的是 `@Data`（例如 `demo-web-client/src/main/java/com/alibaba/demo/dto/CustomerAddCmd.java`、`demo-web-infrastructure/src/main/java/com/alibaba/demo/customer/CustomerDO.java`）。
- 在生产代码中，建议优先用“更精确”的注解组合，避免无脑 `@Data`。

---

## 2. Stable 注解清单（常用 + 作用 + 场景）

### 2.1 数据与访问器

#### `@Getter` / `@Setter`
- 作用：生成 getter / setter。
- 常见场景：DTO、配置对象、DO。
- 示例：
```java
@Getter
@Setter
public class CustomerDTO {
    private String companyName;
}
```
- 注意：实体对象是否暴露 setter 要谨慎，领域模型不建议全部可变。

#### `@Getter(lazy = true)`
- 作用：惰性初始化字段（线程安全包装）。
- 场景：昂贵计算结果缓存。
- 示例：
```java
public class Foo {
    @Getter(lazy = true)
    private final byte[] payload = loadBigData();
}
```

### 2.2 对象方法

#### `@ToString`
- 作用：生成 `toString()`。
- 场景：日志打印、调试。
- 注意：避免把密码、token 打进日志。

#### `@EqualsAndHashCode`
- 作用：生成 `equals/hashCode`。
- 场景：集合去重、键对象。
- 注意：JPA 实体要谨慎选择字段，避免把可变字段放进 hash。

### 2.3 构造器

#### `@NoArgsConstructor`
- 作用：生成无参构造。
- 场景：框架反射创建对象（JPA/Jackson 等）。

#### `@RequiredArgsConstructor`
- 作用：为 `final` 和 `@NonNull` 字段生成构造器。
- 场景：推荐用于依赖注入不可变对象。

#### `@AllArgsConstructor`
- 作用：全参构造。
- 场景：测试构造、简单 VO。

### 2.4 聚合快捷注解

#### `@Data`
- 作用：等价组合 `@Getter + @Setter + @ToString + @EqualsAndHashCode + @RequiredArgsConstructor`。
- 场景：纯数据载体（DTO/DO）。
- 注意：
  - 领域实体上滥用会导致“贫血模型 + 过度可变”。
  - 可能生成你并不想暴露的 setter。

#### `@Value`
- 作用：不可变数据类（final class / private final 字段风格）。
- 场景：值对象、配置快照、返回对象。

### 2.5 构建器

#### `@Builder`
- 作用：生成 Builder API。
- 场景：参数多、可选字段多、对象构造可读性要求高。
- 常搭配：`@Builder.Default`、`@Singular`。
- 示例：
```java
@Builder
public class CustomerQuery {
    @Builder.Default
    private int pageSize = 20;
    @Singular
    private java.util.List<String> tags;
}
```

### 2.6 不可变拷贝

#### `@With`
- 作用：生成“拷贝并改一个字段”的 with 方法。
- 场景：不可变对象更新。

### 2.7 空安全与资源管理

#### `@NonNull`
- 作用：在方法/构造参数处生成空检查。
- 场景：公共 API 的入参保护。

#### `@Cleanup`
- 作用：自动在作用域结束调用 `close()`（类似 try-finally）。
- 场景：资源管理（流、连接等）。
- 注意：现代 Java 可优先 `try-with-resources`，可读性通常更好。

### 2.8 异常与并发

#### `@SneakyThrows`
- 作用：绕过受检异常显式声明。
- 场景：测试代码、极简适配层。
- 注意：业务核心代码慎用，降低可读性和可维护性。

#### `@Synchronized`
- 作用：生成基于私有锁对象的同步方法（比 `synchronized(this)` 更安全）。
- 场景：并发敏感的本地状态更新。

#### `@Locked`
- 作用：使用 `ReentrantLock` 风格加锁。
- 场景：需要 lock 语义时（可中断、公平锁等扩展）。

### 2.9 日志注解

- `@Slf4j`（最常用）
- `@Log`
- `@Log4j`, `@Log4j2`
- `@CommonsLog`
- `@Flogger`
- `@JBossLog`
- `@XSlf4j`
- `@CustomLog`

作用：自动生成 `log` 字段。

示例：
```java
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class CustomerService {
    public void run() {
        log.info("start");
    }
}
```

### 2.10 局部变量语法糖

#### `val`
- 作用：局部 final 类型推断。

#### `var`
- 作用：局部可变类型推断。

注意：JDK10+ 自带 `var`，团队需统一风格。

---

## 3. Experimental 注解清单（官方实验页）

> 实验特性语义：API 可能调整、维护优先级低于 stable、可能被移除或晋升。

### 3.1 `@Accessors`
- 作用：链式/流式访问器风格（如 `obj.name("x").age(1)`）。
- 场景：Builder-like 的普通对象链式赋值。

### 3.2 `@ExtensionMethod`
- 作用：给现有类型“看起来像扩展方法”。
- 场景：提升工具方法调用可读性。

### 3.3 `@FieldDefaults`
- 作用：统一字段默认修饰符（如默认 `private final`）。
- 场景：减少模板修饰符。

### 3.4 `@Delegate`
- 作用：委托方法转发，简化组合模式样板代码。
- 场景：包装器、代理对象。

### 3.5 `onMethod=` / `onConstructor=` / `onParam=`
- 作用：在 Lombok 生成的方法/构造器/参数上附加注解。
- 场景：与框架注解协同（验证、序列化等）。

### 3.6 `@UtilityClass`
- 作用：工具类强化（final + 私有构造 + 全静态）。
- 场景：纯工具函数集合。

### 3.7 `@Helper`
- 作用：辅助方法语法糖（较少使用）。

### 3.8 `@FieldNameConstants`
- 作用：为字段生成常量名。
- 场景：构建条件查询、避免硬编码字符串。

### 3.9 `@SuperBuilder`
- 作用：支持继承层次的 Builder。
- 场景：父子类都要构建器时。

### 3.10 `@Tolerate`
- 作用：告知 Lombok 忽略某些已有方法/构造，避免冲突。

### 3.11 `@Jacksonized`
- 作用：与 `@Builder/@SuperBuilder` 配合，增强 Jackson 反序列化支持。
- 场景：API 层请求/响应对象与 Builder 并用。

### 3.12 `@StandardException`
- 作用：快速生成标准异常构造器。
- 场景：自定义异常类模板化。

---

## 4. 你项目里的 Lombok 使用建议

基于当前代码（`@Data` 使用较多）：

1. DTO / DO 保留 `@Data`：如 `demo-web-client/src/main/java/com/alibaba/demo/dto/data/CustomerDTO.java`、`demo-web-infrastructure/src/main/java/com/alibaba/demo/customer/CustomerDO.java`。
2. 领域实体尽量精确注解：优先 `@Getter` + 有选择的 setter/业务方法，减少“全部可变”。
3. 服务类建议日志注解：可在应用层引入 `@Slf4j`，统一日志风格。
4. 参数多的查询对象可考虑 `@Builder`，提高构造可读性。
5. `@SneakyThrows`、实验注解仅在明确收益场景使用，并在代码评审中注明理由。

---

## 5. 常见坑与规避

- `@Data` + JPA Entity：`equals/hashCode` 字段选择不当会引发集合与代理问题。
- `@ToString` 泄漏敏感字段：对密码、token 用 `@ToString.Exclude`。
- `@Builder` 默认值失效：需要 `@Builder.Default`。
- `@Singular` 集合性能与对象分配：热点路径要评估。
- 实验注解升级风险：升级 Lombok 前先跑全量测试。

---

## 6. 推荐文档入口

- 官方稳定特性：`https://projectlombok.org/features/all`
- 官方实验特性：`https://projectlombok.org/features/experimental/all`
- 官方 API：`https://projectlombok.org/api/`


