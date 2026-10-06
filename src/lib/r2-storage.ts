import {
  S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileStorage } from './storage';
import { assertClientFolder } from './storage-paths';

/** S3/R2 DeleteObjects takes at most 1000 keys per request. */
const DELETE_BATCH = 1000;

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
    async removePrefix(prefix) {
      assertClientFolder(prefix);
      let removed = 0;
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        for (let i = 0; i < keys.length; i += DELETE_BATCH) {
          const batch = keys.slice(i, i + DELETE_BATCH);
          const res = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch, Quiet: true } }));
          // Counts only: keys hold client ids.
          if (res.Errors?.length) throw new Error(`${res.Errors.length} file(s) could not be deleted`);
          removed += batch.length;
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return removed;
    },
  };
}
