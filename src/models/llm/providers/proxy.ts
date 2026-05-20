import { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { SetPartialKeys } from '../../../../types';
import { LlmProvider } from './model';

export class LlmProxyProvider extends LlmProvider {
  public name: string = 'proxy';

  public tag: LanguageModel = createOpenAI({
    apiKey: this.connection.key,
    baseURL: this.connection.url ?? 'none',
  })(this.model);

  public clone(): this {
    const clone = new LlmProxyProvider(this.model, {
      temperature: this.temperature,
      connection: this.connection,

      options: Object.assign({}, this.options),
      tools: Object.assign({}, this.tools),
    });

    return <this>clone;
  }

  static build(
    model: string,
    parameters: SetPartialKeys<LlmProxyProvider['provided'], 'options'>
  ): LlmProxyProvider {
    return new LlmProxyProvider(model, {
      connection: parameters.connection,
      options: {},
    });
  }
}
