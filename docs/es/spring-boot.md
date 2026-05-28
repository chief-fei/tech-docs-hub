# Spring Boot 集成 Elasticsearch

Spring Boot 2.x 使用 `RestHighLevelClient` 和 `ElasticsearchRestTemplate`（实现 `ElasticsearchOperations` 接口）。

## Maven 依赖

```xml
<!-- Spring Boot 2.7.x 内置 spring-data-elasticsearch 4.4.x -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

## application.yml

```yaml
spring:
  elasticsearch:
    rest:
      uris: http://localhost:9200
      username: elastic
      password: your_password
      connection-timeout: 5s
      read-timeout: 30s
```

## 实体类

```java
@Document(indexName = "products")
@Data
public class ProductDoc {
    @Id
    private Long id;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String name;

    @Field(type = FieldType.Keyword)
    private String brand;

    @Field(type = FieldType.Double)
    private Double price;

    @Field(type = FieldType.Integer)
    private Integer stock;

    @Field(type = FieldType.Keyword)
    private String status;

    @Field(type = FieldType.Date,
           format = DateFormat.custom,
           pattern = "yyyy-MM-dd HH:mm:ss")
    private String createdAt;
}
```

## 一、ElasticsearchRestTemplate — 索引操作

索引操作通过 `IndexOperations` 接口完成：

```java
@Autowired
private ElasticsearchRestTemplate restTemplate;

// 基于实体类获取（推荐，自动识别 @Document 的 indexName）
IndexOperations indexOps = restTemplate.indexOps(ProductDoc.class);

// 基于索引名字符串获取
IndexOperations indexOps = restTemplate.indexOps(IndexCoordinates.of("products"));
```

### 1.1 创建索引

#### 创建空索引

```java
boolean created = indexOps.create();  // 仅创建索引，不含 Mapping
```

#### createWithMapping() — 创建索引 + Mapping 一步完成 <Badge type="tip" text="推荐" />

```java
IndexOperations indexOps = restTemplate.indexOps(ProductDoc.class);
// createWithMapping() 一次完成：create index + put mapping（基于 @Field 注解）
indexOps.createWithMapping();
```

#### create(Settings) — 含分片/副本配置

```java
Settings settings = Settings.builder()
    .put("index.number_of_shards", 3)
    .put("index.number_of_replicas", 1)
    .build();
indexOps.create(settings);
```

#### create(Settings, Document) — Settings + Mapping 完整控制

```java
Settings settings = Settings.builder()
    .put("index.number_of_shards", 3)
    .put("index.number_of_replicas", 1)
    .build();
Document mapping = indexOps.createMapping(ProductDoc.class);
indexOps.create(settings, mapping);
```

#### 推荐：创建前判断是否已存在

```java
IndexOperations indexOps = restTemplate.indexOps(ProductDoc.class);
if (!indexOps.exists()) {
    indexOps.createWithMapping();  // 不存在则创建
}
```

### 1.2 查看索引

```java
// 判断索引是否存在
boolean exists = indexOps.exists();

// 获取 Settings
Settings settings = indexOps.getSettings();
String shards = settings.get("index.number_of_shards");

// 获取 Mapping
Map<String, Object> mapping = indexOps.getMapping();

// 获取索引名
String indexName = indexOps.getIndexCoordinates().getIndexName();
```

### 1.3 修改索引 — 追加字段

已存在的字段类型**不可修改**，只能追加新字段：

```java
// 追加新字段
Document newMapping = Document.create();
Map<String, Object> props = new HashMap<>();
props.put("properties", Collections.singletonMap("description",
    Collections.singletonMap("type", "text")));
props.put("tags", Collections.singletonMap("type", "keyword"));
newMapping.putAll(props);

indexOps.putMapping(newMapping);
```

如需修改已有字段 → 必须 **Reindex**：

```java
// 1. 创建新索引
IndexOperations newOps = restTemplate.indexOps(IndexCoordinates.of("products_v2"));
newOps.create(correctMapping);

// 2. 查询旧数据写入新索引
SearchHits<ProductDoc> hits = restTemplate.search(
    new NativeSearchQueryBuilder()
        .withQuery(QueryBuilders.matchAllQuery())
        .withPageable(PageRequest.of(0, 10000))
        .build(),
    ProductDoc.class);

List<ProductDoc> newDocs = hits.getSearchHits().stream()
    .map(h -> convertToV2(h.getContent()))
    .collect(Collectors.toList());
restTemplate.save(newDocs, IndexCoordinates.of("products_v2"));

// 3. 删除旧索引
oldIndexOps.delete();
```

### 1.4 删除索引

```java
// 删除索引（不可恢复）
boolean deleted = indexOps.delete();

// 按名称删除
restTemplate.indexOps(IndexCoordinates.of("products")).delete();
```

### 1.5 刷新索引

```java
// 手动刷新，使新写入文档立即可搜索
indexOps.refresh();
```

---

## 二、ElasticsearchRestTemplate — 文档 CRUD

```java
@Autowired
private ElasticsearchRestTemplate restTemplate;
```

### 2.1 添加/替换文档 — save

```java
ProductDoc doc = new ProductDoc();
doc.setId(1001L);
doc.setName("iPhone 15");
doc.setPrice(6999.0);

// 单条保存：ID 不存在则插入，存在则全量替换
ProductDoc saved = restTemplate.save(doc);
// 返回值：保存后的对象（含 _id 和 _version）

// 保存到指定索引
restTemplate.save(doc, IndexCoordinates.of("products"));

// 批量保存
Iterable<ProductDoc> savedList = restTemplate.save(Arrays.asList(doc1, doc2, doc3));

// 批量保存到指定索引
restTemplate.save(docs, IndexCoordinates.of("products"));
```

### 2.2 查询文档

#### get() — 按 ID 查询单条

```java
ProductDoc product = restTemplate.get("1001", ProductDoc.class);
// 参数：id（String），clazz（目标类型）
// 返回值：文档对象，不存在返回 null
```

#### get + 指定索引

```java
restTemplate.get("1001", ProductDoc.class, IndexCoordinates.of("products"));
```

#### multiGet() — 批量按 ID 查询 <Badge type="tip" text="Context7 校正" />

`multiGet` 是 `ElasticsearchOperations` 接口的方法，返回 `List<MultiGetItem<T>>`，每个 `MultiGetItem` 包含成功/失败信息：

```java
List<String> ids = Arrays.asList("1001", "1002", "1003", "9999");

// multiGet(Query query, Class<T> clazz, IndexCoordinates index)
NativeSearchQuery query = new NativeSearchQueryBuilder()
    .withIds(ids)
    .build();

List<MultiGetItem<ProductDoc>> items = restTemplate.multiGet(
    query, ProductDoc.class, IndexCoordinates.of("products"));

// MultiGetItem 包含成功/失败信息
List<ProductDoc> docs = new ArrayList<>();
for (MultiGetItem<ProductDoc> item : items) {
    if (item.isFailed()) {
        // 此 ID 获取失败（如索引不存在）
        System.out.println("ID " + item.getFailure().getId() + " 获取失败");
    } else if (item.isFound()) {
        // 获取成功
        docs.add(item.getItem());
    } else {
        // 获取成功但文档不存在
        System.out.println("ID " + ids.get(i) + " 不存在");
    }
}
```

MultiGetItem 方法：
| 方法 | 说明 |
|------|------|
| `isFailed()` | 获取操作是否失败（索引不存在等） |
| `isFound()` | 文档是否存在 |
| `getItem()` | 获取文档内容（仅 isFound() 为 true 时有效） |
| `getFailure()` | 获取失败信息（含 ID、错误原因） |
| `getFailure().getId()` | 失败的文档 ID |

#### search() — 查询全部文档

```java
NativeSearchQuery query = new NativeSearchQueryBuilder()
    .withQuery(QueryBuilders.matchAllQuery())
    .withPageable(PageRequest.of(0, 20))
    .build();

SearchHits<ProductDoc> hits = restTemplate.search(query, ProductDoc.class);
long total = hits.getTotalHits();                             // 总数
List<ProductDoc> list = hits.getSearchHits().stream()
    .map(SearchHit::getContent)
    .collect(Collectors.toList());
```

### 2.3 更新文档

#### 全量替换 save

```java
// 先查后改再 save
ProductDoc doc = restTemplate.get("1001", ProductDoc.class);
doc.setPrice(5999.0);
restTemplate.save(doc);  // 全量替换
```

#### UpdateQuery 部分更新

```java
// 仅更新指定字段，其他字段不变
UpdateQuery updateQuery = UpdateQuery.builder("1001")
    .withDocument(Document.parse("{\"price\": 5999.0, \"stock\": 45}"))
    .build();

UpdateResponse resp = restTemplate.update(updateQuery,
    IndexCoordinates.of("products"));
// resp.getResult() → Updated / NotFound
```

#### Script 更新

```java
// 库存递增
Map<String, Object> params = new HashMap<>();
params.put("count", 10);

UpdateQuery updateQuery = UpdateQuery.builder("1001")
    .withScript("ctx._source.stock += params.count")
    .withLang("painless")
    .withParams(params)
    .build();

restTemplate.update(updateQuery, IndexCoordinates.of("products"));
```

### 2.4 删除文档

#### 按 ID 删除 <Badge type="tip" text="Context7 校正" />

```java
// delete(String id, IndexCoordinates index)
String result = restTemplate.delete("1001", IndexCoordinates.of("products"));
// 返回值：已删除的文档 ID

// delete(String id, Class<?> clazz) — 通过实体类确定索引
String result = restTemplate.delete("1001", ProductDoc.class);
```

#### 按实体对象删除

```java
ProductDoc doc = restTemplate.get("1001", ProductDoc.class, IndexCoordinates.of("products"));
String result = restTemplate.delete(doc);
// 通过实体对象的 @Document 注解确定索引
```

#### 按条件批量删除 <Badge type="tip" text="Context7 校正" />

```java
// 方式 1：restTemplate.delete(DeleteQuery, Class, IndexCoordinates)
DeleteQuery deleteQuery = new DeleteQuery();
deleteQuery.setQuery(new TermQueryBuilder("status", "offline"));
restTemplate.delete(deleteQuery, ProductDoc.class, IndexCoordinates.of("products"));

// 方式 2：RestHighLevelClient（返回删除计数）
@Autowired
private RestHighLevelClient client;
DeleteByQueryRequest request = new DeleteByQueryRequest("products");
request.setQuery(QueryBuilders.termQuery("status", "offline"));
BulkByScrollResponse resp = client.deleteByQuery(request, RequestOptions.DEFAULT);
long deleted = resp.getDeleted();
```

#### 批量按 ID 删除

```java
List<String> ids = Arrays.asList("1001", "1002", "1003");
for (String id : ids) {
    restTemplate.delete(id, ProductDoc.class);
}
```

### 2.5 批量操作 <Badge type="tip" text="Context7 校正" />

`ElasticsearchOperations` 提供 `bulkIndex()` 和 `bulkUpdate()` 方法，比 `BulkOperations` 更直接。

#### bulkIndex() — 批量索引

```java
// bulkIndex(List<IndexQuery>, IndexCoordinates) → List<String>
// 返回每个文档的 ID
List<IndexQuery> queries = new ArrayList<>();
queries.add(new IndexQueryBuilder()
    .withId("2001").withObject(doc1).build());
queries.add(new IndexQueryBuilder()
    .withId("2002").withObject(doc2).build());
queries.add(new IndexQueryBuilder()
    .withId("2003").withObject(doc3).build());

List<String> ids = restTemplate.bulkIndex(queries, IndexCoordinates.of("products"));

// 带 BulkOptions 的重载
List<String> ids = restTemplate.bulkIndex(queries,
    BulkOptions.defaultOptions(), IndexCoordinates.of("products"));
```

#### bulkIndex() 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `queries` | `List<IndexQuery>` | 要索引的文档列表 |
| `bulkOptions` | `BulkOptions` | 可选，默认 `BulkOptions.defaultOptions()` |
| `index` | `IndexCoordinates` | 目标索引 |
| **返回值** | `List<String>` | 每个文档的 ID |

#### bulkUpdate() — 批量更新

```java
List<UpdateQuery> updates = new ArrayList<>();
updates.add(UpdateQuery.builder("1001")
    .withDocument(Document.parse("{\"price\": 5999.0}"))
    .build());
updates.add(UpdateQuery.builder("1002")
    .withDocument(Document.parse("{\"stock\": 99}"))
    .build());

restTemplate.bulkUpdate(updates, IndexCoordinates.of("products"));
```

#### index() — 单条索引（精确控制）

```java
// index(IndexQuery, IndexCoordinates) → String
// 返回文档 ID
IndexQuery indexQuery = new IndexQueryBuilder()
    .withId("3001")
    .withObject(doc)
    .build();

String docId = restTemplate.index(indexQuery, IndexCoordinates.of("products"));
```

#### BulkOperations（可选，混合操作时使用）<Badge type="tip" text="Context7 校正" />

仅在需要一次请求混合 index + update + delete 时使用：

```java
BulkOperations bulkOps = restTemplate.bulkOps(
    BulkOptions.defaultOptions(),
    ProductDoc.class,
    IndexCoordinates.of("products")
);

// 索引
IndexQuery iq = new IndexQueryBuilder().withId("2001").withObject(doc1).build();
bulkOps.index(iq);

// 更新
UpdateQuery uq = UpdateQuery.builder("1001")
    .withDocument(Document.parse("{\"price\": 5999.0}"))
    .build();
bulkOps.update(uq);

// 删除（传 String id 或 DeleteQuery）
bulkOps.delete("1003");

// 执行
bulkOps.execute();
restTemplate.indexOps(IndexCoordinates.of("products")).refresh();
```

BulkOperations 方法：
| 方法 | 参数类型 | 说明 |
|------|---------|------|
| `index(IndexQuery)` | `IndexQuery` | 单条索引 |
| `index(List<IndexQuery>)` | `List<IndexQuery>` | 批量索引 |
| `update(UpdateQuery)` | `UpdateQuery` | 单条更新 |
| `update(List<UpdateQuery>)` | `List<UpdateQuery>` | 批量更新 |
| `delete(String)` | `String` | 按 ID 删除 |
| `delete(DeleteQuery)` | `DeleteQuery` | 按条件删除 |
| `execute()` | — | 执行所有操作 |

### 2.6 完整 Service 封装示例 <Badge type="tip" text="Context7 校正" />

```java
@Service
public class ProductEsService {

    @Autowired
    private ElasticsearchRestTemplate restTemplate;

    private IndexCoordinates index() {
        return IndexCoordinates.of("products");
    }

    public ProductDoc save(ProductDoc doc) {
        return restTemplate.save(doc, index());
    }

    public void saveBatch(List<ProductDoc> docs) {
        restTemplate.save(docs, index());
    }

    public ProductDoc getById(String id) {
        return restTemplate.get(id, ProductDoc.class, index());
    }

    public List<ProductDoc> getByIds(List<String> ids) {
        NativeSearchQuery query = new NativeSearchQueryBuilder()
            .withIds(ids)
            .build();
        List<MultiGetItem<ProductDoc>> items = restTemplate.multiGet(
            query, ProductDoc.class, index());

        List<ProductDoc> result = new ArrayList<>();
        for (MultiGetItem<ProductDoc> item : items) {
            if (item.isFound()) {
                result.add(item.getItem());
            }
        }
        return result;
    }

    public List<ProductDoc> findAll() {
        SearchHits<ProductDoc> hits = restTemplate.search(
            new NativeSearchQueryBuilder()
                .withQuery(QueryBuilders.matchAllQuery())
                .withPageable(PageRequest.of(0, 10000))
                .build(),
            ProductDoc.class, index());
        return hits.getSearchHits().stream()
            .map(SearchHit::getContent)
            .collect(Collectors.toList());
    }

    public void updatePrice(String id, Double newPrice) {
        UpdateQuery uq = UpdateQuery.builder(id)
            .withDocument(Document.parse("{\"price\":" + newPrice + "}"))
            .build();
        restTemplate.update(uq, index());
    }

    public void incrementStock(String id, int delta) {
        UpdateQuery uq = UpdateQuery.builder(id)
            .withScript("ctx._source.stock += params.count")
            .withParams(Collections.singletonMap("count", delta))
            .build();
        restTemplate.update(uq, index());
    }

    public String deleteById(String id) {
        return restTemplate.delete(id, index());
    }

    public void refresh() {
        restTemplate.indexOps(index()).refresh();
    }
}
```

---

## 三、NativeSearchQuery — 核心搜索

`NativeSearchQuery` + `QueryBuilders` 是 Spring Boot 2.x 的标准查询方式。

### 查询全部 + 分页

```java
NativeSearchQuery query = new NativeSearchQueryBuilder()
    .withQuery(QueryBuilders.matchAllQuery())
    .withPageable(PageRequest.of(0, 20))   // 第 0 页，20 条
    .build();

SearchHits<ProductDoc> hits = restTemplate.search(query, ProductDoc.class);

long totalHits = hits.getTotalHits();                       // 总命中数
List<ProductDoc> list = hits.getSearchHits().stream()       // 结果列表
    .map(SearchHit::getContent)
    .collect(Collectors.toList());
```

### Term Query（精确匹配 keyword）

```java
QueryBuilders.termQuery("brand", "Apple")                // field + value
```

参数：`field`（keyword 字段名）、`value`（精确值）

### Terms Query（多值匹配）

```java
QueryBuilders.termsQuery("brand", "Apple", "华为", "三星")
```

### Match Query（全文搜索 text）

```java
QueryBuilders.matchQuery("name", "苹果手机")              // field + 搜索词
```

参数：`field`（text 字段）、`text`（搜索词）、`operator`（AND/OR）、`minimumShouldMatch`

### MultiMatch Query（多字段搜索）

```java
QueryBuilders.multiMatchQuery("苹果", "name", "description", "brand")
    .type(MultiMatchQueryBuilder.Type.BEST_FIELDS);
// BEST_FIELDS / MOST_FIELDS / CROSS_FIELDS / PHRASE
```

### Bool Query（组合查询）

```java
BoolQueryBuilder boolQuery = QueryBuilders.boolQuery()
    .must(QueryBuilders.termQuery("status", "online"))            // AND → 评分
    .must(QueryBuilders.matchQuery("name", "手机"))
    .filter(QueryBuilders.rangeQuery("price").gte(1000).lte(10000)) // AND → 无评分
    .mustNot(QueryBuilders.termQuery("brand", "山寨"))            // NOT
    .should(QueryBuilders.termQuery("brand", "Apple"))            // OR → 评分
    .should(QueryBuilders.termQuery("brand", "华为"))
    .minimumShouldMatch(1);

NativeSearchQuery query = new NativeSearchQueryBuilder()
    .withQuery(boolQuery)
    .build();
```

Bool 子句含义：
| 子句 | 逻辑 | 影响评分 |
|------|:--:|:--:|
| `must` | 必须满足（AND） | ✅ |
| `filter` | 必须满足，可缓存 | ❌ |
| `mustNot` | 必须不满足（NOT） | ❌ |
| `should` | 至少满足 minimumShouldMatch 个 | ✅ |

### Range Query（范围）

```java
QueryBuilders.rangeQuery("price")
    .gte(1000)     // >=
    .gt(1000)      // >
    .lte(10000)    // <=
    .lt(10000)     // <
```

### 排序

```java
new NativeSearchQueryBuilder()
    .withSort(SortBuilders.fieldSort("price").order(SortOrder.ASC))
    .withSort(SortBuilders.fieldSort("createdAt").order(SortOrder.DESC))
```

### 高亮

```java
HighlightBuilder highlightBuilder = new HighlightBuilder()
    .field("name").preTags("<em>").postTags("</em>");

NativeSearchQuery query = new NativeSearchQueryBuilder()
    .withQuery(QueryBuilders.matchQuery("name", "手机"))
    .withHighlightBuilder(highlightBuilder)
    .build();

SearchHits<ProductDoc> hits = restTemplate.search(query, ProductDoc.class);
for (SearchHit<ProductDoc> hit : hits.getSearchHits()) {
    List<String> highlights = hit.getHighlightField("name");
}
```

### 聚合

```java
NativeSearchQuery query = new NativeSearchQueryBuilder()
    .withQuery(QueryBuilders.matchAllQuery())
    .addAggregation(AggregationBuilders.terms("brand_count").field("brand").size(10))
    .addAggregation(AggregationBuilders.avg("avg_price").field("price"))
    .build();

SearchHits<ProductDoc> hits = restTemplate.search(query, ProductDoc.class);
Aggregations aggs = hits.getAggregations();
ParsedStringTerms brandAgg = aggs.get("brand_count");     // Terms 聚合结果
ParsedAvg avgPrice = aggs.get("avg_price");               // Avg 聚合结果
```

---

## 四、ElasticsearchRepository（Spring Data 风格）

```java
@Repository
public interface ProductRepo extends ElasticsearchRepository<ProductDoc, Long> {

    List<ProductDoc> findByBrand(String brand);
    List<ProductDoc> findByNameContaining(String keyword);
    List<ProductDoc> findByPriceBetween(Double min, Double max);
    Page<ProductDoc> findByBrand(String brand, Pageable pageable);
}

// CRUD
@Autowired
private ProductRepo repo;

repo.save(doc);                           // 保存/更新
repo.findById(1001L);                     // Optional<ProductDoc>
repo.findAll();                           // Iterable
repo.findAll(PageRequest.of(0, 20));      // 分页
repo.deleteById(1001L);                   // 删除
repo.count();                             // 总数
```

---

## 五、RestHighLevelClient（原生客户端）

```java
@Autowired
private RestHighLevelClient client;

// 创建索引
CreateIndexRequest request = new CreateIndexRequest("products");
client.indices().create(request, RequestOptions.DEFAULT);

// 索引是否存在
client.indices().exists(new GetIndexRequest("products"), RequestOptions.DEFAULT);

// 按 ID 添加/替换文档
IndexRequest indexReq = new IndexRequest("products").id("1001")
    .source(XContentFactory.jsonBuilder()
        .startObject()
        .field("name", "iPhone 15")
        .field("price", 6999)
        .endObject());
client.index(indexReq, RequestOptions.DEFAULT);

// 按 ID 查询
GetResponse getResp = client.get(
    new GetRequest("products", "1001"), RequestOptions.DEFAULT);
String json = getResp.getSourceAsString();

// 搜索
SearchRequest searchReq = new SearchRequest("products");
SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
sourceBuilder.query(QueryBuilders.matchQuery("name", "手机"));
sourceBuilder.from(0).size(20);
searchReq.source(sourceBuilder);
SearchResponse searchResp = client.search(searchReq, RequestOptions.DEFAULT);
```

---

## 方法速查表

| 场景 | 类/方法 | 关键参数 |
|------|--------|---------|
| 创建索引+Mapping | `indexOps.createWithMapping()` | 自动基于 @Field 注解 |
| 创建索引+Settings | `indexOps.create(Settings)` | shards, replicas |
| 索引是否存在 | `indexOps.exists()` | — |
| 删除索引 | `indexOps.delete()` | — |
| 刷新索引 | `indexOps.refresh()` | — |
| 保存 | `restTemplate.save()` | 实体对象 |
| 按 ID 查 | `restTemplate.get()` | id, class, IndexCoordinates |
| 批量按 ID 查 | `restTemplate.multiGet()` | Query, class, IndexCoordinates |
| 按 ID 删 | `restTemplate.delete()` | id, IndexCoordinates / id, class |
| 条件删除 | `restTemplate.delete(DeleteQuery, class, index)` | DeleteQuery |
| 单条索引 | `restTemplate.index()` | IndexQuery, IndexCoordinates |
| 批量索引 | `restTemplate.bulkIndex()` | List\<IndexQuery\>, IndexCoordinates |
| 批量更新 | `restTemplate.bulkUpdate()` | List\<UpdateQuery\>, IndexCoordinates |
| 部分更新 | `restTemplate.update()` | UpdateQuery, IndexCoordinates |
| 搜索 | `NativeSearchQueryBuilder` + `search()` | query, pageable, sort |
| Term 查询 | `QueryBuilders.termQuery()` | field, value |
| Match 查询 | `QueryBuilders.matchQuery()` | field, text |
| Bool 查询 | `QueryBuilders.boolQuery()` | must, filter, should, mustNot |
| Range | `QueryBuilders.rangeQuery()` | gte, gt, lte, lt |
| 分页 | `PageRequest.of()` | page, size |
| 排序 | `SortBuilders.fieldSort()` | field, order |
| 高亮 | `HighlightBuilder` | field, preTags, postTags |
| 聚合 | `AggregationBuilders` | terms, avg, sum |
| Repository | `ElasticsearchRepository` | save, find, delete |
| 原生客户端 | `RestHighLevelClient` | index, get, search |
