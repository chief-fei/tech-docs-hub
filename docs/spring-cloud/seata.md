# Seata 分布式事务使用指南

Seata（Simple Extensible Autonomous Transaction Architecture）是阿里巴巴开源的分布式事务解决方案，提供高性能、零侵入的分布式事务能力。

## 一、分布式事务基础

### 什么是分布式事务

在微服务架构下，一个业务操作往往需要跨多个服务和数据库。比如电商下单：

```text
下单流程：
  订单服务（创建订单） → 库存服务（扣减库存） → 账户服务（扣减余额）
        ↓                      ↓                      ↓
   order_db               inventory_db           account_db
```

如果库存扣减失败，订单和余额必须回滚——这就是**分布式事务**要解决的问题。

### CAP 定理

分布式系统无法同时满足以下三点：

| 属性 | 含义 | 说明 |
|------|------|------|
| **C**onsistency（一致性） | 所有节点同一时刻数据一致 | 强一致性 |
| **A**vailability（可用性） | 系统始终能响应请求 | 非故障节点正常服务 |
| **P**artition Tolerance（分区容错） | 网络分区后系统仍能工作 | 分布式系统必须满足 |

::: tip CAP 的取舍
分布式系统中 **P 必须保证**（网络不可靠是客观事实），因此实际只能在 **CP**（强一致）或 **AP**（高可用）之间取舍。

- **CP 系统**：网络分区时牺牲可用性，保证一致性（如 ZooKeeper、Seata AT 模式在写隔离时会短暂牺牲可用性）
- **AP 系统**：网络分区时牺牲一致性，保证可用性（如 Eureka、Nacos 注册中心的默认模式）
:::

### BASE 理论

BASE 是对 CAP 中 AP 的延伸，核心思想是**最终一致性**：

| 字母 | 含义 | 说明 |
|------|------|------|
| **B**asically Available | 基本可用 | 出现故障时允许损失部分可用性 |
| **S**oft State | 软状态 | 允许系统存在中间状态 |
| **E**ventually Consistent | 最终一致性 | 经过一段时间后数据最终一致 |

Seata 的 AT 模式就是 BASE 理论的实际实现——通过两阶段提交保证最终一致性。

### 分布式事务方案对比

| 方案 | 原理 | 一致性 | 性能 | 侵入性 | 典型框架 |
|------|------|:--:|:--:|:--:|------|
| 2PC（两阶段提交） | 协调者统一提交/回滚 | 强 | 低 | 低 | Seata XA |
| TCC | Try-Confirm-Cancel 资源预留 | 强/最终 | 中 | **高** | Seata TCC |
| Saga | 长事务拆分为有序子事务 | 最终 | 高 | 中 | Seata Saga |
| 可靠消息 | 事务消息 + 本地事务表 | 最终 | 高 | 中 | RocketMQ 事务消息 |
| AT 模式 | 自动补偿回滚 | 最终 | 高 | **极低** | Seata AT |

---

## 二、Seata 架构

Seata 的整体架构由三个核心角色组成：

```text
┌─────────────────────────────────────────────────────┐
│              TC（Transaction Coordinator）            │
│              事务协调者 —— Seata Server               │
│        ┌──────────────────────────────────┐         │
│        │  全局事务管理 / 全局锁 / 分支注册  │         │
│        └──────────────────────────────────┘         │
└──────────────┬────────────────────┬─────────────────┘
               │                    │
      ┌────────▼────────┐  ┌───────▼────────┐
      │  TM（Service A）  │  │  RM（Service B） │
      │  事务管理器       │  │  资源管理器      │
      │  ┌────────────┐  │  │  ┌────────────┐ │
      │  │ @Global... │  │  │  │ 分支事务    │ │
      │  │ Transactional│  │  │  │ 注册/提交  │ │
      │  └────────────┘  │  │  │ 回滚/上报   │ │
      └──────────────────┘  │  └────────────┘ │
                            └────────────────┘
```

### 角色说明

| 角色 | 全称 | 位置 | 职责 |
|------|------|------|------|
| **TC** | Transaction Coordinator | Seata Server | 维护全局和分支事务状态，驱动全局提交或回滚 |
| **TM** | Transaction Manager | 发起方应用 | 定义全局事务边界，负责开启、提交、回滚全局事务 |
| **RM** | Resource Manager | 参与方应用 | 管理分支事务的资源，向 TC 注册分支事务、上报状态，执行提交或回滚 |

一个典型的调用链：

```text
Service A（TM + RM）
  │
  │ @GlobalTransactional  ← TM 开启全局事务
  │ 本地数据库操作          ← RM 注册分支事务
  │
  ├── Feign/Dubbo 调用 ──→ Service B（RM）
  │                         本地数据库操作 ← RM 注册分支事务
  │
  ├── Feign/Dubbo 调用 ──→ Service C（RM）
  │                         本地数据库操作 ← RM 注册分支事务
  │
  ▼
TC 协调两阶段提交/回滚
```

---

## 三、四种事务模式

Seata 提供了四种分布式事务模式，适用不同场景。

### 对比总览

| 特性 | AT | TCC | Saga | XA |
|------|:--:|:---:|:----:|:--:|
| 一致性 | 最终一致 | 最终一致 | 最终一致 | 强一致 |
| 隔离性 | 读已提交 | 读已提交 | 读未提交 | 串行化 |
| 业务侵入 | 无 | **高** | 中 | 无 |
| 性能 | 高 | 高 | 高 | 低 |
| 补偿方式 | 自动（undo_log） | 手动实现 Cancel | 手动实现补偿 | 数据库原生回滚 |
| 适用场景 | 通用 CRUD | 资金、核心业务 | 长事务、老系统 | 强一致要求 |
| 数据库支持 | 关系型（MySQL/Oracle） | 任意 | 任意 | 需支持 XA 协议 |

### AT 模式（推荐入门）

**自动补偿模式**，基于关系数据库的本地事务和 undo_log 实现。

**原理：**
- **一阶段**：执行真实 SQL，同时记录 undo_log（反向 SQL），注册分支事务
- **二阶段-提交**：异步删除 undo_log
- **二阶段-回滚**：执行 undo_log 中的反向 SQL 回滚数据

```text
一阶段：
  UPDATE product SET stock = stock - 1 WHERE id = 1;
  INSERT INTO undo_log VALUES (反向SQL: UPDATE product SET stock = stock + 1 WHERE id = 1);

二阶段-提交（由 TC 触发）：
  DELETE FROM undo_log WHERE id = xxx;  ← 异步删除，不阻塞

二阶段-回滚（由 TC 触发）：
  SELECT * FROM undo_log WHERE xid = ?;  ← 拿到反向 SQL
  UPDATE product SET stock = stock + 1 WHERE id = 1;  ← 补偿
```

**优点：** 对业务代码零侵入，只需要一个 `@GlobalTransactional` 注解
**缺点：** 仅支持 ACID 关系型数据库，需要为每个业务表创建 undo_log 表

### TCC 模式

**Try-Confirm-Cancel**，需要开发者手动实现三阶段逻辑。

```java
// 冻结库存（Try）
@TwoPhaseBusinessAction(name = "deductInventory", commitMethod = "commit", rollbackMethod = "rollback")
public boolean tryDeduct(String businessKey, Long productId, Integer count) {
    // INSERT INTO inventory_frozen (frozen_count) VALUES (...)
    // UPDATE product SET available_stock = available_stock - count
    return true;
}

// 确认扣除（Commit）
public boolean commit(DeductInventoryAction action) {
    // DELETE FROM inventory_frozen WHERE id = ?
    return true;
}

// 回滚释放（Cancel）
public boolean rollback(DeductInventoryAction action) {
    // SELECT frozen_count FROM inventory_frozen WHERE id = ?
    // UPDATE product SET available_stock = available_stock + frozen_count
    // DELETE FROM inventory_frozen WHERE id = ?
    return true;
}
```

**优点：** 性能高，不依赖数据库，可以跨异构数据源
**缺点：** 代码侵入性强，开发量大，需要考虑空回滚、悬挂、幂等

### Saga 模式

将长事务拆分为多个有序子事务，每个子事务有对应的补偿操作。

```text
正向：A → B → C
失败时补偿：C_compensate → B_compensate → A_compensate
```

**优点：** 适合长事务、老系统改造（补偿逻辑可逐步实现），不依赖数据库
**缺点：** 隔离性差（读未提交），补偿逻辑需要开发者实现

### XA 模式

基于数据库 XA 协议的两阶段提交，依赖数据库原生支持。

**优点：** 强一致性，无业务侵入
**缺点：** 需要数据库支持 XA 协议（MySQL 需 InnoDB），性能较低（资源锁定时间久）

::: tip 模式选择建议
- **快速上手 / 通用场景** → AT 模式
- **金融 / 核心资金操作** → TCC 模式
- **长流程（如审批流）/ 老系统改造** → Saga 模式
- **强一致性要求 / 使用支持 XA 的数据库** → XA 模式
:::

---

## 四、AT 模式深度解析

### 两阶段提交流程

```text
阶段 1：执行 + 注册
━━━━━━━━━━━━━━━━━━━━━━━━
TM 开启全局事务（生成 XID）

Service A（RM）:
  1. 执行业务 SQL（如 INSERT INTO order VALUES(...)
  2. 生成 before-image（执行前数据快照）
  3. 执行 after-image（执行后数据快照）
  4. 写入 undo_log 表
  5. 向 TC 注册分支事务

Service B（RM）:
  1. 执行业务 SQL（如 UPDATE stock SET count = count - 1）
  2. 生成 before-image / after-image
  3. 写入 undo_log 表
  4. 向 TC 注册分支事务

阶段 2：提交或回滚
━━━━━━━━━━━━━━━━━━━━━━━━
TM 通知 TC 全局提交 → TC 通知各 RM 异步删除 undo_log
TM 通知 TC 全局回滚 → TC 通知各 RM 执行 undo_log 中的反向 SQL
```

### undo_log 表结构

```sql
-- 每个业务数据库都需要创建此表
CREATE TABLE `undo_log` (
  `id`            BIGINT(20) NOT NULL AUTO_INCREMENT,
  `branch_id`     BIGINT(20) NOT NULL COMMENT '分支事务 ID',
  `xid`           VARCHAR(100) NOT NULL COMMENT '全局事务 XID',
  `context`       VARCHAR(128) NOT NULL,
  `rollback_info` LONGBLOB NOT NULL COMMENT '回滚信息（before-image 快照）',
  `log_status`    INT(11) NOT NULL COMMENT '日志状态',
  `log_created`   DATETIME NOT NULL,
  `log_modified`  DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_undo_log` (`xid`, `branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 全局锁机制

AT 模式下，Seata 使用**全局锁**防止脏写：

```text
事务 A（XID = aaa）:
  1. 获取全局锁 → UPDATE product SET stock = 5 WHERE id = 1
  2. 释放本地锁，持有全局锁

事务 B（XID = bbb）:
  3. SELECT stock FROM product WHERE id = 1 FOR UPDATE
  4. 拿不到全局锁 → 等待并重试（默认最多 30 次）

事务 A 提交后 → 释放全局锁 → 事务 B 重试成功
```

::: warning 全局锁注意事项
- 全局锁在事务一阶段修改数据时获取，二阶段提交后释放
- 如果全局事务执行时间过长，可能导致其他事务等待超时
- 可通过 `client.rm.lock.retryTimes` 和 `client.rm.lock.retryInterval` 调整重试策略
:::

### 写隔离

AT 模式的写隔离通过**全局锁 + SELECT FOR UPDATE** 实现：

```java
// Seata 代理会自动在 UPDATE/DELETE 前隐式添加全局锁检查
@GlobalTransactional
public void createOrder(Order order) {
    orderMapper.insert(order);  // 代理层自动管理全局锁
    stockService.deduct(order.getProductId(), 1);  // 远程调用携带 XID
}
```

::: danger AT 模式的隔离级别
AT 模式默认是**读已提交**隔离级别。如果要实现**读已提交以上**的隔离，业务 SQL 中需要使用 `SELECT ... FOR UPDATE` 显式加锁。
:::

---

## 五、Seata Server 部署

### 版本对应

| Spring Cloud Alibaba | Seata | Spring Boot | Spring Cloud |
|---------------------|-------|-------------|--------------|
| 2021.0.6.0 | **1.6.1** | 2.7.x | 2021.0.x |

### 下载与解压

```bash
# 下载 Seata Server
wget https://github.com/seata/seata/releases/download/v1.6.1/seata-server-1.6.1.tar.gz

# 解压
tar -zxvf seata-server-1.6.1.tar.gz
cd seata-server-1.6.1
```

### 数据库初始化

在 Seata Server 连接的数据库中创建 seata 库和相关表：

```sql
-- 创建 seata 库
CREATE DATABASE IF NOT EXISTS `seata` DEFAULT CHARACTER SET utf8mb4;

USE seata;

-- 全局事务表
CREATE TABLE IF NOT EXISTS `global_table` (
  `xid`                       VARCHAR(128) NOT NULL,
  `transaction_id`            BIGINT,
  `status`                    TINYINT NOT NULL,
  `application_id`            VARCHAR(32),
  `transaction_service_group` VARCHAR(32),
  `transaction_name`          VARCHAR(128),
  `timeout`                   INT,
  `begin_time`                BIGINT,
  `application_data`          VARCHAR(2000),
  `gmt_create`                DATETIME,
  `gmt_modified`              DATETIME,
  PRIMARY KEY (`xid`),
  KEY `idx_status_gmt_modified` (`status`, `gmt_modified`),
  KEY `idx_transaction_id` (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分支事务表
CREATE TABLE IF NOT EXISTS `branch_table` (
  `branch_id`         BIGINT NOT NULL,
  `xid`               VARCHAR(128) NOT NULL,
  `transaction_id`    BIGINT,
  `resource_group_id` VARCHAR(32),
  `resource_id`       VARCHAR(256),
  `branch_type`       VARCHAR(8),
  `status`            TINYINT,
  `client_id`         VARCHAR(64),
  `application_data`  VARCHAR(2000),
  `gmt_create`        DATETIME(6),
  `gmt_modified`      DATETIME(6),
  PRIMARY KEY (`branch_id`),
  KEY `idx_xid` (`xid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 全局锁表
CREATE TABLE IF NOT EXISTS `lock_table` (
  `row_key`        VARCHAR(128) NOT NULL,
  `xid`            VARCHAR(128),
  `transaction_id` BIGINT,
  `branch_id`      BIGINT NOT NULL,
  `resource_id`    VARCHAR(256),
  `table_name`     VARCHAR(32),
  `pk`             VARCHAR(36),
  `status`         TINYINT NOT NULL DEFAULT '0' COMMENT '0:locked,1:rollbacking',
  `gmt_create`     DATETIME,
  `gmt_modified`   DATETIME,
  PRIMARY KEY (`row_key`),
  KEY `idx_status` (`status`),
  KEY `idx_branch_id` (`branch_id`),
  KEY `idx_xid` (`xid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分布式锁表（Seata Server 集群使用）
CREATE TABLE IF NOT EXISTS `distributed_lock` (
  `lock_key`       VARCHAR(20) NOT NULL,
  `lock_value`     VARCHAR(20) NOT NULL,
  `expire`         BIGINT,
  PRIMARY KEY (`lock_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Docker 方式部署（推荐）

```bash
docker run -d \
  --name seata-server \
  -p 8091:8091 \
  -p 7091:7091 \
  -e SEATA_IP=192.168.1.100 \
  -e SEATA_PORT=8091 \
  seataio/seata-server:1.6.1
```

端口说明：
- `8091`：Seata 服务端口（客户端连接使用）
- `7091`：Seata 控制台端口

### Docker Compose 部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  seata-server:
    image: seataio/seata-server:1.6.1
    container_name: seata-server
    ports:
      - "8091:8091"
      - "7091:7091"
    environment:
      - SEATA_PORT=8091
      - STORE_MODE=db
      - SEATA_IP=192.168.1.100
      # 数据库配置
      - SEATA_STORE_DB_DATASOURCE=druid
      - SEATA_STORE_DB_DB_TYPE=mysql
      - SEATA_STORE_DB_DRIVER_CLASS_NAME=com.mysql.cj.jdbc.Driver
      - SEATA_STORE_DB_URL=jdbc:mysql://192.168.1.100:3306/seata?useUnicode=true&rewriteBatchedStatements=true
      - SEATA_STORE_DB_USER=root
      - SEATA_STORE_DB_PASSWORD=your-password
    restart: unless-stopped
```

### 配置文件说明

#### application.yml（Seata Server）

```yaml
# seata-server/conf/application.yml
server:
  port: 7091

spring:
  application:
    name: seata-server

logging:
  level:
    io.seata: info

seata:
  config:
    type: nacos                     # 从 Nacos 获取配置
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
      username: nacos
      password: nacos
      data-id: seataServer.properties
  registry:
    type: nacos                     # 注册到 Nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
      username: nacos
      password: nacos
  store:
    mode: db                        # 使用数据库存储事务日志
    db:
      datasource: druid
      db-type: mysql
      driver-class-name: com.mysql.cj.jdbc.Driver
      url: jdbc:mysql://127.0.0.1:3306/seata?useUnicode=true&rewriteBatchedStatements=true
      user: root
      password: your-password
      min-conn: 10
      max-conn: 100
  security:
    secretKey: SeataSecretKey       # 认证密钥
  server:
    service-port: 8091              # RPC 端口
```

---

## 六、Nacos 作为注册中心与配置中心

### 在 Nacos 控制台创建 Seata 配置

进入 Nacos 控制台 `http://localhost:8848/nacos` → 配置管理 → 配置列表，创建配置：

| 配置项 | 值 |
|------|------|
| Data ID | `seataServer.properties` |
| Group | `SEATA_GROUP` |
| 配置格式 | PROPERTIES |

配置内容：

```properties
# seataServer.properties（保存在 Nacos）
# 事务存储模式：db / file / redis
store.mode=db
store.lock.mode=db
store.session.mode=db

# 数据库配置
store.db.datasource=druid
store.db.dbType=mysql
store.db.driverClassName=com.mysql.cj.jdbc.Driver
store.db.url=jdbc:mysql://127.0.0.1:3306/seata?useUnicode=true&rewriteBatchedStatements=true
store.db.user=root
store.db.password=your-password
store.db.minConn=10
store.db.maxConn=100

# 事务分组映射（客户端用）
service.vgroupMapping.default_tx_group=default

# 配置从 Nacos 拉取
service.enableDegrade=false
service.disableGlobalTransaction=false

# 客户端与 Server 通信配置
transport.type=TCP
transport.server=NIO
transport.heartbeat=true
transport.enableTcServerBatchSendResponse=false
transport.threadFactory.bossThreadPrefix=NettyBoss
transport.threadFactory.workerThreadPrefix=NettyServerNIOWorker
transport.threadFactory.serverExecutorThreadPrefix=NettyServerBizHandler
transport.threadFactory.shareBossWorker=false
transport.threadFactory.clientSelectorThreadPrefix=NettyClientSelector
transport.threadFactory.clientSelectorThreadSize=1
transport.threadFactory.clientWorkerThreadPrefix=NettyClientWorkerThread
transport.threadFactory.bossThreadSize=1
transport.threadFactory.workerThreadSize=default
transport.shutdown.wait=3

# 日志存储
store.db.log.queryLimit=100

# 服务端 RPC 端口
server.port=8091

# Seata 控制台
seata.server.ui.enabled=true
```

### 验证 Seata Server 注册到 Nacos

启动 Seata Server 后，在 Nacos 控制台的**服务管理 → 服务列表**中应该能看到 `seata-server` 服务。

```bash
# 查看 Seata Server 启动日志
docker logs seata-server

# 期望看到
# register to nacos success
# nacos registry, seata-server is ready
```

---

## 七、Spring Boot 集成

### Maven 依赖

```xml
<!-- 父 POM 依赖管理（如果还没有引入 spring-cloud-alibaba-dependencies） -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>2021.0.6.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 业务模块依赖 -->
<dependencies>
    <!-- Seata 分布式事务 -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
    </dependency>

    <!-- 数据源（Seata 需要代理数据源） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-jdbc</artifactId>
    </dependency>

    <!-- Nacos 注册中心（服务发现，传递 XID） -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>

    <!-- Nacos 配置中心（可选，拉取 Seata 客户端配置） -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
    </dependency>

    <!-- Feign 远程调用（传递 XID） -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-openfeign</artifactId>
    </dependency>

    <!-- Bootstrap -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-bootstrap</artifactId>
    </dependency>
</dependencies>
```

::: warning 依赖版本注意事项
`spring-cloud-starter-alibaba-seata` 引入的 Seata 版本由 `spring-cloud-alibaba-dependencies` 统一管理。在 Spring Cloud Alibaba 2021.0.6.0 中，对应的 Seata 版本是 **1.6.1**，**不需要**单独声明 Seata 版本号。
:::

### application.yml 配置

```yaml
# application.yml
spring:
  application:
    name: order-service
  datasource:
    url: jdbc:mysql://localhost:3306/order_db?useSSL=false&characterEncoding=utf8
    username: root
    password: your-password
    driver-class-name: com.mysql.cj.jdbc.Driver
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
        namespace: public
        group: DEFAULT_GROUP

# Seata 配置
seata:
  enabled: true
  application-id: ${spring.application.name}
  # 事务分组 → 映射到 TC 集群名（必须与 Nacos 中 seataServer.properties 的 service.vgroupMapping 对应）
  tx-service-group: default_tx_group
  # 客户端与服务端通信
  service:
    vgroup-mapping:
      default_tx_group: default       # 事务分组 → 集群映射
  # 注册中心
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
      username: nacos
      password: nacos
  # 配置中心
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
      username: nacos
      password: nacos
      data-id: seataServer.properties
```

::: tip 事务分组说明
`tx-service-group`（事务分组）是一个逻辑概念，客户端通过它映射到实际的 TC 集群。映射关系在 Nacos 的 `seataServer.properties` 中配置：

```properties
# Nacos 中的 seataServer.properties
service.vgroupMapping.default_tx_group=default
```

这样客户端的事务分组 `default_tx_group` 就会映射到名为 `default` 的 TC 集群。
:::

### @GlobalTransactional 注解

```java
@Service
public class OrderService {

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private StockFeignClient stockFeignClient;

    @Autowired
    private AccountFeignClient accountFeignClient;

    /**
     * @GlobalTransactional 开启全局事务
     * - timeoutMills: 全局事务超时时间（默认 60 秒）
     * - name: 事务名称（用于监控和排查）
     * - rollbackFor: 触发回滚的异常类型（默认 RuntimeException）
     * - noRollbackFor: 不触发回滚的异常类型
     */
    @GlobalTransactional(timeoutMills = 300000, name = "create-order")
    public void createOrder(OrderCreateCmd cmd) {
        // 1. 创建订单（本地）
        Order order = new Order();
        order.setUserId(cmd.getUserId());
        order.setProductId(cmd.getProductId());
        order.setCount(cmd.getCount());
        order.setAmount(cmd.getAmount());
        order.setStatus("CREATED");
        orderMapper.insert(order);

        // 2. 扣减库存（远程调用 → Stock Service，自动传递 XID）
        stockFeignClient.deduct(cmd.getProductId(), cmd.getCount());

        // 3. 扣减余额（远程调用 → Account Service，自动传递 XID）
        accountFeignClient.debit(cmd.getUserId(), cmd.getAmount());

        // 4. 更新订单状态
        order.setStatus("COMPLETED");
        orderMapper.updateById(order);
    }
}
```

::: tip @GlobalTransactional 参数说明
| 参数 | 类型 | 默认值 | 说明 |
|------|------|:--:|------|
| `timeoutMills` | int | 60000 | 全局事务超时时间（毫秒），超时后自动回滚 |
| `name` | String | "" | 事务名称 |
| `rollbackFor` | Class[] | RuntimeException | 触发回滚的异常类型 |
| `noRollbackFor` | Class[] | {} | 不触发回滚的异常类型 |
| `propagation` | Propagation | REQUIRED | 事务传播行为 |
:::

---

## 八、数据源代理配置

Seata AT 模式需要**代理数据源**来拦截 SQL 并生成 undo_log。Spring Cloud Alibaba 会自动配置，但需要排除默认数据源的自动配置。

### 自动配置方式（推荐）

```java
@Configuration
public class SeataDataSourceConfig {

    /**
     * Seata 通过 DataSourceProxy 代理数据源，
     * 拦截 SQL 执行，自动生成 before-image / after-image 并写入 undo_log。
     *
     * Spring Cloud Alibaba 2021.0.6.0 + spring-cloud-starter-alibaba-seata
     * 已经自动配置了 DataSourceProxy，通常不需要手动写。
     *
     * 如果要手动配置，参考以下代码：
     */

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties dataSourceProperties) {
        HikariDataSource hikariDataSource = new HikariDataSource();
        hikariDataSource.setJdbcUrl(dataSourceProperties.getUrl());
        hikariDataSource.setUsername(dataSourceProperties.getUsername());
        hikariDataSource.setPassword(dataSourceProperties.getPassword());
        hikariDataSource.setDriverClassName(dataSourceProperties.getDriverClassName());
        return new DataSourceProxy(hikariDataSource);
    }
}
```

### 排除 Druid 自动配置（如果使用 Druid 数据源）

```java
// 如果使用 Druid 数据源，需要排除自动配置
@SpringBootApplication(exclude = {
    com.alibaba.druid.spring.boot.autoconfigure.DruidDataSourceAutoConfigure.class
})
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

::: danger 数据源代理是 AT 模式的核心
如果没有正确配置数据源代理，Seata 无法拦截 SQL，undo_log 不会被写入，**回滚时将找不到补偿数据**，导致分布式事务失败。
:::

### 验证数据源代理是否生效

启动应用后，查看日志中是否有以下信息：

```text
# 看到这行说明 Seata 数据源代理已生效
io.seata.rm.datasource.DataSourceProxy   : 代理数据源成功
```

或者在业务方法中打断点，检查数据源类型：

```java
@Autowired
private DataSource dataSource;

// dataSource instanceof io.seata.rm.datasource.DataSourceProxy → true
```

### Feign 拦截器配置（自动传递 XID）

Spring Cloud Alibaba 的 `spring-cloud-starter-alibaba-seata` 已经自动配置了 Feign 拦截器，会将 XID 通过 HTTP Header `TX_XID` 传递到下游服务。**通常不需要手动配置。**

如果需要手动配置（如自定义 Header）：

```java
@Configuration
public class SeataFeignConfig {

    @Bean
    public RequestInterceptor seataRequestInterceptor() {
        return requestTemplate -> {
            String xid = RootContext.getXID();
            if (StringUtils.hasText(xid)) {
                requestTemplate.header(RootContext.KEY_XID, xid);
            }
        };
    }
}
```

---

## 九、TCC 模式使用

### @TwoPhaseBusinessAction 注解

TCC 模式需要开发者手动实现 Try、Confirm、Cancel 三个阶段。

```java
// TCC 资源接口定义
public interface TccAction {

    /**
     * Try：预留资源
     * @param businessActionContext 事务上下文
     * @param orderId 订单 ID
     * @param count 数量
     */
    boolean prepareDeduct(BusinessActionContext businessActionContext,
                          @BusinessActionContextParameter("orderId") Long orderId,
                          @BusinessActionContextParameter("count") Integer count);

    /**
     * Commit：确认操作
     */
    boolean commit(BusinessActionContext businessActionContext);

    /**
     * Rollback：回滚释放资源
     */
    boolean rollback(BusinessActionContext businessActionContext);
}
```

### 完整 TCC 实现示例

```java
@Service
@Slf4j
public class StockTccActionImpl implements TccAction {

    @Autowired
    private StockMapper stockMapper;

    @Autowired
    private StockFrozenMapper stockFrozenMapper;

    /**
     * Try 阶段：冻结库存
     *
     * 幂等性检查：如果 frozen_id 已存在，直接返回 true（防悬挂）
     */
    @Override
    @Transactional
    public boolean prepareDeduct(BusinessActionContext actionContext,
                                  Long orderId, Integer count) {
        String xid = actionContext.getXid();
        Long branchId = actionContext.getBranchId();

        // 防悬挂：如果已经存在冻结记录（可能是 Cancel 先执行了），不再操作
        StockFrozen existing = stockFrozenMapper.selectByXidAndBranchId(xid, branchId);
        if (existing != null) {
            log.info("已存在冻结记录，xid={}, branchId={}", xid, branchId);
            return true;
        }

        // 扣减可用库存
        Stock stock = stockMapper.selectById(1L);
        if (stock.getAvailableStock() < count) {
            throw new RuntimeException("库存不足");
        }
        stock.setAvailableStock(stock.getAvailableStock() - count);
        stockMapper.updateById(stock);

        // 记录冻结库存
        StockFrozen frozen = new StockFrozen();
        frozen.setXid(xid);
        frozen.setBranchId(branchId);
        frozen.setOrderId(orderId);
        frozen.setFrozenCount(count);
        stockFrozenMapper.insert(frozen);

        log.info("Try 成功：冻结 {} 件库存, orderId={}", count, orderId);
        return true;
    }

    /**
     * Commit 阶段：删除冻结记录
     *
     * 允许空回滚：如果冻结记录不存在（Try 未执行或已超时回滚），直接返回 true
     */
    @Override
    @Transactional
    public boolean commit(BusinessActionContext actionContext) {
        String xid = actionContext.getXid();
        Long branchId = actionContext.getBranchId();

        StockFrozen frozen = stockFrozenMapper.selectByXidAndBranchId(xid, branchId);
        if (frozen == null) {
            log.info("冻结记录不存在，跳过 Commit, xid={}", xid);
            return true;
        }

        stockFrozenMapper.deleteById(frozen.getId());
        log.info("Commit 成功：删除冻结记录, xid={}", xid);
        return true;
    }

    /**
     * Rollback 阶段：回滚——释放冻结库存
     *
     * 允许空回滚：如果冻结记录不存在，直接返回 true（可能是 Try 超时后的补偿）
     */
    @Override
    @Transactional
    public boolean rollback(BusinessActionContext actionContext) {
        String xid = actionContext.getXid();
        Long branchId = actionContext.getBranchId();

        StockFrozen frozen = stockFrozenMapper.selectByXidAndBranchId(xid, branchId);
        if (frozen == null) {
            log.info("冻结记录不存在，跳过 Rollback, xid={}", xid);
            return true;
        }

        // 恢复可用库存
        Stock stock = stockMapper.selectById(1L);
        stock.setAvailableStock(stock.getAvailableStock() + frozen.getFrozenCount());
        stockMapper.updateById(stock);

        // 删除冻结记录
        stockFrozenMapper.deleteById(frozen.getId());

        log.info("Rollback 成功：恢复 {} 件库存, xid={}", frozen.getFrozenCount(), xid);
        return true;
    }
}
```

### TCC 事务接口定义

```java
@LocalTCC  // 标记为本地 TCC 接口
public interface StockTccAction {

    @TwoPhaseBusinessAction(
        name = "stock-deduct",              // 资源名称，需全局唯一
        commitMethod = "commit",            // Commit 方法名
        rollbackMethod = "rollback",        // Rollback 方法名
        useTCCFence = true                  // 开启 TCC 防悬挂（Seata 1.5.0+）
    )
    boolean prepareDeduct(
        BusinessActionContext businessActionContext,
        @BusinessActionContextParameter("orderId") Long orderId,
        @BusinessActionContextParameter("count") Integer count
    );

    boolean commit(BusinessActionContext businessActionContext);

    boolean rollback(BusinessActionContext businessActionContext);
}
```

### TCC 调用方

```java
@Service
public class OrderService {

    @Autowired
    private StockTccAction stockTccAction;

    @Autowired
    private OrderMapper orderMapper;

    @GlobalTransactional
    public void createOrder(OrderCreateCmd cmd) {
        // 1. 创建订单（AT 模式，自动）
        Order order = new Order();
        order.setStatus("CREATED");
        orderMapper.insert(order);

        // 2. TCC 模式扣减库存
        stockTccAction.prepareDeduct(null, order.getId(), cmd.getCount());

        // 如果抛出异常，Seata 自动调用 rollback 方法
    }
}
```

::: warning TCC 开发注意事项
1. **空回滚**：Cancel 可能比 Try 先到达（Try 超时），Cancel 必须允许空回滚（冻结记录不存在时直接返回 true）
2. **防悬挂**：Try 可能在 Cancel 之后到达，Try 需要检查冻结记录是否已存在
3. **幂等性**：Try / Confirm / Cancel 都可能被重复调用，每种操作都必须幂等
4. **建议开启 `useTCCFence = true`**（Seata 1.5.0+），框架会自动处理防悬挂和幂等问题，但需要在数据库中建 `tcc_fence_log` 表
:::

### TCC Fence 表

开启 `useTCCFence = true` 后，需要在数据库中创建：

```sql
CREATE TABLE `tcc_fence_log` (
  `xid`           VARCHAR(128) NOT NULL,
  `branch_id`     BIGINT NOT NULL,
  `action_name`   VARCHAR(64) NOT NULL,
  `status`        TINYINT NOT NULL,
  `gmt_create`    DATETIME(3) NOT NULL,
  `gmt_modified`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`xid`, `branch_id`),
  KEY `idx_gmt_modified` (`gmt_modified`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 十、完整示例：订单 + 库存 + 账户

以一个经典的电商下单场景为例，演示 Seata AT 模式的完整集成。

### 架构

```text
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  order-service│────▶│ stock-service │     │account-service│
│  （TM + RM）  │     │    （RM）      │     │    （RM）      │
│  order_db     │     │  stock_db     │     │  account_db   │
└───────────────┘     └───────────────┘     └───────────────┘
        │                      │                      │
        │         Seata TC（事务协调器）                 │
        └──────────────────────┴──────────────────────┘
```

### 数据库准备

每个服务的数据库都需要创建 `undo_log` 表：

```sql
-- 在 order_db、stock_db、account_db 中分别执行
CREATE TABLE `undo_log` (
  `id`            BIGINT(20) NOT NULL AUTO_INCREMENT,
  `branch_id`     BIGINT(20) NOT NULL,
  `xid`           VARCHAR(100) NOT NULL,
  `context`       VARCHAR(128) NOT NULL,
  `rollback_info` LONGBLOB NOT NULL,
  `log_status`    INT(11) NOT NULL,
  `log_created`   DATETIME NOT NULL,
  `log_modified`  DATETIME NOT NULL,
  `ext`           VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_undo_log` (`xid`, `branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

业务表：

```sql
-- order_db
CREATE TABLE `t_order` (
  `id`          BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     BIGINT NOT NULL,
  `product_id`  BIGINT NOT NULL,
  `amount`      DECIMAL(10,2) NOT NULL,
  `count`       INT NOT NULL,
  `status`      VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- stock_db
CREATE TABLE `t_stock` (
  `id`     BIGINT AUTO_INCREMENT PRIMARY KEY,
  `product_id` BIGINT NOT NULL,
  `stock`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;
INSERT INTO t_stock (product_id, stock) VALUES (1, 100);

-- account_db
CREATE TABLE `t_account` (
  `id`      BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `balance` DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;
INSERT INTO t_account (user_id, balance) VALUES (1, 1000.00);
```

### order-service（发起方，TM + RM）

**pom.xml：**

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-jdbc</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-openfeign</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-loadbalancer</artifactId>
    </dependency>
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
    </dependency>
</dependencies>
```

**application.yml：**

```yaml
server:
  port: 8081

spring:
  application:
    name: order-service
  datasource:
    url: jdbc:mysql://localhost:3306/order_db?useSSL=false&characterEncoding=utf8
    username: root
    password: your-password
    driver-class-name: com.mysql.cj.jdbc.Driver
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
        namespace: public

seata:
  tx-service-group: default_tx_group
  service:
    vgroup-mapping:
      default_tx_group: default
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
      data-id: seataServer.properties
```

**OrderService.java：**

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final JdbcTemplate jdbcTemplate;
    private final StockFeignClient stockFeignClient;
    private final AccountFeignClient accountFeignClient;

    /**
     * 创建订单 —— 全局事务入口
     *
     * 当任何一步抛出异常时，Seata 自动回滚所有操作
     */
    @GlobalTransactional(timeoutMills = 300000, name = "create-order")
    public void createOrder(OrderCreateCmd cmd) {
        log.info("开始创建订单，XID={}", RootContext.getXID());

        // 1. 创建订单
        jdbcTemplate.update(
            "INSERT INTO t_order (user_id, product_id, amount, count, status) VALUES (?, ?, ?, ?, ?)",
            cmd.getUserId(), cmd.getProductId(), cmd.getAmount(), cmd.getCount(), "CREATED"
        );

        // 2. 扣减库存（Feign 远程调用，自动传递 XID）
        stockFeignClient.deduct(cmd.getProductId(), cmd.getCount());

        // 3. 扣减余额
        accountFeignClient.debit(cmd.getUserId(), cmd.getAmount());

        log.info("订单创建成功，XID={}", RootContext.getXID());
    }
}
```

**StockFeignClient.java：**

```java
@FeignClient(name = "stock-service")
public interface StockFeignClient {

    @PostMapping("/stock/deduct")
    Result<Void> deduct(@RequestParam("productId") Long productId,
                        @RequestParam("count") Integer count);
}
```

**AccountFeignClient.java：**

```java
@FeignClient(name = "account-service")
public interface AccountFeignClient {

    @PostMapping("/account/debit")
    Result<Void> debit(@RequestParam("userId") Long userId,
                       @RequestParam("amount") BigDecimal amount);
}
```

**启动类：**

```java
@EnableFeignClients
@SpringBootApplication
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

### stock-service（参与方，RM）

**application.yml：**

```yaml
server:
  port: 8082

spring:
  application:
    name: stock-service
  datasource:
    url: jdbc:mysql://localhost:3306/stock_db?useSSL=false&characterEncoding=utf8
    username: root
    password: your-password
    driver-class-name: com.mysql.cj.jdbc.Driver
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
        namespace: public

seata:
  tx-service-group: default_tx_group
  service:
    vgroup-mapping:
      default_tx_group: default
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: public
      group: SEATA_GROUP
      data-id: seataServer.properties
```

**StockController.java：**

```java
@RestController
@RequiredArgsConstructor
@Slf4j
public class StockController {

    private final JdbcTemplate jdbcTemplate;

    @PostMapping("/stock/deduct")
    public Result<Void> deduct(@RequestParam Long productId,
                                @RequestParam Integer count) {
        log.info("扣减库存，XID={}, productId={}, count={}",
                  RootContext.getXID(), productId, count);

        // 检查库存
        Integer stock = jdbcTemplate.queryForObject(
            "SELECT stock FROM t_stock WHERE product_id = ?", Integer.class, productId
        );
        if (stock == null || stock < count) {
            throw new RuntimeException("库存不足");
        }

        // 扣减库存
        int rows = jdbcTemplate.update(
            "UPDATE t_stock SET stock = stock - ? WHERE product_id = ? AND stock >= ?",
            count, productId, count
        );
        if (rows == 0) {
            throw new RuntimeException("库存扣减失败");
        }

        log.info("库存扣减成功，XID={}", RootContext.getXID());
        return Result.success();
    }
}
```

### account-service（参与方，RM）

**AccountController.java：**

```java
@RestController
@RequiredArgsConstructor
@Slf4j
public class AccountController {

    private final JdbcTemplate jdbcTemplate;

    @PostMapping("/account/debit")
    public Result<Void> debit(@RequestParam Long userId,
                               @RequestParam BigDecimal amount) {
        log.info("扣减余额，XID={}, userId={}, amount={}",
                  RootContext.getXID(), userId, amount);

        // 检查余额
        BigDecimal balance = jdbcTemplate.queryForObject(
            "SELECT balance FROM t_account WHERE user_id = ?", BigDecimal.class, userId
        );
        if (balance == null || balance.compareTo(amount) < 0) {
            throw new RuntimeException("余额不足");
        }

        // 扣减余额
        int rows = jdbcTemplate.update(
            "UPDATE t_account SET balance = balance - ? WHERE user_id = ? AND balance >= ?",
            amount, userId, amount
        );
        if (rows == 0) {
            throw new RuntimeException("余额扣减失败");
        }

        log.info("余额扣减成功，XID={}", RootContext.getXID());
        return Result.success();
    }
}
```

### 验证分布式事务

**正常流程验证：**

```bash
# 下单（库存和余额充足）
curl -X POST http://localhost:8081/order/create \
  -H "Content-Type: application/json" \
  -d '{"userId":1, "productId":1, "count":1, "amount":100.00}'

# 期望：订单创建，库存-1，余额-100
```

**回滚流程验证：**

制造库存不足场景：

```bash
# 库存只有 100，尝试下单 200 件
curl -X POST http://localhost:8081/order/create \
  -H "Content-Type: application/json" \
  -d '{"userId":1, "productId":1, "count":200, "amount":100.00}'

# 期望结果：
# 1. order-service 创建订单（本地事务提交）
# 2. stock-service 扣库存失败，抛出异常
# 3. Seata TC 触发全局回滚
# 4. order_db 中的订单记录被删除（undo_log 补偿）
# 5. 数据恢复到下单前的状态
```

查看 Seata 控制台验证事务状态：`http://localhost:7091`

---

## 十一、常见问题与排查

### 1. undo_log 表不存在

**错误信息：**

```text
Table 'order_db.undo_log' doesn't exist
```

**解决：** 在每个业务数据库中执行 undo_log 建表 SQL。

### 2. Seata Server 未注册到 Nacos

**错误信息：**

```text
No available service found in cluster 'default'
```

**排查：**

```bash
# 检查 Nacos 服务列表是否有 seata-server
curl "http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10&groupName=SEATA_GROUP&namespaceId=public"

# 查看 Seata Server 日志
docker logs seata-server | grep -i "register"
```

**解决：**
- 确保 Seata Server `registry.type=nacos` 配置正确
- 确保 Nacos 地址、命名空间、分组与客户端配置一致

### 3. 数据源代理未生效

**现象：** 事务回滚后数据没有恢复，undo_log 表中没有记录。

**排查：**

```java
@Autowired
private DataSource dataSource;

// 启动后检查
@PostConstruct
public void check() {
    log.info("DataSource type: {}", dataSource.getClass().getName());
    // 期望：io.seata.rm.datasource.DataSourceProxy
}
```

### 4. XID 没有传递到下游服务

**现象：** 下游服务的 RootContext.getXID() 为 null。

**原因：**
- Feign 拦截器未配置
- Dubbo Filter 未配置

**解决：** 确保使用了 `spring-cloud-starter-alibaba-seata`，它会自动配置 Feign 拦截器和 Dubbo Filter。如果手动管理，添加配置：

```java
// Feign 拦截器（通常不需要手动写，starter 已自动配置）
@Configuration
public class FeignConfig {
    @Bean
    public RequestInterceptor requestInterceptor() {
        return template -> {
            String xid = RootContext.getXID();
            if (StringUtils.hasText(xid)) {
                template.header(RootContext.KEY_XID, xid);
            }
        };
    }
}
```

### 5. 全局锁冲突

**错误信息：**

```text
LockConflictException: get global lock fail
```

**原因：** 多个全局事务同时修改同一行数据。

**解决：**

```yaml
# application.yml 中添加配置
seata:
  client:
    rm:
      lock:
        retryInterval: 10    # 重试间隔 ms（默认 10）
        retryTimes: 30        # 重试次数（默认 30）
        retryPolicyBranchRollback: true  # 重试失败后回滚分支
```

### 6. 全局事务超时

**错误信息：**

```text
Global transaction timeout
```

**排查：**

```java
// 增加超时时间
@GlobalTransactional(timeoutMills = 600000) // 10 分钟
```

或在 Seata Server 配置中修改：

```properties
# Nacos seataServer.properties
service.default.grouplist=127.0.0.1:8091
service.disableGlobalTransaction=false
server.maxCommitRetryTimeout=600000
server.maxRollbackRetryTimeout=600000
```

### 7. AT 模式与 ORM 框架兼容性

| ORM 框架 | 兼容性 | 说明 |
|------|:--:|------|
| MyBatis / MyBatis-Plus | ✅ | 完美支持 |
| JdbcTemplate | ✅ | 完美支持 |
| JPA / Hibernate | ⚠️ | 需要额外注意主键生成策略和批量操作 |
| ShardingSphere | ⚠️ | 需要特殊配置，参考 Seata 官方文档 |

### 8. 调试日志配置

```yaml
logging:
  level:
    io.seata: DEBUG             # Seata 框架日志
    com.alibaba.nacos: DEBUG    # Nacos 客户端日志
```

通过日志可以看到：
- XID 的传递路径
- 分支注册/提交/回滚的完整过程
- undo_log 的生成内容

### 9. 事务分组配置检查清单

```text
☐ Nacos 中 seataServer.properties 中 service.vgroupMapping.{your_group}=default
☐ 客户端 application.yml 中 seata.tx-service-group 与上述 {your_group} 一致
☐ 客户端 application.yml 中 seata.service.vgroup-mapping.{your_group}=default
☐ Seata Server 已启动并注册到 Nacos（group=SEATA_GROUP）
☐ 客户端能连接到 Nacos 同一命名空间
```

::: danger 事务分组不匹配是最常见的问题
客户端的事务分组名必须与 Nacos 中 `seataServer.properties` 的 `service.vgroupMapping.xxx` 的 `xxx` 完全一致，否则客户端找不到 TC 集群，全局事务不会生效。
:::

---

## 总结

| 步骤 | 内容 |
|------|------|
| 1 | 部署 Seata Server（Docker 或手动） |
| 2 | Seata Server 注册到 Nacos，配置存到 Nacos |
| 3 | 每个业务数据库创建 `undo_log` 表 |
| 4 | 业务服务引入 `spring-cloud-starter-alibaba-seata` |
| 5 | 配置 `application.yml` 中的 Seata 客户端参数 |
| 6 | 在业务入口方法上添加 `@GlobalTransactional` |
| 7 | 验证分布式事务的提交和回滚 |

Seata AT 模式对代码侵入性极低，只需要一个注解即可实现分布式事务。对于更复杂的场景（如资金操作），可以使用 TCC 模式获得更精细的控制。