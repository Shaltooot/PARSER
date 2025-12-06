import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 Client with credentials from environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME; // e.g., 'fortnite-replays-private'

/**
 * Generates a secure, time-limited URL for the CLIENT (frontend) to UPLOAD a file directly to S3.
 * @param {string} fileKey The desired file path/name in S3 (e.g., 'replays/uuid.replay')
 * @returns {Promise<string>} The signed PUT URL
 */
export async function getSignedUploadUrl(fileKey) {
  const uploadCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    ContentType: 'application/octet-stream',
  });
  
  // URL valid for 60 seconds (Client must upload quickly)
  return await getSignedUrl(s3Client, uploadCommand, { expiresIn: 60 });
}

/**
 * Generates a secure, time-limited URL for the VERCEL PARSER to DOWNLOAD the file from S3.
 * @param {string} fileKey The exact file path/name in S3
 * @returns {Promise<string>} The signed GET URL
 */
export async function getSignedDownloadUrl(fileKey) {
  const downloadCommand = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  // URL valid for 300 seconds (5 minutes, enough time for parsing)
  return await getSignedUrl(s3Client, downloadCommand, { expiresIn: 300 });
}