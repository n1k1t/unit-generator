export interface ICoberturaCoveragePackageClassLine {
  '@_number': string;
  '@_hits': string;
}

export interface ICoberturaCoveragePackageClassMethod {
  '@_name': string;
  '@_hits': string;

  lines?: {
    line?: ICoberturaCoveragePackageClassLine | ICoberturaCoveragePackageClassLine[];
  };
}

export interface ICoberturaCoveragePackageClass {
  '@_name': string;
  '@_filename': string;
  '@_line-rate': string;
  '@_branch-rate': string;

  methods?: {
    method?: ICoberturaCoveragePackageClassMethod | ICoberturaCoveragePackageClassMethod[];
  };

  lines?: {
    line?: ICoberturaCoveragePackageClassLine | ICoberturaCoveragePackageClassLine[];
  };
}

export interface ICoberturaCoveragePackage {
  classes?: {
    class?: ICoberturaCoveragePackageClass | ICoberturaCoveragePackageClass[];
  };
}

export interface ICoberturaCoverage {
  coverage?: {
    '@_timestamp': string;
    '@_line-rate': string;
    '@_branch-rate': string;

    sources?: {
      source?: string | string[];
    };

    packages?: {
      package?: ICoberturaCoveragePackage | ICoberturaCoveragePackage[];
    };
  };
}
