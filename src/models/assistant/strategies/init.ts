import json2md, { DataObject } from 'json2md';

import { generateText, Output, stepCountIs } from 'ai';
import { z } from 'zod';

import { TAssistantSourceTestResult, TAssistantStrategyRunStatus } from '../types';
import { AssistantStrategy } from './model';
import { cast } from '../../../utils';

import env from '../../../env';

export class AssistantInitStrategy extends AssistantStrategy<'INIT'> {
  public get schema() {
    return z.object({
      imports: z.array(
        z.string().describe('Code of ONLY one import statement, for example: `import ...`')
      ).describe('List of required entity imports for unit tests').min(1),

      specs: z.array(
        z.object({
          code: z.string().describe('Code of ONLY one unit test function, for example: `it(...)`'),
        }).describe('Unit test')
      ).describe('List of unit tests').min(1),
    });
  }

  public async run(): Promise<TAssistantStrategyRunStatus> {
    if (this.source.spec.content.length) {
      return 'SKIPPED';
    }

    const snapshot = this.source.compileSnapshot();

    const generated = await this.generate();
    if (!generated?.specs.length) {
      return 'EMPTY';
    }

    const imported = await this.injectImports(generated);
    if (imported !== 'DONE') {
      return imported;
    }

    const result = await this.injectSpecs(generated);
    if (result !== 'DONE') {
      await this.source.restore(snapshot);
    }

    return result;
  }

  private async injectImports(generated: z.input<AssistantInitStrategy['schema']>): Promise<TAssistantStrategyRunStatus> {
    this.source.save();

    const imports = generated.imports.filter((row) => row.includes('import') || row.includes('require'));
    if (!imports.length) {
      return 'EMPTY';
    }

    await this.source.spec
      .prepend(imports.join('\n'))
      .append(generated.specs[0].code)
      .write();

    const tested = await this.source.test();
    await this.source.restore();

    if (tested.status === 'FAILED') {
      return 'FAILED';
    }

    await this.source.spec.prepend(imports.join('\n')).write();
    return 'DONE';
  }

  private async injectSpecs(
    generated: z.input<AssistantInitStrategy['schema']>,
    results: TAssistantSourceTestResult[] = []
  ): Promise<TAssistantStrategyRunStatus> {
    if (generated.specs.length <= 1) {
      return 'EMPTY';
    }

    /** Skip the first spec that is always passing */
    const index = results.length + 1;
    const code = generated.specs[index].code.trim();

    this.source.save();

    await this.source.spec.append(`\n${env.marker}\n${code}`).write();
    const tested = await this.source.test();

    if (tested.status === 'FAILED') {
      this.history.add({ generated: code, message: tested.message });
      await this.source.restore();
    }

    return index === generated.specs.length - 1
      ? results.concat([tested]).some((result) => result.status === 'PASSED') ? 'DONE' : 'FAILED'
      : this.injectSpecs(generated, results.concat([tested]));
  }

  private async generate(): Promise<z.input<AssistantInitStrategy['schema']> | null> {
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

          { hr: '' },
          { h1: 'Task' },

          {
            ol: [
              'Analyze the task context described above',
              'Write unit tests based on the task context described above',
              'The first unit test must always pass, for example: `it(\'should pass\', () => expect(1).toEqual(1))`',
            ],
          },
        ])
      ),

      ...(env.debug && {
        experimental_telemetry: {
          isEnabled: true
        },
      }),

      output: Output.object({ schema: this.schema }),
      providerOptions: this.provider.options,

      temperature: 0.1,

      model: this.provider.model,
      tools: this.tools,

      stopWhen: stepCountIs(30),
    }).catch((error) => this.handleAiError(error));

    try {
      return response?.output ?? null;
    } catch (error) {
      return this.handleAiError(error);
    };
  }

  static build(
    source: AssistantStrategy['source'],
    provided: AssistantStrategy['provided']
  ): AssistantInitStrategy {
    return new AssistantInitStrategy('INIT', source, provided);
  }
}
