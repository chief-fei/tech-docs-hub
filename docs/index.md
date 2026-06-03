---
layout: home

hero:
  name: 技术文档中心
  text: Java 生态技术栈指南
  tagline: 从 COLA 架构到微服务，从数据库到容器化 — 一站式技术文档库
  actions:
    - theme: brand
      text: 开始阅读
      link: /cola/quickstart
    - theme: alt
      text: COLA 架构
      link: /cola/

features:
  - icon: 🏗️
    title: 结构化 & 体系化
    details: 按技术栈分类，自动生成侧边栏、面包屑导航，轻松构建结构化知识库

  - icon: 📝
    title: Markdown 驱动
    details: 只需 Markdown 即可创建美观的文档站点，配合多维导航和搜索快速定位每个知识点

  - icon: 🚀
    title: 实战导向
    details: 每个技术点独立成篇，按需查阅。覆盖 COLA、Redis、Docker、ES、Spring Cloud 等主流技术栈

  - icon: 🔄
    title: 持续更新
    details: 文档基于 Spring Boot 2.x 生态，结合官方文档和一线实战经验持续更新维护
---

## 学习路线图

```mermaid
flowchart LR
  subgraph S1["第一阶段：Java基础与项目构建"]
    direction LR
    A["Java 8+"] --> B["Maven<br/>/dev-tools/maven"] --> C["Lombok<br/>/cola/lombok"] --> D["项目结构规范"]
  end

  subgraph S2["第二阶段：Spring Boot 2.7.x核心"]
    direction LR
    E["概述<br/>/spring-boot/"] --> F["Controller<br/>/spring-boot/controller"]
    F --> G["Filter / Interceptor<br/>/spring-boot/filter<br/>/spring-boot/interceptor"]
    G --> H["全局异常处理<br/>/spring-boot/exception"]
    H --> I["AOP<br/>/spring-boot/aop"]
    I --> J["事务管理<br/>/spring-boot/transaction"]
    J --> K["Bean管理<br/>/spring-boot/bean"]
    K --> L["配置与属性<br/>/spring-boot/config"]
    L --> M["javax.validation校验<br/>/spring-boot/validation"]
    M --> N["注解速查<br/>/spring-boot/annotations"]
  end

  subgraph S3["第三阶段：数据库与缓存"]
    direction LR
    O["MySQL<br/>DDL/DML/DQL<br/>/mysql/"] --> P["MyBatis<br/>/mysql/mybatis/"]
    P --> Q["MyBatis-Plus<br/>/mysql/mybatis-plus/"]
    Q --> R["Druid连接池<br/>/mysql/druid"]
    R --> S["Redis<br/>/redis/"]
    S --> T["Redisson分布式锁<br/>/redis/redisson-lock"]
    T --> U["Elasticsearch<br/>/es/"]
  end

  subgraph S4["第四阶段：架构设计"]
    direction LR
    V["COLA概述<br/>/cola/"] --> W["六大模块<br/>/cola/architecture"]
    W --> X["核心组件<br/>/cola/components/index"]
  end

  subgraph S5["第五阶段：微服务生态"]
    direction LR
    Y["Nacos<br/>/spring-cloud/nacos/"] --> Z["OpenFeign<br/>/spring-cloud/openfeign/"]
    Z --> AA["Gateway<br/>/spring-cloud/gateway"]
    AA --> AB["Sentinel<br/>/spring-cloud/sentinel"]
    AB --> AC["Seata<br/>/spring-cloud/seata"]
    AC --> AD["RocketMQ<br/>/spring-cloud/rocketmq/"]
  end

  subgraph S6["第六阶段：生产运维与工具"]
    direction LR
    AE["Docker<br/>/docker/"] --> AF["XXL-Job<br/>/dev-tools/xxl-job"]
    AF --> AG["Sa-Token<br/>/dev-tools/sa-token"]
    AG --> AH["EasyExcel<br/>/dev-tools/easyexcel"]
    AH --> AI["MapStruct<br/>/dev-tools/mapstruct"]
    AI --> AJ["阿里云OSS<br/>/dev-tools/aliyun-oss"]
    AJ --> AK["Jasypt<br/>/dev-tools/jasypt"]
    AK --> AL["Hutool<br/>/utils/hutool"]
    AL --> AM["Netty<br/>/utils/netty"]
  end

  S1 --> S2 --> S3 --> S4 --> S5 --> S6
```

## 技术栈

| 分类 | 技术 | 说明 |
|------|------|------|
| **架构** | [COLA](./cola/) | 整洁面向对象分层架构，DDD 落地实践 |
| **核心** | [Spring Boot 2.7.x](./spring-boot/) | Controller、Filter、Interceptor、Transaction、AOP、Bean、Config 全解析 |
| **数据库** | [MySQL](./mysql/) + [MyBatis](./mysql/mybatis/)/[MyBatis-Plus](./mysql/mybatis-plus/) + [Druid](./mysql/druid) | DDL/DML/DQL + ORM + 连接池 |
| **缓存** | [Redis](./redis/) + [Redisson](./redis/redisson-lock) | 数据类型全指南 + 分布式锁 |
| **搜索** | [Elasticsearch](./es/) | 数据类型、Mapping、索引CRUD、文档CRUD、Spring Boot集成 |
| **容器** | [Docker](./docker/) | 镜像管理、容器操作、Dockerfile、Compose、部署实战 |
| **微服务** | [Nacos](./spring-cloud/nacos/)/[OpenFeign](./spring-cloud/openfeign/)/[RocketMQ](./spring-cloud/rocketmq/)/[Sentinel](./spring-cloud/sentinel)/[Seata](./spring-cloud/seata)/[Gateway](./spring-cloud/gateway) | 注册配置中心、声明式调用、消息队列、熔断降级、分布式事务、网关 |
| **开发工具** | [Maven](./dev-tools/maven)/[MapStruct](./dev-tools/mapstruct)/[EasyExcel](./dev-tools/easyexcel)/[XXL-Job](./dev-tools/xxl-job)/[Sa-Token](./dev-tools/sa-token)/[OSS](./dev-tools/aliyun-oss)/[Jasypt](./dev-tools/jasypt)/[Hutool](./utils/hutool)/[Netty](./utils/netty) | 构建、对象映射、Excel、定时任务、权限认证、云存储、加密、工具库、网络编程 |

---

## 反馈交流

在使用过程中有任何问题和想法，欢迎提 [Issue](https://github.com/chief-fei/tech-docs-hub/issues)。

如果文档对你有帮助，欢迎 Star [tech-docs-hub](https://github.com/chief-fei/tech-docs-hub)
