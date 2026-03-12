import { DataObject } from 'json2md';
import { Tool } from 'ai';

import { TAssistantStrategyRunStatus } from '../types';
import { IAssistantModelProvider } from '../router';
import { AssistantSource } from '../source';
import { grep, read } from '../tools';

export abstract class AssistantStrategy<K extends string & {} = string & {}> {
  public provider: IAssistantModelProvider = this.provided.provider;
  public history: Set<{ generated: string, message: string }> = new Set();

  public tools: Record<string, Tool> = {
    grep: grep(this),
    read: read(),
  };

  public compileContext(): Record<'overview' | 'project' | 'tools' | 'history', DataObject[]> {
    return {
      overview: [
        { h1: 'Context' },

        { h3: 'Requirements for writing unit tests' },
        {
          ol: [
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
        { h3: 'Contents of the editorconfig file' },
        {
          code: {
            language: 'editorconfig',
            content: this.provided.editorconfig ?? '',
          },
        },

        { h3: 'Available packages and tools in the project' },
        {
          code: {
            language: 'txt',
            content: Object
              .entries((this.provided.dependencies ?? {}))
              .map(([name, version]) => `${name}: ${version}`)
              .join('\n'),
          },
        },

        { h3: 'Project files tree' },
        {
          code: {
            language: 'txt',
            content: (() => {
              const tree: Record<string, any> = {};

              this.source.tree.forEach((path) => {
                let current = tree;

                path.split('/').forEach((part) => {
                  if (!current[part]) {
                    current[part] = {};
                  }

                  current = current[part];
                });
              });

              const format = (obj: Record<string, any>, indent = 0): string =>
                Object
                  .keys(obj)
                  .map((key) => {
                    const children = format(obj[key], indent + 2);
                    return ' '.repeat(indent) + key + (children ? `\n${children}` : '');
                  })
                  .join('\n');

              return format(tree);
            })(),
          },
        },

        { h3: 'Location of the source code file' },
        { p: `\`${this.source.code.path}\`` },

        { h3: 'Source code' },
        {
          code: {
            language: this.source.code.lang,
            content: this.source.code.content,
          },
        },
      ],

      tools: [
        { h3: 'Availablse tools' },
        {
          ul: [
            '`grep`: Search code in the project by pattern',
            '`read`: Read a file content',
          ],
        },

        { h3: 'Tools usage rules' },
        {
          ol: [
            'Use provided tools for searching nearest dependencies for the source code only',
            'Use it as little as possible',
            'DO NOT search dependencies that could be mocked by creating a primitive example',
            'DO NOT make more than **20** tool calls',
          ],
        },
      ],

      history: [
        { h3: 'List of generated specs those got failure' },

        ...Array.from(this.history).reduce<DataObject[]>((acc, segment) => {
          acc.push({ p: 'Generated spec:' });
          acc.push({
            code: {
              language: this.source.spec.lang,
              content: segment.generated,
            },
          });

          acc.push({ p: 'Failure message:' });
          acc.push({
            code: {
              language: 'bash',
              content: segment.message,
            },
          });

          return acc;
        }, []),
      ],
    };
  }

  constructor(public name: K, public source: AssistantSource, private provided: Pick<AssistantStrategy, 'provider'> & {
    target?: number;

    dependencies?: Record<string, string>;
    editorconfig?: string;
  }) {}

  public abstract run(): Promise<TAssistantStrategyRunStatus>;
}
