import { NextRequest, NextResponse } from "next/server";
import {
  generateS3Key,
  getPresignedUploadUrl,
  S3_FOLDERS,
} from "@/infrastructure/config/awsS3";

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos/foto-equipo/presign
// Genera una URL prefirmada para subir 1 foto de un equipo
// inspeccionado directamente a S3 desde el navegador
// ══════════════════════════════════════════════════════════

const ALLOWED_TYPES_RE = new RegExp("^image/");

interface PresignRequest {
  detalleRecordId: string;
  foto: { type: string; extension: string };
}

export async function POST(req: NextRequest) {
  try {
    const body: PresignRequest = await req.json();
    const { detalleRecordId, foto } = body;

    if (!detalleRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(detalleRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de detalle inválido" },
        { status: 400 }
      );
    }

    if (!foto || !ALLOWED_TYPES_RE.test(foto.type)) {
      return NextResponse.json(
        { success: false, message: `Formato no permitido. Use una imagen válida` },
        { status: 400 }
      );
    }

    const ext =
      foto.extension ||
      (foto.type === "image/png"
        ? "png"
        : foto.type === "image/webp"
        ? "webp"
        : "jpg");
    const filename = `foto-insp-equipo-${detalleRecordId}-${Date.now()}.${ext}`;
    const key = generateS3Key(S3_FOLDERS.INSPECCION_EQUIPOS, filename);
    const uploadUrl = await getPresignedUploadUrl(key, foto.type, 600);

    return NextResponse.json({
      success: true,
      upload: { key, uploadUrl, contentType: foto.type },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/foto-equipo/presign:", error);
    return NextResponse.json(
      { success: false, message: "Error al generar URL de carga" },
      { status: 500 }
    );
  }
}
