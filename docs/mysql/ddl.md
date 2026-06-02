# DDL 数据定义语言

DDL（Data Definition Language）用于定义和管理数据库结构，包括数据库、表、索引等对象的创建、修改和删除。

## 一、数据库操作

### 1.1 创建数据库

```sql
-- 基本语法
CREATE DATABASE [IF NOT EXISTS] database_name
    [CHARACTER SET charset_name]
    [COLLATE collation_name];

-- 示例：创建 UTF-8 编码的数据库
CREATE DATABASE IF NOT EXISTS demo_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;
```

| 参数 | 说明 |
|------|------|
| `IF NOT EXISTS` | 数据库不存在时创建，避免重复创建报错 |
| `CHARACTER SET` | 字符集，推荐使用 `utf8mb4`（支持 emoji） |
| `COLLATE` | 排序规则，`utf8mb4_general_ci` 不区分大小写 |

### 1.2 查看数据库

```sql
-- 查看所有数据库
SHOW DATABASES;

-- 查看数据库创建语句
SHOW CREATE DATABASE demo_db;

-- 查看当前使用的数据库
SELECT DATABASE();
```

### 1.3 切换数据库

```sql
USE demo_db;
```

### 1.4 删除数据库

```sql
-- 删除数据库（危险操作！）
DROP DATABASE [IF EXISTS] demo_db;
```

> ⚠️ **警告**：`DROP DATABASE` 会删除数据库及其所有数据，生产环境慎用！

## 二、表操作

### 2.1 创建表

```sql
CREATE TABLE [IF NOT EXISTS] table_name (
    column_name data_type [constraints] [COMMENT '注释'],
    ...
    [PRIMARY KEY (column_name)],
    [INDEX index_name (column_name)],
    [UNIQUE INDEX unique_name (column_name)]
) [ENGINE=engine_name] [CHARSET=charset_name] [COMMENT='表注释'];
```

**完整示例：**

```sql
CREATE TABLE IF NOT EXISTS tb_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    user_name VARCHAR(50) NOT NULL COMMENT '用户名',
    age INT COMMENT '年龄',
    email VARCHAR(100) UNIQUE COMMENT '邮箱',
    dept_id BIGINT COMMENT '部门ID',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除：0-未删除 1-已删除',
    INDEX idx_dept_id (dept_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

### 2.2 常用数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **整数** | | |
| `TINYINT` | 微整型（1字节） | 状态标志（0/1） |
| `INT` | 整型（4字节） | 年龄、数量 |
| `BIGINT` | 长整型（8字节） | 主键ID |
| **小数** | | |
| `DECIMAL(M,D)` | 精确小数 | `DECIMAL(10,2)` 金额 |
| `FLOAT` | 单精度浮点 | 不推荐用于金额 |
| `DOUBLE` | 双精度浮点 | 不推荐用于金额 |
| **字符串** | | |
| `CHAR(N)` | 定长字符串 | 手机号、身份证号 |
| `VARCHAR(N)` | 变长字符串 | 用户名、邮箱 |
| `TEXT` | 长文本 | 文章内容 |
| **日期时间** | | |
| `DATE` | 日期 | 生日 |
| `TIME` | 时间 | 营业时长 |
| `DATETIME` | 日期时间 | 创建时间 |
| `TIMESTAMP` | 时间戳 | 自动更新的时间 |

### 2.3 约束类型

| 约束 | 说明 | 示例 |
|------|------|------|
| `PRIMARY KEY` | 主键，唯一标识每行 | `id BIGINT PRIMARY KEY` |
| `AUTO_INCREMENT` | 自增 | `id BIGINT AUTO_INCREMENT` |
| `NOT NULL` | 非空 | `user_name VARCHAR(50) NOT NULL` |
| `DEFAULT` | 默认值 | `status TINYINT DEFAULT 1` |
| `UNIQUE` | 唯一 | `email VARCHAR(100) UNIQUE` |
| `COMMENT` | 注释 | `COMMENT '用户名'` |

### 2.4 查看表

```sql
-- 查看当前数据库所有表
SHOW TABLES;

-- 查看表结构
DESC tb_user;
-- 或
DESCRIBE tb_user;

-- 查看建表语句
SHOW CREATE TABLE tb_user;

-- 查看表的详细信息
SHOW TABLE STATUS LIKE 'tb_user';
```

### 2.5 修改表结构

```sql
-- 修改表名
ALTER TABLE old_table_name RENAME TO new_table_name;

-- 添加列
ALTER TABLE tb_user ADD COLUMN phone VARCHAR(20) COMMENT '手机号' AFTER email;

-- 修改列（类型、约束）
ALTER TABLE tb_user MODIFY COLUMN age TINYINT COMMENT '年龄';

-- 修改列名和类型
ALTER TABLE tb_user CHANGE COLUMN user_name username VARCHAR(50) COMMENT '用户名';

-- 删除列
ALTER TABLE tb_user DROP COLUMN phone;

-- 修改表注释
ALTER TABLE tb_user COMMENT = '用户信息表';
```

### 2.6 删除表

```sql
-- 删除表（危险操作！）
DROP TABLE [IF EXISTS] tb_user;

-- 清空表数据（保留表结构）
TRUNCATE TABLE tb_user;
```

> **`DELETE` vs `TRUNCATE` 区别：**
>
> | 特性 | DELETE | TRUNCATE |
> |------|--------|----------|
> | 类型 | DML | DDL |
> | 速度 | 慢 | 快 |
> | 事务 | 可回滚 | 不可回滚 |
> | 自增ID | 不重置 | 重置为1 |
> | 条件删除 | 支持 WHERE | 不支持 |

## 三、索引操作

索引是提升查询性能的关键，类似于书籍的目录。

### 3.1 索引类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `PRIMARY KEY` | 主键索引 | 唯一标识每行 |
| `UNIQUE` | 唯一索引 | 不允许重复的值 |
| `INDEX` | 普通索引 | 加速查询 |
| `FULLTEXT` | 全文索引 | 文本搜索 |
| `COMPOSITE` | 复合索引 | 多列组合查询 |

### 3.2 创建索引

```sql
-- 方式一：建表时创建
CREATE TABLE tb_user (
    id BIGINT PRIMARY KEY,
    user_name VARCHAR(50),
    email VARCHAR(100),
    UNIQUE INDEX uk_email (email),
    INDEX idx_user_name (user_name)
);

-- 方式二：ALTER TABLE 添加
ALTER TABLE tb_user ADD INDEX idx_age (age);
ALTER TABLE tb_user ADD UNIQUE INDEX uk_email (email);

-- 方式三：CREATE INDEX 添加
CREATE INDEX idx_status ON tb_user (status);
CREATE UNIQUE INDEX uk_user_name ON tb_user (user_name);
```

### 3.3 复合索引

```sql
-- 复合索引：按查询顺序排列列
CREATE INDEX idx_dept_status ON tb_user (dept_id, status);

-- 查询示例（遵循最左前缀原则）
-- ✅ 使用索引
SELECT * FROM tb_user WHERE dept_id = 1;
SELECT * FROM tb_user WHERE dept_id = 1 AND status = 1;

-- ❌ 不使用索引（跳过了 dept_id）
SELECT * FROM tb_user WHERE status = 1;
```

### 3.4 查看索引

```sql
-- 查看表的索引
SHOW INDEX FROM tb_user;
```

### 3.5 删除索引

```sql
-- 方式一
ALTER TABLE tb_user DROP INDEX idx_age;

-- 方式二
DROP INDEX idx_age ON tb_user;
```

### 3.6 索引使用原则

1. **经常查询的列**创建索引
2. **经常作为条件**的列创建索引
3. **唯一性高**的列考虑唯一索引
4. **避免过多索引**，一般不超过5个
5. **复合索引遵循最左前缀原则**
6. **小表不需要索引**

## 四、视图操作

视图是虚拟表，不存储数据，只存储查询逻辑。

### 4.1 创建视图

```sql
CREATE [OR REPLACE] VIEW view_name AS
SELECT column1, column2, ...
FROM table_name
WHERE condition;

-- 示例：创建用户部门视图
CREATE VIEW v_user_dept AS
SELECT u.id, u.user_name, u.age, d.dept_name
FROM tb_user u
LEFT JOIN tb_dept d ON u.dept_id = d.id;
```

### 4.2 使用视图

```sql
-- 像查询普通表一样查询视图
SELECT * FROM v_user_dept WHERE dept_name = '技术部';
```

### 4.3 删除视图

```sql
DROP VIEW [IF EXISTS] v_user_dept;
```

## 五、DDL 速查表

| 操作 | 语法 |
|------|------|
| 创建数据库 | `CREATE DATABASE db_name;` |
| 删除数据库 | `DROP DATABASE db_name;` |
| 创建表 | `CREATE TABLE table_name (...);` |
| 修改表结构 | `ALTER TABLE table_name ...;` |
| 删除表 | `DROP TABLE table_name;` |
| 清空表 | `TRUNCATE TABLE table_name;` |
| 创建索引 | `CREATE INDEX idx_name ON table_name (column);` |
| 删除索引 | `DROP INDEX idx_name ON table_name;` |
| 创建视图 | `CREATE VIEW view_name AS SELECT ...;` |
| 删除视图 | `DROP VIEW view_name;` |
