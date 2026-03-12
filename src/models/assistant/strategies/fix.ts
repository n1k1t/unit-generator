import json2md, { DataObject } from 'json2md';

import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, stepCountIs } from 'ai';
import { z } from 'zod';

import { TAssistantSourceTestResult, TAssistantStrategyRunStatus } from '../types';
import { AssistantStrategy } from './model';
import { cast } from '../../../utils';

import env from '../../../env';

export class AssistantFixStrategy extends AssistantStrategy<'FIX'> {
  public get schema() {
    return z.object({
      imports: z.array(
        z.string().describe('Code of ONLY one import statement, for example: `import ...`')
      ).describe('List of required entity imports for unit tests'),

      tests: z.array(
        z.object({
          title: z.enum(this.source.spec.tests.map((test) => test.title)).describe('Unit test title'),
          content: z.string().describe('Code with fix of unit tests WITHOUT IMPORTS'),
        }).describe('Fix configuration')
      ).min(1).describe('List of tests those should be fixed'),
    });
  }

  public async run(): Promise<TAssistantStrategyRunStatus> {
    if (!this.source.spec.content.length) {
      return 'SKIPPED';
    }

    const tested = await this.source.test();
    if (tested.status !== 'FAILED') {
      return 'SKIPPED';
    }

    const snapshot = this.source.compileSnapshot();

    const generated = await this.generate(tested.message);
    if (!generated?.tests.length) {
      return 'EMPTY';
    }

    await this.injectImports(generated);

    const result = await this.injectFixes(generated);
    if (result !== 'DONE') {
      await this.source.restore(snapshot);
    }

    return result;
  }

  private async injectImports(generated: z.input<AssistantFixStrategy['schema']>): Promise<TAssistantStrategyRunStatus> {
    const imports = generated.imports.filter((row) => row.includes('import') || row.includes('require'));
    if (!imports.length) {
      return 'EMPTY';
    }

    await this.source.spec.prepend(imports.join('\n')).write();
    return 'DONE';
  }

  private async injectFixes(generated: z.input<AssistantFixStrategy['schema']>): Promise<TAssistantStrategyRunStatus> {
    const results: TAssistantSourceTestResult[] = [];

    for (const fix of generated.tests) {
      this.source.save();

      const found = this.source.spec.tests.find((test) => test.title === fix.title);
      if (!found) {
        continue;
      }

      this.source.spec.replace(found.content, fix.content);
      await this.source.spec.write();

      const tested = await this.source.test(fix.title);

      if (tested.status === 'FAILED') {
        this.history.add({ generated: fix.content, message: tested.message });
        await this.source.restore();
      }

      results.push(tested);
    }

    return results.length && results.some((result) => result.status === 'PASSED') ? 'DONE' : 'FAILED';
  }

  private async generate(message: string): Promise<z.input<AssistantFixStrategy['schema']> | null> {
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

          { h3: 'Existing unit tests' },
          {
            code: {
              language: this.source.spec.lang,
              content: this.source.spec.content,
            },
          },

          { h3: 'Unit test failure message' },
          {
            code: {
              language: 'console',
              content: message,
            },
          },

          { hr: '' },
          { h1: 'Task' },

          {
            ol: [
              'Analyze the task context described above',
              'Analyze the unit test failure message',
              'Analyze the existing imports in the code',
              'Write fixes for the unit test code and imports (make shure that new imports are not existing in the code)',
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
    }).catch((error) => {
      if (error instanceof NoObjectGeneratedError) {
        return null;
      }
      if (error instanceof NoOutputGeneratedError) {
        return null;
      }

      throw error;
    });

    return response?.output ?? null;
  }

  static build(
    source: AssistantStrategy['source'],
    provided: AssistantStrategy['provided']
  ): AssistantFixStrategy {
    return new AssistantFixStrategy('FIX', source, provided);
  }
}
