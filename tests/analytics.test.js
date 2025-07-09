const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, subYears } = require('date-fns');

// Mock os.homedir to use our test directory
const mockTestHome = path.join(os.tmpdir(), 'tt-analytics-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockTestHome
}));

const analytics = require('../src/analytics');
const taskManager = require('../src/taskManager');
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

// Helper function to create test sessions with specific dates
async function createTestSession(taskId, date, durationMinutes) {
  const tasks = await storage.loadTasks();
  if (!tasks[taskId]) {
    await taskManager.createTask(taskId);
  }
  
  const task = await taskManager.getTask(taskId);
  const startTime = new Date(date);
  const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
  const duration = durationMinutes * 60 * 1000;
  
  const session = {
    task: taskId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: duration
  };
  
  task.sessions = task.sessions || [];
  task.sessions.push(session);
  task.totalTime = (task.totalTime || 0) + duration;
  
  const updatedTasks = await storage.loadTasks();
  updatedTasks[taskId] = task;
  await storage.saveTasks(updatedTasks);
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

describe('Analytics System', () => {
  describe('Daily Analytics', () => {
    test('should return today\'s time tracking data', async () => {
      const today = new Date();
      await createTestSession('work', today, 120); // 2 hours
      await createTestSession('coding', today, 60); // 1 hour
      
      const result = await analytics.getDailyAnalytics();
      
      expect(result.period).toBe('today');
      expect(result.totalTime).toBe(180 * 60 * 1000); // 3 hours in ms
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.find(t => t.name === 'work').totalTime).toBe(120 * 60 * 1000);
      expect(result.tasks.find(t => t.name === 'coding').totalTime).toBe(60 * 60 * 1000);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    test('should return specific date\'s analytics', async () => {
      const targetDate = subDays(new Date(), 2);
      await createTestSession('work', targetDate, 90); // 1.5 hours
      
      const result = await analytics.getDailyAnalytics(targetDate);
      
      expect(result.totalTime).toBe(90 * 60 * 1000);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].name).toBe('work');
    });

    test('should return empty analytics for days with no sessions', async () => {
      const result = await analytics.getDailyAnalytics();
      
      expect(result.totalTime).toBe(0);
      expect(result.tasks).toEqual([]);
      expect(result.period).toBe('today');
    });
  });

  describe('Weekly Analytics', () => {
    test('should return current week\'s analytics', async () => {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      
      // Create sessions across the week
      await createTestSession('work', weekStart, 480); // 8 hours Monday
      await createTestSession('work', new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000), 240); // 4 hours Wednesday
      await createTestSession('coding', new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000), 120); // 2 hours Friday
      
      const result = await analytics.getWeeklyAnalytics();
      
      expect(result.period).toBe('this week');
      expect(result.totalTime).toBe(14 * 60 * 60 * 1000); // 14 hours in ms
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.find(t => t.name === 'work').totalTime).toBe(12 * 60 * 60 * 1000); // 12 hours
      expect(result.tasks.find(t => t.name === 'coding').totalTime).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(result.dailyBreakdown).toHaveLength(7);
    });

    test('should return specific week\'s analytics', async () => {
      const lastWeek = subWeeks(new Date(), 1);
      const lastWeekStart = startOfWeek(lastWeek, { weekStartsOn: 1 });
      
      await createTestSession('work', lastWeekStart, 300); // 5 hours
      
      const result = await analytics.getWeeklyAnalytics(lastWeek);
      
      expect(result.totalTime).toBe(5 * 60 * 60 * 1000);
      expect(result.tasks[0].name).toBe('work');
      expect(result.dailyBreakdown).toHaveLength(7);
      expect(result.dailyBreakdown[0].totalTime).toBe(5 * 60 * 60 * 1000);
    });

    test('should include daily breakdown for the week', async () => {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      
      await createTestSession('work', weekStart, 120);
      await createTestSession('work', new Date(weekStart.getTime() + 1 * 24 * 60 * 60 * 1000), 60);
      
      const result = await analytics.getWeeklyAnalytics();
      
      expect(result.dailyBreakdown).toHaveLength(7);
      expect(result.dailyBreakdown[0].totalTime).toBe(120 * 60 * 1000);
      expect(result.dailyBreakdown[1].totalTime).toBe(60 * 60 * 1000);
      expect(result.dailyBreakdown[2].totalTime).toBe(0);
    });
  });

  describe('Monthly Analytics', () => {
    test('should return current month\'s analytics', async () => {
      const today = new Date();
      const monthStart = startOfMonth(today);
      
      // Create sessions across the month
      await createTestSession('work', monthStart, 480); // 8 hours on 1st
      await createTestSession('coding', new Date(monthStart.getTime() + 15 * 24 * 60 * 60 * 1000), 240); // 4 hours on 16th
      await createTestSession('work', new Date(monthStart.getTime() + 20 * 24 * 60 * 60 * 1000), 120); // 2 hours on 21st
      
      const result = await analytics.getMonthlyAnalytics();
      
      expect(result.period).toBe('this month');
      expect(result.totalTime).toBe(14 * 60 * 60 * 1000); // 14 hours
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.find(t => t.name === 'work').totalTime).toBe(10 * 60 * 60 * 1000);
      expect(result.tasks.find(t => t.name === 'coding').totalTime).toBe(4 * 60 * 60 * 1000);
      expect(result.weeklyBreakdown).toBeDefined();
    });

    test('should return specific month\'s analytics', async () => {
      const lastMonth = subMonths(new Date(), 1);
      const lastMonthStart = startOfMonth(lastMonth);
      
      await createTestSession('project', lastMonthStart, 600); // 10 hours
      
      const result = await analytics.getMonthlyAnalytics(lastMonth);
      
      expect(result.totalTime).toBe(10 * 60 * 60 * 1000);
      expect(result.tasks[0].name).toBe('project');
    });

    test('should include weekly breakdown for the month', async () => {
      const today = new Date();
      const monthStart = startOfMonth(today);
      
      // First week
      await createTestSession('work', monthStart, 120);
      // Third week
      await createTestSession('work', new Date(monthStart.getTime() + 14 * 24 * 60 * 60 * 1000), 60);
      
      const result = await analytics.getMonthlyAnalytics();
      
      expect(Array.isArray(result.weeklyBreakdown)).toBe(true);
      expect(result.weeklyBreakdown.length).toBeGreaterThan(0);
    });
  });

  describe('Yearly Analytics', () => {
    test('should return current year\'s analytics', async () => {
      const today = new Date();
      const yearStart = startOfYear(today);
      
      // Create sessions across the year
      await createTestSession('work', yearStart, 480); // January
      await createTestSession('coding', new Date(yearStart.getTime() + 90 * 24 * 60 * 60 * 1000), 240); // April
      await createTestSession('project', new Date(yearStart.getTime() + 180 * 24 * 60 * 60 * 1000), 360); // July
      
      const result = await analytics.getYearlyAnalytics();
      
      expect(result.period).toBe('this year');
      expect(result.totalTime).toBe(18 * 60 * 60 * 1000); // 18 hours
      expect(result.tasks).toHaveLength(3);
      expect(result.monthlyBreakdown).toHaveLength(12);
    });

    test('should return specific year\'s analytics', async () => {
      const lastYear = subYears(new Date(), 1);
      const lastYearStart = startOfYear(lastYear);
      
      await createTestSession('old-project', lastYearStart, 1200); // 20 hours
      
      const result = await analytics.getYearlyAnalytics(lastYear);
      
      expect(result.totalTime).toBe(20 * 60 * 60 * 1000);
      expect(result.tasks[0].name).toBe('old-project');
    });

    test('should include monthly breakdown for the year', async () => {
      const today = new Date();
      const yearStart = startOfYear(today);
      
      await createTestSession('work', yearStart, 120); // January
      await createTestSession('work', new Date(yearStart.getTime() + 60 * 24 * 60 * 60 * 1000), 60); // March
      
      const result = await analytics.getYearlyAnalytics();
      
      expect(result.monthlyBreakdown).toHaveLength(12);
      expect(result.monthlyBreakdown[0].totalTime).toBe(120 * 60 * 1000); // January
      expect(result.monthlyBreakdown[1].totalTime).toBe(0); // February
      expect(result.monthlyBreakdown[2].totalTime).toBe(60 * 60 * 1000); // March
    });
  });

  describe('Task Summary Analytics', () => {
    test('should return task rankings by total time', async () => {
      const today = new Date();
      await createTestSession('work', today, 300); // 5 hours
      await createTestSession('coding', today, 120); // 2 hours
      await createTestSession('meetings', today, 60); // 1 hour
      
      const result = await analytics.getTaskSummary();
      
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].name).toBe('work'); // Most time
      expect(result.tasks[0].totalTime).toBe(5 * 60 * 60 * 1000);
      expect(result.tasks[1].name).toBe('coding');
      expect(result.tasks[2].name).toBe('meetings'); // Least time
      expect(result.totalTimeAllTasks).toBe(8 * 60 * 60 * 1000);
    });

    test('should calculate percentage distribution', async () => {
      const today = new Date();
      await createTestSession('work', today, 60); // 1 hour
      await createTestSession('coding', today, 180); // 3 hours
      
      const result = await analytics.getTaskSummary();
      
      expect(result.tasks[0].percentage).toBe(75); // coding: 3/4 hours = 75%
      expect(result.tasks[1].percentage).toBe(25); // work: 1/4 hours = 25%
    });

    test('should return empty summary when no tasks exist', async () => {
      const result = await analytics.getTaskSummary();
      
      expect(result.tasks).toEqual([]);
      expect(result.totalTimeAllTasks).toBe(0);
    });
  });

  describe('Time Period Utilities', () => {
    test('should filter sessions by date range', async () => {
      const today = new Date();
      const yesterday = subDays(today, 1);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      
      await createTestSession('work', yesterday, 60);
      await createTestSession('work', today, 120);
      await createTestSession('work', tomorrow, 90);
      
      const tasks = await storage.loadTasks();
      const filteredSessions = analytics.filterSessionsByDateRange(tasks.work.sessions, today, today);
      
      expect(filteredSessions).toHaveLength(1);
      expect(filteredSessions[0].duration).toBe(120 * 60 * 1000);
    });

    test('should group sessions by task', async () => {
      const today = new Date();
      await createTestSession('work', today, 60);
      await createTestSession('work', today, 30);
      await createTestSession('coding', today, 90);
      
      const tasks = await storage.loadTasks();
      const allSessions = [];
      Object.values(tasks).forEach(task => {
        allSessions.push(...task.sessions);
      });
      
      const grouped = analytics.groupSessionsByTask(allSessions);
      
      expect(grouped.work.totalTime).toBe(90 * 60 * 1000); // 1.5 hours
      expect(grouped.work.sessions).toHaveLength(2);
      expect(grouped.coding.totalTime).toBe(90 * 60 * 1000);
      expect(grouped.coding.sessions).toHaveLength(1);
    });
  });
});