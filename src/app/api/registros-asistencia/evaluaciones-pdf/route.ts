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

// ══════════════════════════════════════════════════════════
// Interfaces
// ══════════════════════════════════════════════════════════
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface EvalResult {
  id: string;
  nombres: string;
  cedula: string;
  cargo: string;
  plantillaId: string;
  plantillaNombre: string;
  puntajeObtenido: number;
  puntajeMaximo: number;
  porcentaje: number;
  estado: string;
  intento: number;
  fecha: string;
  firmaUrl: string;
}

// ══════════════════════════════════════════════════════════
// AES-256-CBC Decryption for signatures
// ══════════════════════════════════════════════════════════
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
  } catch { return ""; }
}

// ══════════════════════════════════════════════════════════
// POST /api/registros-asistencia/evaluaciones-pdf
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registroRecordId } = body;
    if (!registroRecordId) {
      return NextResponse.json({ success: false, message: "registroRecordId requerido" }, { status: 400 });
    }

    const {
      eventosCapacitacionTableId,
      eventosCapacitacionFields: evtF,
      evalAplicadasTableId,
      evalAplicadasFields: eF,
      plantillasEvalTableId,
      plantillasEvalFields: pF,
      asistenciaCapacitacionesTableId,
      asistenciaCapacitacionesFields: aF,
    } = airtableSGSSTConfig;

    const headers = getSGSSTHeaders();
    const base = getSGSSTUrl;

    // ── 1. Fetch Event ──────────────────────────────────
    const evtUrl = `${base(eventosCapacitacionTableId)}/${registroRecordId}?returnFieldsByFieldId=true`;
    const evtRes = await fetch(evtUrl, { headers, cache: "no-store" });
    if (!evtRes.ok) throw new Error("No se pudo obtener el evento");
    const evtData = await evtRes.json();
    const evtFields = evtData.fields || {};

    const nombreEvento = (evtFields[evtF.TEMAS_TRATADOS] as string || "Evento sin nombre").split("\n")[0];
    const fecha = evtFields[evtF.FECHA] as string || "";
    const ciudad = evtFields[evtF.CIUDAD] as string || "";
    const tipo = evtFields[evtF.TIPO] as string || "";
    const conferencista = evtFields[evtF.NOMBRE_CONFERENCISTA] as string || "";
    const progIds = (evtFields[evtF.PROGRAMACION_LINK] as string[]) || [];

    // Decrypt conferencista signature
    let firmaConferencistaUrl = "";
    const firmaConferencistaCifrada = evtFields[evtF.FIRMA_CONFERENCISTA] as string || "";
    if (firmaConferencistaCifrada && AES_SECRET) {
      firmaConferencistaUrl = tryDecryptFirma(firmaConferencistaCifrada);
    }

    if (!progIds.length) {
      return NextResponse.json({ success: false, message: "El evento no tiene programaciones asociadas" }, { status: 404 });
    }

    // ── 2. Fetch Asistentes (batched for large events) ──
    const asisIds = (evtFields[evtF.ASISTENCIA_LINK] as string[]) || [];
    const attendeeMap: Record<string, { nombre: string; cedula: string; firmaUrl: string }> = {};
    if (asisIds.length) {
      const asisBatch = 50; // Airtable formula length safety
      for (let i = 0; i < asisIds.length; i += asisBatch) {
        const batch = asisIds.slice(i, i + asisBatch);
        const asisFormula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(",")})`;
        const asisUrl = `${base(asistenciaCapacitacionesTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(asisFormula)}&fields[]=${aF.NOMBRES}&fields[]=${aF.CEDULA}&fields[]=${aF.ID_EMPLEADO_CORE}&fields[]=${aF.FIRMA}`;
        const asisRes = await fetch(asisUrl, { headers, cache: "no-store" });
        if (asisRes.ok) {
          const asisData = await asisRes.json();
          for (const r of (asisData.records || []) as AirtableRecord[]) {
            const empId = r.fields[aF.ID_EMPLEADO_CORE] as string;
            if (empId) {
              let firmaUrl = "";
              const firmaCifrada = r.fields[aF.FIRMA] as string || "";
              if (firmaCifrada && AES_SECRET) {
                firmaUrl = tryDecryptFirma(firmaCifrada);
              }
              attendeeMap[empId] = {
                nombre: r.fields[aF.NOMBRES] as string || "",
                cedula: r.fields[aF.CEDULA] as string || "",
                firmaUrl,
              };
            }
          }
        }
      }
    }

    // ── 3. Fetch EvalAplicadas by employee IDs, then filter by PROG_CAP in code ──
    // (FIND/ARRAYJOIN with field IDs doesn't work on linked record fields)
    const employeeIds = Object.keys(attendeeMap);
    if (!employeeIds.length) {
      return NextResponse.json({ success: false, message: "No se encontraron asistentes para este evento" }, { status: 404 });
    }

    const evalFields = [
      eF.NOMBRES, eF.CEDULA, eF.CARGO, eF.PLANTILLA,
      eF.PUNTAJE_OBT, eF.PUNTAJE_MAX, eF.PORCENTAJE,
      eF.ESTADO, eF.INTENTO, eF.FECHA, eF.ID_EMPLEADO, eF.PROG_CAP,
    ];
    const evalFieldsQs = evalFields.map(f => `fields[]=${f}`).join("&");

    const evalRecords: AirtableRecord[] = [];
    const progIdsSet = new Set(progIds);
    const batchSize = 20;

    for (let i = 0; i < employeeIds.length; i += batchSize) {
      const batch = employeeIds.slice(i, i + batchSize);
      const orParts = batch.map(id => `{${eF.ID_EMPLEADO}}="${id}"`);
      const formula = encodeURIComponent(`OR(${orParts.join(",")})`);
      let url: string | null = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&${evalFieldsQs}`;

      // Handle Airtable pagination
      while (url) {
        const fetchRes: Response = await fetch(url, { headers, cache: "no-store" });
        if (!fetchRes.ok) break;
        const data = await fetchRes.json();
        const records = (data.records || []) as AirtableRecord[];

        // Filter by PROG_CAP matching this event's programación IDs
        for (const r of records) {
          const rprogIds = (r.fields[eF.PROG_CAP] as string[]) || [];
          if (rprogIds.some(pid => progIdsSet.has(pid))) {
            evalRecords.push(r);
          }
        }

        if (data.offset) {
          url = `${base(evalAplicadasTableId)}?returnFieldsByFieldId=true&filterByFormula=${formula}&${evalFieldsQs}&offset=${data.offset}`;
        } else {
          url = null;
        }
      }
    }

    if (!evalRecords.length) {
      return NextResponse.json({ success: false, message: "No se encontraron evaluaciones para este evento" }, { status: 404 });
    }

    // ── 4. Fetch Plantilla names ────────────────────────
    const plantillaIds = [...new Set(
      evalRecords
        .flatMap(r => (r.fields[eF.PLANTILLA] as string[]) || [])
        .filter(Boolean)
    )];
    const plantillaNames: Record<string, string> = {};
    if (plantillaIds.length) {
      const plFormula = `OR(${plantillaIds.map(id => `RECORD_ID()='${id}'`).join(",")})`;
      const plUrl = `${base(plantillasEvalTableId)}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(plFormula)}&fields[]=${pF.NOMBRE}`;
      const plRes = await fetch(plUrl, { headers, cache: "no-store" });
      if (plRes.ok) {
        const plData = await plRes.json();
        for (const r of (plData.records || []) as AirtableRecord[]) {
          plantillaNames[r.id] = r.fields[pF.NOMBRE] as string || "Evaluación";
        }
      }
    }

    // ── 5. Build structured results ─────────────────────
    const results: EvalResult[] = evalRecords.map(r => {
      const plantillaArr = (r.fields[eF.PLANTILLA] as string[]) || [];
      const plId = plantillaArr[0] || "";
      const empId = r.fields[eF.ID_EMPLEADO] as string || "";
      const attendee = attendeeMap[empId];
      return {
        id: r.id,
        nombres: r.fields[eF.NOMBRES] as string || "",
        cedula: r.fields[eF.CEDULA] as string || "",
        cargo: r.fields[eF.CARGO] as string || "",
        plantillaId: plId,
        plantillaNombre: plantillaNames[plId] || "Evaluación",
        puntajeObtenido: Number(r.fields[eF.PUNTAJE_OBT]) || 0,
        puntajeMaximo: Number(r.fields[eF.PUNTAJE_MAX]) || 0,
        porcentaje: Number(r.fields[eF.PORCENTAJE]) || 0,
        estado: r.fields[eF.ESTADO] as string || "",
        intento: Number(r.fields[eF.INTENTO]) || 1,
        fecha: r.fields[eF.FECHA] as string || "",
        firmaUrl: attendee?.firmaUrl || "",
      };
    });

    // Keep only best attempt per person per plantilla
    const bestByKey: Record<string, EvalResult> = {};
    for (const r of results) {
      const key = `${r.cedula}__${r.plantillaId}`;
      const existing = bestByKey[key];
      if (!existing || r.porcentaje > existing.porcentaje) {
        bestByKey[key] = r;
      }
    }
    const bestResults = Object.values(bestByKey).sort((a, b) => a.nombres.localeCompare(b.nombres));

    // ── 6. Summary stats ────────────────────────────────
    const totalEvaluados = [...new Set(bestResults.map(r => r.cedula))].length;
    const aprobados = bestResults.filter(r => r.estado === "Aprobada").length;
    const noAprobados = bestResults.filter(r => r.estado !== "Aprobada").length;
    const promedioGeneral = bestResults.length > 0
      ? Math.round((bestResults.reduce((s, r) => s + r.porcentaje, 0) / bestResults.length) * 100) / 100
      : 0;

    // ── 7. Generate PDF (Excel-like format per employee) ──
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    // Load logo
    let logoBase64 = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch { /* no logo */ }

    // Format date helper
    const formatFecha = (raw: string) => {
      if (!raw) return "—";
      try {
        const d = new Date(raw + "T12:00:00");
        return d.toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch { return raw; }
    };

    let y = margin;

    // ── Header: Logo + Company ──────────────────────────
    const headerH = 14;
    doc.setFillColor(239, 239, 239);
    doc.setDrawColor(128, 128, 128);
    doc.setLineWidth(0.3);
    // Logo cell
    doc.rect(margin, y, 45, headerH * 2, "FD");
    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", margin + 2, y + 2, 41, headerH * 2 - 4); } catch { /* skip */ }
    }
    // Company name
    doc.rect(margin + 45, y, contentWidth - 45 - 80, headerH, "FD");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC", margin + 45 + (contentWidth - 45 - 80) / 2, y + 9, { align: "center" });
    // Code cell (top right)
    doc.rect(margin + contentWidth - 80, y, 80, headerH, "FD");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("NIT: 901.377.064-8", margin + contentWidth - 40, y + 9, { align: "center" });

    y += headerH;
    // Second header row
    doc.rect(margin + 45, y, contentWidth - 45 - 80, headerH, "FD");
    doc.setFontSize(8);
    doc.text("SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO", margin + 45 + (contentWidth - 45 - 80) / 2, y + 9, { align: "center" });
    doc.rect(margin + contentWidth - 80, y, 80, headerH, "FD");
    doc.setFontSize(7);
    doc.text("INFORME DE RESULTADOS DE EVALUACIONES", margin + contentWidth - 40, y + 9, { align: "center" });
    y += headerH;

    // ── Title bar ───────────────────────────────────────
    doc.setFillColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 10, "FD");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("INFORME DE RESULTADOS DE EVALUACIONES", pageWidth / 2, y + 7, { align: "center" });
    y += 10;

    // ── Event info rows ─────────────────────────────────
    const infoRowH = 8;
    const labelBg: [number, number, number] = [239, 239, 239];

    // Row 1: Evento
    doc.setFillColor(...labelBg);
    doc.rect(margin, y, 35, infoRowH, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("EVENTO:", margin + 2, y + 5.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 35, y, contentWidth - 35, infoRowH, "FD");
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(nombreEvento, contentWidth - 40)[0], margin + 37, y + 5.5);
    y += infoRowH;

    // Row 2: Ciudad | Fecha | Tipo
    const thirdW = contentWidth / 3;
    const labels2 = [
      { lbl: "CIUDAD:", val: ciudad, w: thirdW },
      { lbl: "FECHA:", val: formatFecha(fecha), w: thirdW },
      { lbl: "TIPO:", val: tipo, w: thirdW },
    ];
    let xOff = margin;
    for (const item of labels2) {
      doc.setFillColor(...labelBg);
      doc.rect(xOff, y, 22, infoRowH, "FD");
      doc.setFont("helvetica", "bold");
      doc.text(item.lbl, xOff + 2, y + 5.5);
      doc.setFillColor(255, 255, 255);
      doc.rect(xOff + 22, y, item.w - 22, infoRowH, "FD");
      doc.setFont("helvetica", "normal");
      doc.text(item.val, xOff + 24, y + 5.5);
      xOff += item.w;
    }
    y += infoRowH;

    // Row 3: Conferencista
    doc.setFillColor(...labelBg);
    doc.rect(margin, y, 40, infoRowH, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("CONFERENCISTA:", margin + 2, y + 5.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 40, y, contentWidth - 40, infoRowH, "FD");
    doc.setFont("helvetica", "normal");
    doc.text(conferencista, margin + 42, y + 5.5);
    y += infoRowH;

    // ── Summary box ─────────────────────────────────────
    y += 2;
    const summaryColW = contentWidth / 4;
    doc.setFillColor(240, 246, 255);
    doc.setDrawColor(1, 84, 172);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "FD");

    const summaryData = [
      { label: "Total Evaluados", value: String(totalEvaluados) },
      { label: "Aprobados", value: String(aprobados) },
      { label: "No Aprobados", value: String(noAprobados) },
      { label: "Promedio General", value: `${promedioGeneral}%` },
    ];

    for (let i = 0; i < summaryData.length; i++) {
      const cx = margin + summaryColW * i + summaryColW / 2;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(1, 84, 172);
      doc.text(summaryData[i].value, cx, y + 7, { align: "center" });
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(summaryData[i].label, cx, y + 11.5, { align: "center" });
    }
    y += 18;

    // ── Results table with signatures ───────────────────
    // Columns: ITEM | NOMBRES | C.C. | CARGO | EVALUACIÓN | PUNTAJE | % | ESTADO | FIRMA
    const SIG_ROW_H = 22; // mm height for rows with signature
    const NO_SIG_ROW_H = 8; // mm height for rows without signature
    const SIG_COL_IDX = 8; // index of FIRMA column

    // Build cell image map: rowIndex → dataURL
    const sigImageMap: Record<number, string> = {};
    for (let i = 0; i < bestResults.length; i++) {
      if (bestResults[i].firmaUrl) {
        sigImageMap[i] = bestResults[i].firmaUrl;
      }
    }

    const hasFirmas = Object.keys(sigImageMap).length > 0;
    const rowH = hasFirmas ? SIG_ROW_H : NO_SIG_ROW_H;

    const tableHead = [["ITEM", "NOMBRES Y APELLIDOS", "C.C.", "CARGO", "EVALUACIÓN", "PUNTAJE", "%", "ESTADO", "FIRMA"]];
    const tableBody = bestResults.map((r, i) => [
      String(i + 1),
      r.nombres,
      r.cedula,
      r.cargo || "—",
      r.plantillaNombre,
      `${r.puntajeObtenido.toFixed(1)}/${r.puntajeMaximo.toFixed(1)}`,
      `${r.porcentaje.toFixed(1)}%`,
      r.estado,
      "", // firma placeholder – drawn via didDrawCell
    ]);

    autoTable(doc, {
      startY: y,
      head: tableHead,
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [128, 128, 128],
        lineWidth: 0.2,
        overflow: "linebreak",
        minCellHeight: rowH,
      },
      headStyles: {
        fillColor: [64, 64, 64],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        minCellHeight: 10,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: "auto" },
        2: { halign: "center", cellWidth: 22 },
        3: { cellWidth: 30 },
        4: { cellWidth: "auto" },
        5: { halign: "center", cellWidth: 22 },
        6: { halign: "center", cellWidth: 14 },
        7: { halign: "center", cellWidth: 22 },
        8: { halign: "center", cellWidth: 35 },
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [247, 247, 247],
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 7) {
          const val = data.cell.raw as string;
          if (val === "Aprobada") {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "No Aprobada") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawCell: (data) => {
        // Draw signature images in the FIRMA column
        if (data.section === "body" && data.column.index === SIG_COL_IDX) {
          const imgUrl = sigImageMap[data.row.index];
          if (imgUrl) {
            try {
              const ext = imgUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
              const b64 = imgUrl.includes(",") ? imgUrl.split(",")[1] : imgUrl;
              const imgW = data.cell.width - 4;
              const imgH = data.cell.height - 4;
              doc.addImage(b64, ext, data.cell.x + 2, data.cell.y + 2, imgW, imgH, undefined, "FAST");
            } catch { /* skip image */ }
          }
        }
      },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY || y + 50;
    y += 8;

    // ── Per-evaluation breakdown (if multiple plantillas) ──
    const uniquePlantillas = [...new Set(bestResults.map(r => r.plantillaId))];
    if (uniquePlantillas.length > 1) {
      for (const plId of uniquePlantillas) {
        const plResults = bestResults.filter(r => r.plantillaId === plId);
        const plName = plantillaNames[plId] || "Evaluación";
        const plAprobados = plResults.filter(r => r.estado === "Aprobada").length;
        const plProm = plResults.length > 0
          ? Math.round((plResults.reduce((s, r) => s + r.porcentaje, 0) / plResults.length) * 100) / 100
          : 0;

        if (y > pageHeight - 40) {
          doc.addPage();
          y = margin;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(1, 84, 172);
        doc.text(`${plName}`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(7.5);
        doc.text(`  ${plAprobados}/${plResults.length} aprobados · Promedio: ${plProm}%`, margin + doc.getTextWidth(plName) + 2, y);
        y += 5;

        const subHead = [["#", "Nombre", "C.C.", "Cargo", "Puntaje", "%", "Estado"]];
        const subBody = plResults.map((r, i) => [
          String(i + 1),
          r.nombres,
          r.cedula,
          r.cargo || "—",
          `${r.puntajeObtenido.toFixed(2)}/${r.puntajeMaximo.toFixed(2)}`,
          `${r.porcentaje.toFixed(2)}%`,
          r.estado,
        ]);

        autoTable(doc, {
          startY: y,
          head: subHead,
          body: subBody,
          theme: "grid",
          styles: {
            fontSize: 7,
            cellPadding: 1.5,
            lineColor: [128, 128, 128],
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: [100, 116, 139],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7,
            halign: "center",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { cellWidth: "auto" },
            2: { halign: "center", cellWidth: 22 },
            3: { cellWidth: 30 },
            4: { halign: "center", cellWidth: 24 },
            5: { halign: "center", cellWidth: 16 },
            6: { halign: "center", cellWidth: 22 },
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 6) {
              const val = data.cell.raw as string;
              if (val === "Aprobada") {
                data.cell.styles.textColor = [22, 163, 74];
                data.cell.styles.fontStyle = "bold";
              } else if (val === "No Aprobada") {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
          margin: { left: margin, right: margin },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY || y + 30;
        y += 8;
      }
    }

    // ── Conferencista signature section ──────────────────
    const sigSectionH = 35;
    if (y + sigSectionH > pageHeight - 15) {
      doc.addPage();
      y = margin;
    }

    y += 4;
    const halfW = (contentWidth - 10) / 2;

    // Left box: Conferencista name
    doc.setFillColor(239, 239, 239);
    doc.setDrawColor(128, 128, 128);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, 50, 8, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("CONFERENCISTA:", margin + 2, y + 5.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 50, y, halfW - 50, 8, "FD");
    doc.setFont("helvetica", "normal");
    doc.text(conferencista, margin + 52, y + 5.5);

    // Right box: Conferencista firma
    const firmaBoxX = margin + halfW + 10;
    doc.setFillColor(239, 239, 239);
    doc.rect(firmaBoxX, y, 55, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("FIRMA DEL CONFERENCISTA:", firmaBoxX + 2, y + 5.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(firmaBoxX + 55, y, halfW - 55, 8 + 20, "FD");

    y += 8;

    // Signature image area below
    doc.setFillColor(250, 251, 254);
    doc.rect(margin, y, halfW, 20, "FD");
    // Empty space below name (reserved)

    if (firmaConferencistaUrl) {
      try {
        const ext = firmaConferencistaUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        const b64 = firmaConferencistaUrl.includes(",") ? firmaConferencistaUrl.split(",")[1] : firmaConferencistaUrl;
        doc.addImage(b64, ext, firmaBoxX + 57, y, halfW - 60, 18, undefined, "FAST");
      } catch { /* skip image */ }
    }

    // ── Footer on all pages ─────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      const ph = doc.internal.pageSize.getHeight();
      doc.text(
        `Sirius SG-SST · Informe de Evaluaciones · Generado el ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" })}`,
        pageWidth / 2,
        ph - 8,
        { align: "center" }
      );
      doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, ph - 8, { align: "right" });
    }

    // ── Return PDF ──────────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Evaluaciones_${fecha || "informe"}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[evaluaciones-pdf] Error:", err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Error al generar PDF" },
      { status: 500 }
    );
  }
}
