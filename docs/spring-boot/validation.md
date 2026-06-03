# javax.validation 参数校验完全指南

## 概述

`javax.validation`（Bean Validation / JSR-303 / JSR-380）是 Java 标准的参数校验框架。在 Spring Boot 2.7.x 中，默认实现为 **Hibernate Validator**，只需要引入 `spring-boot-starter-validation` 即可自动启用。

### 依赖配置

```xml path=null start=null
<!-- Spring Boot 2.7.x 已包含在 spring-boot-starter-web 中，也可单独引入 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

### 包路径

| 来源 | 包路径 | 说明 |
|------|------|------|
| JSR-380 标准 | `javax.validation.constraints` | Java 官方标准，所有实现都必须支持 |
| Hibernate Validator | `org.hibernate.validator.constraints` | Hibernate 扩展，额外提供的校验注解 |

> **注意**：Spring Boot 3.x 中包路径变更为 `jakarta.validation.constraints`。本文档基于 Spring Boot 2.7.x。

---

## 一、JSR-380 标准注解（核心）

### 1.1 @NotNull — 非空校验

**用途**：校验元素不能为 `null`。适用于任何类型。

```java path=null start=null
import javax.validation.constraints.NotNull;

public class UserDTO {

    @NotNull(message = "用户ID不能为空")
    private Long id;

    @NotNull
    private String username;
}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `message` | `String` | `"{javax.validation.constraints.NotNull.message}"` | 自定义错误消息 |
| `groups` | `Class<?>[]` | `{}` | 校验分组 |
| `payload` | `Class<? extends Payload>[]` | `{}` | 自定义负载 |

---

### 1.2 @Null — 必须为 null

**用途**：校验元素必须为 `null`。较少使用，通常用于某些接口要求字段不能传值。

```java path=null start=null
import javax.validation.constraints.Null;

public class UpdateDTO {

    @Null(message = "创建时不允许传入ID")
    private Long id;

    @NotNull
    private String name;
}
```

---

### 1.3 @NotEmpty — 非空且非空字符串/集合

**用途**：校验元素不能为 `null` 且不能为空。支持的类型：

| 类型 | 判断方式 |
|------|---------|
| `CharSequence`（String等） | 长度 > 0 |
| `Collection` | `size > 0` |
| `Map` | `size > 0` |
| 数组 | 长度 > 0 |

```java path=null start=null
import javax.validation.constraints.NotEmpty;
import java.util.List;

public class OrderDTO {

    @NotEmpty(message = "订单项不能为空")
    private List<OrderItem> items;

    @NotEmpty(message = "收货地址不能为空")
    private String address;
}
```

---

### 1.4 @NotBlank — 非空且至少包含一个非空白字符

**用途**：校验字符串不能为 `null`，且 `trim()` 后长度必须 > 0。**只适用于 `CharSequence`**。

```java path=null start=null
import javax.validation.constraints.NotBlank;

public class LoginDTO {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "密码不能为空")
    private String password;
}
```

`@NotNull` vs `@NotEmpty` vs `@NotBlank` 对比：

| 校验项 | `@NotNull` | `@NotEmpty` | `@NotBlank` |
|-------|-----------|------------|------------|
| `null` | ❌ | ❌ | ❌ |
| `""`（空字符串） | ✅ | ❌ | ❌ |
| `"   "`（纯空格） | ✅ | ✅ | ❌ |
| `"abc"` | ✅ | ✅ | ✅ |
| 适用于集合 | ❌ | ✅ | ❌ |
| 适用于字符串 | ✅ | ✅ | ✅ |

---

### 1.5 @Size — 长度/大小范围校验

**用途**：校验元素大小在指定范围内。支持 `CharSequence`、`Collection`、`Map`、数组。

```java path=null start=null
import javax.validation.constraints.Size;
import java.util.List;

public class ArticleDTO {

    @Size(min = 1, max = 100, message = "标题长度必须在1-100之间")
    private String title;

    @Size(min = 1, max = 5000, message = "内容长度必须在1-5000之间")
    private String content;

    @Size(max = 5, message = "标签最多5个")
    private List<String> tags;
}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `min` | `int` | `0` | 最小长度/大小 |
| `max` | `int` | `Integer.MAX_VALUE` | 最大长度/大小 |
| `message` | `String` | — | 自定义错误消息 |

---

### 1.6 @Min / @Max — 数值范围校验

**用途**：校验数值（含包装类型）的最小/最大值。支持 `byte`、`short`、`int`、`long` 及其包装类、`BigInteger`、`BigDecimal`。

```java path=null start=null
import javax.validation.constraints.Min;
import javax.validation.constraints.Max;

public class ProductDTO {

    @Min(value = 0, message = "价格不能为负数")
    @Max(value = 999999, message = "价格不能超过999999")
    private BigDecimal price;

    @Min(value = 1, message = "数量最少为1")
    @Max(value = 9999, message = "数量不能超过9999")
    private Integer quantity;

    @Min(value = 18, message = "年龄必须大于等于18")
    private int age;
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `long` | 最小值/最大值 |
| `message` | `String` | 自定义错误消息 |

---

### 1.7 @DecimalMin / @DecimalMax — 精确数值范围

**用途**：与 `@Min`/`@Max` 类似，但接受字符串形式的数值，支持更高精度。支持 `BigDecimal`、`BigInteger`、`CharSequence`、`byte`、`short`、`int`、`long` 等。

```java path=null start=null
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.DecimalMax;

public class AccountDTO {

    @DecimalMin(value = "0.01", message = "金额不能小于0.01")
    @DecimalMax(value = "99999999.99", message = "金额超出上限")
    private String amount;

    @DecimalMin(value = "0.0", inclusive = false, message = "利率必须大于0")
    private BigDecimal interestRate;
}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `value` | `String` | — | 最小值/最大值字符串 |
| `inclusive` | `boolean` | `true` | 是否包含等于边界值 |
| `message` | `String` | — | 自定义错误消息 |

---

### 1.8 @Positive / @PositiveOrZero / @Negative / @NegativeOrZero

**用途**：校验数值的正负。支持 `BigDecimal`、`BigInteger`、`byte`、`short`、`int`、`long`、`float`、`double` 及其包装类。

```java path=null start=null
import javax.validation.constraints.Positive;
import javax.validation.constraints.PositiveOrZero;
import javax.validation.constraints.Negative;
import javax.validation.constraints.NegativeOrZero;

public class TransactionDTO {

    @Positive(message = "充值金额必须为正数")
    private BigDecimal rechargeAmount;

    @PositiveOrZero(message = "余额不能为负数")
    private BigDecimal balance;

    @Negative(message = "扣款金额必须为负数")
    private BigDecimal deductAmount;

    @NegativeOrZero(message = "温度不能为正数")
    private Integer temperature;
}
```

| 注解 | 含义 | 允许 0 |
|------|------|--------|
| `@Positive` | 必须为正数 | ❌ |
| `@PositiveOrZero` | 必须为正数或零 | ✅ |
| `@Negative` | 必须为负数 | ❌ |
| `@NegativeOrZero` | 必须为负数或零 | ✅ |

---

### 1.9 @Digits — 整数位和小数位

**用途**：校验数值的整数位和小数位不超过指定范围。

```java path=null start=null
import javax.validation.constraints.Digits;

public class PaymentDTO {

    @Digits(integer = 8, fraction = 2, message = "金额格式错误：最多8位整数和2位小数")
    private BigDecimal amount;

    @Digits(integer = 3, fraction = 0, message = "数量必须为整数（最多3位）")
    private Integer quantity;
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `integer` | `int` | 最大整数位数 |
| `fraction` | `int` | 最大小数位数 |
| `message` | `String` | 自定义错误消息 |

---

### 1.10 @AssertTrue / @AssertFalse — 布尔校验

**用途**：校验 `boolean` 或 `Boolean` 类型的值。

```java path=null start=null
import javax.validation.constraints.AssertTrue;
import javax.validation.constraints.AssertFalse;

public class AgreementDTO {

    @AssertTrue(message = "必须同意用户协议")
    private Boolean agreedToTerms;

    @AssertFalse(message = "此功能暂未开放")
    private Boolean betaFeatureEnabled;
}
```

---

### 1.11 @Past / @PastOrPresent / @Future / @FutureOrPresent — 时间校验

**用途**：校验日期时间是否在过去/未来。支持 `java.util.Date`、`java.util.Calendar`、`java.time.Instant`、`LocalDate`、`LocalDateTime`、`LocalTime` 等。

```java path=null start=null
import javax.validation.constraints.Past;
import javax.validation.constraints.Future;
import javax.validation.constraints.PastOrPresent;
import javax.validation.constraints.FutureOrPresent;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class EventDTO {

    @Past(message = "出生日期必须是过去的时间")
    private LocalDate birthDate;

    @PastOrPresent(message = "创建时间不能是未来时间")
    private LocalDateTime createTime;

    @Future(message = "活动开始时间必须是未来的时间")
    private LocalDateTime startTime;

    @FutureOrPresent(message = "预约时间不能是过去")
    private LocalDateTime appointmentTime;
}
```

| 注解 | 含义 |
|------|------|
| `@Past` | 必须是过去的时间 |
| `@PastOrPresent` | 必须是过去或现在的时间 |
| `@Future` | 必须是未来的时间 |
| `@FutureOrPresent` | 必须是未来或现在的时间 |

---

### 1.12 @Pattern — 正则表达式校验

**用途**：校验字符串是否匹配指定的正则表达式。

```java path=null start=null
import javax.validation.constraints.Pattern;

public class UserDTO {

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Pattern(regexp = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
             message = "邮箱格式不正确")
    private String email;

    @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
             message = "密码必须包含大小写字母、数字和特殊字符，且至少8位")
    private String password;
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `regexp` | `String` | 正则表达式 |
| `flags` | `Pattern.Flag[]` | 正则匹配标志 |
| `message` | `String` | 自定义错误消息 |

---

### 1.13 @Email — 邮箱格式校验

**用途**：校验字符串是否符合邮箱格式。基于 RFC 2822 规范。

```java path=null start=null
import javax.validation.constraints.Email;

public class ContactDTO {

    @Email(message = "请输入有效的邮箱地址")
    private String email;

    @Email(regexp = ".+@company\\.com", message = "必须使用公司邮箱")
    private String companyEmail;
}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `regexp` | `String` | `".*"` | 额外的正则表达式约束 |
| `flags` | `Pattern.Flag[]` | `{}` | 正则匹配标志 |
| `message` | `String` | — | 自定义错误消息 |

---

## 二、Hibernate Validator 扩展注解

> 以下注解来自 `org.hibernate.validator.constraints`，是 Hibernate Validator 提供的额外校验能力。

### 2.1 @Length — 字符串长度校验

**用途**：仅校验字符串长度，与 `@Size` 不同，`@Length` 只适用于字符串。

```java path=null start=null
import org.hibernate.validator.constraints.Length;

public class CommentDTO {

    @Length(min = 1, max = 500, message = "评论长度必须在1-500之间")
    private String content;

    @Length(max = 20, message = "昵称最多20个字符")
    private String nickname;
}
```

---

### 2.2 @Range — 数值范围校验

**用途**：校验数值在指定范围内，支持 `BigDecimal`、`BigInteger`、`String` 及所有数值类型。

```java path=null start=null
import org.hibernate.validator.constraints.Range;

public class ScoreDTO {

    @Range(min = 0, max = 100, message = "分数必须在0-100之间")
    private Integer score;

    @Range(min = 1, max = 5, message = "评分必须在1-5星之间")
    private Integer rating;
}
```

---

### 2.3 @URL — URL 格式校验

**用途**：校验字符串是否是合法的 URL。

```java path=null start=null
import org.hibernate.validator.constraints.URL;

public class WebSiteDTO {

    @URL(message = "请输入合法的网址")
    private String website;

    @URL(protocol = "https", message = "只允许 HTTPS 链接")
    private String secureUrl;

    @URL(host = "github.com", message = "只允许 GitHub 链接")
    private String githubUrl;
}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `protocol` | `String` | `""` | 指定协议（http/https/ftp） |
| `host` | `String` | `""` | 指定主机名 |
| `port` | `int` | `-1` | 指定端口 |
| `regexp` | `String` | `".*"` | 额外的正则约束 |
| `message` | `String` | — | 自定义错误消息 |

---

### 2.4 @CreditCardNumber — 信用卡号校验

**用途**：校验字符串是否通过 Luhn 算法验证（信用卡号格式）。

```java path=null start=null
import org.hibernate.validator.constraints.CreditCardNumber;

public class PaymentDTO {

    @CreditCardNumber(message = "信用卡号格式不正确")
    private String cardNumber;
}
```

---

### 2.5 @ScriptAssert — 类级别脚本校验

**用途**：在类级别使用脚本表达式进行跨字段校验。

```java path=null start=null
import org.hibernate.validator.constraints.ScriptAssert;

@ScriptAssert(lang = "javascript",
              script = "_this.password.equals(_this.confirmPassword)",
              message = "两次密码输入不一致")
public class RegisterDTO {

    @NotBlank
    private String password;

    @NotBlank
    private String confirmPassword;
}
```

---

### 2.6 @UniqueElements — 集合元素唯一性

**用途**：校验集合中的元素不重复。

```java path=null start=null
import org.hibernate.validator.constraints.UniqueElements;
import java.util.List;

public class BatchDTO {

    @UniqueElements(message = "ID列表中存在重复元素")
    private List<Long> ids;
}
```

---

### 2.7 @ISBN — ISBN 书号校验

```java path=null start=null
import org.hibernate.validator.constraints.ISBN;

public class BookDTO {

    @ISBN(message = "ISBN 书号格式不正确")
    private String isbn;
}
```

---

## 三、@Valid 与 @Validated

### 3.1 @Valid（JSR-303 标准）

用于触发**级联校验**（嵌套对象校验）。标注在需要校验的嵌套对象上。

```java path=null start=null
import javax.validation.Valid;
import javax.validation.constraints.NotNull;

// 外层 DTO
public class OrderDTO {

    @NotNull
    @Valid  // 触发级联校验，会校验 OrderItem 内部的注解
    private List<OrderItem> items;

    @Valid  // 校验嵌套对象
    private AddressDTO address;
}

// 内层 DTO（嵌套对象）
public class OrderItem {

    @NotNull
    private Long productId;

    @Min(1)
    private Integer quantity;
}

public class AddressDTO {

    @NotBlank
    private String province;

    @NotBlank
    private String city;
}
```

### 3.2 @Validated（Spring 提供）

Spring 的 `@Validated` 是对 `@Valid` 的扩展，额外支持**分组校验**。

```java path=null start=null
import org.springframework.validation.annotation.Validated;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Null;

// 定义分组接口
public interface Create {}
public interface Update {}

public class UserDTO {

    @Null(groups = Create.class, message = "创建时不允许传入ID")
    @NotNull(groups = Update.class, message = "更新时必须提供ID")
    private Long id;

    @NotBlank(groups = {Create.class, Update.class})
    private String username;
}

// Controller 中使用
@RestController
public class UserController {

    @PostMapping("/user")
    public Response create(@Validated(Create.class) @RequestBody UserDTO dto) {
        // 仅校验 Create 分组
    }

    @PutMapping("/user")
    public Response update(@Validated(Update.class) @RequestBody UserDTO dto) {
        // 仅校验 Update 分组
    }
}
```

### 3.3 @Valid 与 @Validated 对比

| 特性 | `@Valid` | `@Validated` |
|------|---------|-------------|
| 来源 | `javax.validation`（JSR-303） | Spring Framework |
| 分组校验 | ❌ | ✅ |
| 可用在类上 | ❌ | ✅（类级别校验） |
| 可用在方法参数上 | ✅ | ✅ |
| 级联校验 | ✅ | ✅ |
| Controller 层推荐 | ✅ | ✅（需要分组时） |

---

## 四、Controller 中的校验与异常处理

### 4.1 基本用法

```java path=null start=null
import javax.validation.Valid;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    public Response createUser(@Valid @RequestBody UserDTO dto, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            String errorMsg = bindingResult.getFieldError().getDefaultMessage();
            return Response.buildFailure("VALIDATION_ERROR", errorMsg);
        }
        // 业务逻辑
        return Response.buildSuccess();
    }
}
```

### 4.2 全局异常处理器（推荐方式）

配合 `@ControllerAdvice` 统一处理校验异常，避免在每个 Controller 中手写 `BindingResult` 判断。

```java path=null start=null
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import javax.validation.ConstraintViolationException;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 处理 @Valid/@Validated 校验失败 —— @RequestBody 参数校验
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseBody
    public Response handleValidationException(MethodArgumentNotValidException e) {
        String errorMsg = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Response.buildFailure("VALIDATION_ERROR", errorMsg);
    }

    /**
     * 处理 @Validated 校验失败 —— @RequestParam/@PathVariable 参数校验
     * 需要在 Controller 类上加 @Validated 注解
     */
    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseBody
    public Response handleConstraintViolationException(ConstraintViolationException e) {
        String errorMsg = e.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining("; "));
        return Response.buildFailure("VALIDATION_ERROR", errorMsg);
    }
}
```

### 4.3 @RequestParam / @PathVariable 校验

需要在 Controller 类上添加 `@Validated`，然后在方法参数上直接使用校验注解。

```java path=null start=null
import org.springframework.validation.annotation.Validated;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;

@Validated  // 必须加在类上
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public Response getUser(@PathVariable @Min(value = 1, message = "ID必须大于0") Long id) {
        // ...
    }

    @GetMapping("/search")
    public Response search(@RequestParam @NotBlank(message = "关键词不能为空") String keyword) {
        // ...
    }
}
```

---

## 五、自定义校验注解

当内置注解无法满足需求时，可以自定义校验注解。

### 5.1 定义注解

```java path=null start=null
import javax.validation.Constraint;
import javax.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = {PhoneValidator.class})  // 关联校验器
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface Phone {

    String message() default "手机号格式不正确";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
```

### 5.2 实现校验器

```java path=null start=null
import javax.validation.ConstraintValidator;
import javax.validation.ConstraintValidatorContext;

public class PhoneValidator implements ConstraintValidator<Phone, String> {

    private static final String PHONE_REGEX = "^1[3-9]\\d{9}$";

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // null 由 @NotNull 处理，这里返回 true
        if (value == null) {
            return true;
        }
        return value.matches(PHONE_REGEX);
    }
}
```

### 5.3 使用自定义注解

```java path=null start=null
public class UserDTO {

    @Phone(message = "请输入正确的手机号")
    private String phone;
}
```

---

## 六、实战示例

### 完整的用户注册 DTO

```java path=null start=null
import javax.validation.Valid;
import javax.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public class RegisterDTO {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 20, message = "用户名长度必须在3-20之间")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "用户名只能包含字母、数字和下划线")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 32, message = "密码长度必须在8-32之间")
    @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,}$",
             message = "密码必须包含大小写字母和数字")
    private String password;

    @NotBlank(message = "确认密码不能为空")
    private String confirmPassword;

    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Email(message = "邮箱格式不正确")
    private String email;

    @NotNull(message = "出生日期不能为空")
    @Past(message = "出生日期必须是过去的时间")
    private LocalDate birthDate;

    @NotNull(message = "年龄不能为空")
    @Min(value = 0, message = "年龄不能为负数")
    @Max(value = 150, message = "年龄不能超过150")
    private Integer age;

    @AssertTrue(message = "必须同意用户协议")
    private Boolean agreedToTerms;

    @Valid  // 级联校验
    @NotEmpty(message = "地址列表不能为空")
    private List<AddressDTO> addresses;
}
```

### 完整的 Controller

```java path=null start=null
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import javax.validation.Valid;
import javax.validation.constraints.Min;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping("/register")
    public Response register(@Valid @RequestBody RegisterDTO dto) {
        // 校验通过后执行业务逻辑
        // 校验失败由 GlobalExceptionHandler 统一处理
        return Response.buildSuccess();
    }

    @Validated
    @GetMapping("/{id}")
    public Response getUser(@PathVariable @Min(value = 1, message = "ID必须大于0") Long id) {
        return Response.buildSuccess();
    }
}
```

---

## 七、注解速查表

### JSR-380 标准注解（`javax.validation.constraints`）

| 注解 | 适用类型 | 核心参数 | 说明 |
|------|---------|---------|------|
| `@Null` | 任意 | `message` | 必须为 null |
| `@NotNull` | 任意 | `message` | 不能为 null |
| `@NotEmpty` | CharSequence / Collection / Map / 数组 | `message` | 不能为 null 且不能为空 |
| `@NotBlank` | CharSequence | `message` | 不能为 null 且至少包含一个非空白字符 |
| `@Size` | CharSequence / Collection / Map / 数组 | `min`, `max` | 大小在 min 和 max 之间 |
| `@Min` | 数值类型 | `value` | 必须 ≥ value |
| `@Max` | 数值类型 | `value` | 必须 ≤ value |
| `@DecimalMin` | 数值类型 / CharSequence | `value`, `inclusive` | 必须 ≥ value |
| `@DecimalMax` | 数值类型 / CharSequence | `value`, `inclusive` | 必须 ≤ value |
| `@Positive` | 数值类型 | `message` | 必须为正数 |
| `@PositiveOrZero` | 数值类型 | `message` | 必须为正数或零 |
| `@Negative` | 数值类型 | `message` | 必须为负数 |
| `@NegativeOrZero` | 数值类型 | `message` | 必须为负数或零 |
| `@Digits` | 数值类型 | `integer`, `fraction` | 整数位和小数位限制 |
| `@AssertTrue` | boolean / Boolean | `message` | 必须为 true |
| `@AssertFalse` | boolean / Boolean | `message` | 必须为 false |
| `@Past` | 日期时间类型 | `message` | 必须是过去的时间 |
| `@PastOrPresent` | 日期时间类型 | `message` | 必须是过去或现在 |
| `@Future` | 日期时间类型 | `message` | 必须是未来的时间 |
| `@FutureOrPresent` | 日期时间类型 | `message` | 必须是未来或现在 |
| `@Pattern` | CharSequence | `regexp`, `flags` | 必须匹配正则表达式 |
| `@Email` | CharSequence | `regexp`, `flags` | 邮箱格式校验 |

### Hibernate Validator 扩展注解（`org.hibernate.validator.constraints`）

| 注解 | 适用类型 | 核心参数 | 说明 |
|------|---------|---------|------|
| `@Length` | CharSequence | `min`, `max` | 字符串长度校验 |
| `@Range` | 数值类型 / CharSequence | `min`, `max` | 数值范围校验 |
| `@URL` | CharSequence | `protocol`, `host`, `port` | URL 格式校验 |
| `@CreditCardNumber` | CharSequence | `message` | 信用卡号校验（Luhn 算法） |
| `@ScriptAssert` | 类（TYPE） | `lang`, `script` | 跨字段脚本校验 |
| `@UniqueElements` | Collection | `message` | 集合元素唯一性 |
| `@ISBN` | CharSequence | `message` | ISBN 书号校验 |
| `@EAN` | CharSequence | `message` | EAN 商品条码校验 |
| `@Currency` | `MonetaryAmount` | `value` | 货币类型校验 |

---

## 八、常见问题

**Q: `@NotNull`、`@NotEmpty`、`@NotBlank` 有什么区别？**

| 场景 | `@NotNull` | `@NotEmpty` | `@NotBlank` |
|------|-----------|------------|------------|
| `null` | ❌ 不通过 | ❌ 不通过 | ❌ 不通过 |
| `""` | ✅ 通过 | ❌ 不通过 | ❌ 不通过 |
| `"   "` | ✅ 通过 | ✅ 通过 | ❌ 不通过 |
| `"abc"` | ✅ 通过 | ✅ 通过 | ✅ 通过 |

**Q: `@Valid` 和 `@Validated` 有什么区别？**
- `@Valid` 是 JSR-303 标准，支持级联校验
- `@Validated` 是 Spring 提供的，额外支持分组校验
- Controller 类上只能加 `@Validated`（不能加 `@Valid`）

**Q: 校验失败后如何返回自定义格式？**
- 使用 `@RestControllerAdvice` + `@ExceptionHandler(MethodArgumentNotValidException.class)` 统一处理，自定义返回格式

**Q: 如何实现跨字段校验（如密码和确认密码）？**
- 使用 `@ScriptAssert` 在类级别校验
- 或者自定义类级别的 `ConstraintValidator`

**Q: Spring Boot 2.7.x 和 3.x 的校验注解有什么区别？**
- 2.7.x：`javax.validation.constraints.*`
- 3.x：`jakarta.validation.constraints.*`
- 功能完全一致，只是包名变更

---

## 九、参考资源

- [Jakarta Bean Validation 3.1 规范](https://jakarta.ee/specifications/bean-validation/3.1/)
- [Hibernate Validator 官方文档](https://hibernate.org/validator/documentation/)
- [Spring Boot 2.7.x 文档](../spring-boot/)