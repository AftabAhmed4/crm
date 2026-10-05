import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// CONFIG
// ============================================================

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
];

const BREAK_STATUSES = [
  "Namaz Break",
  "Lunch Break",
  "Short Break",
];

// ============================================================
// BREAK USAGE LIMITS - ROLLING 24 HOURS
// ============================================================

const MAX_BREAKS_PER_24_HOURS = 5;
const MAX_NAMAZ_BREAKS_PER_24_HOURS = 1;
const MAX_LUNCH_BREAKS_PER_24_HOURS = 1;
const MAX_SHORT_BREAKS_PER_24_HOURS = 3;

// ============================================================
// BREAK DURATION LIMITS
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
    const token = request.cookies.get("token")?.value;

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

    if (!id) {
      return null;
    }

    const numericId = Number(id);

    if (!Number.isFinite(numericId)) {
      return null;
    }

    return numericId;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

// ============================================================
// CALIFORNIA TIME
// ============================================================

function getCaliforniaParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

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

function getCaliforniaDate(date = new Date()) {
  const parts = getCaliforniaParts(date);

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

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

function getCaliforniaDisplayTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function getTimeInfo() {
  const now = new Date();
  const parts = getCaliforniaParts(now);

  return {
    serverNowMs: now.getTime(),
    californiaDate: getCaliforniaDate(now),
    californiaNow: getCaliforniaDBDateTime(now),
    californiaDisplayTime: getCaliforniaDisplayTime(now),
    californiaHour: parts.hour,
    californiaMinute: parts.minute,
    californiaSecond: parts.second,
    iso: now.toISOString(),
  };
}

// ============================================================
// BREAK TIME RESTRICTION
//
// ONLY 8:00 AM -> 9:00 AM IS BLOCKED.
//
// 12:00 AM -> 7:59:59 AM  = ALLOWED
// 8:00 AM -> 8:59:59 AM   = NOT ALLOWED
// 9:00 AM -> 11:59:59 PM  = ALLOWED
//
// ============================================================

function isBreakAllowedAtCaliforniaTime(date = new Date()) {
  const parts = getCaliforniaParts(date);

  const totalMinutes =
    parts.hour * 60 + parts.minute;

  const BLOCK_START = 8 * 60; // 08:00 AM
  const BLOCK_END = 9 * 60;   // 09:00 AM

  // ONLY 8:00 AM through 8:59:59 AM is blocked.
  if (
    totalMinutes >= BLOCK_START &&
    totalMinutes < BLOCK_END
  ) {
    return false;
  }

  return true;
}

function getBreakRestrictionMessage(date = new Date()) {
  const parts = getCaliforniaParts(date);

  const currentTime =
    `${String(parts.hour).padStart(2, "0")}:` +
    `${String(parts.minute).padStart(2, "0")}:` +
    `${String(parts.second).padStart(2, "0")}`;

  return (
    `Breaks are not allowed from 8:00 AM to 9:00 AM California time. ` +
    `Current California time is ${currentTime}. ` +
    `Breaks are available again at 9:00 AM.`
  );
}

// ============================================================
// STATUS HELPERS
// ============================================================

function isBreakStatus(status) {
  return BREAK_STATUSES.includes(status);
}

function getBreakDurationLimitMinutes(status) {
  return BREAK_DURATION_LIMITS_MINUTES[status] || 0;
}

function getBreakDurationLimitSeconds(status) {
  return getBreakDurationLimitMinutes(status) * 60;
}

// ============================================================
// CALIFORNIA DB DATETIME -> REAL TIMESTAMP
// ============================================================

function californiaDateTimeToMs(value) {
  if (!value) {
    return null;
  }

  try {
    let text = String(value).trim();

    if (!text) {
      return null;
    }

    text = text.replace("T", " ");

    const match = text.match(
      /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) {
      const parsed = new Date(value);

      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return parsed.getTime();
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);

    let guess = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

    for (let i = 0; i < 5; i++) {
      const parts = getCaliforniaParts(
        new Date(guess)
      );

      const wallAsUTC = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      );

      const desiredWallAsUTC = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );

      const difference =
        desiredWallAsUTC - wallAsUTC;

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

  const limitMinutes =
    getBreakDurationLimitMinutes(status);

  const limitSeconds =
    limitMinutes * 60;

  const startedMs =
    californiaDateTimeToMs(startedAt);

  if (!startedMs) {
    return {
      isBreak: true,
      elapsedSeconds: 0,
      remainingSeconds: limitSeconds,
      durationLimitMinutes: limitMinutes,
      durationLimitSeconds: limitSeconds,
      expired: false,
    };
  }

  const rawElapsedSeconds = Math.floor(
    Math.max(
      0,
      serverNowMs - startedMs
    ) / 1000
  );

  // NEVER let timer exceed configured limit.
  const elapsedSeconds = Math.min(
    rawElapsedSeconds,
    limitSeconds
  );

  const remainingSeconds = Math.max(
    0,
    limitSeconds - elapsedSeconds
  );

  return {
    isBreak: true,
    elapsedSeconds,
    remainingSeconds,
    durationLimitMinutes: limitMinutes,
    durationLimitSeconds: limitSeconds,
    expired:
      rawElapsedSeconds >= limitSeconds,
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
// BREAK COUNTS
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
      max: MAX_BREAKS_PER_24_HOURS,
      remaining: Math.max(
        0,
        MAX_BREAKS_PER_24_HOURS - total
      ),
      reached:
        total >=
        MAX_BREAKS_PER_24_HOURS,
    },

    namaz: {
      used: namaz,
      max: MAX_NAMAZ_BREAKS_PER_24_HOURS,
      remaining: Math.max(
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
      max: MAX_LUNCH_BREAKS_PER_24_HOURS,
      remaining: Math.max(
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
      max: MAX_SHORT_BREAKS_PER_24_HOURS,
      remaining: Math.max(
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
// AUTO EXPIRE BREAK
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

  if (!startedMs) {
    return {
      expired: false,
      user,
    };
  }

  // EXACT expiry timestamp.
  const expiryMs =
    startedMs +
    limitSeconds * 1000;

  const exactEndedAt =
    getCaliforniaDBDateTime(
      new Date(expiryMs)
    );

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------------------------------------------
    // Lock user
    // --------------------------------------------------------

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

    // Status changed meanwhile.
    if (
      lockedUser.availability_status !==
        status ||
      String(
        lockedUser.status_started_at || ""
      ) !==
        String(
          user.status_started_at || ""
        )
    ) {
      await connection.rollback();

      return {
        expired: false,
        user: lockedUser,
      };
    }

    // --------------------------------------------------------
    // Find open history
    // --------------------------------------------------------

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
      // EXACT configured duration.
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

    // --------------------------------------------------------
    // Reset to Active
    // --------------------------------------------------------

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
      user: updatedUser,
      expiredStatus: status,
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
// GET
// ============================================================

export async function GET(request) {
  try {
    const userId =
      getUserIdFromToken(request);

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

    // --------------------------------------------------------
    // AUTO EXPIRE
    // --------------------------------------------------------

    const autoExpired =
      await autoExpireBreak(
        user,
        time.serverNowMs
      );

    if (autoExpired.expired) {
      user =
        autoExpired.user;
    }

    // --------------------------------------------------------
    // LIMITS
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // TIMER
    // --------------------------------------------------------

    const timer =
      buildCurrentBreakInfo(
        user,
        Date.now()
      );

    return NextResponse.json({
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

      limits,

      timer,

      breakDurationLimits:
        BREAK_DURATION_LIMITS_MINUTES,

      // ONLY 8 AM - 9 AM BLOCKED
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
    });
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
      getUserIdFromToken(request);

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

    // --------------------------------------------------------
    // VALIDATE STATUS
    // --------------------------------------------------------

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

    const californiaNow =
      getCaliforniaDBDateTime(now);

    // ========================================================
    // ONLY 8:00 AM - 9:00 AM IS BLOCKED
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

          breakAllowed: false,

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
    // START TRANSACTION
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

    const user =
      userRows?.[0];

    if (!user) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "User not found",
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
          Date.now()
        );

      await connection.commit();

      return NextResponse.json({
        success: true,
        unchanged: true,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },

        status:
          currentStatus,

        status_started_at:
          user.status_started_at,

        limits,

        timer,

        breakDurationLimits:
          BREAK_DURATION_LIMITS_MINUTES,

        breakTimeRules: {
          allowed:
            isBreakAllowedAtCaliforniaTime(
              now
            ),
          blockedFrom:
            "08:00 AM",
          blockedUntil:
            "09:00 AM",
          allowedFrom:
            "09:00 AM",
          timezone:
            CALIFORNIA_TIMEZONE,
        },
      });
    }

    // ========================================================
    // NEW BREAK
    // ========================================================

    if (
      isBreakStatus(
        requestedStatus
      )
    ) {
      // ------------------------------------------------------
      // TOTAL BREAK LIMIT
      // ------------------------------------------------------

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

      // ------------------------------------------------------
      // SPECIFIC BREAK LIMIT
      // ------------------------------------------------------

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
    // ========================================================

    if (
      currentStatus !== "Active" &&
      user.status_started_at
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

      if (openHistory) {
        const startedMs =
          californiaDateTimeToMs(
            openHistory.started_at
          );

        let durationSeconds = 0;
        let endedAt =
          californiaNow;

        if (startedMs) {
          const rawDurationSeconds =
            Math.floor(
              Math.max(
                0,
                Date.now() - startedMs
              ) / 1000
            );

          // --------------------------------------------------
          // BREAK = HARD LIMIT
          // --------------------------------------------------

          if (
            isBreakStatus(
              openHistory.status
            )
          ) {
            const maxSeconds =
              getBreakDurationLimitSeconds(
                openHistory.status
              );

            if (
              rawDurationSeconds >=
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
            } else {
              durationSeconds =
                rawDurationSeconds;
            }
          } else {
            durationSeconds =
              rawDurationSeconds;
          }
        }

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
      }
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
    // UPDATED USER
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

    const updatedUser =
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
        updatedUser,
        Date.now()
      );

    await connection.commit();

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      user: {
        id:
          updatedUser.id,
        name:
          updatedUser.name,
        email:
          updatedUser.email,
        role:
          updatedUser.role,
      },

      status:
        updatedUser.availability_status,

      status_started_at:
        updatedUser.status_started_at,

      limits,

      timer,

      breakDurationLimits:
        BREAK_DURATION_LIMITS_MINUTES,

      breakTimeRules: {
        allowed:
          isBreakAllowedAtCaliforniaTime(
            now
          ),
        blockedFrom:
          "08:00 AM",
        blockedUntil:
          "09:00 AM",
        allowedFrom:
          "09:00 AM",
        timezone:
          CALIFORNIA_TIMEZONE,
      },

      serverClock: {
        nowMs:
          Date.now(),
        iso:
          new Date().toISOString(),
        californiaNow,
        californiaDisplayTime:
          getCaliforniaDisplayTime(
            now
          ),
      },
    });
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