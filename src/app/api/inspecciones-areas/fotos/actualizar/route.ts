import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  uploadToS3,
  generateS3Key,
  getSignedUrlForKey,
  S3_FOLDERS,
  s3Config,
} from "@/infrastructure/config/awsS3";

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-areas/fotos/actualizar
// Agrega o reemplaza una foto en un índice específico
// preservando las demás fotos existentes.
// Body: FormData con inspeccionRecordId, index (0-2), foto (File)
// ══════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES_RE = new RegExp("^image/");

function getFotoFieldId(): string | null {
  const fieldId = airtableSGSSTConfig.inspeccionesAreasFields.FOTO_URL;
  if (!fieldId || fieldId === "undefined") return null;
  return fieldId;
}

async function getCurrentUrls(inspeccionRecordId: string, fotoFieldId: string): Promise<string[]> {
  const url = `${getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId)}/${inspeccionRecordId}?returnFieldsByFieldId=true&fields[]=${fotoFieldId}`;
  const res = await fetch(url, { headers: getSGSSTHeaders(), cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = (data.fields?.[fotoFieldId] as string) || "";
  return raw ? raw.split(",").map((u: string) => u.trim()).filter(Boolean) : [];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const inspeccionRecordId = formData.get("inspeccionRecordId") as string | null;
    const indexStr = formData.get("index") as string | null;
    const foto = formData.get("foto") as File | null;

    // Validaciones
    if (!inspeccionRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(inspeccionRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de inspección inválido" },
        { status: 400 }
      );
    }

    const index = parseInt(indexStr || "", 10);
    if (isNaN(index) || index < 0 || index > 2) {
      return NextResponse.json(
        { success: false, message: "Índice inválido (0-2)" },
        { status: 400 }
      );
    }

    if (!foto || !(foto instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Se requiere una foto" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES_RE.test(foto.type)) {
      return NextResponse.json(
        { success: false, message: `Formato no permitido: ${foto.type}. Use una imagen válida` },
        { status: 400 }
      );
    }

    if (foto.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "La imagen excede 10 MB" },
        { status: 400 }
      );
    }

    const fotoFieldId = getFotoFieldId();
    if (!fotoFieldId) {
      return NextResponse.json(
        { success: false, message: "Configuración faltante: AIRTABLE_INSPA_FOTO_URL no está definida" },
        { status: 500 }
      );
    }

    // Obtener URLs actuales
    const currentUrls = await getCurrentUrls(inspeccionRecordId, fotoFieldId);

    // Subir nueva foto a S3
    const ext = foto.name.split(".").pop() || "jpg";
    const filename = `foto-insp-area-${inspeccionRecordId}-idx${index}-${Date.now()}.${ext}`;
    const key = generateS3Key(S3_FOLDERS.INSPECCION_AREAS, filename);
    const buffer = Buffer.from(await foto.arrayBuffer());
    await uploadToS3(key, buffer, foto.type);

    const newUrl = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`;

    // Reemplazar en el índice o agregar al final si no existe ese índice
    const updatedUrls = [...currentUrls];
    if (index < updatedUrls.length) {
      updatedUrls[index] = newUrl;
    } else {
      updatedUrls.push(newUrl);
    }

    // Guardar en Airtable
    const patchUrl = `${getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId)}/${inspeccionRecordId}`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: { [fotoFieldId]: updatedUrls.join(",") },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Foto subida a S3 pero no se pudo actualizar en Airtable" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Foto actualizada correctamente",
      url: newUrl,
      urls: updatedUrls,
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-areas/fotos/actualizar:", error);
    return NextResponse.json(
      { success: false, message: "Error al actualizar la foto" },
      { status: 500 }
    );
  }
}
