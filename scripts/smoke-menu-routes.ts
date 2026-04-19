import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  attachPageIssueCollector,
  ensureDevServices,
  getArgValue,
  getHostFromUrl,
  getPortFromUrl,
  hasFlag,
  login,
  sanitizeFileName,
  stopManagedProcess,
  waitForAppSettled,
} from './lib/ui-smoke';

interface MenuNode {
  id?: string;
  title?: string;
  path?: string;
  children?: MenuNode[];
}

interface RouteIssue {
  route: string;
  finalUrl: string;
  title: string;
  is404: boolean;
  apiErrors: Array<{ url: string; status: number }>;
  pageErrors: string[];
  screenshotPath?: string;
}

interface SmokeReport {
  baseUrl: string;
  loginUser: string;
  menuCount: number;
  menuTitles: string[];
  routes: RouteIssue[];
  checkedAt: string;
}

function flattenMenuRoutes(nodes: MenuNode[], routes = new Map<string, string>()): Map<string, string> {
  for (const node of nodes) {
    if (node.path && node.path.startsWith('/')) {
      routes.set(node.path, node.title || node.path);
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenMenuRoutes(node.children, routes);
    }
  }

  return routes;
}

function normalizeMenuTree(payload: unknown): MenuNode[] {
  if (Array.isArray(payload)) {
    return payload as MenuNode[];
  }

  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: MenuNode[] }).data;
  }

  return [];
}

async function loadMenuTree(page: import('playwright').Page): Promise<MenuNode[]> {
  return page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/admin/menus/user', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.json();
  }).then(normalizeMenuTree);
}

async function main() {
  const baseUrl = getArgValue('--base-url', process.env.MENU_SMOKE_BASE_URL || 'http://127.0.0.1:5173');
  const username = getArgValue('--username', process.env.MENU_SMOKE_USERNAME || 'admin');
  const password = getArgValue('--password', process.env.MENU_SMOKE_PASSWORD || 'admin123');
  const ensureServices = hasFlag('--ensure-services');
  const frontendHost = getHostFromUrl(baseUrl, '127.0.0.1');
  const frontendPort = getPortFromUrl(baseUrl, 5173);
  const apiHost = getArgValue('--api-host', process.env.MENU_SMOKE_API_HOST || '127.0.0.1');
  const apiPort = Number(getArgValue('--api-port', process.env.MENU_SMOKE_API_PORT || '3000'));
  const logsDir = path.join(process.cwd(), '.codex-logs');
  const serviceLogsDir = path.join(logsDir, 'menu-smoke-services');
  const failuresDir = path.join(logsDir, 'menu-route-failures');
  const reportPath = path.join(logsDir, 'menu-route-report.json');
  const summaryScreenshotPath = path.join(logsDir, 'menu-route-summary.png');

  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(serviceLogsDir, { recursive: true });
  fs.mkdirSync(failuresDir, { recursive: true });

  const managedProcesses = await ensureDevServices({
    ensureServices,
    frontendHost,
    frontendPort,
    apiHost,
    apiPort,
    logsDir: serviceLogsDir,
    backendLogFileName: 'menu-smoke-backend.log',
    frontendLogFileName: 'menu-smoke-frontend.log',
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    await login(page, baseUrl, username, password);
    await page.screenshot({ path: summaryScreenshotPath, fullPage: true });

    const menuTree = await loadMenuTree(page);
    const routeMap = flattenMenuRoutes(menuTree);
    const menuTitles = [...routeMap.values()];
    const routes = [...routeMap.keys()];

    const report: SmokeReport = {
      baseUrl,
      loginUser: username,
      menuCount: routes.length,
      menuTitles,
      routes: [],
      checkedAt: new Date().toISOString(),
    };

    for (const route of routes) {
      const issues = attachPageIssueCollector(page);

      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
        await waitForAppSettled(page);
      } finally {
        issues.detach();
      }

      const title = await page.title();
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const finalUrl = page.url().replace(baseUrl, '');
      const is404 = title.includes('页面不存在')
        || bodyText.includes('页面不存在')
        || /^404\b/m.test(bodyText);

      const routeIssue: RouteIssue = {
        route,
        finalUrl,
        title,
        is404,
        apiErrors: issues.apiErrors,
        pageErrors: issues.pageErrors,
      };

      if (is404 || issues.apiErrors.length > 0 || issues.pageErrors.length > 0) {
        const screenshotPath = path.join(failuresDir, `${sanitizeFileName(route)}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        routeIssue.screenshotPath = screenshotPath;
      }

      report.routes.push(routeIssue);
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    const failedRoutes = report.routes.filter(
      (item) => item.is404 || item.apiErrors.length > 0 || item.pageErrors.length > 0
    );

    console.log(JSON.stringify({
      reportPath,
      summaryScreenshotPath,
      ensureServices,
      startedServices: managedProcesses.map((item) => ({
        name: item.name,
        logPath: item.logPath,
      })),
      checked: report.routes.length,
      failed: failedRoutes.length,
      failedRoutes,
    }, null, 2));

    if (failedRoutes.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    for (const processInfo of managedProcesses.reverse()) {
      stopManagedProcess(processInfo);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
