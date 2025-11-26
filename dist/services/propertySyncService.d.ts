export interface SyncEvent {
    eventName: string;
    contractAddress: string;
    transactionHash: string;
    blockNumber: number;
    args: any;
    timestamp: Date;
}
export declare class PropertySyncService {
    private provider;
    private lastSyncedBlock;
    constructor();
    private initializeSyncState;
    syncEvents(): Promise<void>;
    private syncTitleRegistrarEvents;
    private syncTBAEvents;
    private syncMarketplaceEvents;
    private syncPropertyRegistryEvents;
    private parseTitleRegistrarLog;
    private parseTBALog;
    private parseMarketplaceLog;
    private parsePropertyRegistryLog;
    private processTitleRegistrarEvent;
    private processTBAEvent;
    private processMarketplaceEvent;
    private processPropertyRegistryEvent;
    private triggerMintingProcess;
    private triggerPostMintSteps;
    private emitUserNotification;
    private updateLastSyncedBlock;
    syncPropertyStatus(propertyId: string): Promise<void>;
}
export declare const propertySyncService: PropertySyncService;
//# sourceMappingURL=propertySyncService.d.ts.map