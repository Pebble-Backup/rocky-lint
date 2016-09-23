.DEFAULT_GOAL := test

test/rocky.d.ts:
	@ echo Link this file from the SDK!; exit 1

test/sdk-tests:
	@ echo Link this file from the SDK!; exit 1

test: lint

test-integration-simple:
	bin/rocky-lint -d test/rocky.d.ts test/simple.js

lint:
	@ node_modules/.bin/eslint lib/rocky-lint.js bin/rocky-lint

.PHONY: test lint test-integration-simple
