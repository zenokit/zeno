jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { build } from '@/cli/build';
import { readdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';

const mockReaddir = readdir as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;
const mockReadFileSync = readFileSync as jest.Mock;
const mockSpawn = spawn as jest.Mock;

const file = (name: string) => ({ name, isDirectory: () => false });

const ROUTES = '/fake/routes';

beforeEach(() => {
  jest.clearAllMocks();
  // No platform marker files; tsc binary present. Everything else absent.
  mockExistsSync.mockImplementation((p: string) => p.endsWith('tsc'));
  // No package.json / tsconfig.json → node platform, default outDir "dist".
  mockReadFileSync.mockImplementation(() => {
    throw new Error('ENOENT');
  });
  // tsc "runs" successfully but emits nothing.
  mockSpawn.mockImplementation(() => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const child = {
      on(ev: string, cb: (arg?: unknown) => void) {
        handlers[ev] = cb;
        return child;
      },
    };
    queueMicrotask(() => handlers.close?.(0));
    return child;
  });
});

describe('build — manifest verification (Bug #10)', () => {
  it('throws when the compiler emits no _manifest.js despite exiting 0', async () => {
    mockReaddir.mockImplementation(async (d: string) => {
      if (d === ROUTES) return [file('index.ts')];
      // outDir scan finds nothing compiled — the silent-failure scenario.
      return [];
    });

    await expect(build(ROUTES)).rejects.toThrow(/no _manifest\.js/);
  });

  it('completes when the compiled _manifest.js is present in the outDir', async () => {
    mockReaddir.mockImplementation(async (d: string) => {
      if (d === ROUTES) return [file('index.ts')];
      // outDir now contains the compiled manifest.
      if (d.endsWith('dist')) return [file('_manifest.js')];
      return [];
    });

    await expect(build(ROUTES)).resolves.toBeUndefined();
  });
});
