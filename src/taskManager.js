const storage = require('./storage');

function isValidTaskName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Task name can only contain letters, numbers, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(name);
}

async function createTask(taskName) {
  // Validate task name
  if (!taskName || taskName.trim() === '') {
    return {
      success: false,
      error: 'Task name cannot be empty'
    };
  }

  if (!isValidTaskName(taskName)) {
    return {
      success: false,
      error: 'Task name can only contain letters, numbers, hyphens, and underscores'
    };
  }

  // Check if task already exists
  const existingTasks = await storage.loadTasks();
  if (existingTasks[taskName]) {
    return {
      success: false,
      error: `Task "${taskName}" already exists`
    };
  }

  // Create new task
  const newTask = {
    id: taskName,
    name: taskName,
    created: new Date().toISOString(),
    totalTime: 0,
    sessions: []
  };

  // Save task
  existingTasks[taskName] = newTask;
  await storage.saveTasks(existingTasks);

  return {
    success: true,
    task: newTask
  };
}

async function listTasks() {
  const tasks = await storage.loadTasks();
  
  // Convert tasks object to array and sort by creation date
  const taskArray = Object.values(tasks);
  taskArray.sort((a, b) => new Date(a.created) - new Date(b.created));
  
  return taskArray;
}

async function getTask(taskId) {
  const tasks = await storage.loadTasks();
  return tasks[taskId] || null;
}

async function deleteTask(taskId) {
  const tasks = await storage.loadTasks();
  
  if (!tasks[taskId]) {
    return {
      success: false,
      error: `Task "${taskId}" does not exist`
    };
  }

  delete tasks[taskId];
  await storage.saveTasks(tasks);

  return {
    success: true,
    message: `Task "${taskId}" deleted successfully`
  };
}

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

async function getTaskChoices() {
  const tasks = await listTasks();
  
  if (tasks.length === 0) {
    return [];
  }
  
  // Format tasks for inquirer choices
  return tasks.map(task => {
    const timeFormatted = formatTime(task.totalTime);
    const created = new Date(task.created).toLocaleDateString();
    const displayName = `${task.name} - ${timeFormatted} (created: ${created})`;
    
    return {
      name: displayName,
      value: task.id
    };
  });
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  deleteTask,
  getTaskChoices,
  isValidTaskName
};