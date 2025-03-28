import calculate from './calculate';

// Test generated using Keploy
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(new Error('Command failed'))),
}));

test('exec command rejects on error', async () => {
  await expect(calculate()).rejects.toThrow('Command failed');
});
