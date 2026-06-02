# MyBatis 注解速查手册

MyBatis 支持通过注解方式替代 XML Mapper 来编写 SQL，适用于简单场景。

> 复杂 SQL（联表、动态条件、关联查询）仍推荐使用 [XML Mapper](./mybatis/)，注解方式更适用于简单 CRUD。

## 一、CRUD 注解

### 1.1 @Select

用于声明查询语句，对应 XML 的 `<select>` 标签。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String[]` | SQL 语句（数组会拼接为一行） |

```java
@Mapper
public interface UserMapper {

    @Select("SELECT * FROM tb_user WHERE id = #{id}")
    User selectById(Long id);

    @Select("SELECT * FROM tb_user WHERE age > #{minAge} AND age < #{maxAge}")
    List<User> selectByAgeRange(@Param("minAge") int minAge,
                                @Param("maxAge") int maxAge);
}
```

### 1.2 @Insert

用于声明插入语句，对应 XML 的 `<insert>` 标签。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String[]` | SQL 语句 |

```java
@Insert("INSERT INTO tb_user (user_name, age, email) VALUES (#{userName}, #{age}, #{email})")
int insert(User user);

// 返回自增主键
@Options(useGeneratedKeys = true, keyProperty = "id")
@Insert("INSERT INTO tb_user (user_name, age) VALUES (#{userName}, #{age})")
int insertAndGetId(User user);
```

### 1.3 @Update

用于声明更新语句，对应 XML 的 `<update>` 标签。

```java
@Update("UPDATE tb_user SET age = #{age} WHERE id = #{id}")
int updateAge(@Param("id") Long id, @Param("age") Integer age);
```

### 1.4 @Delete

用于声明删除语句，对应 XML 的 `<delete>` 标签。

```java
@Delete("DELETE FROM tb_user WHERE id = #{id}")
int deleteById(Long id);
```

## 二、参数注解

### 2.1 @Param

为方法参数指定名称，在 SQL 中通过 `#{}` 引用。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `String` | SQL 中引用的参数名 |

```java
// 多参数时必须使用 @Param
@Select("SELECT * FROM tb_user WHERE user_name = #{name} AND age = #{age}")
List<User> selectByNameAndAge(@Param("name") String name, @Param("age") Integer age);
```

> **何时必须使用 @Param**：
> - 方法有多个参数时
> - 参数是 Collection（List、Set）或数组时
> - XML 中需要引用参数时

## 三、结果映射注解

### 3.1 @Results + @Result

对应 XML 的 `<resultMap>` + `<result>`，用于指定列与属性的映射关系。

```java
// 定义映射
@Results(id = "userMap", value = {
    @Result(column = "id", property = "id", id = true),
    @Result(column = "user_name", property = "userName"),
    @Result(column = "dept_id", property = "deptId"),
    @Result(column = "create_time", property = "createTime")
})
@Select("SELECT * FROM tb_user WHERE id = #{id}")
User selectById(Long id);

// 复用已定义的映射
@ResultMap("userMap")
@Select("SELECT * FROM tb_user WHERE dept_id = #{deptId}")
List<User> selectByDeptId(Long deptId);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `column` | `String` | 数据库列名 |
| `property` | `String` | Java 属性名 |
| `javaType` | `Class<?>` | Java 类型 |
| `jdbcType` | `JdbcType` | JDBC 类型 |
| `id` | `boolean` | 是否为主键（默认 false） |

### 3.2 @One（一对一关联）

对应 XML 的 `<association>`，通过子查询获取关联对象。

```java
@Results({
    @Result(column = "id", property = "id", id = true),
    @Result(column = "user_name", property = "userName"),
    @Result(column = "dept_id", property = "dept",
        one = @One(select = "com.example.mapper.DeptMapper.selectById"))
})
@Select("SELECT * FROM tb_user WHERE id = #{id}")
User selectUserWithDept(Long id);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `select` | `String` | 子查询方法全限定名 |
| `fetchType` | `FetchType` | 加载方式：`LAZY`（懒加载）/ `EAGER`（立即加载） |

### 3.3 @Many（一对多关联）

对应 XML 的 `<collection>`，通过子查询获取关联集合。

```java
@Results({
    @Result(column = "id", property = "id", id = true),
    @Result(column = "dept_name", property = "deptName"),
    @Result(column = "id", property = "users",
        many = @Many(select = "com.example.mapper.UserMapper.selectByDeptId"))
})
@Select("SELECT * FROM tb_dept WHERE id = #{id}")
Dept selectDeptWithUsers(Long id);
```

## 四、Provider 动态 SQL 注解

当需要在注解中构建动态 SQL 时可使用 @XXXProvider。

| 注解 | 说明 |
|------|------|
| `@SelectProvider` | 动态 SELECT |
| `@InsertProvider` | 动态 INSERT |
| `@UpdateProvider` | 动态 UPDATE |
| `@DeleteProvider` | 动态 DELETE |

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `Class<?>` | Provider 类 |
| `method` | `String` | 生成 SQL 的方法名 |

```java
// Mapper 接口
@SelectProvider(type = UserSqlProvider.class, method = "selectByCondition")
List<User> selectByCondition(String name, Integer minAge, Integer maxAge);

// Provider 类
public class UserSqlProvider {
    public String selectByCondition(String name, Integer minAge, Integer maxAge) {
        return new SQL() {{
            SELECT("*");
            FROM("tb_user");
            if (name != null && !name.isEmpty()) {
                WHERE("user_name LIKE CONCAT('%', #{name}, '%')");
            }
            if (minAge != null) {
                WHERE("age >= #{minAge}");
            }
            if (maxAge != null) {
                WHERE("age <= #{maxAge}");
            }
        }}.toString();
    }
}
```

## 五、其他常用注解

### 5.1 @Mapper

标记 Mapper 接口，使其被 MyBatis 识别并生成代理实现类。如果使用 `@MapperScan`，可以不写此注解。

```java
@Mapper
public interface UserMapper { }
```

### 5.2 @MapperScan

在启动类或配置类上声明，批量扫描 Mapper 包。

```java
@SpringBootApplication
@MapperScan("com.example.mapper")
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` / `basePackages` | `String[]` | 扫描的包路径 |
| `sqlSessionTemplateRef` | `String` | SqlSessionTemplate Bean 名（多数据源时使用） |

### 5.3 @Options

配置 INSERT/UPDATE/DELETE 的额外选项。

```java
@Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
@Insert("INSERT INTO tb_user (user_name, age) VALUES (#{userName}, #{age})")
int insert(User user);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `useGeneratedKeys` | `boolean` | 是否使用数据库自增主键 |
| `keyProperty` | `String` | 主键对应的 Java 属性名 |
| `keyColumn` | `String` | 主键对应的数据库列名 |
| `useCache` | `boolean` | 是否使用二级缓存 |
| `flushCache` | `boolean` | 执行后是否清空缓存 |
| `timeout` | `int` | 超时时间（秒） |

### 5.4 @ResultMap

引用 XML 中已定义或 `@Results` 中已命名的 resultMap，避免重复定义。

```java
@ResultMap("userMap")
@Select("SELECT * FROM tb_user WHERE id = #{id}")
User selectById(Long id);
```

### 5.5 @CacheNamespace

在 Mapper 接口上开启二级缓存。

```java
@CacheNamespace(eviction = LruCache.class,
                flushInterval = 60000,
                size = 512,
                readWrite = true)
@Mapper
public interface UserMapper { }
```

## 六、注解方式 vs XML 方式

| 维度 | 注解方式 | XML 方式 |
|------|---------|---------|
| 简单查询 | 方便，直接写在接口上 | 需要单独创建 XML 文件 |
| 复杂 SQL | 多行字符串拼接，可读性差 | 结构清晰，支持缩进和注释 |
| 动态 SQL | 需要用 `<script>` 包裹或 @XXXProvider | `<if>`、`<foreach>` 等天然支持 |
| 关联查询 | `@Results` + `@One`/`@Many`，很繁琐 | `resultMap` 直观且可复用 |
| SQL 维护 | 改 SQL 要重新编译 | 改 XML 无需重新编译 |

> 推荐策略：**简单 CRUD 用注解，复杂 SQL 走 XML**。MyBatis-Plus 的 `BaseMapper` 比注解方式更简洁，实际项目中优先使用。

## 七、速查表

| 注解 | 用途 | 示例 |
|------|------|------|
| `@Select` | 查询 | `@Select("SELECT ...")` |
| `@Insert` | 插入 | `@Insert("INSERT INTO ...")` |
| `@Update` | 更新 | `@Update("UPDATE ... SET ...")` |
| `@Delete` | 删除 | `@Delete("DELETE FROM ...")` |
| `@Param` | 参数命名 | `@Param("name") String name` |
| `@Results` | 结果映射集 | `@Results({@Result(...)})` |
| `@Result` | 单个字段映射 | `@Result(column="id", property="id")` |
| `@ResultMap` | 引用已有映射 | `@ResultMap("userMap")` |
| `@One` | 一对一关联 | `@One(select="...")` |
| `@Many` | 一对多关联 | `@Many(select="...")` |
| `@Options` | 额外选项 | `@Options(useGeneratedKeys=true)` |
| `@Mapper` | 标记 Mapper 接口 | `@Mapper` |
| `@MapperScan` | 批量扫描 | `@MapperScan("com.example.mapper")` |
| `@SelectProvider` | 动态 SELECT Provider | `@SelectProvider(type=..., method=...)` |
| `@InsertProvider` | 动态 INSERT Provider | `@InsertProvider(type=..., method=...)` |
| `@UpdateProvider` | 动态 UPDATE Provider | `@UpdateProvider(type=..., method=...)` |
| `@DeleteProvider` | 动态 DELETE Provider | `@DeleteProvider(type=..., method=...)` |
| `@CacheNamespace` | 二级缓存配置 | `@CacheNamespace(eviction=LruCache.class)` |