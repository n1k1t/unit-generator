import analyze from './analyze';

// Test generated using Keploy
test('should extract coverage with default target and limit when no paths are provided', async () => {
  const consoleTableSpy = jest.spyOn(console, 'table').mockImplementation();
  const parameters = {};
  await analyze(parameters);
  expect(consoleTableSpy).toHaveBeenCalled();
  consoleTableSpy.mockRestore();
});
