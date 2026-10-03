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

// ============================================================
// BREAK STATUSES
// ============================================================

const BREAK_STATUSES = [
  "Namaz Break",
  "Lunch Break",
  "Short Break",
];

// ============================================================
// BREAK LIMITS
// ============================================================

const MAX_BREAKS_PER_24_HOURS = 5;

const MAX_NAMAZ_BREAKS_PER_24_HOURS = 1;
const MAX_LUNCH_BREAKS_PER_24_HOURS = 1;
const MAX_SHORT_BREAKS_PER_24_HOURS = 3;

// ============================================================
// BREAK DURATION
// ============================================================

const BREAK_DURATION_LIMITS_MINUTES = {
  "Namaz Break": 15,
  "Lunch Break": 30,
  "Short Break": 10,
};

// ============================================================
// JWT
// ============================================================

function getUserIdFromToken(request) {
  try {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    return (
      decoded?.id ||
      decoded?._id ||
      decoded?.userId ||
      null
    );
  } catch (error) {
    console.error("JWT VERIFY ERROR:", error);
    return null;
  }
}

// ============================================================
// CALIFORNIA TIME PARTS
// ============================================================

function getCaliforniaParts() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return values;
}

// ============================================================
// CALIFORNIA DATE
// ============================================================

function getCaliforniaDate() {
  const values = getCaliforniaParts();

  return `${values.year}-${values.month}-${values.day}`;
}

// ============================================================
// CALIFORNIA DB DATETIME
// ============================================================

function getCaliforniaDBDateTime() {
  const values = getCaliforniaParts();

  return (
    `${values.year}-${values.month}-${values.day} ` +
    `${values.hour}:${values.minute}:${values.second}`
  );
}

// ============================================================
// CALIFORNIA DISPLAY TIME
// ============================================================

function getCaliforniaDisplayTime() {
  const now = new Date();

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
}

// ============================================================
// SERVER TIME
// ============================================================

function getTimeInfo() {
  const now = new Date();

  const date = getCaliforniaDate();
  const time = getCaliforniaDisplayTime();
  const dbDateTime = getCaliforniaDBDateTime();

  return {
    date,
    time,
    dbDateTime,
    displayDateTime: `${date} ${time}`,

    // Real UTC instant.
    serverNowMs: now.getTime(),

    iso: now.toISOString(),
  };
}

// ============================================================
// BREAK CHECK
// ============================================================

function isBreakStatus(status) {
  return BREAK_STATUSES.includes(status);
}

// ============================================================
// BREAK DURATION
// ============================================================

function getBreakDurationLimitMinutes(status) {
  return BREAK_DURATION_LIMITS_MINUTES[status] || null;
}

// ============================================================
// CALIFORNIA DATETIME -> REAL TIMESTAMP
// ============================================================
//
// DB value example:
// 2026-10-03 14:30:25
//
// This value represents California local time.
//
// We convert that California wall-clock time into a real
// timestamp so the timer does not depend on Pakistan/Node
// timezone.
//
// ============================================================

function californiaDateTimeToMs(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const stringValue = String(value).trim();

  const match = stringValue.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );

  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = match;

  const targetWallClockMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  let candidateMs = targetWallClockMs;

  for (let i = 0; i < 5; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CALIFORNIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(candidateMs));

    const values = {};

    for (const part of parts) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    }

    const californiaWallClockMs = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    const difference =
      targetWallClockMs -
      californiaWallClockMs;

    candidateMs += difference;

    if (Math.abs(difference) < 1000) {
      break;
    }
  }

  return candidateMs;
}

// ============================================================
// TIMER
// ============================================================

function calculateBreakTimer(
  status,
  startedAt,
  serverNowMs
) {
  const limitMinutes =
    getBreakDurationLimitMinutes(status);

  if (
    !limitMinutes ||
    !startedAt
  ) {
    return {
      isBreak: false,
      elapsedSeconds: 0,
      remainingSeconds: null,
      limitSeconds: null,
      startedAtMs: null,
      expiresAtMs: null,
      expired: false,
    };
  }

  const startedAtMs =
    californiaDateTimeToMs(startedAt);

  if (!startedAtMs) {
    return {
      isBreak: true,

      elapsedSeconds: 0,

      remainingSeconds:
        limitMinutes * 60,

      limitSeconds:
        limitMinutes * 60,

      startedAtMs: null,

      expiresAtMs: null,

      expired: false,
    };
  }

  const limitSeconds =
    limitMinutes * 60;

  const expiresAtMs =
    startedAtMs +
    limitSeconds * 1000;

  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (serverNowMs - startedAtMs) /
        1000
    )
  );

  const remainingSeconds = Math.max(
    0,
    Math.ceil(
      (expiresAtMs - serverNowMs) /
        1000
    )
  );

  return {
    isBreak: true,

    elapsedSeconds,

    remainingSeconds,

    limitSeconds,

    startedAtMs,

    expiresAtMs,

    expired:
      serverNowMs >= expiresAtMs,
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

async function getBreakCount(
  connectionOrPool,
  userId,
  californiaNow
) {
  const [rows] =
    await connectionOrPool.query(
      `
        SELECT
          COUNT(*) AS break_count
        FROM user_status_history
        WHERE
          user_id = ?
          AND status IN (
            'Namaz Break',
            'Lunch Break',
            'Short Break'
          )
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        californiaNow,
      ]
    );

  return Number(
    rows?.[0]?.break_count || 0
  );
}

// ============================================================
// NAMAZ COUNT
// ============================================================

async function getNamazBreakCount(
  connectionOrPool,
  userId,
  californiaNow
) {
  const [rows] =
    await connectionOrPool.query(
      `
        SELECT
          COUNT(*) AS count
        FROM user_status_history
        WHERE
          user_id = ?
          AND status = 'Namaz Break'
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        californiaNow,
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
  connectionOrPool,
  userId,
  californiaNow
) {
  const [rows] =
    await connectionOrPool.query(
      `
        SELECT
          COUNT(*) AS count
        FROM user_status_history
        WHERE
          user_id = ?
          AND status = 'Lunch Break'
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        californiaNow,
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
  connectionOrPool,
  userId,
  californiaNow
) {
  const [rows] =
    await connectionOrPool.query(
      `
        SELECT
          COUNT(*) AS short_break_count
        FROM user_status_history
        WHERE
          user_id = ?
          AND status = 'Short Break'
          AND started_at >= DATE_SUB(
            ?,
            INTERVAL 24 HOUR
          )
      `,
      [
        userId,
        californiaNow,
      ]
    );

  return Number(
    rows?.[0]?.short_break_count || 0
  );
}

// ============================================================
// LIMIT INFO
// ============================================================

function buildLimitInfo(
  totalCount,
  namazCount,
  lunchCount,
  shortCount
) {
  return {
    break_limit:
      MAX_BREAKS_PER_24_HOURS,

    break_count:
      totalCount,

    remaining_breaks:
      Math.max(
        0,
        MAX_BREAKS_PER_24_HOURS -
          totalCount
      ),

    break_limit_reached:
      totalCount >=
      MAX_BREAKS_PER_24_HOURS,

    namaz_break_limit:
      MAX_NAMAZ_BREAKS_PER_24_HOURS,

    namaz_break_count:
      namazCount,

    remaining_namaz_breaks:
      Math.max(
        0,
        MAX_NAMAZ_BREAKS_PER_24_HOURS -
          namazCount
      ),

    namaz_break_limit_reached:
      namazCount >=
      MAX_NAMAZ_BREAKS_PER_24_HOURS,

    lunch_break_limit:
      MAX_LUNCH_BREAKS_PER_24_HOURS,

    lunch_break_count:
      lunchCount,

    remaining_lunch_breaks:
      Math.max(
        0,
        MAX_LUNCH_BREAKS_PER_24_HOURS -
          lunchCount
      ),

    lunch_break_limit_reached:
      lunchCount >=
      MAX_LUNCH_BREAKS_PER_24_HOURS,

    short_break_limit:
      MAX_SHORT_BREAKS_PER_24_HOURS,

    short_break_count:
      shortCount,

    remaining_short_breaks:
      Math.max(
        0,
        MAX_SHORT_BREAKS_PER_24_HOURS -
          shortCount
      ),

    short_break_limit_reached:
      shortCount >=
      MAX_SHORT_BREAKS_PER_24_HOURS,
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
    ) ||
    !user.status_started_at
  ) {
    return {
      is_break: false,

      break_status: null,

      break_started_at: null,

      break_limit_minutes: null,

      break_elapsed_seconds: 0,

      break_remaining_seconds: null,

      break_expired: false,

      break_started_at_ms: null,

      break_expires_at_ms: null,
    };
  }

  const status =
    user.availability_status;

  const timer =
    calculateBreakTimer(
      status,
      user.status_started_at,
      serverNowMs
    );

  return {
    is_break: true,

    break_status:
      status,

    break_started_at:
      user.status_started_at,

    break_limit_minutes:
      getBreakDurationLimitMinutes(
        status
      ),

    break_elapsed_seconds:
      timer.elapsedSeconds,

    break_remaining_seconds:
      timer.remainingSeconds,

    break_expired:
      timer.expired,

    break_started_at_ms:
      timer.startedAtMs,

    break_expires_at_ms:
      timer.expiresAtMs,
  };
}

// ============================================================
// AUTO EXPIRE
// ============================================================

async function autoExpireBreak(
  user,
  serverNowMs,
  californiaNow
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
    };
  }

  const status =
    user.availability_status;

  const timer =
    calculateBreakTimer(
      status,
      user.status_started_at,
      serverNowMs
    );

  if (!timer.expired) {
    return {
      expired: false,

      elapsed_seconds:
        timer.elapsedSeconds,

      remaining_seconds:
        timer.remainingSeconds,
    };
  }

  let connection = null;

  try {
    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    // --------------------------------------------------------
    // LOCK USER
    // --------------------------------------------------------

    const [rows] =
      await connection.query(
        `
          SELECT
            id,
            availability_status,
            status_started_at
          FROM users
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [user.id]
      );

    if (
      !rows ||
      rows.length === 0
    ) {
      await connection.rollback();

      return {
        expired: false,
      };
    }

    const lockedUser =
      rows[0];

    // --------------------------------------------------------
    // STATUS CHANGED
    // --------------------------------------------------------

    if (
      lockedUser.availability_status !==
        status ||
      !lockedUser.status_started_at
    ) {
      await connection.commit();

      return {
        expired: false,
      };
    }

    // --------------------------------------------------------
    // OPEN HISTORY
    // --------------------------------------------------------

    const [
      historyRows,
    ] =
      await connection.query(
        `
          SELECT
            id,
            started_at
          FROM user_status_history
          WHERE
            user_id = ?
            AND ended_at IS NULL
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [user.id]
      );

    // --------------------------------------------------------
    // CLOSE HISTORY
    // --------------------------------------------------------

    if (
      historyRows &&
      historyRows.length > 0
    ) {
      const history =
        historyRows[0];

      await connection.query(
        `
          UPDATE user_status_history
          SET
            ended_at = ?,
            duration_seconds =
              TIMESTAMPDIFF(
                SECOND,
                started_at,
                ?
              )
          WHERE id = ?
        `,
        [
          californiaNow,
          californiaNow,
          history.id,
        ]
      );
    }

    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    await connection.query(
      `
        UPDATE users
        SET
          availability_status = 'Active',
          status_started_at = NULL
        WHERE id = ?
      `,
      [user.id]
    );

    await connection.commit();

    return {
      expired: true,

      expired_status:
        status,

      duration_seconds:
        timer.elapsedSeconds,

      duration_limit_minutes:
        getBreakDurationLimitMinutes(
          status
        ),

      status: "Active",

      status_started_at: null,
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      "AUTO EXPIRE BREAK ERROR:",
      error
    );

    return {
      expired: false,
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    const userId =
      getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Login required",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------------
    // TIME
    // --------------------------------------------------------

    const time =
      getTimeInfo();

    // --------------------------------------------------------
    // USER
    // --------------------------------------------------------

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
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // AUTO EXPIRE
    // --------------------------------------------------------

    const expired =
      await autoExpireBreak(
        user,
        time.serverNowMs,
        time.dbDateTime
      );

    if (expired.expired) {
      user = {
        ...user,

        availability_status:
          "Active",

        status_started_at:
          null,
      };
    }

    // --------------------------------------------------------
    // COUNTS
    // --------------------------------------------------------

    const totalBreakCount =
      await getBreakCount(
        pool,
        userId,
        time.dbDateTime
      );

    const namazBreakCount =
      await getNamazBreakCount(
        pool,
        userId,
        time.dbDateTime
      );

    const lunchBreakCount =
      await getLunchBreakCount(
        pool,
        userId,
        time.dbDateTime
      );

    const shortBreakCount =
      await getShortBreakCount(
        pool,
        userId,
        time.dbDateTime
      );

    // --------------------------------------------------------
    // LIMIT INFO
    // --------------------------------------------------------

    const limitInfo =
      buildLimitInfo(
        totalBreakCount,
        namazBreakCount,
        lunchBreakCount,
        shortBreakCount
      );

    // --------------------------------------------------------
    // TIMER
    // --------------------------------------------------------

    const currentBreakInfo =
      buildCurrentBreakInfo(
        user,
        time.serverNowMs
      );

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,

          availability_status:
            user.availability_status ||
            "Active",

          status_started_at:
            user.status_started_at ||
            null,
        },

        status:
          user.availability_status ||
          "Active",

        status_started_at:
          user.status_started_at ||
          null,

        // ----------------------------------------------------
        // LIMITS
        // ----------------------------------------------------

        ...limitInfo,

        // ----------------------------------------------------
        // TIMER
        // ----------------------------------------------------

        ...currentBreakInfo,

        // ----------------------------------------------------
        // DURATION CONFIG
        // ----------------------------------------------------

        break_duration_limits_minutes:
          BREAK_DURATION_LIMITS_MINUTES,

        break_duration_limit_minutes:
          getBreakDurationLimitMinutes(
            user.availability_status
          ),

        // ----------------------------------------------------
        // AUTO EXPIRE
        // ----------------------------------------------------

        break_auto_expired:
          Boolean(expired.expired),

        expired_break_status:
          expired.expired
            ? expired.expired_status
            : null,

        expired_break_duration_seconds:
          expired.expired
            ? expired.duration_seconds
            : null,

        // ----------------------------------------------------
        // SERVER CLOCK
        // ----------------------------------------------------

        server_now_ms:
          time.serverNowMs,

        server_now_iso:
          time.iso,

        // ----------------------------------------------------
        // CALIFORNIA
        // ----------------------------------------------------

        timezone:
          CALIFORNIA_TIMEZONE,

        california_date:
          time.date,

        california_time:
          time.time,

        california_datetime:
          time.displayDateTime,

        california_db_datetime:
          time.dbDateTime,
      },
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
      "GET USER STATUS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to get user status",

        error:
          error?.message ||
          "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT
// ============================================================

export async function PUT(request) {
  let connection = null;

  try {
    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    const userId =
      getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Login required",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------------
    // BODY
    // --------------------------------------------------------

    let body;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid JSON request body",
        },
        { status: 400 }
      );
    }

    const newStatus =
      body?.status;

    // --------------------------------------------------------
    // STATUS REQUIRED
    // --------------------------------------------------------

    if (!newStatus) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Status is required",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // STATUS VALIDATION
    // --------------------------------------------------------

    if (
      !ALLOWED_STATUSES.includes(
        newStatus
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Invalid availability status",

          allowedStatuses:
            ALLOWED_STATUSES,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // TIME
    // --------------------------------------------------------

    const time =
      getTimeInfo();

    const californiaNow =
      time.dbDateTime;

    // --------------------------------------------------------
    // CONNECTION
    // --------------------------------------------------------

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    // --------------------------------------------------------
    // LOCK USER
    // --------------------------------------------------------

    const [
      currentRows,
    ] =
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
          FOR UPDATE
        `,
        [userId]
      );

    if (
      !currentRows ||
      currentRows.length === 0
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "User not found",
        },
        { status: 404 }
      );
    }

    const currentUser =
      currentRows[0];

    const currentStatus =
      currentUser.availability_status ||
      "Active";

    const currentStartedAt =
      currentUser.status_started_at;

    // ========================================================
    // SAME STATUS
    // ========================================================

    if (
      currentStatus ===
      newStatus
    ) {
      const totalBreakCount =
        await getBreakCount(
          connection,
          userId,
          californiaNow
        );

      const namazBreakCount =
        await getNamazBreakCount(
          connection,
          userId,
          californiaNow
        );

      const lunchBreakCount =
        await getLunchBreakCount(
          connection,
          userId,
          californiaNow
        );

      const shortBreakCount =
        await getShortBreakCount(
          connection,
          userId,
          californiaNow
        );

      const limitInfo =
        buildLimitInfo(
          totalBreakCount,
          namazBreakCount,
          lunchBreakCount,
          shortBreakCount
        );

      const timer =
        buildCurrentBreakInfo(
          currentUser,
          time.serverNowMs
        );

      await connection.commit();

      return NextResponse.json(
        {
          success: true,

          message:
            "Status is already set",

          user: {
            id:
              currentUser.id,

            name:
              currentUser.name,

            email:
              currentUser.email,

            role:
              currentUser.role,

            availability_status:
              currentStatus,

            status_started_at:
              currentStartedAt ||
              null,
          },

          status:
            currentStatus,

          status_started_at:
            currentStartedAt ||
            null,

          duration_seconds:
            null,

          ...limitInfo,

          ...timer,

          break_duration_limit_minutes:
            getBreakDurationLimitMinutes(
              currentStatus
            ),

          break_duration_limits_minutes:
            BREAK_DURATION_LIMITS_MINUTES,

          server_now_ms:
            time.serverNowMs,

          server_now_iso:
            time.iso,

          timezone:
            CALIFORNIA_TIMEZONE,

          california_date:
            time.date,

          california_time:
            time.time,

          california_datetime:
            time.displayDateTime,

          california_db_datetime:
            time.dbDateTime,
        },
        { status: 200 }
      );
    }

    // ========================================================
    // BREAK LIMITS
    // ========================================================

    if (
      isBreakStatus(newStatus)
    ) {
      // ------------------------------------------------------
      // TOTAL 5
      // ------------------------------------------------------

      const totalBreakCount =
        await getBreakCount(
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

            message:
              "Total break limit reached. Maximum 5 breaks allowed within 24 hours.",

            error:
              "MAX_BREAKS_REACHED",

            break_limit:
              MAX_BREAKS_PER_24_HOURS,

            break_count:
              totalBreakCount,

            remaining_breaks:
              0,

            break_limit_reached:
              true,
          },
          { status: 429 }
        );
      }

      // ------------------------------------------------------
      // NAMAZ = 1
      // ------------------------------------------------------

      if (
        newStatus ===
        "Namaz Break"
      ) {
        const count =
          await getNamazBreakCount(
            connection,
            userId,
            californiaNow
          );

        if (
          count >=
          MAX_NAMAZ_BREAKS_PER_24_HOURS
        ) {
          await connection.rollback();

          return NextResponse.json(
            {
              success: false,

              message:
                "Namaz Break limit reached. Maximum 1 Namaz Break allowed within 24 hours.",

              error:
                "MAX_NAMAZ_BREAKS_REACHED",

              namaz_break_limit:
                MAX_NAMAZ_BREAKS_PER_24_HOURS,

              namaz_break_count:
                count,

              remaining_namaz_breaks:
                0,

              namaz_break_limit_reached:
                true,
            },
            { status: 429 }
          );
        }
      }

      // ------------------------------------------------------
      // LUNCH = 1
      // ------------------------------------------------------

      if (
        newStatus ===
        "Lunch Break"
      ) {
        const count =
          await getLunchBreakCount(
            connection,
            userId,
            californiaNow
          );

        if (
          count >=
          MAX_LUNCH_BREAKS_PER_24_HOURS
        ) {
          await connection.rollback();

          return NextResponse.json(
            {
              success: false,

              message:
                "Lunch Break limit reached. Maximum 1 Lunch Break allowed within 24 hours.",

              error:
                "MAX_LUNCH_BREAKS_REACHED",

              lunch_break_limit:
                MAX_LUNCH_BREAKS_PER_24_HOURS,

              lunch_break_count:
                count,

              remaining_lunch_breaks:
                0,

              lunch_break_limit_reached:
                true,
            },
            { status: 429 }
          );
        }
      }

      // ------------------------------------------------------
      // SHORT = 3
      // ------------------------------------------------------

      if (
        newStatus ===
        "Short Break"
      ) {
        const count =
          await getShortBreakCount(
            connection,
            userId,
            californiaNow
          );

        if (
          count >=
          MAX_SHORT_BREAKS_PER_24_HOURS
        ) {
          await connection.rollback();

          return NextResponse.json(
            {
              success: false,

              message:
                "Short Break limit reached. Maximum 3 Short Breaks allowed within 24 hours.",

              error:
                "MAX_SHORT_BREAKS_REACHED",

              short_break_limit:
                MAX_SHORT_BREAKS_PER_24_HOURS,

              short_break_count:
                count,

              remaining_short_breaks:
                0,

              short_break_limit_reached:
                true,
            },
            { status: 429 }
          );
        }
      }
    }

    // ========================================================
    // CLOSE CURRENT BREAK
    // ========================================================

    let closedDurationSeconds =
      null;

    if (
      isBreakStatus(
        currentStatus
      ) &&
      currentStartedAt
    ) {
      const [
        openHistoryRows,
      ] =
        await connection.query(
          `
            SELECT
              id,
              started_at
            FROM user_status_history
            WHERE
              user_id = ?
              AND ended_at IS NULL
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
          `,
          [userId]
        );

      if (
        openHistoryRows &&
        openHistoryRows.length > 0
      ) {
        const history =
          openHistoryRows[0];

        await connection.query(
          `
            UPDATE user_status_history
            SET
              ended_at = ?,
              duration_seconds =
                TIMESTAMPDIFF(
                  SECOND,
                  started_at,
                  ?
                )
            WHERE id = ?
          `,
          [
            californiaNow,
            californiaNow,
            history.id,
          ]
        );

        const [
          durationRows,
        ] =
          await connection.query(
            `
              SELECT
                duration_seconds
              FROM user_status_history
              WHERE id = ?
              LIMIT 1
            `,
            [history.id]
          );

        if (
          durationRows &&
          durationRows.length > 0
        ) {
          closedDurationSeconds =
            Number(
              durationRows[0]
                .duration_seconds || 0
            );
        }
      }
    }

    // ========================================================
    // ACTIVE
    // ========================================================

    if (
      newStatus ===
      "Active"
    ) {
      await connection.query(
        `
          UPDATE users
          SET
            availability_status = 'Active',
            status_started_at = NULL
          WHERE id = ?
        `,
        [userId]
      );
    }

    // ========================================================
    // NEW BREAK / OTHER STATUS
    // ========================================================

    else {
      // ------------------------------------------------------
      // INSERT HISTORY
      // ------------------------------------------------------

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
            NULL
          )
        `,
        [
          userId,
          newStatus,
          californiaNow,
        ]
      );

      // ------------------------------------------------------
      // UPDATE USER
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE users
          SET
            availability_status = ?,
            status_started_at = ?
          WHERE id = ?
        `,
        [
          newStatus,
          californiaNow,
          userId,
        ]
      );
    }

    // ========================================================
    // UPDATED USER
    // ========================================================

    const updatedUser =
      await getUserById(
        connection,
        userId
      );

    if (!updatedUser) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "User not found",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // FINAL COUNTS
    // ========================================================

    const totalBreakCount =
      await getBreakCount(
        connection,
        userId,
        californiaNow
      );

    const namazBreakCount =
      await getNamazBreakCount(
        connection,
        userId,
        californiaNow
      );

    const lunchBreakCount =
      await getLunchBreakCount(
        connection,
        userId,
        californiaNow
      );

    const shortBreakCount =
      await getShortBreakCount(
        connection,
        userId,
        californiaNow
      );

    const limitInfo =
      buildLimitInfo(
        totalBreakCount,
        namazBreakCount,
        lunchBreakCount,
        shortBreakCount
      );

    // ========================================================
    // TIMER
    // ========================================================

    const currentBreakInfo =
      buildCurrentBreakInfo(
        updatedUser,
        time.serverNowMs
      );

    // ========================================================
    // COMMIT
    // ========================================================

    await connection.commit();

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Availability status updated successfully",

        user: {
          id:
            updatedUser.id,

          name:
            updatedUser.name,

          email:
            updatedUser.email,

          role:
            updatedUser.role,

          availability_status:
            updatedUser.availability_status ||
            "Active",

          status_started_at:
            updatedUser.status_started_at ||
            null,
        },

        status:
          updatedUser.availability_status ||
          "Active",

        status_started_at:
          updatedUser.status_started_at ||
          null,

        // ----------------------------------------------------
        // CLOSED DURATION
        // ----------------------------------------------------

        duration_seconds:
          closedDurationSeconds,

        // ----------------------------------------------------
        // LIMITS
        // ----------------------------------------------------

        ...limitInfo,

        // ----------------------------------------------------
        // TIMER
        // ----------------------------------------------------

        ...currentBreakInfo,

        // ----------------------------------------------------
        // DURATION
        // ----------------------------------------------------

        break_duration_limit_minutes:
          getBreakDurationLimitMinutes(
            updatedUser.availability_status
          ),

        break_duration_limits_minutes:
          BREAK_DURATION_LIMITS_MINUTES,

        // ----------------------------------------------------
        // SERVER CLOCK
        // ----------------------------------------------------

        server_now_ms:
          time.serverNowMs,

        server_now_iso:
          time.iso,

        // ----------------------------------------------------
        // CALIFORNIA
        // ----------------------------------------------------

        timezone:
          CALIFORNIA_TIMEZONE,

        california_date:
          time.date,

        california_time:
          time.time,

        california_datetime:
          time.displayDateTime,

        california_db_datetime:
          time.dbDateTime,
      },
      { status: 200 }
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      "UPDATE USER STATUS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to update availability status",

        error:
          error?.message ||
          "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}