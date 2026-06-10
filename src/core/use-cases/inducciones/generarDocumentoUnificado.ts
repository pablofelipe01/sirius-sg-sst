// ══════════════════════════════════════════════════════════
// Use Case: Generar Documento Unificado PDF
// Combina en un solo PDF:
//   Página 1     → Constancia de inducción/reinducción
//   Página 2..N  → Evaluación con respuestas del usuario y calificación
//   Última pág.  → Certificado con estilo acta COPASST y firmas
// ══════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { decryptAES } from "@/lib/firmaCrypto";
import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";
import {
  extractS3KeyFromUrl,
  readJsonFromS3,
  uploadToS3,
} from "@/infrastructure/config/awsS3";
import { induccionesModuleConfig } from "@/infrastructure/config/airtableInducciones";
import type { RegistroInduccion } from "@/shared/types/inducciones";

// ── Tipos de entrada ────────────────────────────────────────

export interface ConstanciaInput {
  fechaRealizacion: string;
  lugarRealizacion: string;
  horaInicio: string;
  horaFin: string;
  responsableSST: string;
  observaciones?: string;
  temas: Record<string, boolean>;
}

export interface RespuestaDetalleInput {
  orden: number;
  pregunta: string;
  opciones: string[];
  respuestaUsuario: string;
  respuestaCorrecta: string;
  esCorrecta: boolean;
  puntajeAsignado: number;
  puntajeObtenido: number;
}

export interface EvaluacionInput {
  puntaje: number;
  puntajeObtenido: number;
  puntajeMaximo: number;
  aprobada: boolean;
  detalle: RespuestaDetalleInput[];
}

interface DocumentoUnificadoSnapshot {
  constancia: ConstanciaInput;
  evaluacion: EvaluacionInput | null;
  firmaEmpleadoDataUrl: string | null;
  createdAt: string;
}

type DocAT = jsPDF & { lastAutoTable: { finalY: number } };

// ── Etiquetas legibles de los temas de la constancia ────────
const TEMAS_SECCIONES: Array<{ titulo: string; items: Array<[string, string]> }> = [
  {
    titulo: "Administrativo",
    items: [
      ["responsabilidadEmpleado", "Responsabilidad del empleado"],
      ["reglamentoInterno", "Reglamento interno de trabajo"],
      ["afiliacionSeguridad", "Afiliación a seguridad social"],
      ["protocoloActividades", "Protocolo de actividades"],
      ["pqrs", "PQRS"],
      ["deberesDerechos", "Deberes y derechos"],
    ],
  },
  {
    titulo: "Seguridad y Salud en el Trabajo",
    items: [
      ["reglamentoHigiene", "Reglamento de higiene y seguridad"],
      ["descripcionSGSST", "Descripción del SG-SST"],
      ["epp", "Elementos de protección personal (EPP)"],
      ["politicasObjetivos", "Políticas y objetivos"],
      ["politicaNoAlcohol", "Política no alcohol, tabaco y drogas"],
      ["politicaVial", "Política de seguridad vial"],
      ["politicaAmbiental", "Política ambiental"],
      ["politicaAcoso", "Política de acoso laboral"],
      ["politicaEPP", "Política de EPP"],
      ["matrizIPVRDC", "Matriz IPVRDC"],
      ["identificacionRiesgos", "Identificación de riesgos"],
      ["copasst", "COPASST"],
      ["cocolab", "Comité de convivencia laboral"],
      ["definicionAcoso", "Definición de acoso laboral"],
      ["riesgosHerramientas", "Riesgos de herramientas"],
      ["planEmergencia", "Plan de emergencia"],
      ["brigadas", "Brigadas de emergencia"],
      ["procedimientoAccidente", "Procedimiento ante accidente"],
      ["reporteActos", "Reporte de actos y condiciones inseguras"],
      ["procedimientoEmergencia", "Procedimiento de emergencia"],
    ],
  },
  {
    titulo: "Medio Ambiente",
    items: [
      ["aspectosAmbientales", "Aspectos ambientales"],
      ["controlDerrames", "Control de derrames"],
      ["reporteIncendios", "Reporte de incendios"],
    ],
  },
];

const C = {
  VERDE: [0, 182, 2] as [number, number, number],
  AZUL: [1, 84, 172] as [number, number, number],
  NEGRO: [26, 26, 51] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  GRIS_CLARO: [242, 242, 242] as [number, number, number],
  GRIS_TEXTO: [100, 100, 115] as [number, number, number],
  ROJO: [200, 50, 50] as [number, number, number],
  VERDE_OK: [30, 140, 60] as [number, number, number],
  NARANJA: [190, 110, 0] as [number, number, number],
} as const;

const EMPRESA = "SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC.";
const NIT = "901.377.064-8";
const TELEFONO = "320 9568566";
const CORREO = "adm@siriusregenerative.com";
const PLANTACION = "Barranca de Upía, km 7 vía Cabuyaro, Meta, Colombia";

function formatearFecha(fecha: string): string {
  try {
    return new Date(fecha).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Bogota",
    });
  } catch {
    return fecha;
  }
}

function loadLogoBase64(): string | null {
  try {
    const p = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(p)) {
      return fs.readFileSync(p).toString("base64");
    }
  } catch {
    // continuar sin logo
  }
  return null;
}

function drawLogoFallback(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setFillColor(...C.VERDE);
  doc.roundedRect(x + 3, y + 3, w - 6, h - 6, 2, 2, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("SIRIUS", x + w / 2, y + h / 2 + 1.5, { align: "center" });
}

function renderEncabezado(doc: jsPDF, y: number, M: number, CW: number, tituloFormato: string, logo64: string | null): number {
  const H = 33;
  const cL = 40;
  const cC = 54;
  const cM = CW - cL - cC;

  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.4);
  doc.rect(M, y, CW, H);
  doc.line(M + cL, y, M + cL, y + H);
  doc.line(M + cL + cM, y, M + cL + cM, y + H);

  if (logo64) {
    try {
      doc.addImage(`data:image/png;base64,${logo64}`, "PNG", M + 4, y + 4, cL - 8, H - 8);
    } catch {
      drawLogoFallback(doc, M, y, cL, H);
    }
  } else {
    drawLogoFallback(doc, M, y, cL, H);
  }

  const cx = M + cL;
  doc.setTextColor(...C.NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(EMPRESA, cx + cM / 2, y + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`NIT. ${NIT}`, cx + cM / 2, y + 13.5, { align: "center" });

  doc.setDrawColor(...C.GRIS_TEXTO);
  doc.setLineWidth(0.15);
  doc.line(cx + 5, y + 17, cx + cM - 5, y + 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.AZUL);
  const fmtLines = doc.splitTextToSize(tituloFormato, cM - 8) as string[];
  doc.text(fmtLines, cx + cM / 2, y + 20 + (fmtLines.length === 1 ? 4 : 2), {
    align: "center",
  });

  const ccx = M + cL + cM;
  const rH = H / 3;
  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.3);
  doc.line(ccx, y + rH, ccx + cC, y + rH);
  doc.line(ccx, y + 2 * rH, ccx + cC, y + 2 * rH);
  doc.setTextColor(...C.NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("CODIGO: FT-SST-025", ccx + cC / 2, y + rH / 2 + 1.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("VERSION: 1", ccx + cC / 2, y + rH + rH / 2 + 1.5, { align: "center" });
  doc.text("FECHA EDICION: 2026-01-01", ccx + cC / 2, y + 2 * rH + rH / 2 + 1.5, { align: "center" });

  return y + H + 3;
}

function renderTituloBanda(doc: jsPDF, y: number, M: number, CW: number, titulo: string): number {
  doc.setFillColor(...C.NEGRO);
  doc.rect(M, y, CW, 9.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(titulo, M + CW / 2, y + 6.6, { align: "center" });
  return y + 14;
}

function renderPiePagina(doc: jsPDF, M: number, CW: number, PW: number, PH: number, pagina: number, total: number): void {
  const y0 = PH - 22;
  doc.setDrawColor(...C.VERDE);
  doc.setLineWidth(0.8);
  doc.line(M, y0, M + CW, y0);

  const footerLine1 =
    `Sirius Regenerative Solutions SAS Zomac / Nit: ${NIT} / Teléfono: ${TELEFONO} / Correo: ${CORREO}`;
  const footerLine2 = `Plantación: ${PLANTACION}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.NEGRO);
  doc.text(footerLine1, M + CW / 2, y0 + 4.5, { align: "center" });
  doc.text(footerLine2, M + CW / 2, y0 + 9, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.GRIS_TEXTO);
  doc.text(`Pág. ${pagina} / ${total}`, PW - M, y0 + 9, { align: "right" });
}

function extraerFirmaDataUrl(valor?: string | null): string | null {
  if (!valor) return null;
  if (valor.startsWith("data:image/")) return valor;

  try {
    const parsed = JSON.parse(decryptAES(valor)) as { signature?: string };
    return parsed.signature && parsed.signature.startsWith("data:image/") ? parsed.signature : null;
  } catch {
    return null;
  }
}

function drawSignatureBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  titulo: string,
  nombre: string,
  linea2: string,
  signatureDataUrl: string | null,
  pendienteTexto: string
): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.AZUL);
  doc.text(titulo, x, y);

  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.3);
  doc.rect(x, y + 4, w, h);

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", x + 3, y + 7, w - 6, h - 26);
    } catch {
      // Ignorar error de imagen inválida
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.GRIS_TEXTO);
    doc.text(pendienteTexto, x + w / 2, y + 18, { align: "center" });
  }

  doc.setDrawColor(...C.GRIS_TEXTO);
  doc.setLineWidth(0.4);
  doc.line(x + 8, y + h - 8, x + w - 8, y + h - 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.NEGRO);
  doc.text(nombre, x + w / 2, y + h - 4, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(linea2, x + w / 2, y + h - 0.5, { align: "center" });
}

// ══════════════════════════════════════════════════════════
// Página 1: Constancia
// ══════════════════════════════════════════════════════════
function dibujarConstancia(pdf: jsPDF, registro: RegistroInduccion, constancia: ConstanciaInput, logo64: string | null): void {
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 12;
  const CW = PW - M * 2;

  let y = M;
  y = renderEncabezado(pdf, y, M, CW, "FORMATO CONSTANCIA DE INDUCCIÓN / REINDUCCIÓN", logo64);
  y = renderTituloBanda(pdf, y, M, CW, "CONSTANCIA DE INDUCCIÓN Y/O REINDUCCIÓN");

  const tipoTexto = registro.tipo === "Induccion" ? "Inducción" : "Reinducción";

  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: C.NEGRO,
      lineWidth: 0.3,
      textColor: C.NEGRO,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: CW * 0.22, fillColor: C.GRIS_CLARO },
      1: { fontStyle: "normal", cellWidth: CW * 0.28 },
      2: { fontStyle: "bold", cellWidth: CW * 0.22, fillColor: C.GRIS_CLARO },
      3: { fontStyle: "normal", cellWidth: CW * 0.28 },
    },
    body: [
      ["Colaborador:", registro.nombreEmpleado, "Documento:", registro.numeroDocumento],
      ["Cargo:", registro.cargo, "Tipo:", tipoTexto],
      ["Fecha realización:", formatearFecha(constancia.fechaRealizacion || registro.fechaRealizacion), "Lugar:", constancia.lugarRealizacion || "—"],
      ["Hora inicio:", constancia.horaInicio || "—", "Hora fin:", constancia.horaFin || "—"],
      ["Responsable SST:", constancia.responsableSST || registro.responsableSST, "ID Inducción:", registro.idInduccion],
    ],
  });

  y = (pdf as DocAT).lastAutoTable.finalY + 6;

  y = renderTituloBanda(pdf, y, M, CW, "TEMAS TRATADOS DURANTE LA INDUCCIÓN/REINDUCCIÓN");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.2);
  pdf.setTextColor(...C.NEGRO);

  for (const seccion of TEMAS_SECCIONES) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...C.AZUL);
    pdf.text(seccion.titulo, M, y);
    y += 4.5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.2);
    pdf.setTextColor(...C.NEGRO);

    const mitad = Math.ceil(seccion.items.length / 2);
    const colW = CW / 2;

    seccion.items.forEach(([key, label], idx) => {
      const col = idx < mitad ? 0 : 1;
      const row = idx < mitad ? idx : idx - mitad;
      const x = M + col * colW;
      const yy = y + row * 4.5;
      const marcado = constancia.temas?.[key] !== false;
      pdf.text(`${marcado ? "[X]" : "[ ]"} ${label}`, x, yy);
    });

    y += mitad * 4.5 + 3;
  }

  if (constancia.observaciones?.trim()) {
    y = Math.min(y + 2, PH - 45);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...C.AZUL);
    pdf.text("Observaciones:", M, y);
    y += 4;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.3);
    pdf.setTextColor(...C.NEGRO);
    const obs = pdf.splitTextToSize(constancia.observaciones.trim(), CW);
    pdf.text(obs, M, y);
  }
}

// ══════════════════════════════════════════════════════════
// Página 2..N: Evaluación con respuestas
// ══════════════════════════════════════════════════════════
function dibujarEvaluacion(pdf: jsPDF, evaluacion: EvaluacionInput, logo64: string | null): void {
  pdf.addPage("letter", "portrait");

  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 12;
  const CW = PW - M * 2;
  const FOOTER_H = 24;

  let y = M;
  y = renderEncabezado(pdf, y, M, CW, "FORMATO RESULTADO EVALUACIÓN DE INDUCCIÓN", logo64);
  y = renderTituloBanda(pdf, y, M, CW, "EVALUACIÓN: RESPUESTAS DEL COLABORADOR");

  const aprobada = evaluacion.aprobada;
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      lineColor: aprobada ? C.VERDE_OK : C.ROJO,
      lineWidth: 0.4,
      textColor: C.NEGRO,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: CW * 0.35, fillColor: C.GRIS_CLARO },
      1: { fontStyle: "normal", cellWidth: CW * 0.65 },
    },
    body: [
      ["Estado:", aprobada ? "Aprobada" : "No aprobada"],
      ["Calificación:", `${evaluacion.puntaje}%`],
      ["Puntaje obtenido:", `${evaluacion.puntajeObtenido}/${evaluacion.puntajeMaximo}`],
    ],
  });

  y = (pdf as DocAT).lastAutoTable.finalY + 6;

  const detalleOrdenado = [...evaluacion.detalle].sort((a, b) => a.orden - b.orden);

  for (let i = 0; i < detalleOrdenado.length; i++) {
    const item = detalleOrdenado[i];

    const preguntaLines = pdf.splitTextToSize(`${i + 1}. ${item.pregunta}`, CW - 2) as string[];
    const respLines = pdf.splitTextToSize(`Tu respuesta: ${item.respuestaUsuario}`, CW - 8) as string[];
    const correctaLines = item.esCorrecta
      ? []
      : (pdf.splitTextToSize(`Respuesta correcta: ${item.respuestaCorrecta}`, CW - 8) as string[]);

    const needed = preguntaLines.length * 4.2 + respLines.length * 3.8 + correctaLines.length * 3.8 + 10;
    if (y + needed > PH - FOOTER_H - 4) {
      pdf.addPage("letter", "portrait");
      y = 16;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.8);
    pdf.setTextColor(...C.NEGRO);
    pdf.text(preguntaLines, M, y);
    y += preguntaLines.length * 4.2;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.3);
    pdf.setTextColor(...(item.esCorrecta ? C.VERDE_OK : C.ROJO));
    pdf.text(item.esCorrecta ? "[Correcta]" : "[Incorrecta]", M, y);

    pdf.setTextColor(...C.NEGRO);
    pdf.text(respLines, M + 18, y);
    y += respLines.length * 3.8;

    if (!item.esCorrecta) {
      pdf.setTextColor(...C.VERDE_OK);
      pdf.text(correctaLines, M + 6, y);
      y += correctaLines.length * 3.8;
    }

    y += 3;
  }
}

// ══════════════════════════════════════════════════════════
// Última página: Certificado estilo acta COPASST + firmas
// ══════════════════════════════════════════════════════════
function dibujarCertificado(
  pdf: jsPDF,
  registro: RegistroInduccion,
  firmaEmpleadoDataUrl: string | null,
  firmaResponsableDataUrl: string | null,
  logo64: string | null
): void {
  pdf.addPage("letter", "portrait");

  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 12;
  const CW = PW - M * 2;

  let y = M;
  y = renderEncabezado(pdf, y, M, CW, "FORMATO CERTIFICADO DE INDUCCIÓN Y/O REINDUCCIÓN", logo64);
  y = renderTituloBanda(pdf, y, M, CW, "CERTIFICADO DE INDUCCIÓN Y/O REINDUCCIÓN");

  const tipoTexto = registro.tipo === "Induccion" ? "inducción" : "reinducción";

  const textoPrincipal =
    `Se certifica que ${registro.nombreEmpleado.toUpperCase()}, identificado(a) con documento ` +
    `${registro.numeroDocumento}, completó satisfactoriamente la ${tipoTexto} en Seguridad y Salud ` +
    `en el Trabajo (SG-SST), en el cargo ${registro.cargo}.`;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...C.NEGRO);
  const bodyLines = pdf.splitTextToSize(textoPrincipal, CW);
  pdf.text(bodyLines, M, y);
  y += bodyLines.length * 5 + 3;

  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "plain",
    styles: {
      fontSize: 8.8,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: C.NEGRO,
      lineWidth: 0.3,
      textColor: C.NEGRO,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: CW * 0.28, fillColor: C.GRIS_CLARO },
      1: { fontStyle: "normal", cellWidth: CW * 0.22 },
      2: { fontStyle: "bold", cellWidth: CW * 0.28, fillColor: C.GRIS_CLARO },
      3: { fontStyle: "normal", cellWidth: CW * 0.22 },
    },
    body: [
      ["ID Inducción:", registro.idInduccion, "Tipo:", registro.tipo],
      ["Fecha realización:", formatearFecha(registro.fechaRealizacion), "Fecha vencimiento:", formatearFecha(registro.fechaVencimiento)],
      ["Responsable SST:", registro.responsableSST, "Evaluación:", `${registro.puntajeEvaluacion ?? 0}% - ${registro.estadoEvaluacion}`],
    ],
  });

  y = (pdf as DocAT).lastAutoTable.finalY + 8;

  const boxW = (CW - 12) / 2;
  const boxH = 48;

  drawSignatureBox(
    pdf,
    M,
    y,
    boxW,
    boxH,
    "Firma colaborador:",
    registro.nombreEmpleado,
    `CC ${registro.numeroDocumento}`,
    firmaEmpleadoDataUrl,
    "Pendiente de firma"
  );

  drawSignatureBox(
    pdf,
    M + boxW + 12,
    y,
    boxW,
    boxH,
    "Firma responsable SST:",
    registro.responsableSST,
    "Responsable SG-SST",
    firmaResponsableDataUrl,
    "Pendiente firma responsable SST"
  );
}

function aplicarPieCorporativoEnTodasLasPaginas(pdf: jsPDF): void {
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 12;
  const CW = PW - M * 2;
  const totalPaginas = pdf.getNumberOfPages();

  for (let p = 1; p <= totalPaginas; p++) {
    pdf.setPage(p);
    renderPiePagina(pdf, M, CW, PW, PH, p, totalPaginas);
  }
}

/**
 * Key determinística del snapshot por inducción (sin timestamp) para poder
 * recuperarlo en la regeneración aunque el campo no exista en Airtable.
 */
function snapshotS3Key(idInduccion: string): string {
  return `${induccionesModuleConfig.s3PrefixCertificados}/snapshots/${idInduccion}.json`;
}

async function guardarSnapshotDocumento(
  registro: RegistroInduccion,
  snapshot: DocumentoUnificadoSnapshot
): Promise<string> {
  const key = snapshotS3Key(registro.idInduccion);
  const body = Buffer.from(JSON.stringify(snapshot, null, 2), "utf-8");
  const { url } = await uploadToS3(key, body, "application/json");
  return url;
}

// ══════════════════════════════════════════════════════════
// Use Case principal (generación inicial)
// ══════════════════════════════════════════════════════════
export async function generarDocumentoUnificado(
  idInduccion: string,
  constancia: ConstanciaInput,
  evaluacion: EvaluacionInput | null,
  firmaEmpleadoDataUrl?: string | null,
  firmaResponsableSSTDataUrl?: string | null,
  guardarSnapshot: boolean = true
): Promise<{ documentoUrl: string; registro: RegistroInduccion }> {
  const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(idInduccion);

  if (!registro) {
    throw new Error("Inducción no encontrada");
  }

  const logo64 = loadLogoBase64();
  const firmaEmpleadoFinal =
    firmaEmpleadoDataUrl || extraerFirmaDataUrl(registro.firmaUrl) || null;
  const firmaResponsableFinal =
    firmaResponsableSSTDataUrl || extraerFirmaDataUrl(registro.firmaResponsableSST) || null;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  dibujarConstancia(pdf, registro, constancia, logo64);

  if (evaluacion && Array.isArray(evaluacion.detalle) && evaluacion.detalle.length > 0) {
    dibujarEvaluacion(pdf, evaluacion, logo64);
  }

  dibujarCertificado(pdf, registro, firmaEmpleadoFinal, firmaResponsableFinal, logo64);
  aplicarPieCorporativoEnTodasLasPaginas(pdf);

  const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));
  const s3Key = `${induccionesModuleConfig.s3PrefixCertificados}/${registro.idInduccion}-${Date.now()}.pdf`;
  const { url: documentoUrl } = await uploadToS3(s3Key, pdfBuffer, "application/pdf");

  let documentoSnapshotUrl: string | undefined;
  if (guardarSnapshot) {
    documentoSnapshotUrl = await guardarSnapshotDocumento(registro, {
      constancia,
      evaluacion,
      firmaEmpleadoDataUrl: firmaEmpleadoFinal,
      createdAt: new Date().toISOString(),
    });
  }

  const registroActualizado = await induccionesRepository.actualizarRegistro(registro.id!, {
    certificadoUrl: documentoUrl,
    documentoSnapshotUrl,
    fechaExportacion: new Date().toISOString(),
  });

  return { documentoUrl, registro: registroActualizado };
}

// ══════════════════════════════════════════════════════════
// Regeneración (cuando firma responsable SST)
// ══════════════════════════════════════════════════════════
export async function regenerarDocumentoConFirmaResponsable(
  idInduccion: string,
  firmaResponsableSSTDataUrl: string
): Promise<{ documentoUrl: string; registro: RegistroInduccion }> {
  const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(idInduccion);

  if (!registro) {
    throw new Error("Inducción no encontrada");
  }

  // Recupera el snapshot: usa el campo de Airtable si existe; si no, la key determinística por inducción.
  let snapshotKey: string | null = null;

  if (registro.documentoSnapshotUrl) {
    snapshotKey = extractS3KeyFromUrl(registro.documentoSnapshotUrl);
  } else {
    snapshotKey = snapshotS3Key(registro.idInduccion);
  }

  if (!snapshotKey) {
    throw new Error(
      "No se pudo determinar la ubicación del snapshot del documento. El colaborador debe firmar primero."
    );
  }

  let snapshot: DocumentoUnificadoSnapshot | null = null;
  try {
    snapshot = await readJsonFromS3<DocumentoUnificadoSnapshot>(snapshotKey);
  } catch {
    throw new Error(
      "No se encontró el snapshot del documento para regenerar el PDF. El colaborador debe firmar primero."
    );
  }

  if (!snapshot) {
    throw new Error(
      "El snapshot del documento está vacío. El colaborador debe firmar primero."
    );
  }

  return generarDocumentoUnificado(
    idInduccion,
    snapshot.constancia,
    snapshot.evaluacion,
    snapshot.firmaEmpleadoDataUrl,
    firmaResponsableSSTDataUrl,
    false
  );
}
