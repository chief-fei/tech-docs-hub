# Nacos 使用指南

Nacos 是阿里巴巴开源的服务注册、发现和配置管理平台。

> 如需查看配置中心详细文档（含 Docker 部署、版本对应、完整示例和故障排查），请参见 [配置中心详解](./config.md)。

## 一、服务注册与发现

### Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>
```

### application.yml

```yaml
spring:
  application:
    name: order-service         # 注册到 Nacos 的服务名
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
        namespace: dev           # 命名空间 ID（多环境隔离）
        group: DEFAULT_GROUP
        ephemeral: true          # true=临时实例, false=持久化
        weight: 1                # 权重 1-100
```

### 启动类

```java
@EnableDiscoveryClient
@SpringBootApplication
public class OrderApplication { }
```

### 服务调用

```java
@Bean
@LoadBalanced
public RestTemplate restTemplate() {
    return new RestTemplate();
}

// 使用服务名代替 IP
restTemplate.getForObject("http://order-service/api/orders", String.class);
```

### 常用参数

| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `server-addr` | Nacos 地址 | `127.0.0.1:8848` |
| `namespace` | 命名空间 | public |
| `group` | 服务分组 | DEFAULT_GROUP |
| `cluster-name` | 集群名 | DEFAULT |
| `ephemeral` | 临时实例（宕机自动剔除） | true |
| `weight` | 实例权重 | 1 |
| `register-enabled` | 是否注册 | true |
| `watch.enabled` | 是否监听服务变更 | true |

---

## 二、配置中心

### Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-bootstrap</artifactId>
</dependency>
```

### bootstrap.yml

```yaml
spring:
  application:
    name: order-service
  cloud:
    nacos:
      config:
        server-addr: 127.0.0.1:8848
        namespace: dev
        group: DEFAULT_GROUP
        file-extension: yaml
        refresh-enabled: true
        shared-configs:                    # 共享配置
          - data-id: common.yaml
            group: DEFAULT_GROUP
            refresh: true
        extension-configs:                 # 扩展配置（优先级最高）
          - data-id: db.yaml
            group: DATABASE
            refresh: true
```

### 配置优先级（从高到低）

```text
1. extension-configs（扩展配置）
2. shared-configs（共享配置）
3. ${service}-${profile}.${ext}
4. ${service}.${ext}
5. 本地 application.yml
```

### @RefreshScope 动态刷新

```java
@RefreshScope
@RestController
public class ConfigController {
    @Value("${app.title:默认}")
    private String title;

    @GetMapping("/title")
    public String get() { return title; }
}
```

修改 Nacos 配置后无需重启。

### 配置参数

| 参数 | 说明 | 默认值 |
|------|------|:--:|
| `server-addr` | Nacos 地址 | `127.0.0.1:8848` |
| `file-extension` | 配置格式 | properties |
| `refresh-enabled` | 动态刷新 | true |
| `timeout` | 拉取超时 ms | 3000 |

---

## 三、多环境隔离

```yaml
# --- bootstrap-dev.yml ---
spring:
  cloud:
    nacos:
      config:
        namespace: dev-xxxx-xxxx
```

在 Nacos 创建 `order-service.yaml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/order_db
    username: root
    password: ${DB_PASSWORD:root}
```
