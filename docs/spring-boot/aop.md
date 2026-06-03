# AOP 切面编程

AOP（Aspect-Oriented Programming）将横切关注点（日志、事务、权限等）从业务逻辑中分离，通过切面织入。

> Spring Boot 2.7.x 中 AOP 代理默认使用 **CGLIB**（`spring.aop.proxy-target-class=true` 默认匹配）。本文使用 AspectJ 注解风格。

## 一、依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

该 Starter 会自动引入 `spring-aop` + `aspectjweaver`。

## 二、核心注解

| 注解 | 说明 |
|------|------|
| `@Aspect` | 声明该类为切面类 |
| `@Pointcut` | 定义切入点（在何处切入） |
| `@Before` | 前置通知（目标方法执行前） |
| `@After` | 后置通知（目标方法执行后，无论是否异常） |
| `@AfterReturning` | 返回通知（目标方法正常返回后） |
| `@AfterThrowing` | 异常通知（目标方法抛出异常后） |
| `@Around` | 环绕通知（包裹目标方法执行前后，功能最强） |

## 三、@Pointcut 切入点表达式

### 3.1 表达式的组成

切入点表达式由三部分组成：

```text
execution(修饰符模式? 返回类型模式 方法名模式(参数模式) 异常模式?)
```

常用格式：

```java
// 匹配指定包下所有方法
@Pointcut("execution(* com.example.service.*.*(..))")
public void serviceLayer() {}

// 匹配所有 Controller
@Pointcut("execution(* com.example.controller.*.*(..))")
public void controllerLayer() {}

// 匹配指定类的所有方法
@Pointcut("execution(* com.example.service.UserService.*(..))")
public void userServiceMethods() {}

// 匹配的第一个 * 表示任意返回类型
// (..) 表示任意参数列表
```

### 3.2 常见表达式示例

| 表达式 | 说明 |
|--------|------|
| `* com.example.*.*(..)` | com.example 包下任意类的任意方法 |
| `* com.example..*.*(..)` | com.example 包及子包下任意类 |
| `* com.example.*.save*(..)` | 以 save 开头的方法 |
| `* com.example.*.*(String, ..)` | 第一个参数为 String 的方法 |
| `* com.example.*.*(..) throws Exception` | 抛出 Exception 的方法 |

### 3.3 组合切入点

```java
@Pointcut("execution(* com.example.service.*.*(..))")
public void serviceLayer() {}

@Pointcut("execution(* com.example.controller.*.*(..))")
public void controllerLayer() {}

// 组合：service 层 + controller 层
@Pointcut("serviceLayer() || controllerLayer()")
public void allPublicLayers() {}
```

### 3.4 @annotation 切入点

按注解匹配：

```java
// 匹配标注了 @MyLog 注解的方法
@Pointcut("@annotation(com.example.annotation.MyLog)")
public void logAnnotated() {}

// 匹配标注了 @Transactional 的方法
@Pointcut("@annotation(org.springframework.transaction.annotation.Transactional)")
public void transactionalMethods() {}
```

## 四、通知类型详解

### 4.1 @Before 前置通知

目标方法执行前执行，无法阻止方法执行（除抛异常外）。

```java
@Aspect
@Component
public class LogAspect {

    @Before("execution(* com.example.service.*.*(..))")
    public void beforeAdvice(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArguments();
        System.out.println("前置通知 → " + methodName + "，参数: " + Arrays.toString(args));
    }
}
```

### 4.2 @After 后置通知

目标方法执行后执行（类似 finally，**无论是否异常都会执行**）。

```java
@After("execution(* com.example.service.*.*(..))")
public void afterAdvice(JoinPoint joinPoint) {
    System.out.println("后置通知 → " + joinPoint.getSignature().getName() + " 执行完毕");
}
```

### 4.3 @AfterReturning 返回通知

目标方法**正常返回**后执行，可获取返回值。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `pointcut` | `String` | 切入点表达式或方法引用 |
| `returning` | `String` | 绑定返回值的参数名 |

```java
@AfterReturning(
    value = "execution(* com.example.service.*.*(..))",
    returning = "result"
)
public void afterReturningAdvice(JoinPoint joinPoint, Object result) {
    System.out.println("返回通知 → " + joinPoint.getSignature().getName()
                       + "，返回值: " + result);
}
```

### 4.4 @AfterThrowing 异常通知

目标方法**抛出异常**后执行。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `pointcut` | `String` | 切入点表达式或方法引用 |
| `throwing` | `String` | 绑定异常对象的参数名 |

```java
@AfterThrowing(
    value = "execution(* com.example.service.*.*(..))",
    throwing = "ex"
)
public void afterThrowingAdvice(JoinPoint joinPoint, Exception ex) {
    System.err.println("异常通知 → " + joinPoint.getSignature().getName()
                       + "，异常: " + ex.getMessage());
}
```

### 4.5 @Around 环绕通知（最强大）

完全包裹目标方法，可控制是否执行、修改参数、修改返回值。

```java
@Around("execution(* com.example.service.*.*(..))")
public Object aroundAdvice(ProceedingJoinPoint joinPoint) throws Throwable {
    String methodName = joinPoint.getSignature().getName();
    long start = System.currentTimeMillis();

    System.out.println("环绕前置 → " + methodName);

    Object result;
    try {
        result = joinPoint.proceed();  // ❗ 必须调用，否则目标方法不执行
    } catch (Throwable e) {
        System.err.println("环绕异常 → " + methodName + ": " + e.getMessage());
        throw e;  // 可重新抛出或处理
    }

    long duration = System.currentTimeMillis() - start;
    System.out.println("环绕后置 → " + methodName + "，耗时: " + duration + "ms");
    return result;
}
```

## 五、切面方法参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `JoinPoint` | `org.aspectj.lang.JoinPoint` | 切入点对象（`@Before`/`@After`/`@AfterReturning`/`@AfterThrowing` 可用） |
| `ProceedingJoinPoint` | `org.aspectj.lang.ProceedingJoinPoint` | 可执行目标方法的增强 JoinPoint（**仅 `@Around` 可用**） |

### JoinPoint 常用方法

| 方法 | 返回类型 | 说明 |
|------|---------|------|
| `getSignature()` | `Signature` | 获取方法签名 |
| `getSignature().getName()` | `String` | 获取方法名 |
| `getArgs()` | `Object[]` | 获取方法参数 |
| `getTarget()` | `Object` | 获取目标对象 |

### ProceedingJoinPoint 独有方法

| 方法 | 返回类型 | 说明 |
|------|---------|------|
| `proceed()` | `Object` | 执行目标方法 |
| `proceed(Object[] args)` | `Object` | 用修改后的参数执行目标方法 |

## 六、完整示例：操作日志切面

```java
// 自定义注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface OpLog {
    String value() default "";
}
```

```java
@Aspect
@Component
@Slf4j
public class OpLogAspect {

    @Pointcut("@annotation(opLog)")
    public void opLogPointcut(OpLog opLog) {}

    @Around("opLogPointcut(opLog)")
    public Object around(ProceedingJoinPoint joinPoint, OpLog opLog) throws Throwable {
        String operation = opLog.value();
        String methodName = joinPoint.getSignature().toString();
        Object[] args = joinPoint.getArgs();

        log.info("操作开始: [{}] - {} - 参数: {}", operation, methodName, args);
        long start = System.currentTimeMillis();

        Object result;
        try {
            result = joinPoint.proceed();
            log.info("操作成功: [{}] - {} - 耗时: {}ms", operation, methodName,
                     System.currentTimeMillis() - start);
        } catch (Throwable e) {
            log.error("操作失败: [{}] - {} - 异常: {}", operation, methodName, e.getMessage());
            throw e;
        }
        return result;
    }
}
```

```java
// 使用
@Service
public class UserService {

    @OpLog("创建用户")
    public User create(User user) {
        // 业务逻辑
    }
}
```

## 七、执行顺序

多个切面同时作用于同一个切入点时的执行顺序：

```text
@Around 前置 → @Before → 目标方法 → @AfterReturning/@AfterThrowing → @After → @Around 后置
```

::: info
`@AfterReturning` 和 `@AfterThrowing` 是互斥的，正常返回走前者，抛异常走后者。`@After` 类似 finally，无论如何都执行。
:::

多个切面的顺序可以通过 `@Order` 控制：

```java
@Aspect
@Component
@Order(1)  // 值越小优先级越高
public class FirstAspect { ... }
```

## 八、速查表

| 注解 / 类 | 用途 |
|----------|------|
| `@Aspect` | 声明切面类 |
| `@Pointcut` | 定义切入点 |
| `@Before` | 前置通知 |
| `@After` | 后置通知（类似 finally） |
| `@AfterReturning` | 返回通知（获取返回值） |
| `@AfterThrowing` | 异常通知（获取异常） |
| `@Around` | 环绕通知 |
| `JoinPoint` | 连接点信息 |
| `ProceedingJoinPoint` | 可执行目标方法的连接点（仅 `@Around`） |
| `@Order` | 控制切面执行顺序 |