/**
 * Cấu hình Jest riêng cho bộ kiểm thử chất lượng.
 * Không dùng jest.config.js / jest.setup.js của dự án và không chạy các test
 * trong __tests__; chỉ nạp file *.quality.ts(x) trong thư mục này.
 *
 * Chạy từ code/booking_classroom:
 *   npx jest --config quality-tests/jest.config.js
 */
module.exports = {
  rootDir: '..',
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/quality-tests'],
  testMatch: ['<rootDir>/quality-tests/**/*.quality.[jt]s?(x)'],
  setupFiles: ['<rootDir>/quality-tests/setup/asyncStorageMock.js'],
  // Lần chạy đầu (chưa có cache) Jest phải transform các module React Native,
  // lần render đầu tiên có thể vượt mức mặc định 5 giây.
  testTimeout: 30000,
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}'],
  coverageDirectory: '<rootDir>/quality-tests/coverage',
};
