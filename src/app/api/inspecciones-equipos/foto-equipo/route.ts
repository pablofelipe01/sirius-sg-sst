import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  s3Config,
  S3_FOLDERS,
  deleteFromS3,
} from "@/infrastructure/config/awsS3";

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos/foto-equipo
// Recibe la key S3 ya subida y guarda la URL pública en
// el campo Foto URL del registro Detalle Inspección Equipos.
// Body: { detalleRecordId: string; s3Key: string }
//
// DELETE /api/inspecciones-equipos/foto-equipo
// Elimina la foto de S3 y limpia el campo en Airtable.
// Body: { detalleRecordId: string; s3Key: string }
// ══════════════════════════════════════════════════════════

function getFotoFieldId(): string | null {
  const fieldId = airtableSGSSTConfig.detalleEquiposFields.FOTO_URL;
  if (!fieldId || fieldId === "undefined") return null;
  return fieldId;
}

// ── POST ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { detalleRecordId, s3Key } = body as {
      detalleRecordId: string;
      s3Key: string;
    };

    if (!detalleRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(detalleRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de detalle inválido" },
        { status: 400 }
      );
    }

    if (!s3Key || !s3Key.startsWith(S3_FOLDERS.INSPECCION_EQUIPOS + "/")) {
      return NextResponse.json(
        { success: false, message: "Key de S3 inválida" },
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

    const publicUrl = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;

    const patchUrl = `${getSGSSTUrl(airtableSGSSTConfig.detalleEquiposTableId)}/${detalleRecordId}`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: { [fotoFieldId]: publicUrl },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        success: true,
        message: "Foto subida a S3 pero no se pudo guardar en Airtable",
        url: publicUrl,
        warning: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Foto guardada exitosamente",
      url: publicUrl,
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/foto-equipo:", error);
    return NextResponse.json(
      { success: false, message: "Error al guardar foto del equipo" },
      { status: 500 }
    );
  }
}

// ── DELETE ────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { detalleRecordId, s3Key } = body as {
      detalleRecordId: string;
      s3Key: string;
    };

    if (!detalleRecordId || !/^rec[a-zA-Z0-9]{14}$/.test(detalleRecordId)) {
      return NextResponse.json(
        { success: false, message: "ID de detalle inválido" },
        { status: 400 }
      );
    }

    if (!s3Key || !s3Key.startsWith(S3_FOLDERS.INSPECCION_EQUIPOS + "/")) {
      return NextResponse.json(
        { success: false, message: "Key de S3 inválida" },
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

    // Eliminar de S3
    try {
      await deleteFromS3(s3Key);
    } catch (s3Err) {
      console.error("Advertencia: no se pudo eliminar de S3:", s3Err);
    }

    // Limpiar campo en Airtable
    const patchUrl = `${getSGSSTUrl(airtableSGSSTConfig.detalleEquiposTableId)}/${detalleRecordId}`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: { [fotoFieldId]: "" },
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
    });
  } catch (error) {
    console.error("Error en DELETE /api/inspecciones-equipos/foto-equipo:", error);
    return NextResponse.json(
      { success: false, message: "Error al eliminar foto" },
      { status: 500 }
    );
  }
}
