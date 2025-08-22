import dotenv from 'dotenv';

const config = dotenv.config();

export default {
  key: config.parsed?.UNIT_GENERATOR_API_KEY,
  url: config.parsed?.UNIT_GENERATOR_API_URL,

  model: config.parsed?.UNIT_GENERATOR_MODEL ?? 'gpt-5-mini',

  command: config.parsed?.UNIT_GENERATOR_TEST_COMMAND ?? 'npm test',
  cobertura: config.parsed?.UNIT_GENERATOR_COBERTURA_PATH ?? 'coverage/cobertura-coverage.xml',

  iterations: Number(config.parsed?.UNIT_GENERATOR_MAX_ITERATIONS ?? 5),
  target: Number(config.parsed?.UNIT_GENERATOR_COVERAGE_TARGET ?? 0.8),
};
