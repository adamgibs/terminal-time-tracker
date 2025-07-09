const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

const storage = require('../src/storage');

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

describe('Storage System', () => {
  describe('Tasks Storage', () => {
    test('should load empty tasks object when no file exists', async () => {
      const tasks = await storage.loadTasks();
      expect(tasks).toEqual({});
    });

    test('should save and load tasks correctly', async () => {
      const testTasks = {
        'task1': {
          name: 'Test Task 1',
          created: new Date().toISOString(),
          totalTime: 0
        },
        'task2': {
          name: 'Test Task 2',
          created: new Date().toISOString(),
          totalTime: 3600000
        }
      };

      await storage.saveTasks(testTasks);
      const loadedTasks = await storage.loadTasks();
      
      expect(loadedTasks).toEqual(testTasks);
    });

    test('should create data directory if it does not exist', async () => {
      const testTasks = { 'task1': { name: 'Test Task' } };
      await storage.saveTasks(testTasks);
      
      const dataDir = path.join(mockTestHome, '.tt-data');
      const stats = await fs.stat(dataDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Tracking Storage', () => {
    test('should load default tracking state when no file exists', async () => {
      const tracking = await storage.loadTracking();
      expect(tracking).toEqual({
        currentTask: null,
        startTime: null,
        pausedTime: null,
        isPaused: false,
        sessions: []
      });
    });

    test('should save and load tracking state correctly', async () => {
      const testTracking = {
        currentTask: 'task1',
        startTime: new Date().toISOString(),
        pausedTime: null,
        isPaused: false,
        sessions: [
          {
            task: 'task1',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 1800000
          }
        ]
      };

      await storage.saveTracking(testTracking);
      const loadedTracking = await storage.loadTracking();
      
      expect(loadedTracking).toEqual(testTracking);
    });

    test('should preserve tracking data structure', async () => {
      const testTracking = {
        currentTask: 'work-project',
        startTime: '2023-01-01T10:00:00.000Z',
        pausedTime: null,
        isPaused: false,
        sessions: []
      };

      await storage.saveTracking(testTracking);
      const loadedTracking = await storage.loadTracking();
      
      expect(loadedTracking.currentTask).toBe('work-project');
      expect(loadedTracking.startTime).toBe('2023-01-01T10:00:00.000Z');
      expect(loadedTracking.isPaused).toBe(false);
      expect(Array.isArray(loadedTracking.sessions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted tasks file gracefully', async () => {
      // Create a corrupted file
      const dataDir = path.join(mockTestHome, '.tt-data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(path.join(dataDir, 'tasks.json'), 'invalid json');
      
      await expect(storage.loadTasks()).rejects.toThrow();
    });

    test('should handle corrupted tracking file gracefully', async () => {
      // Create a corrupted file
      const dataDir = path.join(mockTestHome, '.tt-data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(path.join(dataDir, 'tracking.json'), 'invalid json');
      
      await expect(storage.loadTracking()).rejects.toThrow();
    });
  });
});