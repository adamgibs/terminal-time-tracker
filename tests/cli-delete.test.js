const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = util.promisify(exec);

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-cli-delete-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

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

describe('CLI Delete Command', () => {
  const cliPath = path.join(__dirname, '..', 'src', 'index.js');
  
  test('should delete existing task', async () => {
    // Create a task first
    await execAsync(`node ${cliPath} start test-task`);
    await execAsync(`node ${cliPath} stop`);
    
    // Verify task exists
    const { stdout: listOutput } = await execAsync(`node ${cliPath} list`);
    expect(listOutput).toContain('test-task');
    
    // Delete the task
    const { stdout: deleteOutput } = await execAsync(`node ${cliPath} delete test-task`);
    expect(deleteOutput).toContain('Task "test-task" deleted successfully');
    
    // Verify task is removed
    const { stdout: listAfterDelete } = await execAsync(`node ${cliPath} list`);
    expect(listAfterDelete).not.toContain('test-task');
    // Note: May contain other tasks from concurrent tests, so just check the task was removed
  });

  test('should show error when deleting non-existent task', async () => {
    try {
      await execAsync(`node ${cliPath} delete non-existent-task`);
    } catch (error) {
      expect(error.stdout).toContain('Task "non-existent-task" does not exist');
    }
  });

  test('should delete task with time tracking data', async () => {
    // Create a task and track some time
    await execAsync(`node ${cliPath} start project-work`);
    
    // Wait a bit to accumulate some time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await execAsync(`node ${cliPath} stop`);
    
    // Verify task has some time tracked
    const { stdout: listOutput } = await execAsync(`node ${cliPath} list`);
    expect(listOutput).toContain('project-work');
    
    // Delete the task
    const { stdout: deleteOutput } = await execAsync(`node ${cliPath} delete project-work`);
    expect(deleteOutput).toContain('Task "project-work" deleted successfully');
    
    // Verify task is removed
    const { stdout: listAfterDelete } = await execAsync(`node ${cliPath} list`);
    expect(listAfterDelete).not.toContain('project-work');
  });

  test('should delete one task while keeping others', async () => {
    // Create multiple tasks
    await execAsync(`node ${cliPath} start task-1`);
    await execAsync(`node ${cliPath} stop`);
    await execAsync(`node ${cliPath} start task-2`);
    await execAsync(`node ${cliPath} stop`);
    await execAsync(`node ${cliPath} start task-3`);
    await execAsync(`node ${cliPath} stop`);
    
    // Verify all tasks exist
    const { stdout: listOutput } = await execAsync(`node ${cliPath} list`);
    expect(listOutput).toContain('task-1');
    expect(listOutput).toContain('task-2');
    expect(listOutput).toContain('task-3');
    
    // Delete one task
    const { stdout: deleteOutput } = await execAsync(`node ${cliPath} delete task-2`);
    expect(deleteOutput).toContain('Task "task-2" deleted successfully');
    
    // Verify only task-2 is removed
    const { stdout: listAfterDelete } = await execAsync(`node ${cliPath} list`);
    expect(listAfterDelete).toContain('task-1');
    expect(listAfterDelete).not.toContain('task-2');
    expect(listAfterDelete).toContain('task-3');
  });
});