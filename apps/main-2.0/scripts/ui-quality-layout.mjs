// Layout assertions run inside the existing isolated native smoke process.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export async function verifyUiQuality({ evaluate, electron, outputRoot, home }) {
  const window = `${electron}.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/renderer/index.html'))`;
  const renderer = (fn, argument) => evaluate(`${window}.webContents.executeJavaScript(${JSON.stringify(`(${fn.toString()})(${JSON.stringify(argument) ?? "undefined"})`)})`);
  const screenshot = async (name) => {
    const png = await evaluate(`(async () => (await ${window}.webContents.capturePage()).toPNG().toString('base64'))()`);
    await fs.writeFile(path.join(outputRoot, name + ".png"), Buffer.from(png, "base64"));
  };
  const navigate = async (page) => {
    await renderer((page) => document.querySelector(`.app-navigation button[data-page="${page}"]`).click(), page);
    await delay(450);
  };
  const sizes = [[1280, 800], [1440, 900], [1728, 1117], [2048, 1286], [1000, 800], [860, 800]];
  const results = [];
  const seedUsageNumbers = () => {
    document.querySelectorAll('.usage-metrics strong').forEach((el, index) => {
      el.textContent = ['999.9K', '99.9K', '999.9M', '98.1%'][index];
    });
  };
  const readOverviewDetails = () => ({
    metrics: [...document.querySelectorAll('.usage-metrics strong')].map(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { text: el.textContent, width: box.width, textWidth: text.width,
        fontSize: parseFloat(getComputedStyle(el).fontSize), clipped: text.width > box.width + 1 };
    }),
    quota: [...document.querySelectorAll('.workbench-quota')].map(el => ({
      iconWidth: el.querySelector('.quota-identity > i').getBoundingClientRect().width,
      nameSize: parseFloat(getComputedStyle(el.querySelector('.quota-identity strong')).fontSize),
      contentGap: el.children[1].getBoundingClientRect().top - el.children[0].getBoundingClientRect().top,
      overflow: el.scrollWidth - el.clientWidth,
    })),
    trendSummaryGap: document.querySelector('.workbench-token-trend-foot > span').getBoundingClientRect().top
      - document.querySelector('.workbench-token-trend-labels').getBoundingClientRect().bottom,
  });
  const assertOverviewDetails = details => {
    for (const metric of details.metrics) {
      assert.equal(metric.clipped, false, JSON.stringify(metric));
      assert.ok(metric.fontSize >= 16 && metric.fontSize <= 26, JSON.stringify(metric));
    }
    for (const quota of details.quota) {
      // Fractional browser zoom rounds CSS pixels to subpixel geometry.
      assert.ok(Math.abs(quota.iconWidth - 32) <= .5, JSON.stringify(quota));
      assert.equal(quota.nameSize, 13);
      assert.ok(Math.abs(quota.contentGap) <= 1 && quota.overflow <= 1, JSON.stringify(quota));
    }
    assert.ok(details.trendSummaryGap >= 20, JSON.stringify(details));
  };
  for (const language of ["zh", "en"]) {
    await renderer(language => localStorage.setItem('agent-recall-language', language), language);
    await evaluate(`${window}.webContents.reload(); undefined`);
    await delay(1200);
  for (const [width, height] of sizes) {
    await evaluate(`${window}.setContentSize(${width}, ${height}); undefined`);
    await delay(250);
    for (const page of ["workbench", "sessions", "providers"]) {
      await navigate(page);
      if (page === 'workbench') await renderer(seedUsageNumbers);
      if (page === "sessions") {
        const deadline = Date.now() + 30_000;
        while (!(await renderer(() => document.querySelectorAll(".session-row").length >= 3))) {
          if (Date.now() > deadline) throw Error("Synthetic sessions did not finish indexing");
          await delay(250);
        }
        await renderer(() => {
          document.querySelectorAll('.section-header[aria-expanded="false"], .tree-chevron[aria-expanded="false"]')
            .forEach(button => button.click());
        });
        await delay(200);
      }
      if (page === "providers") {
        await renderer((home) => {
          [...document.querySelectorAll('.api-provider-switch button')]
            .find(button => button.querySelector('strong')?.textContent === 'Custom')?.click();
          const input = document.querySelector(".provider-path-input input");
          const value = home + "/" + "long-configuration-directory/".repeat(10);
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }, home);
        await delay(500);
      }
      const geometry = await renderer((page) => {
        const rect = (element) => {
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        const controls = [...document.querySelectorAll(".toolbar button, .bulk-result-actions button, .api-target-tabs button, .provider-path-input button, .api-config-actions button")]
          .filter(el => el.getBoundingClientRect().height && el.textContent.trim());
        const surfaces = [...document.querySelectorAll(".app-workspace, .sessions-page .content, .toolbar-secondary, .toolbar-filters, .result-count, .workbench-page-content, .api-config-body")];
        const result = { page, width: innerWidth, height: innerHeight,
          overflow: surfaces.map(el => ({ selector: el.className, overflow: el.scrollWidth - el.clientWidth })),
          controls: controls.map(el => ({ text: el.textContent.trim(), nowrap: getComputedStyle(el).whiteSpace, overflow: el.scrollWidth - el.clientWidth, ...rect(el) })),
        };
        if (page === "workbench") {
          result.cards = [...document.querySelector(".workbench-overview").children].map(rect);
          result.metricsHeaderGap = document.querySelector('.usage-metrics').getBoundingClientRect().top
            - document.querySelector('.workbench-usage-head').getBoundingClientRect().bottom;
          result.metrics = [...document.querySelectorAll('.usage-metrics strong')].map(el => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const text = range.getBoundingClientRect();
            return { center: (text.left + text.right) / 2, alignment: getComputedStyle(el).textAlign };
          });
          result.legend = [...document.querySelectorAll('.workbench-token-legend > span')].map(rect);
          result.workTop = document.querySelector(".workbench-primary-grid").getBoundingClientRect().top;
        }
        if (page === "sessions") {
          result.search = rect(document.querySelector('.toolbar-primary .searchbox'));
          result.filtersTop = document.querySelector('.toolbar-secondary').getBoundingClientRect().top;
          const parent = document.querySelector(".section-header");
          const child = document.querySelector(".nav-group button");
          const font = el => ({ size: parseFloat(getComputedStyle(el).fontSize), weight: Number(getComputedStyle(el).fontWeight), ...rect(el) });
          result.tree = { heading: font(document.querySelector(".session-sidebar-title strong")), parent: font(parent), child: font(child),
            normalChild: font(document.querySelectorAll('.nav-group button')[1]),
            childRows: [...document.querySelectorAll('.nav-group button')].map(font),
            sidebar: rect(document.querySelector(".sidebar")), parentClickableWidth: parent.getBoundingClientRect().width };
          result.tags = [...document.querySelectorAll(".row-tags span")].map(el => {
            const row = el.closest(".session-row");
            const before = row.getBoundingClientRect().height;
            const full = el.textContent;
            el.textContent = "main";
            const shortHeight = row.getBoundingClientRect().height;
            el.textContent = full;
            return { title: el.title, nowrap: getComputedStyle(el).whiteSpace, ellipsis: getComputedStyle(el).textOverflow,
              clipped: el.scrollWidth > el.clientWidth, rowHeight: before, shortHeight,
              mainWidth: row.querySelector('.session-main').getBoundingClientRect().width,
              rowWidth: row.getBoundingClientRect().width, ...rect(el) };
          });
        }
        if (page === "providers") {
          const value = document.querySelector(".codex-config-visualizer strong[title]");
          result.path = { title: value.title, text: value.textContent, clipped: value.scrollWidth > value.clientWidth };
          result.formWidth = document.querySelector(".api-settings-form").getBoundingClientRect().width;
        }
        return result;
      }, page);
      geometry.language = language;
      if (page === 'workbench') {
        geometry.readability = await renderer(readOverviewDetails);
        assertOverviewDetails(geometry.readability);
      }
      await fs.writeFile(path.join(outputRoot, "ui-quality-last-geometry.json"), JSON.stringify(geometry, null, 2));
      await screenshot(`${page}-${language}-${width}x${height}`);
      assert.equal(geometry.width, width);
      for (const surface of geometry.overflow) assert.ok(surface.overflow <= 1, JSON.stringify(geometry));
      for (const control of geometry.controls) {
        assert.equal(control.nowrap, "nowrap", JSON.stringify(control));
        assert.ok(control.overflow <= 1, JSON.stringify(control));
      }
      if (geometry.tree) {
        assert.ok(geometry.search.width >= 230, JSON.stringify(geometry.search));
        assert.ok(geometry.search.bottom <= geometry.filtersTop);
        assert.equal(geometry.tree.heading.size, 14);
        assert.equal(geometry.tree.parent.size, 13);
        assert.equal(geometry.tree.child.size, 12);
        assert.equal(geometry.tree.normalChild.size, 12);
        assert.equal(geometry.tree.normalChild.weight, 400);
        assert.equal(geometry.tree.parent.weight, 600);
        assert.ok(geometry.tree.parentClickableWidth >= geometry.tree.sidebar.width - 32, JSON.stringify(geometry.tree));
        assert.equal(geometry.tree.child.height, 28);
        for (const row of geometry.tree.childRows) assert.equal(row.height, 28);
        assert.ok(geometry.tags.some(tag => tag.title.includes("frontend-storage-foundation")));
        assert.ok(geometry.tags.some(tag => tag.clipped));
        for (const tag of geometry.tags) {
          assert.equal(tag.nowrap, "nowrap");
          assert.equal(tag.ellipsis, "ellipsis");
          assert.equal(tag.rowHeight, tag.shortHeight);
          assert.ok(tag.mainWidth >= tag.rowWidth * .6, JSON.stringify(tag));
          if (tag.title === 'main') assert.equal(tag.clipped, false);
        }
      }
      if (geometry.cards) {
        assert.ok(geometry.metricsHeaderGap >= 16, 'Usage metrics need breathing room below the header controls');
        assert.equal(geometry.metrics.length, 4);
        const metricStep = geometry.metrics[1].center - geometry.metrics[0].center;
        for (let i = 0; i < geometry.metrics.length; i++) {
          assert.equal(geometry.metrics[i].alignment, 'center');
          if (i > 0) assert.ok(Math.abs(geometry.metrics[i].center - geometry.metrics[i - 1].center - metricStep) <= 1,
            'Usage metric centers must be evenly spaced');
        }
        assert.ok(Math.max(...geometry.cards.map(card => card.bottom)) < geometry.workTop);
        for (const card of geometry.cards) assert.ok(card.right <= width);
        for (let i = 1; i < geometry.legend.length; i++) {
          const previous = geometry.legend[i - 1];
          const current = geometry.legend[i];
          assert.ok(current.top >= previous.bottom || current.left >= previous.right, 'Usage legend overlaps');
        }
      }
      if (geometry.path) {
        assert.equal(geometry.path.text, geometry.path.title);
        assert.ok(geometry.path.title.startsWith(home));
        assert.ok(geometry.formWidth <= 1120, JSON.stringify(geometry.formWidth));
        if (width >= 1728) assert.ok(geometry.formWidth >= 1000);
      }
      results.push(geometry);
    }
  }
  }
  const zoomResults = [];
  try {
    await navigate('workbench');
    for (const width of [1120, 1280, 1728]) {
      await evaluate(`${window}.setContentSize(${width}, 900); undefined`);
      for (const zoom of [.8, 1, 1.25, 1.5]) {
        await evaluate(`${window}.webContents.setZoomFactor(${zoom}); undefined`);
        await delay(250);
        await renderer(seedUsageNumbers);
        const details = await renderer(readOverviewDetails);
        assertOverviewDetails(details);
        zoomResults.push({ width, zoom, ...details });
        await screenshot(`workbench-zoom-${zoom}-${width}`);
      }
    }
  } finally { await evaluate(`${window}.webContents.setZoomFactor(1); undefined`); }
  await evaluate(`${window}.setContentSize(1280, 800); undefined`);
  const otherPages = [];
  for (const page of ['team-chat', 'runtimes', 'workflows', 'evaluation', 'memories', 'skills', 'mcp']) {
    await navigate(page);
    const layout = await renderer(() => ({ overflow: document.querySelector('.app-workspace').scrollWidth - document.querySelector('.app-workspace').clientWidth,
      textLength: document.querySelector('.app-page-host').innerText.length }));
    assert.ok(layout.textLength > 10);
    assert.ok(layout.overflow <= 1, JSON.stringify({page, ...layout}));
    otherPages.push({page, ...layout});
    await screenshot(`${page}-en-1280x800`);
  }
  await renderer(() => document.querySelector('.app-navigation-settings').click());
  await delay(400);
  await screenshot('settings-en-1280x800');
  assert.equal(await renderer(() => getComputedStyle(document.querySelector('.settings-dialog')).borderRadius), '18px');
  const settingsFeedback = await renderer(() => {
    const el = document.querySelector('.settings-feedback');
    el.textContent = 'Synthetic settings diagnostic: ' + 'unbroken-error-'.repeat(100);
    const dialog = document.querySelector('.settings-dialog');
    const range = document.createRange(); range.selectNodeContents(el);
    return { overflow: el.scrollWidth - el.clientWidth, height: el.getBoundingClientRect().height,
      textInset:range.getBoundingClientRect().top - el.getBoundingClientRect().top,
      sidebarBottom:document.querySelector('.settings-sidebar').getBoundingClientRect().bottom,
      feedbackTop:el.getBoundingClientRect().top,
      padding: parseFloat(getComputedStyle(el).paddingBottom), dialogOverflow:dialog.scrollWidth - dialog.clientWidth };
  });
  assert.ok(settingsFeedback.overflow <= 1 && settingsFeedback.dialogOverflow <= 1 && settingsFeedback.height <= 120 && settingsFeedback.padding >= 10, JSON.stringify(settingsFeedback));
  assert.ok(settingsFeedback.textInset >= 10 && settingsFeedback.sidebarBottom <= settingsFeedback.feedbackTop, JSON.stringify(settingsFeedback));
  await screenshot('settings-long-error-en-1280x800');
  // Settings is a modal: close via its existing Escape handler.
  await evaluate(`${window}.webContents.sendInputEvent({type:'keyDown', keyCode:'ESC'}); undefined`);
  await delay(150);
  await navigate("sessions");
  const motion = await renderer(async () => {
    const parent = document.querySelector(".section-header");
    const child = parent.nextElementSibling;
    parent.focus();
    const openHeight = child.getBoundingClientRect().height;
    parent.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const immediate = { expanded: parent.getAttribute("aria-expanded"), inert: child.inert, focus: document.activeElement === parent };
    await new Promise(resolve => setTimeout(resolve, 180));
    const closedHeight = child.getBoundingClientRect().height;
    parent.click();
    await new Promise(resolve => setTimeout(resolve, 220));
    return { immediate, openHeight, closedHeight, reopenedHeight: child.getBoundingClientRect().height,
      duration: getComputedStyle(child).transitionDuration };
  });
  assert.deepEqual(motion.immediate, { expanded: "false", inert: true, focus: true });
  assert.equal(motion.closedHeight, 0);
  assert.ok(motion.openHeight > 0 && motion.reopenedHeight > 0);
  await evaluate(`${window}.webContents.debugger.attach('1.3'); undefined`);
  try {
    await evaluate(`${window}.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]})`);
    const reduced = await renderer(() => ({ matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: getComputedStyle(document.querySelector('.session-disclosure')).transitionDuration }));
    assert.equal(reduced.matches, true);
    assert.equal(reduced.duration, "0s");
    motion.reduced = reduced;
  } finally { await evaluate(`${window}.webContents.debugger.detach(); undefined`); }
  const interactions = [];
  const pageNames = ['workbench', 'sessions', 'team-chat', 'runtimes', 'workflows', 'evaluation', 'memories', 'skills', 'mcp', 'providers'];
  for (const [width, height] of [[1728, 1000], [1000, 700], [860, 560]]) {
    await evaluate(`${window}.setContentSize(${width}, ${height}); undefined`);
    let reference;
    for (const page of pageNames) {
      await navigate(page);
      const readyDeadline = Date.now() + 10_000;
      while (!(await renderer(() => Boolean(document.querySelector('.app-page-head'))))) {
        if (Date.now() > readyDeadline) {
          await screenshot(`header-not-ready-${page}-${width}`);
          throw Error(`Page header did not become ready: ${page} at ${width}`);
        }
        await delay(200);
      }
      await fs.writeFile(path.join(outputRoot, 'ui-interaction-progress.json'), JSON.stringify({page, width, height, interactions}, null, 2));
      const header = await renderer(() => {
        const root = document.querySelector('.app-page-host').getBoundingClientRect();
        const head = document.querySelector('.app-page-head');
        const title = head.querySelector('h2');
        const description = head.querySelector('p');
        return { x: title.getBoundingClientRect().left - root.left, y: title.getBoundingClientRect().top - root.top,
          titleSize: getComputedStyle(title).fontSize, descriptionSize: getComputedStyle(description).fontSize,
          gap: description.getBoundingClientRect().top - title.getBoundingClientRect().bottom };
      });
      reference ??= header;
      assert.deepEqual(header, reference, JSON.stringify({page, width, header, reference}));
      interactions.push({page, width, height, header});
      if (page === 'workbench') {
        await renderer(() => document.querySelector('.workbench-usage-actions button').click());
        await delay(700);
        const feedback = await renderer(() => {
          const el = document.querySelector('.workbench-feedback');
          const r = el.getBoundingClientRect();
          const parent = el.parentElement.getBoundingClientRect();
          return { text: el.textContent, inset: parent.bottom - r.bottom, padding: parseFloat(getComputedStyle(el).paddingBottom),
            position: getComputedStyle(el).position, overflow: el.scrollWidth - el.clientWidth };
        });
        assert.ok(feedback.text.length > 0 && feedback.inset >= 12 && feedback.padding >= 8, JSON.stringify(feedback));
        assert.equal(feedback.position, 'static');
        assert.ok(feedback.overflow <= 1);
        interactions.push({page, width, feedback});
      }
      if (['runtimes', 'workflows', 'skills'].includes(page)) {
        const before = await renderer(() => Number(document.querySelector('.pane-resize-handle').getAttribute('aria-valuenow')));
        const point = await renderer(() => {
          const el = document.querySelector('.pane-resize-handle');
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(40, r.height / 2)) };
        });
        for (const event of [{type:'mouseDown', ...point, button:'left', clickCount:1},
          {type:'mouseMove', x:point.x + 32, y:point.y, button:'left'},
          {type:'mouseUp', x:point.x + 32, y:point.y, button:'left', clickCount:1}]) {
          await evaluate(`${window}.webContents.sendInputEvent(${JSON.stringify(event)}); undefined`);
          await delay(70);
        }
        const dragged = await renderer(() => Number(document.querySelector('.pane-resize-handle').getAttribute('aria-valuenow')));
        assert.ok(dragged > before, JSON.stringify({page, width, before, dragged}));
        await renderer(() => document.querySelector('.pane-resize-handle').focus());
        await evaluate(`${window}.webContents.sendInputEvent({type:'keyDown', keyCode:'END'}); undefined`);
        await delay(100);
        const split = await renderer(() => {
          const el = document.querySelector('.pane-resize-handle');
          const parent = el.parentElement;
          return { value: Number(el.getAttribute('aria-valuenow')), max: Number(el.getAttribute('aria-valuemax')),
            overflow: parent.scrollWidth - parent.clientWidth, cursor: document.body.style.cursor };
        });
        assert.equal(split.value, split.max);
        assert.ok(split.overflow <= 1, JSON.stringify({page, width, split}));
        assert.notEqual(split.cursor, 'col-resize');
        if (page === 'runtimes') {
          const runtime = await renderer(() => {
            const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
            const balance = document.querySelector('.runtime-summary-balance');
            const actions = document.querySelector('.runtime-summary-actions');
            return { balance:rect(balance), actions:rect(actions), width:document.querySelector('.runtime-editor').getBoundingClientRect().width,
              overflow: [...document.querySelectorAll('.runtime-config-summary, .runtime-summary-balance, .runtime-summary-actions')].map(el => el.scrollWidth - el.clientWidth) };
          });
          assert.ok(runtime.width <= 1120);
          assert.ok(runtime.actions.top >= runtime.balance.bottom || runtime.actions.left >= runtime.balance.right, JSON.stringify(runtime));
          assert.ok(runtime.overflow.every(value => value <= 1), JSON.stringify(runtime));
          interactions.push({page, width, runtime});
        }
        await screenshot(`interaction-${page}-${width}x${height}`);
        // Return to the default width, then verify it survives page unmount/remount.
        await renderer(() => document.querySelector('.pane-resize-handle').dispatchEvent(new MouseEvent('dblclick', {bubbles:true})));
        const reset = await renderer(() => Number(document.querySelector('.pane-resize-handle').getAttribute('aria-valuenow')));
        await navigate('workbench');
        await navigate(page);
        assert.equal(await renderer(() => Number(document.querySelector('.pane-resize-handle').getAttribute('aria-valuenow'))), reset);
        interactions.push({page, width, before, dragged, split, reset});
      } else if (page === 'providers') {
        await renderer(() => [...document.querySelectorAll('.api-provider-switch button')].find(el => el.querySelector('strong')?.textContent === 'Custom').click());
        await delay(200);
        await renderer(() => document.querySelector('.codex-model-detect-button').click());
        await delay(700);
        // First verify a real local validation failure, then use the same CSS
        // in a synthetic fixture. React may refresh the live error while capturing.
        const error = await renderer(() => {
          const source = document.querySelector('.settings-field .api-config-status.error');
          const original = source.textContent;
          const el = source.cloneNode(true);
          el.dataset.syntheticDiagnostic = 'true';
          source.after(el);
          el.textContent = 'Synthetic diagnostic: ' + 'unbrokendetail'.repeat(60);
          const body = document.querySelector('.api-config-body');
          body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 80;
          const range = document.createRange(); range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          const parent = el.parentElement.getBoundingClientRect();
          return { original, overflow:el.scrollWidth - el.clientWidth, contained:r.left >= parent.left && r.right <= parent.right && r.bottom <= parent.bottom,
            span:getComputedStyle(el).gridColumn, presets:[...document.querySelectorAll('.api-provider-switch button')].map(button => ({width:button.getBoundingClientRect().width,
              height:button.getBoundingClientRect().height, paddingX:parseFloat(getComputedStyle(button).paddingLeft), paddingY:parseFloat(getComputedStyle(button).paddingTop)})) };
        });
        assert.ok(error.original.length > 0 && error.contained && error.overflow <= 1, JSON.stringify(error));
        assert.ok(error.presets.every(value => value.width >= 200 && value.width <= 248.5 && value.height >= 64 && value.paddingX >= 16 && value.paddingY >= 12), JSON.stringify(error));
        interactions.push({page, width, error});
        await delay(100);
        await screenshot(`interaction-${page}-${width}x${height}`);
        await renderer(() => document.querySelector('[data-synthetic-diagnostic]')?.remove());
      } else if (page === 'workbench') await screenshot(`interaction-${page}-${width}x${height}`);
    }
  }
  try {
    await evaluate(`${window}.webContents.setZoomFactor(1.5); undefined`);
    for (const page of ['runtimes', 'workflows', 'skills']) {
      await navigate(page);
      const stacked = await renderer(() => {
        const split = document.querySelector('.resizable-split');
        const handle = split.querySelector('.pane-resize-handle');
        return {stacked:split.dataset.stacked, handleDisplay:getComputedStyle(handle).display,
          overflow:split.scrollWidth - split.clientWidth, tabIndex:handle.tabIndex};
      });
      assert.equal(stacked.stacked, 'true', JSON.stringify({page, stacked}));
      assert.equal(stacked.handleDisplay, 'none');
      assert.equal(stacked.tabIndex, -1);
      assert.ok(stacked.overflow <= 1, JSON.stringify({page, stacked}));
      interactions.push({page, width:860, zoom:1.5, stacked});
      await screenshot(`stacked-${page}-zoom-1.5`);
    }
  } finally { await evaluate(`${window}.webContents.setZoomFactor(1); undefined`); }
  await fs.writeFile(path.join(outputRoot, "ui-quality-result.json"), JSON.stringify({ results, zoomResults, otherPages, motion, interactions, settingsFeedback }, null, 2));
  return { sizes, languages: ['zh', 'en'], screenshotCount: results.length + zoomResults.length + otherPages.length + 20, motion, resultFile: path.join(outputRoot, "ui-quality-result.json") };
}
