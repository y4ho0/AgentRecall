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
  for (const language of ["zh", "en"]) {
    await renderer(language => localStorage.setItem('agent-recall-language', language), language);
    await evaluate(`${window}.webContents.reload(); undefined`);
    await delay(1200);
  for (const [width, height] of sizes) {
    await evaluate(`${window}.setContentSize(${width}, ${height}); undefined`);
    await delay(250);
    for (const page of ["workbench", "sessions", "providers"]) {
      await navigate(page);
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
        if (width >= 1728) assert.ok(geometry.formWidth > 1200);
      }
      results.push(geometry);
    }
  }
  }
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
  await fs.writeFile(path.join(outputRoot, "ui-quality-result.json"), JSON.stringify({ results, otherPages, motion }, null, 2));
  return { sizes, languages: ['zh', 'en'], screenshotCount: results.length + otherPages.length + 1, motion, resultFile: path.join(outputRoot, "ui-quality-result.json") };
}
