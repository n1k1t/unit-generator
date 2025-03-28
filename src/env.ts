import dotenv from 'dotenv';

const config = dotenv.config();

export default {
  token: config.parsed?.UNIT_GENERATOR_API_KEY,
  model: config.parsed?.UNIT_GENERATOR_MODEL ?? 'gpt-4o-mini',

  command: config.parsed?.UNIT_GENERATOR_TEST_COMMAND ?? 'npm test',
  cobertura: config.parsed?.UNIT_GENERATOR_COBERTURA_PATH ?? 'coverage/cobertura-coverage.xml',

  iterations: config.parsed?.UNIT_GENERATOR_MAX_ITERATIONS ?? '5',
  target: config.parsed?.UNIT_GENERATOR_COVERAGE_TARGET ?? '0.8',
};
