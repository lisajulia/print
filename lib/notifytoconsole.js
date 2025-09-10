/**
 * Console notification handler for print plugin
 * Logs print information to console instead of connecting to real print service
 */

module.exports = class ConsoleNotifier {
    
    constructor() {
        this.name = 'Console Print Notifier';
        console.log(`[PRINT PLUGIN] ${this.name} initialized`);
    }

    /**
     * Handle print request by logging to console
     * @param {Object} printRequest - The print request object
     */
    async notify(printRequest) {
        console.log('\n=== PRINT REQUEST ===');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`Queue: ${printRequest.queue || 'Default'}`);
        console.log(`Number of Copies: ${printRequest.numberOfCopies || 1}`);
        
        if (printRequest.document) {
            console.log(`Document Name: ${printRequest.document.fileName || 'Unnamed'}`);
            console.log(`Document Type: ${printRequest.document.mimeType || 'Unknown'}`);
            console.log(`Document Size: ${printRequest.document.content ? printRequest.document.content.length + ' bytes' : 'No content'}`);
        }

        if (printRequest.attachments && printRequest.attachments.length > 0) {
            console.log(`Attachments: ${printRequest.attachments.length}`);
            printRequest.attachments.forEach((attachment, index) => {
                console.log(`  ${index + 1}. ${attachment.fileName || 'Unnamed'} (${attachment.mimeType || 'Unknown type'})`);
            });
        }

        if (printRequest.metadata) {
            console.log('Metadata:');
            Object.entries(printRequest.metadata).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }

        console.log('Status: LOGGED TO CONSOLE');
        console.log('======================\n');

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            success: true,
            message: 'Print request logged to console',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle bulk print requests
     * @param {Array} printRequests - Array of print request objects
     */
    async notifyBulk(printRequests) {
        console.log(`\n=== BULK PRINT REQUEST (${printRequests.length} items) ===`);
        
        for (let i = 0; i < printRequests.length; i++) {
            console.log(`\n--- Item ${i + 1} of ${printRequests.length} ---`);
            await this.notify(printRequests[i]);
        }

        console.log('=== BULK PRINT COMPLETED ===\n');

        return {
            success: true,
            processed: printRequests.length,
            message: 'Bulk print requests logged to console'
        };
    }

    /**
     * Get queue status (mock implementation)
     * @param {String} queueId - Queue identifier
     */
    async getQueueStatus(queueId) {
        console.log(`\n[PRINT PLUGIN] Queue Status Request for: ${queueId}`);
        console.log(`Status: MOCK_AVAILABLE`);
        console.log(`Jobs in Queue: 0 (console mode)\n`);

        return {
            queueId,
            status: 'AVAILABLE',
            jobsInQueue: 0,
            lastActivity: new Date().toISOString(),
            mode: 'console'
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        console.log('[PRINT PLUGIN] Health check - Console notifier is ready');
        return {
            status: 'healthy',
            service: 'console-notifier',
            timestamp: new Date().toISOString()
        };
    }
};
