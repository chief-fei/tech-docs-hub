# Spring Cloud 生态使用指南

Spring Cloud 是构建微服务分布式系统的常用工具集。

## 文档目录

| 组件 | 文档 | 说明 |
|------|------|------|
| **Nacos** | [nacos/](./nacos/) | 服务注册发现（含 Dubbo 集成） + 配置中心 |
| **RocketMQ** | [rocketmq/](./rocketmq/) | 分布式消息中间件 |
| **OpenFeign** | [openfeign/](./openfeign/) | 声明式 HTTP 客户端（外部 API 调用） |

> **MySQL / MyBatis / MyBatis-Plus** 已归类到 [数据库与缓存](/mysql/) 栏目下。

## 微服务架构关系

```text
                  ┌──────────────┐
                  │    Nacos     │ ← 注册中心 / 配置中心
                  └──────┬───────┘
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Service A│──▶│ Service B│   │ Service C│
   └────┬─────┘   └──────────┘   └──────────┘
        │ Dubbo / OpenFeign 远程调用
        ▼
   ┌──────────┐
   │ RocketMQ │
   │ 消息队列  │
   └──────────┘
```

## 版本对应

| Spring Cloud | Spring Boot | Spring Cloud Alibaba |
|-------------|------------|---------------------|
| 2021.0.x | 2.7.x | 2021.0.6.0 |
| 2022.0.x | 3.0.x | 2022.0.x |
| 2023.0.x | 3.2.x | 2023.0.x |
| 2024.0.x | 3.4.x | 2024.0.x |

## 统一依赖管理

> 本文档基于 **Spring Boot 2.7.x** 版本。

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2021.0.9</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>2021.0.6.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```
