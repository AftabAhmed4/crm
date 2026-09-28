import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";

// ======================================================
// CONFIG
// ======================================================

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

const BREAK_STATUSES = [
  "Namaz Break",
  "Lunch Break",
  "Short Break",
  "Washroom Break",
  "Other",
];

// ======================================================
// GET CALIFORNIA TIMEZONE OFFSET
// ======================================================

function getTimezoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const timezonePart = parts.find(
    (part) => part.type === "timeZoneName"
  );

  const value = timezonePart?.value || "GMT";

  if (value === "GMT") {
    return 0;
  }

  const match = value.match(
    /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/
  );

  if (!match) {
    return 0;
  }

  const sign = match[1] === "+" ? 1 : -1;

  const hours = Number(match[2]);

  const minutes = Number(
    match[3] || 0
  );

  return sign * (hours * 60 + minutes);
}

// ======================================================
// PARSE MYSQL DATETIME
// ======================================================

function parseMySQLDateTime(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    millisecond: match[7]
      ? Number(
          match[7]
            .padEnd(3, "0")
            .slice(0, 3)
        )
      : 0,
  };
}

// ======================================================
// CALIFORNIA WALL CLOCK -> REAL DATE
// ======================================================

function californiaWallClockToDate(parts) {
  if (!parts) {
    return null;
  }

  const wallClockAsUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );

  let guess = new Date(
    wallClockAsUTC
  );

  for (let i = 0; i < 5; i++) {
    const offsetMinutes =
      getTimezoneOffsetMinutes(
        guess,
        CALIFORNIA_TIMEZONE
      );

    const corrected = new Date(
      wallClockAsUTC -
        offsetMinutes * 60 * 1000
    );

    if (
      corrected.getTime() ===
      guess.getTime()
    ) {
      break;
    }

    guess = corrected;
  }

  if (Number.isNaN(guess.getTime())) {
    return null;
  }

  return guess;
}

// ======================================================
// MYSQL VALUE -> UTC ISO
// ======================================================

function mysqlToUtcDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  // ----------------------------------------------------
  // ISO WITH EXPLICIT TIMEZONE
  // ----------------------------------------------------

  if (
    raw.includes("T") &&
    (
      raw.endsWith("Z") ||
      /[+-]\d{2}:\d{2}$/.test(raw)
    )
  ) {
    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  // ----------------------------------------------------
  // MYSQL DATETIME
  // ----------------------------------------------------

  const parts =
    parseMySQLDateTime(raw);

  if (parts) {
    return californiaWallClockToDate(
      parts
    );
  }

  // ----------------------------------------------------
  // FALLBACK
  // ----------------------------------------------------

  const fallback = new Date(raw);

  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return fallback;
}

// ======================================================
// FORMAT CALIFORNIA FULL DATETIME
// ======================================================

function formatCaliforniaDateTime(date) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      weekday: "long",
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }
  ).format(date);
}

// ======================================================
// FORMAT CALIFORNIA SHORT
// ======================================================

function formatCaliforniaShort(date) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }
  ).format(date);
}

// ======================================================
// FORMAT CALIFORNIA DATE ONLY
// ======================================================

function formatCaliforniaDate(date) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      weekday: "long",
      month: "long",
      day: "2-digit",
      year: "numeric",
    }
  ).format(date);
}

// ======================================================
// FORMAT CALIFORNIA TIME ONLY
// ======================================================

function formatCaliforniaTimeOnly(date) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }
  ).format(date);
}

// ======================================================
// CURRENT CALIFORNIA DATE
// ======================================================

function getCaliforniaDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

// ======================================================
// CURRENT CALIFORNIA TIME
// ======================================================

function getCaliforniaTime() {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }
  ).format(new Date());
}

// ======================================================
// GET BREAK HISTORY
// ======================================================

export async function GET(request) {
  try {
    // ==================================================
    // TOKEN
    // ==================================================

    const token =
      request.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Login required",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // VERIFY TOKEN
    // ==================================================

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid or expired token",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // USER ID
    // ==================================================

    const currentUserId =
      decoded?.id ||
      decoded?._id ||
      decoded?.userId ||
      null;

    if (!currentUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User ID not found",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // GET CURRENT USER
    // ==================================================

    const [currentUserRows] =
      await pool.query(
        `
          SELECT
            id,
            name,
            email,
            role,
            team
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [currentUserId]
      );

    if (
      !currentUserRows ||
      currentUserRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found",
        },
        {
          status: 404,
        }
      );
    }

    const currentUser =
      currentUserRows[0];

    const currentRole = String(
      currentUser.role || ""
    ).toLowerCase();

    // ==================================================
    // QUERY
    // ==================================================

    let rows;

    if (currentRole === "admin") {
      // ================================================
      // ADMIN
      // ================================================

      [rows] = await pool.query(
        `
          SELECT
            h.id,
            h.user_id,
            u.name,
            u.email,
            u.team,
            u.role,
            h.status AS break_type,
            h.status,
            h.started_at,
            h.ended_at,
            h.duration_seconds,
            h.created_at
          FROM user_status_history h
          LEFT JOIN users u
            ON u.id = h.user_id
          WHERE h.status IN (
            'Namaz Break',
            'Lunch Break',
            'Short Break',
            'Washroom Break',
            'Other'
          )
          ORDER BY h.started_at DESC
        `
      );
    } else {
      // ================================================
      // NORMAL USER
      // ================================================

      [rows] = await pool.query(
        `
          SELECT
            h.id,
            h.user_id,
            u.name,
            u.email,
            u.team,
            u.role,
            h.status AS break_type,
            h.status,
            h.started_at,
            h.ended_at,
            h.duration_seconds,
            h.created_at
          FROM user_status_history h
          LEFT JOIN users u
            ON u.id = h.user_id
          WHERE h.user_id = ?
            AND h.status IN (
              'Namaz Break',
              'Lunch Break',
              'Short Break',
              'Washroom Break',
              'Other'
            )
          ORDER BY h.started_at DESC
        `,
        [currentUserId]
      );
    }

    // ==================================================
    // FORMAT BREAKS
    // ==================================================

    const breaks = rows.map(
      (row) => {
        // ==============================================
        // DURATION
        // ==============================================

        let durationSeconds = null;

        if (
          row.duration_seconds !==
            null &&
          row.duration_seconds !==
            undefined
        ) {
          const number =
            Number(
              row.duration_seconds
            );

          if (
            Number.isFinite(number) &&
            number >= 0
          ) {
            durationSeconds =
              Math.floor(number);
          }
        }

        // ==============================================
        // IMPORTANT FIX
        // ==============================================
        //
        // Your response proved:
        //
        // started_at:
        // 08:21 UTC
        //
        // created_at:
        // 20:21 UTC
        //
        // Both are same break.
        //
        // created_at is the correct break-start
        // timestamp.
        //
        // Therefore we use created_at as the
        // authoritative start time.
        // ==============================================

        let startedDate =
          mysqlToUtcDate(
            row.created_at
          );

        // ==============================================
        // FALLBACK
        // ==============================================

        if (!startedDate) {
          startedDate =
            mysqlToUtcDate(
              row.started_at
            );
        }

        // ==============================================
        // END TIME
        // ==============================================
        //
        // Existing ended_at is also 12 hours wrong.
        //
        // Example:
        //
        // Start = 20:21:34 UTC
        // Duration = 11 seconds
        //
        // Correct End =
        // 20:21:45 UTC
        //
        // So calculate end from start + duration.
        // ==============================================

        let endedDate = null;

        if (
          startedDate &&
          durationSeconds !== null
        ) {
          endedDate = new Date(
            startedDate.getTime() +
              durationSeconds * 1000
          );
        } else {
          endedDate =
            mysqlToUtcDate(
              row.ended_at
            );
        }

        // ==============================================
        // CREATED
        // ==============================================

        const createdDate =
          mysqlToUtcDate(
            row.created_at
          );

        // ==============================================
        // ACTIVE
        // ==============================================

        const isActive =
          !row.ended_at;

        // ==============================================
        // ISO
        // ==============================================

        const startedIso =
          startedDate
            ? startedDate.toISOString()
            : null;

        const endedIso =
          endedDate
            ? endedDate.toISOString()
            : null;

        const createdIso =
          createdDate
            ? createdDate.toISOString()
            : null;

        // ==============================================
        // RETURN
        // ==============================================

        return {
          // --------------------------------------------
          // BASIC
          // --------------------------------------------

          id: row.id,

          user_id:
            row.user_id,

          name:
            row.name ||
            "Unknown User",

          email:
            row.email ||
            "",

          team:
            row.team ||
            "",

          role:
            row.role ||
            "user",

          // --------------------------------------------
          // BREAK
          // --------------------------------------------

          break_type:
            row.break_type ||
            "Other",

          status:
            row.status ||
            row.break_type ||
            "Other",

          // --------------------------------------------
          // CORRECTED ISO
          // --------------------------------------------

          started_at:
            startedIso,

          ended_at:
            endedIso,

          created_at:
            createdIso,

          // --------------------------------------------
          // CALIFORNIA FULL
          // --------------------------------------------

          started_at_california:
            formatCaliforniaDateTime(
              startedDate
            ),

          ended_at_california:
            formatCaliforniaDateTime(
              endedDate
            ),

          created_at_california:
            formatCaliforniaDateTime(
              createdDate
            ),

          // --------------------------------------------
          // DATE
          // --------------------------------------------

          started_date_california:
            formatCaliforniaDate(
              startedDate
            ),

          ended_date_california:
            formatCaliforniaDate(
              endedDate
            ),

          created_date_california:
            formatCaliforniaDate(
              createdDate
            ),

          // --------------------------------------------
          // TIME
          // --------------------------------------------

          started_time_california:
            formatCaliforniaTimeOnly(
              startedDate
            ),

          ended_time_california:
            formatCaliforniaTimeOnly(
              endedDate
            ),

          created_time_california:
            formatCaliforniaTimeOnly(
              createdDate
            ),

          // --------------------------------------------
          // SHORT
          // --------------------------------------------

          started_short_california:
            formatCaliforniaShort(
              startedDate
            ),

          ended_short_california:
            formatCaliforniaShort(
              endedDate
            ),

          created_short_california:
            formatCaliforniaShort(
              createdDate
            ),

          // --------------------------------------------
          // DURATION
          // --------------------------------------------

          duration_seconds:
            durationSeconds,

          // --------------------------------------------
          // ACTIVE
          // --------------------------------------------

          is_active:
            isActive,
        };
      }
    );

    // ==================================================
    // STATS
    // ==================================================

    const stats = {
      total: breaks.length,

      namaz:
        breaks.filter(
          (item) =>
            item.break_type ===
            "Namaz Break"
        ).length,

      lunch:
        breaks.filter(
          (item) =>
            item.break_type ===
            "Lunch Break"
        ).length,

      shortBreak:
        breaks.filter(
          (item) =>
            item.break_type ===
            "Short Break"
        ).length,

      washroom:
        breaks.filter(
          (item) =>
            item.break_type ===
            "Washroom Break"
        ).length,

      other:
        breaks.filter(
          (item) =>
            item.break_type ===
            "Other"
        ).length,

      active:
        breaks.filter(
          (item) =>
            item.is_active
        ).length,
    };

    // ==================================================
    // CURRENT CALIFORNIA TIME
    // ==================================================

    const now = new Date();

    const timezoneLabel =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            CALIFORNIA_TIMEZONE,

          timeZoneName: "long",
        }
      )
        .formatToParts(now)
        .find(
          (part) =>
            part.type ===
            "timeZoneName"
        )?.value ||
      "Pacific Time";

    const californiaNow = {
      date:
        getCaliforniaDate(),

      time:
        getCaliforniaTime(),

      display:
        formatCaliforniaDateTime(
          now
        ),

      timestamp:
        now.toISOString(),

      timezone:
        CALIFORNIA_TIMEZONE,

      timezone_label:
        timezoneLabel,
    };

    // ==================================================
    // RESPONSE
    // ==================================================

    return NextResponse.json(
      {
        success: true,

        timezone:
          CALIFORNIA_TIMEZONE,

        timezone_name:
          "America/Los_Angeles",

        time_format:
          "12-hour AM/PM",

        date_format:
          "Month DD, YYYY",

        california_time:
          californiaNow,

        breaks,

        stats,

        current_user: {
          id:
            currentUser.id,

          name:
            currentUser.name,

          email:
            currentUser.email,

          role:
            currentUser.role,

          team:
            currentUser.team,
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "Surrogate-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "BREAK HISTORY API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to fetch break history",

        error:
          error?.message ||
          "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}