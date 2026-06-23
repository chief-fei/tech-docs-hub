# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm docs:dev         # Start dev server (http://localhost:5173)
pnpm docs:build       # Production build → docs/.vitepress/dist
pnpm docs:preview     # Preview production build locally
```

- Requires **Node.js >= 18** and **pnpm >= 9**
- This is an ESM project (`"type": "module"` in package.json)

## Architecture

This is a **VitePress documentation site** (Chinese-language, `lang: "zh-CN"`) covering the Java/Spring Boot ecosystem. It uses the [vitepress-theme-teek](https://github.com/Kele-Bingtang/vitepress-theme-teek) theme.

### Configuration layering

- `docs/.vitepress/config.ts` — VitePress core config: title, nav, sidebar structure, markdown settings, build plugins. This is where **all navigation and sidebar entries** are defined, organized by technology section (see `themeConfig.nav` and `themeConfig.sidebar`).
- `docs/.vitepress/teekConfig.ts` — Teek theme features: view transitions, back-to-top, breadcrumbs, theme enhance panel, code block behavior, Giscus comments, article analytics, footer, article share.
- `docs/.vitepress/teekConfig.template.ts` — Reference template showing ~95% of available Teek options. **Not imported anywhere**; used as a copy-paste source when adding new theme features.
- `config.ts` merges the two via `extends: teekConfig`.

### Theme customization

- `docs/.vitepress/theme/index.ts` — Entry point. Extends the base Teek theme, imports Teek's CSS modules (code block, sidebar, nav, aside, gradients, tables, animations), and adds two custom SCSS files.
- `docs/.vitepress/theme/components/TeekLayoutProvider.vue` — Replaces the default layout. Injects a custom `ContributeChart` component into the archives page and a custom `NotFound` (404) component. The 404 and ContributeChart components live alongside it in `components/`.

### Plugins

- **vitepress-plugin-llms** — Generates LLM-friendly text output (configured in `config.ts` via `vite.plugins`).
- **Giscus** — Comment system backed by GitHub Discussions, configured in `teekConfig.ts` with repo `chief-fei/tech-docs-hub`.

### Content structure

All content lives under `docs/` as Markdown files, organized by technology:

| Directory | Content |
|---|---|
| `docs/cola/` | COLA architecture (DDD, components, annotations) |
| `docs/spring-boot/` | Spring Boot 2.7.x (controller, filter, interceptor, AOP, bean, etc.) |
| `docs/spring-cloud/` | Microservices (Nacos, OpenFeign, RocketMQ, Sentinel, Seata, Gateway) |
| `docs/mysql/` | MySQL + MyBatis/MyBatis-Plus |
| `docs/redis/` | Redis data types + Redisson distributed locks |
| `docs/es/` | Elasticsearch CRUD + Spring Boot integration |
| `docs/docker/` | Docker images, containers, Dockerfile, Compose |
| `docs/dev-tools/` | Maven, MapStruct, EasyExcel, XXL-Job, Druid, Sa-Token, Jasypt, OSS |
| `docs/dev-tools/` | Hutool, Netty |

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages on push to `main`. Key details:
- Uses pnpm 11, Node 24 in CI
- Output artifact: `docs/.vitepress/dist`
- Site URL: `https://chief-fei.github.io/tech-docs-hub`

## Content authoring conventions

- All docs are in **Chinese (zh-CN)** with Chinese-customized UI labels (tip/warning/danger/info containers, sidebar labels, etc.)
- VitePress `lastUpdated` is enabled — Git commit dates drive the "last updated" display
- Markdown features: line numbers enabled, lazy-loaded images, custom container labels
- Content license: CC BY-NC-SA 4.0