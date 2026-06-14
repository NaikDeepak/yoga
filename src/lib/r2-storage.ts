import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileStorage } from './storage';

export function r2Storage(): FileStorage {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.R2_BUCKET!;

  return {
    async upload(path, file) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
      }));
    },
    async remove(path) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
    },
    async createSignedUrl(path, expiresInSeconds = 3600) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: path }),
        { expiresIn: expiresInSeconds },
      );
    },
  };
}
