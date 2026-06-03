# XXL-Job 2.4.x 完全指南

## 概述

XXL-Job 是大众点评开源的一款分布式任务调度平台，提供简单易用的 Web 管理界面，支持动态管理任务、调度策略、分片广播、失败重试等功能。

> **兼容性**：XXL-Job 2.4.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

### 架构图

```text
┌──────────────────────────────────────────────────┐
│                  调度中心（Admin）                  │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│    │ 任务管理  │  │ 调度日志  │  │ 执行器管理 │     │
│    └──────────┘  └──────────┘  └──────────┘     │
│    ┌──────────┐  ┌──────────┐                    │
│    │ 用户管理  │  │ 监控报表  │                    │
│    └──────────┘  └──────────┘                    │
└──────────┬──────────┬──────────┬──────────────────┘
           │ HTTP     │ HTTP     │ HTTP
           ▼          ▼          ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 执行器实例 1  │ │ 执行器实例 2  │ │ 执行器实例 3  │
│ (Spring Boot)│ │ (Spring Boot)│ │ (Spring Boot)│
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 一、调度中心部署

### 1.1 下载源码

```bash
# 从 GitHub 下载
git clone https://github.com/xuxueli/xxl-job.git
cd xxl-job
git checkout 2.4.2
```

### 1.2 初始化数据库

执行 `doc/db/tables_xxl_job.sql`，创建以下核心表：

| 表名 | 说明 |
|------|------|
| `xxl_job_group` | 执行器组 |
| `xxl_job_info` | 任务信息 |
| `xxl_job_log` | 调度日志 |
| `xxl_job_log_report` | 调度日志报表 |
| `xxl_job_logglue` | GLUE 代码日志 |
| `xxl_job_registry` | 执行器注册表 |
| `xxl_job_lock` | 分布式锁 |
| `xxl_job_user` | 调度中心用户 |

### 1.3 修改配置

`xxl-job-admin/src/main/resources/application.properties`：

```properties
# 调度中心端口
server.port=8080

# 数据库连接
spring.datasource.url=jdbc:mysql://localhost:3306/xxl_job?useUnicode=true&characterEncoding=UTF-8
spring.datasource.username=root
spring.datasource.password=root

# 登录账号
xxl.job.login.username=admin
xxl.job.login.password=123456
```

### 1.4 启动调度中心

```bash
cd xxl-job-admin
mvn spring-boot:run
```

访问 `http://localhost:8080/xxl-job-admin`，使用 `admin/123456` 登录。

---

## 二、执行器配置

### 2.1 Maven 依赖

```xml
<dependency>
    <groupId>com.xuxueli</groupId>
    <artifactId>xxl-job-core</artifactId>
    <version>2.4.2</version>
</dependency>
```

### 2.2 application.yml

```yaml
xxl:
  job:
    admin:
      # 调度中心地址（多个用逗号分隔）
      addresses: http://localhost:8080/xxl-job-admin
    # 执行器配置
    executor:
      appname: demo-executor        # 执行器名称（需与调度中心注册的一致）
      address:                      # 执行器地址（为空则自动获取）
      ip:                           # 执行器 IP（为空则自动获取）
      port: 9999                    # 执行器通信端口
      logpath: /data/applogs/xxl-job/jobhandler  # 日志路径
      logretentiondays: 30          # 日志保留天数
    accessToken: default_token      # 通信令牌（与调度中心一致）
```

### 2.3 配置类

```java
@Configuration
@Slf4j
public class XxlJobConfig {

    @Value("${xxl.job.admin.addresses}")
    private String adminAddresses;

    @Value("${xxl.job.executor.appname}")
    private String appname;

    @Value("${xxl.job.executor.port}")
    private int port;

    @Value("${xxl.job.executor.logpath}")
    private String logPath;

    @Value("${xxl.job.executor.logretentiondays}")
    private int logRetentionDays;

    @Value("${xxl.job.accessToken}")
    private String accessToken;

    @Bean
    public XxlJobSpringExecutor xxlJobExecutor() {
        log.info(">>>>>>>>>>> xxl-job executor init.");
        XxlJobSpringExecutor executor = new XxlJobSpringExecutor();
        executor.setAdminAddresses(adminAddresses);
        executor.setAppname(appname);
        executor.setPort(port);
        executor.setLogPath(logPath);
        executor.setLogRetentionDays(logRetentionDays);
        executor.setAccessToken(accessToken);
        return executor;
    }
}
```

---

## 三、BEAN 模式任务开发

### 3.1 @XxlJob 注解

```java
@Component
@Slf4j
public class SampleJobHandler {

    /**
     * 简单任务
     */
    @XxlJob("demoJobHandler")
    public ReturnT<String> demoJobHandler() throws Exception {
        log.info("XXL-JOB: 简单任务开始执行");
        // 业务逻辑
        return ReturnT.SUCCESS;
    }

    /**
     * 带参数的任务
     */
    @XxlJob("paramJobHandler")
    public ReturnT<String> paramJobHandler() throws Exception {
        // 获取任务参数
        String param = XxlJobHelper.getJobParam();
        log.info("任务参数：{}", param);
        return ReturnT.SUCCESS;
    }
}
```

### 3.2 ReturnT 返回值

| 返回值 | 说明 | 触发策略 |
|------|------|---------|
| `ReturnT.SUCCESS` | 执行成功 | 记录成功日志 |
| `ReturnT.FAIL` | 执行失败 | 触发报警 + 重试 |
| `new ReturnT<>(500, "msg")` | 自定义失败 | 同上 |

### 3.3 分片广播

分片广播将任务分发到执行器集群的每个节点，每个节点只处理属于自己的那部分数据：

```java
@Component
@Slf4j
public class ShardingJobHandler {

    @XxlJob("shardingJobHandler")
    public ReturnT<String> shardingJobHandler() throws Exception {
        // 分片参数：当前分片索引 / 总分片数
        int shardIndex = XxlJobHelper.getShardIndex();
        int shardTotal = XxlJobHelper.getShardTotal();

        log.info("分片参数：当前分片={}, 总分片={}", shardIndex, shardTotal);

        // 根据分片参数处理数据
        List<Long> ids = getIdsByShard(shardIndex, shardTotal);
        for (Long id : ids) {
            processById(id);
        }

        return ReturnT.SUCCESS;
    }

    /**
     * 按分片获取 ID 列表
     * 例如：id % total == index
     */
    private List<Long> getIdsByShard(int index, int total) {
        // SELECT id FROM users WHERE id % total = index
        // ...
    }
}
```

### 3.4 子任务（链式调用）

在调度中心配置子任务 ID，当前任务执行成功后自动触发子任务：

```java
@Component
@Slf4j
public class ChainJobHandler {

    /**
     * 父任务：数据同步
     */
    @XxlJob("dataSyncJobHandler")
    public ReturnT<String> dataSyncJobHandler() throws Exception {
        log.info("数据同步完成");
        // 执行成功后，调度中心自动触发子任务
        return ReturnT.SUCCESS;
    }

    /**
     * 子任务：数据校验
     */
    @XxlJob("dataCheckJobHandler")
    public ReturnT<String> dataCheckJobHandler() throws Exception {
        log.info("数据校验完成");
        return ReturnT.SUCCESS;
    }
}
```

---

## 四、GLUE 模式

GLUE 模式支持在线编辑任务代码，无需重新部署：

### 4.1 GLUE(Java)

在调度中心新建任务，选择"GLUE(Java)"模式，编写代码：

```java
package com.xxl.job.service.handler;

import com.xxl.job.core.handler.IJobHandler;

public class DemoGlueJobHandler extends IJobHandler {

    @Override
    public void execute() throws Exception {
        XxlJobHelper.log("GLUE 任务开始执行");
        // 业务逻辑
        XxlJobHelper.log("GLUE 任务执行完成");
    }
}
```

### 4.2 GLUE 模式对比

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **BEAN** | 代码写在项目中 | 正式任务，需版本管理 |
| **GLUE(Java)** | 在线编辑 Java 代码 | 临时任务、快速验证 |
| **GLUE(Shell)** | 执行 Shell 脚本 | 运维脚本 |
| **GLUE(Python)** | 执行 Python 脚本 | 数据处理 |
| **GLUE(PHP)** | 执行 PHP 脚本 | — |
| **GLUE(Node.js)** | 执行 Node.js 脚本 | — |
| **GLUE(PowerShell)** | 执行 PowerShell 脚本 | Windows 环境 |

---

## 五、任务配置详解

### 5.1 CRON 表达式

XXL-Job 使用 Quartz 的 CRON 表达式，7 位：

```text
秒 分 时 日 月 周 年(可选)
```

| 表达式 | 说明 |
|------|------|
| `0/5 * * * * ?` | 每 5 秒执行 |
| `0 0 2 * * ?` | 每天凌晨 2 点 |
| `0 0 9-18 * * ?` | 每天 9 点到 18 点整点 |
| `0 0 0 1 * ?` | 每月 1 号凌晨 |
| `0 0 0 ? * MON` | 每周一凌晨 |

### 5.2 路由策略

| 策略 | 说明 |
|------|------|
| `FIRST` | 第一个（固定分配给第一个执行器） |
| `LAST` | 最后一个 |
| `ROUND` | 轮询 |
| `RANDOM` | 随机 |
| `CONSISTENT_HASH` | 一致性哈希（同一任务固定到同一执行器） |
| `LEAST_FREQUENTLY_USED` | 最不经常使用 |
| `LEAST_RECENTLY_USED` | 最近最久未使用 |
| `FAILOVER` | 故障转移（失败后换另一个执行器） |
| `BUSYOVER` | 忙碌转移（空闲时执行） |
| `SHARDING_BROADCAST` | 分片广播（所有执行器各执行一次） |

### 5.3 阻塞策略

| 策略 | 说明 |
|------|------|
| `SERIAL_EXECUTION` | 串行执行（排队等待） |
| `DISCARD_LATER` | 丢弃后续调度（执行中时跳过） |
| `COVER_EARLY` | 覆盖之前调度（执行中时终止旧任务，执行新任务） |

### 5.4 失败重试

在调度中心配置：

| 配置项 | 说明 |
|------|------|
| 失败重试次数 | 任务失败后自动重试的次数 |
| 失败告警 | 重试全部失败后是否发送告警邮件 |

---

## 六、任务生命周期

### 6.1 生命回调

```java
@Component
@Slf4j
public class LifecycleJobHandler {

    @XxlJob("lifecycleJobHandler")
    public void lifecycleJobHandler() throws Exception {
        // 执行前回调
        XxlJobHelper.handleBefore("执行前操作：记录开始时间");

        try {
            // 业务逻辑
            log.info("执行任务...");
        } catch (Exception e) {
            // 执行后回调（失败）
            XxlJobHelper.handleFail("任务执行失败：" + e.getMessage());
            throw e;
        }

        // 执行后回调（成功）
        XxlJobHelper.handleSuccess("任务执行成功");
    }
}
```

### 6.2 任务超时

在调度中心配置"任务超时时间（秒）"，超时后自动中断任务。

---

## 七、分片广播实战

### 7.1 场景：定时对账

假设有 100 万条订单需要每天对账，部署 4 个执行器：

```java
@Component
@Slf4j
public class ReconciliationJobHandler {

    @Autowired
    private OrderService orderService;

    @XxlJob("reconciliationJobHandler")
    public ReturnT<String> reconciliationJobHandler() throws Exception {
        int shardIndex = XxlJobHelper.getShardIndex();
        int shardTotal = XxlJobHelper.getShardTotal();

        log.info("开始对账：分片 {}/{}", shardIndex, shardTotal);

        // 查询本分片负责的订单
        List<Long> orderIds = orderService.getOrderIdsByShard(shardIndex, shardTotal);

        int successCount = 0;
        int failCount = 0;

        for (Long orderId : orderIds) {
            try {
                orderService.reconcile(orderId);
                successCount++;
            } catch (Exception e) {
                log.error("对账失败：订单ID={}", orderId, e);
                failCount++;
            }
        }

        XxlJobHelper.log("对账完成：成功={}, 失败={}", successCount, failCount);
        return ReturnT.SUCCESS;
    }
}
```

Service 层分片查询：

```java
@Service
public class OrderService {

    /**
     * 按分片查询订单 ID
     */
    public List<Long> getOrderIdsByShard(int shardIndex, int shardTotal) {
        // 方案一：id % shardTotal = shardIndex
        // SELECT id FROM orders WHERE id % #{shardTotal} = #{shardIndex}

        // 方案二：数据库分片字段
        // SELECT id FROM orders WHERE shard_key = #{shardIndex}
    }
}
```

---

## 八、调度中心 API

### 8.1 编程式任务管理

```java
@RestController
@RequestMapping("/api/job")
@RequiredArgsConstructor
@Slf4j
public class JobController {

    private static final String ADMIN_URL = "http://localhost:8080/xxl-job-admin";

    /**
     * 动态添加任务
     */
    @PostMapping("/add")
    public Result<String> addJob(@RequestBody JobAddRequest request) {
        Map<String, Object> params = new HashMap<>();
        params.put("jobGroup", request.getJobGroup());
        params.put("jobDesc", request.getJobDesc());
        params.put("executorHandler", request.getExecutorHandler());
        params.put("scheduleConf", request.getScheduleConf());
        params.put("glueType", "BEAN");
        params.put("executorParam", request.getExecutorParam());
        params.put("author", "admin");
        params.put("alarmEmail", "");

        String result = HttpUtil.post(ADMIN_URL + "/jobinfo/add", params);
        return Result.success(result);
    }

    /**
     * 触发一次任务
     */
    @PostMapping("/trigger/{jobId}")
    public Result<String> triggerJob(@PathVariable int jobId) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", jobId);
        params.put("executorParam", "");

        String result = HttpUtil.post(ADMIN_URL + "/jobinfo/trigger", params);
        return Result.success(result);
    }

    /**
     * 暂停任务
     */
    @PostMapping("/pause/{jobId}")
    public Result<String> pauseJob(@PathVariable int jobId) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", jobId);
        String result = HttpUtil.post(ADMIN_URL + "/jobinfo/stop", params);
        return Result.success(result);
    }
}
```

---

## 九、Spring Boot 2.7.x 完整集成示例

```java
// 1. pom.xml 添加依赖
// 2. application.yml 配置
// 3. XxlJobConfig 配置类
// 4. 编写任务处理器

@Component
@Slf4j
public class DemoJobHandlers {

    @Autowired
    private UserService userService;

    /**
     * 定时清理过期会话
     * CRON: 0 0 3 * * ?  每天凌晨3点
     */
    @XxlJob("cleanExpiredSessionHandler")
    public ReturnT<String> cleanExpiredSessionHandler() {
        try {
            int count = userService.cleanExpiredSessions();
            XxlJobHelper.log("清理过期会话：{} 条", count);
            return ReturnT.SUCCESS;
        } catch (Exception e) {
            log.error("清理过期会话失败", e);
            return new ReturnT<>(ReturnT.FAIL_CODE, e.getMessage());
        }
    }

    /**
     * 定时统计报表
     * CRON: 0 0 1 * * ?  每天凌晨1点
     */
    @XxlJob("reportJobHandler")
    public ReturnT<String> reportJobHandler() {
        try {
            userService.generateDailyReport();
            XxlJobHelper.log("报表生成成功");
            return ReturnT.SUCCESS;
        } catch (Exception e) {
            log.error("报表生成失败", e);
            return ReturnT.FAIL;
        }
    }

    /**
     * 分片处理：数据同步
     */
    @XxlJob("syncDataJobHandler")
    public ReturnT<String> syncDataJobHandler() {
        int shardIndex = XxlJobHelper.getShardIndex();
        int shardTotal = XxlJobHelper.getShardTotal();

        try {
            userService.syncDataByShard(shardIndex, shardTotal);
            XxlJobHelper.log("分片 {} 同步完成", shardIndex);
            return ReturnT.SUCCESS;
        } catch (Exception e) {
            log.error("分片同步失败", e);
            return ReturnT.FAIL;
        }
    }
}
```

---

## 十、常见问题

**Q: 执行器注册不上调度中心？**

检查：
- 执行器 `appname` 是否与调度中心配置一致
- 调度中心 `addresses` 地址是否正确
- `accessToken` 是否一致
- 执行器端口是否被占用
- 网络是否互通

**Q: 任务执行了但调度中心显示失败？**

确保 `@XxlJob` 方法返回了 `ReturnT.SUCCESS`，不要返回 `null`。

**Q: 分片广播如何实现任务只执行一次？**

分片广播下每个执行器都会执行一次，利用分片参数（`shardIndex`/`shardTotal`）让每个执行器只处理属于自己的数据。

**Q: 时区问题？**

在 `application.yml` 中设置：
```yaml
spring:
  jackson:
    time-zone: Asia/Shanghai
```

**Q: 调度日志不显示？**

检查 `logpath` 路径是否有写入权限，且 `logretentiondays` 设置合理。

**Q: 如何实现任务依赖？**

使用"子任务"功能：在任务配置中填写子任务 ID，父任务执行成功后自动触发。

---

## 参考资源

- [XXL-Job 官方文档](https://www.xuxueli.com/xxl-job/)
- [XXL-Job GitHub](https://github.com/xuxueli/xxl-job)
- [Spring Boot 2.7.x 文档](../spring-boot/)