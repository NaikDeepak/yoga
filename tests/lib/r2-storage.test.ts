import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AWS SDK at the package boundary ────────────────────────
const { mockSend, mockGetSignedUrl } = vi.hoisted(() => {
  return {
    mockSend: vi.fn(),
    mockGetSignedUrl: vi.fn(),
  };
});

vi.mock('@aws-sdk/client-s3', () => {
  const S3Client = vi.fn(function() {
    return { send: mockSend };
  });
  const PutObjectCommand = vi.fn(function(input: unknown) {
    return { _type: 'Put', input };
  });
  const DeleteObjectCommand = vi.fn(function(input: unknown) {
    return { _type: 'Delete', input };
  });
  const GetObjectCommand = vi.fn(function(input: unknown) {
    return { _type: 'Get', input };
  });
  return { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// ── Stub env vars needed by r2Storage() ──────────────────────────────
beforeEach(() => {
  vi.stubEnv('R2_ACCOUNT_ID', 'test-account');
  vi.stubEnv('R2_ACCESS_KEY_ID', 'test-key');
  vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-secret');
  vi.stubEnv('R2_BUCKET', 'patient-files');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// Import the real module — SDK calls go to our mocks above
import { r2Storage } from '@/lib/r2-storage';

const file = () => new File([new Uint8Array([1, 2, 3])], 'scan.pdf', { type: 'application/pdf' });

describe('r2Storage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initialises S3Client with R2 endpoint from env', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    r2Storage(); // triggers constructor
    expect(S3Client).toHaveBeenCalledWith({
      region: 'auto',
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
    });
  });

  describe('upload', () => {
    it('sends PutObjectCommand with correct bucket, key, body, and content type', async () => {
      mockSend.mockResolvedValue({});
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const f = file();

      await r2Storage().upload('photos/abc.pdf', f);

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'patient-files',
        Key: 'photos/abc.pdf',
        Body: expect.any(Buffer),
        ContentType: 'application/pdf',
      });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('propagates S3 errors', async () => {
      mockSend.mockRejectedValue(new Error('S3 upload failed'));
      await expect(r2Storage().upload('x.pdf', file()))
        .rejects.toThrow('S3 upload failed');
    });
  });

  describe('remove', () => {
    it('sends DeleteObjectCommand with bucket and key', async () => {
      mockSend.mockResolvedValue({});
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      await r2Storage().remove('photos/abc.pdf');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'patient-files',
        Key: 'photos/abc.pdf',
      });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('propagates S3 errors', async () => {
      mockSend.mockRejectedValue(new Error('S3 delete failed'));
      await expect(r2Storage().remove('x.pdf'))
        .rejects.toThrow('S3 delete failed');
    });
  });

  describe('createSignedUrl', () => {
    it('generates signed URL with default 1h expiry', async () => {
      mockGetSignedUrl.mockResolvedValue('https://r2.example.com/signed');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');

      const url = await r2Storage().createSignedUrl('photos/abc.pdf');

      expect(url).toBe('https://r2.example.com/signed');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'patient-files',
        Key: 'photos/abc.pdf',
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(), // S3Client instance
        expect.anything(), // GetObjectCommand instance
        { expiresIn: 3600 },
      );
    });

    it('passes custom expiry', async () => {
      mockGetSignedUrl.mockResolvedValue('https://r2.example.com/signed');

      await r2Storage().createSignedUrl('x.pdf', 120);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 120 },
      );
    });

    it('propagates presigner errors', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('presign failed'));
      await expect(r2Storage().createSignedUrl('x.pdf'))
        .rejects.toThrow('presign failed');
    });
  });
});
