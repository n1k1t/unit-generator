import fs from 'fs/promises';
import { renderProcessedCoverage, extractOverallCoverage, extractFilesCoverage } from './utils';
import { actualizeProcessedCoverageRate } from './utils';
import { extractIgnorePaths } from './utils';
import { cast } from './utils';
import { wait } from './utils';


it('should cast value', () => expect(cast('test')).toEqual('test'));

// Test generated using Keploy
it('should correctly log processed coverage results to the console', () => {
  const logSpy = jest.spyOn(console, 'table').mockImplementation(() => null);

  const timestamp = Date.now();
  const processed = [
    { file: 'file1.js', rate: 0.7, target: 0.8, status: 'PENDING', spent: 0 },
    { file: 'file2.js', rate: 0.9, target: 0.8, status: 'COMPLETED', spent: 10 },
  ];

  renderProcessedCoverage(timestamp, <any>processed);

  expect(logSpy).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ spent: expect.any(Number) }),
    ]),
    expect.any(Array)
  );

  logSpy.mockRestore();
});

// Test generated using Keploy
jest.mock('fs/promises');

it('should throw an error if the file does not exist', async () => {
  (<jest.Mock<any>>fs.readFile).mockRejectedValue(new Error('File not found'));

  await expect(extractOverallCoverage('invalid/path/to/cobertura.xml'))
    .rejects
    .toThrow('File not found');
});

// Test generated using Keploy
jest.mock('fs/promises');

it('should return empty array if the file does not exist and silent mode is true', async () => {
  (<jest.Mock<any>>fs.readFile).mockRejectedValue(new Error('File not found'));

  const result = await extractFilesCoverage('invalid/path/to/cobertura.xml', { silent: true });
  expect(result).toEqual([]);
});

// Test generated using Keploy
it('should return empty array if no packages are found in coverage XML', async () => {
  const content = `
  <coverage>
    <packages></packages>
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);

  const result = await extractFilesCoverage('valid/path/to/cobertura.xml');
  expect(result).toEqual([]);
});

// Test generated using Keploy
it('should filter out files matching ignore patterns', async () => {
  const content = `
  <coverage>
    <packages>
      <package>
        <classes>
          <class filename="file1.js" line-rate="0.3" />
          <class filename="file2.js" line-rate="0.5" />
        </classes>
      </package>
    </packages>
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);
  const options = {
    ignore: ['file1.js'],
  };

  const result = await extractFilesCoverage('valid/path/to/cobertura.xml', options);
  expect(result).toEqual([{ id: expect.any(String), file: 'file2.js', rate: 0.5 }]);
});

// Test generated using Keploy
it('should return correct timestamp and rate for a valid coverage file', async () => {
  const content = `
  <coverage timestamp="123456789" line-rate="0.75">
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);

  const result = await extractOverallCoverage('valid/path/to/cobertura.xml');
  expect(result?.timestamp).toEqual(new Date(123456789));
  expect(result?.rate).toBeCloseTo(0.75, 3);
});

// Test generated using Keploy
it('should update the rate of processed coverage with refreshed data', async () => {
  const processedCoverage = [{ cobertura: 'report.xml', rate: 0.5 }];
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(`
    <coverage>
      <packages>
        <package>
          <classes>
            <class filename="file1.js" line-rate="1.0" />
          </classes>
        </package>
      </packages>
    </coverage>`);

  await actualizeProcessedCoverageRate('valid/path/to', <any>processedCoverage);

  expect(processedCoverage[0].rate).toEqual(1.0);
});

// Test generated using Keploy
it('should read and return paths from .unitignore file', async () => {
  const ignoreContent = 'path1/\npath2/\n';
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(ignoreContent);

  const result = await extractIgnorePaths('valid/path/to');
  expect(result).toEqual(['path1/', 'path2/']);
});

// Test generated using Keploy
it('should include files matching paths but not meeting line-rate', async () => {
  const content = `
  <coverage>
    <packages>
      <package>
        <classes>
          <class filename="file1.js" line-rate="0.3" />
        </classes>
      </package>
    </packages>
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);
  const options = { paths: ['file1.js'], target: 0.7 };

  const result = await extractFilesCoverage('valid/path/to/cobertura.xml', options);
  expect(result).toEqual([{ id: expect.any(String), file: 'file1.js', rate: 0.3 }]);
});

// Test generated using Keploy
it('should resolve after the specified time', async () => {
  const start = Date.now();
  const waitPromise = wait(100);
  await waitPromise;
  const duration = Date.now() - start;
  expect(duration).toBeGreaterThanOrEqual(100);
});

// Test generated using Keploy
it('should correctly sort files by rate, separating modules and index files', async () => {
  const coverageContent = `
  <coverage>
    <packages>
      <package>
        <classes>
          <class filename="module1.js" line-rate="0.4" />
          <class filename="index.js" line-rate="0.2" />
          <class filename="module2.js" line-rate="0.3" />
        </classes>
      </package>
    </packages>
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(coverageContent);

  const result = await extractFilesCoverage('valid/path/to/cobertura.xml');
  expect(result).toEqual([
    { id: expect.any(String), file: 'module2.js', rate: 0.3 },
    { id: expect.any(String), file: 'module1.js', rate: 0.4 },
    { id: expect.any(String), file: 'index.js', rate: 0.2 }
  ]);
});

// Test generated using Keploy
it('should include index files with low coverage when options.paths is specified', async () => {
  const content = `
  <coverage>
    <packages>
      <package>
        <classes>
          <class filename="index.js" line-rate="0.1" />
          <class filename="module.js" line-rate="0.5" />
        </classes>
      </package>
    </packages>
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);
  const options = { paths: ['index.js'], target: 0.3 };

  const result = await extractFilesCoverage('valid/path/to/cobertura.xml', options);
  expect(result).toEqual([{ id: expect.any(String), file: 'index.js', rate: 0.1 }]);
});

// Test generated using Keploy
it('should return null if coverage element is missing', async () => {
  const content = `
  <xml>
    <packages>
    </packages>
  </xml>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);

  const result = await extractOverallCoverage('valid/path/to/cobertura.xml');
  expect(result).toBeNull();
});

// Test generated using Keploy
it('should filter out files matching ignore patterns', async () => {
  const content = `
  <coverage>
    <packages>
      <package>
        <classes>
          <class filename="file1.js" line-rate="0.3" />
          <class filename="file2.js" line-rate="0.5" />
          <class filename="ignored_file.js" line-rate="0.4" />
        </classes>
      </package>
    </packages>
  </coverage>`;
  (<jest.Mock<any>>fs.readFile).mockResolvedValue(content);
  const options = {
    ignore: ['ignored_file.js'],
  };

  const result = await extractFilesCoverage('valid/path/to/cobertura.xml', options);
  expect(result).toEqual([
    { id: expect.any(String), file: 'file1.js', rate: 0.3 },
    { id: expect.any(String), file: 'file2.js', rate: 0.5 },
  ]);
});

