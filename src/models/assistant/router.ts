import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { ConvertTupleToUnion } from '../../../types';

import env from '../../env';

export type TModelProviderName = ConvertTupleToUnion<typeof LModelProviderName>;
export const LModelProviderName = <const>['google', 'anthropic', 'mistral', 'openai'];

export interface IAssistantModelProvider {
  name: string;
  model: LanguageModel;

  options?: {};
}

export class AssistantRouter {
  constructor(public context: {
    key: string;

    provider?: string;
    url?: string;
  }) {}

  /** Returns a language model based on the provider and model name */
  public provide(model: string): IAssistantModelProvider {
    const provider: TModelProviderName = LModelProviderName.includes(<TModelProviderName>this.context.provider)
      ? <TModelProviderName>this.context.provider
      : this.detectProvider(model);

    const name = `${provider}/${model}`;

    switch (provider) {
      case 'google': return {
        name,

        model: createGoogleGenerativeAI({
          apiKey: this.context.key,
          baseURL: this.context.url,
        })(model),

        options: {
          google: {
            thinkingConfig: {
              thinkingLevel: 'low',
            },
          },
        },
      };

      case 'anthropic': return {
        name,

        model: createAnthropic({
          apiKey: this.context.key,
          baseURL: this.context.url,
        })(model),

        options: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 1024,
            },
          },
        },
      };

      case 'mistral': return {
        name,

        model: createMistral({
          apiKey: this.context.key,
          baseURL: this.context.url,
        })(model),
      };

      default: return {
        name,

        model: createOpenAI({
          apiKey: this.context.key,
          baseURL: this.context.url,
        })(model),

        options: {
          openai: {
            reasoningEffort: 'low',
          },
        },
      };
    }
  }

  private detectProvider(model: string): TModelProviderName {
    if (model.includes('gpt')) {
      return 'openai';
    }
    if (model.includes('claude')) {
      return 'anthropic';
    }
    if (model.includes('gemini')) {
      return 'google';
    }
    if (model.includes('mistral') || model.includes('pixtral')) {
      return 'mistral';
    }

    return 'openai';
  }

  static build(options?: Partial<AssistantRouter['context']>) {
    return new AssistantRouter({
      provider: options?.provider ?? env.provider,
      key: options?.key ?? env.key ?? 'none',
      url: options?.url ?? env.url,
    })
  }
}
