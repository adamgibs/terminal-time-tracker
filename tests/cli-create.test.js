const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-cli-create-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

const execAsync = util.promisify(exec);
const cliPath = path.join(__dirname, '..', 'src', 'index.js');

// Helper function to remove directory recursively
async function removeDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await removeDirectory(fullPath);
      } else {
        await fs.unlink(fullPath);
      }
    }
    await fs.rmdir(dirPath);
  } catch (error) {
    // Ignore if directory doesn't exist
  }
}

beforeEach(async () => {
  // Clean up test data directory before each test
  await removeDirectory(path.join(mockTestHome, '.tt-data'));
});

afterEach(async () => {
  // Clean up test data directory after each test
  await removeDirectory(path.join(mockTestHome, '.tt-data'));
});

afterAll(async () => {
  // Clean up entire test home directory
  await removeDirectory(mockTestHome);
});

describe('CLI Create Command', () => {
  test('should create a new task without starting timer', async () => {
    const { stdout } = await execAsync(`node ${cliPath} create my-project`);
    
    expect(stdout).toContain('Created task: my-project');
    
    // Verify task was created by listing tasks
    const { stdout: listOutput } = await execAsync(`node ${cliPath} list`);
    expect(listOutput).toContain('my-project');
  });

  test('should reject invalid task names', async () => {
    const { stdout } = await execAsync(`NODE_ENV=test node ${cliPath} create "invalid name"`);
    expect(stdout).toContain('Task name can only contain letters, numbers, hyphens, and underscores');
  });

  test('should reject empty task names', async () => {
    const { stdout } = await execAsync(`NODE_ENV=test node ${cliPath} create ""`);
    expect(stdout).toContain('Task name cannot be empty');
  });

  test('should reject duplicate task names', async () => {
    // Create first task
    await execAsync(`node ${cliPath} create existing-task`);
    
    // Try to create duplicate
    const { stdout } = await execAsync(`NODE_ENV=test node ${cliPath} create existing-task`);
    expect(stdout).toContain('Task "existing-task" already exists');
  });

  test('should create multiple different tasks', async () => {
    await execAsync(`node ${cliPath} create task1`);
    await execAsync(`node ${cliPath} create task2`);
    await execAsync(`node ${cliPath} create task3`);
    
    const { stdout } = await execAsync(`node ${cliPath} list`);
    expect(stdout).toContain('task1');
    expect(stdout).toContain('task2');
    expect(stdout).toContain('task3');
  });

  test('should not start timer when creating task', async () => {
    // Make sure no tracking is active first
    try {
      await execAsync(`node ${cliPath} stop`);
    } catch (error) {
      // Ignore if no tracking was active
    }
    
    await execAsync(`node ${cliPath} create my-task`);
    
    const { stdout } = await execAsync(`node ${cliPath} status`);
    expect(stdout).toContain('Not tracking');
  });
});

describe('CLI Start Command Enhancement', () => {
  test('should show task selection when no task specified and tasks exist', async () => {
    // Create some tasks first
    await execAsync(`node ${cliPath} create task1`);
    await execAsync(`node ${cliPath} create task2`);
    await execAsync(`node ${cliPath} create task3`);
    
    // This test verifies that the command doesn't immediately fail when no task is specified
    // We can't easily test interactive prompts in unit tests, so we just verify it starts properly
    let processStarted = false;
    
    try {
      // Use timeout to prevent hanging on interactive prompt
      await execAsync(`node ${cliPath} start`, { timeout: 500 });
    } catch (error) {
      // Expected to timeout since it's waiting for user input
      // Check that it's not an immediate failure but a timeout
      if (error.signal === 'SIGTERM' || error.code === 'SIGTERM') {
        processStarted = true;
      }
    }
    
    expect(processStarted).toBe(true);
  });

  test('should show helpful message when no tasks exist and no task specified', async () => {
    const { stdout } = await execAsync(`NODE_ENV=test node ${cliPath} start`);
    expect(stdout).toContain('No tasks found');
  });

  test('should maintain existing behavior when task is specified', async () => {
    // Make sure no tracking is active first
    try {
      await execAsync(`node ${cliPath} stop`);
    } catch (error) {
      // Ignore if no tracking was active
    }
    
    const { stdout } = await execAsync(`node ${cliPath} start my-task`);
    expect(stdout).toContain('Started tracking "my-task"');
    
    // Verify task was created and tracking started
    const { stdout: statusOutput } = await execAsync(`node ${cliPath} status`);
    expect(statusOutput).toContain('my-task');
    expect(statusOutput).toContain('Active');
  });
});