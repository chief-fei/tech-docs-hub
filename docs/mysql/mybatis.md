# MyBatis 完全指南

MyBatis 是一款优秀的**半自动 ORM 框架**。与全自动框架（如 Hibernate）不同，MyBatis 让你自己编写 SQL，只负责帮你做两件事：

1. **参数映射**：将 Java 对象自动填入 SQL 中的占位符
2. **结果映射**：将 SQL 查询结果自动转为 Java 对象

这种方式让你对 SQL 有**完全的控制权**——复杂的联表查询、存储过程调用、动态条件拼接，你都可以直接写 SQL 来实现。

> 适用版本：`mybatis-spring-boot-starter: 2.3.x`（Spring Boot 2.7.x）

---

## 一、Maven 依赖

```xml
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>2.3.2</version>
</dependency>
```

> 如果你同时使用 MyBatis-Plus，`mybatis-plus-boot-starter` 已包含 MyBatis 核心依赖，无需单独引入。

## 二、application.yml 配置

```yaml
mybatis:
  # XML Mapper 文件位置（支持通配符）
  mapper-locations: classpath*:/mapper/**/*.xml
  # 实体类别名包（XML 中可直接用类名）
  type-aliases-package: com.example.entity
  configuration:
    # 驼峰转下划线：userName → user_name
    map-underscore-to-camel-case: true
    # SQL 日志输出
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
```

## 三、实体类 & Mapper 接口

```java
// 实体类
@Data
public class User {
    private Long id;
    private String userName;
    private Integer age;
    private String email;
    private Long deptId;
    private LocalDateTime createTime;
}
```

```java
// Mapper 接口（不需要实现类）
@Mapper
public interface UserMapper {

    User selectById(@Param("id") Long id);

    List<User> selectByCondition(@Param("name") String name,
                                 @Param("minAge") Integer minAge,
                                 @Param("maxAge") Integer maxAge);

    int insert(User user);

    int updateById(User user);

    int deleteById(@Param("id") Long id);
}
```

## 四、XML Mapper 文件

XML Mapper 是 MyBatis 的核心，所有自定义 SQL 都写在 XML 文件中。

### 4.1 文件结构与位置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<!-- namespace 必须与 Mapper 接口的全限定名一致 -->
<mapper namespace="com.example.mapper.UserMapper">

    <!-- SQL 语句写在这里 -->

</mapper>
```

文件位置遵循 `application.yml` 中 `mapper-locations` 的配置，通常放在 `src/main/resources/mapper/` 目录下。

### 4.2 基本标签

```xml
<mapper namespace="com.example.mapper.UserMapper">

    <!-- 查询 -->
    <select id="selectById" resultType="User">
        SELECT id, user_name, age, email, dept_id, create_time
        FROM tb_user
        WHERE id = #{id}
    </select>

    <!-- 插入 -->
    <insert id="insert" parameterType="User">
        INSERT INTO tb_user (user_name, age, email, create_time)
        VALUES (#{userName}, #{age}, #{email}, #{createTime})
    </insert>

    <!-- 插入后返回自增主键 -->
    <insert id="insertAndGetId" parameterType="User"
            useGeneratedKeys="true" keyProperty="id">
        INSERT INTO tb_user (user_name, age, email)
        VALUES (#{userName}, #{age}, #{email})
    </insert>

    <!-- 更新 -->
    <update id="updateById" parameterType="User">
        UPDATE tb_user
        SET user_name = #{userName},
            age = #{age},
            email = #{email},
            update_time = NOW()
        WHERE id = #{id}
    </update>

    <!-- 删除 -->
    <delete id="deleteById">
        DELETE FROM tb_user WHERE id = #{id}
    </delete>

</mapper>
```

### 4.3 resultMap —— 高级结果映射

当数据库字段名与 Java 属性名不一致、或者需要嵌套对象映射时，用 `resultMap` 替代 `resultType`。

```xml
<!-- 基本字段映射 -->
<resultMap id="UserMap" type="User">
    <id column="id" property="id"/>
    <result column="user_name" property="userName"/>
    <result column="age" property="age"/>
    <result column="email" property="email"/>
    <result column="dept_id" property="deptId"/>
    <result column="create_time" property="createTime"/>
</resultMap>

<select id="selectById" resultMap="UserMap">
    SELECT * FROM tb_user WHERE id = #{id}
</select>
```

> 如果开启了 `map-underscore-to-camel-case: true`，`user_name` 会自动映射到 `userName`，此时不需要显式写 resultMap。

**一对一关联：**

```xml
<resultMap id="UserWithDeptMap" type="User">
    <id column="id" property="id"/>
    <result column="user_name" property="userName"/>
    <association property="dept" javaType="Dept">
        <id column="dept_id" property="id"/>
        <result column="dept_name" property="deptName"/>
    </association>
</resultMap>
```

**一对多关联：**

```xml
<resultMap id="DeptWithUsersMap" type="Dept">
    <id column="id" property="id"/>
    <result column="dept_name" property="deptName"/>
    <collection property="users" ofType="User">
        <id column="user_id" property="id"/>
        <result column="user_name" property="userName"/>
    </collection>
</resultMap>
```

### 4.4 动态 SQL

动态 SQL 是 MyBatis 最强大的特性之一——根据条件动态拼接 SQL。

```xml
<!-- if + where：自动处理 AND/OR -->
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
</select>

<!-- set：动态更新，自动去掉末尾逗号 -->
<update id="updateSelective">
    UPDATE tb_user
    <set>
        <if test="userName != null">user_name = #{userName},</if>
        <if test="age != null">age = #{age},</if>
        <if test="email != null">email = #{email},</if>
        update_time = NOW(),
    </set>
    WHERE id = #{id}
</update>

<!-- foreach：IN 查询和批量操作 -->
<select id="selectByIds" resultType="User">
    SELECT * FROM tb_user
    WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
</select>

<insert id="batchInsert">
    INSERT INTO tb_user (user_name, age) VALUES
    <foreach collection="list" item="user" separator=",">
        (#{user.userName}, #{user.age})
    </foreach>
</insert>

<!-- choose / when / otherwise：多分支选择 -->
<select id="selectByPriority" resultType="User">
    SELECT * FROM tb_user
    <where>
        <choose>
            <when test="name != null and name != ''">
                AND user_name = #{name}
            </when>
            <when test="email != null and email != ''">
                AND email = #{email}
            </when>
            <otherwise>
                AND status = 1
            </otherwise>
        </choose>
    </where>
</select>
```

### 4.5 sql + include —— SQL 片段复用

```xml
<!-- 定义公共列 -->
<sql id="Base_Column_List">
    id, user_name, age, email, dept_id, create_time, update_time
</sql>

<select id="selectById" resultType="User">
    SELECT <include refid="Base_Column_List"/>
    FROM tb_user
    WHERE id = #{id}
</select>
```

## 五、注解方式

MyBatis 支持通过注解替代 XML，适用于简单场景。

### 5.1 CRUD 注解

```java
@Mapper
public interface UserMapper {

    @Select("SELECT * FROM tb_user WHERE id = #{id}")
    User selectById(Long id);

    @Insert("INSERT INTO tb_user (user_name, age, email) VALUES (#{userName}, #{age}, #{email})")
    int insert(User user);

    // 返回自增主键
    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("INSERT INTO tb_user (user_name, age) VALUES (#{userName}, #{age})")
    int insertAndGetId(User user);

    @Update("UPDATE tb_user SET age = #{age} WHERE id = #{id}")
    int updateAge(@Param("id") Long id, @Param("age") Integer age);

    @Delete("DELETE FROM tb_user WHERE id = #{id}")
    int deleteById(Long id);
}
```

### 5.2 结果映射注解

```java
@Results(id = "userMap", value = {
    @Result(column = "id", property = "id", id = true),
    @Result(column = "user_name", property = "userName"),
    @Result(column = "dept_id", property = "deptId")
})
@Select("SELECT * FROM tb_user WHERE id = #{id}")
User selectById(Long id);

// 复用已定义的映射
@ResultMap("userMap")
@Select("SELECT * FROM tb_user WHERE dept_id = #{deptId}")
List<User> selectByDeptId(Long deptId);
```

### 5.3 关联查询注解

```java
// 一对一
@Results({
    @Result(column = "id", property = "id", id = true),
    @Result(column = "dept_id", property = "dept",
        one = @One(select = "com.example.mapper.DeptMapper.selectById"))
})
@Select("SELECT * FROM tb_user WHERE id = #{id}")
User selectUserWithDept(Long id);

// 一对多
@Results({
    @Result(column = "id", property = "id", id = true),
    @Result(column = "id", property = "users",
        many = @Many(select = "com.example.mapper.UserMapper.selectByDeptId"))
})
@Select("SELECT * FROM tb_dept WHERE id = #{id}")
Dept selectDeptWithUsers(Long id);
```

## 六、注解 vs XML 选型

| 维度 | 注解方式 | XML 方式 |
|------|---------|---------|
| 简单查询 | `@Select("SELECT ...")` 很方便 | 需要单独创建 XML 文件 |
| 复杂 SQL | 多行字符串拼接，可读性差 | 结构清晰，支持缩进和注释 |
| 动态 SQL | 需要用 `<script>` 标签包裹，不自然 | `<if>`、`<foreach>` 等天然支持 |
| 关联查询 | `@Results` + `@One`/`@Many`，很繁琐 | `resultMap` 直观且可复用 |
| SQL 维护 | 改 SQL 要重新编译 | 改 XML 无需重新编译 |

> **推荐策略**：简单 CRUD 用注解，复杂 SQL（联表、动态条件、关联查询）用 XML。

## 七、XML 标签速查表

| 标签 | 用途 | 关键属性 |
|------|------|---------|
| `<select>` | 查询 | `id`, `resultType` / `resultMap` |
| `<insert>` | 插入 | `id`, `useGeneratedKeys`, `keyProperty` |
| `<update>` | 更新 | `id` |
| `<delete>` | 删除 | `id` |
| `<resultMap>` | 结果映射 | `id`, `type` |
| `<result>` | 字段映射 | `column`, `property` |
| `<association>` | 一对一关联 | `property`, `javaType` |
| `<collection>` | 一对多关联 | `property`, `ofType` |
| `<sql>` + `<include>` | SQL 片段复用 | `id`, `refid` |
| `<if>` | 条件判断 | `test` |
| `<where>` | 动态 WHERE | — |
| `<set>` | 动态 SET | — |
| `<foreach>` | 遍历集合 | `collection`, `item`, `separator` |
| `<choose>` + `<when>` + `<otherwise>` | 多分支选择 | `test` |
| `<trim>` | 通用修剪 | `prefix`, `suffix`, `prefixOverrides` |
| `<bind>` | 变量绑定 | `name`, `value` |

## 八、最佳实践

1. **始终定义 Base_Column_List**：所有 SELECT 语句通过 `<include>` 引用公共列，避免列名拼写错误
2. **复杂查询用 resultMap**：涉及多表联查时用 `resultMap` + `association`/`collection`
3. **避免 SELECT ***：在 XML 中明确列出需要的列
4. **动态 SQL 优先用 `<where>` 和 `<set>`**：不要写 `WHERE 1=1`
5. **分页配合 PageHelper**：

```xml
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>1.4.7</version>
</dependency>
```

```java
PageHelper.startPage(1, 20);
List<User> users = userMapper.selectByCondition(name, null, null);
PageInfo<User> pageInfo = new PageInfo<>(users);
```
