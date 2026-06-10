// ══════════════════════════════════════════════════════════
// Repositorio Airtable — Tabla Nómina (Sirius Nómina Core)
// SOLO LECTURA - Para obtener colaboradores activos
// ══════════════════════════════════════════════════════════

export interface EmpleadoNomina {
  idEmpleadoCore: string; // Campo ID Empleado (SIRIUS-PER-XXXX) del empleado en Personal
  nombreCompleto: string;
  numeroDocumento: string;
  cargo: string;
  estado: string;
}

export class AirtableNominaRepository {
  private baseId: string;
  private nominaTableId: string;
  private personalTableId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    // La base es la misma para Nómina y Personal
    this.baseId = process.env.AIRTABLE_NOMINA_CORE_BASE_ID || process.env.AIRTABLE_BASE_ID!;
    this.nominaTableId = process.env.AIRTABLE_NOMINA_TABLE_ID!; // Tabla Nómina
    this.personalTableId = process.env.AIRTABLE_PERSONAL_TABLE_ID!; // Tabla Personal
    this.apiToken = process.env.AIRTABLE_API_TOKEN!;
    this.baseUrl = "https://api.airtable.com/v0";
  }

  /**
   * Listar todos los empleados activos de la tabla Nómina
   * Solo incluye empleados con estado "Activo"
   */
  async listarEmpleadosActivos(): Promise<EmpleadoNomina[]> {
    const empleados: EmpleadoNomina[] = [];
    let offset: string | undefined;

    const filterFormula = `{Estado} = 'Activo'`; // Estado = Activo

    console.log("[NominaRepo] Consultando tabla Nómina...");
    console.log("[NominaRepo] Base ID:", this.baseId);
    console.log("[NominaRepo] Tabla ID:", this.nominaTableId);

    do {
      const url = new URL(`${this.baseUrl}/${this.baseId}/${this.nominaTableId}`);
      url.searchParams.set("filterByFormula", filterFormula);
      url.searchParams.set("pageSize", "100");
      if (offset) {
        url.searchParams.set("offset", offset);
      }

      console.log("[NominaRepo] URL:", url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[NominaRepo] Error HTTP:", response.status, error);
        throw new Error(`Error obteniendo empleados de Nómina: ${error}`);
      }

      const data = await response.json();
      console.log("[NominaRepo] Registros obtenidos:", data.records.length);

      // Procesar cada registro
      for (const record of data.records) {
        const fields = record.fields;

        // ID_Empleado es un array de record IDs enlazados a Personal
        // Usar nombre del campo en lugar de ID
        const empleadoLinks = fields["ID_Empleado"] as string[] | undefined;
        if (!empleadoLinks || empleadoLinks.length === 0) {
          console.log("[NominaRepo] Registro sin empleado vinculado:", record.id);
          continue;
        }

        // Nombre completo viene del lookup
        const nombreCompleto = fields["Nombre completo (from ID_Empleado)"] as string[] | undefined;
        if (!nombreCompleto || nombreCompleto.length === 0) {
          console.log("[NominaRepo] Registro sin nombre:", record.id);
          continue;
        }

        const estado = fields["Estado"] as string;

        empleados.push({
          idEmpleadoCore: empleadoLinks[0],
          nombreCompleto: nombreCompleto[0],
          numeroDocumento: "",
          cargo: "",
          estado: estado || "Activo",
        });
      }

      offset = data.offset;
    } while (offset);

    console.log("[NominaRepo] Total empleados pre-completar:", empleados.length);

    if (empleados.length === 0) {
      console.warn("[NominaRepo] No se encontraron empleados activos en Nómina");
      return [];
    }

    // Completar datos desde Personal
    const empleadosCompletos = await this.completarDatosEmpleados(empleados);
    console.log("[NominaRepo] Total empleados completos:", empleadosCompletos.length);

    return empleadosCompletos;
  }

  /**
   * Completa los datos de documento y cargo consultando la tabla Personal
   */
  private async completarDatosEmpleados(
    empleados: EmpleadoNomina[]
  ): Promise<EmpleadoNomina[]> {
    const empleadosCompletos: EmpleadoNomina[] = [];

    console.log("[NominaRepo] Completando datos desde Personal...");

    // Procesar en lotes de 10
    for (let i = 0; i < empleados.length; i += 10) {
      const lote = empleados.slice(i, i + 10);
      const recordIds = lote.map((e) => e.idEmpleadoCore);

      // Construir filterByFormula con OR para múltiples IDs
      const filterFormula = `OR(${recordIds.map((id) => `RECORD_ID() = '${id}'`).join(", ")})`;

      const url = new URL(`${this.baseUrl}/${this.baseId}/${this.personalTableId}`);
      url.searchParams.set("filterByFormula", filterFormula);

      console.log("[NominaRepo] Consultando Personal lote", Math.floor(i / 10) + 1);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("[NominaRepo] Error consultando Personal:", await response.text());
        continue;
      }

      const data = await response.json();
      console.log("[NominaRepo] Registros Personal obtenidos:", data.records.length);

      const personalMap = new Map<string, { idEmpleado: string; documento: string; cargo: string; estadoActividad: string }>(
        data.records.map((r: any) => {
          // ID Empleado es el código único (SIRIUS-PER-XXXX). Fallback al record ID si está vacío.
          const idEmpleado = (r.fields["ID Empleado"] as string) || r.id;

          // Documento es un string directo
          const documento = r.fields["Numero Documento"] as string || "";

          // Cargo viene del lookup "Rol (from Rol)" que es un array de strings
          const rolesLookup = r.fields["Rol (from Rol)"] as string[] | undefined;
          const cargo = rolesLookup && rolesLookup.length > 0 ? rolesLookup[0] : "Sin cargo";

          // Estado de actividad en Personal
          const estadoActividad = r.fields["Estado de actividad"] as string;

          return [
            r.id,
            { idEmpleado, documento, cargo, estadoActividad },
          ] as [string, { idEmpleado: string; documento: string; cargo: string; estadoActividad: string }];
        })
      );

      // Completar datos y filtrar por estado de Personal
      for (const emp of lote) {
        const datos = personalMap.get(emp.idEmpleadoCore);
        if (datos) {
          // FILTRO CRÍTICO: Solo incluir si el estado de actividad es "Activo"
          if (datos.estadoActividad !== "Activo") {
            console.log("[NominaRepo] Empleado filtrado (no activo):", emp.nombreCompleto, "- Estado:", datos.estadoActividad);
            continue; // Saltar este empleado
          }

          empleadosCompletos.push({
            ...emp,
            idEmpleadoCore: datos.idEmpleado, // Usar el campo ID Empleado en lugar del record ID
            numeroDocumento: datos.documento || "",
            cargo: datos.cargo || "Sin cargo",
          });
        } else {
          console.warn("[NominaRepo] No se encontró en Personal:", emp.idEmpleadoCore);
        }
      }
    }

    return empleadosCompletos;
  }

  /**
   * Obtener datos de un empleado específico por su ID Empleado (SIRIUS-PER-XXXX)
   */
  async obtenerEmpleadoPorId(idEmpleado: string): Promise<EmpleadoNomina | null> {
    // Compatibilidad: si llega un record ID antiguo (rec...), buscar directamente por record ID
    if (idEmpleado.startsWith("rec")) {
      return this.obtenerEmpleadoPorRecordId(idEmpleado);
    }

    // Buscar por el campo ID Empleado (SIRIUS-PER-XXXX)
    const filterFormula = encodeURIComponent(`{ID Empleado} = '${idEmpleado}'`);
    const url = `${this.baseUrl}/${this.baseId}/${this.personalTableId}?filterByFormula=${filterFormula}`;

    console.log("[NominaRepo] Obteniendo empleado por ID Empleado:", idEmpleado);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[NominaRepo] Error obteniendo empleado:", await response.text());
      return null;
    }

    const data = await response.json();
    
    if (!data.records || data.records.length === 0) {
      console.warn("[NominaRepo] Empleado no encontrado:", idEmpleado);
      return null;
    }

    const record = data.records[0];
    const fields = record.fields;

    const idEmpleadoField = (fields["ID Empleado"] as string) || record.id;
    const nombreCompleto = fields["Nombre completo"] as string;
    const numeroDocumento = fields["Numero Documento"] as string || "";
    const rolesLookup = fields["Rol (from Rol)"] as string[] | undefined;
    const cargo = rolesLookup && rolesLookup.length > 0 ? rolesLookup[0] : "Sin cargo";
    const estadoActividad = fields["Estado de actividad"] as string;

    // FILTRO: Solo retornar si está activo
    if (estadoActividad !== "Activo") {
      console.log("[NominaRepo] Empleado no activo:", nombreCompleto, "- Estado:", estadoActividad);
      return null;
    }

    return {
      idEmpleadoCore: idEmpleadoField, // Usar el campo ID Empleado (SIRIUS-PER-XXXX)
      nombreCompleto,
      numeroDocumento,
      cargo,
      estado: estadoActividad,
    };
  }

  /**
   * Obtener datos de un empleado por su Record ID de Airtable (compatibilidad)
   */
  private async obtenerEmpleadoPorRecordId(recordId: string): Promise<EmpleadoNomina | null> {
    const url = `${this.baseUrl}/${this.baseId}/${this.personalTableId}/${recordId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("[NominaRepo] Empleado no encontrado (record ID):", recordId);
        return null;
      }
      console.error("[NominaRepo] Error obteniendo empleado por record ID:", await response.text());
      return null;
    }

    const record = await response.json();
    const fields = record.fields;

    const idEmpleadoField = (fields["ID Empleado"] as string) || record.id;
    const nombreCompleto = fields["Nombre completo"] as string;
    const numeroDocumento = fields["Numero Documento"] as string || "";
    const rolesLookup = fields["Rol (from Rol)"] as string[] | undefined;
    const cargo = rolesLookup && rolesLookup.length > 0 ? rolesLookup[0] : "Sin cargo";
    const estadoActividad = fields["Estado de actividad"] as string;

    if (estadoActividad !== "Activo") {
      console.log("[NominaRepo] Empleado no activo:", nombreCompleto, "- Estado:", estadoActividad);
      return null;
    }

    return {
      idEmpleadoCore: idEmpleadoField,
      nombreCompleto,
      numeroDocumento,
      cargo,
      estado: estadoActividad,
    };
  }
}

// Exportar instancia singleton
export const nominaRepository = new AirtableNominaRepository();
