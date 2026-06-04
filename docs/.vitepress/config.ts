import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import llmstxt from "vitepress-plugin-llms";
import { teekConfig } from "./teekConfig";

const description = [
  "技术文档中心 - Java 生态技术栈使用指南",
  "覆盖 COLA、Redis、Docker、Elasticsearch、Spring Cloud 等主流技术栈",
].toString();

export default withMermaid(defineConfig({
  extends: teekConfig,
  title: "技术文档中心",
  description: description,
  base: "/",
  cleanUrls: false,
  lastUpdated: true,
  lang: "zh-CN",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "./favicon.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "zh-CN" }],
    ["meta", { property: "og:title", content: "技术文档中心 | Java 生态技术栈指南" }],
    ["meta", { property: "og:site_name", content: "技术文档中心" }],
    ["meta", { property: "og:description", description }],
    ["meta", { name: "description", description }],
    ["meta", { name: "author", content: "chief-fei" }],
    ["meta", { name: "keywords", description }],
  ],
  markdown: {
    lineNumbers: true,
    image: { lazyLoading: true },
    container: {
      tipLabel: "提示",
      warningLabel: "警告",
      dangerLabel: "危险",
      infoLabel: "信息",
      detailsLabel: "详细信息",
    },
  },
  sitemap: {
    hostname: "https://chief-fei.github.io/tech-docs-hub",
  },
  themeConfig: {
    logo: "/teek-logo-mini.svg",
    darkModeSwitchLabel: "主题",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    lastUpdatedText: "上次更新时间",
    outline: { level: [2, 4], label: "本页导航" },
    docFooter: { prev: "上一页", next: "下一页" },

    nav: [
      { text: "首页", link: "/" },
      {
        text: "COLA",
        items: [
          { text: "概述", link: "/cola/" },
          { text: "快速开始", link: "/cola/quickstart" },
          { text: "架构详解", link: "/cola/architecture" },
          { text: "组件总览", link: "/cola/components/index" },
        ],
      },
      {
        text: "数据库与缓存",
        items: [
          { text: "MySQL", link: "/mysql/" },
          { text: "Redis", link: "/redis/" },
          { text: "Elasticsearch", link: "/es/" },
        ],
      },
      {
        text: "Spring Boot",
        items: [
          { text: "概述", link: "/spring-boot/" },
          { text: "Controller & 请求处理", link: "/spring-boot/controller" },
          { text: "Filter 过滤器", link: "/spring-boot/filter" },
          { text: "Interceptor 拦截器", link: "/spring-boot/interceptor" },
          { text: "全局异常处理", link: "/spring-boot/exception" },
          { text: "事务管理", link: "/spring-boot/transaction" },
          { text: "AOP 切面编程", link: "/spring-boot/aop" },
          { text: "Bean 管理", link: "/spring-boot/bean" },
          { text: "配置与属性", link: "/spring-boot/config" },
          { text: "javax.validation 校验", link: "/spring-boot/validation" },
          { text: "注解速查", link: "/spring-boot/annotations" },
          { text: "Swagger API 文档", link: "/spring-boot/swagger" },
        ],
      },
      { text: "Docker", link: "/docker/" },
      {
        text: "微服务生态",
        items: [
          { text: "概述", link: "/spring-cloud/" },
          { text: "Nacos", link: "/spring-cloud/nacos/" },
          { text: "OpenFeign", link: "/spring-cloud/openfeign/" },
          { text: "RocketMQ", link: "/spring-cloud/rocketmq/" },
          { text: "Sentinel", link: "/spring-cloud/sentinel" },
          { text: "Seata", link: "/spring-cloud/seata" },
          { text: "Gateway", link: "/spring-cloud/gateway" },
        ],
      },
      {
        text: "开发工具",
        items: [
          { text: "概述", link: "/dev-tools/" },
          { text: "Maven", link: "/dev-tools/maven" },
          { text: "MapStruct", link: "/dev-tools/mapstruct" },
          { text: "EasyExcel", link: "/dev-tools/easyexcel" },
          { text: "XXL-Job", link: "/dev-tools/xxl-job" },
          { text: "Sa-Token", link: "/dev-tools/sa-token" },
          { text: "SpringDoc API 文档", link: "/dev-tools/springdoc" },
          { text: "Hutool", link: "/utils/hutool" },
          { text: "Netty", link: "/utils/netty" },
          { text: "OSS", link: "/dev-tools/aliyun-oss" },
          { text: "Jasypt", link: "/dev-tools/jasypt" },
          { text: "Lombok", link: "/dev-tools/lombok" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/chief-fei/tech-docs-hub" }],

    sidebar: {
      "/cola/": [
        {
          text: "COLA", collapsed: false,
          items: [
            { text: "概述", link: "/cola/" },
            { text: "快速开始", link: "/cola/quickstart" },
            { text: "架构详解", link: "/cola/architecture" },
            { text: "命名规范", link: "/cola/naming-conventions" },
          ],
        },
        {
          text: "核心组件", collapsed: false,
          items: [
            { text: "组件总览", link: "/cola/components/index" },
            { text: "DTO 数据传输", link: "/cola/components/dto" },
            { text: "Domain 领域建模", link: "/cola/components/domain" },
            { text: "Exception 异常处理", link: "/cola/components/exception" },
            { text: "CatchLog 日志切面", link: "/cola/components/catchlog" },
          ],
        },
        {
          text: "高级组件", collapsed: true,
          items: [
            { text: "Extension 扩展点", link: "/cola/components/extension" },
            { text: "Lock 分布式锁", link: "/cola/components/lock" },
            { text: "StateMachine 状态机", link: "/cola/components/statemachine" },
            { text: "RuleEngine 规则引擎", link: "/cola/components/ruleengine" },
          ],
        },
        {
          text: "参考资料", collapsed: true,
          items: [
            { text: "注解速查手册", link: "/cola/annotations" },
          ],
        },
      ],
      "/redis/": [
        {
          text: "Redis", collapsed: false,
          items: [
            { text: "概述与集成", link: "/redis/" },
            { text: "String 字符串", link: "/redis/string" },
            { text: "Hash 哈希", link: "/redis/hash" },
            { text: "List 列表", link: "/redis/list" },
            { text: "Set 集合", link: "/redis/set" },
            { text: "ZSet 有序集合", link: "/redis/zset" },
            { text: "Redisson 分布式锁", link: "/redis/redisson-lock" },
          ],
        },
      ],
      "/docker/": [
        {
          text: "Docker", collapsed: false,
          items: [
            { text: "概述", link: "/docker/" },
            { text: "镜像管理命令", link: "/docker/image" },
            { text: "容器管理命令", link: "/docker/container" },
            { text: "Dockerfile 编写", link: "/docker/dockerfile" },
            { text: "Docker Compose", link: "/docker/compose" },
            { text: "Spring Boot 容器化", link: "/docker/spring-boot" },
          ],
        },
      ],
      "/es/": [
        {
          text: "Elasticsearch", collapsed: false,
          items: [
            { text: "概述与集成", link: "/es/" },
            { text: "数据类型与 Mapping", link: "/es/data-types" },
            { text: "索引库 CRUD", link: "/es/index-crud" },
            { text: "文档 CRUD", link: "/es/document-crud" },
            { text: "Spring Boot 集成", link: "/es/spring-boot" },
          ],
        },
      ],
      "/spring-boot/": [
        {
          text: "Spring Boot 2.7.x", collapsed: false,
          items: [
            { text: "概述", link: "/spring-boot/" },
            { text: "Controller & 请求处理", link: "/spring-boot/controller" },
            { text: "Filter 过滤器", link: "/spring-boot/filter" },
            { text: "Interceptor 拦截器", link: "/spring-boot/interceptor" },
            { text: "全局异常处理", link: "/spring-boot/exception" },
            { text: "事务管理", link: "/spring-boot/transaction" },
            { text: "AOP 切面编程", link: "/spring-boot/aop" },
            { text: "Bean 管理", link: "/spring-boot/bean" },
            { text: "配置与属性", link: "/spring-boot/config" },
            { text: "javax.validation 校验", link: "/spring-boot/validation" },
            { text: "注解速查", link: "/spring-boot/annotations" },
          ],
        },
      ],
      "/utils/": [
        {
          text: "常用工具类库", collapsed: false,
          items: [
            { text: "概述", link: "/dev-tools/" },
            { text: "Hutool 工具类库", link: "/utils/hutool" },
            { text: "Netty 网络框架", link: "/utils/netty" },
          ],
        },
      ],
      "/dev-tools/": [
        {
          text: "开发工具与效能库", collapsed: false,
          items: [
            { text: "概述", link: "/dev-tools/" },
            { text: "Maven 构建工具", link: "/dev-tools/maven" },
            { text: "MapStruct 对象映射", link: "/dev-tools/mapstruct" },
            { text: "EasyExcel 表格处理", link: "/dev-tools/easyexcel" },
            { text: "XXL-Job 任务调度", link: "/dev-tools/xxl-job" },
            { text: "Hutool 工具类库", link: "/utils/hutool" },
            { text: "Netty 网络框架", link: "/utils/netty" },
            { text: "Sa-Token 权限认证", link: "/dev-tools/sa-token" },
            { text: "Alibaba Cloud OSS", link: "/dev-tools/aliyun-oss" },
          { text: "Jasypt 配置加密", link: "/dev-tools/jasypt" },
          { text: "Lombok 注解指南", link: "/dev-tools/lombok" },
          ],
        },
      ],
      "/spring-cloud/": [
        {
          text: "微服务生态", collapsed: false,
          items: [
            { text: "概述", link: "/spring-cloud/" },
            { text: "Nacos 注册 & 配置中心", link: "/spring-cloud/nacos/" },
            { text: "OpenFeign 远程调用", link: "/spring-cloud/openfeign/" },
            { text: "RocketMQ 消息队列", link: "/spring-cloud/rocketmq/" },
            { text: "Sentinel 流量治理", link: "/spring-cloud/sentinel" },
            { text: "Seata 分布式事务", link: "/spring-cloud/seata" },
            { text: "Gateway 网关", link: "/spring-cloud/gateway" },
          ],
        },
      ],
      "/mysql/": [
        {
          text: "MySQL 数据库", collapsed: false,
          items: [
            { text: "概述", link: "/mysql/" },
            { text: "DDL 数据定义", link: "/mysql/ddl" },
            { text: "DML 数据操作", link: "/mysql/dml" },
            { text: "DQL 数据查询", link: "/mysql/dql" },
          ],
        },
        {
          text: "连接池", collapsed: false,
          items: [
            { text: "Druid 连接池", link: "/mysql/druid" },
          ],
        },
        {
          text: "ORM 框架", collapsed: false,
          items: [
            { text: "MyBatis 完全指南", link: "/mysql/mybatis" },
            { text: "MyBatis-Plus 完全指南", link: "/mysql/mybatis-plus" },
          ],
        },
      ],
    },

    search: { provider: "local" },
    editLink: {
      text: "在 GitHub 上编辑此页",
      pattern: "https://github.com/chief-fei/tech-docs-hub/edit/main/docs/:path",
    },
  },
  vite: { plugins: [llmstxt() as any] },
}));
