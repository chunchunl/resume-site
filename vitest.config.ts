import { defineConfig } from 'vitest/config';

// 單元測試與設定檔測試：不需要先 build。build 產物測試另見 vitest.dist.config.ts。
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/config/**/*.test.ts'],
  },
});
