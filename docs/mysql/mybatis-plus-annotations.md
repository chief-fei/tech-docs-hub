# MyBatis-Plus 注解与参数速查手册

MyBatis-Plus 提供了一套实体类注解，用于映射 Java 对象与数据库表的关系。

> 完整使用教程请参考 [MyBatis-Plus 使用指南](./mybatis-plus/)。

## 一、实体类注解

### 1.1 @TableName

标记实体类对应的数据库表名。

```java
@TableName("tb_user")
public class User { }
```

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `value` | `String` | 表名 | `""` |
| `schema` | `String` | schema | `""` |
| `keepGlobalPrefix` | `boolean` | 是否保持全局表前缀 | `false` |
| `resultMap` | `String` | XML 中 resultMap 的 id | `""` |
| `autoResultMap` | `boolean` | 是否自动构建 resultMap | `false` |

```yaml
# 全局表前缀（配合 @TableName 使用）
mybatis-plus:
  global-config:
    db-config:
      table-prefix: tb_
```

### 1.2 @TableId

标记主键字段，指定主键生成策略。

```java
public class User {
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
}
```

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `value` | `String` | 主键字段名 | `""` |
| `type` | `IdType` | 主键生成策略 | `IdType.ASSIGN_ID` |

### 1.3 @TableField

映射非主键字段，配置字段行为。

```java
public class User {
    @TableField(value = "user_name")
    private String userName;

    @TableField(exist = false)
    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
```

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `value` | `String` | 数据库列名 | `""` |
| `exist` | `boolean` | 是否为数据库字段 | `true` |
| `condition` | `String` | 条件预处理（已废弃，用 `whereStrategy` 代替） | `""` |
| `fill` | `FieldFill` | 自动填充策略 | `FieldFill.DEFAULT` |
| `select` | `boolean` | 查询时是否带上此字段 | `true` |
| `keepGlobalFormat` | `boolean` | 是否保持全局配置的 format | `false` |
| `updateStrategy` | `FieldStrategy` | 更新策略 | `FieldStrategy.DEFAULT` |
| `whereStrategy` | `FieldStrategy` | WHERE 条件策略 | `FieldStrategy.DEFAULT` |
| `insertStrategy` | `FieldStrategy` | 插入策略 | `FieldStrategy.DEFAULT` |

### 1.4 @TableLogic

标记逻辑删除字段。

```java
public class User {
    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
```

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `value` | `String` | 未删除标识值 | `0` |
| `delval` | `String` | 已删除标识值 | `1` |

配置后，`deleteById()` 等操作会自动转为 `UPDATE table SET deleted=1 WHERE ...`。

### 1.5 @Version

乐观锁版本字段。每次更新时版本号自动 +1，更新条件会带版本号。

```java
public class User {
    @Version
    private Integer version;
}
```

```java
// 需要配置插件
@Bean
public MybatisPlusInterceptor mybatisPlusInterceptor() {
    MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
    interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());
    return interceptor;
}
```

### 1.6 @KeySequence

Oracle 序列主键策略（MySQL 不需要）。

```java
@KeySequence(value = "SEQ_USER", clazz = Long.class)
public class User {
    @TableId(type = IdType.INPUT)
    private Long id;
}
```

### 1.7 @OrderBy

排序，自动在查询末尾添加 `ORDER BY`。

```java
public class User {
    @OrderBy(asc = false, sort = 10)
    private LocalDateTime createTime;
}
```

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `asc` | `boolean` | 是否升序 | `true` |
| `sort` | `short` | 排序优先级（越小越靠前） | `Short.MAX_VALUE` |

### 1.8 @EnumValue

标记枚举字段值，存入数据库的值。

```java
public enum StatusEnum {
    DISABLED(0, "禁用"),
    ENABLED(1, "启用");

    @EnumValue
    private final int code;
    private final String desc;
}
```

### 1.9 @InterceptorIgnore

忽略特定拦截器，用于特定场景（如大量数据导入时不使用自动填充）。

```java
@InterceptorIgnore(tenantLine = "true")
@Select("SELECT * FROM tb_user")
List<User> selectAllWithoutTenant();
```

## 二、枚举参数详解

### 2.1 IdType —— 主键策略

| 值 | 说明 | 适用场景 |
|---|------|----------|
| `AUTO` | 数据库自增 | MySQL 自增主键 |
| `NONE` | 无策略（全局配置） | 继承全局配置 |
| `INPUT` | 手动设置 | 用户自行 set 主键值 |
| `ASSIGN_ID` | 雪花算法生成 Long | **默认策略**，分布式推荐 |
| `ASSIGN_UUID` | 生成 UUID String | 分布式主键，String 类型 |

```java
@TableId(type = IdType.ASSIGN_ID)  // 雪花算法（默认）
private Long id;

@TableId(type = IdType.ASSIGN_UUID)  // UUID
private String id;
```

### 2.2 FieldFill —— 自动填充时机

| 值 | 说明 |
|----|------|
| `DEFAULT` | 不填充 |
| `INSERT` | 插入时填充 |
| `UPDATE` | 更新时填充 |
| `INSERT_UPDATE` | 插入和更新时均填充 |

配合 `MetaObjectHandler` 使用：

```java
@Component
public class MyMetaObjectHandler implements MetaObjectHandler {
    @Override
    public void insertFill(MetaObject metaObject) {
        this.strictInsertFill(metaObject, "createTime", LocalDateTime.class, LocalDateTime.now());
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
    }
}
```

### 2.3 FieldStrategy —— 字段策略

控制字段在 INSERT 或 UPDATE 时的行为。

| 值 | 说明 |
|----|------|
| `NOT_NULL` | 非 NULL 判断（默认） |
| `NOT_EMPTY` | 非空判断（比 NOT_NULL 更严格） |
| `IGNORED` | 忽略判断 |
| `DEFAULT` | 跟随全局配置 |
| `NEVER` | 不参与 SQL |

```java
// 示例：name 为空字符串时不更新
@TableField(updateStrategy = FieldStrategy.NOT_EMPTY)
private String name;
```

全局配置：

```yaml
mybatis-plus:
  global-config:
    db-config:
      insert-strategy: not_null     # 插入策略
      update-strategy: not_null     # 更新策略
      where-strategy: not_null      # 条件策略
```

### 2.4 DbType —— 数据库类型

分页插件需要指定数据库类型。

| 值 | 数据库 |
|----|--------|
| `MYSQL` | MySQL |
| `MARIADB` | MariaDB |
| `ORACLE` | Oracle |
| `POSTGRE_SQL` | PostgreSQL |
| `SQL_SERVER` | SQL Server |
| `H2` | H2 |

```java
@Bean
public MybatisPlusInterceptor mybatisPlusInterceptor() {
    MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
    interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
    return interceptor;
}
```

## 三、常用 Spring 注解

### 3.1 @Mapper

```java
@Mapper
public interface UserMapper extends BaseMapper<User> { }
```

### 3.2 @MapperScan

```java
@Configuration
@MapperScan("com.example.mapper")
public class MybatisPlusConfig { }
```

### 3.3 @DS（多数据源）

需要引入 `dynamic-datasource-spring-boot-starter`：

```java
@DS("slave")
@Mapper
public interface UserMapper extends BaseMapper<User> { }

@Service
public class UserService {
    @DS("slave")
    public List<User> queryFromSlave() {
        return list();
    }
}
```

## 四、配套 XML 标签

MyBatis-Plus 的 XML Mapper 完全复用 MyBatis 标签，并额外增加以下能力：

### 4.1 自定义分页

```xml
<select id="selectCustomPage" resultType="UserVO">
    SELECT u.*, d.dept_name
    FROM tb_user u
    LEFT JOIN tb_dept d ON u.dept_id = d.id
    <where>
        <if test="name != null and name != ''">
            AND u.user_name LIKE CONCAT('%', #{name}, '%')
        </if>
    </where>
</select>
```

调用时直接传入 `Page` 对象即可自动分页。

### 4.2 批量操作

```xml
<insert id="batchInsert">
    INSERT INTO tb_user (user_name, age) VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.userName}, #{item.age})
    </foreach>
</insert>
```

## 五、注解速查表

| 注解 | 所属 | 用途 |
|------|------|------|
| `@TableName` | MP | 指定表名 |
| `@TableId` | MP | 主键字段 + 生成策略 |
| `@TableField` | MP | 普通字段映射与配置 |
| `@TableLogic` | MP | 逻辑删除标记 |
| `@Version` | MP | 乐观锁版本字段 |
| `@KeySequence` | MP | Oracle 序列（MySQL 不需要） |
| `@OrderBy` | MP | 排序注解 |
| `@EnumValue` | MP | 枚举存储值 |
| `@InterceptorIgnore` | MP | 忽略特定插件 |
| `@Mapper` | MyBatis | 标记 Mapper 接口 |
| `@MapperScan` | MyBatis | 批量扫描 Mapper |
| `@DS` | Dynamic-DS | 多数据源切换 |

## 六、配置参数速查

```yaml
mybatis-plus:
  mapper-locations: classpath*:/mapper/**/*.xml
  type-aliases-package: com.example.entity
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
    map-underscore-to-camel-case: true
    cache-enabled: true
  global-config:
    db-config:
      id-type: assign_id          # AUTO / ASSIGN_ID / ASSIGN_UUID / INPUT
      table-prefix: tb_           # 全局表前缀
      logic-delete-field: deleted # 逻辑删除字段
      logic-delete-value: 1       # 已删除值
      logic-not-delete-value: 0   # 未删除值
      update-strategy: not_null   # NOT_NULL / NOT_EMPTY / IGNORED
      insert-strategy: not_null
      where-strategy: not_null
```

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `mapper-locations` | XML Mapper 路径 | `classpath*:/mapper/**/*.xml` |
| `type-aliases-package` | 实体类别名包 | - |
| `map-underscore-to-camel-case` | 驼峰转下划线 | `true` |
| `id-type` | 全局主键策略 | `ASSIGN_ID` |
| `table-prefix` | 全局表前缀 | - |
| `logic-delete-field` | 逻辑删除字段名 | - |
| `logic-delete-value` | 已删除值 | `1` |
| `logic-not-delete-value` | 未删除值 | `0` |
| `update-strategy` | 全局更新策略 | `NOT_NULL` |
| `insert-strategy` | 全局插入策略 | `NOT_NULL` |
| `where-strategy` | 全局条件策略 | `NOT_NULL` |