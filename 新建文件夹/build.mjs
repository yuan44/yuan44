#!/usr/bin/env node
/**
 * tools/build.mjs — 可选构建脚本（「路线 2」）
 * ---------------------------------------------------------------------------
 * 这个脚本【不是必需品】。不运行它，站点照样完整可用——所有 HTML 里已经是
 * 展开好的最终内容。它只是帮你消除「改一次导航要改 N 个文件」的重复劳动。
 *
 * 它做四件事：
 *   1. 把 tools/partials/*.html 注入各页面里 <!--@name--> … <!--@/name--> 标记区
 *      （同时把 {{root}} 替换成正确的相对路径前缀）
 *   2. 扫描 posts/*.html，重新生成首页的文章列表
 *   3. 生成 search-index.json（站内全文搜索用）
 *   4. 生成 feed.xml（RSS 2.0）
 *
 * 用法：
 *   node tools/build.mjs
 *   node tools/build.mjs --check     # 只检查是否有文件需要更新，不写入
 * ---------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ============================== 站点配置 ============================== */
/* ↓↓↓ 部署前把这里改成你自己的信息 ↓↓↓ */
const SITE_URL   = 'https://example.github.io';   // 结尾不要带斜杠
const SITE_TITLE = '我的博客';
const SITE_DESC  = '用纯 HTML / CSS / JS 手写的静态博客';
const SITE_LANG  = 'zh-CN';
const AUTHOR     = 'your-name';
/* ↑↑↑ 部署前把这里改成你自己的信息 ↑↑↑ */

const CHECK_ONLY = process.argv.includes('--check');

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARTIAL_DIR = join(SITE_ROOT, 'tools', 'partials');

/* ============================== 小工具 ============================== */

const read = (p) => readFileSync(p, 'utf8');

let writeCount = 0;
let skipCount = 0;
const changed = [];

/** 只在内容真的变化时写入，保持 mtime 稳定 */
function writeIfChanged(path, content) {
  const prev = existsSync(path) ? read(path) : null;
  if (prev === content) { skipCount++; return; }
  changed.push(relative(SITE_ROOT, path).replace(/\\/g, '/'));
  writeCount++;
  if (!CHECK_ONLY) writeFileSync(path, content, 'utf8');
}

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const escapeXml = escapeHtml;

function stripTags(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const truncate = (s, n) => (s.length <= n ? s : s.slice(0, n).trimEnd() + '…');

/* ============================== 载入分片 ============================== */

const partials = {};
if (existsSync(PARTIAL_DIR)) {
  for (const f of readdirSync(PARTIAL_DIR)) {
    if (f.endsWith('.html')) partials[f.replace(/\.html$/, '')] = read(join(PARTIAL_DIR, f));
  }
}

/**
 * 去掉分片文件里可能自带的标记行。
 * 分片文件只应包含内容本身；标记属于页面。这里做防御性剥离，
 * 这样即使有人把标记一起写进分片，也不会造成标记嵌套。
 */
function stripMarkers(content, name) {
  return content
    .replace(new RegExp(`^\\s*<!--@${name}-->[ \\t]*\\r?\\n?`), '')
    .replace(new RegExp(`\\r?\\n?[ \\t]*<!--@/${name}-->\\s*$`), '')
    .trim();
}

/**
 * 注入所有分片，并把 {{root}} 换成相对前缀。
 * 用贪婪匹配（首个开始标记 → 末个结束标记）整段替换：
 * 这样即使文件里已经残留了嵌套标记，也能被自动修复回单层。
 */
function injectPartials(html, rootPrefix) {
  let out = html;
  for (const [name, raw] of Object.entries(partials)) {
    const re = new RegExp(`(<!--@${name}-->)[\\s\\S]*(<!--@/${name}-->)`);
    if (!re.test(out)) continue;
    const rendered = stripMarkers(raw, name).replace(/\{\{root\}\}/g, rootPrefix);
    out = out.replace(re, `$1\n${rendered}\n$2`);
  }
  return out.replace(/\{\{root\}\}/g, rootPrefix);
}

/* ============================== 扫描页面 ============================== */

const pageFiles = [];
for (const f of readdirSync(SITE_ROOT)) {
  if (f.endsWith('.html')) pageFiles.push({ path: join(SITE_ROOT, f), prefix: '' });
}
const POSTS_DIR = join(SITE_ROOT, 'posts');
if (existsSync(POSTS_DIR)) {
  for (const f of readdirSync(POSTS_DIR)) {
    if (f.endsWith('.html')) pageFiles.push({ path: join(POSTS_DIR, f), prefix: '../' });
  }
}

/* ============================== 解析文章元信息 ============================== */

function parsePost(file) {
  const html = read(file);
  const pick = (re, fallback = '') => {
    const m = html.match(re);
    return m ? m[1].trim() : fallback;
  };

  const title = stripTags(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/))
    || pick(/<title>([\s\S]*?)<\/title>/)
    || file;

  const date = pick(/<meta\s+name="post:date"\s+content="([^"]*)"/);
  const tagsRaw = pick(/<meta\s+name="post:tags"\s+content="([^"]*)"/);

  const article = html.match(/<article[^>]*class="[^"]*\bprose\b[^"]*"[^>]*>([\s\S]*?)<\/article>/);
  const bodyHtml = article ? article[1] : html;

  const description = pick(/<meta\s+name="description"\s+content="([^"]*)"/)
    || truncate(stripTags(bodyHtml), 120);

  return {
    file,
    url: 'posts/' + file.split(/[\\/]/).pop(),
    title,
    date,
    tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    description,
    body: stripTags(bodyHtml),
  };
}

const posts = existsSync(POSTS_DIR)
  ? readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith('.html'))
      .map((f) => parsePost(join(POSTS_DIR, f)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title))
  : [];

/* ============================== 生成文章列表 ============================== */

function renderPostList(list) {
  if (!list.length) {
    return '        <p class="empty-state">还没有文章。复制 <code>tools/post-template.html</code> 到 <code>posts/</code> 开始写第一篇。</p>';
  }
  return list.map((p) => {
    const tags = p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('\n            ');
    return `        <article class="post-card">
          <h3><a href="${escapeHtml(p.url)}">${escapeHtml(p.title)}</a></h3>
          <p class="excerpt">${escapeHtml(truncate(p.description, 140))}</p>
          <div class="post-meta">
            <time datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time>${tags ? '\n            <span class="dot">·</span>\n            ' + tags : ''}
          </div>
        </article>`;
  }).join('\n');
}

/* ============================== 生成 feed.xml ============================== */

function rfc822(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return new Date().toUTCString();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${days[d.getUTCDay()]}, ${String(+m[3]).padStart(2, '0')} ${months[+m[2] - 1]} ${m[1]} 00:00:00 +0800`;
}

function renderFeed(list) {
  const items = list.map((p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/${p.url}</link>
      <guid isPermaLink="true">${SITE_URL}/${p.url}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      ${p.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('\n      ')}
      <description>${escapeXml(truncate(p.description, 200))}</description>
    </item>`).join('\n');

  const lastBuild = list.length && list[0].date ? rfc822(list[0].date) : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}/</link>
    <description>${escapeXml(SITE_DESC)}</description>
    <language>${SITE_LANG}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

/* ============================== 主流程 ============================== */

// 1) 先注入分片
for (const page of pageFiles) {
  const html = read(page.path);
  writeIfChanged(page.path, injectPartials(html, page.prefix));
}

// 2) 再刷新首页文章列表（此时 index.html 的分片已展开）
const INDEX = join(SITE_ROOT, 'index.html');
if (existsSync(INDEX)) {
  const html = read(INDEX);
  const re = /(<!--@postlist-->)[\s\S]*?(<!--@\/postlist-->)/;
  if (re.test(html)) {
    writeIfChanged(INDEX, html.replace(re, `$1\n${renderPostList(posts)}\n$2`));
  } else {
    console.warn('! index.html 里找不到 <!--@postlist--> 标记，跳过文章列表生成');
  }
}

// 3) 站内搜索索引
writeIfChanged(
  join(SITE_ROOT, 'search-index.json'),
  JSON.stringify(
    posts.map((p) => ({
      title: p.title,
      url: p.url,
      date: p.date,
      tags: p.tags,
      excerpt: truncate(p.description, 160),
      body: truncate(p.body, 4000),
    })),
    null, 2
  ) + '\n'
);

// 4) RSS
writeIfChanged(join(SITE_ROOT, 'feed.xml'), renderFeed(posts));

/* ============================== 输出 ============================== */

const verb = CHECK_ONLY ? '需要更新' : '已更新';
console.log(`${verb}: ${writeCount} 个文件，${skipCount} 个未变`);
if (changed.length) changed.forEach((f) => console.log('  · ' + f));
console.log(`扫描到 ${posts.length} 篇文章，${Object.keys(partials).length} 个分片`);
if (CHECK_ONLY && writeCount > 0) process.exitCode = 1;
