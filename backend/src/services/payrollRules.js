const round3 = (value) => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;

// Le montant saisi sur le mois de présences remplace le détail absence / retard.
// Sinon les dinars calculés sont répartis au prorata des minutes, sans écart d'arrondi.
function splitDeductions(computedAmount, absenceMinutes, latenessMinutes, monthAmount) {
  if (monthAmount !== null && monthAmount !== undefined) {
    return { absenceDeduction: 0, latenessDeduction: 0, presenceAdjustment: round3(monthAmount) };
  }
  const minutes = Number(absenceMinutes || 0) + Number(latenessMinutes || 0);
  const amount = computedAmount === null || computedAmount === undefined ? 0 : Number(computedAmount);
  if (!minutes || !amount) return { absenceDeduction: 0, latenessDeduction: 0, presenceAdjustment: null };
  const absenceDeduction = round3((amount * Number(absenceMinutes || 0)) / minutes);
  return {
    absenceDeduction,
    latenessDeduction: round3(amount - absenceDeduction),
    presenceAdjustment: null
  };
}

// Un jour férié impayé retire un jour de salaire seulement si l'absence de ce jour est validée.
// Un férié payé, ou un férié impayé non validé, ne change pas le salaire.
function unpaidHolidayDeduction(input) {
  const salary = Number(input.salary || 0);
  const divisor = Number(input.divisor || 0);
  if (!salary || !divisor) return 0;
  const count = (input.days || []).filter((day) => day.status === "UNPAID_HOLIDAY" && day.confirmed).length;
  return round3(count * (salary / divisor));
}

function buildPayslip(input) {
  const deductions = splitDeductions(input.computedAmount, input.absenceMinutes, input.latenessMinutes, input.monthAmount);
  const baseSalary = round3(input.baseSalary || 0);
  const commissions = round3(input.commissions || 0);
  const includedCommissions = round3(input.includedCommissions || 0);
  const bonus = round3(input.bonus || 0);
  // Les congés pris sont déjà dans le salaire. Ce montant est seulement le solde d'une année versé en plus.
  const paidLeave = round3(input.paidLeave || 0);
  const advance = round3(input.advance || 0);
  const taken = deductions.presenceAdjustment === null
    ? round3(deductions.absenceDeduction + deductions.latenessDeduction)
    : deductions.presenceAdjustment;
  return {
    baseSalary,
    commissions,
    includedCommissions,
    bonus,
    paidLeave,
    absenceDeduction: deductions.absenceDeduction,
    latenessDeduction: deductions.latenessDeduction,
    presenceAdjustment: deductions.presenceAdjustment,
    advance,
    unpaidHolidayDeduction: round3(input.unpaidHolidayDeduction || 0),
    net: round3(baseSalary + bonus + paidLeave + includedCommissions - taken - advance - round3(input.unpaidHolidayDeduction || 0))
  };
}

// L'avance versée ce mois est déjà partie en espèces : elle est retirée en entier du net.
// Une avance encore due se rembourse par retenues d'au plus un dixième du salaire dû
// (article 150 du code du travail). Sans retenue saisie, la fiche prend ce dixième.
function settleAdvance(input) {
  const due = round3(Math.max(0, Number(input.salaryDue) || 0));
  const cap = round3(due / 10);
  const granted = round3(Math.max(0, Number(input.granted) || 0));
  const carried = round3(Math.max(0, Number(input.carried) || 0));
  const requested = round3(Math.max(0, Number(input.requested) || 0));
  const recovery = requested > 0 ? Math.min(requested, carried, cap) : Math.min(carried, cap);
  return {
    advanceGranted: granted,
    advance: round3(granted + recovery),
    advanceRecovery: round3(recovery),
    advanceCap: cap,
    advanceCarried: carried,
    advanceBalance: round3(carried - recovery)
  };
}

function advanceAccount(entries, monthStart) {
  let carried = 0;
  let bonus = 0;
  let granted = 0;
  let recovery = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    const month = String(entry.month).slice(0, 10);
    if (month < monthStart) {
      if (entry.kind === "ADVANCE") carried += amount;
      if (entry.kind === "RECOVERY") carried -= amount;
    } else if (month === monthStart) {
      if (entry.kind === "BONUS") bonus += amount;
      if (entry.kind === "ADVANCE") granted += amount;
      if (entry.kind === "RECOVERY") recovery += amount;
    }
  }
  return {
    bonus: round3(bonus),
    advanceGranted: round3(granted),
    advance: round3(recovery),
    advanceCarried: round3(carried),
    advanceBalance: round3(carried + granted - recovery)
  };
}

module.exports = { buildPayslip, splitDeductions, advanceAccount, settleAdvance, unpaidHolidayDeduction };
