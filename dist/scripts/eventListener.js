"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventListenerService = exports.EventListenerService = void 0;
const propertySyncService_1 = require("../services/propertySyncService");
class EventListenerService {
    constructor() {
        this.isRunning = false;
        this.startEventSync();
    }
    startEventSync() {
        if (this.isRunning) {
            console.log('Event listener already running');
            return;
        }
        this.isRunning = true;
        console.log('Starting blockchain event listener...');
        // Sync events every 30 seconds
        this.intervalId = setInterval(async () => {
            try {
                await propertySyncService_1.propertySyncService.syncEvents();
            }
            catch (error) {
                console.error('Event sync failed:', error);
                // Continue running despite errors
            }
        }, 30000); // 30 seconds
        // Initial sync
        setTimeout(async () => {
            try {
                await propertySyncService_1.propertySyncService.syncEvents();
            }
            catch (error) {
                console.error('Initial event sync failed:', error);
            }
        }, 5000); // Start after 5 seconds
    }
    stopEventSync() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.isRunning = false;
        console.log('Event listener stopped');
    }
    getStatus() {
        return { isRunning: this.isRunning };
    }
    // Manual trigger for testing
    async triggerSync() {
        await propertySyncService_1.propertySyncService.syncEvents();
    }
}
exports.EventListenerService = EventListenerService;
exports.eventListenerService = new EventListenerService();
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, stopping event listener...');
    exports.eventListenerService.stopEventSync();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, stopping event listener...');
    exports.eventListenerService.stopEventSync();
    process.exit(0);
});
//# sourceMappingURL=eventListener.js.map