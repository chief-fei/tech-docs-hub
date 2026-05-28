# ES 数据类型与 Mapping

## Mapping 概述

Mapping 定义索引中字段的类型、分词方式、索引规则等，类似数据库的 Schema。ES 有两种方式定义 Mapping：**显式 Mapping**（手动定义）和**动态 Mapping**（ES 自动推断）。

---

## 一、核心数据类型

### 字符串类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| `text` | 全文索引，会被分词 | 文章内容、商品名称 |
| `keyword` | 精确匹配，不分词 | 订单号、状态、邮箱、标签 |

### 数值类型

| 类型 | 范围 |
|------|------|
| `long` | -2^63 ~ 2^63-1 |
| `integer` | -2^31 ~ 2^31-1 |
| `short` | -32768 ~ 32767 |
| `byte` | -128 ~ 127 |
| `double` | 双精度浮点 |
| `float` | 单精度浮点 |
| `scaled_float` | 按缩放因子存储为 long |

### 日期类型

| 类型 | 说明 |
|------|------|
| `date` | 日期时间 |
| `date_nanos` | 纳秒精度 |

### 布尔与范围

| 类型 | 说明 |
|------|------|
| `boolean` | true / false |
| `integer_range`, `date_range` 等 | 范围类型 |

### 复合类型

| 类型 | 说明 |
|------|------|
| `object` | JSON 嵌套对象 |
| `nested` | 独立可查询的嵌套文档 |

### 其他类型

| 类型 | 说明 |
|------|------|
| `binary` | Base64 二进制 |
| `geo_point` | 经纬度 |
| `ip` | IP 地址 |

---

## 二、常用 Mapping 参数

### 通用参数

| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `index` | 是否索引（false 则不可搜索） | true |
| `store` | 是否独立存储 | false |
| `doc_values` | 列式存储（排序/聚合需要） | true |

### text 专用参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `analyzer` | 索引时分词器 | `ik_max_word` |
| `search_analyzer` | 搜索时分词器 | `ik_smart` |
| `fields` | 多字段映射（同时创建 keyword 子字段） | 见下方示例 |

```json
{
  "name": {
    "type": "text",
    "analyzer": "ik_max_word",
    "search_analyzer": "ik_smart",
    "fields": {
      "keyword": { "type": "keyword" }
    }
  }
}
```
`name` 字段支持全文搜索，`name.keyword` 支持精确匹配和排序。

### keyword 专用参数

| 参数 | 说明 |
|------|------|
| `ignore_above` | 超此长度的值不被索引（默认 2147483647） |

### 数值/日期参数

| 参数 | 说明 |
|------|------|
| `coerce` | 是否自动转换类型（默认 true） |
| `scaling_factor` | scaled_float 的缩放因子 |
| `format` | 日期格式，如 `yyyy-MM-dd HH:mm:ss` |

---

## 三、完整 Mapping 示例

### 商品索引

```json
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "id":          { "type": "long" },
      "name": {
        "type": "text",
        "analyzer": "ik_max_word",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "brand":       { "type": "keyword" },
      "category_id": { "type": "integer" },
      "price":       { "type": "scaled_float", "scaling_factor": 100 },
      "stock":       { "type": "integer" },
      "status":      { "type": "keyword" },
      "tags":        { "type": "keyword" },
      "description": { "type": "text", "analyzer": "ik_max_word" },
      "created_at":  { "type": "date", "format": "yyyy-MM-dd HH:mm:ss" },
      "updated_at":  { "type": "date" },
      "location":    { "type": "geo_point" },
      "specs": {
        "type": "nested",
        "properties": {
          "name":  { "type": "keyword" },
          "value": { "type": "keyword" }
        }
      }
    }
  }
}
```

### 用户索引

```json
PUT /users
{
  "mappings": {
    "properties": {
      "id":       { "type": "long" },
      "nickname": {
        "type": "text",
        "analyzer": "ik_max_word",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } }
      },
      "email":    { "type": "keyword" },
      "phone":    { "type": "keyword" },
      "age":      { "type": "byte" },
      "is_vip":   { "type": "boolean" },
      "balance":  { "type": "double" },
      "address":  { "type": "text", "analyzer": "ik_smart" },
      "tags":     { "type": "keyword" },
      "birthday": { "type": "date", "format": "yyyy-MM-dd" },
      "register_time": { "type": "date" }
    }
  }
}
```

---

## 四、Dynamic Template（动态模板）

不预先定义 Mapping，而是定义字段名到类型的匹配规则：

```json
{
  "mappings": {
    "dynamic_templates": [
      {
        "strings_as_keyword": {
          "match_mapping_type": "string",
          "mapping": { "type": "keyword" }
        }
      },
      {
        "age_and_count": {
          "match_mapping_type": "long",
          "match": "age|level|count|stock|score",
          "mapping": { "type": "integer" }
        }
      }
    ]
  }
}
```

**规则**：
- `match_mapping_type`：匹配 ES 推断的类型
- `match` / `unmatch`：按字段名正则匹配/排除
- `path_match`：按嵌套路径匹配
