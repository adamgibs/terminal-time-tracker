# Terminal Time Tracker

A lightweight, terminal-based time tracking application built with Node.js. Track time spent on multiple tasks, set goals, and analyze your productivity with comprehensive analytics.

## Features

### 🚀 Core Functionality
- **Task Management**: Create, list, delete, and manage multiple tasks
- **Separate Creation and Tracking**: Create tasks independently from starting timers
- **Interactive Task Selection**: Choose from existing tasks when starting without specifying one
- **Time Tracking**: Start, stop, pause, and resume time tracking
- **Session Recording**: Persistent storage of all work sessions
- **Real-time Status**: View current tracking status with elapsed time

### 📊 Advanced Analytics
- **Daily Analytics**: Today's time breakdown by task
- **Weekly Analytics**: Week overview with daily breakdown
- **Monthly Analytics**: Monthly summary with weekly breakdown
- **Yearly Analytics**: Annual overview with monthly breakdown
- **Task Rankings**: Task summary with percentages and session counts

### 🎯 Goals & Progress Tracking
- **Time Goals**: Set daily, weekly, monthly, and yearly time targets per task
- **Progress Tracking**: Visual progress indicators and percentage completion
- **Goal Achievement**: Track goal completion with overtime calculations
- **Flexible Periods**: Support for multiple goal periods simultaneously

### ✨ Key Benefits
- **No GUI Required**: Pure terminal interface for minimal overhead
- **Accurate Timing**: Handles pause/resume with precise time calculation
- **Comprehensive Reports**: Multiple time period views for productivity insights
- **Data Persistence**: All data stored locally in JSON format
- **Cross-platform**: Works on Linux, macOS, and Windows

## Installation

### Prerequisites
- Node.js 16.x or higher
- npm (comes with Node.js)

### Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd terminal-time-tracker

# Install dependencies
npm install

# Make the CLI globally accessible (optional)
npm link

# Or run directly with node
node src/index.js --help
```

## Usage

### Basic Commands

```bash
# Create a new task without starting timer
tt create my-project

# Start tracking a task (creates task if it doesn't exist)
tt start my-project

# Start with task selection (if no task specified)
tt start

# Check current status
tt status

# Pause current tracking
tt pause

# Resume paused tracking
tt resume

# Stop tracking and show session duration
tt stop

# List all tasks with total time
tt list

# Delete a task permanently
tt delete my-project
```

### Analytics Commands

```bash
# Show today's analytics (default)
tt analytics

# Weekly analytics with daily breakdown
tt analytics --weekly

# Monthly analytics with weekly summary
tt analytics --monthly

# Yearly analytics with monthly breakdown
tt analytics --yearly

# Task summary with rankings and percentages
tt analytics --summary

# Analytics for specific dates
tt analytics --daily 2023-12-25
tt analytics --weekly 2023-12-18
tt analytics --monthly 2023-12
tt analytics --yearly 2023
```

### Goals Commands

```bash
# Set time goals for tasks
tt goals --set my-project --time 2h --period daily
tt goals --set coding --time 40h --period weekly
tt goals --set work --time 160h --period monthly

# View goal progress (all tasks)
tt goals

# View goal progress for specific task
tt goals --status my-project

# Remove goals
tt goals --remove my-project --remove-period daily
tt goals --remove my-project  # Remove all goals for task

# List all tasks with goals
tt goals --list
```

### Example Output

```bash
$ tt create coding
Created task: coding

$ tt start
? Select a task to start tracking: (Use arrow keys)
❯ coding - 0s (created: 7/7/2025)
  project-a - 2h 30m (created: 7/6/2025) 
  meetings - 45m (created: 7/5/2025)

$ tt start coding
Started tracking "coding"

$ tt status
Current status:
  Task: coding
  Elapsed time: 2m 30s
  Status: Active
  Started: 7/3/2025, 3:21:28 PM

$ tt analytics --weekly
📈 Weekly Analytics (this week)
Total time: 12h 45m

Top Tasks:
1. coding - 8h 30m
2. meetings - 2h 15m
3. planning - 2h 0m

Daily Breakdown:
Mon: 2h 30m
Tue: 3h 15m
Wed: 4h 0m
Thu: 2h 45m
Fri: 0m
Sat: 0m
Sun: 15m

$ tt goals --set coding --time 8h --period daily
Daily goal set for task "coding": 8h

$ tt goals --status coding
🎯 Goals for coding

DAILY GOAL:
  Target: 8h
  Actual: 6h 30m
  Progress: 81%
  ⏳ 1h 30m remaining
```

## Data Storage

All data is stored locally in your home directory:
- **Location**: `~/.tt-data/`
- **Tasks**: `~/.tt-data/tasks.json`
- **Tracking State**: `~/.tt-data/tracking.json`
- **Goals**: `~/.tt-data/goals.json`

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Project Structure

```
terminal-time-tracker/
├── src/
│   ├── index.js          # CLI entry point and commands
│   ├── storage.js        # Data persistence layer
│   ├── taskManager.js    # Task management functionality
│   ├── timeTracker.js    # Time tracking core logic
│   ├── analytics.js      # Analytics and reporting
│   └── goals.js          # Goals and progress tracking
├── tests/
│   ├── storage.test.js
│   ├── taskManager.test.js
│   ├── timeTracker.test.js
│   ├── analytics.test.js
│   ├── goals.test.js
│   └── cli-delete.test.js
├── .taskmaster/          # TaskMaster project files
├── package.json
└── README.md
```

### Test Coverage

The project includes comprehensive test coverage with 85 tests:
- **Storage System**: 8 tests
- **Task Management**: 14 tests  
- **Time Tracking**: 20 tests
- **Analytics**: 17 tests
- **Goals System**: 22 tests
- **CLI Delete**: 4 tests

### Built With

- **Node.js**: Runtime environment
- **Commander.js**: CLI framework
- **Chalk**: Terminal colors
- **date-fns**: Date manipulation
- **Jest**: Testing framework

## Task Name Rules

Task names must follow these rules:
- Only letters, numbers, hyphens (-), and underscores (_)
- No spaces or special characters
- Examples: `my-project`, `work_task`, `coding123`

## Examples

### Daily Workflow

```bash
# Morning: Create and start working on a project
tt create frontend-dev
tt start frontend-dev

# Or use task selection
tt create backend-api
tt create documentation
tt start  # Shows selection menu

# Check progress
tt status
# Current status:
#   Task: frontend-dev
#   Elapsed time: 45m 12s
#   Status: Active

# Lunch break
tt pause

# After lunch
tt resume

# End of work
tt stop
# Stopped tracking "frontend-dev"
# Session duration: 6h 30m

# Weekly review
tt analytics --weekly
```

### Productivity Analysis

```bash
# See task rankings
tt analytics --summary
# 🏆 Task Summary & Rankings
# Total time across all tasks: 40h 15m
# 
# Task Rankings:
# 1. frontend-dev - 15h 30m (38%) - 12 sessions
# 2. backend-api - 12h 45m (32%) - 8 sessions
# 3. meetings - 8h 0m (20%) - 15 sessions
# 4. planning - 4h 0m (10%) - 6 sessions

# Set productivity goals
tt goals --set frontend-dev --time 40h --period weekly
tt goals --set backend-api --time 20h --period weekly

# Track goal progress
tt goals
# 🎯 Goals Overview
# 
# 📋 frontend-dev
#   ✅ weekly: 42h / 40h (105%)
#     +2h over goal
# 
# 📋 backend-api
#   ⏳ weekly: 12h 45m / 20h (64%)
#     7h 15m remaining

# Monthly productivity trends
tt analytics --monthly
```

## Troubleshooting

### Common Issues

1. **Command not found**: If `tt` command doesn't work, use `node src/index.js` instead
2. **Permission errors**: Ensure you have write access to your home directory
3. **Date parsing issues**: Use ISO format for dates (YYYY-MM-DD)

### Data Recovery

If data becomes corrupted, the application will:
- Show an error message for corrupted files
- Fall back to default empty state
- Preserve backup data when possible

### Getting Help

```bash
# General help
tt --help

# Command-specific help
tt analytics --help
tt start --help
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---
