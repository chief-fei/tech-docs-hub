# MapStruct 1.5.3.Final 完全指南

## 概述

MapStruct 是一个 Java 注解处理器，用于生成类型安全的 Bean 映射代码。它在**编译期**生成映射实现类，性能接近手写 `getter/setter`，远超反射类映射框架（如 BeanUtils）。

> **兼容性**：MapStruct 1.5.3.Final 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

### 为什么选 MapStruct

| 对比维度 | MapStruct | BeanUtils (Spring) | BeanUtils (Apache) |
|---------|-----------|-------------------|-------------------|
| 实现方式 | 编译期代码生成 | 反射 | 反射 |
| 性能 | 🟢 接近手写 | 🔴 慢 | 🔴 慢 |
| 类型安全 | 🟢 编译期检查 | 🔴 运行时 | 🔴 运行时 |
| 编译耗时 | 🟡 少量增加 | 🟢 无 | 🟢 无 |
| 调试友好 | 🟢 可查看生成代码 | 🔴 黑盒 | 🔴 黑盒 |

---

## 一、快速开始

### 1.1 Maven 依赖

```xml
<properties>
    <mapstruct.version>1.5.3.Final</mapstruct.version>
    <lombok.version>1.18.30</lombok.version>
</properties>

<dependencies>
    <!-- MapStruct 核心 -->
    <dependency>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct</artifactId>
        <version>${mapstruct.version}</version>
    </dependency>

    <!-- Lombok（如需共存） -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>${lombok.version}</version>
        <optional>true</optional>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.11.0</version>
            <configuration>
                <source>1.8</source>
                <target>1.8</target>
                <annotationProcessorPaths>
                    <!-- Lombok 必须放在 MapStruct 前面 -->
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                        <version>${lombok.version}</version>
                    </path>
                    <path>
                        <groupId>org.mapstruct</groupId>
                        <artifactId>mapstruct-processor</artifactId>
                        <version>${mapstruct.version}</version>
                    </path>
                    <!-- 如果项目中使用了 Lombok + MapStruct，还需添加这个绑定 -->
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok-mapstruct-binding</artifactId>
                        <version>0.2.0</version>
                    </path>
                </annotationProcessorPaths>
            </configuration>
        </plugin>
    </plugins>
</build>
```

::: warning Lombok 与 MapStruct 共存
注解处理器执行顺序：**Lombok** → **MapStruct**。如果顺序反了，MapStruct 将无法获取 Lombok 生成的 `getter/setter`，导致编译失败。务必添加 `lombok-mapstruct-binding` 依赖。
:::

### 1.2 第一个映射

```java
// Entity
@Data
public class User {
    private Long id;
    private String username;
    private String password;
    private Date createTime;
}

// DTO
@Data
public class UserDTO {
    private Long id;
    private String username;
    // 注意：password 字段不映射到 DTO
    private String createTime;  // 类型不同，Date → String
}
```

```java
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.factory.Mappers;

@Mapper
public interface UserMapper {

    UserMapper INSTANCE = Mappers.getMapper(UserMapper.class);

    @Mapping(target = "password", ignore = true)  // 忽略 password
    @Mapping(source = "createTime", target = "createTime", dateFormat = "yyyy-MM-dd HH:mm:ss")
    UserDTO toDTO(User user);
}
```

编译后，MapStruct 生成实现类：

```java
// 编译期自动生成（target/generated-sources/annotations/ 下）
public class UserMapperImpl implements UserMapper {

    @Override
    public UserDTO toDTO(User user) {
        if (user == null) {
            return null;
        }
        UserDTO userDTO = new UserDTO();
        userDTO.setId(user.getId());
        userDTO.setUsername(user.getUsername());
        if (user.getCreateTime() != null) {
            userDTO.setCreateTime(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                .format(user.getCreateTime()));
        }
        return userDTO;
    }
}
```

---

## 二、@Mapper 注解

### 2.1 基本属性

```java
@Mapper(
    componentModel = "spring",   // 纳入 Spring 容器管理
    uses = {DateMapper.class},   // 引用其他 Mapper
    imports = {UUID.class},      // 导入类，用于 expression
    unmappedTargetPolicy = ReportingPolicy.IGNORE  // 忽略未映射的目标字段
)
public interface UserMapper {
    // ...
}
```

### 2.2 componentModel 选项

| 值 | 说明 | 获取方式 |
|------|------|---------|
| `default` | 不归任何容器管理 | `Mappers.getMapper()` |
| `spring` | 注册为 Spring Bean（推荐） | `@Autowired` |
| `cdi` | 注册为 CDI Bean | `@Inject` |
| `jsr330` | 使用 JSR330 `@Named` | `@Inject` |

---

## 三、@Mapping 注解详解

### 3.1 字段名不一致

```java
@Data
public class UserVO {
    private String userName;       // VO 用 camelCase
    private String userEmail;
}

@Data
public class UserEntity {
    private String username;       // Entity 用 lowercase
    private String email;
}
```

```java
@Mapper
public interface UserMapper {

    @Mapping(source = "username", target = "userName")
    @Mapping(source = "email", target = "userEmail")
    UserVO toVO(UserEntity entity);

    @Mapping(source = "userName", target = "username")
    @Mapping(source = "userEmail", target = "email")
    UserEntity toEntity(UserVO vo);
}
```

### 3.2 忽略字段

```java
@Mapping(target = "password", ignore = true)
@Mapping(target = "createTime", ignore = true)
```

### 3.3 日期格式化

```java
// Date → String
@Mapping(source = "createTime", target = "createTime", dateFormat = "yyyy-MM-dd HH:mm:ss")

// String → Date
@Mapping(source = "birthday", target = "birthday", dateFormat = "yyyy-MM-dd")
```

### 3.4 数字格式化

```java
// BigDecimal → String
@Mapping(source = "price", target = "price", numberFormat = "#.00")

// String → BigDecimal
@Mapping(source = "amount", target = "amount", numberFormat = "#,##0.00")
```

### 3.5 常量映射

```java
@Mapping(target = "status", constant = "ACTIVE")
@Mapping(target = "version", constant = "1")
```

### 3.6 默认值

```java
// 源字段为 null 时使用默认值
@Mapping(source = "nickname", target = "nickname", defaultValue = "未设置")
```

### 3.7 表达式（expression）

```java
@Mapping(target = "fullName",
    expression = "java(user.getFirstName() + \" \" + user.getLastName())")
```

### 3.8 自定义方法映射（qualifiedByName）

```java
@Mapper
public interface UserMapper {

    @Mapping(source = "status", target = "statusName", qualifiedByName = "statusToName")
    UserVO toVO(UserEntity entity);

    @Named("statusToName")
    default String statusToName(Integer status) {
        switch (status) {
            case 0: return "禁用";
            case 1: return "正常";
            default: return "未知";
        }
    }
}
```

---

## 四、嵌套对象映射

### 4.1 基本嵌套

```java
@Data
public class UserVO {
    private String name;
    private AddressVO address;    // 嵌套对象
}

@Data
public class AddressVO {
    private String province;
    private String city;
}

@Data
public class UserEntity {
    private String name;
    private AddressEntity address;
}

@Data
public class AddressEntity {
    private String province;
    private String city;
    private String street;  // Entity 多出的字段
}
```

```java
@Mapper
public interface AddressMapper {
    AddressVO toVO(AddressEntity entity);
}

@Mapper(uses = {AddressMapper.class})
public interface UserMapper {
    UserVO toVO(UserEntity entity);
}
```

### 4.2 多层嵌套平铺

```java
@Data
public class UserVO {
    private String province;  // 来自 address.province
    private String city;      // 来自 address.city
}
```

```java
@Mapper
public interface UserMapper {

    @Mapping(source = "address.province", target = "province")
    @Mapping(source = "address.city", target = "city")
    UserVO toVO(UserEntity entity);
}
```

---

## 五、集合映射

MapStruct 自动支持集合映射，无需额外配置：

```java
@Mapper
public interface UserMapper {

    UserVO toVO(UserEntity entity);

    // 集合映射：自动调用 toVO 方法
    List<UserVO> toVOList(List<UserEntity> entities);

    // Set 映射
    Set<UserVO> toVOSet(Set<UserEntity> entities);

    // Map 映射
    Map<Long, UserVO> toVOMap(Map<Long, UserEntity> entityMap);
}
```

---

## 六、枚举映射

### 6.1 基本枚举映射

```java
public enum OrderStatus {
    PENDING("待支付"),
    PAID("已支付"),
    SHIPPED("已发货"),
    COMPLETED("已完成"),
    CANCELLED("已取消");

    private final String desc;

    OrderStatus(String desc) {
        this.desc = desc;
    }
    public String getDesc() { return desc; }
}
```

```java
@Mapper
public interface OrderMapper {

    // Enum → String
    @Mapping(source = "status", target = "statusDesc")
    OrderVO toVO(OrderEntity entity);

    // 自定义方法
    default String mapStatus(OrderStatus status) {
        return status != null ? status.getDesc() : "";
    }
}
```

### 6.2 @ValueMapping

```java
@Mapper
public interface OrderMapper {

    @ValueMapping(source = "PENDING", target = "PENDING")
    @ValueMapping(source = "PAID", target = "PAID")
    @ValueMapping(source = "SHIPPED", target = "SHIPPED")
    @ValueMapping(source = "COMPLETED", target = "COMPLETED")
    @ValueMapping(source = "CANCELLED", target = "CANCELLED")
    @ValueMapping(source = MappingConstants.ANY_REMAINING, target = "UNKNOWN")
    OrderStatusVO toVO(OrderStatus status);
}
```

---

## 七、@MappingTarget（更新已有对象）

在更新场景中，不创建新对象，而是将源字段合并到已有对象：

```java
@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createTime", ignore = true)
    void updateEntity(@MappingTarget UserEntity target, UserDTO source);
}
```

使用方式：

```java
@Autowired
private UserMapper userMapper;

// 从数据库查询已有实体
UserEntity entity = userService.getById(id);
// 将 DTO 的非空字段更新到实体上
userMapper.updateEntity(entity, userDTO);
// 保存更新后的实体
userService.updateById(entity);
```

---

## 八、生命周期钩子

### 8.1 @BeforeMapping

```java
@Mapper(componentModel = "spring")
public interface UserMapper {

    @BeforeMapping
    default void beforeMapping(UserEntity source, @MappingTarget UserVO target) {
        // 映射前处理：如校验、预处理
        if (source == null) {
            throw new IllegalArgumentException("source 不能为空");
        }
    }

    UserVO toVO(UserEntity entity);
}
```

### 8.2 @AfterMapping

```java
@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "password", ignore = true)
    @Mapping(target = "fullName", ignore = true)
    UserVO toVO(UserEntity entity);

    @AfterMapping
    default void afterMapping(UserEntity source, @MappingTarget UserVO target) {
        // 映射后处理：如拼接字段、补充计算值
        target.setFullName(source.getFirstName() + " " + source.getLastName());
    }
}
```

---

## 九、MapStruct + Spring Boot 集成实战

### 9.1 完整项目结构

```text
src/main/java/com/example/demo/
├── entity/
│   └── UserEntity.java
├── dto/
│   └── UserDTO.java
├── vo/
│   └── UserVO.java
├── mapper/
│   └── UserMapper.java
├── service/
│   └── UserService.java
└── controller/
    └── UserController.java
```

### 9.2 Entity

```java
@Data
public class UserEntity {
    private Long id;
    private String username;
    private String password;
    private Integer age;
    private String email;
    private Integer status;       // 0=禁用, 1=正常
    private Date createTime;
    private Date updateTime;
}
```

### 9.3 DTO

```java
@Data
public class UserDTO {
    private Long id;
    private String username;
    private Integer age;
    private String email;
    private Integer status;
    private String createTime;    // Date → String
}
```

### 9.4 VO

```java
@Data
public class UserVO {
    private Long id;
    private String username;
    private Integer age;
    private String email;
    private String statusName;    // 0→"禁用", 1→"正常"
    private String createTime;
}
```

### 9.5 Mapper

```java
@Mapper(componentModel = "spring")
public interface UserMapper {

    // Entity → DTO
    @Mapping(target = "password", ignore = true)
    @Mapping(source = "createTime", target = "createTime", dateFormat = "yyyy-MM-dd HH:mm:ss")
    UserDTO toDTO(UserEntity entity);

    // DTO → Entity
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "createTime", ignore = true)
    @Mapping(target = "updateTime", ignore = true)
    @Mapping(source = "createTime", target = "createTime", dateFormat = "yyyy-MM-dd HH:mm:ss")
    UserEntity toEntity(UserDTO dto);

    // Entity → VO
    @Mapping(source = "createTime", target = "createTime", dateFormat = "yyyy-MM-dd HH:mm:ss")
    @Mapping(source = "status", target = "statusName", qualifiedByName = "statusToName")
    UserVO toVO(UserEntity entity);

    // 更新方法
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "createTime", ignore = true)
    @Mapping(target = "updateTime", ignore = true)
    void updateEntity(@MappingTarget UserEntity target, UserDTO source);

    // 集合映射
    List<UserVO> toVOList(List<UserEntity> entities);

    // 自定义方法
    @Named("statusToName")
    default String statusToName(Integer status) {
        if (status == null) return "未知";
        switch (status) {
            case 0: return "禁用";
            case 1: return "正常";
            default: return "未知";
        }
    }
}
```

### 9.6 Service

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;

    public UserVO getUserById(Long id) {
        UserEntity entity = userRepository.findById(id);
        return userMapper.toVO(entity);
    }

    public List<UserVO> listUsers() {
        List<UserEntity> entities = userRepository.findAll();
        return userMapper.toVOList(entities);
    }

    public void createUser(UserDTO dto) {
        UserEntity entity = userMapper.toEntity(dto);
        entity.setCreateTime(new Date());
        userRepository.save(entity);
    }

    public void updateUser(Long id, UserDTO dto) {
        UserEntity entity = userRepository.findById(id);
        userMapper.updateEntity(entity, dto);
        entity.setUpdateTime(new Date());
        userRepository.updateById(entity);
    }
}
```

### 9.7 Controller

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public UserVO getUser(@PathVariable Long id) {
        return userService.getUserById(id);
    }

    @GetMapping
    public List<UserVO> listUsers() {
        return userService.listUsers();
    }

    @PostMapping
    public void createUser(@RequestBody UserDTO dto) {
        userService.createUser(dto);
    }

    @PutMapping("/{id}")
    public void updateUser(@PathVariable Long id, @RequestBody UserDTO dto) {
        userService.updateUser(id, dto);
    }
}
```

---

## 十、性能对比与最佳实践

### 10.1 性能数据对比

| 方式 | 100万次映射耗时 | 相对性能 |
|------|---------------|---------|
| 手写 getter/setter | ~100ms | 基准 |
| MapStruct | ~120ms | 1.2x |
| Spring BeanUtils | ~800ms | 8x |
| Apache BeanUtils | ~2000ms | 20x |

### 10.2 最佳实践

1. **始终使用 `componentModel = "spring"`**：交给 Spring 管理，便于注入和测试
2. **Entity ↔ DTO/VO 分离**：不同层使用不同对象，通过 MapStruct 转换
3. **敏感字段必须 ignore**：password、secret 等字段必须显式忽略
4. **使用 `@MappingTarget` 做更新**：避免创建新对象，保持 JPA 实体状态
5. **集合映射用批量方法**：利用 MapStruct 的集合自动转换，避免手动循环
6. **编译后检查生成代码**：查看 `target/generated-sources/annotations/` 下的实现类，确保映射正确
7. **Lombok 注解处理器顺序**：Lombok 必须在 MapStruct 之前

---

## 十一、常见问题

**Q: 编译报错 `Unknown property "xxx"`？**

通常是因为 Lombok 未生成 getter/setter。检查：
- `annotationProcessorPaths` 中 Lombok 是否在 MapStruct 前面
- 是否添加了 `lombok-mapstruct-binding` 依赖

**Q: 如何忽略所有未映射的字段？**

```java
@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE)
```

**Q: 如何映射不同包下的同名类？**

使用 `@Mapping` 显式指定，或使用 `qualifiedByName` 自定义方法。

**Q: MapStruct 能处理循环引用吗？**

默认不支持。需要手动处理或使用 `@Context` 参数传递已映射对象做去重。

**Q: 生成的代码在哪里？**

`target/generated-sources/annotations/` 目录下，与 Mapper 接口同包路径。

---

## 参考资源

- [MapStruct 官方文档](https://mapstruct.org/documentation/stable/reference/html/)
- [MapStruct GitHub](https://github.com/mapstruct/mapstruct)
- [Spring Boot 2.7.x 文档](../spring-boot/)