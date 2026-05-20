export interface IUnitGeneratorCliOptions {
  summary: {
    format: 'table' | 'number';
  };

  analyze: {
    target: string;
    limit: string;
  };

  generate: {
    target: string;
    limit: string;

    iterations: string;
    model: string;
  };

  fix: {
    limit: string;

    iterations: string;
    model: string;
  };
}
