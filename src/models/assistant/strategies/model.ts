import EventEmitter from 'events';
import _ from 'lodash';

import { DataObject } from 'json2md';
import { ZodType } from 'zod/v3';
import {
  APICallError,
  ModelMessage,
  NoObjectGeneratedError,
  Output,
  ProviderMetadata,
  streamText,
  Tool,
  ToolResultPart,
} from 'ai';

import { ArticleContent, GroupContent } from '../../content';
import { TAssistantStrategyRunStatus } from '../types';
import { AssistantSource } from '../source';
import { LlmProvider } from '../../llm';
import { cast } from '../../../utils';

import * as tools from '../../llm/tools';
import env from '../../../env';

interface IAgentToolCall {
  type: 'tool';

  id: string;
  name: string;

  input: unknown;
  output: {
    type: 'text' | 'json' | 'error',
    value: unknown;
  };

  provider?: ProviderMetadata;
}

interface IAgentReasoning {
  type: 'reasoning';

  id: string;
  text: string;

  provider?: ProviderMetadata;
}

type TAgentAction = IAgentToolCall | IAgentReasoning;

export class AssistantStrategyError extends Error {
  constructor(
    public type: 'EMPTY_OUTPUT' | 'WRONG_RESPONSE' | 'BAD_API_CALL',
    public reason: string = 'none'
  ) {
    super(`Got error [${type}] while generation. Reason: ${reason}`);
  }

  public is(types: AssistantStrategyError['type'][]): boolean {
    return types.includes(this.type);
  }

  static convert(error: unknown) {
    if (error instanceof AssistantStrategyError) {
      return error;
    }

    if (APICallError.isInstance(error)) {
      return new AssistantStrategyError('BAD_API_CALL', error.message);
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      return new AssistantStrategyError('WRONG_RESPONSE', error.message);
    }

    return new AssistantStrategyError(
      'BAD_API_CALL',
      String(_.isObject(error) && 'message' in error ? error.message : error)
    );
  }
}

export abstract class AssistantStrategy extends EventEmitter<{
  reasoning: [{ text: string; iteration: number }];
  tool: [{ name: string; iteration: number; status: 'OK' | 'ERROR' }];
}> {
  public provider: LlmProvider = this.provided.provider;
  public history: Set<{ generated: string, message: string }> = new Set();

  public tools: Record<string, Tool> = {
    grep: tools.grep.compile(this.source),
    glob: tools.glob.compile(this.source),
    read: tools.read.compile(this.source),
  };

  constructor(
    public name: string,
    public source: AssistantSource,
    private provided: Pick<AssistantStrategy, 'provider'> & {
      target?: number;
    }
  ) {
    super();
  }

  public abstract run(): Promise<TAssistantStrategyRunStatus>;

  protected compileContext(): Record<'overview' | 'project' | 'history', GroupContent> {
    return {
      overview: GroupContent
        .build([
          ArticleContent.build({
            title: 'Requirements for writing unit tests',

            content: [{
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
            }],
          }),
        ]),

      project: GroupContent.build([
        this.source.project.content.dependencies(),
        this.source.project.content.editorconfig(),

        ArticleContent.build({
          title: 'Location of the source code file',
          content: [{ p: `\`${this.source.code.path}\`` }],
        }),

        ArticleContent.build({
          title: 'Source code',

          content: [{
            code: {
              language: this.source.code.lang,
              content: this.source.code.content,
            },
          }],
        }),
      ]),

      history: GroupContent.build([
        ArticleContent.build({
          title: 'List of generated specs those got failure',

          content: Array.from(this.history).reduce<DataObject[]>((acc, segment) => {
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
        })
      ]),
    };
  }

  protected async generate<T>(provided: {
    schema: ZodType<T>;

    messages: {
      user: string;
      system: string;

      history?: {
        actions: (IAgentToolCall | IAgentReasoning)[];
        provider?: ProviderMetadata;
      }[];
    };

    errors?: AssistantStrategyError[];

    iteration?: number;
    limit?: number;
  }): Promise<T | null> {
    const iteration = provided.iteration ?? 1;
    const limit = provided.limit ?? 50;

    const actions = {
      sequence: cast<string[]>([]),
      map: cast<Record<string, TAgentAction>>({}),
    };

    const info = ArticleContent
      .build({
        title: 'Request info',

        content: [
          { p: `**Identifier:** ${Date.now().toString(32)}` },
          { p: `**Current date/time in ISO format:** ${new Date().toISOString()}` },
          { p: `**Current attempt of the task completion:** ${iteration}/${limit}` },
        ],
      })
      .render();

    const messages: ModelMessage[] = [
      {
        role: 'system',
        content: [info, provided.messages.system].join('\n\n'),
      },
      {
        role: 'user',
        content: provided.messages.user,
      },
    ];

    if (provided.messages.history?.length) {
      provided.messages.history.forEach((record) =>
        messages.push(
          {
            role: 'assistant',
            providerOptions: record.provider,

            content: record.actions.map((action) => {
              if (action.type === 'reasoning') {
                return {
                  type: 'reasoning',
                  text: action.text,

                  providerOptions: action.provider,
                  id: action.id,
                };
              }

              return {
                type: 'tool-call',

                providerOptions: action.provider,
                toolName: action.name,

                toolCallId: action.id,
                input: action.input,
              };
            }),
          },
          {
            role: 'tool',
            providerOptions: record.provider,

            content: record.actions.filter((action) => action.type === 'tool').map((action) => ({
              type: 'tool-result',

              providerOptions: action.provider,
              toolCallId: action.id,
              toolName: action.name,

              output: <ToolResultPart['output']>{
                type: action.output.type === 'error' ? 'error-text' : action.output.type,
                value: action.output.value,
              },
            })),
          }
        )
      );
    }

    try {
      const stream = streamText({
        messages,

        ...(env.debug && {
          experimental_telemetry: {
            isEnabled: true,
          },
        }),

        output: Output.object({
          schema: provided.schema,
        }),

        providerOptions: {
          [this.provider.name]: this.provider.options,
        },

        maxOutputTokens: 32000,
        temperature: 0.1,
        maxRetries: 0,

        model: this.provider.tag,
        tools: this.tools,

        onError: () => undefined,
      });

      for await (const fragment of stream.fullStream) {
        if (fragment.type === 'tool-call') {
          const action: TAgentAction = {
            type: 'tool',

            id: fragment.toolCallId,
            name: fragment.toolName,
            provider: fragment.providerMetadata,

            input: fragment.input,
            output: {
              type: 'text',
              value: undefined,
            },
          };

          actions.map[fragment.toolCallId] = action;
        }

        if (fragment.type === 'tool-result') {
          const action = actions.map[fragment.toolCallId];

          if (action?.type === 'tool') {
            if (fragment.providerMetadata) {
              action.provider = fragment.providerMetadata;
            }

            action.output = {
              type: _.isObject(fragment.output) ? 'json' : 'text',
              value: fragment.output,
            };

            actions.sequence.push(fragment.toolCallId);
            this.emit('tool', { iteration, name: fragment.toolName, status: 'OK' });
          }
        }

        if (fragment.type === 'tool-error') {
          const action = actions.map[fragment.toolCallId];

          if (action?.type === 'tool') {
            if (fragment.providerMetadata) {
              action.provider = fragment.providerMetadata;
            }

            action.output = {
              type: 'error',
              value: fragment.error instanceof Error ? fragment.error.message : String(fragment.error),
            };

            actions.sequence.push(fragment.toolCallId);
            this.emit('tool', { iteration, name: fragment.toolName, status: 'ERROR' });
          }
        }

        if (fragment.type === 'reasoning-start') {
          const action: TAgentAction = {
            type: 'reasoning',

            id: fragment.id,
            provider: fragment.providerMetadata,

            text: '',
          };

          actions.map[fragment.id] = action;
        }

        if (fragment.type === 'reasoning-delta') {
          const action = actions.map[fragment.id];

          if (action?.type === 'reasoning') {
            if (fragment.providerMetadata) {
              action.provider = fragment.providerMetadata;
            }

            action.text += fragment.text;
          }
        }

        if (fragment.type === 'reasoning-end') {
          const action = actions.map[fragment.id];

          if (action?.type === 'reasoning') {
            if (fragment.providerMetadata) {
              action.provider = fragment.providerMetadata;
            }

            actions.sequence.push(fragment.id);
            this.emit('reasoning', { iteration, text: action.text });
          }
        }

        if (fragment.type === 'error' && fragment.error instanceof Error) {
          throw AssistantStrategyError.convert(fragment.error);
        }
      }

      const output = await stream.output;
      if (typeof output === 'string' && !output.length) {
        throw new AssistantStrategyError('EMPTY_OUTPUT');
      }

      return output;
    } catch (error: unknown) {
      const converted = AssistantStrategyError.convert(error);

      if (actions.sequence.length) {
        converted.type = 'EMPTY_OUTPUT';
      }

      const errors = converted.is(['EMPTY_OUTPUT']) ? [] : (provided.errors ?? []);
      errors.push(converted);

      if (iteration < limit && !converted.is(['EMPTY_OUTPUT', 'WRONG_RESPONSE'])) {
        throw converted;
      }
      if (iteration >= limit) {
        throw converted;
      }
      if (errors.filter((nested) => nested.is(['WRONG_RESPONSE'])).length >= 3) {
        throw converted;
      }

      return this.generate({
        errors,

        iteration: iteration + 1,
        schema: provided.schema,

        messages: {
          system: provided.messages.system,
          user: provided.messages.user,

          history: converted.is(['EMPTY_OUTPUT'])
            ? (provided.messages.history ?? []).concat([{
              provider: Object.values(actions.map).find((action) => action.provider)?.provider,
              actions: actions.sequence.map((id) => actions.map[id]),
            }])
            : provided.messages.history,
        },
      });
    }
  }
}
