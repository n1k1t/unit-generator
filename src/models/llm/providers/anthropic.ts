import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';

import { SetPartialKeys } from '../../../../types';
import { LlmProvider } from './model';

export class LlmAnthropicProvider extends LlmProvider<{
  thinking?: {
    type?: 'enabled' | 'disabled';
    budgetTokens?: number;
  };
}> {
  public name: string = 'anthropic';

  public tag: LanguageModel = createAnthropic({
    apiKey: this.connection.key,
    baseURL: this.connection.url,
  })(this.model);

  public clone(): this {
    const clone = new LlmAnthropicProvider(this.model, {
      temperature: this.temperature,
      connection: this.connection,

      options: Object.assign({}, this.options),
      tools: Object.assign({}, this.tools),
    });

    return <this>clone;
  }

  static build(
    model: string,
    parameters: SetPartialKeys<LlmAnthropicProvider['provided'], 'options'>
  ): LlmAnthropicProvider {
    return new LlmAnthropicProvider(model, {
      connection: parameters.connection,

      options: {
        thinking: {
          type: parameters.options?.thinking?.type ?? 'enabled',
          budgetTokens: parameters.options?.thinking?.budgetTokens ?? 1024,
        },
      },
    });
  }
}
