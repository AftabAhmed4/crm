import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// CONFIG
// ============================================================

const COOKIE_NAME = "token";
const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

// ============================================================
// ALLOWED STATUSES
// ============================================================

const ALLOWED_STATUSES = [
  "Active",
  "Namaz Break",
  "Lunch Break",
  "Short Break",
  "Inactive",
  "On Call",
  "Meeting",
  "Washroom Break",
  "Other",
];

// Only these 3 are controlled breaks.
const BREAK_STATUSES = [
  "Namaz Break",
  "Lunch Break",
  "Short Break",
];

// ============================================================
// ROLLING 24 HOUR LIMITS
// ============================================================

const MAX_BREAKS_PER_24_HOURS = 5;

const MAX_NAMAZ_BREAKS_PER_24_HOURS = 1;
const MAX_LUNCH_BREAKS_PER_24_HOURS = 1;
const MAX_SHORT_BREAKS_PER_24_HOURS = 3;

// ============================================================
// BREAK MAX DURATION
//
// IMPORTANT:
// These are MAXIMUM durations.
//
// Early end:
// Short 4 min -> 240 seconds
//
// Full:
// Short 10 min -> 600 seconds
//
// Never above maximum.
// ============================================================

const BREAK_DURATION_LIMITS_MINUTES = {
  "Namaz Break": 15,
  "Lunch Break": 30,
  "Short Break": 10,
};

// ============================================================
// AUTH
// ============================================================

function getUserIdFromToken(request) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is missing");
      return null;
    }

    const decoded = jwt.verify(token, secret);

    const id =
      decoded?.id ??
      decoded?.userId ??
      decoded?.user_id ??
      decoded?.sub;

    if (
      id === undefined ||
      id === null ||
      id === ""
    ) {
      return null;
    }

    const numericId = Number(id);

    if (
      !Number.isFinite(numericId) ||
      numericId <= 0
    ) {
      return null;
    }

    return numericId;
  } catch (error) {
    console.error(
      "JWT verification error:",
      error
    );

    return null;
  }
}

// ============================================================
// CALIFORNIA TIME HELPERS
// ============================================================

function getCaliforniaParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,

      year: "numeric",
      month: "2-digit",
      day: "2-digit",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hour12: false,
    }
  );

  const parts = formatter.formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day),

    hour: Number(result.hour),
    minute: Number(result.minute),
    second: Number(result.second),
  };
}

// ============================================================
// CALIFORNIA DATE
// ============================================================

function getCaliforniaDate(date = new Date()) {
  const parts = getCaliforniaParts(date);

  return (
    `${String(parts.year).padStart(4, "0")}-` +
    `${String(parts.month).padStart(2, "0")}-` +
    `${String(parts.day).padStart(2, "0")}`
  );
}

// ============================================================
// CALIFORNIA DATETIME FOR MYSQL
//
// Stored as California wall-clock DATETIME.
// ============================================================

function getCaliforniaDBDateTime(date = new Date()) {
  const parts = getCaliforniaParts(date);

  return (
    `${String(parts.year).padStart(4, "0")}-` +
    `${String(parts.month).padStart(2, "0")}-` +
    `${String(parts.day).padStart(2, "0")} ` +
    `${String(parts.hour).padStart(2, "0")}:` +
    `${String(parts.minute).padStart(2, "0")}:` +
    `${String(parts.second).padStart(2, "0")}`
  );
}

// ============================================================
// DISPLAY TIME
// ============================================================

function getCaliforniaDisplayTime(date = new Date()) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,

      year: "numeric",
      month: "short",
      day: "2-digit",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hour12: true,
    }
  ).format(date);
}

// ============================================================
// TIME INFO
// ============================================================

function getTimeInfo() {
  const now = new Date();

  const parts = getCaliforniaParts(now);

  return {
    serverNowMs: now.getTime(),

    californiaDate:
      getCaliforniaDate(now),

    californiaNow:
      getCaliforniaDBDateTime(now),

    californiaDisplayTime:
      getCaliforniaDisplayTime(now),

    californiaHour:
      parts.hour,

    californiaMinute:
      parts.minute,

    californiaSecond:
      parts.second,

    iso:
      now.toISOString(),
  };
}

// ============================================================
// BREAK START TIME RESTRICTION
//
// 12:00 AM - 7:59:59 AM = ALLOWED
// 8:00 AM  - 8:59:59 AM = BLOCKED
// 9:00 AM onward         = ALLOWED
//
// ONLY NEW BREAK STARTS ARE BLOCKED.
// Existing break is NOT stopped at 8 AM.
// ============================================================

function isBreakAllowedAtCaliforniaTime(
  date = new Date()
) {
  const parts = getCaliforniaParts(date);

  const totalMinutes =
    parts.hour * 60 +
    parts.minute;

  const BLOCK_START = 8 * 60;
  const BLOCK_END = 9 * 60;

  return !(
    totalMinutes >= BLOCK_START &&
    totalMinutes < BLOCK_END
  );
}

// ============================================================
// RESTRICTION MESSAGE
// ============================================================

function getBreakRestrictionMessage(
  date = new Date()
) {
  const parts = getCaliforniaParts(date);

  const currentTime =
    `${String(parts.hour).padStart(2, "0")}:` +
    `${String(parts.minute).padStart(2, "0")}:` +
    `${String(parts.second).padStart(2, "0")}`;

  return (
    "Breaks are not allowed from 8:00 AM to 9:00 AM California time. " +
    `Current California time is ${currentTime}. ` +
    "Breaks are available again at 9:00 AM."
  );
}

// ============================================================
// STATUS HELPERS
// ============================================================

function isBreakStatus(status) {
  return BREAK_STATUSES.includes(status);
}

function getBreakDurationLimitMinutes(status) {
  return (
    BREAK_DURATION_LIMITS_MINUTES[status] ||
    0
  );
}

function getBreakDurationLimitSeconds(status) {
  return (
    getBreakDurationLimitMinutes(status) *
    60
  );
}

// ============================================================
// CALIFORNIA DATETIME -> REAL TIMESTAMP
//
// IMPORTANT FIX:
//
// mysql2 can return DATETIME as either:
//   - string
//   - JavaScript Date
//
// We treat database DATETIME as California wall-clock time.
// We DO NOT blindly call new Date(value).
// ============================================================

function californiaDateTimeToMs(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  try {
    // ========================================================
    // CASE 1: JavaScript Date
    // ========================================================

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }

      const year = value.getFullYear();
      const month = value.getMonth() + 1;
      const day = value.getDate();

      const hour = value.getHours();
      const minute = value.getMinutes();
      const second = value.getSeconds();

      const desiredWallAsUTC = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );

      let guess = desiredWallAsUTC;

      for (let i = 0; i < 8; i++) {
        const parts = getCaliforniaParts(
          new Date(guess)
        );

        const actualWallAsUTC = Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second
        );

        const difference =
          desiredWallAsUTC -
          actualWallAsUTC;

        if (difference === 0) {
          break;
        }

        guess += difference;
      }

      return guess;
    }

    // ========================================================
    // CASE 2: STRING
    // ========================================================

    let text = String(value).trim();

    if (!text) {
      return null;
    }

    text = text.replace("T", " ");

    // Remove milliseconds if present.
    text = text.replace(
      /\.(\d{1,6})$/,
      ""
    );

    const match = text.match(
      /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) {
      console.error(
        "Invalid California DATETIME:",
        value
      );

      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return null;
    }

    const desiredWallAsUTC = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

    let guess = desiredWallAsUTC;

    for (let i = 0; i < 8; i++) {
      const parts = getCaliforniaParts(
        new Date(guess)
      );

      const actualWallAsUTC = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      );

      const difference =
        desiredWallAsUTC -
        actualWallAsUTC;

      if (difference === 0) {
        break;
      }

      guess += difference;
    }

    return guess;
  } catch (error) {
    console.error(
      "californiaDateTimeToMs error:",
      error
    );

    return null;
  }
}

// ============================================================
// BREAK TIMER
//
// HARD GUARANTEE:
//
// elapsedSeconds <= maximum
// remainingSeconds >= 0
// ============================================================

function calculateBreakTimer(
  status,
  startedAt,
  serverNowMs = Date.now()
) {
  if (
    !isBreakStatus(status) ||
    !startedAt
  ) {
    return {
      isBreak: false,

      elapsedSeconds: 0,
      remainingSeconds: 0,

      durationLimitMinutes: 0,
      durationLimitSeconds: 0,

      expired: false,
    };
  }

  const durationLimitMinutes =
    getBreakDurationLimitMinutes(
      status
    );

  const durationLimitSeconds =
    getBreakDurationLimitSeconds(
      status
    );

  const startedMs =
    californiaDateTimeToMs(
      startedAt
    );

  if (startedMs === null) {
    return {
      isBreak: true,

      elapsedSeconds: 0,

      remainingSeconds:
        durationLimitSeconds,

      durationLimitMinutes,
      durationLimitSeconds,

      expired: false,
    };
  }

  const rawElapsedSeconds =
    Math.floor(
      Math.max(
        0,
        serverNowMs - startedMs
      ) / 1000
    );

  const elapsedSeconds =
    Math.min(
      rawElapsedSeconds,
      durationLimitSeconds
    );

  const remainingSeconds =
    Math.max(
      0,
      durationLimitSeconds -
        elapsedSeconds
    );

  return {
    isBreak: true,

    elapsedSeconds,

    remainingSeconds,

    durationLimitMinutes,
    durationLimitSeconds,

    expired:
      rawElapsedSeconds >=
      durationLimitSeconds,
  };
}

// ============================================================
// GET USER
// ============================================================

async function getUserById(
  connectionOrPool,
  userId
) {
  const [rows] =
    await connectionOrPool.query(
      `
        SELECT
          id,
          name,
          email,
          role,
          availability_status,
          status_started_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

  return rows?.[0] || null;
}

// ============================================================
// TOTAL BREAK COUNT
// ============================================================

async function getTotalBreakCount(
  connection,
  userId,
  nowDb
) {
  const [rows] =
    await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM user_status_history
        WHERE user_id = ?
          AND status IN (?, ?, ?)
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        "Namaz Break",
        "Lunch Break",
        "Short Break",
        nowDb,
      ]
    );

  return Number(
    rows?.[0]?.count || 0
  );
}

// ============================================================
// NAMAZ COUNT
// ============================================================

async function getNamazBreakCount(
  connection,
  userId,
  nowDb
) {
  const [rows] =
    await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM user_status_history
        WHERE user_id = ?
          AND status = ?
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        "Namaz Break",
        nowDb,
      ]
    );

  return Number(
    rows?.[0]?.count || 0
  );
}

// ============================================================
// LUNCH COUNT
// ============================================================

async function getLunchBreakCount(
  connection,
  userId,
  nowDb
) {
  const [rows] =
    await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM user_status_history
        WHERE user_id = ?
          AND status = ?
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        "Lunch Break",
        nowDb,
      ]
    );

  return Number(
    rows?.[0]?.count || 0
  );
}

// ============================================================
// SHORT COUNT
// ============================================================

async function getShortBreakCount(
  connection,
  userId,
  nowDb
) {
  const [rows] =
    await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM user_status_history
        WHERE user_id = ?
          AND status = ?
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        "Short Break",
        nowDb,
      ]
    );

  return Number(
    rows?.[0]?.count || 0
  );
}

// ============================================================
// LIMIT INFO
// ============================================================

async function buildLimitInfo(
  connection,
  userId,
  nowDb
) {
  const [
    total,
    namaz,
    lunch,
    short,
  ] = await Promise.all([
    getTotalBreakCount(
      connection,
      userId,
      nowDb
    ),

    getNamazBreakCount(
      connection,
      userId,
      nowDb
    ),

    getLunchBreakCount(
      connection,
      userId,
      nowDb
    ),

    getShortBreakCount(
      connection,
      userId,
      nowDb
    ),
  ]);

  return {
    total: {
      used: total,

      max:
        MAX_BREAKS_PER_24_HOURS,

      remaining:
        Math.max(
          0,
          MAX_BREAKS_PER_24_HOURS -
            total
        ),

      reached:
        total >=
        MAX_BREAKS_PER_24_HOURS,
    },

    namaz: {
      used: namaz,

      max:
        MAX_NAMAZ_BREAKS_PER_24_HOURS,

      remaining:
        Math.max(
          0,
          MAX_NAMAZ_BREAKS_PER_24_HOURS -
            namaz
        ),

      reached:
        namaz >=
        MAX_NAMAZ_BREAKS_PER_24_HOURS,
    },

    lunch: {
      used: lunch,

      max:
        MAX_LUNCH_BREAKS_PER_24_HOURS,

      remaining:
        Math.max(
          0,
          MAX_LUNCH_BREAKS_PER_24_HOURS -
            lunch
        ),

      reached:
        lunch >=
        MAX_LUNCH_BREAKS_PER_24_HOURS,
    },

    short: {
      used: short,

      max:
        MAX_SHORT_BREAKS_PER_24_HOURS,

      remaining:
        Math.max(
          0,
          MAX_SHORT_BREAKS_PER_24_HOURS -
            short
        ),

      reached:
        short >=
        MAX_SHORT_BREAKS_PER_24_HOURS,
    },
  };
}

// ============================================================
// SIMPLE USAGE
// ============================================================

function buildBreakUsageFromLimits(
  limits
) {
  return {
    "Short Break":
      Number(
        limits?.short?.used || 0
      ),

    "Lunch Break":
      Number(
        limits?.lunch?.used || 0
      ),

    "Namaz Break":
      Number(
        limits?.namaz?.used || 0
      ),
  };
}

// ============================================================
// CURRENT BREAK INFO
// ============================================================

function buildCurrentBreakInfo(
  user,
  serverNowMs
) {
  if (
    !user ||
    !isBreakStatus(
      user.availability_status
    )
  ) {
    return {
      isBreak: false,

      status: null,
      startedAt: null,

      elapsedSeconds: 0,
      remainingSeconds: 0,

      durationLimitMinutes: 0,
      durationLimitSeconds: 0,

      expired: false,
    };
  }

  const timer =
    calculateBreakTimer(
      user.availability_status,
      user.status_started_at,
      serverNowMs
    );

  return {
    ...timer,

    status:
      user.availability_status,

    startedAt:
      user.status_started_at,
  };
}

// ============================================================
// CLOSE CURRENT OPEN HISTORY
//
// THIS IS THE MAIN FIX.
//
// If Short Break started at 01:41:18
// and user clicks End at 01:45:18:
//
// duration_seconds = 240
// ended_at         = 01:45:18
//
// NOT:
//
// duration_seconds = 600
// ended_at         = 01:51:18
//
// Maximum is ONLY a ceiling.
// ============================================================

async function closeOpenHistory(
  connection,
  userId,
  serverNowMs,
  fallbackEndedAt
) {
  const [openRows] =
    await connection.query(
      `
        SELECT
          id,
          status,
          started_at
        FROM user_status_history
        WHERE user_id = ?
          AND ended_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [userId]
    );

  const openHistory =
    openRows?.[0];

  if (!openHistory) {
    return {
      closed: false,

      durationSeconds: 0,

      endedAt:
        fallbackEndedAt,

      status: null,
    };
  }

  const startedMs =
    californiaDateTimeToMs(
      openHistory.started_at
    );

  if (startedMs === null) {
    console.error(
      "Invalid started_at:",
      openHistory.started_at
    );

    return {
      closed: false,

      durationSeconds: 0,

      endedAt:
        fallbackEndedAt,

      status:
        openHistory.status,
    };
  }

  // ==========================================================
  // ACTUAL ELAPSED TIME
  // ==========================================================

  const rawElapsedSeconds =
    Math.floor(
      Math.max(
        0,
        serverNowMs -
          startedMs
      ) / 1000
    );

  let durationSeconds =
    Math.max(
      0,
      rawElapsedSeconds
    );

  let endedAt =
    fallbackEndedAt;

  // ==========================================================
  // CONTROLLED BREAK
  // ==========================================================

  if (
    isBreakStatus(
      openHistory.status
    )
  ) {
    const maxSeconds =
      getBreakDurationLimitSeconds(
        openHistory.status
      );

    // ========================================================
    // HARD MAXIMUM
    // ========================================================

    durationSeconds =
      Math.min(
        durationSeconds,
        maxSeconds
      );

    // ========================================================
    // MAXIMUM REACHED
    //
    // End exactly at:
    // started + maximum
    // ========================================================

    if (
      rawElapsedSeconds >=
      maxSeconds
    ) {
      durationSeconds =
        maxSeconds;

      endedAt =
        getCaliforniaDBDateTime(
          new Date(
            startedMs +
              maxSeconds *
                1000
          )
        );
    }

    // ========================================================
    // EARLY MANUAL END
    //
    // IMPORTANT:
    // Use actual current server time.
    // ========================================================

    else {
      durationSeconds =
        Math.min(
          Math.max(
            0,
            rawElapsedSeconds
          ),
          maxSeconds
        );

      endedAt =
        getCaliforniaDBDateTime(
          new Date(
            serverNowMs
          )
        );
    }
  }

  // ==========================================================
  // NON-BREAK STATUS
  // ==========================================================

  else {
    durationSeconds =
      Math.max(
        0,
        rawElapsedSeconds
      );

    endedAt =
      getCaliforniaDBDateTime(
        new Date(
          serverNowMs
        )
      );
  }

  // ==========================================================
  // SAVE ACTUAL RESULT
  // ==========================================================

  await connection.query(
    `
      UPDATE user_status_history
      SET
        ended_at = ?,
        duration_seconds = ?
      WHERE id = ?
      LIMIT 1
    `,
    [
      endedAt,
      durationSeconds,
      openHistory.id,
    ]
  );

  console.log(
    "STATUS HISTORY CLOSED",
    {
      userId,

      historyId:
        openHistory.id,

      status:
        openHistory.status,

      startedAt:
        openHistory.started_at,

      endedAt,

      rawElapsedSeconds,

      savedDurationSeconds:
        durationSeconds,
    }
  );

  return {
    closed: true,

    durationSeconds,

    endedAt,

    status:
      openHistory.status,
  };
}

// ============================================================
// AUTO EXPIRE BREAK
//
// Example:
//
// Short started 01:41:18
// Maximum = 10 minutes
//
// Exact expiry:
// 01:51:18
//
// duration_seconds = 600
// ============================================================

async function autoExpireBreak(
  user,
  serverNowMs
) {
  if (
    !user ||
    !isBreakStatus(
      user.availability_status
    ) ||
    !user.status_started_at
  ) {
    return {
      expired: false,
      user,
    };
  }

  const timer =
    calculateBreakTimer(
      user.availability_status,
      user.status_started_at,
      serverNowMs
    );

  if (!timer.expired) {
    return {
      expired: false,
      user,
    };
  }

  const status =
    user.availability_status;

  const limitSeconds =
    getBreakDurationLimitSeconds(
      status
    );

  const startedMs =
    californiaDateTimeToMs(
      user.status_started_at
    );

  if (startedMs === null) {
    return {
      expired: false,
      user,
    };
  }

  const expiryMs =
    startedMs +
    limitSeconds *
      1000;

  const exactEndedAt =
    getCaliforniaDBDateTime(
      new Date(
        expiryMs
      )
    );

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ========================================================
    // LOCK USER
    // ========================================================

    const [lockedUsers] =
      await connection.query(
        `
          SELECT
            id,
            name,
            email,
            role,
            availability_status,
            status_started_at
          FROM users
          WHERE id = ?
          FOR UPDATE
        `,
        [user.id]
      );

    const lockedUser =
      lockedUsers?.[0];

    if (!lockedUser) {
      await connection.rollback();

      return {
        expired: false,
        user,
      };
    }

    // ========================================================
    // STATUS CHANGED
    // ========================================================

    if (
      lockedUser.availability_status !==
        status ||
      String(
        lockedUser.status_started_at ||
          ""
      ) !==
        String(
          user.status_started_at ||
            ""
        )
    ) {
      await connection.rollback();

      return {
        expired: false,
        user: lockedUser,
      };
    }

    // ========================================================
    // LOCK OPEN BREAK
    // ========================================================

    const [historyRows] =
      await connection.query(
        `
          SELECT
            id,
            status,
            started_at
          FROM user_status_history
          WHERE user_id = ?
            AND status = ?
            AND ended_at IS NULL
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [
          user.id,
          status,
        ]
      );

    const history =
      historyRows?.[0];

    if (history) {
      await connection.query(
        `
          UPDATE user_status_history
          SET
            ended_at = ?,
            duration_seconds = ?
          WHERE id = ?
          LIMIT 1
        `,
        [
          exactEndedAt,
          limitSeconds,
          history.id,
        ]
      );
    }

    // ========================================================
    // RESET USER TO ACTIVE
    // ========================================================

    await connection.query(
      `
        UPDATE users
        SET
          availability_status = ?,
          status_started_at = NULL
        WHERE id = ?
        LIMIT 1
      `,
      [
        "Active",
        user.id,
      ]
    );

    await connection.commit();

    const updatedUser =
      await getUserById(
        pool,
        user.id
      );

    return {
      expired: true,

      user:
        updatedUser,

      expiredStatus:
        status,

      durationSeconds:
        limitSeconds,

      endedAt:
        exactEndedAt,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "autoExpireBreak error:",
      error
    );

    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// RESPONSE BUILDER
// ============================================================

function buildResponseData({
  user,
  limits,
  timer,
  time,

  autoExpired = false,
  autoExpiredStatus = null,
  autoExpiredDurationSeconds = null,
  autoExpiredEndedAt = null,
}) {
  return {
    success: true,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },

    status:
      user.availability_status ||
      "Active",

    status_started_at:
      user.status_started_at,

    // ========================================================
    // BREAK USAGE
    // ========================================================

    break_usage:
      buildBreakUsageFromLimits(
        limits
      ),

    breakUsage:
      buildBreakUsageFromLimits(
        limits
      ),

    usage:
      buildBreakUsageFromLimits(
        limits
      ),

    // ========================================================
    // LIMITS
    // ========================================================

    limits,

    // ========================================================
    // TIMER
    // ========================================================

    timer,

    elapsedSeconds:
      timer?.elapsedSeconds || 0,

    remainingSeconds:
      timer?.remainingSeconds || 0,

    durationLimitMinutes:
      timer?.durationLimitMinutes || 0,

    durationLimitSeconds:
      timer?.durationLimitSeconds || 0,

    // ========================================================
    // BREAK CONFIG
    // ========================================================

    breakDurationLimits:
      BREAK_DURATION_LIMITS_MINUTES,

    // ========================================================
    // BREAK TIME RULES
    // ========================================================

    breakTimeRules: {
      allowed:
        isBreakAllowedAtCaliforniaTime(),

      blockedFrom:
        "08:00 AM",

      blockedUntil:
        "09:00 AM",

      allowedFrom:
        "09:00 AM",

      timezone:
        CALIFORNIA_TIMEZONE,
    },

    // ========================================================
    // AUTO EXPIRY
    // ========================================================

    autoExpired,

    autoExpiredStatus,

    autoExpiredDurationSeconds,

    autoExpiredEndedAt,

    // ========================================================
    // SERVER CLOCK
    // ========================================================

    serverClock: {
      nowMs:
        Date.now(),

      iso:
        new Date().toISOString(),

      californiaDate:
        time.californiaDate,

      californiaNow:
        time.californiaNow,

      californiaDisplayTime:
        time.californiaDisplayTime,

      californiaHour:
        time.californiaHour,

      californiaMinute:
        time.californiaMinute,

      californiaSecond:
        time.californiaSecond,
    },
  };
}

// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    const userId =
      getUserIdFromToken(
        request
      );

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const time =
      getTimeInfo();

    let user =
      await getUserById(
        pool,
        userId
      );

    if (!user) {
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

    // ========================================================
    // AUTO EXPIRE
    // ========================================================

    const autoExpired =
      await autoExpireBreak(
        user,
        time.serverNowMs
      );

    if (
      autoExpired.expired
    ) {
      user =
        autoExpired.user;
    }

    // ========================================================
    // LIMITS
    // ========================================================

    const connection =
      await pool.getConnection();

    let limits;

    try {
      limits =
        await buildLimitInfo(
          connection,
          userId,
          time.californiaNow
        );
    } finally {
      connection.release();
    }

    // ========================================================
    // TIMER
    // ========================================================

    const timer =
      buildCurrentBreakInfo(
        user,
        Date.now()
      );

    return NextResponse.json(
      buildResponseData({
        user,

        limits,

        timer,

        time,

        autoExpired:
          autoExpired.expired,

        autoExpiredStatus:
          autoExpired.expired
            ? autoExpired.expiredStatus
            : null,

        autoExpiredDurationSeconds:
          autoExpired.expired
            ? autoExpired.durationSeconds
            : null,

        autoExpiredEndedAt:
          autoExpired.expired
            ? autoExpired.endedAt
            : null,
      }),
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma: "no-cache",

          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/users/status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to get user status",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// PUT
// ============================================================

export async function PUT(request) {
  let connection = null;

  try {
    const userId =
      getUserIdFromToken(
        request
      );

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const requestedStatus =
      String(
        body?.status || ""
      ).trim();

    // ========================================================
    // VALIDATE STATUS
    // ========================================================

    if (
      !ALLOWED_STATUSES.includes(
        requestedStatus
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid status",
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date();

    const serverNowMs =
      now.getTime();

    const californiaNow =
      getCaliforniaDBDateTime(
        now
      );

    // ========================================================
    // BREAK TIME RESTRICTION
    //
    // Only NEW break starts.
    //
    // Ending current break is always allowed.
    // ========================================================

    if (
      isBreakStatus(
        requestedStatus
      ) &&
      !isBreakAllowedAtCaliforniaTime(
        now
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          code:
            "BREAK_TIME_RESTRICTED",

          message:
            getBreakRestrictionMessage(
              now
            ),

          breakAllowed:
            false,

          breakTimeRules: {
            timezone:
              CALIFORNIA_TIMEZONE,

            blockedFrom:
              "08:00 AM",

            blockedUntil:
              "09:00 AM",

            allowedFrom:
              "09:00 AM",
          },

          serverClock: {
            californiaNow,

            californiaDisplayTime:
              getCaliforniaDisplayTime(
                now
              ),
          },
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // CONNECTION
    // ========================================================

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    // ========================================================
    // LOCK USER
    // ========================================================

    const [userRows] =
      await connection.query(
        `
          SELECT
            id,
            name,
            email,
            role,
            availability_status,
            status_started_at
          FROM users
          WHERE id = ?
          FOR UPDATE
        `,
        [userId]
      );

    let user =
      userRows?.[0];

    if (!user) {
      await connection.rollback();

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

    const currentStatus =
      user.availability_status ||
      "Active";

    // ========================================================
    // SAME STATUS
    // ========================================================

    if (
      currentStatus ===
      requestedStatus
    ) {
      const limits =
        await buildLimitInfo(
          connection,
          userId,
          californiaNow
        );

      const timer =
        buildCurrentBreakInfo(
          user,
          serverNowMs
        );

      await connection.commit();

      return NextResponse.json(
        buildResponseData({
          user,

          limits,

          timer,

          time:
            getTimeInfo(),
        }),
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    // ========================================================
    // NEW BREAK
    // ========================================================

    if (
      isBreakStatus(
        requestedStatus
      )
    ) {
      // ======================================================
      // TOTAL LIMIT
      // ======================================================

      const totalBreakCount =
        await getTotalBreakCount(
          connection,
          userId,
          californiaNow
        );

      if (
        totalBreakCount >=
        MAX_BREAKS_PER_24_HOURS
      ) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,

            code:
              "TOTAL_BREAK_LIMIT_REACHED",

            message:
              `Maximum ${MAX_BREAKS_PER_24_HOURS} breaks are allowed within 24 hours.`,

            limits: {
              totalUsed:
                totalBreakCount,

              totalMax:
                MAX_BREAKS_PER_24_HOURS,
            },
          },
          {
            status: 403,
          }
        );
      }

      // ======================================================
      // SPECIFIC LIMIT
      // ======================================================

      let specificCount = 0;
      let specificMax = 0;

      if (
        requestedStatus ===
        "Namaz Break"
      ) {
        specificCount =
          await getNamazBreakCount(
            connection,
            userId,
            californiaNow
          );

        specificMax =
          MAX_NAMAZ_BREAKS_PER_24_HOURS;
      }

      if (
        requestedStatus ===
        "Lunch Break"
      ) {
        specificCount =
          await getLunchBreakCount(
            connection,
            userId,
            californiaNow
          );

        specificMax =
          MAX_LUNCH_BREAKS_PER_24_HOURS;
      }

      if (
        requestedStatus ===
        "Short Break"
      ) {
        specificCount =
          await getShortBreakCount(
            connection,
            userId,
            californiaNow
          );

        specificMax =
          MAX_SHORT_BREAKS_PER_24_HOURS;
      }

      if (
        specificCount >=
        specificMax
      ) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,

            code:
              "SPECIFIC_BREAK_LIMIT_REACHED",

            message:
              `${requestedStatus} limit of ${specificMax} within 24 hours has been reached.`,

            status:
              requestedStatus,

            used:
              specificCount,

            max:
              specificMax,
          },
          {
            status: 403,
          }
        );
      }
    }

    // ========================================================
    // CLOSE CURRENT OPEN HISTORY
    //
    // If current Short Break:
    //
    // Start = 01:41:18
    // End   = 01:45:18
    //
    // Save:
    // duration_seconds = 240
    //
    // NOT 600.
    // ========================================================

    if (
      currentStatus !==
        "Active" &&
      user.status_started_at
    ) {
      await closeOpenHistory(
        connection,
        userId,
        serverNowMs,
        californiaNow
      );
    }

    // ========================================================
    // SET ACTIVE
    // ========================================================

    if (
      requestedStatus ===
      "Active"
    ) {
      await connection.query(
        `
          UPDATE users
          SET
            availability_status = ?,
            status_started_at = NULL
          WHERE id = ?
          LIMIT 1
        `,
        [
          "Active",
          userId,
        ]
      );
    }

    // ========================================================
    // START NEW STATUS / BREAK
    // ========================================================

    else {
      await connection.query(
        `
          INSERT INTO user_status_history
          (
            user_id,
            status,
            started_at,
            ended_at,
            duration_seconds
          )
          VALUES
          (
            ?,
            ?,
            ?,
            NULL,
            0
          )
        `,
        [
          userId,

          requestedStatus,

          californiaNow,
        ]
      );

      await connection.query(
        `
          UPDATE users
          SET
            availability_status = ?,
            status_started_at = ?
          WHERE id = ?
          LIMIT 1
        `,
        [
          requestedStatus,

          californiaNow,

          userId,
        ]
      );
    }

    // ========================================================
    // GET UPDATED USER
    // ========================================================

    const [updatedRows] =
      await connection.query(
        `
          SELECT
            id,
            name,
            email,
            role,
            availability_status,
            status_started_at
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [userId]
      );

    user =
      updatedRows?.[0];

    // ========================================================
    // UPDATED LIMITS
    // ========================================================

    const limits =
      await buildLimitInfo(
        connection,
        userId,
        californiaNow
      );

    // ========================================================
    // UPDATED TIMER
    // ========================================================

    const timer =
      buildCurrentBreakInfo(
        user,
        serverNowMs
      );

    await connection.commit();

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      buildResponseData({
        user,

        limits,

        timer,

        time:
          getTimeInfo(),
      }),
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          Pragma: "no-cache",

          Expires: "0",
        },
      }
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      "PUT /api/users/status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to update user status",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}