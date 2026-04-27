import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, context } from 'esbuild';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const sourceAssetsDir = path.join(rootDir, 'src', 'assets');
const targetAssetsDir = path.join(distDir, 'assets');
const sourceManifestPath = path.join(rootDir, 'src', 'manifest.webmanifest');
const targetManifestPath = path.join(distDir, 'manifest.webmanifest');
const templatePath = path.join(rootDir, 'src', 'index.template.html');
const DEV_DEFAULT_HOST = '127.0.0.1';
const DEV_DEFAULT_PORT = 4173;

function getTextOutput(result, extension) {
  const output = result.outputFiles.find((file) => file.path.endsWith(extension));

  if (!output) {
    throw new Error(`Unable to find ${extension} output in esbuild result.`);
  }

  return output.text;
}

function escapeInlineScript(content) {
  return content.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

async function copyAssetsBestEffort() {
  try {
    await cp(sourceAssetsDir, targetAssetsDir, {
      force: true,
      recursive: true
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

async function copyManifestBestEffort() {
  try {
    await cp(sourceManifestPath, targetManifestPath, {
      force: true
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

async function copyStaticAssets() {
  await Promise.all([copyAssetsBestEffort(), copyManifestBestEffort()]);
}

async function loadTemplate() {
  return readFile(templatePath, 'utf8');
}

async function writeProductionHtml({ css, mainJs, workerJs }) {
  const template = await loadTemplate();
  const html = template
    .replace('<!-- APP_STYLE -->', `<style>\n${css}\n</style>`)
    .replace(
      '<!-- WORKER_SOURCE -->',
      `<script>window.__TIMER_WORKER_SOURCE__ = ${JSON.stringify(escapeInlineScript(workerJs))};</script>`
    )
    .replace('<!-- APP_SCRIPT -->', `<script>${escapeInlineScript(mainJs)}</script>`);

  await writeFile(path.join(distDir, 'index.html'), html, 'utf8');
}

async function writeDevHtml() {
  const template = await loadTemplate();
  const html = template
    .replace('<!-- APP_STYLE -->', '<link rel="stylesheet" href="./styles.css">')
    .replace('<!-- WORKER_SOURCE -->', '<script>window.__APP_DEV__ = true;</script>')
    .replace('<!-- APP_SCRIPT -->', '<script src="./main.js"></script>');

  await writeFile(path.join(distDir, 'index.html'), html, 'utf8');
}

async function ensureDistDir() {
  await mkdir(distDir, { recursive: true });
}

function getBuildCommonOptions({ minify, sourcemap, write }) {
  return {
    bundle: true,
    legalComments: 'none',
    minify,
    sourcemap,
    target: 'es2020',
    write
  };
}

export async function buildProductionAssets() {
  const commonOptions = getBuildCommonOptions({
    minify: true,
    sourcemap: false,
    write: false
  });

  const [styleResult, mainResult, workerResult, serviceWorkerResult] = await Promise.all([
    build({
      ...commonOptions,
      entryPoints: ['src/styles.css'],
      external: ['assets/*', '/assets/*'],
      loader: {
        '.css': 'css'
      },
      outfile: 'styles.css',
      platform: 'browser'
    }),
    build({
      ...commonOptions,
      entryPoints: ['src/main.js'],
      format: 'iife',
      outfile: 'main.js',
      platform: 'browser'
    }),
    build({
      ...commonOptions,
      entryPoints: ['src/worker.js'],
      format: 'iife',
      outfile: 'timer-worker.js',
      platform: 'browser'
    }),
    build({
      ...commonOptions,
      entryPoints: ['src/service-worker.js'],
      format: 'iife',
      outfile: 'service-worker.js',
      platform: 'browser'
    })
  ]);

  const css = getTextOutput(styleResult, '.css');
  const mainJs = getTextOutput(mainResult, '.js');
  const workerJs = getTextOutput(workerResult, '.js');
  const serviceWorkerJs = getTextOutput(serviceWorkerResult, '.js');

  await ensureDistDir();
  await Promise.all([
    writeProductionHtml({ css, mainJs, workerJs }),
    writeFile(path.join(distDir, 'service-worker.js'), serviceWorkerJs, 'utf8'),
    writeFile(path.join(distDir, 'timer-worker.js'), workerJs, 'utf8'),
    copyStaticAssets()
  ]);
}

async function createDevContexts() {
  const commonOptions = getBuildCommonOptions({
    minify: false,
    sourcemap: true,
    write: true
  });

  const styleContext = await context({
    ...commonOptions,
    entryPoints: ['src/styles.css'],
    external: ['assets/*', '/assets/*'],
    loader: {
      '.css': 'css'
    },
    outfile: path.join(distDir, 'styles.css'),
    platform: 'browser'
  });

  const mainContext = await context({
    ...commonOptions,
    entryPoints: ['src/main.js'],
    format: 'iife',
    outfile: path.join(distDir, 'main.js'),
    platform: 'browser'
  });

  const workerContext = await context({
    ...commonOptions,
    entryPoints: ['src/worker.js'],
    format: 'iife',
    outfile: path.join(distDir, 'timer-worker.js'),
    platform: 'browser'
  });

  const serviceWorkerContext = await context({
    ...commonOptions,
    entryPoints: ['src/service-worker.js'],
    format: 'iife',
    outfile: path.join(distDir, 'service-worker.js'),
    platform: 'browser'
  });

  return {
    contexts: [styleContext, mainContext, workerContext, serviceWorkerContext],
    mainContext
  };
}

function parsePort(rawValue, fallbackPort) {
  if (rawValue === undefined) {
    return fallbackPort;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error(`Invalid port value: ${rawValue}`);
  }

  return parsed;
}

function parseDevOptionsFromFlags(flags = []) {
  let host = DEV_DEFAULT_HOST;
  let port = DEV_DEFAULT_PORT;

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];

    if (flag === '--host') {
      const nextValue = flags[index + 1];

      if (!nextValue) {
        throw new Error('Missing value for --host');
      }

      host = nextValue;
      index += 1;
      continue;
    }

    if (flag.startsWith('--host=')) {
      host = flag.slice('--host='.length);
      continue;
    }

    if (flag === '--port') {
      const nextValue = flags[index + 1];

      if (nextValue === undefined) {
        throw new Error('Missing value for --port');
      }

      port = parsePort(nextValue, DEV_DEFAULT_PORT);
      index += 1;
      continue;
    }

    if (flag.startsWith('--port=')) {
      port = parsePort(flag.slice('--port='.length), DEV_DEFAULT_PORT);
    }
  }

  return { host, port };
}

export async function startDevServer(options = {}) {
  const { host = DEV_DEFAULT_HOST, port = DEV_DEFAULT_PORT } = options;

  await ensureDistDir();
  await copyStaticAssets();

  const { contexts, mainContext } = await createDevContexts();

  await Promise.all(contexts.map((ctx) => ctx.watch()));
  await writeDevHtml();

  const server = await mainContext.serve({
    host,
    port,
    servedir: distDir
  });

  const stop = async () => {
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
  };

  return {
    host,
    port: server.port,
    stop
  };
}

async function runCli() {
  const [command = 'build', ...flags] = process.argv.slice(2);

  if (command === 'dev') {
    const options = parseDevOptionsFromFlags(flags);
    const server = await startDevServer(options);
    const devUrl = `http://${server.host}:${server.port}`;

    console.log(`Dev server running at ${devUrl}`);
    console.log('Watching source files for changes...');

    const shutdown = async () => {
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  await buildProductionAssets();
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
