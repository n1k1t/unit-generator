import path from 'path';

import { LanguageModel } from 'ai';
import { DataObject } from 'json2md';

import { TAssistantStrategyRunStatus } from '../types';
import { AssistantSource } from '../source';

export abstract class AssistantStrategy<K extends string & {} = string & {}> {
  public abstract model: LanguageModel;

  public parameters = {
    temperature: 0,
    seed: Date.now(),
  };

  public context: Record<'overview' | 'project', DataObject[]> = {
    overview: [
      { h1: 'Context' },

      { h2: '1. Your role' },
      { p: 'You are a unit test developer' },

      { h2: '2. Requirements for writing unit tests' },
      {
        ul: [
          'Follow the provided editorconfig below for formatting the generated code',
          'Follow the rule "One unit test - one assertion"',
          'Each generated unit-test code should be a function, for example: `it(...)`',
          'Each generated import must be in the form of a code line, for example: `import ...`, `require(...)`',
          'DO NOT use functions for grouping unit tests, for example: `describe(...)`',
          'DO NOT use hooks, for example: `beforeEach(...)`, `beforeAll(...)`',
          'DO NOT provide already existing imports of entities',
          'DO NOT generate unit test code in one line',
          'DO NOT generate comments in the code',
        ],
      },
    ],

    project: [
      { h2: '3. Contents of the editorconfig file' },
      {
        code: {
          language: 'editorconfig',
          content: this.provided.editorconfig ?? '',
        },
      },

      { h2: '4. Available packages and tools in the project' },
      { ul: Object.entries((this.provided.dependencies ?? {})).map(([name, version]) => `${name}: ${version}`) },

      { h2: '5. Location of the source code file' },
      { p: `./${path.basename(this.source.code.path)}` },

      { h2: '6. Source code' },
      {
        code: {
          language: this.source.code.lang,
          content: this.source.code.content,
        },
      },
    ],
  };

  constructor(public name: K, public source: AssistantSource, public provided: {
    target?: number;
    model?: string;

    dependencies?: Record<string, string>;
    editorconfig?: string;
  }) {}

  public abstract run(): Promise<TAssistantStrategyRunStatus>;

  /** Differs model parameters */
  public differ(): this {
    this.parameters.temperature += this.parameters.temperature === 1 ? 0 : 0.1;
    this.parameters.seed = Date.now();

    return this;
  }
}
