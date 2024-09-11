const typemock = require('../../build/index');
const { readFiles } = require('../../build/src/lib/read-files');
const { setImportExportSpecifier } = require('../../build/src/lib/resolve-file-imports');

!(async () => {
    const result = typemock.mock({
        files: await readFiles(['./examples/namespaceImport/import.ts']),
        interfaces: ['User'],
        importsResolver: setImportExportSpecifier
    })
    console.log(JSON.stringify(result));
})();
