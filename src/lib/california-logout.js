const TIME_ZONE = "America/Los_Angeles";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getCaliforniaParts(date) {
  return Object.fromEntries(
    dateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  );
}

function shiftCalendarDate({ year, month, day }, amount) {
  const shiftedDate = new Date(Date.UTC(year, month - 1, day + amount));

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
    day: shiftedDate.getUTCDate(),
  };
}

function getCutoffForDate({ year, month, day }) {
  const targetAsUtc = Date.UTC(year, month - 1, day, 17, 30);
  let cutoff = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getCaliforniaParts(new Date(cutoff));
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );

    cutoff += targetAsUtc - representedAsUtc;
  }

  return cutoff;
}

export function getNextCaliforniaLogout(now = new Date()) {
  const today = getCaliforniaParts(now);
  let cutoff = getCutoffForDate(today);

  if (cutoff <= now.getTime()) {
    cutoff = getCutoffForDate(shiftCalendarDate(today, 1));
  }

  return cutoff;
}

export function getMostRecentCaliforniaLogout(now = new Date()) {
  const today = getCaliforniaParts(now);
  let cutoff = getCutoffForDate(today);

  if (cutoff > now.getTime()) {
    cutoff = getCutoffForDate(shiftCalendarDate(today, -1));
  }

  return cutoff;
}

export function isSessionCurrentForCaliforniaDay(payload, now = new Date()) {
  return (
    Number.isFinite(payload?.iat) &&
    payload.iat * 1000 >= getMostRecentCaliforniaLogout(now)
  );
}

export function formatCaliforniaDateTime(date) {
  const { year, month, day, hour, minute, second } =
    getCaliforniaParts(date);

  return [
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
  ].join(" ");
}
