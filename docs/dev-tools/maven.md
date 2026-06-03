# Maven 3.8.x 完全指南

## 概述

Maven 是 Apache 旗下的项目构建与依赖管理工具，通过 POM（Project Object Model）文件描述项目结构、依赖关系和构建流程。

> **兼容性**：Maven 3.8.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

---

## 一、安装与配置

### 1.1 下载安装

```bash
# macOS
brew install maven@3.8

# 验证
mvn --version
```

### 1.2 settings.xml 位置

| 级别 | 路径 | 说明 |
|------|------|------|
| 全局 | `${M2_HOME}/conf/settings.xml` | 对所有用户生效 |
| 用户 | `~/.m2/settings.xml` | 对当前用户生效（推荐） |

---

## 二、核心概念

### 2.1 生命周期（Lifecycle）

Maven 定义了三个标准生命周期，每个生命周期包含多个阶段（phase）：

| 生命周期 | 说明 | 核心阶段 |
|---------|------|---------|
| **clean** | 清理项目 | pre-clean → clean → post-clean |
| **default** | 构建项目 | validate → compile → test → package → verify → install → deploy |
| **site** | 生成项目站点 | pre-site → site → post-site → site-deploy |

### 2.2 阶段（Phase）与插件（Plugin）

每个阶段由插件目标（Goal）来完成。一个阶段可以绑定多个 Goal。

```text
Lifecycle:  default
  └── Phase: compile   →  maven-compiler-plugin:compile (Goal)
  └── Phase: test      →  maven-surefire-plugin:test (Goal)
  └── Phase: package   →  maven-jar-plugin:jar (Goal)
  └── Phase: install   →  maven-install-plugin:install (Goal)
```

### 2.3 坐标（GAV）

Maven 通过坐标唯一标识一个构件：

```xml
<groupId>com.example</groupId>        <!-- 组织/公司标识 -->
<artifactId>demo-app</artifactId>      <!-- 项目/模块名 -->
<version>1.0.0</version>              <!-- 版本号 -->
<packaging>jar</packaging>            <!-- 打包类型：jar / war / pom -->
```

---

## 三、依赖管理

### 3.1 依赖范围（scope）

| scope | 编译 | 测试 | 运行 | 打包 | 说明 |
|-------|------|------|------|------|------|
| `compile` | ✅ | ✅ | ✅ | ✅ | 默认，所有阶段可用 |
| `provided` | ✅ | ✅ | ❌ | ❌ | 运行时由容器提供（如 Servlet API） |
| `runtime` | ❌ | ✅ | ✅ | ✅ | 编译不需要，运行时需要（如 JDBC 驱动） |
| `test` | ❌ | ✅ | ❌ | ❌ | 仅测试阶段可用（如 JUnit） |
| `system` | ✅ | ✅ | ❌ | ❌ | 与 provided 类似，需指定本地路径（不推荐） |
| `import` | — | — | — | — | 导入 POM 依赖管理（仅用于 dependencyManagement） |

```xml
<!-- scope 示例 -->
<dependencies>
    <!-- 默认 scope=compile -->
    <dependency>
        <groupId>cn.hutool</groupId>
        <artifactId>hutool-all</artifactId>
        <version>5.8.44</version>
    </dependency>

    <!-- 编译时需要，运行时由 Tomcat 提供 -->
    <dependency>
        <groupId>javax.servlet</groupId>
        <artifactId>javax.servlet-api</artifactId>
        <version>4.0.1</version>
        <scope>provided</scope>
    </dependency>

    <!-- 测试时使用 -->
    <dependency>
        <groupId>junit</groupId>
        <artifactId>junit</artifactId>
        <version>4.13.2</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### 3.2 依赖传递

Maven 自动解析传递性依赖，但存在冲突时需要处理：

```text
项目 A
  ├── 依赖 B (v1.0) → 依赖 C (v1.0)
  └── 依赖 D (v2.0) → 依赖 C (v2.0)

冲突：C 存在两个版本

Maven 解决策略：
1. 最短路径优先：直接依赖 → 间接依赖
2. 路径相同，先声明优先：POM 中先声明的版本生效
```

### 3.3 dependencyManagement vs dependencies

| 标签 | 位置 | 作用 |
|------|------|------|
| `dependencies` | 任意 POM | 直接引入依赖，子模块自动继承 |
| `dependencyManagement` | 父 POM | 声明依赖版本，子模块引入时无需写版本号 |

```xml
<!-- 父 POM：声明版本 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>fastjson</artifactId>
            <version>2.0.47</version>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 子模块：使用父 POM 声明的版本，无需写版本号 -->
<dependencies>
    <dependency>
        <groupId>com.alibaba</groupId>
        <artifactId>fastjson</artifactId>
    </dependency>
</dependencies>
```

### 3.4 BOM（Bill of Materials）

BOM 是专门管理依赖版本的特殊 POM，通过 `scope=import` 引入：

```xml
<dependencyManagement>
    <dependencies>
        <!-- Spring Boot BOM -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>2.7.18</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>

        <!-- Spring Cloud BOM -->
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2021.0.9</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### 3.5 依赖排除

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <!-- 排除内嵌的 Tomcat，换成 Undertow -->
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

### 3.6 可选依赖

```xml
<!-- 声明为可选依赖，子模块默认不继承 -->
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
    <version>8.0.33</version>
    <optional>true</optional>
</dependency>
```

---

## 四、多模块项目

### 4.1 项目结构

```text
demo-parent/                    ← 父模块（packaging=pom）
├── pom.xml
├── demo-common/                 ← 公共模块
│   └── pom.xml
├── demo-service/                ← 业务模块
│   └── pom.xml
└── demo-web/                    ← Web 模块
    └── pom.xml
```

### 4.2 父 POM 配置

```xml
<!-- demo-parent/pom.xml -->
<groupId>com.example</groupId>
<artifactId>demo-parent</artifactId>
<version>1.0.0</version>
<packaging>pom</packaging>

<!-- 声明子模块 -->
<modules>
    <module>demo-common</module>
    <module>demo-service</module>
    <module>demo-web</module>
</modules>

<!-- 声明公共属性 -->
<properties>
    <java.version>1.8</java.version>
    <maven.compiler.source>1.8</maven.compiler.source>
    <maven.compiler.target>1.8</maven.compiler.target>
</properties>

<!-- 声明公共依赖版本 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>demo-common</artifactId>
            <version>${project.version}</version>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### 4.3 子模块 POM 配置

```xml
<!-- demo-web/pom.xml -->
<parent>
    <groupId>com.example</groupId>
    <artifactId>demo-parent</artifactId>
    <version>1.0.0</version>
    <relativePath/>  <!-- 从本地仓库查找父 POM -->
</parent>

<artifactId>demo-web</artifactId>
<packaging>jar</packaging>

<dependencies>
    <!-- 引用同项目的子模块 -->
    <dependency>
        <groupId>com.example</groupId>
        <artifactId>demo-common</artifactId>
    </dependency>
    <dependency>
        <groupId>com.example</groupId>
        <artifactId>demo-service</artifactId>
    </dependency>
</dependencies>
```

### 4.4 构建命令

```bash
# 在父模块目录执行，构建所有子模块
mvn clean install

# 跳过测试
mvn clean install -DskipTests

# 构建指定模块及依赖模块
mvn clean install -pl demo-web -am

# -pl: 指定模块
# -am: also make，同时构建依赖模块
# -amd: also make dependents，同时构建被依赖的模块
```

---

## 五、Profile（环境配置）

### 5.1 定义 Profile

```xml
<profiles>
    <!-- 开发环境 -->
    <profile>
        <id>dev</id>
        <properties>
            <profile.active>dev</profile.active>
        </properties>
        <activation>
            <activeByDefault>true</activeByDefault>
        </activation>
    </profile>

    <!-- 测试环境 -->
    <profile>
        <id>test</id>
        <properties>
            <profile.active>test</profile.active>
        </properties>
    </profile>

    <!-- 生产环境 -->
    <profile>
        <id>prod</id>
        <properties>
            <profile.active>prod</profile.active>
        </properties>
    </profile>
</profiles>
```

### 5.2 资源过滤

```xml
<build>
    <resources>
        <resource>
            <directory>src/main/resources</directory>
            <filtering>true</filtering>  <!-- 开启 Maven 变量替换 -->
        </resource>
    </resources>
</build>
```

在 `application.yml` 中引用：

```yaml
spring:
  profiles:
    active: @profile.active@
```

### 5.3 激活 Profile

```bash
# 命令行激活
mvn clean package -Ptest

# 同时激活多个
mvn clean package -Pdev,local
```

---

## 六、核心插件

### 6.1 maven-compiler-plugin

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.11.0</version>
    <configuration>
        <source>1.8</source>
        <target>1.8</target>
        <encoding>UTF-8</encoding>
        <!-- 配合 Lombok/MapStruct 的注解处理器 -->
        <annotationProcessorPaths>
            <path>
                <groupId>org.projectlombok</groupId>
                <artifactId>lombok</artifactId>
                <version>1.18.30</version>
            </path>
            <path>
                <groupId>org.mapstruct</groupId>
                <artifactId>mapstruct-processor</artifactId>
                <version>1.5.3.Final</version>
            </path>
        </annotationProcessorPaths>
    </configuration>
</plugin>
```

### 6.2 spring-boot-maven-plugin

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <version>2.7.18</version>
    <configuration>
        <!-- 指定主类 -->
        <mainClass>com.example.DemoApplication</mainClass>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>repackage</goal>  <!-- 打可执行 jar -->
            </goals>
        </execution>
    </executions>
</plugin>
```

### 6.3 maven-resources-plugin

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-resources-plugin</artifactId>
    <version>3.3.1</version>
    <configuration>
        <encoding>UTF-8</encoding>
        <!-- 过滤资源文件中的 Maven 变量 -->
        <nonFilteredFileExtensions>
            <nonFilteredFileExtension>p12</nonFilteredFileExtension>
            <nonFilteredFileExtension>jks</nonFilteredFileExtension>
        </nonFilteredFileExtensions>
    </configuration>
</plugin>
```

---

## 七、仓库配置

### 7.1 镜像配置（Aliyun 镜像）

`~/.m2/settings.xml`：

```xml
<settings>
    <mirrors>
        <mirror>
            <id>aliyunmaven</id>
            <mirrorOf>central</mirrorOf>
            <name>阿里云公共仓库</name>
            <url>https://maven.aliyun.com/repository/public</url>
        </mirror>
    </mirrors>
</settings>
```

### 7.2 私有仓库（Nexus）

```xml
<!-- settings.xml：配置认证信息 -->
<settings>
    <servers>
        <server>
            <id>nexus-releases</id>
            <username>admin</username>
            <password>your-password</password>
        </server>
        <server>
            <id>nexus-snapshots</id>
            <username>admin</username>
            <password>your-password</password>
        </server>
    </servers>
</settings>
```

```xml
<!-- pom.xml：配置仓库地址 -->
<distributionManagement>
    <repository>
        <id>nexus-releases</id>
        <url>http://nexus.example.com/repository/maven-releases/</url>
    </repository>
    <snapshotRepository>
        <id>nexus-snapshots</id>
        <url>http://nexus.example.com/repository/maven-snapshots/</url>
    </snapshotRepository>
</distributionManagement>
```

### 7.3 多仓库配置

```xml
<repositories>
    <repository>
        <id>aliyun</id>
        <url>https://maven.aliyun.com/repository/public</url>
        <releases><enabled>true</enabled></releases>
        <snapshots><enabled>false</enabled></snapshots>
    </repository>
    <repository>
        <id>nexus-private</id>
        <url>http://nexus.example.com/repository/maven-public/</url>
        <releases><enabled>true</enabled></releases>
        <snapshots><enabled>true</enabled></snapshots>
    </repository>
</repositories>
```

---

## 八、常用命令速查

### 构建相关

| 命令 | 说明 |
|------|------|
| `mvn clean` | 清理 target 目录 |
| `mvn compile` | 编译源代码 |
| `mvn test` | 运行测试 |
| `mvn package` | 打包（jar / war） |
| `mvn install` | 安装到本地仓库 |
| `mvn deploy` | 部署到远程仓库 |
| `mvn clean package -DskipTests` | 跳过测试打包 |
| `mvn clean package -Dmaven.test.skip=true` | 跳过测试编译和执行 |

### 依赖相关

| 命令 | 说明 |
|------|------|
| `mvn dependency:tree` | 查看依赖树 |
| `mvn dependency:resolve` | 解析所有依赖 |
| `mvn dependency:analyze` | 分析未使用/未声明的依赖 |

### 版本相关

| 命令 | 说明 |
|------|------|
| `mvn versions:set -DnewVersion=1.1.0` | 批量修改版本号 |
| `mvn versions:display-dependency-updates` | 查看依赖版本更新 |

### 其他

| 命令 | 说明 |
|------|------|
| `mvn help:effective-pom` | 查看合并后的完整 POM |
| `mvn help:effective-settings` | 查看合并后的完整 settings |
| `mvn -X` | 开启 Debug 日志 |

---

## 九、Spring Boot 2.7.x 典型 Maven 配置

### 9.1 单模块项目

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.18</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>demo-app</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <properties>
        <java.version>1.8</java.version>
        <maven.compiler.source>1.8</maven.compiler.source>
        <maven.compiler.target>1.8</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <!-- Spring Boot Web -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring Boot 测试 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 9.2 多模块项目结构

```text
demo-cloud/
├── pom.xml                          ← 父 POM（packaging=pom）
├── demo-common/
│   └── pom.xml
├── demo-api/
│   └── pom.xml
└── demo-service/
    └── pom.xml
```

父 POM（`demo-cloud/pom.xml`）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>demo-cloud</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>

    <modules>
        <module>demo-common</module>
        <module>demo-api</module>
        <module>demo-service</module>
    </modules>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.18</version>
        <relativePath/>
    </parent>

    <properties>
        <java.version>1.8</java.version>
        <spring-cloud.version>2021.0.9</spring-cloud.version>
        <spring-cloud-alibaba.version>2021.0.5.0</spring-cloud-alibaba.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <!-- Spring Cloud BOM -->
            <dependency>
                <groupId>org.springframework.cloud</groupId>
                <artifactId>spring-cloud-dependencies</artifactId>
                <version>${spring-cloud.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <!-- Spring Cloud Alibaba BOM -->
            <dependency>
                <groupId>com.alibaba.cloud</groupId>
                <artifactId>spring-cloud-alibaba-dependencies</artifactId>
                <version>${spring-cloud-alibaba.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <!-- 子模块内部依赖 -->
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>demo-common</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>demo-api</artifactId>
                <version>${project.version}</version>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>
```

---

## 十、常见问题

**Q: `mvn clean install` 和 `mvn clean package` 有什么区别？**

- `package`：打包到 `target/` 目录，不安装到本地仓库
- `install`：打包后安装到本地仓库（`~/.m2/repository`），其他项目可以直接引用

**Q: 依赖冲突怎么排查？**

```bash
# 查看依赖树，定位冲突
mvn dependency:tree -Dincludes=com.alibaba:fastjson

# 排除冲突的传递性依赖
<exclusions><exclusion>...</exclusion></exclusions>
```

**Q: 如何跳过单元测试？**

```bash
mvn clean package -DskipTests          # 不执行测试，但编译测试代码
mvn clean package -Dmaven.test.skip=true  # 不编译也不执行测试
```

**Q: SNAPSHOT 和 RELEASE 版本的区别？**

| 类型 | 说明 | 示例 |
|------|------|------|
| SNAPSHOT | 开发中的快照版本，可重复更新 | `1.0.0-SNAPSHOT` |
| RELEASE | 正式发布版本，不可变 | `1.0.0` |

**Q: `@project.version@` 和 `${project.version}` 有什么区别？**

- `@project.version@`：Maven 资源过滤语法，在 `application.yml` 中使用，需开启 `<filtering>true</filtering>`
- `${project.version}`：Maven POM 内部变量，在 `pom.xml` 中使用

---

## 参考资源

- [Maven 官方文档](https://maven.apache.org/guides/)
- [Spring Boot 2.7.x 文档](../spring-boot/)
- [Spring Cloud 版本对应](../spring-cloud/)