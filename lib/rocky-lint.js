const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const ts = require('typescript');
const util = require('util');
const colors = require('colors/safe');

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

  if (process.env.ROCKY_LINT_DEBUG) {
    console.error("Working directory: %s", dir);
    console.error();
  }

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
    const sourceFile = d.file;
    const lineMap = sourceFile.lineMap || (sourceFile.lineMap = ts.computeLineStarts(sourceFile.text));
    const position = ts.computeLineAndCharacterOfPosition(lineMap, d.start);
    const fileName = sourceFile.fileName === typescriptFile ? inputBasename : sourceFile.fileName;

    var node = typeof(d.messageText) === 'object' ? d.messageText : d;
    var indent = "";

    const locationString = util.format('%s(%d,%d)', fileName, position.line, position.character);

    while (node) {
      var messageText = node.messageText;

      if (messageText.indexOf("IsNotImplementedInRockyYet") >= 0) {
        messageText = "This API is not supported in Rocky.js yet.";
        level = "ERROR";
      }

      var levelString = level;

      if (level === "WARN") {
        levelString = colors.yellow(level);
        stats.warnings += 1;
      } else if (level === "ERROR") {
        levelString = colors.red(level);
        stats.errors += 1;
      }

      console.log("%s %s %s%s", colors.cyan(locationString), levelString, indent, messageText);
      indent += "  > ";
      node = node.next;
    }
  }

  program.getOptionsDiagnostics().forEach(printDiagonstic.bind(this, "WARN"));
  program.getGlobalDiagnostics().forEach(printDiagonstic.bind(this, "WARN"));
  program.getSyntacticDiagnostics().forEach(printDiagonstic.bind(this, "ERROR"));
  program.getSemanticDiagnostics().forEach(printDiagonstic.bind(this, "WARN"));

  console.error();
  console.error("Errors: %s, Warnings: %s", colors.bold(stats.errors), colors.bold(stats.warnings));

  if (stats.errors > 0) {
    console.error('Please fix the issues marked with %s above.', colors.red('ERROR'));
    process.exit(1);
  } else if (stats.warnings > 0) {
    // TODO: something like -Werror
    console.error('There are some issues with your code.');
  } else {
    console.error('Everything looks %s!', colors.rainbow('AWESOME'));
  }
});
