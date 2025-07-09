const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { subDays, addDays } = require('date-fns');

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-goals-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

const goals = require('../src/goals');
const taskManager = require('../src/taskManager');
const timeTracker = require('../src/timeTracker');

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

// Helper function to create test session with specific date
async function createTestSession(taskId, date, durationMinutes) {
  await taskManager.createTask(taskId);
  
  // Simulate a session by manipulating the task data directly
  const tasks = await taskManager.getTask(taskId).then(task => task ? { [taskId]: task } : {});
  if (!tasks[taskId]) return;
  
  const startTime = new Date(date);
  const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
  const duration = durationMinutes * 60 * 1000;
  
  const session = {
    task: taskId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: duration
  };
  
  const task = await taskManager.getTask(taskId);
  task.sessions = task.sessions || [];
  task.sessions.push(session);
  task.totalTime = (task.totalTime || 0) + duration;
  
  // Update the task
  const storage = require('../src/storage');
  const allTasks = await storage.loadTasks();
  allTasks[taskId] = task;
  await storage.saveTasks(allTasks);
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

describe('Goals System', () => {
  beforeEach(async () => {
    // Create test task for each test
    await taskManager.createTask('test-task');
  });

  describe('Set Goals', () => {
    test('should set daily goal for a task', async () => {
      const result = await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000); // 2 hours
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily goal set for "test-task": 2h 0m');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals.daily).toBe(2 * 60 * 60 * 1000);
    });

    test('should set weekly goal for a task', async () => {
      const result = await goals.setGoal('test-task', 'weekly', 10 * 60 * 60 * 1000); // 10 hours
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Weekly goal set for "test-task": 10h 0m');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals.weekly).toBe(10 * 60 * 60 * 1000);
    });

    test('should set monthly goal for a task', async () => {
      const result = await goals.setGoal('test-task', 'monthly', 40 * 60 * 60 * 1000); // 40 hours
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Monthly goal set for "test-task": 40h 0m');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals.monthly).toBe(40 * 60 * 60 * 1000);
    });

    test('should set yearly goal for a task', async () => {
      const result = await goals.setGoal('test-task', 'yearly', 500 * 60 * 60 * 1000); // 500 hours
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Yearly goal set for "test-task": 500h 0m');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals.yearly).toBe(500 * 60 * 60 * 1000);
    });

    test('should reject invalid goal period', async () => {
      const result = await goals.setGoal('test-task', 'invalid', 60 * 60 * 1000);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid goal period. Use: daily, weekly, monthly, yearly');
    });

    test('should reject goal for non-existent task', async () => {
      const result = await goals.setGoal('non-existent', 'daily', 60 * 60 * 1000);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task "non-existent" does not exist');
    });

    test('should reject negative goal duration', async () => {
      const result = await goals.setGoal('test-task', 'daily', -1000);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Goal duration must be positive');
    });

    test('should update existing goal', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000); // 2 hours
      const result = await goals.setGoal('test-task', 'daily', 3 * 60 * 60 * 1000); // 3 hours
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily goal updated for "test-task": 3h 0m');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals.daily).toBe(3 * 60 * 60 * 1000);
    });
  });

  describe('Remove Goals', () => {
    test('should remove specific goal type', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000);
      await goals.setGoal('test-task', 'weekly', 10 * 60 * 60 * 1000);
      
      const result = await goals.removeGoal('test-task', 'daily');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily goal removed for "test-task"');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals.daily).toBeUndefined();
      expect(taskGoals.weekly).toBe(10 * 60 * 60 * 1000);
    });

    test('should remove all goals when no period specified', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000);
      await goals.setGoal('test-task', 'weekly', 10 * 60 * 60 * 1000);
      
      const result = await goals.removeGoal('test-task');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('All goals removed for "test-task"');
      
      const taskGoals = await goals.getTaskGoals('test-task');
      expect(taskGoals).toEqual({});
    });

    test('should handle removing non-existent goal', async () => {
      const result = await goals.removeGoal('test-task', 'daily');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No daily goal exists for "test-task"');
    });
  });

  describe('Goal Progress Tracking', () => {
    test('should calculate daily goal progress', async () => {
      await goals.setGoal('test-task', 'daily', 4 * 60 * 60 * 1000); // 4 hours goal
      
      // Add 2 hours of work today
      await createTestSession('test-task', new Date(), 120);
      
      const progress = await goals.getGoalProgress('test-task', 'daily');
      
      expect(progress.goalTime).toBe(4 * 60 * 60 * 1000);
      expect(progress.actualTime).toBe(2 * 60 * 60 * 1000);
      expect(progress.percentage).toBe(50);
      expect(progress.isAchieved).toBe(false);
      expect(progress.remainingTime).toBe(2 * 60 * 60 * 1000);
    });

    test('should calculate weekly goal progress', async () => {
      await goals.setGoal('test-task', 'weekly', 20 * 60 * 60 * 1000); // 20 hours goal
      
      // Add sessions across the week
      const today = new Date();
      await createTestSession('test-task', today, 300); // 5 hours today
      await createTestSession('test-task', subDays(today, 1), 240); // 4 hours yesterday
      await createTestSession('test-task', subDays(today, 2), 180); // 3 hours day before
      
      const progress = await goals.getGoalProgress('test-task', 'weekly');
      
      expect(progress.goalTime).toBe(20 * 60 * 60 * 1000);
      expect(progress.actualTime).toBe(12 * 60 * 60 * 1000); // 12 hours total
      expect(progress.percentage).toBe(60);
      expect(progress.isAchieved).toBe(false);
      expect(progress.remainingTime).toBe(8 * 60 * 60 * 1000);
    });

    test('should handle achieved goals', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000); // 2 hours goal
      
      // Add 3 hours of work (exceeds goal)
      await createTestSession('test-task', new Date(), 180);
      
      const progress = await goals.getGoalProgress('test-task', 'daily');
      
      expect(progress.goalTime).toBe(2 * 60 * 60 * 1000);
      expect(progress.actualTime).toBe(3 * 60 * 60 * 1000);
      expect(progress.percentage).toBe(150);
      expect(progress.isAchieved).toBe(true);
      expect(progress.remainingTime).toBe(0);
      expect(progress.overTime).toBe(1 * 60 * 60 * 1000);
    });

    test('should return null for non-existent goal', async () => {
      const progress = await goals.getGoalProgress('test-task', 'daily');
      expect(progress).toBeNull();
    });
  });

  describe('Goal Status Overview', () => {
    test('should get all goal statuses for a task', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000);
      await goals.setGoal('test-task', 'weekly', 10 * 60 * 60 * 1000);
      await goals.setGoal('test-task', 'monthly', 40 * 60 * 60 * 1000);
      
      // Add some work
      await createTestSession('test-task', new Date(), 60); // 1 hour today
      
      const status = await goals.getTaskGoalStatus('test-task');
      
      expect(status.taskName).toBe('test-task');
      expect(status.goals).toHaveLength(3);
      
      const dailyGoal = status.goals.find(g => g.period === 'daily');
      expect(dailyGoal.progress.percentage).toBe(50); // 1h of 2h goal
      expect(dailyGoal.progress.isAchieved).toBe(false);
    });

    test('should get overview of all tasks with goals', async () => {
      await taskManager.createTask('task1');
      await taskManager.createTask('task2');
      
      await goals.setGoal('task1', 'daily', 4 * 60 * 60 * 1000);
      await goals.setGoal('task2', 'weekly', 20 * 60 * 60 * 1000);
      
      await createTestSession('task1', new Date(), 120); // 2 hours
      await createTestSession('task2', new Date(), 300); // 5 hours
      
      const overview = await goals.getAllGoalsOverview();
      
      expect(overview).toHaveLength(2);
      expect(overview.find(t => t.taskName === 'task1')).toBeDefined();
      expect(overview.find(t => t.taskName === 'task2')).toBeDefined();
    });
  });

  describe('Goal Utilities', () => {
    test('should list all tasks with goals', async () => {
      await taskManager.createTask('task1');
      await taskManager.createTask('task2');
      await taskManager.createTask('task3'); // no goals
      
      await goals.setGoal('task1', 'daily', 2 * 60 * 60 * 1000);
      await goals.setGoal('task2', 'weekly', 10 * 60 * 60 * 1000);
      
      const tasksWithGoals = await goals.getTasksWithGoals();
      
      expect(tasksWithGoals).toHaveLength(2);
      expect(tasksWithGoals.map(t => t.name)).toEqual(['task1', 'task2']);
    });

    test('should validate goal periods', () => {
      expect(goals.isValidGoalPeriod('daily')).toBe(true);
      expect(goals.isValidGoalPeriod('weekly')).toBe(true);
      expect(goals.isValidGoalPeriod('monthly')).toBe(true);
      expect(goals.isValidGoalPeriod('yearly')).toBe(true);
      expect(goals.isValidGoalPeriod('invalid')).toBe(false);
      expect(goals.isValidGoalPeriod('')).toBe(false);
    });

    test('should format goal duration correctly', () => {
      expect(goals.formatDuration(3661000)).toBe('1h 1m 1s'); // 1 hour, 1 minute, 1 second
      expect(goals.formatDuration(7200000)).toBe('2h 0m'); // 2 hours
      expect(goals.formatDuration(300000)).toBe('5m 0s'); // 5 minutes
      expect(goals.formatDuration(45000)).toBe('45s'); // 45 seconds
    });
  });

  describe('Goal Achievement Tracking', () => {
    test('should track streak of achieved daily goals', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000); // 2 hours
      
      // Achieve goal for 3 consecutive days
      await createTestSession('test-task', new Date(), 150); // Today: 2.5 hours
      await createTestSession('test-task', subDays(new Date(), 1), 130); // Yesterday: 2.17 hours
      await createTestSession('test-task', subDays(new Date(), 2), 140); // Day before: 2.33 hours
      
      const streak = await goals.getGoalStreak('test-task', 'daily');
      
      expect(streak.currentStreak).toBeGreaterThanOrEqual(1); // At least today
      expect(streak.longestStreak).toBeGreaterThanOrEqual(1);
      expect(streak.totalAchieved).toBeGreaterThanOrEqual(1);
    });

    test('should handle broken streaks', async () => {
      await goals.setGoal('test-task', 'daily', 2 * 60 * 60 * 1000); // 2 hours
      
      // Achieve goal today but not yesterday
      await createTestSession('test-task', new Date(), 150); // Today: 2.5 hours
      await createTestSession('test-task', subDays(new Date(), 1), 60); // Yesterday: 1 hour (not achieved)
      await createTestSession('test-task', subDays(new Date(), 2), 140); // Day before: 2.33 hours
      
      const streak = await goals.getGoalStreak('test-task', 'daily');
      
      expect(streak.currentStreak).toBe(1); // Only today
    });
  });
});