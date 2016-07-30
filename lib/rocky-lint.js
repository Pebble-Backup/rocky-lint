const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const ts = require('typescript');

function copySync(src, dest) {
  const data = fs.readFileSync(src);
  fs.writeFileSync(dest, data);
}

///
/// Allows flow-like inline type comments.
///
/// function foo(string: /*: any */) { ... }
function copyAndUncommentSync(src, dest) {
  const data = fs.readFileSync(src).toString();
  const uncommentedData = data.replace(/\/\*(\s*:\s+[a-zA-Z0-9._]+)\s+\*\//g, '$1')
  fs.writeFileSync(dest, uncommentedData);
}

fs.mkdtemp(os.tmpdir(), (err, dir) => {
  const inputFile = process.argv[2];
  const inputBasename = path.basename(inputFile);

  let definitionsFile = process.argv[3];

  if (!definitionsFile) {
    // using bundled definitions file
    definitionsFile = path.join(__dirname, 'rocky.d.ts');
  }

  const inputExt = path.extname(inputFile);

  if ((inputExt !== '.js' && inputExt !== '.ts') || path.extname(definitionsFile) !== '.ts') {
    throw new Error('Usage: rocky-lint file.js [rocky.d.ts]');
  }

  const typescriptFile = `${path.basename(inputFile, inputExt)}.ts`;

  copyAndUncommentSync(inputFile, path.join(dir, typescriptFile));
  copySync(definitionsFile, path.join(dir, 'rocky.d.ts'))

  console.error("Working directory: %s", dir);
  process.chdir(dir);

  const compilerOptions = {
    target: 'es5',
    allowUnreachableCode: true,
    allowUnusedLabels: true,
  };

  const compilerHost = ts.createCompilerHost(compilerOptions);
  const program = ts.createProgram([typescriptFile, 'rocky.d.ts'], compilerOptions, compilerHost);

  const stats = { errors: 0, warnings: 0 };

  function printDiagonstic(level, d) {
    if (level === "WARN") {
      stats.warnings += 1;
    } else if (level === "ERROR") {
      stats.errors += 1;
    }

    const sourceFile = d.file;
    const lineMap = sourceFile.lineMap || (sourceFile.lineMap = ts.computeLineStarts(sourceFile.text));
    const position = ts.computeLineAndCharacterOfPosition(lineMap, d.start);
    const fileName = sourceFile.fileName === typescriptFile ? inputBasename : sourceFile.fileName;

    var node = typeof(d.messageText) === 'object' ? d.messageText : d;
    var indent = "";

    while (node) {
      console.error("%s %s(%d,%d)%s", level, fileName, position.line, position.character, indent, node.messageText);
      indent += "   >";
      node = node.next;
    }
  }

  program.getOptionsDiagnostics().forEach(printDiagonstic.bind(this, "WARN"));
  program.getGlobalDiagnostics().forEach(printDiagonstic.bind(this, "WARN"));
  program.getSyntacticDiagnostics().forEach(printDiagonstic.bind(this, "ERROR"));
  program.getSemanticDiagnostics().forEach(printDiagonstic.bind(this, "WARN"));

  console.error();
  console.error("Errors: %d, Warnings: %d", stats.errors, stats.warnings);

  if (stats.errors > 0) {
    console.error('Please fix the issues marked with ERROR above.');
    process.exit(1);
  } else if (stats.warnings > 0) {
    // TODO: something like -Werror
    console.error('There are some issues with your code.');
    process.exit(0);
  }
});
