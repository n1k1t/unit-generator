import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import _ from 'lodash';

import { IAssistantEvents, IAssistantState, IAssistantStep, TAssistantStrategyName } from './types';
import { AssistantRouter, IAssistantModelProvider } from './router';
import { AssistantSource } from './source';
import { buildCounter } from '../../utils';
import { TFunction } from '../../../types';

import * as strategies from './strategies';
import env from '../../env';

export * from './strategies';
export * from './source';
export * from './types';
export * from './router';

export class Assistant {
  public timestamp: number = Date.now();
  private spent: number = 0;

  public steps: IAssistantStep[] = [];
  public state: IAssistantState = {
    strategy: 'NONE',
    status: 'PREPARING',
  };

  private counter = buildCounter(1);
  private events = new EventEmitter();

  constructor(
    public source: AssistantSource,
    public strategies: strategies.AssistantStrategy[],
    public context: {
      cwd: string;
      provider: IAssistantModelProvider;

      target: number;
      iterations: number;

      /** Restricts to use only provided strategies */
      strategies?: TAssistantStrategyName[];
    }
  ) {}

  public calculateTimeSpent(): number {
    return this.state.status === 'PREPARING' || this.state.status === 'COMPLETED'
      ? this.spent
      : (Date.now() - this.timestamp);
  }

  public async clear(): Promise<void> {
    await fs.rm(this.source.temp, { recursive: true, force: true });

    if (!this.source.spec.content.length) {
      await this.source.spec.remove();
    }
  }

  public async run(iterations: number = this.context.iterations): Promise<void> {
    const skipsCounter = buildCounter();

    if (this.source.checkHasReachedCoverage() && this.state.status === 'DONE') {
      return this.complete();
    }

    this.state.status = 'GENERATION';

    for await (const strategy of this.strategies) {
      if (this.context.strategies?.length && !this.context.strategies.includes(strategy.name)) {
        continue;
      }

      const status = await strategy.run();

      if (status === 'SKIPPED') {
        skipsCounter();
        continue;
      }

      this.register({
        status,

        snapshot: this.source.compileSnapshot(),
        strategy: strategy.name,
        iteration: this.counter(0),
      });

      break;
    }

    if (skipsCounter(0) === this.context.strategies?.length) {
      return this.complete();
    }

    return this.counter() <= iterations
      ? this.run(iterations)
      : this.complete();
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
    this.state.status = 'COMPLETED';

    return this.clear();
  }

  private register(step: IAssistantStep): this {
    this.steps.push(step);
    this.state = step;

    return this.emit('step', step);
  }

  static async build(location: string, options?: Omit<Partial<Assistant['context']>, 'model'> & {
    model?: string;
    rate?: number;
  }): Promise<Assistant> {
    const cwd = options?.cwd ?? process.cwd();
    const source = await AssistantSource.build(location, options);

    const dependencies = await fs.readFile(path.join(cwd, 'package.json'), 'utf8').catch(() => null);
    const editorconfig = await fs.readFile(path.join(cwd, '.editorconfig'), 'utf8').catch(() => null);

    const router = AssistantRouter.build();
    const provider = router.provide(options?.model ?? env.model);

    const provided: strategies.AssistantStrategy['provided'] = {
      provider,
      target: options?.target,

      ...(dependencies && {
        dependencies: (() => {
          const json: Partial<Record<'dependencies' | 'devDependencies', object>> = JSON.parse(dependencies);

          return Object
            .entries(Object.assign(json.dependencies ?? {}, json.devDependencies ?? {}))
            .filter(([name]) => !name.startsWith('@types/'))
            .reduce((acc, [name, version]) => _.set(acc, name, version), {});
        })(),
      }),

      ...(editorconfig && {
        editorconfig: editorconfig
          .split('\n')
          .filter((line) => !line.startsWith('#'))
          .join('\n'),
      }),
    };

    const compiled: Assistant['strategies'] = [
      strategies.AssistantInitStrategy.build(source, provided),
      strategies.AssistantAddStrategy.build(source, provided),
      strategies.AssistantFixStrategy.build(source, provided),
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
