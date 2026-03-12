<div align='center'>
  <h1>Unit generator</h1>
  <p>Coverage based unit tests AI generator</p>

  <img src="https://raw.githubusercontent.com/n1k1t/unit-generator/refs/heads/master/images/preview.png?raw=true" />

  <br />
  <br />

  ![License](https://img.shields.io/badge/License-MIT-yellow.svg)
  ![npm version](https://badge.fury.io/js/@n1k1t%2Funit-generator.svg)
  ![Dynamic XML Badge](https://img.shields.io/badge/dynamic/xml?url=https%3A%2F%2Fgithub.com%2Fn1k1t%2Funit-generator%2Fblob%2Fmaster%2Fcoverage%2Fcobertura-coverage.xml%3Fraw%3Dtrue&query=round(%2Fcoverage%2F%40line-rate%20*%201000)%20div%201000&label=coverage)
</div>

## Install

```bash
npm i -D @n1k1t/unit-generator
```

## How it works?

It automatically prompts with AI models to generate new (or fix falling) unit tests. For more efficiency it uses actual cobertura coverage

## First steps

1. Get access to **API key** on the [OpenAI platform](https://platform.openai.com/)
2. Allow access to model **gpt-5-mini** or another one
3. Make `.env` file in the root of project that contents:
```bash
# AI platform key (required)
UNIT_GENERATOR_API_KEY="API_KEY"
# AI platform/LiteLLM base url (optional)
UNIT_GENERATOR_API_URL="BASE_URL_TO_AI_PLATFORM"
# Command that will be used to generate unit tests (optional)
UNIT_GENERATOR_TEST_COMMAND="npx jest"
# AI model to use for unit tests generation (optional)
UNIT_GENERATOR_MODEL="gpt-5-mini"
```
4. Setup project with [Jest](https://www.npmjs.com/package/jest)
```js
{
  // Cobertura reporter is required
  "coverageReporters": ["cobertura"],
  // Recommend
  "collectCoverageFrom": ["<rootDir>/src/**/*.ts"],
  // Recommend
  "passWithNoTests": true,
}
```
5. Install the [@n1k1t/unit-generator](#install)
6. Run `npx unit calculate` command
```bash
$ npx unit calculate

┌─────────┬───────┬────────────────────────┐
│ (index) │ rate  │ updated                │
├─────────┼───────┼────────────────────────┤
│ 0       │ 0.689 │ '20.03.2025, 19:48:31' │
└─────────┴───────┴────────────────────────┘
```
7. Done! Now try to use [**generate** command](#command-generate)

## API

### General

```bash
$ npx unit -h

Usage: cli [options] [command]

It generates unit-tests by Jest coverage

Options:
  -h, --help                    display help for command

Commands:
  summary [options]             Returns an overall coverage in the project
  calculate                     Calculates a coverage of the whole project and returns summary
  analyze [options] [pattern]   Returns a table of low covered project files
  generate [options] [pattern]  Generates unit tests
  fix [options] [pattern]       Fixes falling unit tests
  help [command]                display help for command
```

### Command `summary`

```bash
$ npx unit summary -h

Usage: cli summary [options]

Returns an overall coverage in the project

Options:
  -f --format [table|number]  Output format (default: "table")
  -h, --help                  display help for command
```

**Examples**

```bash
$ npx unit summary

┌─────────┬───────┬────────────────────────┐
│ (index) │ rate  │ updated                │
├─────────┼───────┼────────────────────────┤
│ 0       │ 0.689 │ '20.03.2025, 19:48:31' │
└─────────┴───────┴────────────────────────┘
```

```bash
$ npx unit summary -f number

0.689
```

### Command `calculate`

```bash
$ npx unit calculate -h

Usage: cli calculate [options]

Calculates a coverage of the whole project and returns summary

Options:
  -h, --help  display help for command
```

**Examples**

```bash
$ npx unit calculate

┌─────────┬───────┬────────────────────────┐
│ (index) │ rate  │ updated                │
├─────────┼───────┼────────────────────────┤
│ 0       │ 0.689 │ '20.03.2025, 20:11:16' │
└─────────┴───────┴────────────────────────┘
```

### Command `analyze`

```bash
$ npx unit analyze -h

Usage: cli analyze [options] [pattern]

Returns a table of low covered project files

Options:
  -t, --target [value]  Desired coverage target of an each file (default: "0.8")
  -l --limit [value]    Files limit (default: "5")
  -a --all              Takes all paths provided by pattern (default: false)
  -h, --help            display help for command
```

**Examples**

```bash
$ npx unit analyze -l 3 src/utils

┌─────────┬────────────────────────────────────────────────────────┬───────┐
│ (index) │ file                                                   │ rate  │
├─────────┼────────────────────────────────────────────────────────┼───────┤
│ 0       │ 'src/utils/streams/text-transform.ts'                  │ 0.107 │
│ 1       │ 'src/utils/streams/sse.ts'                             │ 0.316 │
│ 2       │ 'src/utils/dto/validators/has-dates-diff.validator.ts' │ 0.421 │
└─────────┴────────────────────────────────────────────────────────┴───────┘
```

### Command `generate`

```bash
$ npx unit generate -h

Usage: cli generate [options] [pattern]

Generates unit tests

Options:
  -t, --target [value]      Desired coverage target of an each file (default: "0.8")
  -m, --model [value]       AI model to use for unit tests generation (default: "gpt-4o-mini")
  -i, --iterations [value]  Iterations maximum of unit tests generation (default: "5")
  -l --limit [value]        Files limit (default: "5")
  -a --all                  Takes all paths provided by pattern (default: false)
  -h, --help                display help for command
```

**Examples**

```bash
$ npx unit generate src/models/assistant/strategies

┌─────────┬──────────────────────────────────────────┬──────┬────────┬───────────┬──────────┬─────────────┬─────────┐
│ (index) │ file                                     │ rate │ target │ iteration │ strategy │ status      │ spent   │
├─────────┼──────────────────────────────────────────┼──────┼────────┼───────────┼──────────┼─────────────┼─────────┤
│ 0       │ 'src/models/assistant/strategies/add.ts' │ 0.79 │ 1      │ 5         │ 'ADD'    │ 'COMPLETED' │ 103.012 │
└─────────┴──────────────────────────────────────────┴──────┴────────┴───────────┴──────────┴─────────────┴─────────┘
```

### Command `fix`

```bash
$ npx unit fix -h

Usage: cli fix [options] [pattern]

Fixes falling unit tests

Options:
  -m, --model [value]       AI model to use for unit tests generation (default: "gemini-flash-latest")
  -i, --iterations [value]  Iterations maximum of unit tests generation (default: "5")
  -l --limit [value]        Files limit (default: "5")
  -a --all                  Takes all paths provided by pattern (default: false)
  -h, --help                display help for command
```

**Examples**

```bash
$ npx unit fix src/utils

┌─────────┬──────────────────────────────┬──────┬────────┬───────────┬──────────┬─────────────┬─────────┐
│ (index) │ file                         │ rate │ target │ iteration │ strategy │ status      │ spent   │
├─────────┼──────────────────────────────┼──────┼────────┼───────────┼──────────┼─────────────┼─────────┤
│ 0       │ 'src/utils/streams/sse.ts'   │ 0.31 │ 1      │ 1         │ 'FIX'    │ 'COMPLETED' │ 15.421  │
└─────────┴──────────────────────────────┴──────┴────────┴───────────┴──────────┴─────────────┴─────────┘
```

## Additional

### ENV

```bash
# AI platform key
export UNIT_GENERATOR_API_KEY="..."

# Desired coverage target of an each file (optional)
export UNIT_GENERATOR_COVERAGE_TARGET="0.8"
# Path to the cobertura-coverage.xml file generated (optional)
export UNIT_GENERATOR_COBERTURA_PATH="coverage/cobertura-coverage.xml"
# Iterations maximum of unit tests generation (optional)
export UNIT_GENERATOR_MAX_ITERATIONS="5"
# Command that will be used to generate unit tests (optional)
export UNIT_GENERATOR_TEST_COMMAND="npm test"
# AI platform base url (optional)
export UNIT_GENERATOR_API_URL="..."
# AI model to use for unit tests generation (optional)
export UNIT_GENERATOR_MODEL="gemini-flash-latest"
# AI provider (optional)
export UNIT_GENERATOR_PROVIDER="google"
# Marker to identify generated tests (optional)
export UNIT_GENERATOR_MARKER="/* Generated by @n1k1t/unit-generator */"
# Enable parallel generation (optional)
export UNIT_GENERATOR_PARALLEL="true"
# Enable debug mode and telemetry (optional)
export UNIT_GENERATOR_DEBUG="false"
```

### Ignore file

The unit-generator package supports `.unitignore` file that can contain path matches using minimatch expressions

**Examples**

```bash
src/**/*.module.ts
src/**/index.ts
lib/**
```
