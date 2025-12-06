// ====================================================================
// IMPORTS AND REQUIRED CUSTOM HANDLERS
// (Ensure these files exist in your project: ../exports/handleEventEmitter.js, 
//  ../NetFieldExports.js, and ../Classes.js)
// ====================================================================
const parseReplay = require('fortnite-replay-parser');
const handleEventEmitter = require('../exports/handleEventEmitter');
const NetFieldExports = require('../NetFieldExports');
const customClasses = require('../Classes');


// ====================================================================
// MAIN SERVERLESS FUNCTION HANDLER
// Mapped by Vercel to: YOUR_DOMAIN/api/parse
// ====================================================================
module.exports = async (req, res) => {
    
    // ⬇️ METHOD CHECK: Only allow POST requests ⬇️
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed. Use POST.');
    }
    // ⬆️ METHOD CHECK ⬆️
    
    // Parse the JSON body from the request
    const { fileUrl, callbackUrl } = req.body;

    // Check for required input parameters
    if (!fileUrl || !callbackUrl) {
        return res.status(400).send({ message: '❌ Missing fileUrl or callbackUrl in request body.' });
    }

    // Crucial: Respond immediately (HTTP 202 Accepted) to prevent client timeout
    res.status(202).send({ message: '✅ Parsing job accepted and started asynchronously.' });
    
    // Start the core logic execution (runs in the background)
    executeParsingJob(fileUrl, callbackUrl);
};


// ====================================================================
// CORE PARSING LOGIC FUNCTION
// ====================================================================
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
            // Options needed for accurate data extraction
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

        console.log(`[JOB] Parsing complete. Found ${playerStats.length} player stats.`);

        // --- 4. Send Results via Webhook ---
        await fetch(resultsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'success',
                stats: playerStats // The array of player stats
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