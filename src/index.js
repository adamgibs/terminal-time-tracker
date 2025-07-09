#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer').default || require('inquirer');
const { version } = require('../package.json');
const taskManager = require('./taskManager');
const timeTracker = require('./timeTracker');
const analytics = require('./analytics');
const goals = require('./goals');

// Utility function to format time in milliseconds to human readable format
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Display functions for analytics
function displayDailyAnalytics(result) {
  console.log(chalk.blue(`\n📊 Daily Analytics (${result.period})`));
  console.log(chalk.cyan(`Total time: ${formatTime(result.totalTime)}`));
  
  if (result.tasks.length === 0) {
    console.log(chalk.gray('No time tracked for this day.'));
    return;
  }
  
  console.log(chalk.blue('\nTasks:'));
  result.tasks.forEach((task, index) => {
    const timeFormatted = formatTime(task.totalTime);
    console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)}`);
  });
}

function displayWeeklyAnalytics(result) {
  console.log(chalk.blue(`\n📈 Weekly Analytics (${result.period})`));
  console.log(chalk.cyan(`Total time: ${formatTime(result.totalTime)}`));
  
  if (result.tasks.length === 0) {
    console.log(chalk.gray('No time tracked for this week.'));
    return;
  }
  
  console.log(chalk.blue('\nTop Tasks:'));
  result.tasks.slice(0, 5).forEach((task, index) => {
    const timeFormatted = formatTime(task.totalTime);
    console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)}`);
  });
  
  console.log(chalk.blue('\nDaily Breakdown:'));
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  result.dailyBreakdown.forEach((day, index) => {
    const timeFormatted = formatTime(day.totalTime);
    const dayName = dayNames[index];
    console.log(`${dayName}: ${chalk.cyan(timeFormatted)}`);
  });
}

function displayMonthlyAnalytics(result) {
  console.log(chalk.blue(`\n📅 Monthly Analytics (${result.period})`));
  console.log(chalk.cyan(`Total time: ${formatTime(result.totalTime)}`));
  
  if (result.tasks.length === 0) {
    console.log(chalk.gray('No time tracked for this month.'));
    return;
  }
  
  console.log(chalk.blue('\nTop Tasks:'));
  result.tasks.slice(0, 5).forEach((task, index) => {
    const timeFormatted = formatTime(task.totalTime);
    console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)}`);
  });
  
  if (result.weeklyBreakdown && result.weeklyBreakdown.length > 0) {
    console.log(chalk.blue('\nWeekly Summary:'));
    result.weeklyBreakdown.forEach((week, index) => {
      const timeFormatted = formatTime(week.totalTime);
      console.log(`Week ${index + 1}: ${chalk.cyan(timeFormatted)}`);
    });
  }
}

function displayYearlyAnalytics(result) {
  console.log(chalk.blue(`\n🗓️  Yearly Analytics (${result.period})`));
  console.log(chalk.cyan(`Total time: ${formatTime(result.totalTime)}`));
  
  if (result.tasks.length === 0) {
    console.log(chalk.gray('No time tracked for this year.'));
    return;
  }
  
  console.log(chalk.blue('\nTop Tasks:'));
  result.tasks.slice(0, 5).forEach((task, index) => {
    const timeFormatted = formatTime(task.totalTime);
    console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)}`);
  });
  
  console.log(chalk.blue('\nMonthly Summary:'));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  result.monthlyBreakdown.forEach((month, index) => {
    const timeFormatted = formatTime(month.totalTime);
    const monthName = monthNames[index];
    if (month.totalTime > 0) {
      console.log(`${monthName}: ${chalk.cyan(timeFormatted)}`);
    }
  });
}

function displayTaskSummary(result) {
  console.log(chalk.blue('\n🏆 Task Summary & Rankings'));
  console.log(chalk.cyan(`Total time across all tasks: ${formatTime(result.totalTimeAllTasks)}`));
  
  if (result.tasks.length === 0) {
    console.log(chalk.gray('No tasks found.'));
    return;
  }
  
  console.log(chalk.blue('\nTask Rankings:'));
  result.tasks.forEach((task, index) => {
    const timeFormatted = formatTime(task.totalTime);
    const percentage = task.percentage;
    const sessions = task.sessionCount;
    console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)} (${chalk.yellow(percentage + '%')}) - ${sessions} sessions`);
  });
}

// Parse duration string like "2h", "30m", "1h30m" into milliseconds
function parseDuration(durationStr) {
  const pattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = durationStr.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return null;
  }
  
  return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
}

// Display functions for goals
function displayGoalsOverview(overview) {
  console.log(chalk.blue('\n🎯 Goals Overview'));
  
  if (overview.length === 0) {
    console.log(chalk.gray('No goals set. Use --set to create goals for your tasks.'));
    return;
  }
  
  overview.forEach(taskStatus => {
    console.log(chalk.green(`\n📋 ${taskStatus.taskName}`));
    
    taskStatus.goals.forEach(goal => {
      const { period, progress } = goal;
      const goalTime = formatTime(goal.goalTime);
      const actualTime = formatTime(progress.actualTime);
      const percentage = progress.percentage;
      
      let statusIcon = progress.isAchieved ? '✅' : '⏳';
      let statusColor = progress.isAchieved ? chalk.green : chalk.yellow;
      
      console.log(`  ${statusIcon} ${period}: ${statusColor(actualTime)} / ${goalTime} (${percentage}%)`);
      
      if (progress.isAchieved && progress.overTime > 0) {
        console.log(`    ${chalk.cyan(`+${formatTime(progress.overTime)} over goal`)}`);
      } else if (progress.remainingTime > 0) {
        console.log(`    ${chalk.gray(`${formatTime(progress.remainingTime)} remaining`)}`);
      }
    });
  });
}

function displayTaskGoalStatus(taskStatus) {
  console.log(chalk.blue(`\n🎯 Goals for ${chalk.green(taskStatus.taskName)}`));
  
  if (taskStatus.goals.length === 0) {
    console.log(chalk.gray('No goals set for this task.'));
    return;
  }
  
  taskStatus.goals.forEach(goal => {
    const { period, progress } = goal;
    const goalTime = formatTime(goal.goalTime);
    const actualTime = formatTime(progress.actualTime);
    const percentage = progress.percentage;
    
    console.log(chalk.blue(`\n${period.toUpperCase()} GOAL:`));
    console.log(`  Target: ${chalk.cyan(goalTime)}`);
    console.log(`  Actual: ${chalk.cyan(actualTime)}`);
    console.log(`  Progress: ${percentage >= 100 ? chalk.green(`${percentage}%`) : chalk.yellow(`${percentage}%`)}`);
    
    if (progress.isAchieved) {
      console.log(chalk.green('  ✅ Goal achieved!'));
      if (progress.overTime > 0) {
        console.log(`  ${chalk.cyan(`+${formatTime(progress.overTime)} over goal`)}`);
      }
    } else {
      console.log(`  ⏳ ${chalk.gray(`${formatTime(progress.remainingTime)} remaining`)}`);
    }
  });
}

function displayTasksWithGoals(tasks) {
  console.log(chalk.blue('\n📋 Tasks with Goals'));
  
  if (tasks.length === 0) {
    console.log(chalk.gray('No tasks have goals set.'));
    return;
  }
  
  tasks.forEach((task, index) => {
    const timeFormatted = formatTime(task.totalTime);
    console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)}`);
  });
}

const program = new Command();

program
  .name('tt')
  .description('Terminal Time Tracker - A lightweight time tracking CLI')
  .version(version);

program
  .command('start [task]')
  .description('Start tracking time for a task (shows task selection if no task specified)')
  .action(async (task) => {
    try {
      let selectedTask = task;
      
      // If no task specified, show task selection
      if (!selectedTask) {
        const choices = await taskManager.getTaskChoices();
        
        if (choices.length === 0) {
          console.log(chalk.yellow('No tasks found. Create a task first with: tt create <task-name>'));
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          return;
        }
        
        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'task',
          message: 'Select a task to start tracking:',
          choices: choices
        }]);
        
        selectedTask = answer.task;
      }
      
      // Check if task exists, create if it doesn't (for when task is specified directly)
      let existingTask = await taskManager.getTask(selectedTask);
      if (!existingTask) {
        const createResult = await taskManager.createTask(selectedTask);
        if (!createResult.success) {
          console.log(chalk.red(`Error: ${createResult.error}`));
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          return;
        }
        console.log(chalk.blue(`Created new task: ${selectedTask}`));
      }
      
      const result = await timeTracker.startTracking(selectedTask);
      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  });

program
  .command('stop')
  .description('Stop current time tracking')
  .action(async () => {
    try {
      const result = await timeTracker.stopTracking();
      if (result.success) {
        const timeFormatted = formatTime(result.duration);
        console.log(chalk.green(result.message));
        console.log(chalk.cyan(`Session duration: ${timeFormatted}`));
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('pause')
  .description('Pause current time tracking')
  .action(async () => {
    try {
      const result = await timeTracker.pauseTracking();
      if (result.success) {
        console.log(chalk.yellow(result.message));
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('resume')
  .description('Resume paused time tracking')
  .action(async () => {
    try {
      const result = await timeTracker.resumeTracking();
      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('status')
  .description('Show current tracking status')
  .action(async () => {
    try {
      const status = await timeTracker.getStatus();
      
      if (!status.isTracking) {
        console.log(chalk.blue('Current status: ') + chalk.gray('Not tracking'));
        return;
      }
      
      const timeFormatted = formatTime(status.elapsedTime);
      console.log(chalk.blue('Current status:'));
      console.log(`  Task: ${chalk.green(status.currentTask)}`);
      console.log(`  Elapsed time: ${chalk.cyan(timeFormatted)}`);
      console.log(`  Status: ${status.isPaused ? chalk.yellow('Paused') : chalk.green('Active')}`);
      console.log(`  Started: ${chalk.gray(status.startTime.toLocaleString())}`);
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('list')
  .description('List all tasks')
  .action(async () => {
    try {
      const tasks = await taskManager.listTasks();
      
      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found. Create a task by running: tt start <task-name>'));
        return;
      }
      
      console.log(chalk.blue('\nTasks:'));
      tasks.forEach((task, index) => {
        const timeFormatted = formatTime(task.totalTime);
        const created = new Date(task.created).toLocaleDateString();
        console.log(`${index + 1}. ${chalk.green(task.name)} - ${chalk.cyan(timeFormatted)} (created: ${created})`);
      });
      console.log('');
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('delete <task>')
  .description('Delete a task')
  .action(async (task) => {
    try {
      const result = await taskManager.deleteTask(task);
      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('create <task>')
  .description('Create a new task without starting timer')
  .action(async (task) => {
    try {
      const result = await taskManager.createTask(task);
      if (result.success) {
        console.log(chalk.green(`Created task: ${task}`));
      } else {
        console.log(chalk.red(`Error: ${result.error}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  });

program
  .command('analytics')
  .description('View time analytics')
  .option('-d, --daily [date]', 'Show daily analytics (optionally for specific date)')
  .option('-w, --weekly [date]', 'Show weekly analytics (optionally for specific week)')
  .option('-m, --monthly [date]', 'Show monthly analytics (optionally for specific month)')
  .option('-y, --yearly [date]', 'Show yearly analytics (optionally for specific year)')
  .option('-s, --summary', 'Show task summary with rankings')
  .action(async (options) => {
    try {
      if (options.daily !== undefined) {
        const targetDate = options.daily && options.daily !== true ? new Date(options.daily) : new Date();
        const result = await analytics.getDailyAnalytics(targetDate);
        displayDailyAnalytics(result);
      } else if (options.weekly !== undefined) {
        const targetDate = options.weekly && options.weekly !== true ? new Date(options.weekly) : new Date();
        const result = await analytics.getWeeklyAnalytics(targetDate);
        displayWeeklyAnalytics(result);
      } else if (options.monthly !== undefined) {
        const targetDate = options.monthly && options.monthly !== true ? new Date(options.monthly) : new Date();
        const result = await analytics.getMonthlyAnalytics(targetDate);
        displayMonthlyAnalytics(result);
      } else if (options.yearly !== undefined) {
        const targetDate = options.yearly && options.yearly !== true ? new Date(options.yearly) : new Date();
        const result = await analytics.getYearlyAnalytics(targetDate);
        displayYearlyAnalytics(result);
      } else if (options.summary) {
        const result = await analytics.getTaskSummary();
        displayTaskSummary(result);
      } else {
        // Default: show today's analytics
        const result = await analytics.getDailyAnalytics();
        displayDailyAnalytics(result);
        console.log(chalk.gray('\nUse --help to see other analytics options (--weekly, --monthly, --yearly, --summary)'));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('goals')
  .description('Manage time goals')
  .option('--set <task>', 'Set goal for a task')
  .option('--period <period>', 'Goal period: daily, weekly, monthly, yearly', 'daily')
  .option('--time <duration>', 'Goal duration (e.g., "2h", "30m", "1h30m")')
  .option('--remove <task>', 'Remove goals for a task')
  .option('--remove-period <period>', 'Specific period to remove (daily, weekly, monthly, yearly)')
  .option('--status [task]', 'Show goal status for a task (or all tasks)')
  .option('--list', 'List all tasks with goals')
  .action(async (options) => {
    try {
      if (options.set && options.time) {
        const duration = parseDuration(options.time);
        if (!duration) {
          console.log(chalk.red('Invalid duration format. Use format like "2h", "30m", "1h30m"'));
          return;
        }
        
        const result = await goals.setGoal(options.set, options.period, duration);
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.log(chalk.red(`Error: ${result.error}`));
        }
      } else if (options.remove) {
        const result = await goals.removeGoal(options.remove, options.removePeriod);
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.log(chalk.red(`Error: ${result.error}`));
        }
      } else if (options.status !== undefined) {
        if (options.status === true) {
          // Show all tasks with goals
          const overview = await goals.getAllGoalsOverview();
          displayGoalsOverview(overview);
        } else {
          // Show specific task
          const status = await goals.getTaskGoalStatus(options.status);
          displayTaskGoalStatus(status);
        }
      } else if (options.list) {
        const tasksWithGoals = await goals.getTasksWithGoals();
        displayTasksWithGoals(tasksWithGoals);
      } else {
        // Default: show all goals status
        const overview = await goals.getAllGoalsOverview();
        displayGoalsOverview(overview);
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

program
  .command('export')
  .description('Export data')
  .action(() => {
    console.log(chalk.blue('Exporting data:'));
    // TODO: Implement export functionality
  });

program.parse(process.argv);