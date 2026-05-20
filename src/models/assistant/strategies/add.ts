import { z } from 'zod/v3';

import { TAssistantSourceTestResult, TAssistantStrategyRunStatus } from '../types';
import { AssistantStrategy } from './model';
import { ArticleContent } from '../../content';

import env from '../../../env';

export class AssistantAddStrategy extends AssistantStrategy {
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
                title: 'All lines of code those are not covered by tests, separated by commas',

                content: [{
                  code: {
                    language: 'txt',
                    content: this.source.cobertura.uncovered.join(', '),
                  },
                }],
              }),

              ArticleContent.build({
                title: 'Import declarations already existing in unit tests code',

                content: [{
                  code: {
                    language: this.source.spec.lang,
                    content: this.source.spec.imports.join('\n'),
                  },
                }],
              }),

              ArticleContent.build({
                title: 'Helpers and utils already declared in unit tests code',

                content: [{
                  code: {
                    language: this.source.spec.lang,
                    content: this.source.spec.helpers.join('\n'),
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
                'Analyze the lines of code that need to be covered by tests',
                'Analyze the existing imports in the code',
                'Write unit tests only for the uncovered lines of code',
                'Write imports (make shure that new imports are not existing in the code)',
              ],
            }],
          })
          .render(),
      },
    });

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

  static build(
    source: AssistantStrategy['source'],
    provided: AssistantStrategy['provided']
  ): AssistantAddStrategy {
    return new AssistantAddStrategy('ADD', source, provided);
  }
}
