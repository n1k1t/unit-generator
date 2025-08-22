import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import _ from 'lodash';

import { IAssistantEvents, IAssistantState, IAssistantStep } from './types';
import { AssistantSource } from './source';
import { buildCounter } from '../../utils';
import { TFunction } from '../../../types';

import * as strategies from './strategies';
import env from '../../env';

export * from './strategies';
export * from './source';
export * from './types';

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

  constructor(public source: AssistantSource, public strategies: strategies.AssistantStrategy[], public options?: {
    model?: string;
    cwd?: string;

    rate?: number;
    target?: number;

    iterations?: number;
  }) {}

  public calculateTimeSpent(): number {
    return this.state.status === 'COMPLETED' ? this.spent : (Date.now() - this.timestamp);
  }

  public async clear(): Promise<void> {
    await fs.rm(this.source.temp, { recursive: true, force: true });

    if (!this.source.spec.content.length) {
      await this.source.spec.remove();
    }
  }

  public async run(iterations: number = this.options?.iterations ?? env.iterations): Promise<void> {
    if (this.source.checkHasReachedCoverage() && this.state.status === 'DONE') {
      return this.complete();
    }

    for await (const strategy of this.strategies) {
      const status = await strategy.run();
      if (status === 'SKIPPED') {
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

  static async build(location: string, options?: Assistant['options']): Promise<Assistant> {
    const cwd = options?.cwd ?? process.cwd();
    const source = await AssistantSource.build(location, options);

    const dependencies = await fs.readFile(path.join(cwd, 'package.json'), 'utf8').catch(() => null);
    const editorconfig = await fs.readFile(path.join(cwd, '.editorconfig'), 'utf8').catch(() => null);

    const provided: strategies.AssistantStrategy['provided'] = {
      target: options?.target,
      model: options?.model,

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

    return new Assistant(source, compiled, options);
  }
}
