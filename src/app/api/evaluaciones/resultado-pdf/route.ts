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
  const iv  = Buffer.from(ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(encB64, "base64", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function tryDecryptFirma(encrypted: string): string {
  try {
    const json = JSON.parse(decryptAES(encrypted));
    return (json.signature as string) || "";
  } catch { return ""; }
}

function parseRespuesta(raw: string): string {
  if (!raw) return "—";
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.join(", ");
    return String(p);
  } catch { return raw; }
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
  } catch { /* ignore */ }
  return kt;
}

function normalizeCorrecta(raw: string, tipo: string, kt: Record<string, string>): string {
  if (!raw) return "—";
  if (tipo === "Verdadero/Falso") return raw.toLowerCase() === "true" ? "Verdadero" : "Falso";
  if (Object.keys(kt).length > 0) {
    if (raw.startsWith("[")) {
      try { return (JSON.parse(raw) as string[]).map(k => kt[k] || k).join(", "); }
      catch { return raw; }
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
  } catch { return raw; }
}

// ══════════════════════════════════════════════════════════
// POST /api/evaluaciones/resultado-pdf
// Body: { evalAplicadaId, registroRecordId?, empleadoCoreId? }
// Returns: individual PDF with all questions + answers + signatures
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { evalAplicadaId, registroRecordId, empleadoCoreId } = body;
    if (!evalAplicadaId) {
      return NextResponse.json({ success: false, message: "evalAplicadaId requerido" }, { status: 400 });
    }

    const {
      evalAplicadasTableId,
      evalAplicadasFields: eF,
      plantillasEvalTableId,
      plantillasEvalFields: pF,
      respEvalTableId,
      respEvalFields: rF,
      bancoPreguntasTableId,
      bancoPreguntasFields: bF,
      eventosCapacitacionTableId,
      eventosCapacitacionFields: evtF,
      asistenciaCapacitacionesTableId,
      asistenciaCapacitacionesFields: aF,
    } = airtableSGSSTConfig;

    const headers = getSGSSTHeaders();
    const base = getSGSSTUrl;

    // ── 1. Fetch EvalAplicadas ─────────────────────────────
    const evalRes = await fetch(`${base(evalAplicadasTableId)}/${evalAplicadaId}?returnFieldsByFieldId=true`, { headers, cache: "no-store" });
    if (!evalRes.ok) throw new Error("Evaluación no encontrada");
    const ef = (await evalRes.json()).fields || {};

    const nombres    = ef[eF.NOMBRES]    as string || "";
    const cedula     = ef[eF.CEDULA]     as string || "";
    let   cargo      = "";
    const cargoFromEval = ef[eF.CARGO] as string || "";
    const fecha      = ef[eF.FECHA]      as string || "";
    const puntajeObt = Number(ef[eF.PUNTAJE_OBT]) || 0;
    const puntajeMax = Number(ef[eF.PUNTAJE_MAX]) || 0;
    const porcentaje = Number(ef[eF.PORCENTAJE])  || 0;
    const estado     = ef[eF.ESTADO]     as string || "";
    const intento    = Number(ef[eF.INTENTO])     || 1;
    const tiempo     = Number(ef[eF.TIEMPO])      || 0;
    const plantillaId = ((ef[eF.PLANTILLA] as string[]) || [])[0] || "";
    const respLinkIds = (ef[eF.RESP_LINK] as string[]) || [];

    // Always look up cargo from the Personal table (CARGO field preferred)
    if (cedula) {
      try {
        const { personalTableId, personalFields: pFields } = airtableConfig;
        const rolLookupId = pFields.ROL_LOOKUP;
        const formula = `{${pFields.NUMERO_DOCUMENTO}}='${cedula.replace(/'/g, "\\'")}'`;
        const pUrl = `${getAirtableUrl(personalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${rolLookupId}&maxRecords=1`;
        const pRes = await fetch(pUrl, { headers: getAirtableHeaders(), cache: "no-store" });
        if (pRes.ok) {
          const pData = await pRes.json();
          const rec = (pData.records || [])[0];
          if (rec) {
            const rawRol = rec.fields[rolLookupId];
            cargo = Array.isArray(rawRol) ? (rawRol[0] as string) || "" : (rawRol as string) || "";
          }
        }
      } catch { /* skip fallback on error */ }
    }
    if (!cargo) cargo = cargoFromEval || "—";

    // ── 2. Fetch plantilla info ────────────────────────────
    let plantillaNombre = "Evaluación";
    let plantillaCodigo = "EVAL";
    if (plantillaId) {
      const plRes = await fetch(`${base(plantillasEvalTableId)}/${plantillaId}?returnFieldsByFieldId=true&fields[]=${pF.NOMBRE}&fields[]=${pF.CODIGO}`, { headers, cache: "no-store" });
      if (plRes.ok) {
        const plF = (await plRes.json()).fields || {};
        plantillaNombre = plF[pF.NOMBRE] as string || "Evaluación";
        plantillaCodigo = (plF[pF.CODIGO] as string || "EVAL").replace(/[^A-Za-z0-9-]/g, "");
      }
    }

    // ── 3. Fetch event + signatures ────────────────────────
    let nombreConferencista = "";
    let firmaConferencistaUrl = "";    // raw data URL after decrypt
    let firmaEmpleadoUrl = "";         // raw data URL after decrypt
    let asisIds: string[] = [];

    if (registroRecordId) {
      const evtRes = await fetch(`${base(eventosCapacitacionTableId)}/${registroRecordId}?returnFieldsByFieldId=true`, { headers, cache: "no-store" });
      if (evtRes.ok) {
        const evtFields = (await evtRes.json()).fields || {};
        nombreConferencista = evtFields[evtF.NOMBRE_CONFERENCISTA] as string || "";
        asisIds = (evtFields[evtF.ASISTENCIA_LINK] as string[]) || [];

        // Decrypt conferencista signature
        const firmaConferencistaCifrada = evtFields[evtF.FIRMA_CONFERENCISTA] as string || "";
        if (firmaConferencistaCifrada && AES_SECRET) {
          firmaConferencistaUrl = tryDecryptFirma(firmaConferencistaCifrada);
        }
      }
    }

    // Find employee asistencia record and get their firma
    if (asisIds.length > 0 && (empleadoCoreId || cedula)) {
      const batchSize = 50;
      outerLoop: for (let i = 0; i < asisIds.length; i += batchSize) {
        const batch = asisIds.slice(i, i + batchSize);
        const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(",")})`;
        const url = `${base(asistenciaCapacitacionesTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}&fields[]=${aF.ID_EMPLEADO_CORE}&fields[]=${aF.FIRMA}`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        for (const r of (data.records || []) as AirtableRecord[]) {
          const eid = r.fields[aF.ID_EMPLEADO_CORE] as string || "";
          if (empleadoCoreId ? eid === empleadoCoreId : eid === cedula) {
            const firmaCifrada = r.fields[aF.FIRMA] as string || "";
            if (firmaCifrada && AES_SECRET) {
              firmaEmpleadoUrl = tryDecryptFirma(firmaCifrada);
            }
            break outerLoop;
          }
        }
      }
    }

    // ── 4. Fetch RespEval records ──────────────────────────
    const respRecords: AirtableRecord[] = [];
    if (respLinkIds.length > 0) {
      for (let i = 0; i < respLinkIds.length; i += 10) {
        const batch = respLinkIds.slice(i, i + 10);
        const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(",")})`;
        const res = await fetch(`${base(respEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}`, { headers, cache: "no-store" });
        if (res.ok) respRecords.push(...((await res.json()).records || []));
      }
    }

    respRecords.sort((a, b) => (Number(a.fields[rF.ORDEN]) || 0) - (Number(b.fields[rF.ORDEN]) || 0));

    // ── 5. Batch-fetch BancoPreguntas ──────────────────────
    const pregIds = respRecords.flatMap(r => (r.fields[rF.PREGUNTA] as string[]) || []).filter(Boolean);
    const pregMap: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < pregIds.length; i += 10) {
      const batch = pregIds.slice(i, i + 10);
      const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(",")})`;
      const res = await fetch(`${base(bancoPreguntasTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(formula)}`, { headers, cache: "no-store" });
      if (res.ok) {
        for (const r of ((await res.json()).records || []) as AirtableRecord[]) {
          pregMap[r.id] = r.fields;
        }
      }
    }

    // ── 6. Build question list ─────────────────────────────
    const preguntas = respRecords.map(r => {
      const pregId = ((r.fields[rF.PREGUNTA] as string[]) || [])[0] || "";
      const pf     = pregMap[pregId] || {};
      const tipo   = pf[bF.TIPO] as string || "";
      const kt     = buildKeyToText(pf[bF.OPCIONES_JSON] as string || "");
      return {
        texto:             pf[bF.TEXTO]             as string || "—",
        tipo,
        respuestaDada:     parseRespuesta(r.fields[rF.RESPUESTA_DADA] as string || ""),
        respuestaCorrecta: normalizeCorrecta(pf[bF.RESPUESTA_CORRECTA] as string || "", tipo, kt),
        esCorrecta:        !!(r.fields[rF.ES_CORRECTA]),
        puntaje:           Number(r.fields[rF.PUNTAJE]) || 0,
        explicacion:       pf[bF.EXPLICACION] as string || "",
      };
    });

    const correctas = preguntas.filter(q => q.esCorrecta).length;

    // ── 7. Generate PDF ────────────────────────────────────
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth    = doc.internal.pageSize.getWidth();
    const pageHeight   = doc.internal.pageSize.getHeight();
    const margin       = 15;
    const contentWidth = pageWidth - margin * 2;

    let logoBase64 = "";
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
      logoBase64 = `data:image/png;base64,${buf.toString("base64")}`;
    } catch { /* no logo */ }

    let y = margin;

    // ── Header ─────────────────────────────────────────────
    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", margin, y, 40, 14); } catch { /* skip */ }
    }
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Sirius Regenerative Solutions S.A.S. ZOMAC", pageWidth - margin, y + 4, { align: "right" });
    doc.text("Sistema de Gestión de Seguridad y Salud en el Trabajo", pageWidth - margin, y + 8, { align: "right" });
    y += 20;

    // ── Title ──────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setTextColor(1, 84, 172);
    doc.setFont("helvetica", "bold");
    doc.text("Resultado de Evaluación", pageWidth / 2, y, { align: "center" });
    y += 10;

    // ── Info block ─────────────────────────────────────────
    doc.setFillColor(245, 247, 252);
    doc.setDrawColor(200, 215, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "FD");

    const halfW = contentWidth / 2;
    const lx    = margin + 5;
    const rx    = margin + halfW + 5;

    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    const infoRows: [string, string, string, string][] = [
      ["Nombre:",     doc.splitTextToSize(nombres || "—",          halfW - 26)[0], "C.C.:",    cedula || "—"],
      ["Cargo:",      doc.splitTextToSize(cargo   || "—",          halfW - 26)[0], "Fecha:",   formatFecha(fecha)],
      ["Evaluación:", doc.splitTextToSize(plantillaNombre || "—",  halfW - 30)[0], "Intento:", `#${intento}${tiempo > 0 ? `  (${tiempo} min)` : ""}`],
    ];

    const rowOffsets: [number, number][] = [[20, 12], [20, 12], [28, 17]];
    infoRows.forEach(([lbl1, val1, lbl2, val2], i) => {
      const rowY = y + 7 + i * 7;
      doc.setFont("helvetica", "bold");  doc.text(lbl1, lx, rowY);
      doc.setFont("helvetica", "normal"); doc.text(val1, lx + rowOffsets[i][0], rowY);
      doc.setFont("helvetica", "bold");  doc.text(lbl2, rx, rowY);
      doc.setFont("helvetica", "normal"); doc.text(val2, rx + rowOffsets[i][1], rowY);
    });
    y += 32;

    // ── Result box ─────────────────────────────────────────
    const aprobada = estado === "Aprobada";
    doc.setFillColor(...(aprobada ? [220, 252, 231] : [255, 228, 228]) as [number, number, number]);
    doc.setDrawColor(...(aprobada ? [34, 197, 94]  : [239, 68, 68])  as [number, number, number]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(aprobada ? [22, 163, 74] : [220, 38, 38]) as [number, number, number]);
    doc.text(aprobada ? "APROBADA" : "NO APROBADA", pageWidth / 2, y + 8, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Puntaje: ${puntajeObt.toFixed(2)} / ${puntajeMax.toFixed(2)}   |   ${porcentaje.toFixed(2)}%   |   ${correctas} de ${preguntas.length} correctas`,
      pageWidth / 2, y + 15, { align: "center" }
    );
    y += 26;

    // ── Table title ────────────────────────────────────────
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(`Detalle de Respuestas  (${preguntas.length} ${preguntas.length === 1 ? "pregunta" : "preguntas"})`, margin, y);
    y += 6;

    // ── Questions table ────────────────────────────────────
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
      if (q.explicacion)  details.push(q.explicacion);
      if (details.length > 0) {
        tableBody.push([
          "",
          { content: details.join("  —  "), colSpan: 4, styles: { fontStyle: "italic", textColor: [100, 100, 100], fontSize: 7, fillColor: [255, 252, 235] } },
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
        fontSize:  8,
        halign:    "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 52 },
        3: { halign: "center", cellWidth: 12 },
        4: { halign: "center", cellWidth: 18 },
      },
      bodyStyles:         { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [249, 251, 255] },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (String((data.row.raw as unknown[])?.[0] ?? "") === "" && data.row.index > 0) return;
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

    // ── Signatures section ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 50;
    y += 8;

    const sigSectionH = 52; // height needed for signature boxes
    if (y + sigSectionH > pageHeight - 15) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Firmas", margin, y);
    y += 5;

    const boxW  = (contentWidth - 8) / 2; // two boxes with 8mm gap
    const sigImgH = 22;                    // height for the signature image area
    const boxH  = sigImgH + 18;            // total box height

    const boxes = [
      {
        x:      margin,
        label:  "Empleado Evaluado",
        name:   nombres,
        extra:  cedula ? `C.C. ${cedula}` : "",
        firma:  firmaEmpleadoUrl,
      },
      {
        x:      margin + boxW + 8,
        label:  "Conferencista / Instructor",
        name:   nombreConferencista || "—",
        extra:  "",
        firma:  firmaConferencistaUrl,
      },
    ];

    for (const box of boxes) {
      // Box border
      doc.setFillColor(250, 251, 254);
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(box.x, y, boxW, boxH, 2, 2, "FD");

      // Label
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(90, 100, 120);
      doc.text(box.label, box.x + boxW / 2, y + 5, { align: "center" });

      // Signature image or placeholder line
      const sigY  = y + 8;
      const sigX  = box.x + 5;
      const sigW  = boxW - 10;
      if (box.firma) {
        try {
          const ext  = box.firma.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
          // Extract base64 data from data URL
          const b64  = box.firma.includes(",") ? box.firma.split(",")[1] : box.firma;
          doc.addImage(b64, ext, sigX, sigY, sigW, sigImgH, undefined, "FAST");
        } catch { /* skip image, draw line */ }
      }

      // Signature line
      doc.setDrawColor(100, 110, 130);
      doc.setLineWidth(0.3);
      doc.line(sigX, y + 8 + sigImgH, sigX + sigW, y + 8 + sigImgH);

      // Name and extra info below line
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(doc.splitTextToSize(box.name, sigW)[0], box.x + boxW / 2, y + 8 + sigImgH + 5, { align: "center" });
      if (box.extra) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(box.extra, box.x + boxW / 2, y + 8 + sigImgH + 10, { align: "center" });
      }
    }

    // ── Footer on all pages ────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      const ph = doc.internal.pageSize.getHeight();
      doc.text(
        `Sirius SG-SST  |  Resultado de Evaluacion  |  Generado el ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" })}`,
        pageWidth / 2, ph - 8, { align: "center" }
      );
      doc.text(`Pagina ${p} de ${totalPages}`, pageWidth - margin, ph - 8, { align: "right" });
    }

    // ── Return PDF ─────────────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const safeCode  = plantillaCodigo.replace(/-/g, "");
    const filename  = `${cedula || "eval"}_${safeCode}_${fecha || "sin-fecha"}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[resultado-pdf] Error:", err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Error al generar PDF" },
      { status: 500 }
    );
  }
}
