import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  uploadToS3,
  generateS3Key,
  s3Config,
  S3_FOLDERS,
  deleteFromS3,
} from "@/infrastructure/config/awsS3";

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos/foto-equipo/actualizar
// Reemplaza la foto de un equipo inspeccionado:
// 1. Sube la nueva foto a S3
// 2. Elimina la foto anterior de S3 (si existe)
// 3. Actualiza el campo Foto URL en Airtable
// Body: FormData con detalleRecordId, fotoAnteriorKey? (string), foto (File)
// ══════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES_RE = new RegExp("^image/");

function getFotoFieldId(): string | null {
  const fieldId = airtableSGSSTConfig.detalleEquiposFields.FOTO_URL;
  if (!fieldId || fieldId === "undefined") return null;
  return fieldId;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const detalleRecordId = formData.get("detalleRecordId") as string | null;
    const fotoAnteriorKey = formData.get("fotoAnteriorKey") as string | null;
    const foto = formData.get("foto") as File | null;

    // Validaciones
    if (!detalleRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(detalleRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de detalle inválido" },
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
        { success: false, message: "Configuración faltante: AIRTABLE_DETEQ_FOTO_URL no está definida" },
        { status: 500 }
      );
    }

    // Subir nueva foto a S3
    const ext = foto.name.split(".").pop() || "jpg";
    const filename = `foto-insp-equipo-${detalleRecordId}-${Date.now()}.${ext}`;
    const key = generateS3Key(S3_FOLDERS.INSPECCION_EQUIPOS, filename);
    const buffer = Buffer.from(await foto.arrayBuffer());
    await uploadToS3(key, buffer, foto.type);

    const newUrl = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`;

    // Actualizar Airtable con la nueva URL
    const patchUrl = `${getSGSSTUrl(airtableSGSSTConfig.detalleEquiposTableId)}/${detalleRecordId}`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: { [fotoFieldId]: newUrl },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Foto subida a S3 pero no se pudo actualizar en Airtable" },
        { status: 500 }
      );
    }

    // Eliminar la foto anterior de S3 (best-effort, no bloquea la respuesta)
    if (
      fotoAnteriorKey &&
      fotoAnteriorKey.startsWith(S3_FOLDERS.INSPECCION_EQUIPOS + "/")
    ) {
      deleteFromS3(fotoAnteriorKey).catch((err) =>
        console.error("No se pudo eliminar foto anterior de S3:", err)
      );
    }

    return NextResponse.json({
      success: true,
      message: "Foto actualizada correctamente",
      url: newUrl,
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/foto-equipo/actualizar:", error);
    return NextResponse.json(
      { success: false, message: "Error al actualizar la foto" },
      { status: 500 }
    );
  }
}
