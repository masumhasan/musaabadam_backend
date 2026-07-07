require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function run() {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  console.log(`Checking S3 Bucket: ${bucket}`);

  try {
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
    }));
    
    console.log('\nAll Objects found in Bucket:');
    if (!data.Contents || data.Contents.length === 0) {
      console.log('No objects found.');
    } else {
      for (const obj of data.Contents) {
        console.log(`- ${obj.Key} (${obj.Size} bytes)`);
      }
    }
  } catch (err) {
    console.error('Error listing S3 bucket:', err.message);
  }
}

run();
