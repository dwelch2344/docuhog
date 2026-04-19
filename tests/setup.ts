import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Create a unique temp directory for test data
const testDataDir = path.join(os.tmpdir(), `docuhog-test-${process.pid}-${Date.now()}`);

// Set environment variables BEFORE any source modules are imported
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
// Ensure SMTP is not configured during tests
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

// Clean up temp directory after all tests complete
afterAll(() => {
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});
