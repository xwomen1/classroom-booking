const path = require('path');
const appRoot = path.resolve(__dirname, '../../../../../../code/booking_classroom');
module.exports = {
  rootDir: appRoot,
  preset: '@react-native/jest-preset',
  roots: [__dirname],
  testMatch: [path.join(__dirname, 'notification-permission.test.js')],
  modulePaths: [path.join(appRoot, 'node_modules')],
};
