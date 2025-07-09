const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-task-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

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

describe('Task Manager', () => {
  describe('Create Task', () => {
    test('should create a new task with valid name', async () => {
      const taskName = 'my-project';
      const result = await taskManager.createTask(taskName);
      
      expect(result.success).toBe(true);
      expect(result.task).toEqual({
        id: taskName,
        name: taskName,
        created: expect.any(String),
        totalTime: 0,
        sessions: []
      });
      expect(new Date(result.task.created)).toBeInstanceOf(Date);
    });

    test('should reject empty task name', async () => {
      const result = await taskManager.createTask('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task name cannot be empty');
    });

    test('should reject task name with invalid characters', async () => {
      const result = await taskManager.createTask('task with spaces');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task name can only contain letters, numbers, hyphens, and underscores');
    });

    test('should reject duplicate task names', async () => {
      await taskManager.createTask('existing-task');
      const result = await taskManager.createTask('existing-task');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task "existing-task" already exists');
    });

    test('should allow valid task name formats', async () => {
      const validNames = ['project-1', 'task_2', 'work123', 'frontend-dev'];
      
      for (const name of validNames) {
        const result = await taskManager.createTask(name);
        expect(result.success).toBe(true);
        expect(result.task.id).toBe(name);
      }
    });
  });

  describe('List Tasks', () => {
    test('should return empty array when no tasks exist', async () => {
      const tasks = await taskManager.listTasks();
      expect(tasks).toEqual([]);
    });

    test('should return all created tasks', async () => {
      await taskManager.createTask('task1');
      await taskManager.createTask('task2');
      await taskManager.createTask('task3');
      
      const tasks = await taskManager.listTasks();
      
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.id)).toEqual(['task1', 'task2', 'task3']);
    });

    test('should return tasks with correct structure', async () => {
      await taskManager.createTask('test-task');
      
      const tasks = await taskManager.listTasks();
      
      expect(tasks[0]).toEqual({
        id: 'test-task',
        name: 'test-task',
        created: expect.any(String),
        totalTime: 0,
        sessions: []
      });
    });

    test('should sort tasks by creation date', async () => {
      // Create tasks with small delays to ensure different timestamps
      await taskManager.createTask('first');
      await new Promise(resolve => setTimeout(resolve, 10));
      await taskManager.createTask('second');
      await new Promise(resolve => setTimeout(resolve, 10));
      await taskManager.createTask('third');
      
      const tasks = await taskManager.listTasks();
      
      expect(tasks.map(t => t.id)).toEqual(['first', 'second', 'third']);
      expect(new Date(tasks[0].created).getTime()).toBeLessThan(new Date(tasks[1].created).getTime());
      expect(new Date(tasks[1].created).getTime()).toBeLessThan(new Date(tasks[2].created).getTime());
    });
  });

  describe('Get Task', () => {
    test('should return task if it exists', async () => {
      await taskManager.createTask('existing-task');
      
      const task = await taskManager.getTask('existing-task');
      
      expect(task).toEqual({
        id: 'existing-task',
        name: 'existing-task',
        created: expect.any(String),
        totalTime: 0,
        sessions: []
      });
    });

    test('should return null if task does not exist', async () => {
      const task = await taskManager.getTask('non-existent-task');
      expect(task).toBeNull();
    });
  });

  describe('Delete Task', () => {
    test('should delete existing task', async () => {
      await taskManager.createTask('to-delete');
      
      const result = await taskManager.deleteTask('to-delete');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Task "to-delete" deleted successfully');
      
      const task = await taskManager.getTask('to-delete');
      expect(task).toBeNull();
    });

    test('should return error when deleting non-existent task', async () => {
      const result = await taskManager.deleteTask('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task "non-existent" does not exist');
    });
  });

  describe('Task Validation', () => {
    test('should validate task name format', () => {
      expect(taskManager.isValidTaskName('valid-name')).toBe(true);
      expect(taskManager.isValidTaskName('valid_name')).toBe(true);
      expect(taskManager.isValidTaskName('validname123')).toBe(true);
      expect(taskManager.isValidTaskName('valid-name_123')).toBe(true);
      
      expect(taskManager.isValidTaskName('')).toBe(false);
      expect(taskManager.isValidTaskName('invalid name')).toBe(false);
      expect(taskManager.isValidTaskName('invalid@name')).toBe(false);
      expect(taskManager.isValidTaskName('invalid.name')).toBe(false);
      expect(taskManager.isValidTaskName('invalid/name')).toBe(false);
    });
  });

  describe('Task Selection', () => {
    test('should return formatted task choices when tasks exist', async () => {
      // Create some tasks with different creation times
      await taskManager.createTask('task1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await taskManager.createTask('task2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await taskManager.createTask('task3');
      
      const choices = await taskManager.getTaskChoices();
      
      expect(choices).toHaveLength(3);
      expect(choices[0]).toEqual({
        name: expect.stringContaining('task1'),
        value: 'task1'
      });
      expect(choices[1]).toEqual({
        name: expect.stringContaining('task2'),
        value: 'task2'
      });
      expect(choices[2]).toEqual({
        name: expect.stringContaining('task3'),
        value: 'task3'
      });
    });

    test('should include task metadata in choice names', async () => {
      await taskManager.createTask('test-task');
      
      const choices = await taskManager.getTaskChoices();
      
      expect(choices[0].name).toContain('test-task');
      expect(choices[0].name).toContain('0s'); // Should show totalTime
      expect(choices[0].name).toMatch(/created: \d{1,2}\/\d{1,2}\/\d{4}/); // Should show creation date
    });

    test('should return empty array when no tasks exist', async () => {
      const choices = await taskManager.getTaskChoices();
      expect(choices).toEqual([]);
    });

    test('should sort choices by creation date (oldest first)', async () => {
      // Create tasks with delays to ensure different timestamps
      await taskManager.createTask('first');
      await new Promise(resolve => setTimeout(resolve, 10));
      await taskManager.createTask('second');
      await new Promise(resolve => setTimeout(resolve, 10));
      await taskManager.createTask('third');
      
      const choices = await taskManager.getTaskChoices();
      
      expect(choices[0].value).toBe('first');
      expect(choices[1].value).toBe('second');
      expect(choices[2].value).toBe('third');
    });
  });
});