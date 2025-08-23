import json2md, { DataObject } from 'json2md';

import { generateObject, NoObjectGeneratedError } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

import { TAssistantStrategyRunStatus } from '../types';
import { AssistantStrategy } from './model';
import { cast } from '../../../utils';

import env from '../../../env';

const openai = createOpenAI({ apiKey: env.key, baseURL: env.url });

export class AssistantFixStrategy extends AssistantStrategy<'FIX'> {
  public model = openai(this.provided.model ?? env.model, { user: this.source.id });

  public schema = z.object({
    imports: z.array(
      z.string({ description: 'Code of ONLY one import statement, for example: `import ...`' }),
      {
        description: 'List of required entity imports for unit tests',
      }
    ),

    fixes: z.array(
      z.object(
        {
          code: z.string({ description: 'Code fix for unit tests WITHOUT IMPORTS' }).min(1),
          start: z.number({ description: 'Line number in the unit test code FROM which the fix should be applied' }).min(1),
          end: z.number({ description: 'Line number in the unit test code UP TO which the fix should be applied' }).min(1),
        },
        {
          description: 'Unit test code fix',
        }
      ),
      {
        description: 'List of unit test code fixes',
      }
    ).min(1),
  });

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
    if (!generated?.fixes.length) {
      this.differ();
      return 'EMPTY';
    }

    await this.injectImports(generated);

    const result = await this.injectFixes(generated);
    if (result !== 'DONE') {
      this.differ();
      await this.source.restore(snapshot);
    }

    return result;
  }

  private async injectImports(generated: AssistantFixStrategy['schema']['_type']): Promise<TAssistantStrategyRunStatus> {
    const imports = generated.imports.filter((row) => row.includes('import') || row.includes('require'));
    if (!imports.length) {
      return 'EMPTY';
    }

    await this.source.spec.prepend(imports.join('\n')).write();
    return 'DONE';
  }

  private async injectFixes(generated: AssistantFixStrategy['schema']['_type']): Promise<TAssistantStrategyRunStatus> {
    const lines = this.source.spec.content.split('\n');

    generated.fixes.forEach((fix) => lines.splice(fix.start - 1, fix.end - fix.start, ...fix.code.split('\n')));
    await this.source.spec.write(lines.join('\n'));

    const tested = await this.source.test();
    return tested.status === 'FAILED' ? 'FAILED' : 'DONE';
  }

  private async generate(message: string): Promise<AssistantFixStrategy['schema']['_type'] | null> {
    const response = await generateObject({
      prompt: json2md(
        cast<DataObject[]>([
          ...this.context.overview,
          ...this.context.project.concat([
            { h2: '7. Existing unit tests' },
            {
              code: {
                language: this.source.spec.lang,
                content: this.source.spec.content,
              },
            },

            { h2: '8. Unit test failure message' },
            {
              code: {
                language: 'console',
                content: message,
              },
            },
          ]),

          { hr: '' },
          { h1: 'Task' },

          {
            ul: [
              'Analyze the task context described above',
              'Analyze the unit test failure',
              'Write fixes for the unit test code',
              'Take comments in the code into account when numbering the code fixes for unit tests',
              'Keep in mind that line numbering in the unit test code starts from 1',
            ],
          },
        ])
      ),

      temperature: this.differation.temperature,
      seed: this.differation.seed,

      schema: this.schema,
      model: this.model,
    }).catch((error) => {
      if (error instanceof NoObjectGeneratedError) {
        return null;
      }

      throw error;
    });

    return response?.object ?? null;
  }

  static build(
    source: AssistantStrategy['source'],
    provided: AssistantStrategy['provided'] = {}
  ): AssistantFixStrategy {
    return new AssistantFixStrategy('FIX', source, provided);
  }
}
