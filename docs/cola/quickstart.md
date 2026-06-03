# COLA 快速开始指南

本指南帮助初学者从零开始使用 COLA 架构创建项目。

## 前置条件

- **Java 8+**（推荐 JDK 8 或 JDK 11，Spring Boot 2.7.x 最高支持 JDK 17）
- **Maven 3.6+**
- **Spring Boot 2.7.x**（推荐 2.7.18，最新稳定版本）

> **版本说明**：COLA 5.0.0 同时兼容 Spring Boot 2.7.x 和 Spring Boot 3.x。本指南以 Spring Boot 2.7.18 为基准，所有代码示例使用 `javax.*` 命名空间。

## 方式一：使用 Maven Archetype 创建项目

COLA 提供了 3 种项目模板：

### 1. Web 应用（最常用）

包含 REST Controller，适合对外提供 HTTP API 的项目：

```bash
mvn archetype:generate \
    -DgroupId=com.example.demo \
    -DartifactId=demo-web \
    -Dversion=1.0.0-SNAPSHOT \
    -Dpackage=com.example.demo \
    -DarchetypeArtifactId=cola-framework-archetype-web \
    -DarchetypeGroupId=com.alibaba.cola \
    -DarchetypeVersion=5.0.0
```

### 2. Service 应用（纯服务）

不含 Web 层，适合作为 RPC 或消息驱动的微服务：

```bash
mvn archetype:generate \
    -DgroupId=com.example.demo \
    -DartifactId=demo-service \
    -Dversion=1.0.0-SNAPSHOT \
    -Dpackage=com.example.demo \
    -DarchetypeArtifactId=cola-framework-archetype-service \
    -DarchetypeGroupId=com.alibaba.cola \
    -DarchetypeVersion=5.0.0
```

### 3. Light 应用（轻量级）

按包名分层而非模块分层，适合小型项目：

```bash
mvn archetype:generate \
    -DgroupId=com.example.demo \
    -DartifactId=demo-light \
    -Dversion=1.0.0-SNAPSHOT \
    -Dpackage=com.example.demo \
    -DarchetypeArtifactId=cola-framework-archetype-light \
    -DarchetypeGroupId=com.alibaba.cola \
    -DarchetypeVersion=5.0.0
```

## 生成的项目结构

以 Web 应用为例，会生成以下模块：

```text
demo-web/
├── demo-web-client/          # 客户端契约层（DTO、接口定义）
├── demo-web-adapter/         # 适配层（Controller）
├── demo-web-app/             # 应用层（用例编排）
├── demo-web-domain/          # 领域层（核心业务逻辑）
├── demo-web-infrastructure/  # 基础设施层（数据库、外部服务）
├── start/                    # 启动装配层
└── pom.xml                   # 父 POM
```

## 运行项目

```bash
# 1. 编译整个项目
cd demo-web
mvn clean install -DskipTests

# 2. 启动应用
cd start
mvn spring-boot:run

# 3. 验证
curl http://localhost:8080/helloworld
```

## 方式二：手动添加 COLA 组件

如果已有 Spring Boot 项目，可以逐个引入 COLA 组件：

```xml
<!-- BOM 统一管理版本 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.alibaba.cola</groupId>
            <artifactId>cola-components-bom</artifactId>
            <version>5.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 按需引入 -->
<dependencies>
    <!-- DTO 和响应格式（必选） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-dto</artifactId>
    </dependency>

    <!-- 异常处理（必选） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-exception</artifactId>
    </dependency>

    <!-- 日志切面（推荐） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-catchlog-starter</artifactId>
    </dependency>

    <!-- 领域建模（推荐） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-domain-starter</artifactId>
    </dependency>

    <!-- 扩展点（按需） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-extension-starter</artifactId>
    </dependency>

    <!-- 状态机（按需） -->
    <dependency>
        <groupId>com.alibaba.cola</groupId>
        <artifactId>cola-component-statemachine</artifactId>
    </dependency>
</dependencies>
```

## 调用流程概览

一个典型请求的流转路径：

```text
HTTP 请求
  → adapter（Controller 接收请求）
    → client 接口（CustomerServiceI）
      → app（CustomerServiceImpl → CustomerAddCmdExe）
        → domain（Customer 实体执行 checkConflict()）
        → infrastructure（CustomerGatewayImpl → Mapper → DB）
      ← Response
    ← Response
  ← HTTP 响应
```

## 下一步

- 阅读 [架构详解](./architecture.md) 了解四层架构
- 阅读 [组件文档](./components/index.md) 了解每个组件的用法
- 阅读 [命名规范](./naming-conventions.md) 了解命名约定
