import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const BASE_URL = 'http://127.0.0.1:3000';
const LOGIN_URL = `${BASE_URL}/login`;
const OUTPUT_DIR = path.join(ROOT, 'tmp');
const REPORT_PATH = path.join(OUTPUT_DIR, 'assistant-ui-smoke.json');
const ASSISTANT_SCREENSHOT = path.join(OUTPUT_DIR, 'assistant-ui-smoke-assistant.png');
const CHAT_SCREENSHOT = path.join(OUTPUT_DIR, 'assistant-ui-smoke-chat.png');
const BACKEND_LOG_PATH = path.join(OUTPUT_DIR, 'assistant-ui-smoke-backend.log');
const UPLOAD_FILE = path.join(OUTPUT_DIR, 'assistant-ui-smoke-upload.txt');
const UPLOAD_FILENAME = path.basename(UPLOAD_FILE);
const credentials = { username: 'admin', password: 'admin123' };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(host, port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortListening(host, port)) {
      return;
    }
    await sleep(1000);
  }
  const tail = fs.existsSync(BACKEND_LOG_PATH)
    ? fs.readFileSync(BACKEND_LOG_PATH, 'utf8').slice(-4000)
    : '';
  throw new Error(`服务未在 ${timeoutMs}ms 内启动。日志尾部：\n${tail}`);
}

function startBackend() {
  fs.writeFileSync(BACKEND_LOG_PATH, '', 'utf8');
  const output = fs.createWriteStream(BACKEND_LOG_PATH, { flags: 'a' });
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm.cmd start'], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    : spawn('npm', ['start'], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

  child.stdout?.pipe(output);
  child.stderr?.pipe(output);
  return child;
}

function stopBackend(child) {
  if (!child?.pid) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(child.pid, 'SIGTERM');
  } catch {
    // ignore
  }
}

async function waitForAppSettled(page, delay = 1800) {
  await page.waitForLoadState('domcontentloaded');
  await sleep(delay);
}

async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill(credentials.username);
  await page.getByPlaceholder('密码').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.location.pathname === '/workbench', undefined, { timeout: 20000 });
  await waitForAppSettled(page);
}

function attachCollector(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const apiErrors = [];

  const onConsole = (entry) => {
    if (entry.type() === 'error') {
      consoleErrors.push(entry.text());
    }
  };
  const onPageError = (error) => {
    pageErrors.push(String(error));
  };
  const onResponse = (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiErrors.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  return {
    consoleErrors,
    pageErrors,
    apiErrors,
    detach() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
    },
  };
}

async function runAssistantFlow(page) {
  await page.goto(`${BASE_URL}/ai/assistant`, { waitUntil: 'networkidle' });
  await waitForAppSettled(page);

  const beforeCount = await page.locator('.session-item').count();
  await page.getByRole('button', { name: '新建对话' }).first().click();
  await page.waitForFunction(() => new URL(window.location.href).searchParams.has('session'), undefined, { timeout: 15000 });
  await waitForAppSettled(page);
  const afterCreateCount = await page.locator('.session-item').count();

  await page.locator('input[type="file"]').setInputFiles(UPLOAD_FILE);
  await page.getByText(UPLOAD_FILENAME).waitFor({ timeout: 15000 });

  const prompt = '请用三句话总结当前统一助手工作台的作用。';
  await page.locator('textarea:not([aria-hidden="true"])').first().fill(prompt);
  await page.getByRole('button', { name: '发送' }).click();
  await page.locator('.message-row.user .message-bubble').filter({ hasText: prompt }).first().waitFor({ timeout: 15000 });

  let responseState = 'timeout';
  try {
    await page.waitForFunction(() => {
      const items = Array.from(document.querySelectorAll('.message-row.assistant .message-bubble'));
      return items.some((node) => ((node.textContent || '').trim().length > 0));
    }, undefined, { timeout: 90000 });
    responseState = 'assistant-message';
  } catch {
    try {
      await page.getByText(/处理失败|当前没有可用的 AI 配置|统一助手执行失败|AI配置不存在/).first().waitFor({ timeout: 5000 });
      responseState = 'assistant-error';
    } catch {
      responseState = 'no-visible-response';
    }
  }

  await waitForAppSettled(page, 1200);

  const assistantMessages = (await page.locator('.message-row.assistant .message-bubble').allInnerTexts())
    .map((item) => item.trim())
    .filter(Boolean);
  const userMessages = (await page.locator('.message-row.user .message-bubble').allInnerTexts())
    .map((item) => item.trim())
    .filter(Boolean);
  const hasDeleteButton = await page.getByRole('button', { name: '删除这组' }).first().isVisible().catch(() => false);
  let deletedPair = false;

  if (hasDeleteButton) {
    await page.getByRole('button', { name: '删除这组' }).first().click();
    const confirmButton = page.locator('.ant-modal-confirm .ant-btn-dangerous').last();
    const modalVisible = await confirmButton.isVisible().catch(() => false);
    if (modalVisible) {
      await confirmButton.click();
      await page.waitForFunction((targetPrompt) => {
        const texts = Array.from(document.querySelectorAll('.message-row.user .message-bubble')).map((node) => (node.textContent || '').trim());
        return !texts.includes(targetPrompt);
      }, prompt, { timeout: 20000 });
      await waitForAppSettled(page);
      deletedPair = true;
    }
  }

  await page.screenshot({ path: ASSISTANT_SCREENSHOT, fullPage: true });
  const sessionUrl = new URL(page.url());
  const createdSessionId = sessionUrl.searchParams.get('session');

  let cleanedUp = false;
  if (createdSessionId) {
    cleanedUp = await page.evaluate(async (sessionId) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/assistant/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return response.ok;
    }, createdSessionId).catch(() => false);
  }

  return {
    url: page.url(),
    createdSessionId,
    beforeCount,
    afterCreateCount,
    uploadedFileVisible: await page.getByText(UPLOAD_FILENAME).isVisible().catch(() => false),
    prompt,
    responseState,
    userMessages,
    assistantMessages,
    deletedPair,
    cleanedUp,
  };
}

async function runChatFlow(page) {
  await page.goto(`${BASE_URL}/ai/chat`, { waitUntil: 'networkidle' });
  await waitForAppSettled(page);
  await page.screenshot({ path: CHAT_SCREENSHOT, fullPage: true });

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const dsItems = await page.locator('.ds-item').count().catch(() => 0);

  return {
    url: page.url(),
    title: await page.title(),
    has404: bodyText.includes('页面不存在') || /^404\b/m.test(bodyText),
    datasourceCount: dsItems,
    hasDatasourceHint: bodyText.includes('暂无数据源') || bodyText.includes('选择数据源后开始提问'),
    hasChatInput: await page.locator('textarea:not([aria-hidden="true"])').first().isVisible().catch(() => false),
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    UPLOAD_FILE,
    [
      '这是统一助手工作台的烟测附件。',
      '请优先验证上传、会话、流式回复和消息删除链路是否正常。',
      '不要引用历史五模式迁移文案。'
    ].join('\n'),
    'utf8'
  );
  let managedBackend = null;

  if (!(await isPortListening('127.0.0.1', 3000))) {
    managedBackend = startBackend();
    await waitForPort('127.0.0.1', 3000, 120000);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const collector = attachCollector(page);

  try {
    await login(page);
    const assistant = await runAssistantFlow(page);
    const chat = await runChatFlow(page);

    const report = {
      baseUrl: BASE_URL,
      assistant,
      chat,
      consoleErrors: [...new Set(collector.consoleErrors)],
      pageErrors: [...new Set(collector.pageErrors)],
      apiErrors: collector.apiErrors,
      screenshots: {
        assistant: ASSISTANT_SCREENSHOT,
        chat: CHAT_SCREENSHOT,
      },
      checkedAt: new Date().toISOString(),
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    collector.detach();
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    stopBackend(managedBackend);
  }
}

main().catch((error) => {
  const report = {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    checkedAt: new Date().toISOString(),
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
});
