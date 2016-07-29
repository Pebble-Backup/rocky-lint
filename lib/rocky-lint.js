const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');

function copySync(src, dest) {
  const data = fs.readFileSync(src);
  fs.writeFileSync(dest, data);
}

fs.mkdtemp(os.tmpdir(), (err, dir) => {
  const inputFile = process.argv[2];
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

  copySync(inputFile, path.join(dir, typescriptFile));
  copySync(definitionsFile, path.join(dir, 'rocky.d.ts'))
  copySync(path.join(__dirname, 'tsconfig-template.json'), path.join(dir, 'tsconfig.json'))

  console.log(dir);
  process.chdir(dir);

  const tsc = child_process.execFile('tsc', []);

  tsc.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  tsc.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  tsc.on('close', (exit) => {
    process.exit(exit);
  });
});
