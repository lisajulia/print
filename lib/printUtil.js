const { getJwt, readVcapServices } = require("./authUtil");
const { getPrintConfigFromActionOrEntity } = require('./annotation-helper');
const axios = require('axios');
const logger = cds.log("printservice");
const ConsoleNotifier = require('./notifytoconsole');

// Initialize console notifier for development/testing
const consoleNotifier = new ConsoleNotifier();

// Check if console mode is enabled (can be configured via environment variable)
const CONSOLE_MODE = process.env.PRINT_CONSOLE_MODE === 'true' || process.env.NODE_ENV === 'development';

/**
 * Populates the queue value help with available printers.
 * @param {Object} _ - Unused parameter.
 * @param {Object} req - The request object.
 */
const populateQueueValueHelp = async function (_, req) {
    logger.info('Populating print queue value help');

    // If in console mode, provide mock queue data
    if (CONSOLE_MODE) {
        logger.info('Console mode: Using mock print queues');
        const mockQueues = [
            { ID: 'console-printer-1', description: 'Console Printer 1' },
            { ID: 'console-printer-2', description: 'Console Printer 2' },
            { ID: 'default-console', description: 'Default Console Queue' }
        ];
        
        mockQueues.forEach((queue, index) => {
            req.results[index] = { ID: queue.ID };
        });
        req.results.$count = mockQueues.length;
        return;
    }

    const vcap = await readVcapServices();
    if (!vcap || vcap?.status === 500) {
        // For Production, return the error if print service is not found
        logger.error('Print service not found');
        return req.error(500, 'Print service not found');
    }
    const jwt = await getJwt(req, vcap);
    if (jwt?.code === 500) {
        logger.error('Failed to retrieve token');
        return req.error(500, 'Failed to retrieve token');
    }

    const api = axios.create({
        baseURL: vcap.service_url,
        headers: {
            'Authorization': `Bearer ${jwt}`,
            "Accept": "*/*",
            "Content-Type": "application/json"
        }
    });
    const resp = await api.get(`/qm/api/v1/rest/queues`);
    resp.data.forEach((item, index) => {
        req.results[index] = { ID: item.qname };
    });
    req.results.$count = resp.data.length;
}

/**
 * Handles the print request.
 * @param {Object} _ - Unused parameter.
 * @param {Object} req - The request object.
 */
const print = async function (_, req) {
    logger.info('Print request received');
    let { qname, numberOfCopies, docsToPrint } = await getPrintConfigFromActionOrEntity(req);
    
    // If in console mode, use console notifier instead of real print service
    if (CONSOLE_MODE) {
        logger.info('Console mode: Logging print request to console');
        
        // Prepare print request for console notifier
        const printRequest = {
            queue: qname || 'default-console',
            numberOfCopies: numberOfCopies || 1,
            metadata: {
                userId: cds.context?.user?.id || 'anonymous',
                timestamp: new Date().toISOString(),
                actionName: req.event
            }
        };

        // Add main document if available
        const mainDoc = docsToPrint.find(doc => doc.isMainDocument) || docsToPrint[0];
        if (mainDoc) {
            printRequest.document = {
                fileName: mainDoc.fileName,
                mimeType: mainDoc.mimeType || 'application/octet-stream',
                content: mainDoc.content,
                isMainDocument: mainDoc.isMainDocument
            };
        }

        // Add attachments if any
        const attachments = docsToPrint.filter(doc => !doc.isMainDocument);
        if (attachments.length > 0) {
            printRequest.attachments = attachments.map(doc => ({
                fileName: doc.fileName,
                mimeType: doc.mimeType || 'application/octet-stream',
                content: doc.content
            }));
        }

        // Send to console notifier
        try {
            const result = await consoleNotifier.notify(printRequest);
            logger.info(`Print request logged to console for queue: ${printRequest.queue}`);
            return req.info(200, `Print request logged to console for queue: ${printRequest.queue}\nNumber of copies: ${printRequest.numberOfCopies}`);
        } catch (error) {
            logger.error('Error in console notification:', error);
            return req.error('Console notification failed');
        }
    }

    const vcap = await readVcapServices(req);
    if (!vcap || vcap?.status === 500) {
        // For Production, return the error if print service is not found
        logger.error('Print service not found');
        return req.error(500, 'Print service not found');
    }
    const jwt = await getJwt(req, vcap);
    if (jwt?.code === 500) {
        logger.error('Failed to retrieve token');
        return req.error(500, 'Failed to retrieve token');
    }

    const api = axios.create({
        baseURL: vcap.service_url,
        headers: {
            'Authorization': `Bearer ${jwt}`,
            "DataServiceVersion": "2.0",
            "Accept": "*/*",
            "Content-Type": "application/json",
            'If-None-Match': '*',
            'scan': true
        }
    });

    // Upload documents to be printed
    for (const doc of docsToPrint) {
        if (!doc.content) {
            logger.error('No content provided for printing');
            return req.error('No content provided for printing');
        }
        let documentResp;
        try {
            documentResp = await api.post('/dm/api/v1/rest/print-documents', doc.content);
            doc.objectKey = documentResp.data;
        } catch (e) {
            logger.error(`Error in uploading document ${doc.fileName}: `, e.response?.data?.error?.message);
            return req.error(e.response?.data?.error?.message);
        }
    }

    let printTask = {
        numberOfCopies: numberOfCopies,
        username: cds.context?.user?.id,
        qname: qname,
        printContents: []
    }
    let itemId = "";
    // Create Print Content
    docsToPrint.forEach(async (doc) => {
        printTask.printContents.push({
            objectKey: doc.objectKey,
            documentName: doc.fileName
        })

        if (doc.isMainDocument) {
            itemId = doc.objectKey;
        }
    });

    // Print Task
    let printTaskResp;
    try {
        printTaskResp = await api.put(`/qm/api/v1/rest/print-tasks/${itemId}`, printTask);
    } catch (e) {
        logger.error('Error in sending to print queue: ', e.response?.data?.error?.message);
        return req.error('Print task failed');
    }
    logger.info(`Document sent to print queue ${qname}`);
    return req.info(200, `Document sent to print queue ${qname} \n 
            No. of copies requested: ${numberOfCopies}`);
}

module.exports = { print, populateQueueValueHelp };
logger.info('Print utility module loaded');

/**
 * Console Mode Configuration:
 * 
 * To enable console mode for development/testing:
 * - Set environment variable: PRINT_CONSOLE_MODE=true
 * - Or run in development mode: NODE_ENV=development
 * 
 * In console mode:
 * - Print requests are logged to console instead of sent to real print service
 * - Mock print queues are provided for value help
 * - No external API calls are made
 * - Useful for development and testing without print service dependency
 */

