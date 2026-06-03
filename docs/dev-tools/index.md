# 开发工具与效能库

Java 开发中常用的构建工具、代码生成器、数据处理库、定时任务、连接池、认证鉴权等工具使用指南。所有文档基于 **Spring Boot 2.7.x** 兼容版本编写。

## 工具列表

| 工具 | 文档 | 版本 | 用途 |
|------|------|------|------|
| **Maven** | [maven.md](./maven.md) | 3.8.x | 项目构建与依赖管理 |
| **MapStruct** | [mapstruct.md](./mapstruct.md) | 1.5.3.Final | 编译期对象映射，解决 VO/DTO/Entity 转换 |
| **EasyExcel** | [easyexcel.md](./easyexcel.md) | 3.3.x | 海量 Excel 数据读写，低内存占用 |
| **XXL-Job** | [xxl-job.md](./xxl-job.md) | 2.4.x | 分布式定时任务调度 |
| **Druid** | [druid.md](./druid.md) | 1.2.x | 数据库连接池，SQL 监控与防火墙 |
| **Sa-Token** | [sa-token.md](./sa-token.md) | 1.37.x | 轻量级权限认证框架 |
| **Jasypt** | [jasypt.md](./jasypt.md) | 3.0.5 | 配置文件敏感信息加密 |

## 快速选择指南

| 场景 | 推荐工具 |
|------|---------|
| 项目构建、依赖管理、多模块 | Maven |
| Entity → DTO → VO 对象转换 | MapStruct |
| 百万级 Excel 数据导入导出 | EasyExcel |
| 分布式定时任务、分片调度 | XXL-Job |
| 数据库连接池 + SQL 监控 | Druid |
| 登录认证、权限校验、OAuth2 | Sa-Token |
| 配置文件密码加密 | Jasypt |

## 推荐学习路线

1. **必备基础**：先学 [Maven](./maven.md) — 项目构建与依赖管理是 Java 开发的基石
2. **开发提效**：学 [MapStruct](./mapstruct.md) — 告别手写 BeanUtils.copyProperties
3. **数据导入导出**：学 [EasyExcel](./easyexcel.md) — 处理 Excel 报表需求
4. **数据库连接池**：学 [Druid](./druid.md) — 替换 HikariCP，获得 SQL 监控能力
5. **权限认证**：学 [Sa-Token](./sa-token.md) — 比 Spring Security 更轻量的认证方案
6. **定时任务**：学 [XXL-Job](./xxl-job.md) — 分布式环境下的任务调度
7. **配置安全**：学 [Jasypt](./jasypt.md) — 保护配置文件中的敏感信息

---

## 版本兼容性说明

本文档系列基于以下版本：

| 工具 | 版本 | JDK 要求 | Spring Boot 2.7.x 兼容 |
|------|------|----------|------------------------|
| Maven | 3.8.x | JDK 8+ | ✅ |
| MapStruct | 1.5.3.Final | JDK 8+ | ✅ |
| EasyExcel | 3.3.x | JDK 8+ | ✅ |
| XXL-Job | 2.4.x | JDK 8+ | ✅ |
| Druid | 1.2.x | JDK 8+ | ✅ |
| Sa-Token | 1.37.x | JDK 8+ | ✅ |
| Jasypt | 3.0.5 | JDK 8+ | ✅ |

> 所有工具均基于 **JDK 8+** 构建，与 **Spring Boot 2.7.x** 完全兼容。

## 参考资源

- [Spring Boot 2.7.x 文档](../spring-boot/)
- [Spring Cloud 生态文档](../spring-cloud/)
- [数据库与缓存文档](../mysql/)