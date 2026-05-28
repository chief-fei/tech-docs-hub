# 技术文档中心

基于 [VitePress](https://vitepress.dev/) 和 [Teek 主题](https://github.com/Kele-Bingtang/vitepress-theme-teek) 构建的技术文档站点。

## 📚 文档内容

本站点涵盖以下技术栈的使用指南：

- **COLA** - 整洁面向对象分层架构
- **Redis** - 缓存与数据结构
- **Elasticsearch** - 搜索引擎
- **Docker** - 容器化部署
- **Spring Cloud** - 微服务生态

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm docs:dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
pnpm docs:build
```

构建产物位于 `docs/.vitepress/dist`

### 预览构建结果

```bash
pnpm docs:preview
```

## 🎨 主题说明

本站点使用 [vitepress-theme-teek](https://github.com/Kele-Bingtang/vitepress-theme-teek) 主题，这是一个功能丰富、高度可定制的 VitePress 主题。

**Teek 主题特性：**

- 🌙 深色/浅色模式自动切换
- 🔍 全文搜索
- 📊 阅读进度显示
- 💬 评论系统集成（Giscus）
- 🎯 面包屑导航
- 📱 响应式设计
- ⚡ 性能优化

**主题资源：**

- 官方文档：https://vp.teek.top
- GitHub 仓库：https://github.com/Kele-Bingtang/vitepress-theme-teek
- 演示站点：https://notes.teek.top

## 📦 项目结构

```
doc-hub/
├── docs/                    # 文档源文件
│   ├── .vitepress/         # VitePress 配置
│   │   ├── config.ts       # 主配置文件
│   │   ├── teekConfig.ts   # Teek 主题配置
│   │   └── theme/          # 主题定制
│   ├── cola/               # COLA 架构文档
│   ├── docker/             # Docker 文档
│   ├── es/                 # Elasticsearch 文档
│   ├── redis/              # Redis 文档
│   ├── spring-cloud/       # Spring Cloud 文档
│   └── index.md            # 首页
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 部署配置
└── package.json
```

## 🌐 在线访问

- GitHub Pages: https://chief-fei.github.io/tech-docs-hub

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进文档内容。

## 📄 许可证

文档内容采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可协议。

## 🙏 致谢

- [VitePress](https://vitepress.dev/) - 静态站点生成器
- [Teek 主题](https://github.com/Kele-Bingtang/vitepress-theme-teek) - 功能强大的 VitePress 主题
- [Giscus](https://giscus.app/) - 基于 GitHub Discussions 的评论系统
