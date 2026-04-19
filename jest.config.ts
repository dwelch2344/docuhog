import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/ui/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Silence console output during tests
  silent: true,
  // Increase timeout for slower CI environments
  testTimeout: 15000,
};

export default config;
