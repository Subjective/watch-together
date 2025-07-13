/**
 * Video player adapter framework entry point
 */

export * from "./IPlayerAdapter";
export * from "./GenericHTML5Adapter";
export * from "./CrunchyrollVilosAdapter";
export * from "./AdapterFactory";
export * from "./utils/IframePlayerBase";

// Diagnostic utilities (only in development)
export {
  UniversalPlayerDiagnostic,
  runUniversalPlayerDiagnostic,
} from "./diagnostics/UniversalPlayerDiagnostic";

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
