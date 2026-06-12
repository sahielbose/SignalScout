/**
 * Dev visual-check helper: screenshot pages with an injected session cookie.
 *   COOKIE_JAR=/tmp/j.txt BASE=http://localhost:3007 \
 *     pnpm exec tsx scripts/screenshot.ts /feed /icps /login
 * Uses the system Chrome (override with PUPPETEER_EXECUTABLE_PATH).
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:3007';
const OUT = process.env.OUT || '/tmp/ss-shots';
const JAR = process.env.COOKIE_JAR || '/tmp/j.txt';

function parseJar(path: string) {
  if (!existsSync(path)) return [];
  const cookies: { name: string; value: string; domain: string; path: string }[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') && !line.startsWith('#HttpOnly_')) continue;
    const clean = line.replace(/^#HttpOnly_/, '');
    const parts = clean.split('\t');
    if (parts.length < 7) continue;
    cookies.push({ domain: 'localhost', path: parts[2] || '/', name: parts[5]!, value: parts[6]!.trim() });
  }
  return cookies;
}

async function main() {
  const routes = process.argv.slice(2);
  if (routes.length === 0) routes.push('/feed');
  mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });
  const cookies = parseJar(JAR);
  if (cookies.length) await page.setCookie(...cookies);

  for (const route of routes) {
    const url = `${BASE}${route}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    const name = route.replace(/^\//, '').replace(/\//g, '_') || 'home';
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file as `${string}.png` });
    console.log(`✓ ${url} → ${file}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
