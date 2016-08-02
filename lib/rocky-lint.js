const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const ts = require('typescript');
const util = require('util');
const colors = require('colors/safe');

const yargs = require('yargs')
  .usage('Usage: $0 [options] file.js')
  .describe('verbose', 'Increases verbosity of output')
  .count('verbose')
  .alias('v', 'verbose')
  .describe('definition', 'A TypeScript definition file (.d.ts) to load')
  .alias('d', 'definition')
  .describe('max-warnings', 'Number of warnings to trigger nonzero exit code')
  .number('max-warnings')
  .boolean('pretty')
  .describe('pretty', 'Show line excerpts')
  .boolean('no-color') // handled by `colors` implicitly
  .describe('no-color', 'No ANSI colors')
  .help('help')
  .alias('h', 'help')
  .demand(1, 'No filename provided.');

const argv = yargs.argv;
const VERBOSE_LEVEL = argv.verbose;

const categoryFormatMap = {};
categoryFormatMap[ts.DiagnosticCategory.Warning] = colors.yellow;
categoryFormatMap[ts.DiagnosticCategory.Error] = colors.red;
categoryFormatMap[ts.DiagnosticCategory.Messsage] = colors.blue;

function WARN()  { console.error.apply(console, arguments); }
function INFO()  { VERBOSE_LEVEL >= 1 && console.error.apply(console, arguments); }
function DEBUG() { VERBOSE_LEVEL >= 2 && console.error.apply(console, arguments); }

function repeatCharacter(character, times) {
  let s = "";

  for(let i = 0; i < times; i++) {
    s += character;
  }

  return s;
}

function isFile(path) {
  try {
    const stats = fs.statSync(path);
    return stats.isFile();
  } catch (e) {
    DEBUG(e);
    return false;
  }
}

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

function extractLine(sourceFile, start) {
  const lineMap = sourceFile.lineMap || (sourceFile.lineMap = ts.computeLineStarts(sourceFile.text));
  const position = ts.computeLineAndCharacterOfPosition(lineMap, start);
  const lineStart = ts.getPositionOfLineAndCharacter(sourceFile, position.line, 0);
  const textFromLineStart = sourceFile.text.slice(lineStart);
  const lineEnd = textFromLineStart.indexOf('\n');
  const line = lineEnd >= 0 ? textFromLineStart.slice(0, lineEnd) : textFromLineStart;

  return {
    excerpt: line,
    line: position.line,
    character: position.character,
  };
}

function getArrayParam(paramName) {
  const param = argv[paramName];

  if (Array.isArray(param)) {
    return param;
  } else if (param) {
    return [param];
  } else {
    return [];
  }
}

function printAllDiagnostics(program, fileNameReplacements) {
  const stats = { errors: 0, warnings: 0, any: 0 };

  function printDiagnostic(categoryOverride, d) {
    DEBUG(d);

    if (d.code === 2339) { // Property '...' does not exist on type '...'
      if (d.messageText && d.messageText.indexOf("does not exist on type '{") >= 0) {
        DEBUG('Ignoring issue with object literal.');
        return;
      }
    }

    const sourceFile = d.file;
    let locationString = 'global(0,0)';

    if (sourceFile) {
      const line = extractLine(sourceFile, d.start);
      const fileName = fileNameReplacements[sourceFile.fileName] || sourceFile.fileName;
      locationString = util.format('%s(%d,%d)', fileName, line.line, line.character);

      const lineNumberString = String(line.line);

      if (argv.pretty) {
        console.log('%s %s', colors.bgGreen(lineNumberString), line.excerpt);
        let highlightLine = lineNumberString.replace(/./g, ' ');

        console.log(
          '%s %s%s',
          colors.bgGreen(repeatCharacter(' ', lineNumberString.length)),
          repeatCharacter(' ', line.character),
          colors.red(repeatCharacter('~', d.length))
        );

        console.log();
      }
    }

    let node = typeof(d.messageText) === 'object' ? d.messageText : d;
    let indent = "";

    while (node) {
      let messageText = node.messageText;
      let category = typeof(categoryOverride) === 'undefined' ? node.category : categoryOverride;

      if (messageText.indexOf("IsNotImplementedInRockyYet") >= 0) {
        messageText = "This API is not supported in Rocky.js yet.";
        category = ts.DiagnosticCategory.Error;
      }

      if (category === ts.DiagnosticCategory.Error) {
        stats.errors += 1;
      } else if (category === ts.DiagnosticCategory.Warning) {
        stats.warnings += 1;
      }

      stats.any += 1;

      const categoryString = (categoryFormatMap[category] || colors.white)(ts.DiagnosticCategory[category].toLowerCase());

      console.log("%s: %s: %s%s", colors.magenta(locationString), `${categoryString} TS${node.code}`, indent, messageText);
      indent += "  > ";

      node = node.next;
    }
  }

  program.getOptionsDiagnostics().forEach(printDiagnostic.bind(this));
  program.getGlobalDiagnostics().forEach(printDiagnostic.bind(this));
  program.getSyntacticDiagnostics().forEach(printDiagnostic.bind(this, ts.DiagnosticCategory.Error));
  program.getSemanticDiagnostics().forEach(printDiagnostic.bind(this, ts.DiagnosticCategory.Warning));

  return stats;
}

DEBUG(argv);

fs.mkdtemp(os.tmpdir(), (err, dir) => {
  const inputFiles = argv._;

  if (!inputFiles[0] || !isFile(inputFiles[0])) {
    WARN('Not a file:', inputFiles[0]);
    yargs.showHelp();
    process.exit(1);
  }

  const fileNameReplacements = {};

  const copiedInputFiles = inputFiles.map((file, i) => {
    const ext = path.extname(file);
    const destinationName = `${path.basename(file, ext)}.ts`;
    copyAndUncommentSync(file, path.join(dir, destinationName));
    fileNameReplacements[destinationName] = file;
    return destinationName;
  });

  const definitionFiles = getArrayParam('definition');

  if (definitionFiles.length == 0) {
    INFO('No definitions provided. Using bundled definition.');
    definitionFiles.push(path.join(__dirname, 'rocky.d.ts'));
  }

  const copiedDefinitions = definitionFiles.map((file, i) => {
    const basename = path.basename(file);
    const destinationName = `${i}_${basename}`;
    // prefix with index to prevent collision
    copySync(file, path.join(dir, destinationName));
    return destinationName;
  });

  INFO("Working directory: %s", dir);

  process.chdir(dir);

  const compilerOptions = {
    target: 'es5',
    allowUnreachableCode: true,
    allowUnusedLabels: true,
  };

  const compilerHost = ts.createCompilerHost(compilerOptions);
  const allFiles = copiedInputFiles.concat(copiedDefinitions);
  DEBUG('Compiling files:', allFiles);
  const program = ts.createProgram(allFiles, compilerOptions, compilerHost);
  const stats = printAllDiagnostics(program, fileNameReplacements);

  function printSummary() {
    WARN();
    WARN("Errors: %s, Warnings: %s", colors.bold(stats.errors), colors.bold(stats.warnings));
  }

  if (stats.errors > 0) {
    printSummary();
    WARN("Please fix the issues marked with '%s' above.", colors.red('error'));
    process.exit(255);
  } else if (stats.warnings > 0) {
    printSummary();
    WARN('There are some issues with your code.');

    const maxWarnings = argv['max-warnings'];

    if (typeof maxWarnings !== 'undefined' && stats.warnings > maxWarnings) {
      WARN(`Too many warnings (max: ${maxWarnings}).`)
      process.exit(254);
    }
  } else {
    WARN('Everything looks %s!', colors.rainbow('AWESOME'));
  }

  if (!program.emit().emitSkipped) {
    INFO('Transformed file has been emitted.');
  }
});
