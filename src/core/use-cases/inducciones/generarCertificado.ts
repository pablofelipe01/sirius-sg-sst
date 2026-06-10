// ══════════════════════════════════════════════════════════
// Use Case: Generar Certificado PDF
// Genera certificado de inducción y lo sube a S3
// ══════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";
import { uploadToS3 } from "@/infrastructure/config/awsS3";
import { induccionesModuleConfig } from "@/infrastructure/config/airtableInducciones";
import type { RegistroInduccion } from "@/shared/types/inducciones";

/**
 * Genera un certificado PDF para una inducción completada
 */
export async function generarCertificado(
  idInduccion: string
): Promise<{ certificadoUrl: string; registro: RegistroInduccion }> {
  // 1. Obtener el registro de inducción
  const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(idInduccion);

  if (!registro) {
    throw new Error("Inducción no encontrada");
  }

  // 2. Validar que la inducción esté completada
  if (registro.estado !== "Completada") {
    throw new Error("Solo se pueden generar certificados para inducciones completadas");
  }

  // 3. Si ya tiene certificado, retornarlo
  if (registro.certificadoUrl) {
    return {
      certificadoUrl: registro.certificadoUrl,
      registro,
    };
  }

  // 4. Crear el PDF
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ── Fondo y borde decorativo ────────────────────────────
  // Borde exterior azul
  pdf.setDrawColor(30, 58, 138); // blue-900
  pdf.setLineWidth(2);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Borde interior dorado
  pdf.setDrawColor(251, 191, 36); // amber-400
  pdf.setLineWidth(0.5);
  pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // ── Logo y Header ───────────────────────────────────────
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 58, 138);
  pdf.text("CERTIFICADO DE INDUCCIÓN", pageWidth / 2, 35, { align: "center" });

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(71, 85, 105); // slate-600
  pdf.text("Sistema de Gestión SG-SST", pageWidth / 2, 43, { align: "center" });

  // Línea decorativa
  pdf.setDrawColor(251, 191, 36);
  pdf.setLineWidth(1);
  pdf.line(80, 48, pageWidth - 80, 48);

  // ── Contenido del certificado ──────────────────────────
  const yStart = 65;
  let yPos = yStart;

  // Texto principal
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(51, 65, 85); // slate-700
  pdf.text("Se certifica que", pageWidth / 2, yPos, { align: "center" });

  yPos += 12;
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42); // slate-900
  pdf.text(registro.nombreEmpleado.toUpperCase(), pageWidth / 2, yPos, { align: "center" });

  yPos += 10;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 116, 139); // slate-500
  pdf.text(`CC: ${registro.numeroDocumento}`, pageWidth / 2, yPos, { align: "center" });

  yPos += 15;
  pdf.setFontSize(13);
  pdf.setTextColor(51, 65, 85);
  const tipoTexto = registro.tipo === "Induccion" ? "inducción" : "reinducción";
  pdf.text(`Ha completado satisfactoriamente la ${tipoTexto} en`, pageWidth / 2, yPos, {
    align: "center",
  });

  yPos += 8;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 58, 138);
  pdf.text("SEGURIDAD Y SALUD EN EL TRABAJO", pageWidth / 2, yPos, { align: "center" });

  // ── Información adicional ──────────────────────────────
  yPos += 20;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(71, 85, 105);

  const infoLeft = 50;
  const infoRight = pageWidth - 50;

  // Columna izquierda
  pdf.setFont("helvetica", "bold");
  pdf.text("Cargo:", infoLeft, yPos);
  pdf.setFont("helvetica", "normal");
  pdf.text(registro.cargo, infoLeft + 20, yPos);

  // Columna derecha
  pdf.setFont("helvetica", "bold");
  pdf.text("Fecha:", infoRight - 60, yPos, { align: "right" });
  pdf.setFont("helvetica", "normal");
  const fecha = new Date(registro.fechaRealizacion).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(fecha, infoRight, yPos, { align: "right" });

  yPos += 8;

  // ID de inducción
  pdf.setFont("helvetica", "bold");
  pdf.text("ID Inducción:", infoLeft, yPos);
  pdf.setFont("helvetica", "normal");
  pdf.text(registro.idInduccion, infoLeft + 30, yPos);

  // Responsable SST
  pdf.setFont("helvetica", "bold");
  pdf.text("Responsable SST:", infoRight - 80, yPos, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.text(registro.responsableSST, infoRight, yPos, { align: "right" });

  // Si tiene evaluación
  if (registro.puntajeEvaluacion !== null && registro.puntajeEvaluacion !== undefined) {
    yPos += 8;
    pdf.setFont("helvetica", "bold");
    pdf.text("Evaluación:", infoLeft, yPos);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${registro.puntajeEvaluacion}% - ${registro.estadoEvaluacion}`, infoLeft + 25, yPos);
  }

  // ── Vigencia ───────────────────────────────────────────
  yPos += 15;
  pdf.setDrawColor(251, 191, 36);
  pdf.setFillColor(254, 252, 232); // amber-50
  pdf.roundedRect(50, yPos - 5, pageWidth - 100, 15, 3, 3, "FD");

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(146, 64, 14); // amber-800
  const fechaVenc = new Date(registro.fechaVencimiento).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(`Vigencia: hasta ${fechaVenc}`, pageWidth / 2, yPos + 3, { align: "center" });

  // ── Footer ─────────────────────────────────────────────
  const footerY = pageHeight - 30;

  // Línea de firma
  pdf.setDrawColor(148, 163, 184); // slate-400
  pdf.setLineWidth(0.5);
  pdf.line(pageWidth / 2 - 40, footerY, pageWidth / 2 + 40, footerY);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(71, 85, 105);
  pdf.text(registro.responsableSST, pageWidth / 2, footerY + 6, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Responsable SST", pageWidth / 2, footerY + 11, { align: "center" });

  // Nota al pie
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    "Este certificado ha sido generado digitalmente por el Sistema de Gestión SG-SST",
    pageWidth / 2,
    pageHeight - 15,
    { align: "center" }
  );

  // ── Marca de agua diagonal ─────────────────────────────
  pdf.setFontSize(60);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 58, 138, 0.05); // Muy transparente
  pdf.text("SIRIUS", pageWidth / 2, pageHeight / 2, {
    align: "center",
    angle: 45,
  });

  // 5. Convertir PDF a buffer
  const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

  // 6. Subir a S3
  const s3Key = `${induccionesModuleConfig.s3PrefixCertificados}/${registro.idInduccion}-${Date.now()}.pdf`;
  const { url: certificadoUrl } = await uploadToS3(s3Key, pdfBuffer, "application/pdf");

  // 7. Actualizar registro con URL del certificado
  const registroActualizado = await induccionesRepository.actualizarRegistro(registro.id!, {
    certificadoUrl,
    fechaExportacion: new Date().toISOString(),
  });

  return {
    certificadoUrl,
    registro: registroActualizado,
  };
}
