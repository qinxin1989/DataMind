import fs from 'fs';
import path from 'path';
import { chromium, type Page } from 'playwright';
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

interface FlowResult {
  name: string;
  route: string;
  finalUrl: string;
  passed: boolean;
  checks: string[];
  apiErrors: Array<{ url: string; status: number }>;
  pageErrors: string[];
  failureReason?: string;
  screenshotPath?: string;
}

interface BusinessSmokeReport {
  baseUrl: string;
  loginUser: string;
  flowCount: number;
  flows: FlowResult[];
  checkedAt: string;
}

interface FlowContext {
  page: Page;
  baseUrl: string;
  checks: string[];
}

interface FlowDefinition {
  name: string;
  route: string;
  execute: (context: FlowContext) => Promise<void>;
}

async function getBodyText(page: Page): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

async function assertBodyContains(page: Page, text: string, checks: string[]): Promise<void> {
  const bodyText = await getBodyText(page);
  if (!bodyText.includes(text)) {
    throw new Error(`页面未出现预期文案: ${text}`);
  }

  checks.push(`文案正常: ${text}`);
}

async function assertVisible(page: Page, selector: string, checks: string[], label: string): Promise<void> {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
  checks.push(`元素可见: ${label}`);
}

async function assertPlaceholder(page: Page, placeholder: string, checks: string[]): Promise<void> {
  await page.getByPlaceholder(placeholder).first().waitFor({ state: 'visible', timeout: 10000 });
  checks.push(`输入框可见: ${placeholder}`);
}

async function assertAssistantProfilesApi(page: Page, checks: string[]): Promise<void> {
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/assistant/profiles', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const payload = await response.json().catch(() => null);
    return {
      status: response.status,
      ids: Array.isArray(payload?.data)
        ? payload.data.map((item: { id?: string }) => item.id).filter(Boolean)
        : [],
    };
  });

  if (result.status !== 200) {
    throw new Error(`统一助手 profile 接口异常: HTTP ${result.status}`);
  }

  const expectedIds = ['general', 'data-qa', 'crawler', 'knowledge', 'document'];
  for (const id of expectedIds) {
    if (!result.ids.includes(id)) {
      throw new Error(`统一助手 profile 接口缺少模式: ${id}`);
    }
  }

  checks.push('接口正常: /api/assistant/profiles');
}

async function assertNot404(page: Page, routeLabel: string, checks: string[]): Promise<void> {
  const title = await page.title();
  const bodyText = await getBodyText(page);
  const is404 = title.includes('页面不存在')
    || bodyText.includes('页面不存在')
    || /^404\b/m.test(bodyText);

  if (is404) {
    throw new Error(`${routeLabel} 打开成了 404 页面`);
  }

  checks.push(`路由正常: ${routeLabel}`);
}

async function visitRoute(page: Page, baseUrl: string, route: string, checks: string[], label: string): Promise<void> {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);
  await assertNot404(page, label, checks);
}

async function clickAssistantProfile(page: Page, title: string, checks: string[]): Promise<void> {
  await page.locator('.profile-item').filter({ hasText: title }).first().click();
  await waitForAppSettled(page);
  checks.push(`模式切换: ${title}`);
}

async function closeVisibleDrawer(page: Page): Promise<void> {
  const closeButton = page.locator('.ant-drawer .ant-drawer-close').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(500);
  }
}

async function runFlow(
  page: Page,
  baseUrl: string,
  failuresDir: string,
  flow: FlowDefinition
): Promise<FlowResult> {
  const checks: string[] = [];
  const issues = attachPageIssueCollector(page);
  let failureReason: string | undefined;

  try {
    await visitRoute(page, baseUrl, flow.route, checks, flow.name);
    await flow.execute({ page, baseUrl, checks });
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error);
  } finally {
    issues.detach();
  }

  const result: FlowResult = {
    name: flow.name,
    route: flow.route,
    finalUrl: page.url().replace(baseUrl, ''),
    passed: !failureReason && issues.apiErrors.length === 0 && issues.pageErrors.length === 0,
    checks,
    apiErrors: issues.apiErrors,
    pageErrors: issues.pageErrors,
    failureReason,
  };

  if (!result.passed) {
    const screenshotPath = path.join(failuresDir, `${sanitizeFileName(flow.name)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshotPath = screenshotPath;
  }

  return result;
}

function createFlowDefinitions(): FlowDefinition[] {
  return [
    {
      name: '统一助手模式切换',
      route: '/ai/assistant',
      execute: async ({ page, checks }) => {
        await assertAssistantProfilesApi(page, checks);
        await assertBodyContains(page, '智能助手工作台', checks);
        await assertBodyContains(page, '通用模式不会主动执行 SQL', checks);

        await clickAssistantProfile(page, '数据分析助手', checks);
        await assertBodyContains(page, '选择数据源', checks);

        await clickAssistantProfile(page, '知识库助手', checks);
        await assertBodyContains(page, '知识分类', checks);
        await assertBodyContains(page, '指定文档', checks);

        await clickAssistantProfile(page, '智能采集助手', checks);
        await assertBodyContains(page, '打开高级采集助手', checks);

        await clickAssistantProfile(page, '文档助手', checks);
        await assertBodyContains(page, '适合处理制度', checks);
      },
    },
    {
      name: '知识中心主子页面',
      route: '/ai/knowledge/manage',
      execute: async ({ page, baseUrl, checks }) => {
        await assertBodyContains(page, '知识中心', checks);
        await assertBodyContains(page, '知识库分类', checks);
        await assertBodyContains(page, '全文检索', checks);
        await assertPlaceholder(page, '搜索文档标签或标题...', checks);

        await visitRoute(page, baseUrl, '/ai/knowledge/qa', checks, '知识中心 / 智能问答');
        await assertBodyContains(page, '我是您的知识助手', checks);
        await assertPlaceholder(page, '输入您的问题 (Shift + Enter 换行)...', checks);

        await visitRoute(page, baseUrl, '/ai/knowledge/writer', checks, '知识中心 / 长文写作');
        await assertBodyContains(page, '写作配置', checks);
        await assertBodyContains(page, '文章主题', checks);
        await assertBodyContains(page, '生成大纲', checks);

        await visitRoute(page, baseUrl, '/ai/knowledge/graph', checks, '知识中心 / 知识图谱');
        await assertVisible(page, 'input[placeholder="搜索实体..."]', checks, '知识图谱搜索框');
      },
    },
    {
      name: '采集助手结构页',
      route: '/collection/assistant',
      execute: async ({ page, checks }) => {
        await assertBodyContains(page, 'AI 爬虫助手', checks);
        await assertBodyContains(page, '历史对话', checks);
        await assertBodyContains(page, '新建对话', checks);
        await assertPlaceholder(page, '例如：帮我爬取 https://example.com 新闻列表的标题、链接和发布时间', checks);
        await assertBodyContains(page, '网页预览', checks);
        await assertBodyContains(page, '选择器可视化', checks);
        await assertBodyContains(page, '数据预览', checks);

        await page.getByRole('button', { name: '历史对话' }).click();
        await waitForAppSettled(page);
        await assertBodyContains(page, '对话历史', checks);
        checks.push('交互正常: 打开历史对话抽屉');
        await closeVisibleDrawer(page);
      },
    },
  ];
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
  const serviceLogsDir = path.join(logsDir, 'business-smoke-services');
  const failuresDir = path.join(logsDir, 'business-flow-failures');
  const reportPath = path.join(logsDir, 'business-flow-report.json');
  const summaryScreenshotPath = path.join(logsDir, 'business-flow-summary.png');

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
    backendLogFileName: 'business-smoke-backend.log',
    frontendLogFileName: 'business-smoke-frontend.log',
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    await login(page, baseUrl, username, password);

    const flows = createFlowDefinitions();
    const results: FlowResult[] = [];

    for (const flow of flows) {
      results.push(await runFlow(page, baseUrl, failuresDir, flow));
    }

    await page.screenshot({ path: summaryScreenshotPath, fullPage: true });

    const report: BusinessSmokeReport = {
      baseUrl,
      loginUser: username,
      flowCount: results.length,
      flows: results,
      checkedAt: new Date().toISOString(),
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    const failedFlows = results.filter((item) => !item.passed);

    console.log(JSON.stringify({
      reportPath,
      summaryScreenshotPath,
      ensureServices,
      startedServices: managedProcesses.map((item) => ({
        name: item.name,
        logPath: item.logPath,
      })),
      checked: results.length,
      failed: failedFlows.length,
      failedFlows,
    }, null, 2));

    if (failedFlows.length > 0) {
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
