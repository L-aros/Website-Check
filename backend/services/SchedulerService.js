const cron = require('node-cron');
const { PageMonitor } = require('../models');
const monitorService = require('./MonitorService');

// Store running tasks in memory
const tasks = new Map();

class SchedulerService {
  constructor() {
    this.queue = [];
    this.runningMonitorIds = new Set();
    this.activeCount = 0;
    const raw = Number(process.env.MAX_CONCURRENT_CHECKS);
    this.maxConcurrent = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;
  }

  enqueueCheck(monitorId, runner) {
    if (this.runningMonitorIds.has(monitorId)) return;
    this.queue.push({ monitorId, runner });
    this.drainQueue();
  }

  drainQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      if (this.runningMonitorIds.has(job.monitorId)) continue;

      this.runningMonitorIds.add(job.monitorId);
      this.activeCount += 1;

      Promise.resolve()
        .then(job.runner)
        .catch((e) => {
          console.error(`Monitor ${job.monitorId} check failed:`, e);
        })
        .finally(() => {
          this.runningMonitorIds.delete(job.monitorId);
          this.activeCount -= 1;
          this.drainQueue();
        });
    }
  }

  async init() {
    console.log('Initializing Scheduler...');
    const monitors = await PageMonitor.findAll({ where: { status: 'active' } });
    
    // Clear existing tasks
    this.stopAll();

    for (const monitor of monitors) {
      this.scheduleTask(monitor);
    }
    console.log(`Scheduled ${tasks.size} tasks.`);
  }

  scheduleTask(monitor) {
    if (tasks.has(monitor.id)) {
      tasks.get(monitor.id).stop();
      tasks.delete(monitor.id);
    }

    if (monitor.status !== 'active') return;

    // Validate cron expression, fallback to default if invalid
    let frequency = monitor.frequency;
    if (!cron.validate(frequency)) {
      console.warn(`Invalid cron expression for monitor ${monitor.id}: ${frequency}. Using default.`);
      frequency = '*/30 * * * *';
    }

    const task = cron.schedule(frequency, () => {
      console.log(`Running scheduled check for monitor ${monitor.id}`);
      this.enqueueCheck(monitor.id, async () => {
        const fresh = await PageMonitor.findByPk(monitor.id);
        if (!fresh || fresh.status !== 'active') return;
        await monitorService.checkMonitor(fresh);
      });
    });

    tasks.set(monitor.id, task);
  }

  stopTask(monitorId) {
    if (tasks.has(monitorId)) {
      tasks.get(monitorId).stop();
      tasks.delete(monitorId);
    }
  }

  stopAll() {
    for (const task of tasks.values()) {
      task.stop();
    }
    tasks.clear();
  }
  
  // Method to refresh a specific monitor's schedule (e.g., after update)
  async refreshMonitor(monitorId) {
      const monitor = await PageMonitor.findByPk(monitorId);
      if (monitor) {
          this.scheduleTask(monitor);
      } else {
          this.stopTask(monitorId);
      }
  }

  async runNow(monitorId) {
    const monitor = await PageMonitor.findByPk(monitorId);
    if (!monitor || monitor.status !== 'active') return;
    this.enqueueCheck(monitorId, async () => {
      const fresh = await PageMonitor.findByPk(monitorId);
      if (!fresh || fresh.status !== 'active') return;
      await monitorService.checkMonitor(fresh);
    });
  }
}

module.exports = new SchedulerService();
