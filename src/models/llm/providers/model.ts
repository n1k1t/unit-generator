import { LanguageModel } from 'ai';

import { LlmToolCompiler } from '../tools/model';

export abstract class LlmProvider<TOptions extends object = {}> {
  public abstract name: string;
  public abstract tag: LanguageModel;

  /** Model temperature `0.1 default` */
  public temperature: number = this.provided.temperature ?? 0.1;

  /** Model agent steps count limit `30 default` */
  public limit: number = this.provided.limit ?? 30;

  /** Model provider options */
  public options: TOptions = this.provided.options;

  /** Model tools */
  public tools: Record<string, LlmToolCompiler> = this.provided.tools ?? {};

  public connection: {
    key: string;
    url?: string;
  } = this.provided.connection;

  constructor(public model: string, private provided: Pick<LlmProvider<TOptions>, 'connection' | 'options'> & {
    temperature?: number;
    limit?: number;

    tools?: LlmProvider<TOptions>['tools'];
  }) {}

  public abstract clone(): this;

  /** Clones this instance and assigns new values */
  public assign(
    payload: Partial<Pick<LlmProvider<TOptions>, 'temperature' | 'options' | 'tools' | 'limit'>>
  ): this {
    const clone = this.clone();

    if (payload.temperature !== undefined) {
      clone.temperature = payload.temperature;
    }
    if (payload.options) {
      clone.options = payload.options;
    }
    if (payload.tools) {
      clone.tools = payload.tools;
    }
    if (payload.limit) {
      clone.limit = payload.limit;
    }

    return clone;
  }
}
