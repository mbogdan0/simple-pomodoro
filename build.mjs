import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const sourceAssetsDir = path.join(rootDir, 'src', 'assets');
const targetAssetsDir = path.join(distDir, 'assets');
const sourceManifestPath = path.join(rootDir, 'src', 'manifest.webmanifest');
const targetManifestPath = path.join(distDir, 'manifest.webmanifest');
const templatePath = path.join(rootDir, 'src', 'index.template.html');

function getTextOutput(result, extension) {
  const output = result.outputFiles.find((file) => file.path.endsWith(extension));

  if (!output) {
    throw new Error(`Unable to find ${extension} output in esbuild result.`);
  }

  return output.text;
}

function escapeInlineScript(content) {
  return content
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');
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

async function buildAssets() {
  const commonOptions = {
    bundle: true,
    legalComments: 'none',
    minify: true,
    target: 'es2020',
    write: false
  };

  const [styleResult, mainResult, workerResult, serviceWorkerResult, template] = await Promise.all([
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
    }),
    readFile(templatePath, 'utf8')
  ]);

  const css = getTextOutput(styleResult, '.css');
  const mainJs = getTextOutput(mainResult, '.js');
  const workerJs = getTextOutput(workerResult, '.js');
  const serviceWorkerJs = getTextOutput(serviceWorkerResult, '.js');

  const html = template
    .replace(
      '<!-- APP_STYLE -->',
      `<style>\n${css}\n</style>`
    )
    .replace(
      '<!-- WORKER_SOURCE -->',
      `<script>window.__TIMER_WORKER_SOURCE__ = ${JSON.stringify(escapeInlineScript(workerJs))};</script>`
    )
    .replace(
      '<!-- APP_SCRIPT -->',
      `<script>${escapeInlineScript(mainJs)}</script>`
    );

  await mkdir(distDir, { recursive: true });

  await Promise.all([
    writeFile(path.join(distDir, 'index.html'), html, 'utf8'),
    writeFile(path.join(distDir, 'service-worker.js'), serviceWorkerJs, 'utf8'),
    writeFile(path.join(distDir, 'timer-worker.js'), workerJs, 'utf8')
  ]);

  await Promise.all([copyAssetsBestEffort(), copyManifestBestEffort()]);
}

buildAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
