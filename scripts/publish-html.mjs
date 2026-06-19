#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_WORKER_URL = 'https://h5.h5hub.xyz';
const CONFIG_DIRNAME = '.h5publish';
const CONFIG_FILENAME = 'config.json';

function getConfigPath(env = process.env) {
  const home = env.H5PUBLISH_CONFIG_HOME || env.HOME || env.USERPROFILE;
  if (!home) throw new Error('Cannot find home directory for h5publish config');
  return path.join(home, CONFIG_DIRNAME, CONFIG_FILENAME);
}

async function readConfig(env = process.env) {
  try {
    const text = await fs.readFile(getConfigPath(env), 'utf8');
    const config = JSON.parse(text);
    return config && typeof config === 'object' ? config : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) {
      throw new Error('Invalid h5publish config JSON. Run `node scripts/publish-html.mjs login <invite-code>` again.');
    }
    throw error;
  }
}

async function writeConfig(config, env = process.env) {
  const configPath = getConfigPath(env);
  await fs.mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return configPath;
}

function normalizeWorkerUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('H5PUBLISH_WORKER_URL must be a valid http(s) URL');
  }
}

function parseArgs(argv, env, config = {}) {
  const args = [...argv];
  const positional = [];
  let workerUrl = env.H5PUBLISH_WORKER_URL || config.workerUrl || DEFAULT_WORKER_URL;
  let token = env.H5PUBLISH_TOKEN || config.token;
  let json = false;

  if (args[0] === 'login') {
    args.shift();
    let loginWorkerUrl = workerUrl;
    while (args.length > 0 && args[0]?.startsWith('--')) {
      const arg = args.shift();
      if (arg === '--url') {
        loginWorkerUrl = args.shift();
        if (!loginWorkerUrl) throw new Error('--url requires a value');
      } else {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
    const inviteCode = args.shift();
    if (!inviteCode) throw new Error('Invite code is required');
    if (args.length > 0) throw new Error(`Unexpected argument: ${args[0]}`);
    return {
      command: 'login',
      token: inviteCode,
      workerUrl: normalizeWorkerUrl(loginWorkerUrl),
    };
  }

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--url') {
      workerUrl = args.shift();
      if (!workerUrl) throw new Error('--url requires a value');
    } else if (arg === '--token') {
      token = args.shift();
      if (!token) throw new Error('--token requires a value');
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (arg?.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) throw new Error('HTML file path is required');

  const [filePath, ...titleParts] = positional;
  return {
    command: 'publish',
    filePath,
    title: titleParts.join(' ') || 'H5 Page',
    workerUrl: normalizeWorkerUrl(workerUrl),
    token,
    json,
  };
}

async function readHtml(filePath) {
  if (filePath === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  return fs.readFile(filePath, 'utf8');
}

async function publish({ html, title, workerUrl, token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${workerUrl}/api/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ html, title }),
    });
  } catch (error) {
    const detail = error.cause?.message || error.message;
    throw new Error(`Publish request failed: ${detail}`);
  }

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Publish failed with non-JSON response (${response.status}): ${text}`);
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || `Publish failed with status ${response.status}`);
  }

  return result;
}

function usage() {
  return [
    'Usage:',
    '  publish-html.mjs login [--url WORKER_URL] <invite-code>',
    '  publish-html.mjs [--url WORKER_URL] [--token TOKEN] [--json] <html-file|-> [title]',
    'Examples:',
    '  node scripts/publish-html.mjs login team-invite-code',
    '  node scripts/publish-html.mjs ./page.html "Page title"',
    '  cat page.html | node scripts/publish-html.mjs - "Page title"',
    '',
  ].join('\n');
}

try {
  const config = await readConfig(process.env);
  const options = parseArgs(process.argv.slice(2), process.env, config);
  if (options.help) {
    process.stdout.write(usage());
    process.exit(0);
  }
  if (options.command === 'login') {
    const configPath = await writeConfig({ workerUrl: options.workerUrl, token: options.token }, process.env);
    process.stdout.write(`h5publish login saved\nConfig: ${configPath}\nURL: ${options.workerUrl}\n`);
    process.exit(0);
  }
  const html = await readHtml(options.filePath);
  const result = await publish({ ...options, html });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(`Publish succeeded\nURL: ${result.url}\nCode: ${result.code}\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage()}`);
  process.exit(1);
}
