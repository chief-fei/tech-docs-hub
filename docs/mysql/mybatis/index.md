# MyBatis 使用指南

## 什么是 MyBatis？

MyBatis 是一款优秀的**半自动 ORM 框架**。与全自动框架（如 Hibernate）不同，MyBatis 让你自己编写 SQL，只负责帮你做两件事：

1. **参数映射**：将 Java 对象自动填入 SQL 中的占位符
2. **结果映射**：将 SQL 查询结果自动转为 Java 对象

这种方式让你对 SQL 有**完全的控制权**——复杂的联表查询、存储过程调用、动态条件拼接，你都可以直接写 SQL 来实现。

> 适用版本：`mybatis-spring-boot-starter: 2.3.x`（Spring Boot 2.7.x）

## MyBatis 与 MyBatis-Plus 的关系

MyBatis-Plus 是 MyBatis 的增强工具，在 MyBatis 基础上提供了通用 CRUD、分页、条件构造器等功能。你可以同时使用两者——用 MyBatis-Plus 的 `BaseMapper` 处理简单 CRUD，用 MyBatis XML Mapper 处理复杂 SQL。

> 注解速查：[MyBatis 注解说明](../mybatis-annotations) | [MyBatis-Plus 注解说明](../mybatis-plus-annotations)

---

## 一、Maven 依赖

```xml
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>2.3.2</version>
</dependency>
```

> 如果你同时使用 MyBatis-Plus，`mybatis-plus-boot-starter` 已包含 MyBatis 核心依赖，无需单独引入 `mybatis-spring-boot-starter`。

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

---

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

---

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

文件位置遵循 `application.yml` 中 `mapper-locations` 的配置，通常放在 `src/main/resources/mapper/` 目录下，文件名建议与 Mapper 接口名对应，如 `UserMapper.xml`。

---

## 五、XML 标签详解

### 5.1 select —— 查询语句

最常用的标签，用于执行 SELECT 查询：

```xml
<mapper namespace="com.example.mapper.UserMapper">

    <!-- 基本查询：resultType 指定返回值类型 -->
    <select id="selectById" resultType="User">
        SELECT id, user_name, age, email, dept_id, create_time
        FROM tb_user
        WHERE id = #{id}
    </select>

    <!-- 参数是多个基本类型时，用 @Param 指定名字 -->
    <select id="selectByAgeRange" resultType="User">
        SELECT * FROM tb_user
        WHERE age BETWEEN #{minAge} AND #{maxAge}
    </select>

    <!-- 返回单值 -->
    <select id="countUsers" resultType="int">
        SELECT COUNT(*) FROM tb_user
    </select>

    <!-- 返回 Map -->
    <select id="selectAsMap" resultType="java.util.HashMap">
        SELECT id, user_name FROM tb_user WHERE id = #{id}
    </select>

</mapper>
```

| 属性 | 说明 |
|------|------|
| `id` | 方法名，与 Mapper 接口的方法名一致 |
| `resultType` | 返回值类型（实体类全限定名或别名） |
| `resultMap` | 引用自定义的 resultMap（与 resultType 二选一） |
| `parameterType` | 参数类型（可省略，MyBatis 自动识别） |
| `useCache` | 是否使用二级缓存（默认 true） |
| `flushCache` | 执行后是否清空缓存 |

### 5.2 insert —— 插入语句

```xml
<mapper namespace="com.example.mapper.UserMapper">

    <!-- 基本插入：#{属性名} 从参数对象中取值 -->
    <insert id="insert" parameterType="User">
        INSERT INTO tb_user (user_name, age, email, create_time)
        VALUES (#{userName}, #{age}, #{email}, #{createTime})
    </insert>

    <!-- 插入后返回自增主键：useGeneratedKeys + keyProperty -->
    <insert id="insertAndGetId" parameterType="User"
            useGeneratedKeys="true" keyProperty="id">
        INSERT INTO tb_user (user_name, age, email)
        VALUES (#{userName}, #{age}, #{email})
    </insert>

    <!-- 批量插入 -->
    <insert id="batchInsert" parameterType="list">
        INSERT INTO tb_user (user_name, age, email)
        VALUES
        <foreach collection="list" item="user" separator=",">
            (#{user.userName}, #{user.age}, #{user.email})
        </foreach>
    </insert>

</mapper>
```

> `useGeneratedKeys="true"` 会让数据库生成的自增 ID 自动回填到实体对象的 `id` 属性中。

### 5.3 update —— 更新语句

```xml
<mapper namespace="com.example.mapper.UserMapper">

    <update id="updateById" parameterType="User">
        UPDATE tb_user
        SET user_name = #{userName},
            age = #{age},
            email = #{email},
            update_time = NOW()
        WHERE id = #{id}
    </update>

    <!-- 条件更新 -->
    <update id="updateStatus">
        UPDATE tb_user
        SET status = #{status}
        WHERE id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
    </update>

</mapper>
```

### 5.4 delete —— 删除语句

```xml
<mapper namespace="com.example.mapper.UserMapper">

    <delete id="deleteById">
        DELETE FROM tb_user WHERE id = #{id}
    </delete>

    <!-- 批量删除 -->
    <delete id="deleteByIds">
        DELETE FROM tb_user
        WHERE id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
    </delete>

</mapper>
```

---

## 六、resultMap —— 高级结果映射

当数据库字段名与 Java 属性名不一致、或者需要嵌套对象映射时，用 `resultMap` 替代 `resultType`。

### 6.1 基本字段映射

```xml
<!-- 定义 resultMap -->
<resultMap id="UserMap" type="User">
    <!-- id 标签用于主键，可以提升性能 -->
    <id column="id" property="id"/>
    <!-- result 标签用于普通字段 -->
    <result column="user_name" property="userName"/>
    <result column="age" property="age"/>
    <result column="email" property="email"/>
    <result column="dept_id" property="deptId"/>
    <result column="create_time" property="createTime"/>
</resultMap>

<!-- 使用 resultMap -->
<select id="selectById" resultMap="UserMap">
    SELECT * FROM tb_user WHERE id = #{id}
</select>
```

> 如果开启了 `map-underscore-to-camel-case: true`，`user_name` 会自动映射到 `userName`，此时不需要显式写 resultMap。

### 6.2 association —— 一对一关联

当 User 关联一个 Dept 对象时使用：

```java
@Data
public class User {
    private Long id;
    private String userName;
    private Dept dept;   // 关联的部门对象
}

@Data
public class Dept {
    private Long id;
    private String deptName;
}
```

```xml
<resultMap id="UserWithDeptMap" type="User">
    <id column="id" property="id"/>
    <result column="user_name" property="userName"/>

    <!-- association：一对一关联 -->
    <association property="dept" javaType="Dept">
        <id column="dept_id" property="id"/>
        <result column="dept_name" property="deptName"/>
    </association>
</resultMap>

<select id="selectUserWithDept" resultMap="UserWithDeptMap">
    SELECT u.*, d.id AS dept_id, d.dept_name
    FROM tb_user u
    LEFT JOIN tb_dept d ON u.dept_id = d.id
    WHERE u.id = #{id}
</select>
```

### 6.3 collection —— 一对多关联

当 Dept 关联多个 User 时使用：

```java
@Data
public class Dept {
    private Long id;
    private String deptName;
    private List<User> users;   // 部门下的用户列表
}
```

```xml
<resultMap id="DeptWithUsersMap" type="Dept">
    <id column="id" property="id"/>
    <result column="dept_name" property="deptName"/>

    <!-- collection：一对多关联 -->
    <collection property="users" ofType="User">
        <id column="user_id" property="id"/>
        <result column="user_name" property="userName"/>
        <result column="age" property="age"/>
    </collection>
</resultMap>

<select id="selectDeptWithUsers" resultMap="DeptWithUsersMap">
    SELECT d.*, u.id AS user_id, u.user_name, u.age
    FROM tb_dept d
    LEFT JOIN tb_user u ON d.id = u.dept_id
    WHERE d.id = #{id}
</select>
```

> `association` 用 `javaType` 指定类型，`collection` 用 `ofType` 指定集合元素类型。

---

## 七、动态 SQL

动态 SQL 是 MyBatis 最强大的特性之一——根据条件动态拼接 SQL，避免在 Java 代码中手动组装。

### 7.1 if —— 条件判断

```xml
<select id="selectByCondition" resultType="User">
    SELECT * FROM tb_user
    WHERE 1 = 1
    <if test="name != null and name != ''">
        AND user_name LIKE CONCAT('%', #{name}, '%')
    </if>
    <if test="minAge != null">
        AND age &gt;= #{minAge}
    </if>
    <if test="maxAge != null">
        AND age &lt;= #{maxAge}
    </if>
</select>
```

> `WHERE 1=1` 是为了避免第一个条件没有 `AND` 的情况，但这不够优雅。用 `<where>` 标签可以解决。

### 7.2 where —— 自动处理 AND/OR

`<where>` 标签会自动去掉开头的 `AND` 或 `OR`，如果所有条件都不满足则不加 `WHERE`：

```xml
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
</select>
```

### 7.3 set —— 动态更新

`<set>` 标签用于 UPDATE 语句，自动去掉末尾多余的逗号：

```xml
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
```

### 7.4 foreach —— 遍历集合

最常用于 IN 查询和批量操作：

```xml
<!-- IN 查询 -->
<select id="selectByIds" resultType="User">
    SELECT * FROM tb_user
    WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
</select>

<!-- 批量插入 -->
<insert id="batchInsert">
    INSERT INTO tb_user (user_name, age) VALUES
    <foreach collection="list" item="user" separator=",">
        (#{user.userName}, #{user.age})
    </foreach>
</insert>
```

| 属性 | 说明 |
|------|------|
| `collection` | 集合参数名（List 类型写 `list`，数组写 `array`，@Param 指定写自定义名） |
| `item` | 集合中每个元素的别名 |
| `index` | 当前索引（可选） |
| `open` | 循环开始前的字符，如 `(` |
| `separator` | 每次循环之间的分隔符，如 `,` |
| `close` | 循环结束后的字符，如 `)` |

### 7.5 choose / when / otherwise —— 多分支选择

类似 Java 的 `switch-case-default`：

```xml
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

### 7.6 trim —— 通用修剪

`<trim>` 是 `<where>` 和 `<set>` 的底层实现，可以自定义修剪规则：

```xml
<!-- 等价于 <where> -->
<trim prefix="WHERE" prefixOverrides="AND |OR ">
    <if test="name != null">AND user_name = #{name}</if>
    <if test="age != null">AND age = #{age}</if>
</trim>

<!-- 等价于 <set> -->
<trim prefix="SET" suffixOverrides=",">
    <if test="userName != null">user_name = #{userName},</if>
    <if test="age != null">age = #{age},</if>
</trim>
```

| 属性 | 说明 |
|------|------|
| `prefix` | 在内容前添加的前缀（如 `WHERE`） |
| `prefixOverrides` | 去掉内容开头的指定字符 |
| `suffix` | 在内容后添加的后缀 |
| `suffixOverrides` | 去掉内容末尾的指定字符 |

### 7.7 bind —— 变量绑定

创建一个变量用于 SQL 拼接，常用于模糊查询的方言适配：

```xml
<select id="selectByName" resultType="User">
    <bind name="pattern" value="'%' + name + '%'"/>
    SELECT * FROM tb_user
    WHERE user_name LIKE #{pattern}
</select>
```

---

## 八、sql + include —— SQL 片段复用

当多个 SELECT 语句有相同的列时，用 `sql` 定义片段，`include` 引用：

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

<select id="selectAll" resultType="User">
    SELECT <include refid="Base_Column_List"/>
    FROM tb_user
    ORDER BY id DESC
</select>
```

`sql` 片段也支持传入参数：

```xml
<sql id="FilterByStatus">
    <if test="status != null">
        AND status = #{status}
    </if>
</sql>

<select id="selectWithFilter" resultType="User">
    SELECT * FROM tb_user
    <where>
        <include refid="FilterByStatus"/>
    </where>
</select>
```

---

## 九、注解方式 vs XML 方式

| 维度 | 注解方式 | XML 方式 |
|------|---------|---------|
| 简单查询 | `@Select("SELECT ...")` 很方便 | 需要单独创建 XML 文件，略显繁琐 |
| 复杂 SQL | 多行字符串拼接，可读性差 | 结构清晰，支持缩进和注释 |
| 动态 SQL | 需要用 `<script>` 标签包裹，不自然 | `<if>`、`<foreach>` 等天然支持 |
| 关联查询 | 需要用 `@Results` + `@Result`，很繁琐 | `resultMap` 直观且可复用 |
| SQL 维护 | 改 SQL 要重新编译 | 改 XML 无需重新编译 |

> **推荐策略**：简单 CRUD 用注解，复杂 SQL（联表、动态条件、关联查询）用 XML。

---

## 十、XML 使用总结速查表

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
| `<where>` | 动态 WHERE 去除多余 AND/OR | — |
| `<set>` | 动态 SET 去除多余逗号 | — |
| `<foreach>` | 遍历集合 | `collection`, `item`, `separator` |
| `<choose>` + `<when>` + `<otherwise>` | 多分支选择 | `test` |
| `<trim>` | 通用修剪 | `prefix`, `suffix`, `prefixOverrides` |
| `<bind>` | 变量绑定 | `name`, `value` |

---

## 十一、最佳实践

### 11.1 始终定义 Base_Column_List

所有 SELECT 语句通过 `<include>` 引用公共列，避免列名拼写错误：

```xml
<sql id="Base_Column_List">id, user_name, age, email, dept_id, create_time</sql>
```

### 11.2 复杂查询用 resultMap，不要用 resultType

涉及多表联查时用 `resultMap` + `association`/`collection`，结构清晰且可复用。

### 11.3 避免 SELECT *

在 XML 中明确列出需要的列，避免查出无用字段增加传输开销。

### 11.4 Mapper XML 与接口放在同一包路径下

如果 `mapper-locations` 配置为 `classpath:/mapper/**/*.xml`，则 XML 文件放在 `resources/mapper/` 下，文件名与 Mapper 接口名对应。

### 11.5 动态 SQL 优先用 `<where>` 和 `<set>`

不要写 `WHERE 1=1`，用 `<where>` 标签更优雅。

### 11.6 分页——配合 PageHelper 使用

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>1.4.7</version>
</dependency>
```

```java
// 使用：startPage 紧挨着查询方法即可
PageHelper.startPage(1, 20);
List<User> users = userMapper.selectByCondition(name, null, null);
PageInfo<User> pageInfo = new PageInfo<>(users);

pageInfo.getTotal();     // 总记录数
pageInfo.getPages();     // 总页数
pageInfo.getList();      // 当前页数据
```