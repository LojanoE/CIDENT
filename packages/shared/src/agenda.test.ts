import { describe, expect, it } from "vitest";
import {
  citasEnConflicto,
  diaDe,
  diasDeLaSemana,
  duracionMinutos,
  esDiaHabil,
  franjasDelDia,
  horaDe,
  inicioDeSemana,
  ocupaFranja,
  rangoDeLaSemana,
  rangoDelDia,
  solapan,
  sumarDias,
  sumarMinutos,
  type Ocupacion,
} from "./agenda.js";

// Los días de la semana usados acá están verificados, no supuestos:
// 2026-09-28 lunes, 2026-09-29 martes, 2026-10-03 sábado, 2026-10-04 domingo.

describe("diaDe / horaDe", () => {
  it("parte la marca local en sus dos mitades", () => {
    expect(diaDe("2026-09-29T15:30")).toBe("2026-09-29");
    expect(horaDe("2026-09-29T15:30")).toBe("15:30");
  });
});

describe("sumarMinutos", () => {
  it("suma dentro del mismo día", () => {
    expect(sumarMinutos("2026-09-29T15:00", 30)).toBe("2026-09-29T15:30");
  });

  it("cruza la medianoche", () => {
    expect(sumarMinutos("2026-09-29T23:45", 30)).toBe("2026-09-30T00:15");
  });

  it("cruza el fin de mes", () => {
    expect(sumarMinutos("2026-09-30T23:45", 30)).toBe("2026-10-01T00:15");
  });

  it("cruza el fin de año", () => {
    expect(sumarMinutos("2026-12-31T23:30", 60)).toBe("2027-01-01T00:30");
  });

  it("acepta minutos negativos", () => {
    expect(sumarMinutos("2026-09-29T00:15", -30)).toBe("2026-09-28T23:45");
  });

  it("lanza con una marca malformada", () => {
    expect(() => sumarMinutos("2026-09-29 15:00", 30)).toThrow(RangeError);
    expect(() => sumarMinutos("2026-09-29", 30)).toThrow(RangeError);
  });
});

describe("sumarDias", () => {
  it("cruza mes y año", () => {
    expect(sumarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("maneja febrero en un año bisiesto y en uno que no lo es", () => {
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarDias("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("lanza con un día malformado", () => {
    expect(() => sumarDias("29/09/2026", 1)).toThrow(RangeError);
  });
});

describe("duracionMinutos", () => {
  it("mide una franja normal", () => {
    expect(duracionMinutos({ inicio: "2026-09-29T15:00", fin: "2026-09-29T15:30" })).toBe(30);
  });

  it("mide una franja que cruza la medianoche", () => {
    expect(duracionMinutos({ inicio: "2026-09-29T23:45", fin: "2026-09-30T00:15" })).toBe(30);
  });
});

describe("esDiaHabil", () => {
  it("por defecto atiende de lunes a sábado", () => {
    expect(esDiaHabil("2026-09-28")).toBe(true);
    expect(esDiaHabil("2026-10-03")).toBe(true);
    expect(esDiaHabil("2026-10-04")).toBe(false);
  });

  it("rechaza un día malformado sin lanzar", () => {
    expect(esDiaHabil("29/09/2026")).toBe(false);
  });
});

describe("inicioDeSemana / diasDeLaSemana", () => {
  it("devuelve el lunes de la semana", () => {
    expect(inicioDeSemana("2026-09-29")).toBe("2026-09-28");
    expect(inicioDeSemana("2026-09-28")).toBe("2026-09-28");
  });

  it("trata el domingo como cierre y no como apertura de semana", () => {
    // Con getDay() el domingo es 0; sin corregirlo saltaría a la semana siguiente.
    expect(inicioDeSemana("2026-10-04")).toBe("2026-09-28");
  });

  it("enumera los siete días de lunes a domingo", () => {
    expect(diasDeLaSemana("2026-09-30")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });
});

describe("rangoDelDia / rangoDeLaSemana", () => {
  it("el rango del día es semiabierto", () => {
    expect(rangoDelDia("2026-09-29")).toEqual({
      inicio: "2026-09-29T00:00",
      fin: "2026-09-30T00:00",
    });
  });

  it("el rango de la semana va del lunes al lunes siguiente", () => {
    expect(rangoDeLaSemana("2026-10-04")).toEqual({
      inicio: "2026-09-28T00:00",
      fin: "2026-10-05T00:00",
    });
  });
});

describe("franjasDelDia", () => {
  it("cubre 08:00-20:00 en pasos de 30 minutos", () => {
    const franjas = franjasDelDia("2026-09-29");
    expect(franjas).toHaveLength(24);
    expect(franjas[0]).toBe("2026-09-29T08:00");
    // La última arranca 19:30: una franja que empieza a la hora de cierre no existe.
    expect(franjas[franjas.length - 1]).toBe("2026-09-29T19:30");
    expect(franjas).not.toContain("2026-09-29T20:00");
  });

  it("devuelve vacío en un día no laborable", () => {
    expect(franjasDelDia("2026-10-04")).toEqual([]);
  });

  it("devuelve vacío en vez de colgarse con un horario incoherente", () => {
    const base = { diasHabiles: [1, 2, 3, 4, 5, 6], horaApertura: "08:00", horaCierre: "20:00" };
    expect(franjasDelDia("2026-09-29", { ...base, franjaMin: 0 })).toEqual([]);
    expect(franjasDelDia("2026-09-29", { ...base, franjaMin: -30 })).toEqual([]);
    expect(
      franjasDelDia("2026-09-29", {
        ...base,
        horaApertura: "20:00",
        horaCierre: "08:00",
        franjaMin: 30,
      }),
    ).toEqual([]);
  });

  it("respeta un horario distinto al de por defecto", () => {
    const franjas = franjasDelDia("2026-09-29", {
      diasHabiles: [2],
      horaApertura: "09:00",
      horaCierre: "10:00",
      franjaMin: 20,
    });
    expect(franjas).toEqual(["2026-09-29T09:00", "2026-09-29T09:20", "2026-09-29T09:40"]);
  });
});

describe("solapan", () => {
  const franja = (inicio: string, fin: string) => ({
    inicio: `2026-09-29T${inicio}`,
    fin: `2026-09-29T${fin}`,
  });

  it("dos turnos consecutivos NO se solapan", () => {
    // El borde que importa: fin == inicio. Intervalos semiabiertos.
    expect(solapan(franja("15:00", "15:30"), franja("15:30", "16:00"))).toBe(false);
    expect(solapan(franja("15:30", "16:00"), franja("15:00", "15:30"))).toBe(false);
  });

  it("detecta el solapamiento parcial en ambos sentidos", () => {
    expect(solapan(franja("15:00", "15:30"), franja("15:15", "15:45"))).toBe(true);
    expect(solapan(franja("15:15", "15:45"), franja("15:00", "15:30"))).toBe(true);
  });

  it("detecta la contención y la coincidencia exacta", () => {
    expect(solapan(franja("15:00", "16:00"), franja("15:15", "15:30"))).toBe(true);
    expect(solapan(franja("15:15", "15:30"), franja("15:00", "16:00"))).toBe(true);
    expect(solapan(franja("15:00", "15:30"), franja("15:00", "15:30"))).toBe(true);
  });

  it("no ve solapamiento entre franjas separadas", () => {
    expect(solapan(franja("15:00", "15:30"), franja("17:00", "17:30"))).toBe(false);
  });

  it("compara correctamente a través de días distintos", () => {
    expect(
      solapan(
        { inicio: "2026-09-29T23:00", fin: "2026-09-30T01:00" },
        { inicio: "2026-09-30T00:30", fin: "2026-09-30T01:30" },
      ),
    ).toBe(true);
  });
});

describe("ocupaFranja", () => {
  it("una cita cancelada o ausente libera el horario", () => {
    expect(ocupaFranja("pendiente")).toBe(true);
    expect(ocupaFranja("confirmada")).toBe(true);
    expect(ocupaFranja("atendida")).toBe(true);
    expect(ocupaFranja("cancelada")).toBe(false);
    expect(ocupaFranja("ausente")).toBe(false);
    expect(ocupaFranja(undefined)).toBe(true);
  });
});

describe("citasEnConflicto", () => {
  const cita = (parcial: Partial<Ocupacion> & { appointmentId: string }): Ocupacion => ({
    profesionalUid: "dra-lopez",
    inicio: "2026-09-29T15:00",
    fin: "2026-09-29T15:30",
    estado: "pendiente",
    ...parcial,
  });

  const candidata: Ocupacion = {
    profesionalUid: "dra-lopez",
    inicio: "2026-09-29T15:15",
    fin: "2026-09-29T15:45",
  };

  it("devuelve la cita que choca, no solo un booleano", () => {
    const existente = cita({ appointmentId: "a1" });
    expect(citasEnConflicto(candidata, [existente])).toEqual([existente]);
  });

  it("ignora a los demás profesionales: la agenda es compartida, la silla no", () => {
    expect(
      citasEnConflicto(candidata, [cita({ appointmentId: "a1", profesionalUid: "dr-mora" })]),
    ).toEqual([]);
  });

  it("al editar, una cita no choca consigo misma", () => {
    const existente = cita({ appointmentId: "a1" });
    expect(citasEnConflicto({ ...candidata, appointmentId: "a1" }, [existente])).toEqual([]);
  });

  it("ignora canceladas y ausentes", () => {
    expect(
      citasEnConflicto(candidata, [
        cita({ appointmentId: "a1", estado: "cancelada" }),
        cita({ appointmentId: "a2", estado: "ausente" }),
      ]),
    ).toEqual([]);
  });

  it("no busca conflictos para una cita que se está cancelando", () => {
    expect(
      citasEnConflicto({ ...candidata, estado: "cancelada" }, [cita({ appointmentId: "a1" })]),
    ).toEqual([]);
  });

  it("devuelve todos los choques, no solo el primero", () => {
    const existentes = [
      cita({ appointmentId: "a1", inicio: "2026-09-29T15:00", fin: "2026-09-29T15:30" }),
      cita({ appointmentId: "a2", inicio: "2026-09-29T15:30", fin: "2026-09-29T16:00" }),
    ];
    const larga: Ocupacion = {
      profesionalUid: "dra-lopez",
      inicio: "2026-09-29T14:45",
      fin: "2026-09-29T16:15",
    };
    expect(citasEnConflicto(larga, existentes)).toHaveLength(2);
  });

  it("no marca conflicto con el turno inmediatamente siguiente", () => {
    const seguido: Ocupacion = {
      profesionalUid: "dra-lopez",
      inicio: "2026-09-29T15:30",
      fin: "2026-09-29T16:00",
    };
    expect(citasEnConflicto(seguido, [cita({ appointmentId: "a1" })])).toEqual([]);
  });
});
