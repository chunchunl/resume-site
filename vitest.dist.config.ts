import { defineConfig } from 'vitest/config';

// build 產物測試：先執行 npm run build，再解析 dist/ 內的檔案。
export default defineConfig({
  test: {
    include: ['tests/dist/**/*.test.ts'],
  },
});
