import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface ModuleMenuEntry {
  moduleName: string;
  title: string;
  path: string;
  parentId?: string;
}

interface ActiveModuleManifest {
  name: string;
  frontendEntry?: string;
  frontendIntegration?: string;
  menus: Array<{ title: string; path?: string; parentId?: string }>;
}

interface DynamicModuleRouteLoader {
  moduleName: string;
  routeFilePath: string;
}

function normalizePath(routePath: string): string {
  if (!routePath) {
    return '/';
  }

  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function joinRoutePath(parentPath: string, routePath: string): string {
  if (!routePath) {
    return normalizePath(parentPath);
  }

  if (routePath.startsWith('/')) {
    return normalizePath(routePath);
  }

  if (!parentPath || parentPath === '/') {
    return normalizePath(routePath);
  }

  return normalizePath(`${parentPath}/${routePath}`);
}

function loadActiveModuleManifests(): ActiveModuleManifest[] {
  const modulesDir = path.join(process.cwd(), 'modules');
  const manifests: ActiveModuleManifest[] = [];

  for (const moduleDir of fs.readdirSync(modulesDir)) {
    const manifestPath = path.join(modulesDir, moduleDir, 'module.json');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const isDisabled = manifest.enabled === false || manifest.status === 'disabled';
    if (isDisabled) {
      continue;
    }

    manifests.push({
      name: manifest.name,
      frontendEntry: manifest.frontend?.entry,
      frontendIntegration: manifest.frontend?.integration,
      menus: manifest.menus || [],
    });
  }

  return manifests;
}

function loadModuleMenuEntries(): ModuleMenuEntry[] {
  const entries: ModuleMenuEntry[] = [];

  for (const manifest of loadActiveModuleManifests()) {
    for (const menu of manifest.menus) {
      if (!menu.path) {
        continue;
      }

      entries.push({
        moduleName: manifest.name,
        title: menu.title,
        path: menu.path,
        parentId: menu.parentId,
      });
    }
  }

  return entries;
}

function findRoutesArray(sourceFile: ts.SourceFile): ts.ArrayLiteralExpression {
  let routesArray: ts.ArrayLiteralExpression | null = null;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'routes' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      routesArray = node.initializer;
      return;
    }

    if (
      ts.isExportAssignment(node) &&
      ts.isArrayLiteralExpression(node.expression)
    ) {
      routesArray = node.expression;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!routesArray) {
    throw new Error('未找到 router routes 数组定义');
  }

  return routesArray;
}

function getStringProperty(node: ts.ObjectLiteralExpression, propertyName: string): string | undefined {
  for (const property of node.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === propertyName
    ) {
      const { initializer } = property;
      if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
        return initializer.text;
      }
    }
  }

  return undefined;
}

function getChildren(node: ts.ObjectLiteralExpression): ts.ArrayLiteralExpression | undefined {
  for (const property of node.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'children' &&
      ts.isArrayLiteralExpression(property.initializer)
    ) {
      return property.initializer;
    }
  }

  return undefined;
}

function collectRoutePaths(
  routesArray: ts.ArrayLiteralExpression,
  parentPath: string,
  result: Set<string>
): void {
  for (const element of routesArray.elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      continue;
    }

    const routePath = getStringProperty(element, 'path');
    if (routePath === undefined) {
      continue;
    }

    const fullPath = joinRoutePath(parentPath, routePath);
    result.add(fullPath);

    const children = getChildren(element);
    if (children) {
      collectRoutePaths(children, fullPath, result);
    }
  }
}

function loadFrontendRoutePaths(): Set<string> {
  const routePaths = new Set<string>();

  const routerFile = path.join(process.cwd(), 'admin-ui', 'src', 'router', 'index.ts');
  collectRoutePathsFromFile(routerFile, routePaths);

  for (const loader of loadDynamicModuleRouteLoaders()) {
    collectRoutePathsFromFile(loader.routeFilePath, routePaths);
  }

  return routePaths;
}

function collectRoutePathsFromFile(filePath: string, routePaths: Set<string>): void {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const routesArray = findRoutesArray(sourceFile);
  collectRoutePaths(routesArray, '', routePaths);
}

function getModuleRouteLoaderMapNode(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression {
  let loaderMapNode: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'moduleRouteLoaders' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      loaderMapNode = node.initializer;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!loaderMapNode) {
    throw new Error('未找到 moduleRouteLoaders 定义');
  }

  return loaderMapNode;
}

function getDynamicImportPath(node: ts.Expression): string | undefined {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) {
    return undefined;
  }

  const body = node.body;
  if (!ts.isCallExpression(body) || body.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return undefined;
  }

  const [firstArg] = body.arguments;
  if (!firstArg || (!ts.isStringLiteral(firstArg) && !ts.isNoSubstitutionTemplateLiteral(firstArg))) {
    return undefined;
  }

  return firstArg.text;
}

function loadDynamicModuleRouteLoaders(): DynamicModuleRouteLoader[] {
  const moduleRoutesFile = path.join(process.cwd(), 'admin-ui', 'src', 'router', 'moduleRoutes.ts');
  const sourceText = fs.readFileSync(moduleRoutesFile, 'utf8');
  const sourceFile = ts.createSourceFile(moduleRoutesFile, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const loaderMapNode = getModuleRouteLoaderMapNode(sourceFile);
  const loaders: DynamicModuleRouteLoader[] = [];

  for (const property of loaderMapNode.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const moduleName = ts.isStringLiteral(property.name) || ts.isIdentifier(property.name)
      ? property.name.text
      : undefined;
    const importPath = getDynamicImportPath(property.initializer);

    if (!moduleName || !importPath) {
      continue;
    }

    loaders.push({
      moduleName,
      routeFilePath: path.resolve(path.dirname(moduleRoutesFile), importPath),
    });
  }

  return loaders;
}

describe('Module Menu Route Coverage', () => {
  it('should not have duplicate active module menu paths', () => {
    const menuEntries = loadModuleMenuEntries();
    const duplicates = new Map<string, ModuleMenuEntry[]>();

    for (const entry of menuEntries) {
      const list = duplicates.get(entry.path) || [];
      list.push(entry);
      duplicates.set(entry.path, list);
    }

    const conflictList = [...duplicates.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([menuPath, entries]) => ({
        path: menuPath,
        entries: entries.map(entry => `${entry.moduleName}:${entry.title}`),
      }));

    expect(conflictList).toEqual([]);
  });

  it('should cover active module menu paths and top-level centers with frontend routes', () => {
    const menuEntries = loadModuleMenuEntries();
    const routePaths = loadFrontendRoutePaths();
    const topLevelCenterPaths = ['/ai', '/data', '/collection', '/tools', '/ops', '/system'];

    const expectedPaths = new Set([
      ...menuEntries.map(entry => normalizePath(entry.path)),
      ...topLevelCenterPaths,
    ]);

    const missingPaths = [...expectedPaths].filter(menuPath => !routePaths.has(menuPath));

    expect(missingPaths).toEqual([]);
  });

  it('should register all module-integrated frontend modules in module route loaders', () => {
    const manifests = loadActiveModuleManifests()
      .filter((manifest) => manifest.frontendEntry && manifest.frontendIntegration === 'module')
      .map((manifest) => manifest.name)
      .sort();

    const loaderModules = loadDynamicModuleRouteLoaders()
      .map((loader) => loader.moduleName)
      .sort();

    expect(loaderModules).toEqual(manifests);
  });

  it('should keep AI-path module menus out of system and tools centers', () => {
    const menuEntries = loadModuleMenuEntries();

    const invalidEntries = menuEntries
      .filter(entry => entry.path.startsWith('/ai/'))
      .filter(entry => entry.parentId === 'system-management' || entry.parentId === 'tools-center')
      .map(entry => `${entry.moduleName}:${entry.title}:${entry.parentId}`);

    expect(invalidEntries).toEqual([]);
  });

  it('should keep grouped module menus under matching route prefixes', () => {
    const menuEntries = loadModuleMenuEntries();
    const expectedPrefixByParentId: Record<string, string> = {
      'ai-center': '/ai/',
      'data-center': '/data/',
      'data-collection': '/collection/',
      'tools-center': '/tools/',
      'ops-management': '/ops/',
    };

    const invalidEntries = menuEntries
      .filter(entry => entry.parentId && expectedPrefixByParentId[entry.parentId])
      .filter(entry => !entry.path.startsWith(expectedPrefixByParentId[entry.parentId!]))
      .map(entry => `${entry.moduleName}:${entry.title}:${entry.path}:${entry.parentId}`);

    expect(invalidEntries).toEqual([]);
  });
});
