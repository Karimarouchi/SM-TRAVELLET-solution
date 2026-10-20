const { zoned } = require("./attendanceRules");

function pad(value) {
  return String(value).padStart(2, "0");
}

function instantAt(day, minutes, timeZone) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  let utc = Date.parse(`${day}T${pad(hour)}:${pad(minute)}:00Z`);
  for (let step = 0; step < 4; step += 1) {
    const found = zoned(new Date(utc), timeZone);
    const dayDelta = (Date.parse(`${found.day}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 60000;
    const delta = dayDelta + found.minutes - minutes;
    if (delta === 0) return new Date(utc);
    utc -= delta * 60000;
  }
  return new Date(utc);
}

function deadline(day, startMinutes, hours, timeZone) {
  return new Date(instantAt(day, startMinutes, timeZone).getTime() + Number(hours) * 3600000);
}

function onTime(submittedAt, day, startMinutes, hours, timeZone) {
  return new Date(submittedAt).getTime() <= deadline(day, startMinutes, hours, timeZone).getTime();
}

function shouldRemind(deadlineAt, now) {
  const left = new Date(deadlineAt).getTime() - new Date(now).getTime();
  return left > 0 && left <= 24 * 3600000;
}

module.exports = { deadline, onTime, instantAt, shouldRemind };
