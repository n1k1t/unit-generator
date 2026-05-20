import { createGoogleGenerativeAI, GoogleLanguageModelOptions } from '@ai-sdk/google';
import { LanguageModel } from 'ai';

import { SetPartialKeys } from '../../../../types';
import { LlmProvider } from './model';

export class LlmGoogleProvider extends LlmProvider<GoogleLanguageModelOptions> {
  public name: string = 'google';

  public tag: LanguageModel = createGoogleGenerativeAI({
    apiKey: this.connection.key,
    baseURL: this.connection.url,
  })(this.model);

  public clone(): this {
    const clone = new LlmGoogleProvider(this.model, {
      temperature: this.temperature,
      connection: this.connection,

      options: Object.assign({}, this.options),
      tools: Object.assign({}, this.tools),
    });

    return <this>clone;
  }

  static build(
    model: string,
    parameters: SetPartialKeys<LlmGoogleProvider['provided'], 'options'>
  ): LlmGoogleProvider {
    return new LlmGoogleProvider(model, {
      connection: parameters.connection,

      options: {
        thinkingConfig: {
          thinkingBudget: 2048,
          includeThoughts: true,
        },
      },
    });
  }
}
