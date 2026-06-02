# MyBatis-Plus 使用指南

MyBatis-Plus 是 MyBatis 增强工具，提供通用 CRUD、分页、条件构造器等功能。

> 搭配 [MyBatis 文档](../mybatis/) 使用效果更佳：MyBatis-Plus 的 `BaseMapper` 处理简单 CRUD，复杂的自定义 SQL 通过 XML Mapper 实现。

## 一、Maven 依赖

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
    <version>3.5.5</version>
</dependency>
```

## 二、application.yml

```yaml
mybatis-plus:
  # XML Mapper 文件位置（自定义 SQL 用 XML 方式时配置此项）
  mapper-locations: classpath*:/mapper/**/*.xml
  type-aliases-package: com.example.entity
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl  # SQL 日志
    map-underscore-to-camel-case: true
  global-config:
    db-config:
      id-type: auto
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
```

## 三、实体类

```java
@Data
@TableName("tb_user")                  // 表名
public class User {
    @TableId(type = IdType.AUTO)        // 主键策略
    private Long id;

    @TableField("user_name")            // 字段映射
    private String userName;

    private Integer age;
    private String email;

    @TableField(fill = FieldFill.INSERT)       // 插入自动填充
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE) // 更新自动填充
    private LocalDateTime updateTime;

    @TableLogic                                 // 逻辑删除
    private Integer deleted;

    @TableField(exist = false)                  // 非表字段
    private String remark;
}
```

### 主键策略 IdType

| 策略 | 说明 |
|------|------|
| `AUTO` | 数据库自增 |
| `ASSIGN_ID` | 雪花算法（Long） |
| `ASSIGN_UUID` | UUID（String） |
| `INPUT` | 手动设置 |

## 四、Mapper

`BaseMapper` 提供了 `insert`、`deleteById`、`updateById`、`selectById`、`selectList` 等通用 CRUD 方法，**无需写一行 SQL 或 XML**。

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 继承 BaseMapper 即拥有通用 CRUD，无需任何 XML 配置
    // 只有复杂的自定义 SQL（联表查询、动态条件等）才需要写 XML
}
```

### 自定义 SQL —— 走 XML Mapper

当 `BaseMapper` 提供的通用方法无法满足需求时（如多表联查、复杂动态条件、统计报表），**通过 XML 方式编写自定义 SQL**：

**① Mapper 接口：**

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {

    // 自定义方法声明
    List<User> selectByCondition(@Param("name") String name,
                                  @Param("minAge") Integer minAge,
                                  @Param("maxAge") Integer maxAge);

    UserVO selectUserWithDept(@Param("id") Long id);
}
```

**② XML Mapper 文件**（`resources/mapper/UserMapper.xml`）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">

    <!-- 动态条件查询 -->
    <select id="selectByCondition" resultType="User">
        SELECT * FROM tb_user
        <where>
            <if test="name != null and name != ''">
                AND user_name LIKE CONCAT('%', #{name}, '%')
            </if>
            <if test="minAge != null">
                AND age &gt;= #{minAge}
            </if>
            <if test="maxAge != null">
                AND age &lt;= #{maxAge}
            </if>
        </where>
        ORDER BY id DESC
    </select>

    <!-- 联表查询 -->
    <select id="selectUserWithDept" resultType="UserVO">
        SELECT u.*, d.dept_name
        FROM tb_user u
        LEFT JOIN tb_dept d ON u.dept_id = d.id
        WHERE u.id = #{id}
    </select>

</mapper>
```

> **总结**：`BaseMapper` 提供的通用 CRUD 方法不需要 XML。只有当业务需求超出通用方法范围时，才需要写自定义 XML。XML 相关语法参考 [MyBatis 文档](../mybatis/)。

## 五、通用 CRUD

### 插入/删除/更新

```java
userMapper.insert(user);                                        // 插入
userMapper.deleteById(1001L);                                   // 按 ID 删
userMapper.deleteBatchIds(Arrays.asList(1001L, 1002L));         // 批量删
userMapper.delete(new LambdaQueryWrapper<User>()                // 条件删
    .eq(User::getStatus, 0));
userMapper.updateById(user);                                    // 按 ID 更新
userMapper.update(user, new LambdaUpdateWrapper<User>()         // 条件更新
    .set(User::getStatus, 1).eq(User::getId, 1001L));
```

### 查询

```java
User user = userMapper.selectById(1001L);                       // 按 ID
List<User> list = userMapper.selectBatchIds(ids);              // 批量 ID
List<User> all = userMapper.selectList(null);                  // 全部
Long count = userMapper.selectCount(null);                      // 总数

// 条件查询
List<User> result = userMapper.selectList(
    new LambdaQueryWrapper<User>()
        .eq(User::getStatus, 1)
        .ge(User::getAge, 18)
        .orderByDesc(User::getCreateTime)
);
```

## 六、LambdaQueryWrapper 条件构造器

### 比较条件

```java
new LambdaQueryWrapper<User>()
    .eq(User::getName, "张三")           // =
    .ne(User::getStatus, 0)              // !=
    .gt(User::getAge, 18)                // >
    .ge(User::getCreateTime, start)      // >=
    .lt(User::getBalance, 1000)          // <
    .le(User::getAge, 60)                // <=
    .between(User::getAge, 18, 35)       // 区间
    .notBetween(User::getAge, 18, 35)    // 不在区间
```

### 模糊查询

```java
    .like(User::getName, "张")           // LIKE '%张%'
    .likeLeft(User::getEmail, "@gmail")  // LIKE '%@gmail'
    .likeRight(User::getPhone, "138")    // LIKE '138%'
```

### IN / NULL

```java
    .in(User::getId, ids)                 // IN
    .notIn(User::getStatus, exclStatuses) // NOT IN
    .isNull(User::getEmail)               // IS NULL
    .isNotNull(User::getPhone)            // IS NOT NULL
```

### 排序与分组

```java
    .orderByAsc(User::getAge)
    .orderByDesc(User::getCreateTime)
    .groupBy(User::getStatus)
    .having("count(*) > {0}", 5)
```

### 条件组合

```java
// AND
wrapper.eq(User::getStatus, 1).ge(User::getAge, 18);

// OR
wrapper.eq(User::getName, "张三").or().eq(User::getName, "李四");

// AND 嵌套: status=1 AND (name='张三' OR name='李四')
wrapper.eq(User::getStatus, 1)
    .and(w -> w.eq(User::getName, "张三").or().eq(User::getName, "李四"));

// OR 嵌套: status=1 OR (age>50 AND age<10)
wrapper.eq(User::getStatus, 1)
    .or(w -> w.gt(User::getAge, 50).lt(User::getAge, 10));
```

### 动态条件（条件为 false 时忽略该条件）

```java
new LambdaQueryWrapper<User>()
    .like(StringUtils.isNotBlank(name), User::getName, name)
    .eq(status != null, User::getStatus, status)
    .ge(minAge != null, User::getAge, minAge)
    .le(maxAge != null, User::getAge, maxAge);
```

## 七、分页

### 配置分页插件

```java
@Configuration
public class MybatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor interceptor() {
        MybatisPlusInterceptor i = new MybatisPlusInterceptor();
        i.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return i;
    }
}
```

### 分页查询

```java
Page<User> page = new Page<>(1, 20);   // 第 1 页，每页 20 条
Page<User> result = userMapper.selectPage(page,
    new LambdaQueryWrapper<User>().ge(User::getAge, 18));

result.getTotal();       // 总记录数
result.getPages();       // 总页数
result.getCurrent();     // 当前页
result.getRecords();     // 数据列表
```

## 八、Service 层

```java
public interface UserService extends IService<User> { }

@Service
public class UserServiceImpl
        extends ServiceImpl<UserMapper, User>
        implements UserService {
}
```

继承后可用的方法：
```java
userService.save(user);              // 保存
userService.saveBatch(list);         // 批量保存
userService.saveOrUpdate(user);      // 保存/更新
userService.removeById(1001L);       // 删
userService.remove(wrapper);         // 条件删
userService.updateById(user);        // 按 ID 更新
userService.update(wrapper);         // 条件更新
userService.getById(1001L);          // 查
userService.list(wrapper);           // 条件查
userService.page(page, wrapper);     // 分页
userService.count();                 // 总数
```

## 九、完整业务示例

```java
@Service
public class UserService extends ServiceImpl<UserMapper, User> {

    public IPage<User> queryPage(UserQuery query) {
        return page(
            new Page<>(query.getPage(), query.getSize()),
            new LambdaQueryWrapper<User>()
                .like(StringUtils.isNotBlank(query.getName()), User::getName, query.getName())
                .eq(query.getStatus() != null, User::getStatus, query.getStatus())
                .ge(query.getMinAge() != null, User::getAge, query.getMinAge())
                .orderByDesc(User::getCreateTime)
        );
    }

    public void batchUpdateStatus(List<Long> ids, Integer status) {
        update(new LambdaUpdateWrapper<User>()
            .set(User::getStatus, status)
            .set(User::getUpdateTime, LocalDateTime.now())
            .in(User::getId, ids)
        );
    }
}
```

## 十、常用配置速查

```yaml
mybatis-plus:
  mapper-locations: classpath*:/mapper/**/*.xml
  type-aliases-package: com.example.entity
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
    map-underscore-to-camel-case: true
    cache-enabled: false
  global-config:
    db-config:
      id-type: assign_id
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
      update-strategy: not_null      # not_null / ignored / not_empty
```
