const { S3Client } = require('@aws-sdk/client-s3');

let _client = null;

const getS3Client = () => {
  if (_client) return _client;

  const region = process.env.AWS_REGION;
  if (!region) throw new Error('AWS_REGION must be set in environment');

  _client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return _client;
};

module.exports = { getS3Client };
