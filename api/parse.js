// Note: We still need to require the necessary modules and local helpers
const parseReplay = require('fortnite-replay-parser');
const handleEventEmitter = require('../exports/handleEventEmitter');
const NetFieldExports = require('../NetFieldExports');
const customClasses = require('../Classes');

// The main export is the serverless function handler
module.exports = async (req, res) => {
    // Vercel serverless functions only accept POST for this type of operation
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed. Use POST.');
    }
    
    // Parse the JSON body from the request
    const { fileUrl, callbackUrl } = req.body;

    if (!fileUrl || !callbackUrl) {
        return res.status(400).send({ message: '❌ Missing fileUrl or callbackUrl in request body.' });
    }

    // Crucial: Respond immediately (HTTP 202 Accepted) and run the long-running task.
    res.status(202).send({ message: '✅ Parsing job accepted and started asynchronously.' });
    
    // Start the core logic. Note: The serverless function will complete here, 
    // but Node.js will continue to execute the background task.
    executeParsingJob(fileUrl, callbackUrl);
};

/**
 * Core function to download, parse, extract specific stats, and callback results.
 * This is the same logic as before, using fetch and the parser.
 */
async function executeParsingJob(signedUrl, resultsWebhookUrl) {
    let replayBuffer;

    try {
        // --- 1. Download the File ---
        const response = await fetch(signedUrl);
        if (!response.ok) {
            throw new Error(`Download failed. Status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        replayBuffer = Buffer.from(arrayBuffer);

        // --- 2. Parse the Replay Data ---
        const replay = await parseReplay(replayBuffer, {
            handleEventEmitter,
            customNetFieldExports: NetFieldExports,
            onlyUseCustomNetFieldExports: true,
            customClasses,
        });

        // --- 3. Extract Player Name, Kills, and Placement ---
        const playersData = replay.gameData?.players ?? [];
        const playerStats = playersData
            .filter(player => !player.bIsABot) 
            .map(player => ({
                player_name: player.PlayerNamePrivate ?? player.PlayerName ?? "Unknown Player",
                kills: player.KillScore ?? player.Kills ?? 0,
                placement: player.Place ?? player.Placement ?? 0
            }));

        // --- 4. Send Results via Webhook ---
        await fetch(resultsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'success',
                stats: playerStats
            })
        });
        
    } catch (error) {
        // --- 4. Send Error Status via Webhook ---
        try {
            await fetch(resultsWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'error',
                    message: `Failed to process replay: ${error.message}`
                })
            });
        } catch (webhookError) {
             console.error('❌ Failed to send error webhook:', webhookError.message);
        }
    }
}