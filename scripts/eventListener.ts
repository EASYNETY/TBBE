import { propertySyncService } from '../src/services/propertySyncService';

async function startEventListener(): Promise<void> {
  console.log('Starting blockchain event listener...');

  try {
    // Initial sync to catch up on missed events
    console.log('Performing initial event sync...');
    await propertySyncService.syncEvents();

    // Set up periodic sync (every 30 seconds)
    setInterval(async () => {
      try {
        await propertySyncService.syncEvents();
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }, 30000);

    console.log('Event listener started successfully');
  } catch (error) {
    console.error('Failed to start event listener:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down event listener...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down event listener...');
  process.exit(0);
});

// Start the listener
startEventListener().catch((error) => {
  console.error('Event listener startup failed:', error);
  process.exit(1);
});