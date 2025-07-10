/**
 * Video player adapter framework entry point
 */

export * from "./IPlayerAdapter";
export * from "./GenericHTML5Adapter";
export * from "./AdapterFactory";

// Testing utilities (only export in development)
export { TestAdapter } from "./testing/TestAdapter";
export {
  runAdapterTests,
  standardAdapterTests,
  createTestReport,
  createMockVideoElement,
  type AdapterTestCase,
  type AdapterTestResult,
} from "./testing/AdapterTestUtils";
