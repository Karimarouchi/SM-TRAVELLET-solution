// Calcul d'un mois de présences. Les dates sont des "YYYY-MM-DD" et les heures
// des minutes depuis minuit dans le fuseau de l'agence.

const round3 = (value) => Math.round(value * 1000) / 1000;

function parseDay(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function weekday(iso) {
  const js = parseDay(iso).getUTCDay();
  return js === 0 ? 7 : js;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function zoned(at, timeZone) {
  const date = at instanceof Date ? at : new Date(at);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const hour = Number(parts.hour) % 24;
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute) };
}

function clock(minutes) {
  if (minutes === null || minutes === undefined) return null;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function lastDirectionBefore(messages, day, startMin) {
  const last = new Map();
  for (const message of messages) {
    if (message.day > day || (message.day === day && message.minutes >= startMin)) break;
    if (message.direction === "out" && message.auto) continue;
    last.set(message.contactId, message.direction);
  }
  return [...last.values()].some((direction) => direction === "in");
}

function measureDay({ mode, day, startMin, endMin, messages, events, actions, userId }) {
  const span = endMin - startMin;
  const logins = events.filter((event) => event.day === day && event.kind === "LOGIN").map((event) => event.minutes);
  const logouts = events.filter((event) => event.day === day && event.kind === "LOGOUT").map((event) => event.minutes);
  const firstLogin = logins.length ? Math.min(...logins) : null;
  const lastLogout = logouts.length ? Math.max(...logouts) : null;

  let arrival = null;
  let departure = null;
  let arrivalFrom = null;
  let departureFrom = null;
  let noReply = false;

  if (mode === "sales") {
    const waiting = lastDirectionBefore(messages, day, startMin);
    const inboundToday = messages.some((message) => message.day === day && message.direction === "in");
    const replies = messages.filter((message) => message.day === day && message.direction === "out" && !message.auto && message.sentBy === userId);
    const firstReply = replies.length ? Math.min(...replies.map((message) => message.minutes)) : null;
    const lastReply = replies.length ? Math.max(...replies.map((message) => message.minutes)) : null;
    if (waiting) {
      arrival = firstReply;
      arrivalFrom = "réponse";
      noReply = firstReply === null;
    } else if (firstLogin !== null) {
      arrival = firstLogin;
      arrivalFrom = "connexion";
    } else if (firstReply !== null) {
      arrival = firstReply;
      arrivalFrom = "réponse";
    }
    if (waiting || inboundToday) {
      departure = lastReply;
      departureFrom = "réponse";
    } else {
      departure = lastLogout;
      departureFrom = "déconnexion";
    }
  } else {
    const stamps = actions.filter((action) => action.day === day).map((action) => action.minutes);
    const lastAction = stamps.length ? Math.max(...stamps) : null;
    arrival = firstLogin;
    arrivalFrom = "connexion";
    if (lastAction !== null) {
      departure = lastAction;
      departureFrom = "dossier";
    } else {
      departure = lastLogout;
      departureFrom = "déconnexion";
    }
  }

  if (noReply || arrival === null) {
    return {
      status: noReply ? "NO_REPLY" : "ABSENT",
      lateMinutes: span,
      earlyMinutes: 0,
      arrival: null,
      departure: null,
      arrivalFrom,
      departureFrom
    };
  }

  const lateMinutes = Math.min(span, Math.max(0, arrival - startMin));
  let earlyMinutes = 0;
  if (departure !== null && departure >= arrival && departure < endMin) {
    earlyMinutes = Math.min(span - lateMinutes, endMin - departure);
  }
  return {
    status: "PRESENT",
    lateMinutes,
    earlyMinutes,
    arrival: clock(arrival),
    departure: departure === null ? null : clock(departure),
    arrivalFrom,
    departureFrom
  };
}

function buildMonth(input) {
  const {
    year,
    month,
    today,
    timeZone,
    startMin,
    endMin,
    workDays,
    mode,
    salary,
    divisor,
    messages,
    events,
    actions,
    leaves,
    holidays,
    overrides,
    monthAmount
  } = input;
  const span = endMin - startMin;
  const holidayPaid = new Map(
    (holidays || []).map((holiday) => (typeof holiday === "string"
      ? [holiday.slice(0, 10), true]
      : [String(holiday.day).slice(0, 10), holiday.paid !== false]))
  );
  const located = (rows) => rows.map((row) => ({ ...row, ...zoned(row.at, timeZone) }));
  const locatedMessages = located(messages).sort((a, b) => new Date(a.at) - new Date(b.at) || a.contactId.localeCompare(b.contactId));
  const locatedEvents = located(events);
  const locatedActions = located(actions);
  const days = [];
  let leaveDays = 0;
  let holidayDays = 0;

  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    if (iso > today) break;
    // La journée en cours n'est une absence qu'une fois l'heure de fin passée.
    const shiftClosed = iso < today || !Number.isFinite(input.nowMin) || input.nowMin >= endMin;
    const beforeTracking = Boolean(input.attendanceSince) && iso < input.attendanceSince;
    if (!workDays.has(weekday(iso))) continue;
    const onLeave = (leaves || []).some((leave) => iso >= String(leave.startOn).slice(0, 10) && iso <= String(leave.endOn).slice(0, 10));
    if (onLeave) {
      leaveDays += 1;
      if (!beforeTracking) {
        days.push({
          day: iso,
          status: "LEAVE",
          lateMinutes: 0,
          earlyMinutes: 0,
          totalMinutes: 0,
          arrival: null,
          departure: null,
          arrivalFrom: null,
          departureFrom: null,
          waived: false,
          confirmed: false,
          confirmedLate: false,
          note: "",
          corrected: false
        });
      }
      continue;
    }
    if (holidayPaid.has(iso)) {
      holidayDays += 1;
      const paid = holidayPaid.get(iso);
      const holidayOverride = overrides.find((row) => row.day === iso);
      if (!paid && holidayOverride?.waived) {
        days.push({
          day: iso,
          status: "WAIVED",
          lateMinutes: 0,
          earlyMinutes: 0,
          totalMinutes: 0,
          arrival: null,
          departure: null,
          arrivalFrom: null,
          departureFrom: null,
          waived: true,
          confirmed: false,
          confirmedLate: false,
          note: holidayOverride.note || "",
          corrected: true
        });
      } else if (!paid) {
        const holidayConfirmed = Boolean(holidayOverride?.confirmedAbsent);
        if (!(beforeTracking && !holidayConfirmed) && (shiftClosed || holidayConfirmed)) {
          days.push({
            day: iso,
            status: "UNPAID_HOLIDAY",
            lateMinutes: 0,
            earlyMinutes: 0,
            totalMinutes: 0,
            arrival: null,
            departure: null,
            arrivalFrom: null,
            departureFrom: null,
            waived: false,
            confirmed: holidayConfirmed,
            confirmedLate: false,
            note: holidayOverride?.note || "",
            corrected: holidayConfirmed
          });
        }
      }
      continue;
    }
    const measured = measureDay({
      mode,
      day: iso,
      startMin,
      endMin,
      messages: locatedMessages,
      events: locatedEvents,
      actions: locatedActions,
      userId: input.userId
    });
    const override = overrides.find((row) => row.day === iso);
    const confirmed = Boolean(override?.confirmedAbsent);
    const corrected = Boolean(override && (override.waived || override.lateMinutes !== null || override.earlyMinutes !== null || confirmed || override.confirmedLate));
    if (beforeTracking && !corrected) continue;
    if (!shiftClosed && !corrected && (measured.status === "ABSENT" || measured.status === "NO_REPLY")) continue;
    const waived = Boolean(override?.waived) && !confirmed;
    let lateMinutes = waived ? 0 : override?.lateMinutes ?? measured.lateMinutes;
    // Le dernier message de la journée en cours n'est pas une sortie. Le départ anticipé
    // se mesure seulement après l'heure de fermeture, entre cette heure et l'heure de sortie.
    const earlyKnown = shiftClosed || (override?.earlyMinutes !== null && override?.earlyMinutes !== undefined);
    let earlyMinutes = waived ? 0 : earlyKnown ? (override?.earlyMinutes ?? measured.earlyMinutes) : 0;
    let status = waived ? "WAIVED" : measured.status;
    if (confirmed) {
      status = "ABSENT";
      lateMinutes = span;
      earlyMinutes = 0;
    } else if (status === "ABSENT" || status === "NO_REPLY") {
      lateMinutes = 0;
      earlyMinutes = 0;
    }
    const detected = lateMinutes + earlyMinutes;
    const confirmedLate = Boolean(override?.confirmedLate) && !confirmed && !waived && status === "PRESENT" && detected > 0;
    days.push({
      day: iso,
      status,
      lateMinutes,
      earlyMinutes,
      totalMinutes: status === "PRESENT" && !confirmedLate ? 0 : detected,
      arrival: measured.arrival,
      departure: shiftClosed ? measured.departure : null,
      arrivalFrom: measured.arrivalFrom,
      departureFrom: shiftClosed ? measured.departureFrom : null,
      waived,
      confirmed,
      confirmedLate,
      note: override?.note || "",
      corrected
    });
  }

  const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);
  const minuteValue = salary && divisor && span ? salary / (divisor * span) : null;
  const computedAmount = minuteValue === null ? null : round3(totalMinutes * minuteValue);
  return {
    days,
    leaveDays,
    holidayDays,
    totalMinutes,
    minuteValue: minuteValue === null ? null : round3(minuteValue),
    computedAmount,
    monthAmount: monthAmount === null || monthAmount === undefined ? null : round3(Number(monthAmount)),
    amount: monthAmount === null || monthAmount === undefined ? computedAmount : round3(Number(monthAmount))
  };
}

module.exports = { buildMonth, zoned, weekday };
