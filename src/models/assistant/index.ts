import EventEmitter from 'events';
import fs from 'fs/promises';
import _ from 'lodash';

import { IAssistantEvents, IAssistantState, IAssistantStep, TAssistantStatus, TAssistantStrategyName } from './types';
import { LlmProvider, LlmRouter } from '../llm';
import { AssistantSource } from './source';
import { buildCounter } from '../../utils';
import { TFunction } from '../../../types';

import * as strategies from './strategies';
import env from '../../env';

export * from './strategies';
export * from './source';
export * from './types';

export class Assistant {
  public status: TAssistantStatus = 'PREPARING';
  public steps: IAssistantStep[] = [];

  public state: IAssistantState = {
    strategy: '⏱',
  };

  private counter = buildCounter(1);
  private events = new EventEmitter();

  private spent: number = 0;

  constructor(
    public source: AssistantSource,
    public strategies: strategies.AssistantStrategy[],
    public context: {
      cwd: string;
      provider: LlmProvider;

      target: number;
      iterations: number;

      /** Restricts to use only provided strategies */
      strategies?: TAssistantStrategyName[];
    }
  ) {
    strategies.forEach((strategy) => {
      strategy.on('tool', (payload) => {
        this.state.action = {
          type: 'tool',

          status: payload.status,
          message: `[${payload.iteration}] ${payload.name}`,
        };
      });

      strategy.on('reasoning', (payload) => {
        this.state.action = {
          type: 'reasoning',

          status: 'OK',
          message: `[${payload.iteration}] ${_.truncate(payload.text, { length: 25 })}`,
        }
      })
    });
  }

  public calculateTimeSpent(): number {
    return this.is(['PREPARING', 'COMPLETED'])
      ? this.spent
      : (Date.now() - this.source.timestamp);
  }

  public async clear(): Promise<void> {
    await fs.rm(this.source.temp, { recursive: true, force: true });

    if (!this.source.spec.content.length) {
      await this.source.spec.remove();
    }
  }

  public async run(iterations: number = this.context.iterations): Promise<void> {
    if (this.source.checkHasReachedCoverage()) {
      return this.complete();
    }

    if (this.is(['PREPARING'])) {
      this.source.refresh();
      this.status = 'PENDING';
    }

    const skipsCounter = buildCounter();
    const step = this.register({
      status: 'PREPARING',
      strategy: '⏱',

      snapshot: this.source.compileSnapshot(),
      iteration: this.counter(),
    });

    for await (const strategy of this.strategies) {
      if (this.context.strategies?.length && !this.context.strategies.includes(strategy.name)) {
        continue;
      }

      this.state.strategy = strategy.name;
      const status = await strategy.run();

      if (status === 'SKIPPED') {
        skipsCounter();
        continue;
      }
      if (status === 'DONE') {
        await this.source.spec.pretty();
      }

      step.strategy = strategy.name;
      step.status = status;

      break;
    }

    if (skipsCounter(0) === this.context.strategies?.length) {
      return this.complete();
    }

    return this.counter(0) <= iterations
      ? this.run(iterations)
      : this.complete();
  }

  public is(statuses: TAssistantStatus[]): boolean {
    return statuses.includes(this.status);
  }

  public on<K extends keyof IAssistantEvents>(key: K, listener: TFunction<unknown, IAssistantEvents[K]>): this {
    this.events.on(key, listener);
    return this;
  }

  public once<K extends keyof IAssistantEvents>(key: K, listener: TFunction<unknown, IAssistantEvents[K]>): this {
    this.events.once(key, listener);
    return this;
  }

  private emit<K extends keyof IAssistantEvents>(key: K, ...args: IAssistantEvents[K]): this {
    this.events.emit(key, ...args);
    return this;
  }

  private async complete(): Promise<void> {
    this.spent = this.calculateTimeSpent();
    this.status = 'COMPLETED';

    return this.clear();
  }

  private register(step: IAssistantStep): IAssistantStep {
    this.steps.push(step);
    this.emit('step', step);

    this.state.strategy = step.strategy;
    this.state.action = undefined;

    return step;
  }

  static async build(location: string, options?: Omit<Partial<Assistant['context']>, 'model'> & {
    model?: string;
    rate?: number;
  }): Promise<Assistant> {
    const cwd = options?.cwd ?? process.cwd();
    const source = await AssistantSource.build(location, options);

    const router = LlmRouter.build();
    const provider = router.provide(options?.model ?? env.model);

    const compiled: Assistant['strategies'] = [
      strategies.AssistantInitStrategy.build(source, { provider, target: options?.target }),
      strategies.AssistantAddStrategy.build(source, { provider, target: options?.target }),
      strategies.AssistantFixStrategy.build(source, { provider, target: options?.target }),
    ];

    return new Assistant(source, compiled, {
      cwd,
      provider,

      target: options?.target ?? env.target,
      iterations: options?.iterations ?? env.iterations,

      strategies: options?.strategies,
    });
  }
}
