import type { Cobertura } from '../cobertura';
import type { File } from '../file';

import type * as strategies from './strategies';

export type TAssistantStrategyRunStatus = 'PREPARING' | 'EMPTY' | 'SKIPPED' | 'DONE' | 'FAILED';
export type TAssistantStatus = 'PREPARING' | 'PENDING' | 'COMPLETED';

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
  strategy: string;

  action?: {
    type: 'tool' | 'reasoning';
    status: 'OK' | 'ERROR';

    message: string;
  };
}

export interface IAssistantEvents {
  step: [IAssistantStep];
}
