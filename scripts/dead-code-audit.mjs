/* global console, process */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const TESTS_DIR = path.join(PROJECT_ROOT, 'tests');

const ENTRYPOINTS = ['main.js', 'worker.js', 'service-worker.js'].map((file) =>
  path.normalize(path.join(SRC_DIR, file))
);

const ALLOWED_TYPE_ONLY_MODULES = new Set([
  'src/app/events/root-event-types.js',
  'src/app/types.js'
]);

function walkJsFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkJsFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.js')) {
      files.push(path.normalize(absolutePath));
    }
  }

  return files;
}

function toRelativePath(absolutePath) {
  return path.relative(PROJECT_ROOT, absolutePath).replaceAll(path.sep, '/');
}

function resolveLocalModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [basePath, `${basePath}.js`, path.join(basePath, 'index.js')];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.normalize(candidate);
    }
  }

  return null;
}

function hasModifier(node, syntaxKind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === syntaxKind));
}

function readModuleUsageAndExports(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const dependencies = new Set();
  const usageKeys = new Set();
  const directExports = new Set();

  function trackDependency(specifier) {
    const resolvedModule = resolveLocalModule(filePath, specifier);

    if (resolvedModule) {
      dependencies.add(resolvedModule);
    }

    return resolvedModule;
  }

  function trackUsage(resolvedModule, exportName) {
    if (!resolvedModule) {
      return;
    }

    usageKeys.add(`${toRelativePath(resolvedModule)}::${exportName}`);
  }

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const resolvedModule = trackDependency(statement.moduleSpecifier.text);
      const importClause = statement.importClause;

      if (!importClause) {
        continue;
      }

      if (importClause.name) {
        trackUsage(resolvedModule, 'default');
      }

      const namedBindings = importClause.namedBindings;

      if (!namedBindings) {
        continue;
      }

      if (ts.isNamespaceImport(namedBindings)) {
        trackUsage(resolvedModule, '*');
        continue;
      }

      if (ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          trackUsage(resolvedModule, element.propertyName?.text ?? element.name.text);
        }
      }

      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      if (!ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }

      const resolvedModule = trackDependency(statement.moduleSpecifier.text);
      const exportClause = statement.exportClause;

      if (!exportClause) {
        trackUsage(resolvedModule, '*');
        continue;
      }

      if (ts.isNamedExports(exportClause)) {
        for (const element of exportClause.elements) {
          trackUsage(resolvedModule, element.propertyName?.text ?? element.name.text);
        }
        continue;
      }

      trackUsage(resolvedModule, '*');
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      directExports.add('default');
      continue;
    }

    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword) && statement.name) {
        directExports.add(statement.name.text);
      }

      if (
        hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
        hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
      ) {
        directExports.add('default');
      }

      continue;
    }

    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          directExports.add(declaration.name.text);
        }
      }
      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        directExports.add(element.propertyName?.text ?? element.name.text);
      }
    }
  }

  return {
    dependencies,
    directExports,
    usageKeys
  };
}

function collectReachableModules(moduleGraph) {
  const reachableModules = new Set();
  const stack = [...ENTRYPOINTS];

  while (stack.length > 0) {
    const currentModule = stack.pop();

    if (!currentModule || reachableModules.has(currentModule)) {
      continue;
    }

    reachableModules.add(currentModule);

    for (const dependency of moduleGraph.get(currentModule) ?? []) {
      stack.push(dependency);
    }
  }

  return reachableModules;
}

function main() {
  const srcFiles = walkJsFiles(SRC_DIR);
  const scanFiles = [...srcFiles, ...walkJsFiles(TESTS_DIR)];

  const moduleGraph = new Map();
  const moduleExports = new Map();
  const usageKeys = new Set();

  for (const filePath of scanFiles) {
    const {
      dependencies,
      directExports,
      usageKeys: moduleUsageKeys
    } = readModuleUsageAndExports(filePath);

    if (filePath.startsWith(SRC_DIR)) {
      moduleGraph.set(filePath, dependencies);
      moduleExports.set(filePath, directExports);
    }

    for (const usageKey of moduleUsageKeys) {
      usageKeys.add(usageKey);
    }
  }

  const reachableModules = collectReachableModules(moduleGraph);

  const unreachableRuntimeModules = srcFiles
    .filter((filePath) => !reachableModules.has(filePath))
    .map(toRelativePath)
    .sort();

  const intentionalTypeOnlyModules = unreachableRuntimeModules.filter((relativePath) =>
    ALLOWED_TYPE_ONLY_MODULES.has(relativePath)
  );

  const deadRuntimeModules = unreachableRuntimeModules.filter(
    (relativePath) => !ALLOWED_TYPE_ONLY_MODULES.has(relativePath)
  );

  const unusedExports = [];

  for (const [filePath, exportedNames] of moduleExports.entries()) {
    const relativePath = toRelativePath(filePath);
    const hasWildcardUsage = usageKeys.has(`${relativePath}::*`);

    if (hasWildcardUsage) {
      continue;
    }

    for (const exportName of exportedNames) {
      if (!usageKeys.has(`${relativePath}::${exportName}`)) {
        unusedExports.push(`${relativePath}::${exportName}`);
      }
    }
  }

  unusedExports.sort();

  console.log('Dead code audit');
  console.log(`- Runtime entrypoints: ${ENTRYPOINTS.map(toRelativePath).join(', ')}`);
  console.log(`- Dead runtime modules: ${deadRuntimeModules.length}`);
  console.log(`- Unused exports: ${unusedExports.length}`);
  console.log(`- Intentional type-only modules: ${intentionalTypeOnlyModules.length}`);

  if (deadRuntimeModules.length > 0) {
    console.log('\nDead runtime modules:');
    for (const modulePath of deadRuntimeModules) {
      console.log(`  - ${modulePath}`);
    }
  }

  if (unusedExports.length > 0) {
    console.log('\nUnused export candidates:');
    for (const exportPath of unusedExports) {
      console.log(`  - ${exportPath}`);
    }
  }

  if (intentionalTypeOnlyModules.length > 0) {
    console.log('\nIntentional type-only modules (kept):');
    for (const modulePath of intentionalTypeOnlyModules) {
      console.log(`  - ${modulePath}`);
    }
  }

  if (deadRuntimeModules.length > 0 || unusedExports.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('\nNo dead runtime modules or unused exports found.');
}

main();
