const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-time-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

const timeTracker = require('../src/timeTracker');
const taskManager = require('../src/taskManager');

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

describe('Time Tracker', () => {
  beforeEach(async () => {
    // Create a test task for each test
    await taskManager.createTask('test-task');
  });

  describe('Start Tracking', () => {
    test('should start tracking for existing task', async () => {
      const result = await timeTracker.startTracking('test-task');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Started tracking "test-task"');
      expect(result.startTime).toBeInstanceOf(Date);
      
      const status = await timeTracker.getStatus();
      expect(status.isTracking).toBe(true);
      expect(status.currentTask).toBe('test-task');
      expect(status.isPaused).toBe(false);
    });

    test('should not start tracking for non-existent task', async () => {
      const result = await timeTracker.startTracking('non-existent-task');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task "non-existent-task" does not exist');
    });

    test('should not start tracking if already tracking', async () => {
      await timeTracker.startTracking('test-task');
      const result = await timeTracker.startTracking('test-task');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already tracking "test-task". Stop current tracking first.');
    });

    test('should allow switching tasks by stopping current first', async () => {
      await taskManager.createTask('another-task');
      await timeTracker.startTracking('test-task');
      
      const stopResult = await timeTracker.stopTracking();
      expect(stopResult.success).toBe(true);
      
      const startResult = await timeTracker.startTracking('another-task');
      expect(startResult.success).toBe(true);
      expect(startResult.message).toBe('Started tracking "another-task"');
    });
  });

  describe('Stop Tracking', () => {
    test('should stop active tracking session', async () => {
      await timeTracker.startTracking('test-task');
      
      // Wait a small amount to ensure some time passes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await timeTracker.stopTracking();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Stopped tracking "test-task"');
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.session).toBe('object');
      expect(result.session.task).toBe('test-task');
      expect(result.session.duration).toBeGreaterThan(0);
      
      const status = await timeTracker.getStatus();
      expect(status.isTracking).toBe(false);
      expect(status.currentTask).toBeNull();
    });

    test('should not stop when not tracking', async () => {
      const result = await timeTracker.stopTracking();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tracking session');
    });

    test('should update task total time when stopping', async () => {
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 100));
      await timeTracker.stopTracking();
      
      const task = await taskManager.getTask('test-task');
      expect(task.totalTime).toBeGreaterThan(0);
      expect(task.sessions).toHaveLength(1);
      expect(task.sessions[0].duration).toBeGreaterThan(0);
    });
  });

  describe('Pause/Resume Tracking', () => {
    test('should pause active tracking session', async () => {
      await timeTracker.startTracking('test-task');
      
      const result = await timeTracker.pauseTracking();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Paused tracking "test-task"');
      
      const status = await timeTracker.getStatus();
      expect(status.isTracking).toBe(true);
      expect(status.isPaused).toBe(true);
      expect(status.currentTask).toBe('test-task');
    });

    test('should not pause when not tracking', async () => {
      const result = await timeTracker.pauseTracking();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tracking session to pause');
    });

    test('should not pause when already paused', async () => {
      await timeTracker.startTracking('test-task');
      await timeTracker.pauseTracking();
      
      const result = await timeTracker.pauseTracking();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tracking is already paused');
    });

    test('should resume paused tracking session', async () => {
      await timeTracker.startTracking('test-task');
      await timeTracker.pauseTracking();
      
      const result = await timeTracker.resumeTracking();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Resumed tracking "test-task"');
      
      const status = await timeTracker.getStatus();
      expect(status.isTracking).toBe(true);
      expect(status.isPaused).toBe(false);
      expect(status.currentTask).toBe('test-task');
    });

    test('should not resume when not paused', async () => {
      await timeTracker.startTracking('test-task');
      
      const result = await timeTracker.resumeTracking();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No paused session to resume');
    });

    test('should not resume when not tracking', async () => {
      const result = await timeTracker.resumeTracking();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tracking session');
    });

    test('should calculate time correctly with pause/resume', async () => {
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await timeTracker.pauseTracking();
      await new Promise(resolve => setTimeout(resolve, 100)); // Paused time should not count
      
      await timeTracker.resumeTracking();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result = await timeTracker.stopTracking();
      
      // Total time should be around 100ms (50ms + 50ms), not 200ms
      expect(result.duration).toBeGreaterThan(50);
      expect(result.duration).toBeLessThan(150);
    });
  });

  describe('Get Status', () => {
    test('should return no tracking status when idle', async () => {
      const status = await timeTracker.getStatus();
      
      expect(status).toEqual({
        isTracking: false,
        currentTask: null,
        startTime: null,
        isPaused: false,
        elapsedTime: 0
      });
    });

    test('should return tracking status when active', async () => {
      await timeTracker.startTracking('test-task');
      
      const status = await timeTracker.getStatus();
      
      expect(status.isTracking).toBe(true);
      expect(status.currentTask).toBe('test-task');
      expect(status.startTime).toBeInstanceOf(Date);
      expect(status.isPaused).toBe(false);
      expect(status.elapsedTime).toBeGreaterThanOrEqual(0);
    });

    test('should return paused status when paused', async () => {
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 50));
      await timeTracker.pauseTracking();
      
      const status = await timeTracker.getStatus();
      
      expect(status.isTracking).toBe(true);
      expect(status.currentTask).toBe('test-task');
      expect(status.isPaused).toBe(true);
      expect(status.elapsedTime).toBeGreaterThan(0);
    });

    test('should calculate elapsed time correctly', async () => {
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = await timeTracker.getStatus();
      
      expect(status.elapsedTime).toBeGreaterThan(50);
      expect(status.elapsedTime).toBeLessThan(200);
    });
  });

  describe('Session Management', () => {
    test('should create session record when stopping', async () => {
      const startTime = new Date();
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await timeTracker.stopTracking();
      
      expect(result.session).toEqual({
        task: 'test-task',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: expect.any(Number)
      });
      
      expect(result.session.startTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(result.session.endTime.getTime()).toBeGreaterThan(result.session.startTime.getTime());
      expect(result.session.duration).toBeGreaterThan(0);
    });

    test('should persist sessions to task', async () => {
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 50));
      await timeTracker.stopTracking();
      
      await timeTracker.startTracking('test-task');
      await new Promise(resolve => setTimeout(resolve, 50));
      await timeTracker.stopTracking();
      
      const task = await taskManager.getTask('test-task');
      expect(task.sessions).toHaveLength(2);
      expect(task.totalTime).toBeGreaterThan(0);
      
      const totalSessionTime = task.sessions.reduce((sum, session) => sum + session.duration, 0);
      expect(task.totalTime).toBe(totalSessionTime);
    });
  });
});