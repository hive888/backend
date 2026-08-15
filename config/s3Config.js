const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

function getS3Client() {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
  } catch (err) {
    console.error('Failed to reload dotenv in s3Config:', err);
  }

  return new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });
}

function publicApiBase() {
  return (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}/api`).replace(/\/$/, '');
}

function uploadsRoot() {
  const candidates = [
    path.join(__dirname, '..', 'media-uploads'),
    path.join(__dirname, '..', 'uploads')
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // try next location
    }
  }
  throw new Error('No writable uploads directory');
}

function saveLocal(file, folder) {
  const prefix = 'hive888/';
  const cleanFolder = folder.startsWith(prefix) ? folder : `${prefix}${folder}`;
  const safeName = String(file.originalname || 'file').replace(/[^\w.\-]+/g, '_');
  const filename = `${Date.now()}-${safeName}`;
  const destDir = path.join(uploadsRoot(), cleanFolder);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, filename), file.buffer);
  const url = `${publicApiBase()}/uploads/${cleanFolder}${filename}`.replace(/([^:])\/{2,}/g, '$1/');
  console.log('Saved media locally:', url);
  return url;
}

const uploadToS3 = async (file, folder = 'profile_pictures/') => {
  if (!file || !file.buffer) {
    throw new Error('No file or file buffer provided');
  }

  const forceLocal = String(process.env.MEDIA_STORAGE || '').toLowerCase() === 'local';
  if (forceLocal) {
    return saveLocal(file, folder);
  }

  const s3 = getS3Client();
  const prefix = 'hive888/';
  const cleanFolder = folder.startsWith(prefix) ? folder : `${prefix}${folder}`;
  const key = `${cleanFolder}${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME || 'ptgr-excrusion',
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  try {
    let data;
    try {
      data = await s3.upload(params).promise();
    } catch (aclErr) {
      if (aclErr.code === 'AccessControlListNotSupported' || aclErr.message?.includes('ACL')) {
        console.log('ACL not supported, retrying upload without ACL...');
        const paramsNoAcl = { ...params };
        delete paramsNoAcl.ACL;
        data = await s3.upload(paramsNoAcl).promise();
      } else {
        throw aclErr;
      }
    }

    const cloudfrontUrl = process.env.CLOUDFRONT_URL;
    if (cloudfrontUrl) {
      const baseUrl = cloudfrontUrl.endsWith('/') ? cloudfrontUrl.slice(0, -1) : cloudfrontUrl;
      return `${baseUrl}/${key}`;
    }

    return data.Location;
  } catch (err) {
    console.error('S3 Upload Error:', err.code || err.message);
    const code = err.code || err.name || '';
    const msg = String(err.message || '');
    const useLocalFallback = [
      'InvalidAccessKeyId',
      'InvalidClientTokenId',
      'CredentialsError',
      'SignatureDoesNotMatch',
      'AccessDenied',
      'PermanentRedirect',
      'UnknownEndpoint',
      'TimeoutError',
      'NetworkingError'
    ].includes(code) || /InvalidAccessKeyId|credentials|access key/i.test(msg);

    if (useLocalFallback) {
      return saveLocal(file, folder);
    }
    throw new Error('Failed to upload file to S3');
  }
};

const deleteFromS3 = async (url) => {
  if (!url) return;

  if (String(url).includes('/api/uploads/')) {
    try {
      const pathname = new URL(url, 'http://localhost').pathname;
      const relative = pathname.replace(/^\/api\/uploads\/?/, '');
      const roots = [
        path.join(__dirname, '..', 'media-uploads'),
        path.join(__dirname, '..', 'uploads')
      ];
      for (const root of roots) {
        const localPath = path.join(root, relative);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Local delete error:', err);
      return false;
    }
  }

  const s3 = getS3Client();
  try {
    const key = new URL(url).pathname.substring(1);
    await s3.deleteObject({
      Bucket: process.env.AWS_BUCKET_NAME || 'ptgr-excrusion',
      Key: key
    }).promise();
    return true;
  } catch (err) {
    console.error('S3 Delete Error:', err);
    throw new Error('Failed to delete file from S3');
  }
};

module.exports = { uploadToS3, deleteFromS3 };
