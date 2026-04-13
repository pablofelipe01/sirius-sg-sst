import { NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════
// GET /api/registros-asistencia/conferencista
// Returns the name of the "Responsable SG-SST" from Miembros Comités SST
// ══════════════════════════════════════════════════════════
export async function GET() {
  try {
    const { miembrosComitesTableId, miembrosComitesFields: mF } =
      airtableSGSSTConfig;
    const headers = getSGSSTHeaders();

    const formula = encodeURIComponent(
      `AND(FIND("Responsable SG-SST",{${mF.CARGO}})>0,{${mF.ESTADO}}="Activo")`
    );
    const url = `${getSGSSTUrl(miembrosComitesTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&fields[]=${mF.NOMBRE}&maxRecords=1`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Error consultando miembros del comité" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const records = (data.records || []) as AirtableRecord[];

    if (records.length === 0) {
      return NextResponse.json({ success: true, nombre: "" });
    }

    const nombre = (records[0].fields[mF.NOMBRE] as string) || "";
    return NextResponse.json({ success: true, nombre });
  } catch (err) {
    console.error("[conferencista] Error:", err);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
