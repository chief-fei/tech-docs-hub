# Hutool 工具类库完全指南

## 概述

Hutool（"糊涂"工具）是一个功能丰富、简单易用的 Java 工具类库。它封装了 JDK 的常用方法，提供了字符串、集合、日期、文件、HTTP、加密等全方位的工具类，大大简化了日常开发。

> **兼容性**：Hutool 5.8.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

---

## 一、依赖配置

### Maven

```xml path=null start=null
<!-- 方式一：引入全部模块（推荐） -->
<dependency>
    <groupId>cn.hutool</groupId>
    <artifactId>hutool-all</artifactId>
    <version>5.8.44</version>
</dependency>

<!-- 方式二：按需引入单个模块 -->
<dependency>
    <groupId>cn.hutool</groupId>
    <artifactId>hutool-core</artifactId>
    <version>5.8.44</version>
</dependency>
<dependency>
    <groupId>cn.hutool</groupId>
    <artifactId>hutool-http</artifactId>
    <version>5.8.44</version>
</dependency>
<dependency>
    <groupId>cn.hutool</groupId>
    <artifactId>hutool-json</artifactId>
    <version>5.8.44</version>
</dependency>
```

### 模块列表

| 模块 | Artifact ID | 说明 |
|------|-------------|------|
| 核心模块 | `hutool-core` | 字符串、集合、日期、Bean、反射、IO 等 |
| HTTP 模块 | `hutool-http` | HTTP 客户端封装 |
| JSON 模块 | `hutool-json` | JSON 解析与序列化 |
| 加密模块 | `hutool-crypto` | 对称/非对称加密、摘要、签名 |
| 数据库模块 | `hutool-db` | JDBC 封装、简易 ORM |
| 脚本模块 | `hutool-script` | JavaScript/Groovy 等脚本引擎 |
| Excel 模块 | `hutool-poi` | Excel 读写 |
| 图片模块 | `hutool-captcha` | 验证码生成 |
| 定时任务 | `hutool-cron` | Cron 表达式定时任务 |
| 完整包 | `hutool-all` | 包含以上所有模块 |

---

## 二、核心工具类（hutool-core）

### 2.1 StrUtil — 字符串工具

字符串处理的核心工具类，提供判空、截取、格式化、转换等方法。

```java path=null start=null
import cn.hutool.core.util.StrUtil;

// ======== 判空操作 ========
StrUtil.isBlank("  ");              // true（空白字符也算空）
StrUtil.isEmpty("");                // true
StrUtil.isNotBlank("abc");          // true
StrUtil.hasBlank("a", "", "b");     // true（任意一个为空）

// ======== 去除空白 ========
StrUtil.trim("  hello  ");          // "hello"

// ======== 字符串判断 ========
StrUtil.startWith("hello", "he");           // true
StrUtil.startWithIgnoreCase("Hello", "he"); // true
StrUtil.contains("hello world", "world");   // true

// ======== 字符串截取 ========
StrUtil.sub("hello world", 0, 5);           // "hello"
StrUtil.subBefore("hello@world", "@", false); // "hello"
StrUtil.subAfter("hello@world", "@", false);  // "world"

// ======== 占位符格式化（类似 slf4j） ========
StrUtil.format("Hello, {}! Today is {}", "Hutool", "Monday");
// 结果: "Hello, Hutool! Today is Monday"

// ======== 字符串填充 ========
StrUtil.padPre("1", 3, '0');   // "001"（左填充）
StrUtil.padAfter("1", 3, '0');  // "100"（右填充）

// ======== 驼峰与下划线互转 ========
StrUtil.toCamelCase("user_name");      // "userName"
StrUtil.toUnderlineCase("userName");   // "user_name"

// ======== 字符串拼接与分割 ========
StrUtil.join(",", "a", "b", "c");      // "a,b,c"
StrUtil.split("a,b,c", ",");           // ["a", "b", "c"]

// ======== 移除前后缀 ========
StrUtil.removePrefix("test.txt", "test.");   // "txt"
StrUtil.removeSuffix("test.txt", ".txt");    // "test"

// ======== 其他 ========
StrUtil.repeat("ab", 3);              // "ababab"
StrUtil.nullToEmpty(null);            // ""
StrUtil.replace("hello world", "world", "hutool"); // "hello hutool"
```

### 2.2 CollUtil — 集合工具

```java path=null start=null
import cn.hutool.core.collection.CollUtil;
import java.util.*;

// ======== 集合创建 ========
List<String> list = CollUtil.newArrayList("a", "b", "c");
Set<String> set = CollUtil.newHashSet("a", "b", "c");
LinkedList<String> linkedList = CollUtil.newLinkedList("a", "b");

// ======== 集合判空 ========
CollUtil.isEmpty(list);          // 同时检查 null 和空
CollUtil.isNotEmpty(list);
CollUtil.hasNull(list);          // 是否包含 null 元素

// ======== 集合操作 ========
List<String> union = CollUtil.union(list1, list2);       // 并集
List<String> intersection = CollUtil.intersection(list1, list2); // 交集
List<String> disjunction = CollUtil.disjunction(list1, list2);   // 差集

// ======== 集合过滤 ========
List<String> filtered = CollUtil.filter(list, s -> s.startsWith("a"));

// ======== 集合分页 ========
List<List<String>> pages = CollUtil.page(list, 0, 10);  // 每页10条

// ======== 集合排序 ========
CollUtil.sort(list, Comparator.naturalOrder());
CollUtil.reverse(list);
```

### 2.3 DateUtil — 日期时间工具

```java path=null start=null
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.date.DateTime;
import cn.hutool.core.date.DateField;

// ======== 日期解析 ========
DateTime date = DateUtil.parse("2024-06-03");
DateTime dateTime = DateUtil.parse("2024-06-03 12:30:00");
DateTime dateWithFormat = DateUtil.parse("2024/06/03", "yyyy/MM/dd");

// ======== 日期格式化 ========
String now = DateUtil.now();                    // "2024-06-03 12:30:00"
String today = DateUtil.today();                // "2024-06-03"
String formatted = DateUtil.format(date, "yyyy年MM月dd日");

// ======== 日期计算 ========
DateTime tomorrow = DateUtil.offsetDay(date, 1);
DateTime nextMonth = DateUtil.offsetMonth(date, 1);
DateTime beginOfDay = DateUtil.beginOfDay(date);
DateTime endOfDay = DateUtil.endOfDay(date);

// ======== 日期比较 ========
boolean isSameDay = DateUtil.isSameDay(date1, date2);
long betweenDay = DateUtil.betweenDay(startDate, endDate, true);

// ======== 日期范围生成 ========
DateTime start = DateUtil.parse("2024-01-01");
DateTime end = DateUtil.parse("2024-01-05");
List<DateTime> dateRange = DateUtil.rangeToList(start, end, DateField.DAY_OF_YEAR);

// ======== 特殊功能 ========
int age = DateUtil.ageOfNow("1990-05-20");        // 计算年龄
String zodiac = DateUtil.getZodiac(5, 20);         // 星座
String cnZodiac = DateUtil.getChineseZodiac(1990); // 生肖
boolean isLeap = DateUtil.isLeapYear(2024);        // 是否闰年
```

### 2.4 ObjectUtil — 对象工具

```java path=null start=null
import cn.hutool.core.util.ObjectUtil;

// ======== 对象判空 ========
ObjectUtil.isNull(obj);
ObjectUtil.isNotNull(obj);
ObjectUtil.isEmpty(obj);

// ======== 对象相等比较 ========
ObjectUtil.equal(a, b);       // null 安全比较
ObjectUtil.notEqual(a, b);

// ======== 获取默认值 ========
String value = ObjectUtil.defaultIfNull(input, "default");

// ======== 克隆对象（深拷贝，需实现 Serializable） ========
User clone = ObjectUtil.clone(user);

// ======== 获取对象类信息 ========
String className = ObjectUtil.getClassName(obj, true);
```

### 2.5 BeanUtil — Bean 属性工具

```java path=null start=null
import cn.hutool.core.bean.BeanUtil;

// ======== 对象属性拷贝 ========
User target = new User();
BeanUtil.copyProperties(source, target);

// ======== Map 与 Bean 互转 ========
Map<String, Object> map = BeanUtil.beanToMap(user);
User user = BeanUtil.toBean(map, User.class);

// ======== 获取/设置属性 ========
Object value = BeanUtil.getProperty(user, "name");
BeanUtil.setProperty(user, "name", "newValue");

// ======== 属性列表转 Map ========
List<User> users = ...;
List<Map<String, Object>> maps = BeanUtil.listBeanToMap(users);
```

### 2.6 IdUtil — 唯一 ID 生成

```java path=null start=null
import cn.hutool.core.util.IdUtil;

// ======== UUID ========
String uuid = IdUtil.simpleUUID();    // "a1b2c3d4e5f6..."（32位，无横杠）
String uuid32 = IdUtil.randomUUID();  // "a1b2c3d4-e5f6-..."（36位，带横杠）

// ======== 雪花算法 ID（分布式唯一） ========
long snowflakeId = IdUtil.getSnowflake(1, 1).nextId();  // 工作机器ID=1，数据中心ID=1

// ======== ObjectId（MongoDB 风格，基于时间） ========
String objectId = IdUtil.objectId();
```

### 2.7 FileUtil — 文件操作

```java path=null start=null
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.io.file.FileReader;
import cn.hutool.core.io.file.FileWriter;
import java.io.File;
import java.util.List;

// ======== 文件创建 ========
File file = FileUtil.file("/path/to/file.txt");
File newFile = FileUtil.touch("/path/to/new.txt");  // 创建文件（含父目录）
File dir = FileUtil.mkdir("/path/to/dir");          // 创建目录

// ======== 文件读取 ========
String content = FileUtil.readUtf8String("/path/to/file.txt");
List<String> lines = FileUtil.readUtf8Lines("/path/to/file.txt");
byte[] bytes = FileUtil.readBytes("/path/to/file.txt");

// ======== 文件写入 ========
FileUtil.writeUtf8String("Hello Hutool", "/path/to/file.txt");
FileUtil.appendUtf8String("Append content", "/path/to/file.txt");

// ======== 文件复制/移动/删除 ========
FileUtil.copy("/source/file.txt", "/dest/file.txt", true);  // true=覆盖
FileUtil.move(file, new File("/new/path/file.txt"), true);
FileUtil.del("/path/to/file.txt");

// ======== 文件名处理 ========
FileUtil.getName("/path/to/file.txt");       // "file.txt"
FileUtil.mainName("/path/to/file.txt");      // "file"
FileUtil.extName("/path/to/file.txt");       // "txt"

// ======== 文件遍历 ========
List<File> files = FileUtil.loopFiles("/path/to/dir");   // 递归所有文件
List<File> txtOnly = FileUtil.loopFiles("/path", f -> f.getName().endsWith(".txt"));

// ======== 文件大小 ========
long size = FileUtil.size(file);
String readableSize = FileUtil.readableFileSize(size);   // "1.5 MB"
```

### 2.8 ReflectUtil — 反射工具

```java path=null start=null
import cn.hutool.core.util.ReflectUtil;

// ======== 反射创建对象 ========
User user = ReflectUtil.newInstance(User.class);

// ======== 反射调用方法 ========
Object result = ReflectUtil.invoke(user, "getName");

// ======== 获取/设置字段（包括 private） ========
Object value = ReflectUtil.getFieldValue(user, "name");
ReflectUtil.setFieldValue(user, "name", "newValue");
```

### 2.9 Convert — 类型转换工具

```java path=null start=null
import cn.hutool.core.convert.Convert;

// ======== 转为字符串 ========
String str = Convert.toStr(123);

// ======== 转为数字 ========
int num = Convert.toInt("123", 0);            // 第二个参数是默认值
long longVal = Convert.toLong("123L");
double doubleVal = Convert.toDouble("3.14");
BigDecimal bd = Convert.toBigDecimal("123.45");

// ======== 转为日期 ========
Date date = Convert.toDate("2024-06-03");

// ======== 转为布尔 ========
boolean bool = Convert.toBool("true");

// ======== 批量转换 ========
List<Integer> intList = Convert.toList(Integer.class, "1,2,3");
```

### 2.10 NumberUtil — 数字工具

```java path=null start=null
import cn.hutool.core.util.NumberUtil;

// ======== 加法/减法/乘法/除法（精确计算） ========
BigDecimal result = NumberUtil.add(0.1, 0.2);    // 0.3
BigDecimal sub = NumberUtil.sub(1.0, 0.3);        // 0.7
BigDecimal mul = NumberUtil.mul(1.2, 1.5);        // 1.8
BigDecimal div = NumberUtil.div(10, 3, 2);        // 3.33（保留2位）

// ======== 四舍五入 ========
double rounded = NumberUtil.round(3.14159, 2);    // 3.14

// ======== 随机数 ========
int randomInt = NumberUtil.randomInt(1, 100);     // [1, 100]
String randomCode = RandomUtil.randomNumbers(6);  // 6位随机数字
String randomStr = RandomUtil.randomString(8);    // 8位随机字符串
```

---

## 三、HTTP 请求（hutool-http）

```java path=null start=null
import cn.hutool.http.HttpUtil;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;

// ======== GET 请求 ========
String result = HttpUtil.get("https://api.example.com/users");

// GET 带参数
Map<String, Object> params = new HashMap<>();
params.put("page", 1);
params.put("size", 10);
String resultWithParams = HttpUtil.get("https://api.example.com/users", params);

// ======== POST 请求 ========
// POST 表单
Map<String, Object> formData = new HashMap<>();
formData.put("username", "admin");
formData.put("password", "123456");
String postResult = HttpUtil.post("https://api.example.com/login", formData);

// POST JSON
String jsonBody = "{\"name\":\"hutool\",\"version\":\"5.8\"}";
String jsonResult = HttpUtil.post("https://api.example.com/user", jsonBody);

// ======== 高级配置（链式调用） ========
HttpResponse response = HttpRequest.get("https://api.example.com/data")
    .header("Authorization", "Bearer token123")
    .timeout(5000)                        // 超时 5 秒
    .execute();

String body = response.body();
int status = response.getStatus();
```

---

## 四、JSON 处理（hutool-json）

```java path=null start=null
import cn.hutool.json.JSONUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONConfig;

// ======== 解析 JSON ========
String jsonStr = "{\"name\":\"hutool\",\"age\":5,\"active\":true}";
JSONObject jsonObj = JSONUtil.parseObj(jsonStr);
String name = jsonObj.getStr("name");     // "hutool"
int age = jsonObj.getInt("age");          // 5

// ======== 创建 JSON ========
JSONObject obj = JSONUtil.createObj()
    .set("name", "hutool")
    .set("version", "5.8.44");
String json = obj.toString();             // {"name":"hutool","version":"5.8.44"}

// ======== Bean 与 JSON 互转 ========
User user = new User("张三", 25);
String userJson = JSONUtil.toJsonStr(user);             // Bean → JSON
User parsedUser = JSONUtil.toBean(jsonStr, User.class); // JSON → Bean

// ======== JSONArray ========
String arrayStr = "[{\"id\":1},{\"id\":2}]";
JSONArray jsonArray = JSONUtil.parseArray(arrayStr);
List<User> users = JSONUtil.toList(arrayStr, User.class);

// ======== JSONPath 查询 ========
// 支持嵌套对象/数组路径访问
Object value = jsonObj.getByPath("store.book[0].title");

// ======== 高级配置 ========
JSONConfig config = JSONConfig.create()
    .setIgnoreNullValue(true)           // 忽略 null 值
    .setDateFormat("yyyy-MM-dd");       // 日期格式化
JSONObject configuredObj = new JSONObject(user, config);
```

---

## 五、加密解密（hutool-crypto）

### 5.1 摘要算法（MD5 / SHA）

```java path=null start=null
import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.digest.DigestUtil;

// MD5
String md5 = SecureUtil.md5("hello");          // 32位小写
String md5Hex = DigestUtil.md5Hex("hello");    // 同上

// SHA 系列
String sha1 = SecureUtil.sha1("hello");
String sha256 = SecureUtil.sha256("hello");
String sha512 = DigestUtil.sha512Hex("hello");

// HMAC（带密钥的摘要）
String hmacMd5 = SecureUtil.hmacMd5("secret-key").digestHex("hello");
String hmacSha256 = SecureUtil.hmacSha256("secret-key").digestHex("hello");
```

### 5.2 对称加密（AES / DES）

```java path=null start=null
import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.symmetric.AES;

// 生成随机密钥
byte[] aesKey = SecureUtil.generateKey("AES").getEncoded();

// 加密解密
AES aes = SecureUtil.aes(aesKey);
String encrypted = aes.encryptHex("hello hutool");    // 加密为 Hex
String decrypted = aes.decryptStr(encrypted);         // 解密

// Base64 格式加密
String encryptedBase64 = aes.encryptBase64("hello");
String decryptedFromBase64 = aes.decryptStr(encryptedBase64);
```

### 5.3 非对称加密（RSA）

```java path=null start=null
import cn.hutool.crypto.asymmetric.RSA;

// 生成密钥对
RSA rsa = SecureUtil.rsa();
String publicKey = rsa.getPublicKeyBase64();
String privateKey = rsa.getPrivateKeyBase64();

// 用公钥加密，私钥解密
byte[] encrypt = rsa.encrypt("hello", KeyType.PublicKey);
byte[] decrypt = rsa.decrypt(encrypt, KeyType.PrivateKey);
String decryptedStr = new String(decrypt);
```

### 5.4 数字签名

```java path=null start=null
import cn.hutool.crypto.asymmetric.Sign;
import cn.hutool.crypto.asymmetric.SignAlgorithm;

// 使用 RSA 签名
Sign sign = SecureUtil.sign(SignAlgorithm.SHA256withRSA);
String publicKey = sign.getPublicKeyBase64();
String privateKey = sign.getPrivateKeyBase64();

// 签名
byte[] signature = sign.sign("hello".getBytes());

// 验证签名
boolean verified = sign.verify("hello".getBytes(), signature); // true
```

---

## 六、Spring Boot 2.7.x 集成实战

### 6.1 完整 POM 配置

```xml path=null start=null
<project>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.18</version>
    </parent>

    <dependencies>
        <!-- Spring Boot Web -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Hutool 全部模块 -->
        <dependency>
            <groupId>cn.hutool</groupId>
            <artifactId>hutool-all</artifactId>
            <version>5.8.44</version>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>
```

### 6.2 实战：Controller 中使用 Hutool

```java path=null start=null
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/utils")
public class UtilsController {

    /**
     * 字符串处理示例
     */
    @GetMapping("/string")
    public Map<String, Object> stringDemo(@RequestParam String text) {
        Map<String, Object> result = new HashMap<>();
        result.put("camelCase", StrUtil.toCamelCase(text));
        result.put("underScore", StrUtil.toUnderlineCase(text));
        result.put("reversed", StrUtil.reverse(text));
        return result;
    }

    /**
     * 日期处理示例
     */
    @GetMapping("/date")
    public Map<String, Object> dateDemo() {
        Map<String, Object> result = new HashMap<>();
        result.put("now", DateUtil.now());
        result.put("today", DateUtil.today());
        result.put("beginOfDay", DateUtil.beginOfDay(new Date()));
        result.put("endOfDay", DateUtil.endOfDay(new Date()));
        return result;
    }

    /**
     * ID 生成示例
     */
    @GetMapping("/id")
    public Map<String, Object> idDemo() {
        Map<String, Object> result = new HashMap<>();
        result.put("uuid", IdUtil.simpleUUID());
        result.put("snowflake", IdUtil.getSnowflake(1, 1).nextId());
        result.put("objectId", IdUtil.objectId());
        return result;
    }
}
```

---

## 七、常用工具类速查表

| 工具类 | 包路径 | 核心功能 |
|------|------|---------|
| **StrUtil** | `cn.hutool.core.util.StrUtil` | 字符串判空、截取、格式化、驼峰互转 |
| **CollUtil** | `cn.hutool.core.collection.CollUtil` | 集合创建、判空、并交差集、分页、过滤 |
| **ListUtil** | `cn.hutool.core.collection.ListUtil` | List 专用工具 |
| **DateUtil** | `cn.hutool.core.date.DateUtil` | 日期解析、格式化、计算、范围生成 |
| **FileUtil** | `cn.hutool.core.io.FileUtil` | 文件读写、复制、移动、删除、遍历 |
| **ObjectUtil** | `cn.hutool.core.util.ObjectUtil` | 对象判空、相等比较、默认值、克隆 |
| **BeanUtil** | `cn.hutool.core.bean.BeanUtil` | Bean 属性拷贝、Map 互转 |
| **Convert** | `cn.hutool.core.convert.Convert` | 类型转换（字符串→数字、日期等） |
| **NumberUtil** | `cn.hutool.core.util.NumberUtil` | 精确计算、四舍五入 |
| **RandomUtil** | `cn.hutool.core.util.RandomUtil` | 随机数、随机字符串 |
| **IdUtil** | `cn.hutool.core.util.IdUtil` | UUID、雪花算法 ID、ObjectId |
| **ReflectUtil** | `cn.hutool.core.util.ReflectUtil` | 反射创建对象、调用方法、操作字段 |
| **ClassUtil** | `cn.hutool.core.util.ClassUtil` | 类扫描、获取类信息 |
| **HttpUtil** | `cn.hutool.http.HttpUtil` | GET/POST 请求 |
| **HttpRequest** | `cn.hutool.http.HttpRequest` | 链式 HTTP 请求（高级配置） |
| **JSONUtil** | `cn.hutool.json.JSONUtil` | JSON 解析、序列化、Bean 互转 |
| **SecureUtil** | `cn.hutool.crypto.SecureUtil` | 加密解密入口（MD5、AES、RSA 等） |
| **DigestUtil** | `cn.hutool.crypto.digest.DigestUtil` | 摘要算法（MD5、SHA 系列） |

---

## 八、常见问题

**Q: Hutool 与 Spring Boot 2.7.x 兼容吗？**
完全兼容。Hutool 5.8.x 基于 JDK 8+，与 Spring Boot 2.7.x 无任何冲突。

**Q: 应该引入 `hutool-all` 还是按模块引入？**
推荐 `hutool-all`，方便省事。如果对包大小敏感可以按需引入模块。

**Q: Hutool 的 JSON 与 Jackson/Fastjson 有什么区别？**
Hutool 的 JSON 模块功能简洁够用，适合日常开发；Jackson 更强大（Spring Boot 默认）；Fastjson 性能更好但安全性有争议。三者可以混用。

**Q: StrUtil.format 和 String.format 有什么区别？**
StrUtil.format 使用 `{}` 占位符（类似 slf4j），更简洁；String.format 使用 `%s` 占位符，功能更全。

**Q: Hutool 是否会与 Spring Boot 的依赖冲突？**
一般不会。唯一需要注意的是如果项目中已引入了不同版本的某个库（如 fastjson），Hutool 内部可能会通过反射使用它。

---

## 九、参考资源

- [Hutool 官方文档](https://hutool.cn/)
- [Hutool GitHub](https://github.com/chinabugotech/hutool)
- [Hutool API 文档](https://apidoc.gitee.com/dromara/hutool/)
- [Spring Boot 2.7.x 文档](../spring-boot/)