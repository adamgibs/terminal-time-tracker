const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.tt-data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const TRACKING_FILE = path.join(DATA_DIR, 'tracking.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function loadTasks() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    if (data.trim() === '') {
      return {};
    }
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    // Handle corrupted JSON files
    if (error instanceof SyntaxError) {
      return {};
    }
    throw error;
  }
}

async function saveTasks(tasks) {
  await ensureDataDir();
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

async function loadTracking() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(TRACKING_FILE, 'utf8');
    if (data.trim() === '') {
      return {
        currentTask: null,
        startTime: null,
        pausedTime: null,
        isPaused: false,
        sessions: []
      };
    }
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        currentTask: null,
        startTime: null,
        pausedTime: null,
        isPaused: false,
        sessions: []
      };
    }
    // Handle corrupted JSON files
    if (error instanceof SyntaxError) {
      return {
        currentTask: null,
        startTime: null,
        pausedTime: null,
        isPaused: false,
        sessions: []
      };
    }
    throw error;
  }
}

async function saveTracking(tracking) {
  await ensureDataDir();
  await fs.writeFile(TRACKING_FILE, JSON.stringify(tracking, null, 2));
}

module.exports = {
  loadTasks,
  saveTasks,
  loadTracking,
  saveTracking
};