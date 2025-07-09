const storage = require('./storage');
const taskManager = require('./taskManager');

async function startTracking(taskId) {
  // Check if task exists
  const task = await taskManager.getTask(taskId);
  if (!task) {
    return {
      success: false,
      error: `Task "${taskId}" does not exist`
    };
  }

  // Check if already tracking
  const tracking = await storage.loadTracking();
  if (tracking.currentTask) {
    return {
      success: false,
      error: `Already tracking "${tracking.currentTask}". Stop current tracking first.`
    };
  }

  // Start tracking
  const startTime = new Date();
  const newTracking = {
    currentTask: taskId,
    startTime: startTime.toISOString(),
    pausedTime: null,
    isPaused: false,
    sessions: tracking.sessions || []
  };

  await storage.saveTracking(newTracking);

  return {
    success: true,
    message: `Started tracking "${taskId}"`,
    startTime: startTime
  };
}

async function stopTracking() {
  const tracking = await storage.loadTracking();
  
  if (!tracking.currentTask) {
    return {
      success: false,
      error: 'No active tracking session'
    };
  }

  const endTime = new Date();
  const startTime = new Date(tracking.startTime);
  
  // Calculate duration, accounting for paused time
  let duration = endTime.getTime() - startTime.getTime();
  if (tracking.pausedTime) {
    const pausedStart = new Date(tracking.pausedTime);
    duration -= (endTime.getTime() - pausedStart.getTime());
  }

  // Create session record
  const session = {
    task: tracking.currentTask,
    startTime: startTime,
    endTime: endTime,
    duration: duration
  };

  // Update task with session and total time
  const task = await taskManager.getTask(tracking.currentTask);
  if (task) {
    task.sessions = task.sessions || [];
    task.sessions.push({
      task: tracking.currentTask,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: duration
    });
    task.totalTime = (task.totalTime || 0) + duration;
    
    // Save updated task
    const tasks = await storage.loadTasks();
    tasks[tracking.currentTask] = task;
    await storage.saveTasks(tasks);
  }

  // Clear tracking state
  const clearedTracking = {
    currentTask: null,
    startTime: null,
    pausedTime: null,
    isPaused: false,
    sessions: tracking.sessions
  };
  await storage.saveTracking(clearedTracking);

  return {
    success: true,
    message: `Stopped tracking "${tracking.currentTask}"`,
    duration: duration,
    session: session
  };
}

async function pauseTracking() {
  const tracking = await storage.loadTracking();
  
  if (!tracking.currentTask) {
    return {
      success: false,
      error: 'No active tracking session to pause'
    };
  }

  if (tracking.isPaused) {
    return {
      success: false,
      error: 'Tracking is already paused'
    };
  }

  // Pause tracking
  const pausedTracking = {
    ...tracking,
    pausedTime: new Date().toISOString(),
    isPaused: true
  };

  await storage.saveTracking(pausedTracking);

  return {
    success: true,
    message: `Paused tracking "${tracking.currentTask}"`
  };
}

async function resumeTracking() {
  const tracking = await storage.loadTracking();
  
  if (!tracking.currentTask) {
    return {
      success: false,
      error: 'No active tracking session'
    };
  }

  if (!tracking.isPaused) {
    return {
      success: false,
      error: 'No paused session to resume'
    };
  }

  // Calculate paused duration and adjust start time
  const pausedStart = new Date(tracking.pausedTime);
  const resumeTime = new Date();
  const pausedDuration = resumeTime.getTime() - pausedStart.getTime();
  
  // Adjust start time to account for paused duration
  const originalStart = new Date(tracking.startTime);
  const adjustedStart = new Date(originalStart.getTime() + pausedDuration);

  const resumedTracking = {
    ...tracking,
    startTime: adjustedStart.toISOString(),
    pausedTime: null,
    isPaused: false
  };

  await storage.saveTracking(resumedTracking);

  return {
    success: true,
    message: `Resumed tracking "${tracking.currentTask}"`
  };
}

async function getStatus() {
  const tracking = await storage.loadTracking();
  
  if (!tracking.currentTask) {
    return {
      isTracking: false,
      currentTask: null,
      startTime: null,
      isPaused: false,
      elapsedTime: 0
    };
  }

  const startTime = new Date(tracking.startTime);
  const currentTime = new Date();
  
  let elapsedTime;
  if (tracking.isPaused) {
    // If paused, calculate time up to pause point
    const pausedStart = new Date(tracking.pausedTime);
    elapsedTime = pausedStart.getTime() - startTime.getTime();
  } else {
    // If active, calculate current elapsed time
    elapsedTime = currentTime.getTime() - startTime.getTime();
  }

  return {
    isTracking: true,
    currentTask: tracking.currentTask,
    startTime: startTime,
    isPaused: tracking.isPaused,
    elapsedTime: Math.max(0, elapsedTime)
  };
}

module.exports = {
  startTracking,
  stopTracking,
  pauseTracking,
  resumeTracking,
  getStatus
};