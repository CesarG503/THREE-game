import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3"
import { AuthError } from "./AuthService.js"

export interface StoredObject {
  bucket: string
  objectKey: string
}

let cachedClient: S3Client | null = null

export function getAssetBucket(): string {
  const bucket = process.env.S3_BUCKET?.trim()
  if (!bucket) throw new AuthError(500, "S3_BUCKET no esta configurado")
  return bucket
}

export function getStorageProvider(): string {
  return process.env.S3_STORAGE_PROVIDER?.trim() || "s3"
}

export async function putObject(input: {
  objectKey: string
  body: Buffer
  contentType: string
  metadata?: Record<string, string>
}): Promise<StoredObject> {
  const bucket = getAssetBucket()
  await getS3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: input.objectKey,
    Body: input.body,
    ContentType: input.contentType,
    Metadata: input.metadata,
  }))

  return { bucket, objectKey: input.objectKey }
}

export async function getObject(bucket: string, objectKey: string): Promise<GetObjectCommandOutput> {
  return getS3Client().send(new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }))
}

function getS3Client(): S3Client {
  if (cachedClient) return cachedClient

  const region = process.env.S3_REGION?.trim() || "us-east-1"
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim()

  if (!accessKeyId || !secretAccessKey) {
    throw new AuthError(500, "Credenciales S3 no configuradas")
  }

  cachedClient = new S3Client({
    region,
    endpoint,
    forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, Boolean(endpoint)),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return cachedClient
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback
  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}
