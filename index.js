const express = require('express');
const parseReplay = require('fortnite-replay-parser');
// NOTE: These files (./exports/handleEventEmitter, ./NetFieldExports, ./Classes) 
// MUST be present in your project for the parser options below to work.
const handleEventEmitter = require('./exports/handleEventEmitter');
const NetFieldExports = require('./NetFieldExports');
const customClasses = require('./Classes');

// Railway requires listening on the PORT environment variable
const PORT = process.env.PORT || 3000; 
const app = express();

// Middleware to parse incoming JSON bodies
app.use(express.json()); 

/**
 * 📢 Webhook Endpoint: POST /parse
 * Receives the job trigger from your main application.
 * Body expected: { fileUrl: 'secure_url_to_replay_file', callbackUrl: 'your_app_webhook_for_results' }
 */
app.post('/parse', async (req, res) => {
    const { fileUrl, callbackUrl } = req.body;

    if (!fileUrl || !callbackUrl) {
        return res.status(400).send({ message: '❌ Missing fileUrl or callbackUrl in request body.' });
    }

    // Crucial: Respond immediately (HTTP 202 Accepted) so the client doesn't time out.
    res.status(202).send({ message: '✅ Parsing job accepted and started asynchronously.' });
    
    // Start the long-running process in the background.
    executeParsingJob(fileUrl, callbackUrl);
});

/**
 * Core function to download, parse, extract specific stats, and callback results.
 */
async function executeParsingJob(signedUrl, resultsWebhookUrl) {
    let replayBuffer;

    try {
        // --- 1. Download the File using Node.js native fetch ---
        console.log(`[JOB] Downloading file from: ${signedUrl}`);
        const response = await fetch(signedUrl);

        if (!response.ok) {
            throw new Error(`Download failed. Status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        replayBuffer = Buffer.from(arrayBuffer);

        // --- 2. Parse the Replay Data with Custom Options ---
        console.log(`[JOB] Starting parsing...`);
        const replay = await parseReplay(replayBuffer, {
            // Options needed to enable custom NetFieldExports for reliable data
            handleEventEmitter,
            customNetFieldExports: NetFieldExports,
            onlyUseCustomNetFieldExports: true,
            customClasses,
        });

        // --- 3. Extract Player Name, Kills, and Placement ---
        const playersData = replay.gameData?.players ?? [];
        
        const playerStats = playersData
            .filter(player => !player.bIsABot) // Filter out bots
            .map(player => ({
                player_name: player.PlayerNamePrivate ?? player.PlayerName ?? "Unknown Player",
                kills: player.KillScore ?? player.Kills ?? 0,
                placement: player.Place ?? player.Placement ?? 0
            }));

        console.log(`[JOB] Parsing complete. Found ${playerStats.length} human player stats.`);

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
        console.error('❌ [JOB] Fatal Error:', error.message);
        
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
             console.error('❌ [JOB] Failed to send error webhook:', webhookError.message);
        }
    }
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});