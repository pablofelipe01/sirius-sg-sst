import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  airtableConfig,
  getAirtableUrl,
  getAirtableHeaders,
} from "@/infrastructure/config/airtable";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function decryptAES(encryptedStr: string): string {
  const [ivB64, encB64] = encryptedStr.split(":");
  if (!ivB64 || !encB64) throw new Error("Formato de cifrado inválido");
  const key = crypto.createHash("sha256").update(AES_SECRET).digest();
  const iv = Buffer.from(ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(encB64, "base64", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function tryDecryptFirma(encrypted: string): string {
  try {
    const json = JSON.parse(decryptAES(encrypted));
    return (json.signature as string) || "";
  } catch {
    return "";
  }
}

function parseRespuesta(raw: string): string {
  if (!raw) return "—";
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.join(", ");
    return String(p);
  } catch {
    return raw;
  }
}

function buildKeyToText(opcionesRaw: string): Record<string, string> {
  const kt: Record<string, string> = {};
  if (!opcionesRaw) return kt;
  try {
    const parsed = JSON.parse(opcionesRaw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === "object" && item.key && item.texto) {
          kt[item.key as string] = item.texto as string;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return kt;
}

function normalizeCorrecta(
  raw: string,
  tipo: string,
  kt: Record<string, string>
): string {
  if (!raw) return "—";
  if (tipo === "Verdadero/Falso")
    return raw.toLowerCase() === "true" ? "Verdadero" : "Falso";
  if (Object.keys(kt).length > 0) {
    if (raw.startsWith("[")) {
      try {
        return (JSON.parse(raw) as string[]).map((k) => kt[k] || k).join(", ");
      } catch {
        return raw;
      }
    }
    return kt[raw] || raw;
  }
  return raw;
}

function formatFecha(raw: string): string {
  if (!raw) return "—";
  try {
    return new Date(raw + "T12:00:00").toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

// ── Batch fetch helper ─────────────────────────────────────
async function batchFetchRecords(
  tableId: string,
  ids: string[],
  fieldIds: string[],
  headers: HeadersInit,
  base: (t: string) => string,
  batchSize = 10
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  const fqs = fieldIds.map((f) => `fields[]=${f}`).join("&");
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const url = `${base(tableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}${fqs ? `&${fqs}` : ""}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) records.push(...((await res.json()).records || []));
  }
  return records;
}

// ══════════════════════════════════════════════════════════
// POST /api/evaluaciones/resultado-pdf-unificado
// Body: { registroRecordId }
// Returns: single PDF with all individual evaluation results
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registroRecordId, tipo } = body;
    if (!registroRecordId) {
      return NextResponse.json(
        { success: false, message: "registroRecordId requerido" },
        { status: 400 }
      );
    }

    const {
      eventosCapacitacionTableId,
      eventosCapacitacionFields: evtF,
      evalAplicadasTableId,
      evalAplicadasFields: eF,
      plantillasEvalTableId,
      plantillasEvalFields: pF,
      respEvalTableId,
      respEvalFields: rF,
      bancoPreguntasTableId,
      bancoPreguntasFields: bF,
      asistenciaCapacitacionesTableId,
      asistenciaCapacitacionesFields: aF,
    } = airtableSGSSTConfig;

    const headers = getSGSSTHeaders();
    const base = getSGSSTUrl;

    // ── 1. Fetch event ─────────────────────────────────────
    const evtRes = await fetch(
      `${base(eventosCapacitacionTableId)}/${registroRecordId}?returnFieldsByFieldId=true`,
      { headers, cache: "no-store" }
    );
    if (!evtRes.ok) throw new Error("Evento no encontrado");
    const evtFields = (await evtRes.json()).fields || {};

    const progIds = (evtFields[evtF.PROGRAMACION_LINK] as string[]) || [];
    const asisIds = (evtFields[evtF.ASISTENCIA_LINK] as string[]) || [];
    const nombreConferencista =
      (evtFields[evtF.NOMBRE_CONFERENCISTA] as string) || "";
    const eventoFecha = (evtFields[evtF.FECHA] as string) || "";
    const temas = (evtFields[evtF.TEMAS_TRATADOS] as string) || "";
    const eventoNombre =
      temas.split("\n")[0].replace(/^[-•]\s*/, "").trim() ||
      "Evento de Capacitación";

    // Decrypt conferencista signature
    let firmaConferencistaUrl = "";
    const firmaConferencistaCifrada =
      (evtFields[evtF.FIRMA_CONFERENCISTA] as string) || "";
    if (firmaConferencistaCifrada && AES_SECRET) {
      firmaConferencistaUrl = tryDecryptFirma(firmaConferencistaCifrada);
    }

    if (!progIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "El evento no tiene programaciones asociadas",
        },
        { status: 404 }
      );
    }

    // ── 2. Fetch attendees → employee IDs + firma map ──────
    const employeeIds: string[] = [];
    const firmaMap: Record<string, string> = {}; // empId → firmaDataUrl

    for (let i = 0; i < asisIds.length; i += 50) {
      const batch = asisIds.slice(i, i + 50);
      const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const url = `${base(asistenciaCapacitacionesTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${aF.ID_EMPLEADO_CORE}&fields[]=${aF.FIRMA}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of (data.records || []) as AirtableRecord[]) {
        const eid = r.fields[aF.ID_EMPLEADO_CORE] as string;
        if (eid) {
          employeeIds.push(eid);
          const firmaCifrada = (r.fields[aF.FIRMA] as string) || "";
          if (firmaCifrada && AES_SECRET) {
            const url = tryDecryptFirma(firmaCifrada);
            if (url) firmaMap[eid] = url;
          }
        }
      }
    }

    if (!employeeIds.length) {
      return NextResponse.json(
        { success: false, message: "No hay asistentes para este evento" },
        { status: 404 }
      );
    }

    // ── 3. Fetch EvalAplicadas for this event ──────────────
    const progIdsSet = new Set(progIds);
    const evalRecords: AirtableRecord[] = [];
    const evalFieldIds = [
      eF.NOMBRES,
      eF.CEDULA,
      eF.CARGO,
      eF.PLANTILLA,
      eF.FECHA,
      eF.PUNTAJE_OBT,
      eF.PUNTAJE_MAX,
      eF.PORCENTAJE,
      eF.ESTADO,
      eF.INTENTO,
      eF.TIEMPO,
      eF.ID_EMPLEADO,
      eF.PROG_CAP,
      eF.RESP_LINK,
    ];
    const fqs = evalFieldIds.map((f) => `fields[]=${f}`).join("&");

    for (let i = 0; i < employeeIds.length; i += 20) {
      const batch = employeeIds.slice(i, i + 20);
      const formula = encodeURIComponent(
        `OR(${batch.map((id) => `{${eF.ID_EMPLEADO}}="${id}"`).join(",")})`
      );
      let url: string | null = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&${fqs}`;
      while (url) {
        const res: Response = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) break;
        const data = await res.json();
        for (const r of (data.records || []) as AirtableRecord[]) {
          if (
            ((r.fields[eF.PROG_CAP] as string[]) || []).some((pid) =>
              progIdsSet.has(pid)
            )
          ) {
            evalRecords.push(r);
          }
        }
        url = data.offset
          ? `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&${fqs}&offset=${data.offset}`
          : null;
      }
    }

    if (!evalRecords.length) {
      return NextResponse.json(
        { success: false, message: "No hay evaluaciones para este evento" },
        { status: 404 }
      );
    }

    // ── 4. Best attempt per (cedula, plantilla) ────────────
    const bestMap: Record<string, AirtableRecord> = {};
    for (const r of evalRecords) {
      const cedula = (r.fields[eF.CEDULA] as string) || "";
      const plantillaId =
        ((r.fields[eF.PLANTILLA] as string[]) || [])[0] || "";
      const key = `${cedula}__${plantillaId}`;
      const pct = Number(r.fields[eF.PORCENTAJE]) || 0;
      if (!bestMap[key] || pct > (Number(bestMap[key].fields[eF.PORCENTAJE]) || 0)) {
        bestMap[key] = r;
      }
    }
    const bestEvals = Object.values(bestMap).sort((a, b) =>
      ((a.fields[eF.NOMBRES] as string) || "").localeCompare(
        (b.fields[eF.NOMBRES] as string) || ""
      )
    );

    // ── 5. Fetch plantilla names ───────────────────────────
    const plantillaIds = [
      ...new Set(
        bestEvals
          .flatMap((r) => (r.fields[eF.PLANTILLA] as string[]) || [])
          .filter(Boolean)
      ),
    ];
    const plantillaMap: Record<string, { nombre: string; codigo: string; poblacion: string }> = {};
    if (plantillaIds.length) {
      const formula = `OR(${plantillaIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const url = `${base(plantillasEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${pF.NOMBRE}&fields[]=${pF.CODIGO}&fields[]=${pF.POBLACION}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.ok) {
        for (const r of ((await res.json()).records || []) as AirtableRecord[]) {
          plantillaMap[r.id] = {
            nombre: (r.fields[pF.NOMBRE] as string) || "Evaluación",
            codigo: ((r.fields[pF.CODIGO] as string) || "EVAL").replace(
              /[^A-Za-z0-9-]/g,
              ""
            ),
            poblacion: (r.fields[pF.POBLACION] as string) || "",
          };
        }
      }
    }

    // ── Filter evaluations by tipo (regular / copasst) ─────
    const filteredEvals = tipo
      ? bestEvals.filter((r) => {
          const plId = ((r.fields[eF.PLANTILLA] as string[]) || [])[0] || "";
          const pob = (plantillaMap[plId]?.poblacion || "").toUpperCase();
          if (tipo === "copasst") return pob.includes("COPASST");
          return !pob.includes("COPASST");
        })
      : bestEvals;

    if (!filteredEvals.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            tipo === "copasst"
              ? "No hay evaluaciones COPASST para este evento"
              : "No hay evaluaciones regulares para este evento",
        },
        { status: 404 }
      );
    }

    // ── 6. Batch fetch ALL RespEval + BancoPreguntas ───────
    const allRespIds = filteredEvals.flatMap(
      (r) => (r.fields[eF.RESP_LINK] as string[]) || []
    );
    const respRecords = await batchFetchRecords(
      respEvalTableId,
      allRespIds,
      [],
      headers,
      base
    );
    const respById: Record<string, AirtableRecord> = {};
    for (const r of respRecords) respById[r.id] = r;

    const allPregIds = [
      ...new Set(
        respRecords
          .flatMap((r) => (r.fields[rF.PREGUNTA] as string[]) || [])
          .filter(Boolean)
      ),
    ];
    const pregRecords = await batchFetchRecords(
      bancoPreguntasTableId,
      allPregIds,
      [],
      headers,
      base
    );
    const pregMap: Record<string, Record<string, unknown>> = {};
    for (const r of pregRecords) pregMap[r.id] = r.fields;

    // ── 7. Lookup cargos from Personal table ──────────────
    const allCedulas = [
      ...new Set(
        filteredEvals
          .map((r) => (r.fields[eF.CEDULA] as string) || "")
          .filter(Boolean)
      ),
    ];
    const cargoLookup: Record<string, string> = {};
    if (allCedulas.length) {
      try {
        const { personalTableId, personalFields: pFields } = airtableConfig;
        const rolLookupId = pFields.ROL_LOOKUP;
        for (let i = 0; i < allCedulas.length; i += 10) {
          const batch = allCedulas.slice(i, i + 10);
          const formula = `OR(${batch.map((c) => `{${pFields.NUMERO_DOCUMENTO}}='${c.replace(/'/g, "\\'")}'`).join(",")})`;
          const pUrl = `${getAirtableUrl(personalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${rolLookupId}&fields[]=${pFields.NUMERO_DOCUMENTO}`;
          const pRes = await fetch(pUrl, {
            headers: getAirtableHeaders(),
            cache: "no-store",
          });
          if (pRes.ok) {
            for (const r of ((await pRes.json()).records || []) as AirtableRecord[]) {
              const doc = (r.fields[pFields.NUMERO_DOCUMENTO] as string) || "";
              const rawRol = r.fields[rolLookupId];
              const cargo = Array.isArray(rawRol) ? (rawRol[0] as string) || "" : (rawRol as string) || "";
              if (doc && cargo) cargoLookup[doc] = cargo;
            }
          }
        }
      } catch {
        /* skip */
      }
    }

    // ── 8. Generate unified PDF ────────────────────────────
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter",
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let logoBase64 = "";
    try {
      const buf = fs.readFileSync(
        path.join(process.cwd(), "public", "logo.png")
      );
      logoBase64 = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      /* no logo */
    }

    // ── Render each evaluation as its own section ──────────
    for (let evalIdx = 0; evalIdx < filteredEvals.length; evalIdx++) {
      const ef = filteredEvals[evalIdx].fields;

      if (evalIdx > 0) doc.addPage();

      const nombres = (ef[eF.NOMBRES] as string) || "";
      const cedula = (ef[eF.CEDULA] as string) || "";
      let cargo = cargoLookup[cedula] || (ef[eF.CARGO] as string) || "—";
      if (!cargo) cargo = "—";
      const fecha = (ef[eF.FECHA] as string) || "";
      const puntajeObt = Number(ef[eF.PUNTAJE_OBT]) || 0;
      const puntajeMax = Number(ef[eF.PUNTAJE_MAX]) || 0;
      const porcentaje = Number(ef[eF.PORCENTAJE]) || 0;
      const estado = (ef[eF.ESTADO] as string) || "";
      const intento = Number(ef[eF.INTENTO]) || 1;
      const tiempo = Number(ef[eF.TIEMPO]) || 0;
      const plantillaId =
        ((ef[eF.PLANTILLA] as string[]) || [])[0] || "";
      const pl = plantillaMap[plantillaId] || {
        nombre: "Evaluación",
        codigo: "EVAL",
      };
      const respLinkIds = (ef[eF.RESP_LINK] as string[]) || [];
      const empleadoCoreId = (ef[eF.ID_EMPLEADO] as string) || "";

      // Employee signature
      const firmaEmpleadoUrl = firmaMap[empleadoCoreId] || "";

      // Build question list for this evaluation
      const evalResps = respLinkIds
        .map((id) => respById[id])
        .filter(Boolean)
        .sort(
          (a, b) =>
            (Number(a.fields[rF.ORDEN]) || 0) -
            (Number(b.fields[rF.ORDEN]) || 0)
        );

      const preguntas = evalResps.map((r) => {
        const pregId =
          ((r.fields[rF.PREGUNTA] as string[]) || [])[0] || "";
        const pf = pregMap[pregId] || {};
        const tipo = (pf[bF.TIPO] as string) || "";
        const kt = buildKeyToText((pf[bF.OPCIONES_JSON] as string) || "");
        return {
          texto: (pf[bF.TEXTO] as string) || "—",
          tipo,
          respuestaDada: parseRespuesta(
            (r.fields[rF.RESPUESTA_DADA] as string) || ""
          ),
          respuestaCorrecta: normalizeCorrecta(
            (pf[bF.RESPUESTA_CORRECTA] as string) || "",
            tipo,
            kt
          ),
          esCorrecta: !!r.fields[rF.ES_CORRECTA],
          puntaje: Number(r.fields[rF.PUNTAJE]) || 0,
          explicacion: (pf[bF.EXPLICACION] as string) || "",
        };
      });

      const correctas = preguntas.filter((q) => q.esCorrecta).length;

      // ── Draw page(s) for this evaluation ─────────────────
      let y = margin;

      // Header
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", margin, y, 40, 14);
        } catch {
          /* skip */
        }
      }
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        "Sirius Regenerative Solutions S.A.S. ZOMAC",
        pageWidth - margin,
        y + 4,
        { align: "right" }
      );
      doc.text(
        "Sistema de Gestión de Seguridad y Salud en el Trabajo",
        pageWidth - margin,
        y + 8,
        { align: "right" }
      );
      y += 20;

      // Title
      doc.setFontSize(14);
      doc.setTextColor(1, 84, 172);
      doc.setFont("helvetica", "bold");
      doc.text("Resultado de Evaluación", pageWidth / 2, y, {
        align: "center",
      });
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      const wrappedNombre = doc.splitTextToSize(eventoNombre, contentWidth - 20);
      doc.text(wrappedNombre, pageWidth / 2, y + 4, { align: "center" });
      y += 6 + (wrappedNombre.length - 1) * 4;

      // Info block
      doc.setFillColor(245, 247, 252);
      doc.setDrawColor(200, 215, 235);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "FD");

      const halfW = contentWidth / 2;
      const lx = margin + 5;
      const rx = margin + halfW + 5;

      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);

      const infoRows: [string, string, string, string][] = [
        [
          "Nombre:",
          doc.splitTextToSize(nombres || "—", halfW - 26)[0],
          "C.C.:",
          cedula || "—",
        ],
        [
          "Cargo:",
          doc.splitTextToSize(cargo || "—", halfW - 26)[0],
          "Fecha:",
          formatFecha(fecha),
        ],
        [
          "Evaluación:",
          doc.splitTextToSize(pl.nombre || "—", halfW - 30)[0],
          "Intento:",
          `#${intento}${tiempo > 0 ? `  (${tiempo} min)` : ""}`,
        ],
      ];

      const rowOffsets: [number, number][] = [
        [20, 12],
        [20, 12],
        [28, 17],
      ];
      infoRows.forEach(([lbl1, val1, lbl2, val2], i) => {
        const rowY = y + 7 + i * 7;
        doc.setFont("helvetica", "bold");
        doc.text(lbl1, lx, rowY);
        doc.setFont("helvetica", "normal");
        doc.text(val1, lx + rowOffsets[i][0], rowY);
        doc.setFont("helvetica", "bold");
        doc.text(lbl2, rx, rowY);
        doc.setFont("helvetica", "normal");
        doc.text(val2, rx + rowOffsets[i][1], rowY);
      });
      y += 32;

      // Result box
      const aprobada = estado === "Aprobada";
      doc.setFillColor(
        ...(aprobada
          ? [220, 252, 231]
          : [255, 228, 228]) as [number, number, number]
      );
      doc.setDrawColor(
        ...(aprobada
          ? [34, 197, 94]
          : [239, 68, 68]) as [number, number, number]
      );
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(
        ...(aprobada
          ? [22, 163, 74]
          : [220, 38, 38]) as [number, number, number]
      );
      doc.text(aprobada ? "APROBADA" : "NO APROBADA", pageWidth / 2, y + 8, {
        align: "center",
      });

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(
        `Puntaje: ${puntajeObt.toFixed(2)} / ${puntajeMax.toFixed(2)}   |   ${porcentaje.toFixed(2)}%   |   ${correctas} de ${preguntas.length} correctas`,
        pageWidth / 2,
        y + 15,
        { align: "center" }
      );
      y += 26;

      // Table title
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(
        `Detalle de Respuestas  (${preguntas.length} ${preguntas.length === 1 ? "pregunta" : "preguntas"})`,
        margin,
        y
      );
      y += 6;

      // Questions table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableBody: any[][] = [];
      for (let i = 0; i < preguntas.length; i++) {
        const q = preguntas[i];
        tableBody.push([
          String(i + 1),
          q.texto,
          q.respuestaDada,
          q.esCorrecta ? "OK" : "NO",
          `${q.puntaje.toFixed(2)}`,
        ]);

        const details: string[] = [];
        if (!q.esCorrecta) details.push(`Correcta: ${q.respuestaCorrecta}`);
        if (q.explicacion) details.push(q.explicacion);
        if (details.length > 0) {
          tableBody.push([
            "",
            {
              content: details.join("  —  "),
              colSpan: 4,
              styles: {
                fontStyle: "italic",
                textColor: [100, 100, 100],
                fontSize: 7,
                fillColor: [255, 252, 235],
              },
            },
          ]);
        }
      }

      autoTable(doc, {
        startY: y,
        head: [["#", "Pregunta", "Tu Respuesta", "", "Pts"]],
        body: tableBody,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          lineColor: [215, 220, 230],
          lineWidth: 0.1,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [1, 84, 172],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 52 },
          3: { halign: "center", cellWidth: 12 },
          4: { halign: "center", cellWidth: 18 },
        },
        bodyStyles: { textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [249, 251, 255] },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          if (
            String((data.row.raw as unknown[])?.[0] ?? "") === "" &&
            data.row.index > 0
          )
            return;
          if (data.column.index === 3) {
            const val = data.cell.raw as string;
            if (val === "OK") {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "NO") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        margin: { left: margin, right: margin },
      });

      // Signatures section
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable?.finalY ?? y + 50;
      y += 8;

      const sigSectionH = 52;
      if (y + sigSectionH > pageHeight - 15) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("Firmas", margin, y);
      y += 5;

      const boxW = (contentWidth - 8) / 2;
      const sigImgH = 22;
      const boxH = sigImgH + 18;

      const boxes = [
        {
          x: margin,
          label: "Empleado Evaluado",
          name: nombres,
          extra: cedula ? `C.C. ${cedula}` : "",
          firma: firmaEmpleadoUrl,
        },
        {
          x: margin + boxW + 8,
          label: "Conferencista / Instructor",
          name: nombreConferencista || "—",
          extra: "",
          firma: firmaConferencistaUrl,
        },
      ];

      for (const box of boxes) {
        doc.setFillColor(250, 251, 254);
        doc.setDrawColor(200, 210, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(box.x, y, boxW, boxH, 2, 2, "FD");

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(90, 100, 120);
        doc.text(box.label, box.x + boxW / 2, y + 5, { align: "center" });

        const sigY = y + 8;
        const sigX = box.x + 5;
        const sigW = boxW - 10;
        if (box.firma) {
          try {
            const ext = box.firma.startsWith("data:image/jpeg")
              ? "JPEG"
              : "PNG";
            const b64 = box.firma.includes(",")
              ? box.firma.split(",")[1]
              : box.firma;
            doc.addImage(b64, ext, sigX, sigY, sigW, sigImgH, undefined, "FAST");
          } catch {
            /* skip */
          }
        }

        doc.setDrawColor(100, 110, 130);
        doc.setLineWidth(0.3);
        doc.line(sigX, y + 8 + sigImgH, sigX + sigW, y + 8 + sigImgH);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        doc.text(doc.splitTextToSize(box.name, sigW)[0], box.x + boxW / 2, y + 8 + sigImgH + 5, {
          align: "center",
        });
        if (box.extra) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text(box.extra, box.x + boxW / 2, y + 8 + sigImgH + 10, {
            align: "center",
          });
        }
      }
    }

    // ── Footer on all pages ────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const footerNombre = eventoNombre.length > 60 ? eventoNombre.slice(0, 57) + "..." : eventoNombre;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      const ph = doc.internal.pageSize.getHeight();
      doc.text(
        `Sirius SG-SST  |  Evaluaciones - ${footerNombre}  |  Generado el ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" })}`,
        pageWidth / 2,
        ph - 8,
        { align: "center" }
      );
      doc.text(`Pagina ${p} de ${totalPages}`, pageWidth - margin, ph - 8, {
        align: "right",
      });
    }

    // ── Return PDF ─────────────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const tipoSuffix = tipo === "copasst" ? "_COPASST" : tipo === "regular" ? "_Regular" : "";
    const filename = `Evaluaciones${tipoSuffix}_${eventoFecha || "sin-fecha"}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[resultado-pdf-unificado] Error:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "Error al generar PDF unificado",
      },
      { status: 500 }
    );
  }
}
