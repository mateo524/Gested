import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import { v2 as cloudinary } from "cloudinary";

const required = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];

export function isS3Enabled() {
  return required.every((key) => Boolean(process.env[key]));
}

function isCloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadToStorage({ localPath, contentType, originalName }) {
  if (isCloudinaryEnabled()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const folder = process.env.CLOUDINARY_FOLDER || "performia";
    const uploaded = await cloudinary.uploader.upload(localPath, {
      resource_type: "auto",
      folder,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    return {
      provider: "cloudinary",
      key: uploaded.public_id,
      bucket: process.env.CLOUDINARY_CLOUD_NAME,
      publicUrl: uploaded.secure_url,
    };
  }

  if (!isS3Enabled()) {
    return {
      provider: "local",
      key: null,
      bucket: null,
      publicUrl: null,
    };
  }

  const bytes = await fs.readFile(localPath);
  const safeName = originalName.replace(/\s+/g, "-").toLowerCase();
  const key = `${process.env.S3_KEY_PREFIX || "performia"}/${Date.now()}-${safeName}`;
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType || "application/octet-stream",
    })
  );

  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
  const publicUrl = publicBase ? `${publicBase.replace(/\/$/, "")}/${key}` : null;

  return {
    provider: "s3",
    key,
    bucket: process.env.S3_BUCKET,
    publicUrl,
  };
}
