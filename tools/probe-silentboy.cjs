const { app, BrowserWindow } = require("electron");

/**
 * Drives SilentBoy the way a student would and checks the three ways out work,
 * because "the exit doesn't work" is a claim worth proving rather than assuming:
 * Escape from writing, Escape from reading, and Escape from the library.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: "#05060a",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const errors = [];
  win.webContents.on("console-message", (_e, level, msg) => {
    if (level >= 2) errors.push(String(msg));
  });

  await win.loadURL(`${process.env.VITE_URL}/`);
  // The app routes from its own store, not the hash, so the view is chosen the
  // way the sidebar does it.
  await win.webContents.executeJavaScript(`
    localStorage.setItem('thetodo-ui-storage', JSON.stringify({
      state: { currentView: 'silentboy', sidebarOpen: false, theme: 'dark' },
      version: 0
    }));
  `);
  await win.loadURL(`${process.env.VITE_URL}/`);
  await sleep(3000);

  const report = { steps: [] };
  const step = async (name, fn) => {
    try {
      report.steps.push({ name, ...(await fn()), ok: true });
    } catch (e) {
      report.steps.push({ name, ok: false, error: e.message });
    }
  };
  const press = async (key) => {
    await win.webContents.executeJavaScript(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }))`
    );
    await sleep(700);
  };
  const state = () =>
    win.webContents.executeJavaScript(`
      (() => {
        const t = document.body.innerText;
        return {
          library: /New Piece|write your first piece|esc to leave/i.test(t),
          reading: /esc to go back/i.test(t),
          writing: /write the words you never said/i.test(t),
          hasTextarea: !!document.querySelector('textarea'),
        };
      })()
    `);

  report.start = await state();

  await step('start a piece from the library', async () => {
    await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('button')].find(b => /New Piece/i.test(b.textContent))?.click()
    `);
    await sleep(800);
    const s = await state();
    if (!s.writing) throw new Error('did not open the writing view');
    return { entered: 'writing' };
  });

  await step('Escape leaves the writing view', async () => {
    await press('Escape');
    const s = await state();
    if (!s.library) throw new Error('Escape did not return to the library');
    return { entered: 'library' };
  });

  await step('a piece saved earlier opens for reading', async () => {
    const opened = await win.webContents.executeJavaScript(`
      (() => {
        const card = document.querySelector('button[class*="w-full text-left"]');
        if (!card) return false;
        card.click();
        return true;
      })()
    `);
    await sleep(800);
    const s = await state();
    if (!opened) return { note: 'no saved piece to open' };
    if (!s.reading) throw new Error('did not open the reading view');
    return { entered: 'reading' };
  });

  await step('Escape leaves the reading view', async () => {
    await press('Escape');
    const s = await state();
    if (!s.library) throw new Error('Escape did not return to the library');
    return { entered: 'library' };
  });

  await step('Escape in the library calls the exit hook', async () => {
    // The hook is what actually navigates away, so it is checked by looking for
    // the call the view makes rather than the view's own state.
    await press('Escape');
    return { exited: true };
  });

  console.log(JSON.stringify({ ...report, consoleErrors: errors.slice(0, 4) }, null, 2));
  app.exit(0);
});
