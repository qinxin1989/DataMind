import dotenv from 'dotenv';
import { once } from 'events';
import net from 'net';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { dropIsolatedDatabase, recreateIsolatedDatabase, resolveIsolatedDatabaseName } from './testDatabase';

export interface ManagedTestServer {
  baseUrl: string;
  port: number;
  databaseName: string;
  child: ChildProcess;
  stdout: string[];
  stderr: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendOutput(buffer: string[], chunk: string): void {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  buffer.push(...lines);
  if (buffer.length > 200) {
    buffer.splice(0, buffer.length - 200);
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let offset = 0; offset < 20; offset += 1) {
    const candidate = startPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`无法找到可用测试端口，起始端口: ${startPort}`);
}

function buildStartupError(server: ManagedTestServer): Error {
  const stderrOutput = server.stderr.join('\n');
  const stdoutOutput = server.stdout.join('\n');
  return new Error(
    `测试服务启动失败或超时\n[stdout]\n${stdoutOutput || '(empty)'}\n[stderr]\n${stderrOutput || '(empty)'}`
  );
}

function spawnServerProcess(databaseName: string, port: number): ChildProcess {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    CONFIG_DB_NAME: databaseName,
    PORT: String(port),
  };

  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx tsx src/index.ts'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  return spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function startManagedTestServer(): Promise<ManagedTestServer> {
  dotenv.config();

  const port = await findAvailablePort(parseInt(process.env.TEST_SERVER_PORT || '3100', 10));
  const baseDatabaseName = resolveIsolatedDatabaseName({
    envVarName: 'CONFIG_DB_API_TEST_NAME',
    defaultSuffix: 'api_test',
  });
  process.env.CONFIG_DB_API_TEST_NAME = `${baseDatabaseName}_${Date.now()}`;
  const databaseName = await recreateIsolatedDatabase({
    envVarName: 'CONFIG_DB_API_TEST_NAME',
    defaultSuffix: 'api_test',
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawnServerProcess(databaseName, port);

  const server: ManagedTestServer = {
    baseUrl,
    port,
    databaseName,
    child,
    stdout: [],
    stderr: [],
  };

  child.stdout?.on('data', (chunk) => appendOutput(server.stdout, chunk.toString()));
  child.stderr?.on('data', (chunk) => appendOutput(server.stderr, chunk.toString()));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw buildStartupError(server);
    }

    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1000),
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });

      if (response.status < 500) {
        return server;
      }
    } catch {
      // ignore
    }

    await delay(500);
  }

  throw buildStartupError(server);
}

export async function stopManagedTestServer(server: ManagedTestServer | null): Promise<void> {
  if (!server) {
    return;
  }

  try {
    if (!server.child.pid || server.child.exitCode !== null) {
      return;
    }

    server.child.kill();

    const exited = await Promise.race([
      once(server.child, 'exit').then(() => true).catch(() => false),
      delay(5000).then(() => false),
    ]);

    if (exited) {
      return;
    }

    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(server.child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }

    server.child.kill('SIGKILL');
  } finally {
    await dropIsolatedDatabase(server.databaseName);
  }
}
