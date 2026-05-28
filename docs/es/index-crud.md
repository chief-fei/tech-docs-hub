# ES 索引库 CRUD

## 一、创建索引

### 空索引

```json
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  }
}
```

### 带 Mapping 创建

```json
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "name":  { "type": "text", "analyzer": "ik_max_word" },
      "price": { "type": "double" },
      "stock": { "type": "integer" }
    }
  }
}
```
响应：`{ "acknowledged": true, "shards_acknowledged": true }`

### 带别名创建

```json
PUT /products_v1
{
  "aliases": { "products": {} }
}
```
之后搜索 `products` 等同搜索 `products_v1`。

---

## 二、查看索引

```json
// 查看所有索引（表格形式）
GET /_cat/indices?v

// 查看指定索引
GET /products

// 查看 Settings
GET /products/_settings

// 查看 Mapping
GET /products/_mapping

// 查看指定字段的 Mapping
GET /products/_mapping/field/name

// 查看统计信息（文档数、存储大小等）
GET /products/_stats
```

### 判断是否存在

```json
HEAD /products
```
返回 200 = 存在，404 = 不存在。

---

## 三、修改索引

### 修改 Settings（仅动态参数可改）

```json
PUT /products/_settings
{
  "index": {
    "number_of_replicas": 2,
    "refresh_interval": "30s",
    "max_result_window": 20000
  }
}
```

可动态修改的参数：
| 参数 | 说明 |
|------|------|
| `number_of_replicas` | 副本数 |
| `refresh_interval` | 刷新间隔 |
| `max_result_window` | 最大分页深度（from + size 上限） |

### 修改 Mapping（仅可追加字段）

**已存在的字段类型不可修改**，只能追加新字段：

```json
PUT /products/_mapping
{
  "properties": {
    "description": { "type": "text" },
    "tags":        { "type": "keyword" }
  }
}
```

### Reindex（重建索引修改字段类型）

如需修改已有字段类型，只能通过 Reindex：

```json
// 1. 创建新索引（正确的 Mapping）
PUT /products_v2
{
  "mappings": {
    "properties": {
      "price": { "type": "scaled_float", "scaling_factor": 100 }
    }
  }
}

// 2. 迁移数据
POST /_reindex
{
  "source": { "index": "products" },
  "dest":   { "index": "products_v2" }
}

// 3. 切换别名
POST /_aliases
{
  "actions": [
    { "remove": { "index": "products", "alias": "prod_alias" } },
    { "add":    { "index": "products_v2", "alias": "prod_alias" } }
  ]
}

// 4. 删除旧索引
DELETE /products
```

---

## 四、删除索引

```json
DELETE /products           // 单个
DELETE /products,orders    // 多个
DELETE /log-2024-*         // 通配符
```

---

## 五、索引别名

别名指向一个或多个索引，切换索引对应用透明。

```json
// 添加别名
POST /_aliases
{
  "actions": [
    { "add": { "index": "products", "alias": "product_search" } }
  ]
}

// 原子切换别名
POST /_aliases
{
  "actions": [
    { "remove": { "index": "products_v1", "alias": "product_search" } },
    { "add":    { "index": "products_v2", "alias": "product_search" } }
  ]
}

// 查看别名指向的索引
GET /_alias/product_search

// 查看某个索引的别名
GET /products/_alias
```

---

## 六、Index Template（索引模板）

```json
PUT /_index_template/product_template
{
  "index_patterns": ["products-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1
    },
    "mappings": {
      "properties": {
        "id":   { "type": "long" },
        "name": { "type": "text" }
      }
    }
  },
  "priority": 100
}

// 创建匹配模板的索引，自动应用 Settings 和 Mapping
PUT /products-2024
```

---

## 索引操作速查

| 操作 | 请求 | URL |
|------|------|-----|
| 创建 | PUT | `/{index}` |
| 查看全部 | GET | `/_cat/indices?v` |
| 查看详情 | GET | `/{index}` |
| 查看 Mapping | GET | `/{index}/_mapping` |
| 查看 Settings | GET | `/{index}/_settings` |
| 判断存在 | HEAD | `/{index}` |
| 修改 Settings | PUT | `/{index}/_settings` |
| 追加字段 | PUT | `/{index}/_mapping` |
| Reindex | POST | `/_reindex` |
| 删除 | DELETE | `/{index}` |
| 别名操作 | POST | `/_aliases` |
| 创建模板 | PUT | `/_index_template/{name}` |
