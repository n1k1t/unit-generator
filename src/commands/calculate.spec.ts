import calculate from './calculate';
import * as utils from '../utils';

// Test generated using Keploy
jest.mock('../utils', () => ({
  extractOverallCoverage: jest.fn(() => null),
}));

jest.mock('../env', () => ({
  command: 'echo "test command"',
  cobertura: 'coverage/cobertura.xml'
}));

test('test_extractOverallCoverage_returnsFalsy_throwsError', async () => {
  await expect(calculate()).rejects.toThrow('Invalid codertura');
});

// Test generated using Keploy
test('test_calculate_executesCommand_successfully', async () => {
  const mockExtractOverallCoverage = jest.spyOn(utils, 'extractOverallCoverage').mockResolvedValue(<any>{
    rate: '80%',
    timestamp: new Date()
  });

  await expect(calculate()).resolves.not.toThrow();
  expect(mockExtractOverallCoverage).toHaveBeenCalled();

  mockExtractOverallCoverage.mockRestore();
});
