# MyBatis-Plus 完全指南

MyBatis-Plus 是 MyBatis 的增强工具，在 MyBatis 基础上提供通用 CRUD、分页、条件构造器等功能。你可以同时使用两者——用 MyBatis-Plus 的 `BaseMapper` 处理简单 CRUD，用 MyBatis XML Mapper 处理复杂 SQL。

> 适用版本：`mybatis-plus-boot-starter: 3.5.5`（Spring Boot 2.7.x）

---

## 一、Maven 依赖

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
    <version>3.5.5</version>
</dependency>
```

## 二、application.yml 配置

```yaml
mybatis-plus:
  # XML Mapper 文件位置（自定义 SQL 用 XML 方式时配置）
  mapper-locations: classpath*:/mapper/**/*.xml
  type-aliases-package: com.example.entity
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
    map-underscore-to-camel-case: true
  global-config:
    db-config:
      id-type: auto
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
```

## 三、实体类与注解

```java
@Data
@TableName("tb_user")                  // 表名
public class User {
    @TableId(type = IdType.AUTO)        // 主键策略：AUTO 数据库自增
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

### 常用注解速查

| 注解 | 用途 | 示例 |
|------|------|------|
| `@TableName` | 指定表名 | `@TableName("tb_user")` |
| `@TableId` | 主键 + 生成策略 | `@TableId(type = IdType.AUTO)` |
| `@TableField` | 字段映射与配置 | `@TableField("user_name")` |
| `@TableLogic` | 逻辑删除 | `@TableLogic` |
| `@Version` | 乐观锁 | `@Version` |
| `@EnumValue` | 枚举存储值 | `@EnumValue` |

### 主键策略 IdType

| 策略 | 说明 |
|------|------|
| `AUTO` | 数据库自增 |
| `ASSIGN_ID` | 雪花算法（Long）**默认** |
| `ASSIGN_UUID` | UUID（String） |
| `INPUT` | 手动设置 |

### 自动填充

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

## 四、Mapper 与 BaseMapper

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 继承 BaseMapper 即拥有通用 CRUD
    // 复杂查询（多表 JOIN、子查询）才需要自定义方法

    List<User> selectByCondition(@Param("name") String name,
                                  @Param("minAge") Integer minAge,
                                  @Param("maxAge") Integer maxAge);
}
```

### BaseMapper 核心方法

继承 `BaseMapper<T>` 后，Mapper 接口自动获得以下通用 CRUD 方法：

| 方法 | 说明 | 示例 |
|------|------|------|
| `insert(T entity)` | 插入一条记录 | `userMapper.insert(user)` |
| `deleteById(Serializable id)` | 按 ID 删除 | `userMapper.deleteById(1L)` |
| `deleteByMap(Map<String, Object> columnMap)` | 按 Map 条件删除 | `userMapper.deleteByMap(map)` |
| `delete(Wrapper<T> wrapper)` | 条件删除 | `userMapper.delete(wrapper)` |
| `deleteBatchIds(Collection<? extends Serializable> idList)` | 批量 ID 删除 | `userMapper.deleteBatchIds(ids)` |
| `updateById(T entity)` | 按 ID 更新 | `userMapper.updateById(user)` |
| `update(T entity, Wrapper<T> updateWrapper)` | 条件更新 | `userMapper.update(user, wrapper)` |
| `selectById(Serializable id)` | 按 ID 查询 | `userMapper.selectById(1L)` |
| `selectBatchIds(Collection<? extends Serializable> idList)` | 批量 ID 查询 | `userMapper.selectBatchIds(ids)` |
| `selectByMap(Map<String, Object> columnMap)` | 按 Map 查询 | `userMapper.selectByMap(map)` |
| `selectOne(Wrapper<T> queryWrapper)` | 查询单条 | `userMapper.selectOne(wrapper)` |
| `selectCount(Wrapper<T> queryWrapper)` | 查询总数 | `userMapper.selectCount(wrapper)` |
| `selectList(Wrapper<T> queryWrapper)` | 条件查询列表 | `userMapper.selectList(wrapper)` |
| `selectMaps(Wrapper<T> queryWrapper)` | 查询 Map 列表 | `userMapper.selectMaps(wrapper)` |
| `selectObjs(Wrapper<T> queryWrapper)` | 查询对象列表 | `userMapper.selectObjs(wrapper)` |
| `selectPage(IPage<T> page, Wrapper<T> queryWrapper)` | 分页查询 | `userMapper.selectPage(page, wrapper)` |

### 自定义 SQL —— XML 方式

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">

    <select id="selectByCondition" resultType="User">
        SELECT * FROM tb_user
        <where>
            <if test="name != null and name != ''">
                AND user_name LIKE CONCAT('%', #{name}, '%')
            </if>
            <if test="minAge != null">
                AND age >= #{minAge}
            </if>
            <if test="maxAge != null">
                AND age <= #{maxAge}
            </if>
        </where>
        ORDER BY id DESC
    </select>

</mapper>
```

## 五、通用 CRUD

### 插入 / 删除 / 更新

```java
userMapper.insert(user);                                        // 插入
userMapper.deleteById(1001L);                                   // 按 ID 删
userMapper.deleteBatchIds(Arrays.asList(1001L, 1002L));         // 批量删
userMapper.delete(new LambdaQueryWrapper<User>()
    .eq(User::getStatus, 0));                                   // 条件删
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

### 比较与模糊

```java
new LambdaQueryWrapper<User>()
    .eq(User::getName, "张三")           // =
    .ne(User::getStatus, 0)              // !=
    .gt(User::getAge, 18)                // >
    .ge(User::getCreateTime, start)      // >=
    .lt(User::getBalance, 1000)          // <
    .le(User::getAge, 60)                // <=
    .between(User::getAge, 18, 35)       // 区间
    .like(User::getName, "张")            // LIKE '%张%'
    .likeLeft(User::getEmail, "@gmail")  // LIKE '%@gmail'
    .likeRight(User::getPhone, "138")    // LIKE '138%'
    .in(User::getId, ids)                 // IN
    .isNull(User::getEmail)              // IS NULL
    .isNotNull(User::getPhone)           // IS NOT NULL
```

### 排序与分组

```java
    .orderByAsc(User::getAge)
    .orderByDesc(User::getCreateTime)
    .groupBy(User::getStatus)
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
```

### 动态条件

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

### ServiceImpl 核心方法

继承 `ServiceImpl<M extends BaseMapper<T>, T>` 后，Service 层自动获得以下增强方法：

| 方法 | 说明 | 示例 |
|------|------|------|
| `save(T entity)` | 保存一条记录 | `userService.save(user)` |
| `saveBatch(Collection<T> entityList)` | 批量保存 | `userService.saveBatch(list)` |
| `saveOrUpdate(T entity)` | 保存或更新 | `userService.saveOrUpdate(user)` |
| `removeById(Serializable id)` | 按 ID 删除 | `userService.removeById(1L)` |
| `removeByMap(Map<String, Object> columnMap)` | 按 Map 删除 | `userService.removeByMap(map)` |
| `remove(Wrapper<T> queryWrapper)` | 条件删除 | `userService.remove(wrapper)` |
| `removeBatchIds(Collection<? extends Serializable> idList)` | 批量删除 | `userService.removeBatchIds(ids)` |
| `updateById(T entity)` | 按 ID 更新 | `userService.updateById(user)` |
| `update(Wrapper<T> updateWrapper)` | 条件更新 | `userService.update(wrapper)` |
| `update(T entity, Wrapper<T> updateWrapper)` | 按实体条件更新 | `userService.update(user, wrapper)` |
| `getById(Serializable id)` | 按 ID 查询 | `userService.getById(1L)` |
| `getOne(Wrapper<T> queryWrapper, boolean throwEx)` | 查询单条 | `userService.getOne(wrapper)` |
| `list()` | 查询全部 | `userService.list()` |
| `list(Wrapper<T> queryWrapper)` | 条件查询 | `userService.list(wrapper)` |
| `listByIds(Collection<? extends Serializable> idList)` | 批量 ID 查询 | `userService.listByIds(ids)` |
| `listByMap(Map<String, Object> columnMap)` | 按 Map 查询 | `userService.listByMap(map)` |
| `listMaps(Wrapper<T> queryWrapper)` | 查询 Map 列表 | `userService.listMaps(wrapper)` |
| `listObjs(Wrapper<T> queryWrapper)` | 查询对象列表 | `userService.listObjs(wrapper)` |
| `page(IPage<T> page, Wrapper<T> queryWrapper)` | 分页查询 | `userService.page(page, wrapper)` |
| `count()` | 查询总数 | `userService.count()` |
| `count(Wrapper<T> queryWrapper)` | 条件查询总数 | `userService.count(wrapper)` |

### BaseMapper vs ServiceImpl 选型

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 简单 CRUD | `BaseMapper` | 直接、轻量，无需 Service 层 |
| 复杂业务逻辑 | `ServiceImpl` | 封装业务逻辑，便于事务管理 |
| 批量操作 | `ServiceImpl` | 提供 `saveBatch` 等批量方法 |
| 链式操作 | `ServiceImpl` | 支持 Lambda 链式查询 |
| 需要事务 | `ServiceImpl` | 在 Service 层统一加 `@Transactional` |

**层级关系：**

```
ServiceImpl → IService → BaseMapper
    ↓
  封装业务逻辑 + 事务管理
```

### ServiceImpl 使用示例

```java
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    // 1. 保存用户
    public boolean addUser(User user) {
        return save(user);
    }

    // 2. 批量保存（每 500 条提交一次）
    public boolean addUsers(List<User> users) {
        return saveBatch(users, 500);
    }

    // 3. 根据 ID 查询
    public User getUserById(Long id) {
        return getById(id);
    }

    // 4. 条件查询
    public List<User> getUsersByStatus(Integer status) {
        return list(new LambdaQueryWrapper<User>()
            .eq(User::getStatus, status));
    }

    // 5. 分页查询
    public Page<User> getUserPage(int current, int size) {
        return page(new Page<>(current, size));
    }

    // 6. 更新用户
    public boolean updateUser(User user) {
        return updateById(user);
    }

    // 7. 删除用户
    public boolean removeUser(Long id) {
        return removeById(id);
    }

    // 8. 复杂业务：带事务的查询并处理
    @Transactional
    public void transferUser(Long fromId, Long toId) {
        User fromUser = getById(fromId);
        User toUser = getById(toId);
        // ... 业务逻辑处理
    }
}
```

## 九、SQL 与 API 对照速查

| 原生 SQL | MyBatis-Plus API | 说明 |
|----------|-----------------|------|
| `INSERT INTO ... VALUES ...` | `insert(entity)` | 单条插入 |
| 批量 `INSERT` | `saveBatch(list)` | 批量插入 |
| `UPDATE ... SET ... WHERE id=?` | `updateById(entity)` | 按 ID 更新 |
| `UPDATE ... SET ... WHERE ...` | `update(entity, wrapper)` | 条件更新 |
| `DELETE FROM ... WHERE id=?` | `deleteById(id)` | 按 ID 删除 |
| `DELETE FROM ... WHERE id IN (...)` | `deleteBatchIds(ids)` | 批量删除 |
| `SELECT * FROM ... WHERE id=?` | `selectById(id)` | 按 ID 查询 |
| `SELECT * FROM ... WHERE ...` | `selectList(wrapper)` | 条件查询 |
| `SELECT COUNT(*) FROM ...` | `selectCount(wrapper)` | 计数 |
| `SELECT ... LIMIT offset, size` | `selectPage(page, wrapper)` | 分页查询 |
| 多表 `JOIN` | XML Mapper | 关联查询 |
| `GROUP BY` + 聚合 | XML Mapper | 统计查询 |

## 十、完整业务示例

```java
@Service
public class UserService extends ServiceImpl<UserMapper, User> {

    /**
     * 分页查询用户列表
     */
    public IPage<User> queryPage(UserQueryDTO query) {
        return page(
            new Page<>(query.getPageNo(), query.getPageSize()),
            new LambdaQueryWrapper<User>()
                .like(StringUtils.isNotBlank(query.getName()),
                       User::getName, query.getName())
                .eq(query.getStatus() != null,
                       User::getStatus, query.getStatus())
                .orderByDesc(User::getCreateTime)
        );
    }

    /**
     * 批量更新用户状态
     */
    public void batchUpdateStatus(List<Long> ids, Integer status) {
        update(new LambdaUpdateWrapper<User>()
            .set(User::getStatus, status)
            .set(User::getUpdateTime, LocalDateTime.now())
            .in(User::getId, ids)
        );
    }
}
```

## 十一、常用配置速查

```yaml
mybatis-plus:
  mapper-locations: classpath*:/mapper/**/*.xml
  type-aliases-package: com.example.entity
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
    map-underscore-to-camel-case: true
  global-config:
    db-config:
      id-type: assign_id          # AUTO / ASSIGN_ID / ASSIGN_UUID / INPUT
      table-prefix: tb_           # 全局表前缀
      logic-delete-field: deleted # 逻辑删除字段
      logic-delete-value: 1       # 已删除值
      logic-not-delete-value: 0   # 未删除值
      update-strategy: not_null   # NOT_NULL / NOT_EMPTY / IGNORED
```
