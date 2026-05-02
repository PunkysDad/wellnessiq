jest.mock('expo/src/winter', () => {});
jest.mock('expo/virtual/streams', () => {});

// react-native-purchases ships a NativeEventEmitter that fails under Jest.
// Individual test files can override this mock via jest.mock() if they need
// specific behavior (see revenueCatService.test.ts).
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

// Suppress service console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
