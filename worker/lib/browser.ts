import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | null = null;
let launching: Promise<Browser> | null = null;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--font-render-hinting=none',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
];

export async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;
  if (launching) return launching;

  launching = puppeteer
    .launch({
      headless: true,
      args: LAUNCH_ARGS,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })
    .then((instance) => {
      browser = instance;
      launching = null;

      instance.once('disconnected', () => {
        if (browser === instance) browser = null;
      });

      return instance;
    })
    .catch((error) => {
      launching = null;
      throw error;
    });

  return launching;
}

export async function withPage<T>(action: (page: Page) => Promise<T>): Promise<T> {
  const instance = await getBrowser();
  const page = await instance.newPage();

  try {
    return await action(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function closeBrowser(): Promise<void> {
  const instance = browser;
  browser = null;

  if (instance?.connected) {
    await instance.close().catch(() => undefined);
  }
}
