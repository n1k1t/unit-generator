import generate from './generate';
import fs from 'fs/promises';


jest.spyOn(fs, 'writeFile').mockImplementation(() => Promise.resolve());

// Test generated using Keploy
jest.mock('get-cursor-position', () => ({
  sync: jest.fn().mockReturnValue({ row: 0 })
}));

jest.mock('readline/promises', () => ({
  Readline: jest.fn().mockImplementation(() => ({
    cursorTo: jest.fn().mockReturnThis(),
    clearScreenDown: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(<never>undefined),
  })),
}));

jest.mock('../utils', () => ({
  extractIgnorePaths: jest.fn().mockResolvedValue(<never>[]),
  extractFilesCoverage: jest.fn().mockResolvedValue(<never>[]),
  actualizeProcessedCoverageRate: jest.fn(),
  renderProcessedCoverage: jest.fn(),
  cast: jest.fn().mockReturnValue('PENDING'),
}));

test('generate handles default parameters correctly', async () => {
  await expect(generate({})).resolves.not.toThrow();
});

// Test generated using Keploy
test('generate handles timeout correctly', async () => {
  jest.useFakeTimers();
  const mockCoverage = [{ file: 'file1.js', id: '1' }];
  const mockedExtractFilesCoverage = require('../utils').extractFilesCoverage;
  mockedExtractFilesCoverage.mockResolvedValueOnce(mockCoverage);

  const parameters = { iterations: 1, target: 0.5, paths: ['src'], verbose: false };

  const promise = generate(parameters);
  jest.advanceTimersByTime(1000);

  await expect(promise).resolves.not.toThrow();
  jest.clearAllTimers();
});

// Test generated using Keploy
test('generate creates spec file if not exists', async () => {
  const mockCoverage = [{ file: 'file1.js', id: '1', spec: 'file1.spec.js' }];
  const mockedExtractFilesCoverage = require('../utils').extractFilesCoverage;
  mockedExtractFilesCoverage.mockResolvedValueOnce(mockCoverage);

  const parameters = { iterations: 1, target: 0.5, paths: ['src'] };
  const fs = require('fs/promises');
  jest.spyOn(fs, 'stat').mockImplementation((filePath) => {
    if (filePath === 'file1.spec.js') {
      return Promise.reject(new Error('File does not exist'));
    }
    return Promise.resolve();
  });
  jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

  await generate(parameters);

  expect(fs.writeFile).toHaveBeenCalledWith('file1.spec.js', Buffer.from([]), 'utf8');
});

// Test generated using Keploy
test('generate handles missing coverage files correctly', async () => {
  const mockCoverage = [{ file: 'file1.js', id: '1', spec: 'file1.spec.js' }];
  const mockedExtractFilesCoverage = require('../utils').extractFilesCoverage;
  mockedExtractFilesCoverage.mockResolvedValueOnce(mockCoverage);

  const parameters = { iterations: 1, target: 0.5, paths: ['src'] };

  jest.spyOn(fs, 'stat')
    .mockResolvedValueOnce(<any>Promise.reject(new Error('File does not exist')))
    .mockResolvedValueOnce(<any>Promise.resolve()) // For temp directory creation
    .mockImplementationOnce(() => <any>Promise.resolve());

  await expect(generate(parameters)).resolves.not.toThrow();
});

// Test generated using Keploy
test('generate verbose mode writes output to stdout', async () => {
  const mockCoverage = [{ file: 'file1.js', id: '1' }];
  const mockedExtractFilesCoverage = require('../utils').extractFilesCoverage;
  mockedExtractFilesCoverage.mockResolvedValueOnce(mockCoverage);

  const parameters = { iterations: 1, target: 0.5, paths: ['src'], verbose: true };

  const mockWrite = jest.spyOn(process.stdout, 'write').mockImplementation(<any>(() => {}));

  await generate(parameters);

  expect(mockWrite).toHaveBeenCalled();
  mockWrite.mockRestore();
});
