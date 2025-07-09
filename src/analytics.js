const storage = require('./storage');
const { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
  isWithinInterval,
  isSameDay
} = require('date-fns');

// Utility function to filter sessions by date range
function filterSessionsByDateRange(sessions, startDate, endDate) {
  if (!sessions || !Array.isArray(sessions)) return [];
  
  return sessions.filter(session => {
    const sessionDate = new Date(session.startTime);
    return isWithinInterval(sessionDate, { start: startDate, end: endDate });
  });
}

// Utility function to group sessions by task
function groupSessionsByTask(sessions) {
  const grouped = {};
  
  sessions.forEach(session => {
    if (!grouped[session.task]) {
      grouped[session.task] = {
        name: session.task,
        totalTime: 0,
        sessions: []
      };
    }
    
    grouped[session.task].totalTime += session.duration;
    grouped[session.task].sessions.push(session);
  });
  
  return grouped;
}

// Get daily analytics for a specific date (defaults to today)
async function getDailyAnalytics(targetDate = new Date()) {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  
  const tasks = await storage.loadTasks();
  const allSessions = [];
  
  // Collect all sessions from all tasks
  Object.values(tasks).forEach(task => {
    if (task.sessions) {
      allSessions.push(...task.sessions);
    }
  });
  
  // Filter sessions for the target date
  const daySessions = filterSessionsByDateRange(allSessions, dayStart, dayEnd);
  const groupedByTask = groupSessionsByTask(daySessions);
  
  const totalTime = Object.values(groupedByTask).reduce((sum, task) => sum + task.totalTime, 0);
  const taskArray = Object.values(groupedByTask).sort((a, b) => b.totalTime - a.totalTime);
  
  return {
    period: isSameDay(targetDate, new Date()) ? 'today' : format(targetDate, 'yyyy-MM-dd'),
    startDate: dayStart,
    endDate: dayEnd,
    totalTime,
    tasks: taskArray
  };
}

// Get weekly analytics for a specific week (defaults to current week)
async function getWeeklyAnalytics(targetDate = new Date()) {
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  
  const tasks = await storage.loadTasks();
  const allSessions = [];
  
  Object.values(tasks).forEach(task => {
    if (task.sessions) {
      allSessions.push(...task.sessions);
    }
  });
  
  const weekSessions = filterSessionsByDateRange(allSessions, weekStart, weekEnd);
  const groupedByTask = groupSessionsByTask(weekSessions);
  
  const totalTime = Object.values(groupedByTask).reduce((sum, task) => sum + task.totalTime, 0);
  const taskArray = Object.values(groupedByTask).sort((a, b) => b.totalTime - a.totalTime);
  
  // Create daily breakdown
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dailyBreakdown = daysInWeek.map(day => {
    const daySessions = filterSessionsByDateRange(weekSessions, startOfDay(day), endOfDay(day));
    const dayTotal = daySessions.reduce((sum, session) => sum + session.duration, 0);
    
    return {
      date: day,
      totalTime: dayTotal,
      tasks: groupSessionsByTask(daySessions)
    };
  });
  
  return {
    period: isWithinInterval(new Date(), { start: weekStart, end: weekEnd }) ? 'this week' : `week of ${format(weekStart, 'MMM d, yyyy')}`,
    startDate: weekStart,
    endDate: weekEnd,
    totalTime,
    tasks: taskArray,
    dailyBreakdown
  };
}

// Get monthly analytics for a specific month (defaults to current month)
async function getMonthlyAnalytics(targetDate = new Date()) {
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  
  const tasks = await storage.loadTasks();
  const allSessions = [];
  
  Object.values(tasks).forEach(task => {
    if (task.sessions) {
      allSessions.push(...task.sessions);
    }
  });
  
  const monthSessions = filterSessionsByDateRange(allSessions, monthStart, monthEnd);
  const groupedByTask = groupSessionsByTask(monthSessions);
  
  const totalTime = Object.values(groupedByTask).reduce((sum, task) => sum + task.totalTime, 0);
  const taskArray = Object.values(groupedByTask).sort((a, b) => b.totalTime - a.totalTime);
  
  // Create weekly breakdown
  const weeksInMonth = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
  const weeklyBreakdown = weeksInMonth.map(weekStart => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekSessions = filterSessionsByDateRange(monthSessions, weekStart, weekEnd);
    const weekTotal = weekSessions.reduce((sum, session) => sum + session.duration, 0);
    
    return {
      weekStart,
      weekEnd,
      totalTime: weekTotal,
      tasks: groupSessionsByTask(weekSessions)
    };
  });
  
  return {
    period: isWithinInterval(new Date(), { start: monthStart, end: monthEnd }) ? 'this month' : format(monthStart, 'yyyy-MM'),
    startDate: monthStart,
    endDate: monthEnd,
    totalTime,
    tasks: taskArray,
    weeklyBreakdown
  };
}

// Get yearly analytics for a specific year (defaults to current year)
async function getYearlyAnalytics(targetDate = new Date()) {
  const yearStart = startOfYear(targetDate);
  const yearEnd = endOfYear(targetDate);
  
  const tasks = await storage.loadTasks();
  const allSessions = [];
  
  Object.values(tasks).forEach(task => {
    if (task.sessions) {
      allSessions.push(...task.sessions);
    }
  });
  
  const yearSessions = filterSessionsByDateRange(allSessions, yearStart, yearEnd);
  const groupedByTask = groupSessionsByTask(yearSessions);
  
  const totalTime = Object.values(groupedByTask).reduce((sum, task) => sum + task.totalTime, 0);
  const taskArray = Object.values(groupedByTask).sort((a, b) => b.totalTime - a.totalTime);
  
  // Create monthly breakdown
  const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });
  const monthlyBreakdown = monthsInYear.map(monthStart => {
    const monthEnd = endOfMonth(monthStart);
    const monthSessions = filterSessionsByDateRange(yearSessions, monthStart, monthEnd);
    const monthTotal = monthSessions.reduce((sum, session) => sum + session.duration, 0);
    
    return {
      month: monthStart,
      totalTime: monthTotal,
      tasks: groupSessionsByTask(monthSessions)
    };
  });
  
  return {
    period: isWithinInterval(new Date(), { start: yearStart, end: yearEnd }) ? 'this year' : format(yearStart, 'yyyy'),
    startDate: yearStart,
    endDate: yearEnd,
    totalTime,
    tasks: taskArray,
    monthlyBreakdown
  };
}

// Get task summary with rankings and percentages
async function getTaskSummary() {
  const tasks = await storage.loadTasks();
  const taskArray = Object.values(tasks);
  
  if (taskArray.length === 0) {
    return {
      tasks: [],
      totalTimeAllTasks: 0
    };
  }
  
  const totalTimeAllTasks = taskArray.reduce((sum, task) => sum + (task.totalTime || 0), 0);
  
  const tasksWithPercentage = taskArray
    .map(task => ({
      name: task.name,
      totalTime: task.totalTime || 0,
      percentage: totalTimeAllTasks > 0 ? Math.round((task.totalTime / totalTimeAllTasks) * 100) : 0,
      sessionCount: task.sessions ? task.sessions.length : 0
    }))
    .sort((a, b) => b.totalTime - a.totalTime);
  
  return {
    tasks: tasksWithPercentage,
    totalTimeAllTasks
  };
}

module.exports = {
  getDailyAnalytics,
  getWeeklyAnalytics,
  getMonthlyAnalytics,
  getYearlyAnalytics,
  getTaskSummary,
  filterSessionsByDateRange,
  groupSessionsByTask
};