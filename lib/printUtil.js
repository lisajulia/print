const { getJwt, readVcapServices } = require("./authUtil");
const { getPrintConfigFromActionOrEntity } = require('./annotation-helper');
const axios = require('axios');
const logger = cds.log("printservice");
const ConsoleNotifier = require('./consoleNotifier');

// Initialize console notifier for development/testing
const consoleNotifier = new ConsoleNotifier();

// Check if console mode is enabled (can be configured via environment variable)
const CONSOLE_MODE = process.env.PRINT_CONSOLE_MODE === 'true';

/**
 * Populates the queue value help with available printers.
 * @param {Object} _ - Unused parameter.
 * @param {Object} req - The request object.
 */
const populateQueueValueHelp = async function (_, req) {
    logger.info('Populating print queue value help');

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
            if (CONSOLE_MODE) {
                documentResp = await consoleNotifier.postToConsole(api, '/dm/api/v1/rest/print-documents', doc.content);
            } else {
                documentResp = await api.post('/dm/api/v1/rest/print-documents', doc.content);
            }
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
        if (CONSOLE_MODE) {
            printTaskResp = await consoleNotifier.putToConsole(api, `/qm/api/v1/rest/print-tasks/${itemId}`, printTask);
        } else {
            printTaskResp = await api.put(`/qm/api/v1/rest/print-tasks/${itemId}`, printTask);
        }
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
 * To enable console mode for development/testing, set environment variable: PRINT_CONSOLE_MODE=true
 * 
 * In console mode:
 * - Print requests are logged to console instead of sent to real print service
 * - Real print queues are still loaded from the print service
 * - Only the actual printing (document upload and print task) is mocked
 * - Useful for development and testing without actually printing documents
 */

