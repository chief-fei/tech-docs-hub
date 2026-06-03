# 全局异常处理

Spring Boot 提供了 `@ControllerAdvice` + `@ExceptionHandler` 机制，实现全局统一的异常处理，避免在每个 Controller 中重复编写 try-catch。

## 一、核心注解

### 1.1 @ControllerAdvice

全局控制器增强器，标注在类上，对所有 Controller 生效。

| 参数 | 类型 | 说明 |
|------|------|------|
| `basePackages` | `String[]` | 指定扫描的包路径 |
| `basePackageClasses` | `Class<?>[]` | 指定包中的类（以此类所在的包为准） |
| `assignableTypes` | `Class<?>[]` | 指定 Controller 类型 |
| `annotations` | `Class<?>[]` | 只增强标注了特定注解的 Controller |

```java
// 全局生效
@ControllerAdvice
public class GlobalExceptionHandler { }

// 只对指定包生效
@ControllerAdvice(basePackages = "com.example.api")
public class ApiExceptionHandler { }

// 只对 @RestController 生效
@ControllerAdvice(annotations = RestController.class)
public class RestExceptionHandler { }
```

### 1.2 @ExceptionHandler

标注在方法上，声明该方法处理哪种异常。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `Class<? extends Throwable>[]` | 需要处理的异常类型（可同时指定多个） |

```java
@ExceptionHandler({IllegalArgumentException.class, NullPointerException.class})
public Result<?> handleRuntimeExceptions(RuntimeException e) {
    return Result.error(400, e.getMessage());
}
```

### 1.3 @RestControllerAdvice

`@RestControllerAdvice` = `@ControllerAdvice` + `@ResponseBody`，返回 JSON 响应时使用。

```java
@RestControllerAdvice
public class GlobalExceptionHandler { }
```

## 二、统一返回体

定义统一的 Result 类便于前端解析：

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {
    private Integer code;
    private String message;
    private T data;

    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }
}
```

## 三、完整异常处理示例

```java
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 1. 自定义业务异常
    @ExceptionHandler(BusinessException.class)
    public Result<?> handleBusinessException(BusinessException e) {
        log.warn("业务异常: code={}, message={}", e.getCode(), e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    // 2. 参数校验异常 —— @Valid 校验失败
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<?> handleValidationException(MethodArgumentNotValidException e) {
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "参数校验失败";
        return Result.error(400, message);
    }

    // 3. 参数绑定异常（GET 请求参数类型转换失败等）
    @ExceptionHandler(BindException.class)
    public Result<?> handleBindException(BindException e) {
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "参数绑定失败";
        return Result.error(400, message);
    }

    // 4. 空指针异常
    @ExceptionHandler(NullPointerException.class)
    public Result<?> handleNullPointerException(NullPointerException e) {
        log.error("空指针异常", e);
        return Result.error(500, "系统内部错误");
    }

    // 5. 兜底异常：处理所有未捕获的异常
    @ExceptionHandler(Exception.class)
    public Result<?> handleException(Exception e) {
        log.error("未捕获异常", e);
        return Result.error(500, "服务器内部异常，请稍后重试");
    }
}
```

## 四、自定义业务异常

```java
public class BusinessException extends RuntimeException {
    private Integer code;

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message) {
        this(500, message);
    }

    public Integer getCode() {
        return code;
    }
}

// 使用
throw new BusinessException(1001, "用户不存在");
```

## 五、@ExceptionHandler 方法参数

`@ExceptionHandler` 方法可以注入以下参数：

| 参数类型 | 说明 |
|---------|------|
| `Exception` 及其子类 | 捕获的异常对象 |
| `HttpServletRequest` / `HttpServletResponse` | 请求和响应对象 |
| `HttpSession` | 会话对象 |
| `java.security.Principal` | 当前认证用户 |
| `OutputStream` / `Writer` | 输出流 |
| `Model` | 视图模型 |
| `RedirectAttributes` | 重定向属性 |

## 六、匹配规则

`@ExceptionHandler` 的值越具体优先级越高，按以下匹配：

1. 精确匹配：抛出的异常类型与 `@ExceptionHandler` 声明的类型完全相同
2. 继承匹配：异常类型是声明类型的子类
3. 最佳匹配原则：子类异常处理器优先于父类异常处理器

```java
// RuntimeException 的处理器优先级高于 Exception 的处理器
@ExceptionHandler(RuntimeException.class)  // 对 RuntimeException 更具体
@ExceptionHandler(Exception.class)         // 范围更大，优先级低
```

## 七、继承 ResponseEntityExceptionHandler

Spring 提供的 `ResponseEntityExceptionHandler` 内置了对 Spring MVC 异常的处理（如 `HttpMessageNotReadableException`、`MethodArgumentTypeMismatchException` 等），可继承并重写：

```java
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // 重写 Spring 内置异常的处理方式
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex,
            HttpHeaders headers,
            HttpStatus status,
            WebRequest request) {
        return new ResponseEntity<>(Result.error(400, "请求体格式错误"), HttpStatus.BAD_REQUEST);
    }

    // 自定义异常
    @ExceptionHandler(BusinessException.class)
    public Result<?> handleBusinessException(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }
}
```

## 八、速查表

| 注解 / 类 | 用途 |
|----------|------|
| `@ControllerAdvice` | 全局 Controller 增强 |
| `@RestControllerAdvice` | `@ControllerAdvice` + `@ResponseBody` |
| `@ExceptionHandler` | 声明处理异常的类型 |
| `ResponseEntityExceptionHandler` | Spring 内置异常处理基类 |
| `MethodArgumentNotValidException` | `@Valid` 校验失败时抛出 |
| `BindException` | 参数绑定失败时抛出 |
| `HttpMessageNotReadableException` | 请求体 JSON 格式错误 |