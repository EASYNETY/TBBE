export declare class EventListenerService {
    private isRunning;
    private intervalId?;
    constructor();
    startEventSync(): void;
    stopEventSync(): void;
    getStatus(): {
        isRunning: boolean;
    };
    triggerSync(): Promise<void>;
}
export declare const eventListenerService: EventListenerService;
//# sourceMappingURL=eventListener.d.ts.map