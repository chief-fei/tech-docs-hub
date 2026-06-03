# 常用工具类库

Java 开发中常用的工具类库使用指南，所有文档基于 **Spring Boot 2.7.x** 兼容版本编写。

## 📚 工具类库列表

### 通用工具类

| 库 | 文档 | 版本 | 用途 |
|------|------|------|------|
| **Hutool** | [hutool.md](./hutool.md) | 5.8.x | Java 万能工具类库，涵盖字符串、集合、日期、文件、HTTP、加密等 |

### 网络编程

| 库 | 文档 | 版本 | 用途 |
|------|------|------|------|
| **Netty** | [netty.md](./netty.md) | 4.1.x | 高性能异步网络应用框架 |

## 🎯 快速选择指南

| 场景 | 推荐工具 |
|------|---------|
| 字符串处理、判空、格式化 | Hutool — StrUtil |
| 集合创建、过滤、分页 | Hutool — CollUtil |
| 日期时间解析、格式化、计算 | Hutool — DateUtil |
| 文件读写、复制、遍历 | Hutool — FileUtil |
| JSON 序列化与解析 | Hutool — JSONUtil |
| HTTP 请求调用 | Hutool — HttpUtil |
| 加密解密（AES/RSA/MD5等） | Hutool — SecureUtil |
| 唯一 ID 生成（UUID/雪花算法） | Hutool — IdUtil |
| 对象拷贝、Bean 属性 | Hutool — BeanUtil |
| 构建高性能 TCP/UDP 服务 | Netty |
| HTTP/TCP 客户端开发 | Netty |
| 自定义通信协议 | Netty |

## 📖 推荐学习路线

1. **起步**：先学 [Hutool 核心工具类](./hutool.md) — 在日常开发中立即提升效率
2. **进阶**：了解 [Hutool 高级模块](./hutool.md)（加密、HTTP、JSON）— 少写样板代码
3. **网络编程**：学习 [Netty 基础](./netty.md) — 构建高性能网络应用

---

## 版本兼容性说明

本文档系列基于以下版本：

| 库 | 版本 | Spring Boot 2.7.x 兼容 | 说明 |
|------|------|------------------------|------|
| Hutool | 5.8.x | ✅ | Java 8+，完全兼容 |
| Netty | 4.1.x | ✅ | 与 spring-boot-starter-webflux 共用时注意版本冲突 |

> 所有工具库均基于 JDK 8+ 构建，与 Spring Boot 2.7.x 完全兼容。

## 参考资源

- [Hutool 官方文档](https://hutool.cn/)
- [Netty 官方文档](https://netty.io/wiki/)
- [Spring Boot 2.7.x 文档](../spring-boot/)