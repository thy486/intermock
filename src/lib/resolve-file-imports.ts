import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import ts from 'typescript';

import { mock, Options, Output, Types } from '../lang/ts/intermock';

/**
 * Process an importSpecifier or exportSpecifier and set it.
 *
 * @param sourceFile TypeScript AST object compiled from file data
 * @param output The object outputted by Intermock after all types are mocked
 * @param types Top-level types of interfaces/aliases etc.
 * @param typeName Type name of property
 * @param property Output property to write to
 * @param options Intermock general options object
 */
export function setImportExportSpecifier(
  sourceFile: ts.SourceFile, output: Output, types: Types, typeName: string,
  property: string, options: Options) {
  const memo = new Map<string, Map<string, string>>();

  /**
   *
   * @param interfaceName selected interfaceName
   * @param curFile start file
   * @param path detect loop
   * @example
   * ```ts
   * findInterfaceRoot('Bar')
   * // return
   * '/usr/local/a.ts'
   * ```
   */
  const findInterfaceRoot =
    (interfaceName: string, curFile: string, path: string[] = []): string => {
      if (path.includes(curFile)) {
        throw new Error(`${interfaceName}: cicular importing detected`);
      }

      const dependencyMap = getDependencyMap(curFile);
      if (dependencyMap.has(interfaceName)) {
        const moduleFrom = dependencyMap.get(interfaceName)!;
        const nextFile = resolveModuleFrom(curFile, moduleFrom);
        return findInterfaceRoot(
          interfaceName, nextFile, path.concat([curFile]));
      } else {
        return curFile;
      }
    };

  /**
   * @param path absolute path
   * @returns import relations of this file
   */
  const getDependencyMap = (path: string): Map<string, string> => {
    if (memo.has(path)) {
      return memo.get(path)!;
    } else {
      const dependencyMap = new Map<string, string>();

      const fileContent = readFileSync(path, 'utf8').toString().trim();
      const importMatch = /import ([\s\S]+?) from ['"](.+?)['"]/gm;

      Array.from(fileContent.matchAll(importMatch)).map((item) => {
        const imports = item[1].replace(/[{}\s]/gm, '').split(',');
        const moduleFrom = item[2];
        imports.forEach((imp) => dependencyMap.set(imp, moduleFrom));
      });

      memo.set(path, dependencyMap);
      return dependencyMap;
    }
  };

  /**
   * @param curFile
   * @param moduleFrom only support relative import for now
   * @returns absolute path of this moduleFrom
   */
  const resolveModuleFrom = (curFile: string, moduleFrom: string): string => {
    const tryFile = (mdf: string) => resolve(curFile, '..', mdf);
    const tryFiles = [
      tryFile(moduleFrom),
      tryFile(moduleFrom + '.ts'),
      tryFile(moduleFrom + '.d.ts'),
      tryFile(moduleFrom + '.tsx'),
      tryFile(moduleFrom + 'index.ts'),
      tryFile(moduleFrom + 'index.tsx'),
    ];

    for (const f of tryFiles) {
      if (existsSync(f)) {
        return f;
      }
    }

    throw new Error(`not supported import ${moduleFrom} in ${curFile}`);
  };

  let interfaceRoot: string | undefined;

  const namespaceTypeMatch = typeName.match(/^([\w$]+)\.([\w$]+$)/);
  if (!namespaceTypeMatch) {
    interfaceRoot = findInterfaceRoot(typeName, options.files![0][0]);
  }
  else {
    const fileContent = readFileSync(options.files![0][0], 'utf-8');
    const namespaceImportMatch = new RegExp(`import \\* as ${namespaceTypeMatch[1]} from ['"](.+?)['"]`, 'm');
    const pathMatch = fileContent.match(namespaceImportMatch);
    if (pathMatch) {
      typeName = namespaceTypeMatch[2];
      interfaceRoot = findInterfaceRoot(typeName, resolveModuleFrom(options.files![0][0], pathMatch[1]));
    }
  }

  if (interfaceRoot) {
    const makeOutput = (fileRootPath: string) => {
      return (mock({
        ...options,
        interfaces: [typeName],
        files: [[fileRootPath, readFileSync(fileRootPath, 'utf-8')]],
        output: 'object',
      }) as Output)[typeName];
    };
  
    output[property] = makeOutput(interfaceRoot);
  
    // cannot get interface because of code which like `export xxx from 'xxx'`;
    if (output[property] === void 0) {
      const exportMatch = /export \* from ['"](.+?)['"]/gm;
      const fileContent = readFileSync(interfaceRoot, 'utf-8');
      const exports = fileContent.matchAll(exportMatch);
      let iter = exports.next();
      while (!iter.done) {
        const exportFilepath = resolveModuleFrom(interfaceRoot, iter.value[1]);
        output[property] = makeOutput(exportFilepath);
        // got
        if (output[property] !== void 0) {
          break;
        }
        iter = exports.next();
      }
    }
  }
  else {
    output[property] = {};
  }
}
