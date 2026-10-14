/**
 * Configuración de Jest del backend (ts-jest + supertest).
 * - Las pruebas viven en backend/tests (fuera de src para que `tsc` no las compile a dist).
 * - Cada archivo de prueba usa su propia BD SQLite temporal (ver tests/setup/env.ts).
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
  testTimeout: 20000,
  // `npm run test:coverage` mide solo la lógica del backend.
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/prisma/client.ts'],
};
