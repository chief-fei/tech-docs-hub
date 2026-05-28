# ES 文档 CRUD

## 一、添加文档

### POST（自动生成 ID）

```json
POST /products/_doc
{
  "name": "iPhone 15",
  "price": 6999,
  "stock": 100,
  "brand": "Apple"
}
```
响应：`{ "_id": "abc123...", "result": "created" }`

### PUT（指定 ID）

```json
PUT /products/_doc/1001
{
  "name": "MacBook Pro",
  "price": 14999,
  "brand": "Apple"
}
```
ID 不存在则创建，已存在则**全量替换**。

### POST _create（不覆盖）

```json
POST /products/_create/1002
{
  "name": "iPad",
  "price": 4799
}
```
ID 已存在则返回 409 错误。

---

## 二、查询文档

### 按 ID 查询

```json
GET /products/_doc/1001
```
返回 `_source` 为原始 JSON。文档不存在返回 `"found": false`。

### 只获取 _source

```json
GET /products/_source/1001
```

### 获取指定字段

```json
GET /products/_doc/1001?_source_includes=name,price
GET /products/_doc/1001?_source_excludes=stock,description
```

### 判断存在

```json
HEAD /products/_doc/1001
```
200 = 存在，404 = 不存在。

### MGET（批量查询）

```json
GET /products/_mget
{
  "ids": ["1001", "1002", "1003"]
}

// 跨索引
GET /_mget
{
  "docs": [
    { "_index": "products", "_id": "1001" },
    { "_index": "users",    "_id": "2001" }
  ]
}
```

---

## 三、更新文档

### 部分更新（只更新指定字段）

```json
POST /products/_update/1001
{
  "doc": {
    "price": 13999,
    "stock": 45
  }
}
```
其他字段不变。

### Script 更新

```json
// 数值增减
POST /products/_update/1001
{
  "script": {
    "source": "ctx._source.stock += params.count",
    "params": { "count": 10 }
  }
}

// 数组追加
POST /products/_update/1001
{
  "script": {
    "source": "ctx._source.tags.add(params.tag)",
    "params": { "tag": "热销" }
  }
}

// 删除字段
POST /products/_update/1001
{
  "script": {
    "source": "ctx._source.remove('temp_field')"
  }
}
```

### Upsert

```json
POST /products/_update/9999
{
  "doc": {
    "name": "新产品",
    "price": 999
  },
  "doc_as_upsert": true
}
```
存在则更新，不存在则以 `doc` 内容创建。

---

## 四、删除文档

### 按 ID 删除

```json
DELETE /products/_doc/1001
```

### 按查询条件删除

```json
POST /products/_delete_by_query
{
  "query": {
    "term": { "status": "offline" }
  }
}
```
返回 `deleted` 字段表示删除数量。

---

## 五、Bulk 批量操作

```json
POST /_bulk
{ "index":  { "_index": "products", "_id": "1001" } }
{ "name": "iPhone 15", "price": 6999 }
{ "create": { "_index": "products", "_id": "1002" } }
{ "name": "iPad", "price": 4799 }
{ "update": { "_index": "products", "_id": "1001" } }
{ "doc": { "price": 6599 } }
{ "delete": { "_index": "products", "_id": "1003" } }
```
每条操作两行（操作行 + 数据行）。**最后必须以换行结尾**。

Bulk 操作类型：
| 操作 | 说明 |
|------|------|
| `index` | 添加/全量替换 |
| `create` | 仅创建（已存在报错） |
| `update` | 部分更新 |
| `delete` | 删除 |

---

## 文档操作速查

| 操作 | 请求 | URL |
|------|------|-----|
| 添加（自动 ID） | POST | `/{index}/_doc` |
| 添加/替换（指定 ID） | PUT | `/{index}/_doc/{id}` |
| 仅创建 | POST | `/{index}/_create/{id}` |
| 按 ID 查询 | GET | `/{index}/_doc/{id}` |
| 只取 _source | GET | `/{index}/_source/{id}` |
| 判断存在 | HEAD | `/{index}/_doc/{id}` |
| 批量查询 | POST | `/{index}/_mget` |
| 部分更新 | POST | `/{index}/_update/{id}` |
| 按 ID 删除 | DELETE | `/{index}/_doc/{id}` |
| 按条件删除 | POST | `/{index}/_delete_by_query` |
| 批量操作 | POST | `/_bulk` |
