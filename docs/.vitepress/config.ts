import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import { teekConfig } from "./teekConfig";

const description = [
  "技术文档中心 - Java 生态技术栈使用指南",
  "覆盖 COLA、Redis、Docker、Elasticsearch、Spring Cloud 等主流技术栈",
].toString();

export default defineConfig({
  extends: teekConfig,
  title: "技术文档中心",
  description: description,
  base: "/tech-docs-hub/",
  cleanUrls: false,
  lastUpdated: true,
  lang: "zh-CN",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/teek-logo-mini.svg" }],
    ["link", { rel: "icon", type: "image/png", href: "/teek-logo-mini.png" }],
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
          { text: "Redis", link: "/redis/" },
          { text: "Elasticsearch", link: "/es/" },
        ],
      },
      { text: "Docker", link: "/docker/" },
      {
        text: "微服务",
        items: [
          { text: "Spring Cloud 概述", link: "/spring-cloud/" },
          { text: "Nacos", link: "/spring-cloud/nacos/" },
          { text: "RocketMQ", link: "/spring-cloud/rocketmq/" },
          { text: "Dubbo", link: "/spring-cloud/dubbo/" },
          { text: "OpenFeign", link: "/spring-cloud/openfeign/" },
          { text: "MyBatis-Plus", link: "/spring-cloud/mybatis-plus/" },
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
            { text: "Lombok 注解指南", link: "/cola/lombok" },
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
      "/spring-cloud/": [
        {
          text: "Spring Cloud 生态", collapsed: false,
          items: [
            { text: "概述", link: "/spring-cloud/" },
            { text: "Nacos 注册 & 配置中心", link: "/spring-cloud/nacos/" },
            { text: "Nacos 配置中心详解", link: "/spring-cloud/nacos/config" },
            { text: "RocketMQ 消息队列", link: "/spring-cloud/rocketmq/" },
            { text: "OpenFeign 远程调用", link: "/spring-cloud/openfeign/" },
            { text: "Dubbo RPC 框架", link: "/spring-cloud/dubbo/" },
            { text: "MyBatis-Plus ORM", link: "/spring-cloud/mybatis-plus/" },
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
});
