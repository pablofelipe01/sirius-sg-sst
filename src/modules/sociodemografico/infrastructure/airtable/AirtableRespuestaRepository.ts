import Airtable from "airtable";
import type {
  Respuesta,
  GuardarRespuestaDTO,
  EstadisticasCampana,
  PiramidePoblacional,
} from "../../domain/entities";
import type { IRespuestaRepository } from "../../domain/repositories";
import { SOCIO_CONFIG } from "./config";
import { encontrarPorId, listarPorIds } from "./airtableUtils";

export class AirtableRespuestaRepository implements IRespuestaRepository {
  private base: Airtable.Base;
  private table: Airtable.Table<any>;

  constructor() {
    const airtable = new Airtable({ apiKey: SOCIO_CONFIG.apiToken });
    this.base = airtable.base(SOCIO_CONFIG.baseId);
    this.table = this.base(SOCIO_CONFIG.respuestas.tableId);
  }

  async guardar(dto: GuardarRespuestaDTO): Promise<Respuesta> {
    const F = SOCIO_CONFIG.respuestas.fields;

    // 1. Validar que el token existe y no ha sido usado
    const tokensTable = this.base(SOCIO_CONFIG.tokens.tableId);
    const TF = SOCIO_CONFIG.tokens.fields;

    const tokenRecords = await tokensTable
      .select({
        filterByFormula: `{${TF.TOKEN}} = '${dto.token}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      })
      .firstPage();

    if (tokenRecords.length === 0) {
      throw new Error("Token inválido");
    }

    const tokenRecord = tokenRecords[0];
    const tokenUsado = tokenRecord.get(TF.USADO) === true;

    if (tokenUsado) {
      throw new Error("Esta encuesta ya fue respondida");
    }

    // 2. Validar que la campaña está activa
    const campanaId = (tokenRecord.get(TF.CAMPANA) as string[])?.[0];
    const campanasTable = this.base(SOCIO_CONFIG.campanas.tableId);
    const CF = SOCIO_CONFIG.campanas.fields;

    const campanaRecord = await encontrarPorId(campanasTable, campanaId);
    if (!campanaRecord) {
      throw new Error("La campaña asociada al token no existe");
    }

    const estadoCampana = campanaRecord.get(CF.ESTADO);

    if (estadoCampana === "Cerrada") {
      throw new Error("Esta campaña ya está cerrada");
    }

    // 3. Validar consentimiento
    if (!dto.aceptaPoliticaDatos) {
      throw new Error("Debe aceptar la política de tratamiento de datos");
    }

    if (!dto.firmaVeracidad) {
      throw new Error("Debe firmar la veracidad de la información");
    }

    // 4. Obtener código de empleado desde la tabla Personal
    const personalRecordId = (tokenRecord.get(TF.PERSONAL) as string) || "";
    let codigoEmpleado = "";

    if (personalRecordId) {
      try {
        const personalBase = new Airtable({ apiKey: process.env.AIRTABLE_API_TOKEN! }).base(
          process.env.AIRTABLE_BASE_ID!
        );
        const personalTable = personalBase(process.env.AIRTABLE_PERSONAL_TABLE_ID!);
        const personalRecord = await encontrarPorId(personalTable, personalRecordId);

        if (personalRecord) {
          codigoEmpleado = (personalRecord.get(process.env.AIRTABLE_PF_ID_EMPLEADO!) as string) || "";
        }
      } catch (e) {
        console.warn("[guardar respuesta] No se pudo obtener código de empleado, usando record ID", e);
        codigoEmpleado = personalRecordId; // Fallback al record ID si falla
      }
    }

    // 5. Crear registro de respuesta

    const record = await this.table.create({
      [F.TOKEN]: [tokenRecord.id],
      [F.CAMPANA]: [campanaId],
      // Personal: código de empleado SIRIUS-PER-XXXX (texto plano, no link)
      [F.PERSONAL]: codigoEmpleado,
      // Sección 1
      [F.NOMBRE_COMPLETO]: dto.nombreCompleto,
      [F.NUMERO_DOCUMENTO]: dto.numeroDocumento,
      [F.FECHA_NACIMIENTO]: dto.fechaNacimiento,
      [F.GENERO]: dto.genero,
      [F.ESTADO_CIVIL]: dto.estadoCivil,
      // Sección 2
      [F.MUNICIPIO_RESIDENCIA]: dto.municipioResidencia,
      [F.ESTRATO]: dto.estrato,
      [F.TIPO_VIVIENDA]: dto.tipoVivienda,
      [F.PERSONAS_A_CARGO]: dto.personasACargo,
      // Sección 3
      [F.ESCOLARIDAD]: dto.escolaridad,
      [F.ESTUDIANDO_ACTUALMENTE]: dto.estudiandoActualmente,
      [F.CARRERA_ACTUAL]: dto.carreraActual || "",
      // Sección 4
      [F.AREA_TRABAJO]: dto.areaTrabajo,
      [F.CARGO]: dto.cargo,
      [F.TIPO_CONTRATO]: dto.tipoContrato,
      [F.FECHA_INGRESO_SIRIUS]: dto.fechaIngresoSirius,
      [F.TURNO_TRABAJO]: dto.turnoTrabajo,
      [F.OTRO_EMPLEO]: dto.otroEmpleo,
      ...(F.DESC_OTRO_EMPLEO && { [F.DESC_OTRO_EMPLEO]: dto.descripcionOtroEmpleo || "" }),
      // Sección 5
      [F.ENFERMEDAD_CRONICA]: dto.enfermedadCronica,
      [F.CUAL_ENFERMEDAD_CRONICA]: dto.cualEnfermedadCronica || "",
      [F.DISCAPACIDAD]: dto.discapacidad,
      [F.CUAL_DISCAPACIDAD]: dto.cualDiscapacidad || "",
      [F.TRATAMIENTO_MEDICO]: dto.tratamientoMedico,
      ...(F.DESC_TRATAMIENTO && { [F.DESC_TRATAMIENTO]: dto.descripcionTratamiento || "" }),
      [F.ACCIDENTES_TRABAJO_PREVIOS]: dto.accidentesTrabajoPrevios,
      ...(F.DESC_ACCIDENTES && { [F.DESC_ACCIDENTES]: dto.descripcionAccidentes || "" }),
      [F.ENFERMEDAD_LABORAL_PREVIA]: dto.enfermedadLaboralPrevia,
      ...(F.DESC_ENF_LABORAL && { [F.DESC_ENF_LABORAL]: dto.descripcionEnfLaboral || "" }),
      // Sección 6
      [F.FUMA]: dto.fuma,
      [F.ALCOHOL]: dto.alcohol,
      [F.PRACTICA_DEPORTE]: dto.practicaDeporte,
      [F.CUAL_DEPORTE]: dto.cualDeporte || "",
      [F.TIEMPO_LIBRE]: dto.tiempoLibre,
      ...(F.DESC_OTRO_TIEMPO_LIBRE && { [F.DESC_OTRO_TIEMPO_LIBRE]: dto.descripcionOtroTiempoLibre || "" }),
      // Sección 7
      [F.MEDIO_TRANSPORTE]: dto.medioTransporte,
      [F.TIEMPO_DESPLAZAMIENTO]: dto.tiempoDesplazamiento,
      // Consentimiento
      [F.ACEPTA_POLITICA_DATOS]: dto.aceptaPoliticaDatos,
      [F.FIRMA_VERACIDAD]: dto.firmaVeracidad,
      // Firma digital cifrada
      [F.FIRMA]: dto.firma,
    });

    // 6. Marcar token como usado
    await tokensTable.update(tokenRecord.id, {
      [TF.USADO]: true,
      [TF.FECHA_USO]: new Date().toISOString(),
    });

    // Re-leer: el registro devuelto por create() viene indexado por nombre de campo
    const creada = await this.obtenerPorId(record.id);
    if (!creada) throw new Error("No se pudo leer la respuesta recién creada");
    return creada;
  }

  async obtenerPorId(id: string): Promise<Respuesta | null> {
    const record = await encontrarPorId(this.table, id);
    return record ? this.mapToDomain(record) : null;
  }

  async listarPorCampana(campanaId: string): Promise<Respuesta[]> {
    // FIND(recordId, {link}) no funciona (los links se renderizan con su campo primario),
    // así que se usan los record IDs del back-link de la campaña.
    const CF = SOCIO_CONFIG.campanas.fields;
    const campanasTable = this.base(SOCIO_CONFIG.campanas.tableId);

    const campanaRecord = await encontrarPorId(campanasTable, campanaId);
    if (!campanaRecord) return [];

    const respuestaIds = (campanaRecord.get(CF.RESPUESTAS_LINK) as string[]) || [];
    if (respuestaIds.length === 0) return [];

    const records = await listarPorIds(this.table, respuestaIds);
    return records.map((r) => this.mapToDomain(r));
  }

  async obtenerEstadisticas(campanaId: string): Promise<EstadisticasCampana> {
    const respuestas = await this.listarPorCampana(campanaId);
    const totalRespuestas = respuestas.length;

    // Función helper para contar distribuciones
    const contar = (campo: keyof Respuesta): Record<string, number> => {
      const conteo: Record<string, number> = {};
      respuestas.forEach((r) => {
        const valor = String(r[campo] || "");
        conteo[valor] = (conteo[valor] || 0) + 1;
      });
      return conteo;
    };

    // Función helper para campos booleanos
    const contarBoolean = (campo: keyof Respuesta) => {
      const si = respuestas.filter((r) => r[campo] === true).length;
      return { si, no: totalRespuestas - si };
    };

    return {
      totalRespuestas,
      genero: contar("genero"),
      estadoCivil: contar("estadoCivil"),
      estrato: contar("estrato"),
      tipoVivienda: contar("tipoVivienda"),
      personasACargo: contar("personasACargo"),
      escolaridad: contar("escolaridad"),
      areaTrabajo: contar("areaTrabajo"),
      tipoContrato: contar("tipoContrato"),
      turnoTrabajo: contar("turnoTrabajo"),
      fuma: contar("fuma"),
      alcohol: contar("alcohol"),
      medioTransporte: contar("medioTransporte"),
      tiempoDesplazamiento: contar("tiempoDesplazamiento"),
      estudiandoActualmente: contarBoolean("estudiandoActualmente"),
      otroEmpleo: contarBoolean("otroEmpleo"),
      enfermedadCronica: contarBoolean("enfermedadCronica"),
      discapacidad: contarBoolean("discapacidad"),
      tratamientoMedico: contarBoolean("tratamientoMedico"),
      accidentesTrabajoPrevios: contarBoolean("accidentesTrabajoPrevios"),
      enfermedadLaboralPrevia: contarBoolean("enfermedadLaboralPrevia"),
      practicaDeporte: contarBoolean("practicaDeporte"),
    };
  }

  async obtenerPiramidePoblacional(campanaId: string): Promise<PiramidePoblacional> {
    const respuestas = await this.listarPorCampana(campanaId);

    // Calcular edades (ajustando si aún no ha cumplido años este año)
    const ahora = new Date();
    const datosConEdad = respuestas.map((r) => {
      let edad = ahora.getFullYear() - r.fechaNacimiento.getFullYear();
      const cumplio =
        ahora.getMonth() > r.fechaNacimiento.getMonth() ||
        (ahora.getMonth() === r.fechaNacimiento.getMonth() && ahora.getDate() >= r.fechaNacimiento.getDate());
      if (!cumplio) edad--;
      return { edad, genero: r.genero };
    });

    // Definir rangos
    const rangos = ["0-17", "18-25", "26-35", "36-45", "46-55", "56+"];

    const resultado = rangos.map((rango) => {
      const [min, max] = rango.split("-").map((n) => (n === "56+" ? 56 : parseInt(n)));

      const enRango = datosConEdad.filter((d) => {
        if (rango === "56+") return d.edad >= min;
        return d.edad >= min && d.edad <= max;
      });

      return {
        rango,
        Masculino: enRango.filter((d) => d.genero === "Masculino").length,
        Femenino: enRango.filter((d) => d.genero === "Femenino").length,
        Otro: enRango.filter((d) => d.genero !== "Masculino" && d.genero !== "Femenino").length,
      };
    });

    return { rangos: resultado };
  }

  async existeRespuestaParaToken(tokenId: string): Promise<boolean> {
    // El back-link del token contiene los record IDs de sus respuestas
    const TF = SOCIO_CONFIG.tokens.fields;
    const tokensTable = this.base(SOCIO_CONFIG.tokens.tableId);

    const tokenRecord = await encontrarPorId(tokensTable, tokenId);
    if (!tokenRecord) return false;

    const respuestas = (tokenRecord.get(TF.RESPUESTAS_LINK) as string[]) || [];
    return respuestas.length > 0;
  }

  private mapToDomain(record: Airtable.Record<any>): Respuesta {
    const F = SOCIO_CONFIG.respuestas.fields;

    return {
      id: record.id,
      tokenId: (record.get(F.TOKEN) as string[])?.[0] || "",
      campanaId: (record.get(F.CAMPANA) as string[])?.[0] || "",
      // Personal es texto plano con el record ID del colaborador
      personalId: (record.get(F.PERSONAL) as string) || "",
      // Sección 1
      nombreCompleto: record.get(F.NOMBRE_COMPLETO) as string,
      numeroDocumento: record.get(F.NUMERO_DOCUMENTO) as string,
      fechaNacimiento: new Date(record.get(F.FECHA_NACIMIENTO) as string),
      genero: record.get(F.GENERO) as any,
      estadoCivil: record.get(F.ESTADO_CIVIL) as any,
      // Sección 2
      municipioResidencia: record.get(F.MUNICIPIO_RESIDENCIA) as string,
      estrato: record.get(F.ESTRATO) as any,
      tipoVivienda: record.get(F.TIPO_VIVIENDA) as any,
      personasACargo: record.get(F.PERSONAS_A_CARGO) as any,
      // Sección 3
      escolaridad: record.get(F.ESCOLARIDAD) as any,
      estudiandoActualmente: record.get(F.ESTUDIANDO_ACTUALMENTE) === true,
      carreraActual: record.get(F.CARRERA_ACTUAL) as string | undefined,
      // Sección 4
      areaTrabajo: record.get(F.AREA_TRABAJO) as any,
      cargo: record.get(F.CARGO) as string,
      tipoContrato: record.get(F.TIPO_CONTRATO) as any,
      fechaIngresoSirius: new Date(record.get(F.FECHA_INGRESO_SIRIUS) as string),
      turnoTrabajo: record.get(F.TURNO_TRABAJO) as any,
      otroEmpleo: record.get(F.OTRO_EMPLEO) === true,
      descripcionOtroEmpleo: F.DESC_OTRO_EMPLEO ? (record.get(F.DESC_OTRO_EMPLEO) as string | undefined) : undefined,
      // Sección 5
      enfermedadCronica: record.get(F.ENFERMEDAD_CRONICA) === true,
      cualEnfermedadCronica: record.get(F.CUAL_ENFERMEDAD_CRONICA) as string | undefined,
      discapacidad: record.get(F.DISCAPACIDAD) === true,
      cualDiscapacidad: record.get(F.CUAL_DISCAPACIDAD) as string | undefined,
      tratamientoMedico: record.get(F.TRATAMIENTO_MEDICO) === true,
      descripcionTratamiento: F.DESC_TRATAMIENTO ? (record.get(F.DESC_TRATAMIENTO) as string | undefined) : undefined,
      accidentesTrabajoPrevios: record.get(F.ACCIDENTES_TRABAJO_PREVIOS) === true,
      descripcionAccidentes: F.DESC_ACCIDENTES ? (record.get(F.DESC_ACCIDENTES) as string | undefined) : undefined,
      enfermedadLaboralPrevia: record.get(F.ENFERMEDAD_LABORAL_PREVIA) === true,
      descripcionEnfLaboral: F.DESC_ENF_LABORAL ? (record.get(F.DESC_ENF_LABORAL) as string | undefined) : undefined,
      // Sección 6
      fuma: record.get(F.FUMA) as any,
      alcohol: record.get(F.ALCOHOL) as any,
      practicaDeporte: record.get(F.PRACTICA_DEPORTE) === true,
      cualDeporte: record.get(F.CUAL_DEPORTE) as string | undefined,
      tiempoLibre: (record.get(F.TIEMPO_LIBRE) as any[]) || [],
      descripcionOtroTiempoLibre: F.DESC_OTRO_TIEMPO_LIBRE ? (record.get(F.DESC_OTRO_TIEMPO_LIBRE) as string | undefined) : undefined,
      // Sección 7
      medioTransporte: record.get(F.MEDIO_TRANSPORTE) as any,
      tiempoDesplazamiento: record.get(F.TIEMPO_DESPLAZAMIENTO) as any,
      // Consentimiento
      aceptaPoliticaDatos: Boolean(record.get(F.ACEPTA_POLITICA_DATOS)),
      firmaVeracidad: Boolean(record.get(F.FIRMA_VERACIDAD)),
      // Firma digital
      firma: record.get(F.FIRMA) as string | undefined,
      createdTime: new Date(record._rawJson.createdTime),
    };
  }
}
