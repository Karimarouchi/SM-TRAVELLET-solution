function pad(n) {
  return String(n).padStart(2, "0");
}

function parseHm(value, fallback) {
  const match = String(value || fallback).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback === "18:00" ? { h: 18, m: 0 } : { h: 9, m: 0 };
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return fallback === "18:00" ? { h: 18, m: 0 } : { h: 9, m: 0 };
  return { h, m };
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    isoWeekday: weekdayMap[get("weekday")] || 1
  };
}

function zonedLocalToUtc(year, month, day, hour, minute, second, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const asIf = zonedParts(new Date(utcGuess), timeZone);
  const asIfUtc = Date.UTC(asIf.year, asIf.month - 1, asIf.day, asIf.hour, asIf.minute, asIf.second);
  return new Date(utcGuess + (utcGuess - asIfUtc));
}

function addDays(year, month, day, delta) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function parseWorkHours(raw) {
  const days = String(raw.days || "1,2,3,4,5")
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);
  const start = parseHm(raw.start, "09:00");
  const end = parseHm(raw.end, "18:00");
  const timezone = raw.timezone || "Africa/Tunis";
  const halfwayMinutes = Math.max(1, parseInt(raw.halfwayMinutes, 10) || 960);
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  return {
    days: days.length ? days : [1, 2, 3, 4, 5],
    start,
    end,
    startMin,
    endMin: endMin > startMin ? endMin : startMin + 1,
    timezone,
    halfwayMinutes
  };
}

function minutesOnDay(config, year, month, day, fromDate, toDate) {
  const weekday = zonedParts(zonedLocalToUtc(year, month, day, 12, 0, 0, config.timezone), config.timezone).isoWeekday;
  if (!config.days.includes(weekday)) return 0;
  const dayStart = zonedLocalToUtc(year, month, day, config.start.h, config.start.m, 0, config.timezone);
  const dayEnd = zonedLocalToUtc(year, month, day, Math.floor(config.endMin / 60), config.endMin % 60, 0, config.timezone);
  const start = Math.max(fromDate.getTime(), dayStart.getTime());
  const end = Math.min(toDate.getTime(), dayEnd.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 60000);
}

function businessMinutesBetween(from, to, config) {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

  const fromParts = zonedParts(start, config.timezone);
  const toParts = zonedParts(end, config.timezone);
  let cursor = { year: fromParts.year, month: fromParts.month, day: fromParts.day };
  const lastKey = `${toParts.year}-${toParts.month}-${toParts.day}`;
  let total = 0;
  for (let i = 0; i < 800; i += 1) {
    total += minutesOnDay(config, cursor.year, cursor.month, cursor.day, start, end);
    const key = `${cursor.year}-${cursor.month}-${cursor.day}`;
    if (key === lastKey) break;
    cursor = addDays(cursor.year, cursor.month, cursor.day, 1);
  }
  return total;
}

function formatMinutes(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

module.exports = {
  pad,
  parseWorkHours,
  businessMinutesBetween,
  formatMinutes,
  average
};
