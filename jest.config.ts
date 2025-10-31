export default {
  preset: `ts-jest`,
  testEnvironment: `node`,
  setupFilesAfterEnv: [`./jest.setup.ts`],
  setupFiles: [`reflect-metadata`],
};
