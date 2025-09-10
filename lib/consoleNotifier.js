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
     * Console alternative to api.post - logs request details instead of making HTTP call
     * @param {Object} api - The axios instance with base URL and headers
     * @param {string} endpoint - The API endpoint
     * @param {*} data - The request payload
     * @returns {Promise<Object>} Mock response similar to axios response
     */
    async postToConsole(api, endpoint, data) {
        const fullUrl = `${api.defaults.baseURL}${endpoint}`;
        
        console.log('\n=== CONSOLE POST REQUEST ===');
        console.log(`URL: ${fullUrl}`);
        console.log(`Method: POST`);
        console.log(`Headers:`, JSON.stringify(api.defaults.headers, null, 2));
        
        if (data) {
            if (Buffer.isBuffer(data)) {
                console.log(`Body: [Binary data - ${data.length} bytes]`);
            } else {
                console.log(`Body:`, JSON.stringify(data, null, 2));
            }
        }
        
        console.log('=============================\n');
        
        // Return mock response similar to axios
        const mockObjectKey = `mock-doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return {
            data: mockObjectKey,
            status: 200,
            statusText: 'OK (Console Mode)',
            headers: {},
            config: {}
        };
    }

    /**
     * Console alternative to api.put - logs request details instead of making HTTP call
     * @param {Object} api - The axios instance with base URL and headers
     * @param {string} endpoint - The API endpoint
     * @param {*} data - The request payload
     * @returns {Promise<Object>} Mock response similar to axios response
     */
    async putToConsole(api, endpoint, data) {
        const fullUrl = `${api.defaults.baseURL}${endpoint}`;
        
        console.log('\n=== CONSOLE PUT REQUEST ===');
        console.log(`URL: ${fullUrl}`);
        console.log(`Method: PUT`);
        console.log(`Headers:`, JSON.stringify(api.defaults.headers, null, 2));
        console.log(`Body:`, JSON.stringify(data, null, 2));
        console.log('============================\n');
        
        // Return mock response similar to axios
        return {
            data: { taskId: `mock-task-${Date.now()}`, status: 'queued' },
            status: 200,
            statusText: 'OK (Console Mode)',
            headers: {},
            config: {}
        };
    }

};
