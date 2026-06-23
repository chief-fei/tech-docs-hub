import { defineTeekConfig } from "vitepress-theme-teek/config";
import { version } from "vitepress-theme-teek/es/version";

export const teekConfig = defineTeekConfig({
  teekHome: false,
  vpHome: true,
  sidebarTrigger: true,
  loading: '酋长正在加载中...',
  author: { name: "chief-fei", link: "https://github.com/chief-fei" },

  // 深浅色模式切换过渡动画
  viewTransition: {
    enabled: true,
    mode: "out-in",
    duration: 300,
  },

  // 全局视图渐入过渡效果
  windowTransition: true,

  // 回到顶部按钮
  backTop: {
    enabled: true,
    content: "progress",
    done: (TkMessage) => TkMessage.success("返回顶部成功"),
  },

  // 面包屑导航
  breadcrumb: {
    enabled: true,
    showCurrentName: false,
    separator: "/",
    homeLabel: "首页",
  },

  // 主题增强面板（布局切换、主题色、聚光灯）
  themeEnhance: {
    enabled: true,
    position: "top",
    layoutSwitch: {
      disabled: false,
      defaultMode: "original",
    },
    themeColor: {
      disabled: false,
      defaultColorName: "vp-primary",
      defaultSpread: false,
    },
    spotlight: {
      disabled: false,
      defaultStyle: "aside",
      defaultValue: false,
    },
  },

  // 文章信息展示
  articleAnalyze: {
    showIcon: true,
    dateFormat: "yyyy-MM-dd",
    dateUTC: true,
    showInfo: true,
    showAuthor: true,
    showCreateDate: true,
    showUpdateDate: false,
    showCategory: false,
    showTag: false,
  },

  // 站点信息卡片
  docAnalysis: {
    enabled: true,
    createTime: "2025-01-01",
    wordCount: true,
    readingTime: true,
  },

  // 文章页最近更新栏
  articleUpdate: {
    enabled: true,
    limit: 3,
  },

  footerInfo: {
    theme: {
      name: `Theme By Teek@${version}`,
    },
    copyright: {
      createYear: 2025,
      suffix: "技术文档中心",
    },
  },

  // 代码块配置
  codeBlock: {
    enabled: true,
    collapseHeight: 700,
    copiedDone: (TkMessage) => TkMessage.success("复制成功！"),
  },

  // Giscus 评论（基于 GitHub Discussions）
  comment: {
    provider: "giscus",
    options: {
      repo: "chief-fei/tech-docs-hub",
      repoId: "R_kgDOSqB-SQ",
      category: "General",
      categoryId: "DIC_kwDOSqB-Sc4C9_nv",
    },
  },

  articleShare: { enabled: true },

  vitePlugins: {
    sidebarOption: {
      initItems: false,
    },
  },
});
