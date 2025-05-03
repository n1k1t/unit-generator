#!/usr/bin/env node

import { Command, program } from 'commander';

import { IUnitGeneratorCliOptions } from './types';
import * as commands from './commands';

import env from './env';

if (!env.key) {
  console.error('Cannot define [env.UNIT_GENERATOR_API_KEY]');
  process.exit(1);
}

program
  .description('It generates unit-tests by Jest coverage')
  .addCommand(
    new Command()
      .command('summary')
      .description('Returns an overall coverage in the project')
      .option('-f --format [table|number]', 'Output format', 'table')
      .action(async (options: IUnitGeneratorCliOptions['summary']) => commands.summary(options))
  )
  .addCommand(
    new Command()
      .command('calculate')
      .description('Calculates a coverage of the whole project and returns summary')
      .action(() => commands.calculate())
  )
  .addCommand(
    new Command()
      .command('analyze [pattern]')
      .description('Returns a table of low covered project files')
      .option('-t, --target [value]', 'Desired coverage target of an each file', env.target)
      .option('-l --limit [value]', 'Files limit', '5')
      .option('-a --all', 'Takes all paths provided by pattern', false)
      .action((pattern: string | undefined, options: IUnitGeneratorCliOptions['analyze'], command: Command) =>
        commands.analyze({
          ...(options.target && { target: Number(options.target) }),
          ...(options.limit && { limit: Number(options.limit) }),

          paths: command.args,
          all: options.all,
        })
      )
  )
  .addCommand(
    new Command()
      .command('generate [pattern]')
      .description('Generates unit tests')
      .option('-t, --target [value]', 'Desired coverage target of an each file', env.target)
      .option('-m, --model [value]', 'AI model to use for unit tests generation', env.model)
      .option('-i, --iterations [value]', 'Iterations maximum of unit tests generation', env.iterations)
      .option('-l --limit [value]', 'Files limit', '5')
      .option('-v --verbose', 'Replaces pretty table with a raw Keploy as output', false)
      .option('-a --all', 'Takes all paths provided by pattern', false)
      .action((pattern: string | undefined, options: IUnitGeneratorCliOptions['generate'], command: Command) =>
        commands.generate({
          ...(options.iterations && { iterations: Number(options.iterations) }),
          ...(options.target && { target: Number(options.target) }),
          ...(options.limit && { limit: Number(options.limit) }),

          model: options.model,
          paths: command.args,

          verbose: options.verbose,
          all: options.all,
        })
      )
  )
  .parse();
