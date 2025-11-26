import { propertySyncService } from '../services/propertySyncService';

export class EventListenerService {
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.startEventSync();
  }

  startEventSync(): void {
    if (this.isRunning) {
      console.log('Event listener already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting blockchain event listener...');

    // Sync events every 30 seconds
    this.intervalId = setInterval(async () => {
      try {
        await propertySyncService.syncEvents();
      } catch (error) {
        console.error('Event sync failed:', error);
        // Continue running despite errors
      }
    }, 30000); // 30 seconds

    // Initial sync
    setTimeout(async () => {
      try {
        await propertySyncService.syncEvents();
      } catch (error) {
        console.error('Initial event sync failed:', error);
      }
    }, 5000); // Start after 5 seconds
  }

  stopEventSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('Event listener stopped');
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  // Manual trigger for testing
  async triggerSync(): Promise<void> {
    await propertySyncService.syncEvents();
  }
}

export const eventListenerService = new EventListenerService();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping event listener...');
  eventListenerService.stopEventSync();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping event listener...');
  eventListenerService.stopEventSync();
  process.exit(0);
});