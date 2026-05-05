import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  getSignedUrlForKey,
  s3Config,
  S3_FOLDERS,
  deleteFromS3,
} from "@/infrastructure/config/awsS3";

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-areas/fotos
// Recibe keys de S3 ya subidas y guarda las URLs en el
// campo Foto URL de la cabecera de la inspección.
// Body: { inspeccionRecordId: string; s3Keys: string[] }
//
// DELETE /api/inspecciones-areas/fotos
// Elimina una foto individual de S3 y actualiza Airtable.
// Body: { inspeccionRecordId: string; s3Key: string }
// ══════════════════════════════════════════════════════════

const MIN_FOTOS = 1;
const MAX_FOTOS = 3;

function getFotoFieldId(): string | null {
  const fieldId = airtableSGSSTConfig.inspeccionesAreasFields.FOTO_URL;
  if (!fieldId || fieldId === "undefined") return null;
  return fieldId;
}

// ── Helpers Airtable ──────────────────────────────────────

async function getCurrentUrls(inspeccionRecordId: string, fotoFieldId: string): Promise<string[]> {
  const url = `${getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId)}/${inspeccionRecordId}?returnFieldsByFieldId=true&fields[]=${fotoFieldId}`;
  const res = await fetch(url, { headers: getSGSSTHeaders(), cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = (data.fields?.[fotoFieldId] as string) || "";
  return raw ? raw.split(",").map((u: string) => u.trim()).filter(Boolean) : [];
}

async function saveUrlsToAirtable(
  inspeccionRecordId: string,
  urls: string[],
  fotoFieldId: string
): Promise<boolean> {
  const patchUrl = `${getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId)}/${inspeccionRecordId}`;
  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: getSGSSTHeaders(),
    body: JSON.stringify({
      fields: { [fotoFieldId]: urls.join(",") },
    }),
  });
  return res.ok;
}

// ── POST ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inspeccionRecordId, s3Keys } = body as {
      inspeccionRecordId: string;
      s3Keys: string[];
    };

    if (!inspeccionRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(inspeccionRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de inspección inválido" },
        { status: 400 }
      );
    }

    if (!s3Keys || s3Keys.length < MIN_FOTOS || s3Keys.length > MAX_FOTOS) {
      return NextResponse.json(
        { success: false, message: `Se requieren entre ${MIN_FOTOS} y ${MAX_FOTOS} fotos` },
        { status: 400 }
      );
    }

    // Validar que las keys pertenezcan al folder correcto
    for (const key of s3Keys) {
      if (!key.startsWith(S3_FOLDERS.INSPECCION_AREAS + "/")) {
        return NextResponse.json(
          { success: false, message: "Key de S3 inválida" },
          { status: 400 }
        );
      }
    }

    const fotoFieldId = getFotoFieldId();
    if (!fotoFieldId) {
      return NextResponse.json(
        { success: false, message: "Configuración faltante: AIRTABLE_INSPA_FOTO_URL no está definida" },
        { status: 500 }
      );
    }

    // Obtener URLs públicas (S3 público) para guardar en Airtable
    const publicUrls = s3Keys.map(
      (key) => `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`
    );

    const saved = await saveUrlsToAirtable(inspeccionRecordId, publicUrls, fotoFieldId);

    if (!saved) {
      return NextResponse.json({
        success: true,
        message: "Fotos subidas a S3 pero no se pudieron guardar en Airtable",
        urls: publicUrls,
        warning: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${s3Keys.length} foto(s) guardada(s) exitosamente`,
      urls: publicUrls,
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-areas/fotos:", error);
    return NextResponse.json(
      { success: false, message: "Error al guardar fotos de evidencia" },
      { status: 500 }
    );
  }
}

// ── DELETE ────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { inspeccionRecordId, s3Key } = body as {
      inspeccionRecordId: string;
      s3Key: string;
    };

    if (!inspeccionRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(inspeccionRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de inspección inválido" },
        { status: 400 }
      );
    }

    if (!s3Key || !s3Key.startsWith(S3_FOLDERS.INSPECCION_AREAS + "/")) {
      return NextResponse.json(
        { success: false, message: "Key de S3 inválida" },
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

    // Obtener URLs actuales desde Airtable
    const currentUrls = await getCurrentUrls(inspeccionRecordId, fotoFieldId);
    const publicUrl = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;
    const updatedUrls = currentUrls.filter((u) => u !== publicUrl);

    // Eliminar de S3
    try {
      await deleteFromS3(s3Key);
    } catch (s3Err) {
      console.error("Advertencia: no se pudo eliminar de S3:", s3Err);
      // Continuar — se actualiza Airtable de todas formas
    }

    // Actualizar Airtable (vacío si no quedan fotos)
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
        { success: false, message: "Error al actualizar Airtable" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Foto eliminada correctamente",
      urls: updatedUrls,
    });
  } catch (error) {
    console.error("Error en DELETE /api/inspecciones-areas/fotos:", error);
    return NextResponse.json(
      { success: false, message: "Error al eliminar foto" },
      { status: 500 }
    );
  }
}
