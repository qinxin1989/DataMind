import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import type { Page, Response } from 'playwright';

export interface ManagedProcess {
  name: string;
  logPath: string;
  child: ChildProcess;
}

export interface EnsureDevServicesOptions {
  ensureServices: boolean;
  frontendHost: string;
  frontendPort: number;
  apiHost: string;
  apiPort: number;
  logsDir: string;
  backendName?: string;
  frontendName?: string;
  backendLogFileName?: string;
  frontendLogFileName?: string;
  projectRoot?: string;
  frontendDir?: string;
  backendArgs?: string[];
  frontendArgs?: string[];
}

export interface PageIssueCollector {
  apiErrors: Array<{ url: string; status: number }>;
  pageErrors: string[];
  detach: () => void;
}

export function getArgValue(name: string, defaultValue: string): string {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return defaultValue;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

export function getHostFromUrl(rawUrl: string, fallback: string): string {
  try {
    return new URL(rawUrl).hostname || fallback;
  } catch {
    return fallback;
  }
}

export function getPortFromUrl(rawUrl: string, fallback: number): number {
  try {
    const port = Number(new URL(rawUrl).port);
    return Number.isFinite(port) && port > 0 ? port : fallback;
  } catch {
    return fallback;
  }
}

export function sanitizeFileName(input: string): string {
  return input
    .replace(/^\/+/, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    || 'root';
}

export function readTail(logPath: string, maxLength = 4000): string {
  if (!fs.existsSync(logPath)) {
    return '';
  }

  const content = fs.readFileSync(logPath, 'utf8');
  return content.slice(-maxLength);
}

export async function isPortListening(host: string, port: number): Promise<boolean> {
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

export async function waitForPort(
  host: string,
  port: number,
  timeoutMs: number,
  serviceName: string,
  logPath: string
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortListening(host, port)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `${serviceName} 未能在 ${timeoutMs}ms 内启动成功。\n最近日志：\n${readTail(logPath)}`
  );
}

function getNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function quoteShellArg(arg: string): string {
  if (/^[a-zA-Z0-9_./:-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

export function startManagedProcess(name: string, cwd: string, args: string[], logPath: string): ManagedProcess {
  fs.writeFileSync(logPath, '', 'utf8');
  const output = fs.createWriteStream(logPath, { flags: 'a' });
  const child = process.platform === 'win32'
    ? spawn(
        'cmd.exe',
        ['/d', '/s', '/c', `${getNpmCommand()} ${args.map(quoteShellArg).join(' ')}`],
        {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
        }
      )
    : spawn(getNpmCommand(), args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });

  child.stdout?.pipe(output);
  child.stderr?.pipe(output);

  return {
    name,
    logPath,
    child,
  };
}

export function stopManagedProcess(processInfo: ManagedProcess): void {
  const { child } = processInfo;
  if (!child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(child.pid, 'SIGTERM');
  } catch {
    // ignore cleanup errors
  }
}

export async function ensureDevServices(options: EnsureDevServicesOptions): Promise<ManagedProcess[]> {
  if (!options.ensureServices) {
    return [];
  }

  const projectRoot = options.projectRoot ?? process.cwd();
  const frontendDir = options.frontendDir ?? path.join(projectRoot, 'admin-ui');
  const backendArgs = options.backendArgs ?? ['run', 'dev'];
  const frontendArgs = options.frontendArgs ?? [
    'run',
    'dev',
    '--',
    '--host',
    options.frontendHost,
    '--port',
    String(options.frontendPort),
  ];

  const backendName = options.backendName ?? 'backend';
  const frontendName = options.frontendName ?? 'frontend';
  const backendLogPath = path.join(
    options.logsDir,
    options.backendLogFileName ?? `${backendName}.log`
  );
  const frontendLogPath = path.join(
    options.logsDir,
    options.frontendLogFileName ?? `${frontendName}.log`
  );

  const managed: ManagedProcess[] = [];
  const backendReady = await isPortListening(options.apiHost, options.apiPort);
  const frontendReady = await isPortListening(options.frontendHost, options.frontendPort);

  if (!backendReady) {
    const backendProcess = startManagedProcess(
      backendName,
      projectRoot,
      backendArgs,
      backendLogPath
    );
    managed.push(backendProcess);
    await waitForPort(options.apiHost, options.apiPort, 120000, '后端服务', backendLogPath);
  }

  if (!frontendReady) {
    const frontendProcess = startManagedProcess(
      frontendName,
      frontendDir,
      frontendArgs,
      frontendLogPath
    );
    managed.push(frontendProcess);
    await waitForPort(options.frontendHost, options.frontendPort, 120000, '前端服务', frontendLogPath);
  }

  return managed;
}

export async function waitForAppSettled(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
}

export async function login(page: Page, baseUrl: string, username: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForFunction(() => window.location.pathname === '/workbench', undefined, { timeout: 20000 });
  await waitForAppSettled(page);
}

export function attachPageIssueCollector(page: Page): PageIssueCollector {
  const apiErrors: Array<{ url: string; status: number }> = [];
  const pageErrors: string[] = [];

  const onResponse = (response: Response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiErrors.push({
        url: response.url(),
        status: response.status(),
      });
    }
  };

  const onPageError = (error: Error) => {
    pageErrors.push(String(error));
  };

  page.on('response', onResponse);
  page.on('pageerror', onPageError);

  return {
    apiErrors,
    pageErrors,
    detach: () => {
      page.off('response', onResponse);
      page.off('pageerror', onPageError);
    },
  };
}
