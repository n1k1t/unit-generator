import { z } from 'zod/v3';

import { TAssistantSourceTestResult, TAssistantStrategyRunStatus } from '../types';
import { AssistantStrategy } from './model';
import { ArticleContent } from '../../content';

export class AssistantFixStrategy extends AssistantStrategy {
  public get schema() {
    return z.object({
      imports: z.array(
        z.string().describe('Code of ONLY one import statement, for example: `import ...`')
      ).describe('List of required entity imports for unit tests'),

      tests: z.array(
        z.object({
          title: z.string().describe(`Unit test title **(find in the \`Unit tests titles\` article)**`),
          content: z.string().describe('Code with fix of unit tests **(without imports)**'),
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
    const context = this.compileContext();

    const generated = await this.generate({
      schema: this.schema,

      messages: {
        system: ArticleContent
          .build({
            title: 'Context',
            tag: 'h1',

            content: [
              context.overview,
              context.project,
              context.history,

              ArticleContent.build({
                title: 'Unit tests titles',

                content: [{
                  ul: this.source.spec.tests.map((test) => test.title),
                }],
              }),

              ArticleContent.build({
                title: 'Existing unit tests',

                content: [{
                  code: {
                    language: this.source.spec.lang,
                    content: this.source.spec.content,
                  },
                }],
              }),

              ArticleContent.build({
                title: 'Unit test failure message',

                content: [{
                  code: {
                    language: 'console',
                    content: tested.message,
                  },
                }],
              }),
            ],
          })
          .render(),

        user: ArticleContent
          .build({
            title: 'Task',
            tag: 'h1',

            content: [{
              ol: [
                'Explore the `Context` article',
                'Analyze the unit test failure message',
                'Analyze the existing imports in the code',
                'Generate fixes for the unit test code and imports (make shure that new imports are not existing in the code)',
              ],
            }],
          })
          .render(),
      },
    });

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

      const found = this.source.spec.tests.find((test) => test.title.includes(fix.title));
      if (!found) {
        continue;
      }

      this.source.spec.replace(found.content.trim(), fix.content.trim());
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

  static build(
    source: AssistantStrategy['source'],
    provided: AssistantStrategy['provided']
  ): AssistantFixStrategy {
    return new AssistantFixStrategy('FIX', source, provided);
  }
}
