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

// Test generated using Keploy
test('should throw an error when the extracted coverage object is null', async () => {
  (extractOverallCoverage as jest.Mock).mockResolvedValue(null);

  await expect(summary({ format: 'table' })).rejects.toThrow('Invalid codertura');
});

// Test generated using Keploy
test('should display the extracted coverage as a table when options.format is "table"', async () => {
  const consoleTableSpy = jest.spyOn(console, 'table').mockImplementation();
  const extractionTime = new Date();

  (extractOverallCoverage as jest.Mock).mockResolvedValue({
    rate: 85,
    timestamp: extractionTime,
  });

  await summary({ format: 'table' });

  expect(consoleTableSpy).toHaveBeenCalledWith([{
    rate: 85,
    updated: extractionTime.toLocaleString()
  }]);

  consoleTableSpy.mockRestore();
});
