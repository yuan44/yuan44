/* ==========================================================================
   纯静态博客骨架 · main.js
   零依赖，无构建。全部为渐进增强：禁用 JS 后站点依然可读可用。
   ========================================================================== */

(function () {
  'use strict';

  /* 站点根路径：由 <script src> 反推，因此 / 与 /posts/ 下均可用，
     从 file:// 直接打开也能工作。 */
  var SELF = document.currentScript && document.currentScript.src;
  var ROOT = SELF ? new URL('../', SELF) : new URL('./', location.href);

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var on = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); };

  /* ------------------------------------------------------------- 主题切换 */
  function initTheme() {
    var btn = $('#themeToggle');
    if (!btn) return;

    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.1 11.1Z"/></svg>';

    function paint() {
      var dark = document.documentElement.dataset.theme === 'dark';
      btn.innerHTML = dark ? SUN : MOON;
      btn.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
      btn.setAttribute('title', dark ? '浅色模式' : '深色模式');
    }

    on(btn, 'click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      paint();
    });

    paint();
  }

  /* --------------------------------------------------------- 移动端导航 */
  function initNav() {
    var btn = $('#navToggle');
    var nav = $('#siteNav');
    if (!btn || !nav) return;

    on(btn, 'click', function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });

    on(document, 'click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target)) {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ------------------------------------------------------- 目录与滚动高亮 */
  function initToc() {
    var toc = $('#toc');
    var prose = $('.prose');
    if (!toc || !prose) return;

    var heads = $$('h2, h3', prose).filter(function (h) { return h.id || h.textContent.trim(); });
    if (heads.length < 2) { toc.remove(); return; }

    var used = {};
    heads.forEach(function (h, i) {
      if (!h.id) {
        var base = h.textContent.trim().toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || ('section-' + i);
        var id = base, n = 2;
        while (used[id] || document.getElementById(id)) { id = base + '-' + (n++); }
        h.id = id;
      }
      used[h.id] = 1;

      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      if (h.tagName === 'H3') a.className = 'h3';
      toc.appendChild(a);
    });

    var links = $$('a', toc);
    var ticking = false;

    function highlight() {
      var threshold = 100;          // 吸附线：视口顶部往下 100px
      var current = links.length ? links[0] : null;

      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= threshold) current = links[i];
        else break;
      }
      // 滚到底部时强制点亮最后一项
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) {
        current = links[links.length - 1];
      }

      links.forEach(function (a) { a.classList.toggle('active', a === current); });
      ticking = false;
    }

    on(window, 'scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(highlight); }
    }, { passive: true });

    highlight();
  }

  /* --------------------------------------------------------- 代码复制按钮 */
  function initCodeCopy() {
    var blocks = $$('.prose pre');
    if (!blocks.length || !navigator.clipboard) return;

    blocks.forEach(function (pre) {
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = '复制';

      on(btn, 'click', function () {
        var code = $('code', pre) || pre;
        navigator.clipboard.writeText(code.innerText).then(function () {
          btn.textContent = '已复制';
          btn.classList.add('done');
          setTimeout(function () {
            btn.textContent = '复制';
            btn.classList.remove('done');
          }, 1600);
        }).catch(function () {
          btn.textContent = '复制失败';
          setTimeout(function () { btn.textContent = '复制'; }, 1600);
        });
      });

      pre.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------ 阅读进度 */
  function initProgress() {
    var bar = $('#progress span');
    if (!bar) return;

    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
      bar.style.width = pct + '%';
      ticking = false;
    }

    on(window, 'scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    update();
  }

  /* ---------------------------------------------------------- 回到顶部 */
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.id = 'backToTop';
    btn.type = 'button';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);

    on(btn, 'click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    var ticking = false;
    function toggle() {
      btn.classList.toggle('show', window.scrollY > 600);
      ticking = false;
    }
    on(window, 'scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(toggle); }
    }, { passive: true });
  }

  /* -------------------------------------------------------------- 站内搜索 */
  function initSearch() {
    var input = $('#searchInput');
    var hint = $('#searchHint');
    var list = $('#postList');
    if (!input || !list) return;

    var cards = $$('.post-card', list);
    var index = null;

    function apply(filter) {
      var q = filter.trim().toLowerCase();
      var shown = 0;

      if (!q) {
        cards.forEach(function (c) { c.hidden = false; });
        if (hint) hint.textContent = '';
        return;
      }

      if (index) {
        // 全文检索：命中的 slug 集合
        var hits = {};
        index.forEach(function (item) {
          var hay = (item.title + ' ' + (item.excerpt || '') + ' ' +
                     (item.tags || []).join(' ') + ' ' + (item.body || '')).toLowerCase();
          if (hay.indexOf(q) !== -1) hits[item.url] = true;
        });
        cards.forEach(function (c) {
          var link = $('h3 a', c);
          var ok = !!(link && hits[link.getAttribute('href')]);
          c.hidden = !ok;
          if (ok) shown++;
        });
      } else {
        // 回退：仅在卡片可见文本里匹配
        cards.forEach(function (c) {
          var ok = c.textContent.toLowerCase().indexOf(q) !== -1;
          c.hidden = !ok;
          if (ok) shown++;
        });
      }

      if (hint) {
        hint.textContent = shown
          ? ('找到 ' + shown + ' 篇' + (index ? '' : '（仅按标题与摘要匹配）'))
          : '没有匹配的文章';
      }
    }

    on(input, 'input', function () { apply(input.value); });

    // 键盘：按 / 聚焦搜索框
    on(document, 'keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input &&
          !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === 'Escape' && document.activeElement === input) {
        input.value = '';
        apply('');
        input.blur();
      }
    });

    if (location.search.indexOf('q=') !== -1) {
      input.value = decodeURIComponent(location.search.split('q=')[1].split('&')[0]);
      apply(input.value);
    }

    // 异步载入全文索引；失败则保留上面的 DOM 过滤降级
    fetch(new URL('search-index.json', ROOT))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        index = Array.isArray(data) ? data : null;
        if (index && input.value) apply(input.value);
      })
      .catch(function () { /* 无索引时静默回退到 DOM 过滤 */ });
  }

  /* -------------------------------------------------------- 外部链接处理 */
  function initExternalLinks() {
    $$('a[href^="http"]').forEach(function (a) {
      if (a.hostname && a.hostname !== location.hostname) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    initTheme();
    initNav();
    initToc();
    initCodeCopy();
    initProgress();
    initBackToTop();
    initSearch();
    initExternalLinks();

    var year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
