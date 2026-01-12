const AWS = require('aws-sdk');

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const uploadToS3 = async (file, folder = 'profile_pictures/') => {
  if (!file || !file.buffer) {
    throw new Error('No file or file buffer provided');
  }

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME || 'ptgr-bucket',
    Key: `${folder}${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Location; // Returns the public URL
  } catch (err) {
    console.error('S3 Upload Error:', err);
    throw new Error('Failed to upload file to S3');
  }
};

const deleteFromS3 = async (url) => {
  if (!url) return;

  try {
    const key = new URL(url).pathname.substring(1); // More reliable way to extract key
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME || 'ptgr-bucket',
      Key: key
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (err) {
    console.error('S3 Delete Error:', err);
    throw new Error('Failed to delete file from S3');
  }
};

module.exports = { uploadToS3, deleteFromS3 };