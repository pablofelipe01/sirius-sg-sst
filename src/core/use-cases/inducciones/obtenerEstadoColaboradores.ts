// ══════════════════════════════════════════════════════════
// Use Case: Obtener Estado de Colaboradores
// Calcula el semáforo de estado de inducción para todos
// ══════════════════════════════════════════════════════════

import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";
import { induccionesModuleConfig } from "@/infrastructure/config/airtableInducciones";
import type { EstadoColaborador, RegistroInduccion } from "@/shared/types/inducciones";
import { getTodayColombia } from "@/shared/utils";

export interface Colaborador {
  idEmpleadoCore: string;
  nombreCompleto: string;
  numeroDocumento: string;
  cargo: string;
}

function parseFechaCalendario(fecha: string): Date {
  // Interpretar fechas YYYY-MM-DD como fecha de calendario (mediodia) evita desfases por UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return new Date(`${fecha}T12:00:00`);
  }

  return new Date(fecha);
}

export async function obtenerEstadoColaboradores(
  colaboradores: Colaborador[]
): Promise<EstadoColaborador[]> {
  const estados: EstadoColaborador[] = [];

  // Obtener todas las inducciones de una vez
  const todasInducciones = await induccionesRepository.listarRegistros();

  // Agrupar inducciones por empleado (la más reciente de cada uno)
  const induccionesPorEmpleado = new Map<string, RegistroInduccion>();

  for (const induccion of todasInducciones) {
    const existente = induccionesPorEmpleado.get(induccion.idEmpleadoCore);

    if (!existente || parseFechaCalendario(induccion.fechaRealizacion) > parseFechaCalendario(existente.fechaRealizacion)) {
      induccionesPorEmpleado.set(induccion.idEmpleadoCore, induccion);
    }
  }

  // Calcular estado para cada colaborador
  const hoy = parseFechaCalendario(getTodayColombia());
  const diasAlerta = induccionesModuleConfig.alertaDiasAnticipacion;

  for (const colaborador of colaboradores) {
    const ultimaInduccion = induccionesPorEmpleado.get(colaborador.idEmpleadoCore);

    if (!ultimaInduccion) {
      // Sin inducción
      estados.push({
        idEmpleadoCore: colaborador.idEmpleadoCore,
        nombreCompleto: colaborador.nombreCompleto,
        numeroDocumento: colaborador.numeroDocumento,
        cargo: colaborador.cargo,
        tieneInduccion: false,
        ultimaInduccion: null,
        estadoSemaforo: "SIN_INDUCCION",
        diasParaVencimiento: null,
        alertaActiva: false,
      });
      continue;
    }

    // Calcular días para vencimiento
    const fechaVencimiento = parseFechaCalendario(ultimaInduccion.fechaVencimiento);
    const diffTime = fechaVencimiento.getTime() - hoy.getTime();
    const diasParaVencimiento = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Determinar semáforo
    let estadoSemaforo: "AL_DIA" | "POR_VENCER" | "VENCIDA" | "SIN_INDUCCION";
    let alertaActiva = false;

    if (diasParaVencimiento < 0) {
      estadoSemaforo = "VENCIDA";
      alertaActiva = true;
    } else if (diasParaVencimiento <= diasAlerta) {
      estadoSemaforo = "POR_VENCER";
      alertaActiva = true;
    } else {
      estadoSemaforo = "AL_DIA";
    }

    estados.push({
      idEmpleadoCore: colaborador.idEmpleadoCore,
      nombreCompleto: colaborador.nombreCompleto,
      numeroDocumento: colaborador.numeroDocumento,
      cargo: colaborador.cargo,
      tieneInduccion: true,
      ultimaInduccion,
      estadoSemaforo,
      diasParaVencimiento,
      alertaActiva,
    });
  }

  return estados;
}
