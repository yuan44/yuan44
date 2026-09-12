# 纯静态博客骨架

一个可以直接 push 上线的静态博客。**没有生成器、没有 npm 依赖、没有构建步骤。**

所有页面都是手写的 HTML，样式在一份 CSS 里，交互用一份原生 JavaScript（约 200 行，零第三方库）。
产出物就是仓库里的文件本身——不存在「源码」和「构建产物」的区别，也就不会出现
「Pages 读的分支和放网页的分支不匹配」这类问题。

---

## 目录结构

```
.
├── index.html            首页：站点介绍 + 搜索框 + 文章列表
├── about.html            关于页
├── posts/
│   ├── hello-world.html          示例文章（说明这个骨架）
│   └── native-js-features.html   示例文章（讲解 main.js 的实现）
├── assets/
│   ├── style.css         全部样式：主题变量、排版、表格、打印样式
│   ├── main.js           暗色模式 / 目录 / 代码复制 / 搜索（渐进增强）
│   └── sample-image.svg  占位图，可删
├── feed.xml              RSS 2.0 订阅源
├── search-index.json     站内搜索索引
├── .nojekyll             空文件，阻止 GitHub Pages 跑 Jekyll（重要，别删）
├── README.md
└── tools/                可选工具，不参与发布也能用
    ├── build.mjs             注入分片 + 生成列表 / RSS / 搜索索引
    ├── post-template.html    新文章模板（已展开，复制即用）
    └── partials/
        ├── nav.html          导航分片
        └── footer.html       页脚分片
```

---

## 快速开始

### 本地预览

直接双击 `index.html` 就能看——所有路径都是相对的，`file://` 下也能正常工作。

想要更接近真实环境（`fetch` 搜索索引需要 HTTP），起个静态服务器：

```bash
npx serve .          # 或
python -m http.server 8000
```

### 部署到 GitHub Pages

1. 把整个目录推到 GitHub 仓库；
2. 仓库 **Settings → Pages**；
3. **Source** 选 **Deploy from a branch**；
4. 分支选 `main`，目录选 `/ (root)`，保存；
5. 约一分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

> **⚠️ 必须保留 `.nojekyll`**
> 从分支部署时，GitHub Pages 默认会让 Jekyll 先处理一遍你的文件，
> 而 Jekyll 会**忽略所有以 `_` 下划线开头的文件和目录**。
> 一个空的 `.nojekyll` 就能彻底关掉它。这是纯静态方案唯一的隐藏陷阱。

> **自定义域名**：把内容为你的域名的 `CNAME` 文件放到仓库根目录即可。

---

## 发一篇文章

1. 复制模板：

   ```bash
   cp tools/post-template.html posts/my-new-post.html
   ```

2. 编辑 `posts/my-new-post.html`，重点改这几处：

   ```html
   <title>文章标题 · 我的博客</title>
   <meta name="description" content="一句话摘要（会出现在首页卡片和 RSS 里）">
   <meta name="post:date" content="2026-01-01">
   <meta name="post:tags" content="标签一,标签二">
   ```

   然后替换 `<article class="prose">` 里的正文。

3. （可选）刷新首页列表、RSS 和搜索索引：

   ```bash
   node tools/build.mjs
   ```

4. 提交推送：

   ```bash
   git add -A && git commit -m "post: my new post" && git push
   ```

### 正文可用的元素

模板里已经演示了全部写法：标题（`h2` 自动进目录）、列表、引用块、代码块、
`<div class="table-wrap"><table>` 表格、`.callout` 提示框（可加 `warn` / `danger` 修饰）、
`<figure>` 图片加图注。

正文里的 `<code>` 行内代码和 `<pre><code>` 代码块会自动获得样式；代码块的「复制」按钮由 JS 运行时注入。

---

## 关于 `tools/build.mjs`

**它是可选的。** 不运行它，站点也完整可用——所有 HTML 里已经是展开好的最终内容。

它存在的唯一理由，是消除「改一次导航要改 N 个文件」的重复劳动。它做四件事：

| 动作 | 说明 |
|---|---|
| 注入分片 | 把 `tools/partials/*.html` 写进各页面的 `<!--@nav--> … <!--@/nav-->` 标记区，并把 `{{root}}` 替换成正确的相对前缀（`/` 下是空串，`posts/` 下是 `../`） |
| 生成文章列表 | 扫描 `posts/*.html`，按日期倒序重写 `index.html` 里 `<!--@postlist-->` 标记区的内容 |
| 生成搜索索引 | 输出 `search-index.json` |
| 生成 RSS | 输出 `feed.xml` |

```bash
node tools/build.mjs           # 写入
node tools/build.mjs --check   # 只检查是否有文件需要更新（有则退出码 1，适合放进 CI）
```

脚本是**幂等**的：内容没变就不写文件，所以重复运行不会产生无意义的 diff。

### 部署前要改的配置

`tools/build.mjs` 顶部有四个常量，部署前改成你自己的：

```js
const SITE_URL   = 'https://example.github.io';   // 结尾不要带斜杠
const SITE_TITLE = '我的博客';
const SITE_DESC  = '用纯 HTML / CSS / JS 手写的静态博客';
const AUTHOR     = 'your-name';
```

---

## 自定义

| 想改什么 | 改哪里 |
|---|---|
| 站点名、副标题 | `tools/partials/nav.html`、`index.html` 的 `.hero` |
| 配色与暗色主题 | `assets/style.css` 顶部的 CSS 变量（`:root` 与 `[data-theme="dark"]`） |
| 导航链接 | `tools/partials/nav.html`，然后跑 `node tools/build.mjs` |
| 页脚 | `tools/partials/footer.html`，然后跑构建 |
| 正文排版宽度 | `assets/style.css` 的 `--measure` |
| 字体 | `assets/style.css` 的 `--font-sans` / `--font-mono` |

---

## 功能一览

| 功能 | 实现方式 | 无 JS 时 |
|---|---|---|
| 暗色 / 浅色主题 | CSS 变量 + localStorage，`<head>` 内联脚本防闪烁 | 跟随系统偏好 |
| 自动目录 + 滚动高亮 | 扫描 `.prose` 里的 `h2/h3`，`requestAnimationFrame` 节流 | 目录不显示 |
| 代码块复制按钮 | Clipboard API，运行时注入按钮 | 无按钮，代码照常可选中 |
| 站内搜索 | `search-index.json` 全文匹配，失败时降级为 DOM 过滤 | 无搜索框 |
| 阅读进度条 / 回到顶部 | 滚动监听 | 无 |
| 移动端导航 | 点击展开 | 导航始终可见 |
| 响应式 | CSS Grid + 媒体查询（960px / 720px 两个断点） | 正常 |
| 打印 / 导出 PDF | `@media print`：隐藏导航与目录，表格避免跨页断行 | 正常 |

**渐进增强是本骨架的核心约束**：禁用 JavaScript 后，正文、样式、链接、表格全部照常工作。

---

## 这套方案的代价

只有一条是真的：**共享布局的维护成本从 O(1) 变成 O(n)。**

改一次导航栏或页脚，用生成器的方案只改一个模板文件，这里要改每一个 `.html`。
文章少时无所谓；到三十篇以后，你会想跑 `tools/build.mjs`，或者干脆换成 Jekyll
（GitHub Pages 内置支持，零本地安装）。

其他刻意的取舍：没有评论系统、没有标签页与归档页、没有分页、没有访问统计。
这些都能在需要时自己加，成本都不高，但不预先塞进骨架里。

---

## 常见问题

**Q：为什么 `index.html` 的文章列表和 `posts/` 里的文件不一致？**
A：改完文章后忘了跑 `node tools/build.mjs`。它会重写 `<!--@postlist-->` 标记区。

**Q：`{{root}}` 出现在页面上了。**
A：那个位置没被分片覆盖，或是你手写了个没被替换的占位符。跑一次构建脚本，或直接手改成正确的相对路径。

**Q：搜索框没反应 / 一直提示「仅按标题与摘要匹配」。**
A：`search-index.json` 没生成或路径不对。跑一次 `node tools/build.mjs`。

**Q：想让 `tools/` 不被发布出去。**
A：把站点文件全部放进 `docs/` 目录，Pages 的目录选项改选 `/docs`。这样仓库根目录的
`README.md` 和 `tools/` 就不会出现在线上。
