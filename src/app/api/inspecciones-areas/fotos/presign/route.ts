import { NextRequest, NextResponse } from "next/server";
import {
  generateS3Key,
  getPresignedUploadUrl,
  S3_FOLDERS,
} from "@/infrastructure/config/awsS3";

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-areas/fotos/presign
// Genera URLs prefirmadas para subir 1-3 fotos de evidencia
// de una inspección de área directamente a S3 desde el navegador
// ══════════════════════════════════════════════════════════

const ALLOWED_TYPES_RE = /^image\//;
const MAX_FOTOS = 3;

interface FotoMeta {
  type: string;
  extension: string;
}

interface PresignRequest {
  inspeccionRecordId: string;
  fotos: FotoMeta[];
}

export async function POST(req: NextRequest) {
  try {
    const body: PresignRequest = await req.json();
    const { inspeccionRecordId, fotos } = body;

    if (!inspeccionRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(inspeccionRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de inspección inválido" },
        { status: 400 }
      );
    }

    if (!fotos || fotos.length === 0 || fotos.length > MAX_FOTOS) {
      return NextResponse.json(
        { success: false, message: `Se requieren entre 1 y ${MAX_FOTOS} fotos` },
        { status: 400 }
      );
    }

    for (const foto of fotos) {
      if (!ALLOWED_TYPES_RE.test(foto.type)) {
        return NextResponse.json(
          { success: false, message: `Formato no permitido: ${foto.type}. Use una imagen válida` },
          { status: 400 }
        );
      }
    }

    const timestamp = Date.now();
    const uploads = await Promise.all(
      fotos.map(async (foto, i) => {
        const ext =
          foto.extension ||
          (foto.type === "image/png"
            ? "png"
            : foto.type === "image/webp"
            ? "webp"
            : "jpg");
        const filename = `foto-insp-area-${inspeccionRecordId}-${i + 1}-${timestamp}.${ext}`;
        const key = generateS3Key(S3_FOLDERS.INSPECCION_AREAS, filename);
        const uploadUrl = await getPresignedUploadUrl(key, foto.type, 600);
        return { key, uploadUrl, contentType: foto.type };
      })
    );

    return NextResponse.json({ success: true, uploads });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-areas/fotos/presign:", error);
    return NextResponse.json(
      { success: false, message: "Error al generar URLs de carga" },
      { status: 500 }
    );
  }
}
