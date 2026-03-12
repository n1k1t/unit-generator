### Project structure

- `<rootDir>/types/`: Supplemental TypeScript declaration files, including those for external libraries without built-in types.
- `<rootDir>/src/cli.ts`: The main entry point for the command-line interface, using `commander`.
- `<rootDir>/src/index.ts`: Public API exports for the library.
- `<rootDir>/src/commands/`: Implementation of CLI commands:
- `<rootDir>/src/models/`: Domain models and business logic:
    - `assistant/`: Logic related to AI assistants, including different strategies (`add`, `fix`, `init`).
    - `cobertura/`: Handling and parsing of Cobertura XML coverage reports.
    - `file.ts`: File-related abstractions and operations.
    - `spec.ts`: Test specification models.
- `<rootDir>/src/generated/`: Used for storing intermediate or dynamically generated coverage reports during the execution process.
- `<rootDir>/src/types.ts`: Global TypeScript type definitions used across the project.
- `<rootDir>/src/utils.ts`: General-purpose utility functions.
