export interface IJestCoveragePackageClass {
  '@_name': string;
  '@_filename': string;
  '@_line-rate': string;
  '@_branch-rate': string;
}

export interface IJestCoveragePackage {
  classes: {
    class: IJestCoveragePackageClass | IJestCoveragePackageClass[];
  };
}

export interface IJestCoverage {
  coverage: {
    '@_timestamp': string;
    '@_line-rate': string;
    '@_branch-rate': string;

    packages: {
      package?: IJestCoveragePackage[];
    };
  };
}

export interface IUnitGeneratorCliOptions {
  summary: {
    format: 'table' | 'number';
  };

  analyze: {
    limit: string;
    rate: string;
  };

  generate: {
    limit: string;
    model: string;

    target: string;
    rate: string;

    iterations: string;
    verbose: boolean;
  };
}

export interface IExtractedCoverage {
  id: string;
  file: string;
  rate: number;
}

export interface IProcessedCoverage extends IExtractedCoverage {
  status: 'DONE' | 'ERROR' | 'PENDING';

  temp: string;
  spec: string;
  cobertura: string;

  target: number;
  spent: number;
}
