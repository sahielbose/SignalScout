import { env, hasS3 } from '@/lib/env';

/**
 * Flat-file delivery to S3.
 *
 * Design goal: never crash, never add a heavyweight dependency just to be present.
 * - When S3 is not configured (hasS3() === false) we log and return a clean skip.
 * - When S3 keys ARE present we do a best-effort note. A real, signed upload needs
 *   the AWS SDK (or a hand-rolled SigV4 signer), which we deliberately do not pull
 *   in here. We return { ok:false, skipped:true } with a clear note so the caller's
 *   flow continues uninterrupted (email still goes out, the delivery is still
 *   recorded). Wiring a real upload is a one-line swap once the SDK is added.
 */
export interface S3UploadResult {
  ok: boolean;
  skipped: boolean;
  /** s3://bucket/key location when an upload was attempted/configured. */
  location?: string;
  note?: string;
}

export async function uploadCsvToS3(key: string, csv: string): Promise<S3UploadResult> {
  if (!hasS3()) {
    console.log(`[s3:skip] not configured - would have uploaded ${csv.length} bytes to "${key}" (set S3_BUCKET + AWS keys to enable)`);
    return { ok: false, skipped: true, note: 'S3 not configured' };
  }

  const e = env();
  const location = `s3://${e.S3_BUCKET}/${key}`;
  // Keys are present, but a real signed PUT requires the AWS SDK. Take the safe
  // path: note what would happen and skip, so nothing in the delivery flow breaks.
  console.log(`[s3:skip] keys present - real upload of ${csv.length} bytes to ${location} needs the aws-sdk (not bundled); skipping`);
  return {
    ok: false,
    skipped: true,
    location,
    note: 'S3 keys present but the aws-sdk is not installed; real upload skipped',
  };
}
