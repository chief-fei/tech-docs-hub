# DML 数据操作语言

DML（Data Manipulation Language）用于操作表中的数据，包括插入、更新和删除。

## 一、INSERT 插入数据

### 1.1 单条插入

```sql
-- 指定列名（推荐）
INSERT INTO tb_user (user_name, age, email, dept_id)
VALUES ('张三', 25, 'zhangsan@example.com', 1);

-- 省略列名（需要按表结构顺序提供所有值）
INSERT INTO tb_user
VALUES (NULL, '李四', 28, 'lisi@example.com', 2, 1, NOW(), NOW(), 0);
```

### 1.2 批量插入

```sql
-- 一次插入多条记录（性能更好）
INSERT INTO tb_user (user_name, age, email, dept_id)
VALUES 
    ('王五', 30, 'wangwu@example.com', 1),
    ('赵六', 22, 'zhaoliu@example.com', 2),
    ('钱七', 35, 'qianqi@example.com', 1);
```

> **性能提示**：批量插入比循环单条插入快 10-100 倍，推荐在数据导入时使用。

### 1.3 插入查询结果

```sql
-- 将查询结果插入到另一张表
INSERT INTO tb_user_backup (user_name, age, email, dept_id)
SELECT user_name, age, email, dept_id
FROM tb_user
WHERE status = 1;
```

### 1.4 INSERT IGNORE

```sql
-- 如果违反唯一约束，忽略错误继续执行
INSERT IGNORE INTO tb_user (user_name, email)
VALUES ('张三', 'duplicate@example.com');
```

### 1.5 ON DUPLICATE KEY UPDATE

```sql
-- 如果主键或唯一键冲突，则更新记录
INSERT INTO tb_user (id, user_name, age, email)
VALUES (1, '张三', 26, 'zhangsan_new@example.com')
ON DUPLICATE KEY UPDATE
    user_name = VALUES(user_name),
    age = VALUES(age),
    email = VALUES(email);
```

> **应用场景**：数据同步、计数器更新等场景非常有用。

## 二、UPDATE 更新数据

### 2.1 基本更新

```sql
-- 更新单列
UPDATE tb_user
SET age = 26
WHERE id = 1;

-- 更新多列
UPDATE tb_user
SET age = 26,
    email = 'newemail@example.com',
    status = 1
WHERE id = 1;
```

### 2.2 条件更新

```sql
-- 根据条件批量更新
UPDATE tb_user
SET status = 0
WHERE dept_id = 2 AND age > 50;

-- 使用表达式
UPDATE tb_user
SET age = age + 1
WHERE create_time < '2024-01-01';
```

### 2.3 多表更新

```sql
-- 根据关联表更新
UPDATE tb_user u
INNER JOIN tb_dept d ON u.dept_id = d.id
SET u.status = 0
WHERE d.dept_name = '技术部';
```

### 2.4 UPDATE 注意事项

⚠️ **重要提醒**：

1. **务必加 WHERE 条件**，否则会更新全表
2. 更新前先用 SELECT 验证条件是否正确
3. 生产环境建议先备份数据
4. 大批量更新建议分批执行

```sql
-- ❌ 危险：更新全表
UPDATE tb_user SET status = 0;

-- ✅ 安全：先查询确认
SELECT COUNT(*) FROM tb_user WHERE dept_id = 2;
-- 确认无误后再更新
UPDATE tb_user SET status = 0 WHERE dept_id = 2;
```

## 三、DELETE 删除数据

### 3.1 基本删除

```sql
-- 删除单条记录
DELETE FROM tb_user
WHERE id = 1;

-- 条件删除
DELETE FROM tb_user
WHERE status = 0 AND create_time < '2023-01-01';
```

### 3.2 多表删除

```sql
-- 删除用户及其订单
DELETE u, o
FROM tb_user u
LEFT JOIN tb_order o ON u.id = o.user_id
WHERE u.id = 1;
```

### 3.3 TRUNCATE 清空表

```sql
-- 清空表数据（比 DELETE 快，但不可回滚）
TRUNCATE TABLE tb_user;
```

**DELETE vs TRUNCATE 对比**：

| 特性 | DELETE | TRUNCATE |
|------|--------|----------|
| 类型 | DML | DDL |
| 速度 | 慢 | 快 |
| 事务 | 可回滚 | 不可回滚 |
| WHERE 条件 | 支持 | 不支持 |
| 自增 ID | 不重置 | 重置为 1 |
| 触发器 | 触发 | 不触发 |
| 日志 | 记录每行 | 不记录 |

### 3.4 逻辑删除（推荐）

实际项目中，通常使用**逻辑删除**而非物理删除：

```sql
-- 表结构中添加 deleted 字段
ALTER TABLE tb_user
ADD COLUMN deleted TINYINT DEFAULT 0 COMMENT '逻辑删除：0-未删除 1-已删除';

-- 逻辑删除：只修改标记
UPDATE tb_user
SET deleted = 1, update_time = NOW()
WHERE id = 1;

-- 查询时过滤已删除数据
SELECT * FROM tb_user
WHERE deleted = 0;
```

> **逻辑删除优点**：
> - 数据可恢复
> - 保留历史数据
> - 避免外键约束问题
> - 符合审计要求

## 四、事务控制

DML 操作可以配合事务使用，确保数据一致性。

### 4.1 事务基本操作

```sql
-- 开启事务
START TRANSACTION;

-- 执行 DML 操作
INSERT INTO tb_user (user_name, age) VALUES ('张三', 25);
UPDATE tb_user SET age = 26 WHERE user_name = '张三';

-- 提交事务
COMMIT;

-- 或者回滚事务
ROLLBACK;
```

### 4.2 事务示例

```sql
-- 转账场景
START TRANSACTION;

-- 扣减转出账户余额
UPDATE tb_account
SET balance = balance - 1000
WHERE user_id = 1 AND balance >= 1000;

-- 检查是否扣款成功
SELECT ROW_COUNT();

-- 如果扣款失败，回滚
-- 如果成功，增加转入账户余额
UPDATE tb_account
SET balance = balance + 1000
WHERE user_id = 2;

COMMIT;
```

### 4.3 自动提交

MySQL 默认开启自动提交，可以关闭：

```sql
-- 查看自动提交状态
SHOW VARIABLES LIKE 'autocommit';

-- 关闭自动提交（当前会话）
SET autocommit = 0;

-- 开启自动提交
SET autocommit = 1;
```

## 五、DML 速查表

| 操作 | 语法 | 说明 |
|------|------|------|
| 单条插入 | `INSERT INTO table (cols) VALUES (vals);` | 插入一条记录 |
| 批量插入 | `INSERT INTO table (cols) VALUES (...), (...);` | 一次插入多条 |
| 插入查询 | `INSERT INTO table1 SELECT ... FROM table2;` | 将查询结果插入 |
| 更新数据 | `UPDATE table SET col=val WHERE condition;` | 更新记录 |
| 删除数据 | `DELETE FROM table WHERE condition;` | 删除记录 |
| 清空表 | `TRUNCATE TABLE table;` | 清空全部数据 |
| 开启事务 | `START TRANSACTION;` | 开启事务 |
| 提交事务 | `COMMIT;` | 提交事务 |
| 回滚事务 | `ROLLBACK;` | 回滚事务 |

## 六、最佳实践

1. **批量操作**：大量数据插入/更新时使用批量操作
2. **WHERE 条件**：UPDATE 和 DELETE 必须加 WHERE 条件
3. **事务控制**：关键业务操作使用事务
4. **逻辑删除**：优先使用逻辑删除而非物理删除
5. **备份数据**：生产环境操作前先备份
6. **分批执行**：大批量操作分批执行，避免锁表
7. **测试验证**：先在测试环境验证 SQL 正确性
