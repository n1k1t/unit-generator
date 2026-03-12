export interface IUnitGeneratorCliOptions {
  summary: {
    format: 'table' | 'number';
  };

  analyze: {
    target: string;
    limit: string;

    all: boolean;
  };

  generate: {
    iterations: string;
    target: string;
    limit: string;

    model: string;
    all: boolean;
  };

  fix: {
    iterations: string;
    limit: string;

    model: string;
    all: boolean;
  };
}
