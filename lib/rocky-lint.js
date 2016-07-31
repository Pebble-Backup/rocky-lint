const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const ts = require('typescript');
const util = require('util');
const colors = require('colors/safe');

const yargs = require('yargs')
  .usage('Usage: $0 file.js [rocky.d.ts]')
  .showHelpOnFail(false, 'Specify --help for available options')
  .describe('verbose', 'Increases verbosity of output.')
  .count('verbose')
  .alias('v', 'verbose')
  .help('help')
  .alias('h', 'help')
  .demand(1, 'No filename provided.');

const argv = yargs.argv;
const VERBOSE_LEVEL = argv.verbose;

function WARN()  { console.error.apply(console, arguments); }
function INFO()  { VERBOSE_LEVEL >= 1 && console.error.apply(console, arguments); }

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

function printAllDiagnostics(program, fileNameReplacements) {
  const stats = { errors: 0, warnings: 0, any: 0 };

  function printDiagnostic(level, d) {
    const sourceFile = d.file;
    const lineMap = sourceFile.lineMap || (sourceFile.lineMap = ts.computeLineStarts(sourceFile.text));
    const position = ts.computeLineAndCharacterOfPosition(lineMap, d.start);
    const fileName = fileNameReplacements[sourceFile.fileName] || sourceFile.fileName;

    var node = typeof(d.messageText) === 'object' ? d.messageText : d;
    var indent = "";

    const locationString = util.format('%s(%d,%d)', fileName, position.line, position.character);

    const lineStart = ts.getPositionOfLineAndCharacter(sourceFile, position.line, 0);
    const textFromLineStart = sourceFile.text.slice(lineStart);
    const lineEnd = textFromLineStart.indexOf('\n');
    const line = lineEnd >= 0 ? textFromLineStart.slice(0, lineEnd) : textFromLineStart;

    console.log("%s\t%s\t%s", colors.magenta(locationString), colors.cyan(' > '), line.trim());

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

      stats.any += 1;
      console.log("%s\t%s\t%s%s", colors.magenta(locationString), levelString, indent, messageText);
      indent += "  > ";
      node = node.next;
    }
  }

  program.getOptionsDiagnostics().forEach(printDiagnostic.bind(this, "WARN"));
  program.getGlobalDiagnostics().forEach(printDiagnostic.bind(this, "WARN"));
  program.getSyntacticDiagnostics().forEach(printDiagnostic.bind(this, "ERROR"));
  program.getSemanticDiagnostics().forEach(printDiagnostic.bind(this, "WARN"));

  return stats;
}

fs.mkdtemp(os.tmpdir(), (err, dir) => {
  const inputFile = argv._[0];
  const inputBasename = path.basename(inputFile);

  let definitionsFile = argv._[1];

  if (!definitionsFile) {
    // using bundled definitions file
    definitionsFile = path.join(__dirname, 'rocky.d.ts');
  }

  const inputExt = path.extname(inputFile);

  if ((inputExt !== '.js' && inputExt !== '.ts') || path.extname(definitionsFile) !== '.ts') {
    yargs.showHelp();
    process.exit(1);
  }

  const typescriptFile = `${path.basename(inputFile, inputExt)}.ts`;

  copyAndUncommentSync(inputFile, path.join(dir, typescriptFile));
  copySync(definitionsFile, path.join(dir, 'rocky.d.ts'))

  INFO("Working directory: %s", dir);

  process.chdir(dir);

  const compilerOptions = {
    target: 'es5',
    allowUnreachableCode: true,
    allowUnusedLabels: true,
  };

  const compilerHost = ts.createCompilerHost(compilerOptions);
  const program = ts.createProgram([typescriptFile, 'rocky.d.ts'], compilerOptions, compilerHost);

  const fileNameReplacements = {};
  fileNameReplacements[typescriptFile] = inputBasename;
  const stats = printAllDiagnostics(program, fileNameReplacements);

  if (stats.any == 0) {
    WARN('Everything looks %s!', colors.rainbow('AWESOME'));
    return;
  }

  WARN();
  WARN("Errors: %s, Warnings: %s", colors.bold(stats.errors), colors.bold(stats.warnings));

  if (stats.errors > 0) {
    WARN('Please fix the issues marked with %s above.', colors.red('ERROR'));
    process.exit(255);
  } else {
    // TODO: something like -Werror
    WARN('There are some issues with your code.');
  }
});
