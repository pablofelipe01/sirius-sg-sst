// ══════════════════════════════════════════════════════════
// Configuración AWS S3 — Bucket "sirius-sg-sst"
// Almacenamiento de documentos SG-SST
// ══════════════════════════════════════════════════════════

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configuración del cliente S3
export const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  bucketName: process.env.AWS_S3_BUCKET_NAME || "sirius-sg-sst",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

// Cliente S3 singleton
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: s3Config.region,
      credentials: s3Config.credentials,
    });
  }
  return s3Client;
}

// ══════════════════════════════════════════════════════════
// Carpetas del bucket
// ══════════════════════════════════════════════════════════
export const S3_FOLDERS = {
  /** Reportes de inspección EPP firmados */
  INSPECCION_EPP: "inspeccion-epp-reportes",
  /** Evidencias de entregas EPP */
  ENTREGA_EPP: "entrega-epp-evidencias",
  /** Evidencias de capacitaciones */
  CAPACITACIONES: "capacitaciones-evidencias",
  /** Documentos generales SST */
  DOCUMENTOS_SST: "documentos-sst",
  /** Fotos de evidencia de inspecciones de áreas */
  INSPECCION_AREAS: "inspeccion-areas-evidencias",
  /** Fotos de evidencia de inspecciones de equipos de emergencia */
  INSPECCION_EQUIPOS: "inspeccion-equipos-evidencias",
} as const;

// ══════════════════════════════════════════════════════════
// Funciones de utilidad
// ══════════════════════════════════════════════════════════

/**
 * Genera la key (ruta) para un archivo en S3
 * Formato: {carpeta}/{año}/{mes}/{filename}
 */
export function generateS3Key(
  folder: string,
  filename: string,
  date: Date = new Date()
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${folder}/${year}/${month}/${filename}`;
}

/**
 * Sube un archivo (Buffer) a S3
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string = "application/octet-stream"
): Promise<{ url: string; key: string }> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: s3Config.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);

  // URL pública del objeto
  const url = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`;

  return { url, key };
}

/**
 * Genera una URL firmada temporal para acceder a un archivo privado
 */
export async function getSignedUrlForKey(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: s3Config.bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Genera una URL firmada temporal para SUBIR un archivo directamente desde el navegador
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 600
): Promise<string> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: s3Config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Elimina un objeto de S3 por su key
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: s3Config.bucketName,
    Key: key,
  });
  await client.send(command);
}

/**
 * Genera el Content-Type basado en la extensión del archivo
 */
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return types[ext || ""] || "application/octet-stream";
}
