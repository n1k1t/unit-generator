import json2md, { DataObject } from 'json2md';

import { generateText, Output, stepCountIs } from 'ai';
import { z } from 'zod';

import { TAssistantSourceTestResult, TAssistantStrategyRunStatus } from '../types';
import { AssistantStrategy } from './model';
import { cast } from '../../../utils';

import env from '../../../env';

export class AssistantAddStrategy extends AssistantStrategy<'ADD'> {
  public get schema() {
    return z.object({
      imports: z.array(
        z.string().describe('Code of ONLY one import statement, for example: `import ...`')
      ).describe('List of required entity imports for unit tests'),

      specs: z.array(
        z.object({
          code: z.string().describe('Code of ONLY one unit test function, for example: `it(...)`'),
        }).describe('Unit test')
      ).describe('List of unit tests').min(1),
    });
  }

  public async run(): Promise<TAssistantStrategyRunStatus> {
    if (!this.source.spec.content.length) {
      return 'SKIPPED';
    }

    const tested = await this.source.test();
    if (tested.status === 'FAILED') {
      return 'SKIPPED';
    }

    const snapshot = this.source.compileSnapshot();

    const generated = await this.generate();
    if (!generated?.specs.length) {
      return 'EMPTY';
    }

    const imported = await this.injectImports(generated);
    if (imported === 'FAILED') {
      return imported;
    }

    const result = await this.injectSpecs(generated);
    if (result !== 'DONE') {
      await this.source.restore(snapshot);
    }

    return result;
  }

  private async injectImports(generated: z.input<AssistantAddStrategy['schema']>): Promise<TAssistantStrategyRunStatus> {
    this.source.save();

    const imports = generated.imports.filter((row) => row.includes('import') || row.includes('require'));
    if (!imports.length) {
      return 'EMPTY';
    }

    await this.source.spec.prepend(imports.join('\n')).write();
    const tested = await this.source.test();

    if (tested.status === 'FAILED') {
      await this.source.restore();
      return 'FAILED';
    }

    return 'DONE';
  }

  private async injectSpecs(
    generated: z.input<AssistantAddStrategy['schema']>,
    results: TAssistantSourceTestResult[] = []
  ): Promise<TAssistantStrategyRunStatus> {
    if (!generated.specs.length) {
      return 'EMPTY';
    }

    this.source.save();

    const code = generated.specs[results.length].code.trim();

    await this.source.spec.append(`\n${env.marker}\n${code}`).write();
    const tested = await this.source.test();

    if (tested.status === 'FAILED') {
      this.history.add({ generated: code, message: tested.message });
      await this.source.restore();
    }

    return results.length === generated.specs.length - 1
      ? results.concat([tested]).some((result) => result.status === 'PASSED') ? 'DONE' : 'FAILED'
      : this.injectSpecs(generated, results.concat([tested]));
  }

  private async generate(): Promise<z.input<AssistantAddStrategy['schema']> | null> {
    const context = this.compileContext();

    const response = await generateText({
      prompt: json2md(
        cast<DataObject[]>([
          { h3: 'Request identifier' },
          { p: Date.now().toString(32) },

          ...context.overview,
          ...context.project,
          ...context.tools,
          ...context.history,

          { h3: 'All lines of code those are not covered by tests, separated by commas' },
          {
            code: {
              language: 'txt',
              content: this.source.cobertura.uncovered.join(', '),
            },
          },

          { h3: 'Import declarations already existing in unit tests code' },
          {
            code: {
              language: this.source.spec.lang,
              content: this.source.spec.imports.join('\n'),
            },
          },

          { h3: 'Helpers and utils already declared in unit tests code' },
          {
            code: {
              language: this.source.spec.lang,
              content: this.source.spec.helpers.join('\n'),
            },
          },

          { hr: '' },
          { h1: 'Task' },

          {
            ol: [
              'Analyze the task context described above',
              'Analyze the lines of code that need to be covered by tests',
              'Analyze the existing imports in the code',
              'Write unit tests only for the uncovered lines of code',
              'Write imports (make shure that new imports are not existing in the code)',
            ],
          },
        ])
      ),

      ...(env.debug && {
        experimental_telemetry: {
          isEnabled: true,
        },
      }),

      output: Output.object({ schema: this.schema }),
      providerOptions: this.provider.options,

      temperature: 0.1,

      model: this.provider.model,
      tools: this.tools,

      stopWhen: stepCountIs(30),
    }).catch((error) => this.handleAiError(error));

    return response?.output ?? null;
  }

  static build(
    source: AssistantStrategy['source'],
    provided: AssistantStrategy['provided']
  ): AssistantAddStrategy {
    return new AssistantAddStrategy('ADD', source, provided);
  }
}
