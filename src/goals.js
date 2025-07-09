const storage = require('./storage');
const taskManager = require('./taskManager');
const analytics = require('./analytics');
const {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  isSameDay,
  isWithinInterval
} = require('date-fns');

const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

// Utility functions
function isValidGoalPeriod(period) {
  return VALID_PERIODS.includes(period);
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    if (remainingMinutes > 0 && remainingSeconds > 0) {
      return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    } else if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${hours}h 0m`;
    }
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Load goals from storage
async function loadGoals() {
  try {
    const tasks = await storage.loadTasks();
    const goals = {};
    
    Object.keys(tasks).forEach(taskId => {
      if (tasks[taskId].goals) {
        goals[taskId] = tasks[taskId].goals;
      }
    });
    
    return goals;
  } catch (error) {
    return {};
  }
}

// Save goals to storage
async function saveGoals(goals) {
  const tasks = await storage.loadTasks();
  
  // First, clear all existing goals
  Object.keys(tasks).forEach(taskId => {
    if (tasks[taskId].goals) {
      delete tasks[taskId].goals;
    }
  });
  
  // Then set the new goals
  Object.keys(goals).forEach(taskId => {
    if (tasks[taskId]) {
      tasks[taskId].goals = goals[taskId];
    }
  });
  
  await storage.saveTasks(tasks);
}

// Set a goal for a task
async function setGoal(taskId, period, duration) {
  // Validate inputs
  if (!isValidGoalPeriod(period)) {
    return {
      success: false,
      error: 'Invalid goal period. Use: daily, weekly, monthly, yearly'
    };
  }
  
  if (duration <= 0) {
    return {
      success: false,
      error: 'Goal duration must be positive'
    };
  }
  
  // Check if task exists
  const task = await taskManager.getTask(taskId);
  if (!task) {
    return {
      success: false,
      error: `Task "${taskId}" does not exist`
    };
  }
  
  // Load existing goals
  const goals = await loadGoals();
  if (!goals[taskId]) {
    goals[taskId] = {};
  }
  
  const isUpdate = goals[taskId][period] !== undefined;
  goals[taskId][period] = duration;
  
  await saveGoals(goals);
  
  return {
    success: true,
    message: `${period.charAt(0).toUpperCase() + period.slice(1)} goal ${isUpdate ? 'updated' : 'set'} for "${taskId}": ${formatDuration(duration)}`
  };
}

// Remove a goal for a task
async function removeGoal(taskId, period = null) {
  const goals = await loadGoals();
  
  if (period) {
    // Removing specific goal period
    if (!goals[taskId] || !goals[taskId][period]) {
      return {
        success: false,
        error: `No ${period} goal exists for "${taskId}"`
      };
    }
    
    delete goals[taskId][period];
    
    // If no goals left, remove the task from goals
    if (Object.keys(goals[taskId]).length === 0) {
      delete goals[taskId];
    }
    
    await saveGoals(goals);
    
    return {
      success: true,
      message: `${period.charAt(0).toUpperCase() + period.slice(1)} goal removed for "${taskId}"`
    };
  } else {
    // Remove all goals for the task
    if (!goals[taskId]) {
      return {
        success: false,
        error: `No goals exist for "${taskId}"`
      };
    }
    
    delete goals[taskId];
    await saveGoals(goals);
    
    return {
      success: true,
      message: `All goals removed for "${taskId}"`
    };
  }
}

// Get goals for a specific task
async function getTaskGoals(taskId) {
  const goals = await loadGoals();
  return goals[taskId] || {};
}

// Get time range for a period
function getTimeRangeForPeriod(period, targetDate = new Date()) {
  switch (period) {
    case 'daily':
      return {
        start: startOfDay(targetDate),
        end: endOfDay(targetDate)
      };
    case 'weekly':
      return {
        start: startOfWeek(targetDate, { weekStartsOn: 1 }),
        end: endOfWeek(targetDate, { weekStartsOn: 1 })
      };
    case 'monthly':
      return {
        start: startOfMonth(targetDate),
        end: endOfMonth(targetDate)
      };
    case 'yearly':
      return {
        start: startOfYear(targetDate),
        end: endOfYear(targetDate)
      };
    default:
      throw new Error(`Invalid period: ${period}`);
  }
}

// Calculate actual time spent for a period
async function getActualTimeForPeriod(taskId, period, targetDate = new Date()) {
  const task = await taskManager.getTask(taskId);
  if (!task || !task.sessions) {
    return 0;
  }
  
  const { start, end } = getTimeRangeForPeriod(period, targetDate);
  
  return task.sessions
    .filter(session => {
      const sessionDate = new Date(session.startTime);
      return isWithinInterval(sessionDate, { start, end });
    })
    .reduce((total, session) => total + session.duration, 0);
}

// Get goal progress for a specific period
async function getGoalProgress(taskId, period, targetDate = new Date()) {
  const taskGoals = await getTaskGoals(taskId);
  const goalTime = taskGoals[period];
  
  if (!goalTime) {
    return null;
  }
  
  const actualTime = await getActualTimeForPeriod(taskId, period, targetDate);
  const percentage = Math.round((actualTime / goalTime) * 100);
  const isAchieved = actualTime >= goalTime;
  const remainingTime = Math.max(0, goalTime - actualTime);
  const overTime = actualTime > goalTime ? actualTime - goalTime : 0;
  
  return {
    period,
    goalTime,
    actualTime,
    percentage,
    isAchieved,
    remainingTime,
    overTime
  };
}

// Get goal status for all periods of a task
async function getTaskGoalStatus(taskId) {
  const taskGoals = await getTaskGoals(taskId);
  const periods = Object.keys(taskGoals);
  
  const goals = await Promise.all(
    periods.map(async (period) => {
      const progress = await getGoalProgress(taskId, period);
      return {
        period,
        goalTime: taskGoals[period],
        progress
      };
    })
  );
  
  return {
    taskName: taskId,
    goals
  };
}

// Get overview of all tasks with goals
async function getAllGoalsOverview() {
  const goals = await loadGoals();
  const taskIds = Object.keys(goals);
  
  return await Promise.all(
    taskIds.map(taskId => getTaskGoalStatus(taskId))
  );
}

// Get list of tasks that have goals
async function getTasksWithGoals() {
  const goals = await loadGoals();
  const taskIds = Object.keys(goals);
  
  const tasks = await Promise.all(
    taskIds.map(async (taskId) => {
      const task = await taskManager.getTask(taskId);
      return task;
    })
  );
  
  return tasks.filter(task => task !== null);
}

// Calculate goal streak (consecutive days/periods achieving the goal)
async function getGoalStreak(taskId, period) {
  const taskGoals = await getTaskGoals(taskId);
  const goalTime = taskGoals[period];
  
  if (!goalTime) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalAchieved: 0
    };
  }
  
  let currentStreak = 0;
  let longestStreak = 0;
  let totalAchieved = 0;
  let tempStreak = 0;
  
  // Check last 30 periods for streak calculation
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    let checkDate;
    
    switch (period) {
      case 'daily':
        checkDate = subDays(today, i);
        break;
      case 'weekly':
        checkDate = subDays(today, i * 7);
        break;
      case 'monthly':
        checkDate = new Date(today.getFullYear(), today.getMonth() - i, today.getDate());
        break;
      case 'yearly':
        checkDate = new Date(today.getFullYear() - i, today.getMonth(), today.getDate());
        break;
      default:
        checkDate = subDays(today, i);
    }
    
    const actualTime = await getActualTimeForPeriod(taskId, period, checkDate);
    const achieved = actualTime >= goalTime;
    
    if (achieved) {
      totalAchieved++;
      tempStreak++;
      if (i === 0) {
        currentStreak = tempStreak;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i === 0) {
        currentStreak = 0;
      }
      tempStreak = 0;
    }
  }
  
  return {
    currentStreak,
    longestStreak,
    totalAchieved
  };
}

module.exports = {
  setGoal,
  removeGoal,
  getTaskGoals,
  getGoalProgress,
  getTaskGoalStatus,
  getAllGoalsOverview,
  getTasksWithGoals,
  getGoalStreak,
  isValidGoalPeriod,
  formatDuration
};