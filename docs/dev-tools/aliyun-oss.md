# Alibaba Cloud OSS 对象存储

Alibaba Cloud OSS（Object Storage Service）是阿里云提供的海量、安全、低成本、高可靠的对象存储服务。Spring Cloud Alibaba 内置了 OSS 的集成支持，可以非常方便地在 Spring Boot 2.7.x 项目中使用。

## 核心概念

| 概念 | 说明 |
|------|------|
| **Bucket** | 存储空间，用于存储 Object 的容器，全局唯一 |
| **Object** | 对象，OSS 存储的基本单元，由 Key、Data、MetaData 组成 |
| **Endpoint** | OSS 对外服务的访问域名 |
| **AccessKey** | 访问密钥，包含 AccessKeyId 和 AccessKeySecret |
| **Region** | 地域，OSS 数据中心所在的物理位置 |

## 版本兼容

| Spring Cloud Alibaba | Spring Boot | OSS SDK |
|---------------------|------------|---------|
| 2021.0.5.0 | 2.7.x | 内置于 spring-cloud-alibaba-starter |

## 创建 Bucket 并获取密钥

> 本节以阿里云控制台操作为例。

1. 登录 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket，选择地域、存储类型（标准存储）、读写权限（私有）
3. 在 [RAM 访问控制](https://ram.console.aliyun.com/) 创建 AccessKey，获取 AccessKeyId 和 AccessKeySecret

::: warning 注意
AccessKeySecret 仅在创建时显示一次，请妥善保存。生产环境建议使用 RAM 子账号 + 最小权限策略。
:::

## 快速开始

### 1. 添加 Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alicloud-oss</artifactId>
</dependency>
```

> 无需指定版本号，Spring Cloud Alibaba BOM 已统一管理。

### 2. 配置文件（application.yml）

```yaml
spring:
  cloud:
    alicloud:
      access-key: your-access-key-id
      secret-key: your-access-key-secret
      oss:
        endpoint: oss-cn-hangzhou.aliyuncs.com
        bucket: your-bucket-name
```

::: tip 生产环境安全建议
不要将 AccessKey 明文写在配置文件中，推荐使用环境变量或 [Jasypt 加密](/dev-tools/jasypt)：

```yaml
spring:
  cloud:
    alicloud:
      access-key: ${ALIBABA_CLOUD_ACCESS_KEY}
      secret-key: ${ALIBABA_CLOUD_SECRET_KEY}
```
:::

### 3. 注入并使用 OSS Client

```java
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.OSSObject;
import com.aliyun.oss.model.PutObjectResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

@Service
public class OssService {

    @Autowired
    private OSS ossClient; // Spring Cloud Alibaba 自动配置的 Bean

    /**
     * 上传文件
     */
    public String upload(String objectName, byte[] content) {
        ossClient.putObject("your-bucket-name", objectName,
                new ByteArrayInputStream(content));
        return "https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com/" + objectName;
    }

    /**
     * 下载文件
     */
    public InputStream download(String objectName) {
        OSSObject ossObject = ossClient.getObject("your-bucket-name", objectName);
        return ossObject.getObjectContent();
    }

    /**
     * 删除文件
     */
    public void delete(String objectName) {
        ossClient.deleteObject("your-bucket-name", objectName);
    }

    /**
     * 判断文件是否存在
     */
    public boolean exists(String objectName) {
        return ossClient.doesObjectExist("your-bucket-name", objectName);
    }
}
```

## 文件上传进阶

### 简单上传

```java
// 上传字符串
ossClient.putObject(bucketName, "hello.txt",
        new ByteArrayInputStream("Hello OSS".getBytes()));

// 上传本地文件
ossClient.putObject(bucketName, "images/photo.jpg",
        new File("/local/path/photo.jpg"));
```

### 带 Metadata 上传

```java
ObjectMetadata metadata = new ObjectMetadata();
metadata.setContentType("image/jpeg");
metadata.setContentDisposition("inline");
// 自定义元信息
metadata.addUserMetadata("author", "chief-fei");

PutObjectRequest request = new PutObjectRequest(
        bucketName, "images/photo.jpg",
        new File("/local/path/photo.jpg"));
request.setMetadata(metadata);

ossClient.putObject(request);
```

### 分片上传（大文件）

```java
import com.aliyun.oss.model.*;

// 初始化分片上传
InitiateMultipartUploadRequest initRequest =
        new InitiateMultipartUploadRequest(bucketName, "large-file.zip");
InitiateMultipartUploadResult initResult =
        ossClient.initiateMultipartUpload(initRequest);
String uploadId = initResult.getUploadId();

// 分片上传（每片 5MB）
final long partSize = 5 * 1024 * 1024L;
File file = new File("/local/path/large-file.zip");
long fileLength = file.length();
int partCount = (int) (fileLength / partSize) + (fileLength % partSize != 0 ? 1 : 0);

List<PartETag> partETags = new ArrayList<>();
for (int i = 0; i < partCount; i++) {
    long startPos = i * partSize;
    long curPartSize = Math.min(partSize, fileLength - startPos);

    InputStream instream = new FileInputStream(file);
    instream.skip(startPos);

    UploadPartRequest uploadPartRequest = new UploadPartRequest();
    uploadPartRequest.setBucketName(bucketName);
    uploadPartRequest.setKey("large-file.zip");
    uploadPartRequest.setUploadId(uploadId);
    uploadPartRequest.setInputStream(instream);
    uploadPartRequest.setPartSize(curPartSize);
    uploadPartRequest.setPartNumber(i + 1);

    UploadPartResult uploadPartResult = ossClient.uploadPart(uploadPartRequest);
    partETags.add(uploadPartResult.getPartETag());
}

// 完成分片上传
CompleteMultipartUploadRequest completeRequest =
        new CompleteMultipartUploadRequest(bucketName, "large-file.zip",
                uploadId, partETags);
ossClient.completeMultipartUpload(completeRequest);
```

### 断点续传（Resumable Upload）

```java
import com.aliyun.oss.model.UploadFileRequest;

// 支持断点续传，提供进度回调
UploadFileRequest uploadFileRequest = new UploadFileRequest(
        bucketName, "big-video.mp4");
uploadFileRequest.setUploadFile("/local/path/big-video.mp4");
uploadFileRequest.setTaskNum(5);   // 并发线程数
uploadFileRequest.setPartSize(10 * 1024 * 1024); // 10MB 分片
uploadFileRequest.setEnableCheckpoint(true);     // 开启断点续传

// 进度监听
uploadFileRequest.withProgressListener((bytesWritten, totalBytes, progress) ->
    System.out.printf("进度: %d/%d (%.2f%%)\n",
            bytesWritten, totalBytes, progress * 100)
);

ossClient.uploadFile(uploadFileRequest);
```

## 文件下载

### 流式下载

```java
OSSObject ossObject = ossClient.getObject(bucketName, "hello.txt");
InputStream content = ossObject.getObjectContent();
// 读取内容...
content.close();
```

### 下载到本地文件

```java
ossClient.getObject(
        new GetObjectRequest(bucketName, "photo.jpg"),
        new File("/local/path/photo.jpg")
);
```

### 范围下载（断点续传下载）

```java
GetObjectRequest getObjectRequest =
        new GetObjectRequest(bucketName, "large-file.zip");
// 只下载 0-999 字节
getObjectRequest.setRange(0, 999);
OSSObject ossObject = ossClient.getObject(getObjectRequest);
```

## 预签名 URL

预签名 URL 可以让临时用户（无需 AccessKey）在有效时间内下载或上传文件。

```java
import java.net.URL;
import java.util.Date;

// 生成下载签名 URL（1 小时有效）
Date expiration = new Date(System.currentTimeMillis() + 3600 * 1000);
URL signedUrl = ossClient.generatePresignedUrl(
        bucketName, "private-file.pdf", expiration);
System.out.println("下载链接: " + signedUrl);

// 生成上传签名 URL
GeneratePresignedUrlRequest uploadRequest =
        new GeneratePresignedUrlRequest(bucketName, "upload.jpg", HttpMethod.PUT);
uploadRequest.setExpiration(expiration);
uploadRequest.setContentType("image/jpeg");
URL uploadUrl = ossClient.generatePresignedUrl(uploadRequest);
```

## 文件管理

### 列举文件

```java
// 列举所有文件
ObjectListing objectListing = ossClient.listObjects(bucketName);
for (OSSObjectSummary summary : objectListing.getObjectSummaries()) {
    System.out.printf("%s - %d bytes - %s\n",
            summary.getKey(), summary.getSize(), summary.getLastModified());
}

// 按前缀列举（模拟文件夹）
ListObjectsRequest listRequest = new ListObjectsRequest(bucketName);
listRequest.setPrefix("images/2024/");
listRequest.setMaxKeys(100);
ObjectListing listing = ossClient.listObjects(listRequest);
```

### 拷贝文件

```java
// 同 Bucket 内复制
ossClient.copyObject(bucketName, "source.jpg",
        bucketName, "backup/source.jpg");
```

### 设置文件访问权限

```java
// 设置为公共读
ossClient.setObjectAcl(bucketName, "public-file.jpg", CannedAccessControlList.PublicRead);

// 设置为私有
ossClient.setObjectAcl(bucketName, "private-file.pdf", CannedAccessControlList.Private);
```

## Spring Boot 2.7.x 完整集成示例

### 配置类

```java
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OssConfig {

    @Value("${spring.cloud.alicloud.access-key}")
    private String accessKeyId;

    @Value("${spring.cloud.alicloud.secret-key}")
    private String accessKeySecret;

    @Value("${spring.cloud.alicloud.oss.endpoint}")
    private String endpoint;

    @Bean(destroyMethod = "shutdown")
    public OSS ossClient() {
        return new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
    }
}
```

### 工具类封装

```java
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.PutObjectResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OssUtils {

    private final OSS ossClient;

    @Value("${spring.cloud.alicloud.oss.bucket}")
    private String bucketName;

    @Value("${spring.cloud.alicloud.oss.endpoint}")
    private String endpoint;

    /**
     * 上传文件并返回访问 URL
     */
    public String upload(MultipartFile file, String dir) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
        String objectName = dir + "/" + UUID.randomUUID() + extension;

        ossClient.putObject(bucketName, objectName, file.getInputStream());
        return "https://" + bucketName + "." + endpoint + "/" + objectName;
    }

    /**
     * 生成带签名的临时访问 URL
     */
    public String generatePresignedUrl(String objectName, long expireSeconds) {
        Date expiration = new Date(System.currentTimeMillis() + expireSeconds * 1000);
        URL url = ossClient.generatePresignedUrl(bucketName, objectName, expiration);
        return url.toString();
    }

    /**
     * 删除文件
     */
    public void delete(String objectName) {
        ossClient.deleteObject(bucketName, objectName);
        log.info("已删除 OSS 文件: {}", objectName);
    }
}
```

### Controller 示例

```java
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/oss")
@RequiredArgsConstructor
public class OssController {

    private final OssUtils ossUtils;

    /**
     * 上传文件
     */
    @PostMapping("/upload")
    public ResponseEntity<String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        String url = ossUtils.upload(file, "uploads");
        return ResponseEntity.ok(url);
    }

    /**
     * 获取临时访问链接
     */
    @GetMapping("/presigned-url")
    public ResponseEntity<String> presignedUrl(@RequestParam String objectName) {
        String url = ossUtils.generatePresignedUrl(objectName, 3600); // 1 小时
        return ResponseEntity.ok(url);
    }

    /**
     * 删除文件
     */
    @DeleteMapping("/delete")
    public ResponseEntity<String> delete(@RequestParam String objectName) {
        ossUtils.delete(objectName);
        return ResponseEntity.ok("删除成功");
    }
}
```

## Bucket 策略与安全

### 通过 Bucket Policy 控制访问

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": ["*"],
      "Action": ["oss:GetObject"],
      "Resource": ["acs:oss:*:your-bucket:public/*"],
      "Condition": {
        "IpAddress": {
          "acs:SourceIp": ["192.168.0.0/16"]
        }
      }
    }
  ]
}
```

### 防盗链设置（Referer 白名单）

在 OSS 控制台 → Bucket → 数据安全 → 防盗链 中配置允许的 Referer 白名单。

## 常见问题

### 1. 上传权限不足

```
com.aliyun.oss.OSSException: AccessDenied
```

**解决方案**：检查 AccessKey 是否有对应 Bucket 的读写权限，建议使用 RAM 子账号并授权 `AliyunOSSFullAccess` 或自定义权限策略。

### 2. Endpoint 配置错误

确保 endpoint 格式为 `oss-cn-hangzhou.aliyuncs.com`（不包含 `https://` 和 Bucket 名称）。

### 3. 大文件上传 OOM

使用分片上传或断点续传替代简单上传，避免将整个文件读入内存。

### 4. 跨域（CORS）问题

在 OSS 控制台 → Bucket → 数据安全 → 跨域设置 中配置：

| 参数 | 值 |
|------|-----|
| 来源 | `*` 或具体域名 |
| Allow Methods | GET, PUT, POST, DELETE |
| Allow Headers | `*` |
| Expose Headers | ETag |

## 费用优化建议

- 不常访问的文件使用**低频访问存储**或**归档存储**
- 设置**生命周期规则**自动删除过期文件或转换存储类型
- 启用 **CDN 加速**，减少 OSS 直接请求费用
- 上传前对图片进行压缩，减小存储和流量成本

## 相关文档

- [Maven 依赖管理](/dev-tools/maven) - 统一管理项目依赖
- [Jasypt 配置加密](/dev-tools/jasypt) - 加密 AccessKey 等敏感配置

> 本文档基于 **Spring Cloud Alibaba 2021.0.5.0** + **Spring Boot 2.7.x** + **aliyun-oss-spring-boot-starter** 编写。