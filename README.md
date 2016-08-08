# rocky-lint

> Emits warnings when working with [Rocky.js](https://github.com/pebble/rockyjs)

```
Usage: rocky-lint [options] -d rocky.d.ts file.js

Options:
  --max-warnings    Number of warnings to trigger nonzero exit code     [number]
  --pretty          Show line excerpts                                 [boolean]
  --no-color        No ANSI colors                                     [boolean]
  -v, --verbose     Increases verbosity of output                        [count]
  -d, --definition  TypeScript definition file (.d.ts) to load
                    can be specified multiple times                   [required]
  -h, --help        Show help                                          [boolean]
```

Process will exit with non-zero status if errors were found or if
more than `max-warnings` (default: infinite) are found.

## License

This project is licensed under the [MIT License](./LICENSE).
