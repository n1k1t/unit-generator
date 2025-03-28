import summary from './summary';
import { extractOverallCoverage } from '../utils';

// Test generated using Keploy
jest.mock('../utils');

test('should log the extracted coverage rate as a string when options.format is not "table"', async () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  (extractOverallCoverage as jest.Mock).mockResolvedValue({
    rate: 75,
    timestamp: new Date(),
  });

  await summary({ format: <any>'string' });

  expect(consoleLogSpy).toHaveBeenCalledWith('75');
  consoleLogSpy.mockRestore();
});

// Test generated using Keploy
jest.mock('../utils');

test('should handle error thrown by extractOverallCoverage', async () => {
  (extractOverallCoverage as jest.Mock).mockRejectedValue(new Error('Coverage extraction failed'));
  await expect(summary({ format: 'table' })).rejects.toThrow('Coverage extraction failed');
});
