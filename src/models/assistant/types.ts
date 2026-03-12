import type { Cobertura } from '../cobertura';
import type { File } from '../file';

import type * as strategies from './strategies';

export type TAssistantStrategyRunStatus = 'DONE' | 'EMPTY' | 'SKIPPED' | 'FAILED';
export type TAssistantSourceTestResult = { status: 'PASSED' } | { status: 'FAILED', message: string };

export type TAssistantStrategyName = {
    [K in keyof typeof strategies]: InstanceType<typeof strategies[K]>['name'];
  }[keyof typeof strategies];

export interface IAssistantSourceSnapshot {
  cobertura: Pick<Cobertura, 'rate' | 'uncovered'>;
  spec: Pick<File, 'content'>;
}

export interface IAssistantStep {
  strategy: TAssistantStrategyName;

  status: TAssistantStrategyRunStatus;
  iteration: number;

  snapshot: IAssistantSourceSnapshot;
}

export interface IAssistantState {
  strategy: IAssistantStep['strategy'] | 'NONE';
  status: TAssistantStrategyRunStatus | 'PREPARING' | 'COMPLETED';
}

export interface IAssistantEvents {
  step: [IAssistantStep];
}
