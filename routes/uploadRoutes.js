// routes/uploadRoutes.js
import express from 'express';
// ⚠️ IMPORTANT: Update this path if your s3Service is in a different directory
import { getSignedUploadUrl } from '../s3Service.js'; 

// Create a new router instance
const router = express.Router(); 

// 1. Endpoint for the frontend to request an upload link
router.get('/upload-key', async (req, res) => { // NOTE: Only '/upload-key' here
    try {
        // ... rest of the try block ...
        const fileKey = `replays/${Date.now()}-${req.query.filename}`; 
        const signedUploadUrl = await getSignedUploadUrl(fileKey);
        
        res.status(200).json({
            signedUploadUrl: signedUploadUrl,
            fileKey: fileKey
        });
    } catch (error) {
        console.error('Error generating upload key:', error);
        res.status(500).send('Could not generate upload key.');
    }
});

// ** You will add the POST /upload-complete endpoint here too **

export default router;