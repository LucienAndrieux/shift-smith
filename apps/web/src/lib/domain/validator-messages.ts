import type { Locale } from "../i18n/config";
import type { ViolationCode } from "./validator";

/**
 * Violation labels and messages in each interface language. Names, shift labels,
 * dates and week keys arrive already formatted.
 */
export interface ValidatorMessages {
  labels: Record<ViolationCode, string>;
  unknownShiftLabel: string;
  anyShift: (section: string) => string;
  allDay: string;
  none: string;
  emptyCell: string;
  shiftCell: (shift: string) => string;
  unassigned: (name: string, count: number, start: string) => string;
  unknownShift: (name: string, date: string) => string;
  notEligible: (name: string, shift: string, date: string) => string;
  inactiveShift: (shift: string, name: string, date: string) => string;
  unknownDayCode: (name: string, code: string, date: string) => string;
  minRest: (p: {
    name: string;
    rest: string;
    prevShift: string;
    prevEnd: string;
    prevDate: string;
    shift: string;
    start: string;
    min: string;
  }) => string;
  consecutive: (name: string, max: number, from: string) => string;
  restDays: (name: string, count: number, week: string) => string;
  fixedDaysOff: (
    name: string,
    week: string,
    actual: string,
    expected: string,
  ) => string;
  maxPerWeek: (
    name: string,
    count: number,
    shift: string,
    week: string,
    max: number,
  ) => string;
  exactPerWeek: (
    name: string,
    count: number,
    shift: string,
    week: string,
    exact: number,
  ) => string;
  weekendOff: (name: string, count: number, required: number) => string;
  birthday: (name: string, date: string, code: string, found: string) => string;
  approvedLeave: (
    name: string,
    code: string,
    date: string,
    found: string,
  ) => string;
  unavailable: (
    name: string,
    window: string,
    date: string,
    shift: string,
  ) => string;
  monthlyTl: (
    name: string,
    count: number,
    code: string,
    expected: number,
  ) => string;
  sameDaysOff: (pair: string, resting: string, date: string) => string;
  differentWeekend: (pair: string, sat: string, sun: string) => string;
  minStaff: (what: string, date: string, count: number, min: number) => string;
  maxStaff: (what: string, date: string, count: number, max: number) => string;
}

const en: ValidatorMessages = {
  labels: {
    weekly_contract_hours_default: "Weekly contract",
    max_consecutive_work_days: "Consecutive working days",
    min_rest_between_shifts_hours: "Rest between shifts",
    weekend_off_per_month: "Monthly weekend off",
    birthday_off: "Birthday off",
    two_rest_days_per_week: "Two rest days per week",
    approved_leave_is_fixed: "Approved leave",
    same_days_off: "Same days off",
    different_weekend_off: "Different weekend off",
    shift_eligibility: "Shift eligibility",
    shift_max_per_week: "Max shifts per week",
    shift_exact_per_week: "Exact shifts per week",
    inactive_shift: "Inactive shift",
    unavailability: "Unavailability",
    min_staff: "Minimum staffing",
    max_staff: "Maximum staffing",
    unassigned_day: "Unassigned days",
    unknown_code: "Unknown code",
    fixed_days_off_mismatch: "Fixed days off",
    monthly_tl_days: "Monthly time off in lieu",
  },
  unknownShiftLabel: "unknown shift",
  anyShift: (section) => `${section} (any shift)`,
  allDay: "all day",
  none: "none",
  emptyCell: "empty",
  shiftCell: (shift) => `shift ${shift}`,
  unassigned: (name, count, start) =>
    `${name}: ${count} day(s) without assignment, starting ${start}.`,
  unknownShift: (name, date) => `${name}: unknown shift on ${date}.`,
  notEligible: (name, shift, date) =>
    `${name} is not eligible for ${shift} (${date}).`,
  inactiveShift: (shift, name, date) =>
    `${shift} is inactive but assigned to ${name} on ${date}.`,
  unknownDayCode: (name, code, date) =>
    `${name}: unknown day code "${code}" on ${date}.`,
  minRest: (p) =>
    `${p.name}: only ${p.rest} rest between ${p.prevShift} ending ${p.prevEnd} on ${p.prevDate} and ${p.shift} starting ${p.start} (minimum ${p.min}).`,
  consecutive: (name, max, from) =>
    `${name}: more than ${max} consecutive working days (from ${from}).`,
  restDays: (name, count, week) =>
    `${name}: ${count} rest day(s) in ${week} (2 required).`,
  fixedDaysOff: (name, week, actual, expected) =>
    `${name}: rest days in ${week} are ${actual} instead of the fixed ${expected}.`,
  maxPerWeek: (name, count, shift, week, max) =>
    `${name}: ${count} × ${shift} in ${week} (max ${max}).`,
  exactPerWeek: (name, count, shift, week, exact) =>
    `${name}: ${count} × ${shift} in ${week} (exactly ${exact} required).`,
  weekendOff: (name, count, required) =>
    `${name}: ${count} full weekend(s) off this month (${required} required).`,
  birthday: (name, date, code, found) =>
    `${name}: birthday on ${date} should be coded ${code} (found ${found}).`,
  approvedLeave: (name, code, date, found) =>
    `${name}: approved ${code} on ${date} but the cell is ${found}.`,
  unavailable: (name, window, date, shift) =>
    `${name} is unavailable ${window} on ${date} but works ${shift}`,
  monthlyTl: (name, count, code, expected) =>
    `${name}: ${count} ${code} day(s) this month (${expected} expected).`,
  sameDaysOff: (pair, resting, date) =>
    `${pair} must share rest days, but only ${resting} rests on ${date}.`,
  differentWeekend: (pair, sat, sun) =>
    `${pair} must not have the same weekend off (${sat}–${sun}).`,
  minStaff: (what, date, count, min) =>
    `${what} on ${date}: ${count} staff, minimum ${min}`,
  maxStaff: (what, date, count, max) =>
    `${what} on ${date}: ${count} staff, maximum ${max}`,
};

const fr: ValidatorMessages = {
  labels: {
    weekly_contract_hours_default: "Contrat hebdomadaire",
    max_consecutive_work_days: "Jours travaillés consécutifs",
    min_rest_between_shifts_hours: "Repos entre deux services",
    weekend_off_per_month: "Week-end de repos mensuel",
    birthday_off: "Congé d'anniversaire",
    two_rest_days_per_week: "Deux jours de repos par semaine",
    approved_leave_is_fixed: "Congé approuvé",
    same_days_off: "Mêmes jours de repos",
    different_weekend_off: "Week-ends de repos différents",
    shift_eligibility: "Habilitation au service",
    shift_max_per_week: "Services max par semaine",
    shift_exact_per_week: "Services exacts par semaine",
    inactive_shift: "Service inactif",
    unavailability: "Indisponibilité",
    min_staff: "Effectif minimum",
    max_staff: "Effectif maximum",
    unassigned_day: "Jours non affectés",
    unknown_code: "Code inconnu",
    fixed_days_off_mismatch: "Jours de repos fixes",
    monthly_tl_days: "Récupérations mensuelles",
  },
  unknownShiftLabel: "service inconnu",
  anyShift: (section) => `${section} (tout service)`,
  allDay: "toute la journée",
  none: "aucun",
  emptyCell: "vide",
  shiftCell: (shift) => `le service ${shift}`,
  unassigned: (name, count, start) =>
    `${name} : ${count} jour(s) sans affectation, à partir du ${start}.`,
  unknownShift: (name, date) => `${name} : service inconnu le ${date}.`,
  notEligible: (name, shift, date) =>
    `${name} n'est pas habilité(e) pour ${shift} (${date}).`,
  inactiveShift: (shift, name, date) =>
    `${shift} est inactif mais affecté à ${name} le ${date}.`,
  unknownDayCode: (name, code, date) =>
    `${name} : code jour « ${code} » inconnu le ${date}.`,
  minRest: (p) =>
    `${p.name} : seulement ${p.rest} de repos entre ${p.prevShift} finissant à ${p.prevEnd} le ${p.prevDate} et ${p.shift} commençant à ${p.start} (minimum ${p.min}).`,
  consecutive: (name, max, from) =>
    `${name} : plus de ${max} jours travaillés consécutifs (depuis le ${from}).`,
  restDays: (name, count, week) =>
    `${name} : ${count} jour(s) de repos en ${week} (2 requis).`,
  fixedDaysOff: (name, week, actual, expected) =>
    `${name} : les jours de repos en ${week} sont ${actual} au lieu des jours fixes ${expected}.`,
  maxPerWeek: (name, count, shift, week, max) =>
    `${name} : ${count} × ${shift} en ${week} (max ${max}).`,
  exactPerWeek: (name, count, shift, week, exact) =>
    `${name} : ${count} × ${shift} en ${week} (exactement ${exact} requis).`,
  weekendOff: (name, count, required) =>
    `${name} : ${count} week-end(s) complet(s) de repos ce mois-ci (${required} requis).`,
  birthday: (name, date, code, found) =>
    `${name} : l'anniversaire du ${date} doit être codé ${code} (trouvé : ${found}).`,
  approvedLeave: (name, code, date, found) =>
    `${name} : ${code} approuvé le ${date} mais la cellule contient ${found}.`,
  unavailable: (name, window, date, shift) =>
    `${name} est indisponible ${window} le ${date} mais travaille en ${shift}`,
  monthlyTl: (name, count, code, expected) =>
    `${name} : ${count} jour(s) ${code} ce mois-ci (${expected} attendu(s)).`,
  sameDaysOff: (pair, resting, date) =>
    `${pair} doivent avoir les mêmes jours de repos, mais seul(e) ${resting} est au repos le ${date}.`,
  differentWeekend: (pair, sat, sun) =>
    `${pair} ne doivent pas avoir le même week-end de repos (${sat}–${sun}).`,
  minStaff: (what, date, count, min) =>
    `${what} le ${date} : ${count} personne(s), minimum ${min}`,
  maxStaff: (what, date, count, max) =>
    `${what} le ${date} : ${count} personne(s), maximum ${max}`,
};

const pt: ValidatorMessages = {
  labels: {
    weekly_contract_hours_default: "Contrato semanal",
    max_consecutive_work_days: "Dias de trabalho consecutivos",
    min_rest_between_shifts_hours: "Descanso entre turnos",
    weekend_off_per_month: "Fim de semana de folga mensal",
    birthday_off: "Folga de aniversário",
    two_rest_days_per_week: "Duas folgas por semana",
    approved_leave_is_fixed: "Ausência aprovada",
    same_days_off: "Mesmas folgas",
    different_weekend_off: "Fins de semana de folga diferentes",
    shift_eligibility: "Habilitação para o turno",
    shift_max_per_week: "Máximo de turnos por semana",
    shift_exact_per_week: "Turnos exatos por semana",
    inactive_shift: "Turno inativo",
    unavailability: "Indisponibilidade",
    min_staff: "Efetivo mínimo",
    max_staff: "Efetivo máximo",
    unassigned_day: "Dias sem atribuição",
    unknown_code: "Código desconhecido",
    fixed_days_off_mismatch: "Folgas fixas",
    monthly_tl_days: "Folgas compensatórias mensais",
  },
  unknownShiftLabel: "turno desconhecido",
  anyShift: (section) => `${section} (qualquer turno)`,
  allDay: "todo o dia",
  none: "nenhum",
  emptyCell: "vazia",
  shiftCell: (shift) => `o turno ${shift}`,
  unassigned: (name, count, start) =>
    `${name}: ${count} dia(s) sem atribuição, a partir de ${start}.`,
  unknownShift: (name, date) => `${name}: turno desconhecido a ${date}.`,
  notEligible: (name, shift, date) =>
    `${name} não está habilitado(a) para ${shift} (${date}).`,
  inactiveShift: (shift, name, date) =>
    `${shift} está inativo mas atribuído a ${name} a ${date}.`,
  unknownDayCode: (name, code, date) =>
    `${name}: código de dia "${code}" desconhecido a ${date}.`,
  minRest: (p) =>
    `${p.name}: apenas ${p.rest} de descanso entre ${p.prevShift} que termina às ${p.prevEnd} a ${p.prevDate} e ${p.shift} que começa às ${p.start} (mínimo ${p.min}).`,
  consecutive: (name, max, from) =>
    `${name}: mais de ${max} dias de trabalho consecutivos (desde ${from}).`,
  restDays: (name, count, week) =>
    `${name}: ${count} folga(s) em ${week} (2 obrigatórias).`,
  fixedDaysOff: (name, week, actual, expected) =>
    `${name}: as folgas em ${week} são ${actual} em vez das fixas ${expected}.`,
  maxPerWeek: (name, count, shift, week, max) =>
    `${name}: ${count} × ${shift} em ${week} (máx. ${max}).`,
  exactPerWeek: (name, count, shift, week, exact) =>
    `${name}: ${count} × ${shift} em ${week} (exatamente ${exact} obrigatórios).`,
  weekendOff: (name, count, required) =>
    `${name}: ${count} fim(ns) de semana completo(s) de folga este mês (${required} obrigatório(s)).`,
  birthday: (name, date, code, found) =>
    `${name}: o aniversário a ${date} deve ter o código ${code} (encontrado: ${found}).`,
  approvedLeave: (name, code, date, found) =>
    `${name}: ${code} aprovado a ${date} mas a célula tem ${found}.`,
  unavailable: (name, window, date, shift) =>
    `${name} está indisponível ${window} a ${date} mas trabalha em ${shift}`,
  monthlyTl: (name, count, code, expected) =>
    `${name}: ${count} dia(s) ${code} este mês (${expected} previsto(s)).`,
  sameDaysOff: (pair, resting, date) =>
    `${pair} devem ter as mesmas folgas, mas só ${resting} folga a ${date}.`,
  differentWeekend: (pair, sat, sun) =>
    `${pair} não podem ter o mesmo fim de semana de folga (${sat}–${sun}).`,
  minStaff: (what, date, count, min) =>
    `${what} a ${date}: ${count} pessoa(s), mínimo ${min}`,
  maxStaff: (what, date, count, max) =>
    `${what} a ${date}: ${count} pessoa(s), máximo ${max}`,
};

export const VALIDATOR_MESSAGES: Record<Locale, ValidatorMessages> = {
  en,
  fr,
  pt,
};
