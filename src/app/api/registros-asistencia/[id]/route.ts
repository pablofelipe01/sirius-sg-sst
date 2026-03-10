import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
}

// ══════════════════════════════════════════════════════════
// GET /api/registros-asistencia/[id]
// Devuelve un Evento Capacitación con sus asistentes
// ══════════════════════════════════════════════════════════
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const {
      eventosCapacitacionTableId,
      eventosCapacitacionFields: evtF,
      asistenciaCapacitacionesTableId,
      asistenciaCapacitacionesFields: asisF,
    } = airtableSGSSTConfig;

    // 1. Fetch cabecera (Evento Capacitación)
    const cabeceraUrl = `${getSGSSTUrl(eventosCapacitacionTableId)}/${id}?returnFieldsByFieldId=true`;
    const cabeceraResponse = await fetch(cabeceraUrl, {
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!cabeceraResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Registro no encontrado" },
        { status: 404 }
      );
    }

    const cabecera: AirtableRecord = await cabeceraResponse.json();
    const f = cabecera.fields;
    const detalleIds = (f[evtF.ASISTENCIA_LINK] as string[]) || [];

    // 2. Fetch asistentes vinculados
    let asistentes: Record<string, unknown>[] = [];
    if (detalleIds.length > 0) {
      const formula = `OR(${detalleIds.map((rid) => `RECORD_ID()='${rid}'`).join(",")})`;
      const detalleUrl = getSGSSTUrl(asistenciaCapacitacionesTableId);
      const qs = new URLSearchParams({
        filterByFormula: formula,
        pageSize: "100",
        returnFieldsByFieldId: "true",
      });

      const detalleResponse = await fetch(`${detalleUrl}?${qs.toString()}`, {
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (detalleResponse.ok) {
        const detalleData: AirtableListResponse = await detalleResponse.json();
        asistentes = detalleData.records.map((record, idx) => ({
          id:               record.id,
          item:             idx + 1,
          idEmpleado:       record.fields[asisF.ID_EMPLEADO_CORE] as string,
          nombre:           record.fields[asisF.NOMBRES] as string,
          cedula:           record.fields[asisF.CEDULA] as string,
          labor:            record.fields[asisF.LABOR] as string,
          tieneFirma:       !!(record.fields[asisF.FIRMA_CONFIRMADA]),
          firmaConfirmada:  !!(record.fields[asisF.FIRMA_CONFIRMADA]),
        }));
      }
    }

    const temas = (f[evtF.TEMAS_TRATADOS] as string) || "";
    const primerTema = temas.split("\n")[0].replace(/^[-•]\s*/, "").trim();

    return NextResponse.json({
      success: true,
      data: {
        id:                  cabecera.id,
        idRegistro:          f[evtF.CODIGO] as string,
        nombreEvento:        primerTema || (f[evtF.CODIGO] as string) || "",
        ciudad:              f[evtF.CIUDAD] as string,
        fecha:               f[evtF.FECHA] as string,
        horaInicio:          f[evtF.HORA_INICIO] as string,
        lugar:               f[evtF.LUGAR] as string,
        duracion:            f[evtF.DURACION] as string,
        area:                f[evtF.AREA] as string,
        tipo:                f[evtF.TIPO] as string,
        temasTratados:       temas,
        nombreConferencista: f[evtF.NOMBRE_CONFERENCISTA] as string,
        estado:              f[evtF.ESTADO] as string,
        tieneFirmaConferencista: !!(f[evtF.FIRMA_CONFERENCISTA]),
        asistentes,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/registros-asistencia/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
