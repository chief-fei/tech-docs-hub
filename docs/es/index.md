# Elasticsearch 使用指南

Elasticsearch（ES）是一个分布式、RESTful 的搜索和分析引擎。

## 文档目录

| 文档 | 说明 |
|------|------|
| [数据类型与 Mapping](./data-types.md) | 字段类型、Mapping 写法、完整示例 |
| [索引库 CRUD](./index-crud.md) | 创建/查看/修改/删除索引、别名、模板 |
| [文档 CRUD](./document-crud.md) | 添加/查询/更新/删除文档、Bulk 批量操作 |
| [Spring Boot 集成 ES](./spring-boot.md) | ElasticsearchRestTemplate / RestHighLevelClient API 详解 |

## 核心概念

| 概念 | 说明 | 类比（关系型） |
|------|------|:--:|
| **Index（索引）** | 文档集合 | Database |
| **Mapping（映射）** | 字段类型定义 | Schema |
| **Document（文档）** | JSON 数据 | Row |
| **Field（字段）** | 属性 | Column |
| **Shard（分片）** | 数据分片 | 分区 |
| **Replica（副本）** | 冗余副本 | 从库 |

## Spring Boot 集成

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

```yaml
spring:
  elasticsearch:
    rest:
      uris: http://localhost:9200
      connection-timeout: 5s
      read-timeout: 30s
```
