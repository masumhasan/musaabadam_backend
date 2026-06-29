const { Readable } = require('stream');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { getS3Client } = require('../../../utils/s3Client');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
};

const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024,   // 10 MB
  video: 500 * 1024 * 1024,  // 500 MB
};

const FOLDER_PATHS = {
  profile: 'users/avatars',
  product: 'products/images',
  stream_thumbnail: 'streams/thumbnails',
  stream_recording: 'streams/recordings',
};

const PRESIGNED_URL_TTL_SECONDS = 300; // 5 minutes

const generatePresignedUploadUrl = async ({ folder, contentType, fileSize }) => {
  if (!FOLDER_PATHS[folder]) {
    throw new AppError(
      `Invalid folder. Allowed: ${Object.keys(FOLDER_PATHS).join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const category = contentType.startsWith('video/') ? 'video' : 'image';
  if (!ALLOWED_MIME_TYPES[category].includes(contentType)) {
    throw new AppError('File type not allowed', HTTP_STATUS.BAD_REQUEST);
  }

  const maxSize = MAX_FILE_SIZES[category];
  if (Number(fileSize) > maxSize) {
    throw new AppError(
      `File too large. Maximum size is ${maxSize / (1024 * 1024)} MB`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const ext = contentType.split('/')[1]
    .replace('jpeg', 'jpg')
    .replace('quicktime', 'mov')
    .replace('webp', 'webp');

  const key = `${FOLDER_PATHS[folder]}/${uuidv4()}.${ext}`;
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  if (!bucket) throw new AppError('AWS_S3_BUCKET_NAME not configured', HTTP_STATUS.INTERNAL_ERROR);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const client = getS3Client();
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });

  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return { uploadUrl, publicUrl, key, expiresIn: PRESIGNED_URL_TTL_SECONDS };
};

/**
 * Stream a remote file (e.g. a GetStream recording) straight into our S3 bucket
 * without buffering the whole video in memory. Returns the stored key + public URL.
 *
 * @param {Object}  opts
 * @param {string}  opts.sourceUrl     Remote file URL to copy from
 * @param {string}  opts.folder        Key in FOLDER_PATHS (e.g. 'stream_recording')
 * @param {string} [opts.keyPrefix]    Optional sub-path under the folder (e.g. the streamId)
 * @param {string} [opts.contentType]  Defaults to 'video/mp4'
 * @param {string} [opts.ext]          File extension without dot (defaults to 'mp4')
 */
const uploadRemoteFileToS3 = async ({ sourceUrl, folder, keyPrefix, contentType = 'video/mp4', ext = 'mp4' }) => {
  if (!FOLDER_PATHS[folder]) {
    throw new AppError(`Invalid folder. Allowed: ${Object.keys(FOLDER_PATHS).join(', ')}`, HTTP_STATUS.BAD_REQUEST);
  }
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) throw new AppError('AWS_S3_BUCKET_NAME not configured', HTTP_STATUS.INTERNAL_ERROR);

  const res = await fetch(sourceUrl);
  if (!res.ok || !res.body) {
    throw new AppError(`Failed to fetch source file (status ${res.status})`, HTTP_STATUS.BAD_REQUEST);
  }

  const segments = [FOLDER_PATHS[folder], keyPrefix, `${uuidv4()}.${ext}`].filter(Boolean);
  const key = segments.join('/');
  const contentLength = res.headers.get('content-length');

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Readable.fromWeb(res.body),
    ContentType: contentType,
    // ContentLength lets the SDK upload as a single PUT without buffering the stream
    ...(contentLength ? { ContentLength: Number(contentLength) } : {}),
  });

  await getS3Client().send(command);

  const region = process.env.AWS_REGION;
  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, publicUrl };
};

const deleteFile = async (key) => {
  if (!key) return;
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    })
  );
};

module.exports = { generatePresignedUploadUrl, uploadRemoteFileToS3, deleteFile };
