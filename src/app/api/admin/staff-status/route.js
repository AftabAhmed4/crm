import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";

// ==========================================
// CONFIG
// ==========================================

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

// ==========================================
// BREAK LIMITS
// ==========================================

const BREAK_LIMITS = {
  "Namaz Break": 1,
  "Lunch Break": 1,
  "Short Break": 3,
};

// Controlled breaks:
// Namaz 1 + Lunch 1 + Short 3 = 5
const MAX_BREAKS_PER_DAY = 5;

// ==========================================
// BREAK STATUSES
// ==========================================

const BREAK_STATUSES = [
  "Namaz Break",
  "Lunch Break",
  "Short Break",
  "Washroom Break",
  "Other",
];

// Only these count toward the 5-break limit
const CONTROLLED_BREAK_STATUSES = [
  "Namaz Break",
  "Lunch Break",
  "Short Break",
];

// These are unlimited
const UNLIMITED_BREAK_STATUSES = [
  "Washroom Break",
  "Other",
];

// ==========================================
// GET CALIFORNIA DATE/TIME
// ==========================================

function getCaliforniaDateTime() {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const displayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const dateString = dateFormatter.format(now);
  const timeString = timeFormatter.format(now);
  const displayString = displayFormatter.format(now);

  const [month, day, year] = dateString.split("/");

  return {
    date: `${year}-${month}-${day}`,
    time: timeString,
    display: displayString,
    timezone: CALIFORNIA_TIMEZONE,
    timestamp: now.toISOString(),
  };
}

// ==========================================
// EMPTY BREAK COUNT
// ==========================================

function createEmptyBreakCount() {
  return {
    total: 0,
    namazBreak: 0,
    lunchBreak: 0,
    shortBreak: 0,
    washroomBreak: 0,
    other: 0,
  };
}

// ==========================================
// GET CALIFORNIA DAY UTC RANGE
//
// This is important if DB timestamps are UTC.
// It handles DST automatically.
// ==========================================

function getCaliforniaDayUtcRange(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  // Start with a UTC guess.
  let guess = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0)
  );

  // Find the California timezone offset at this date.
  const getOffsetMinutes = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CALIFORNIA_TIMEZONE,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const tzPart = parts.find(
      (part) => part.type === "timeZoneName"
    );

    const value = tzPart?.value || "GMT";

    const match = value.match(
      /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/
    );

    if (!match) {
      return 0;
    }

    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] || 0);

    return sign * (hours * 60 + minutes);
  };

  const offsetStart = getOffsetMinutes(guess);

  const startUtc = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0) -
      offsetStart * 60 * 1000
  );

  const offsetEnd = getOffsetMinutes(
    new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  );

  const nextDate = new Date(
    Date.UTC(year, month - 1, day + 1, 0, 0, 0) -
      offsetEnd * 60 * 1000
  );

  return {
    startUtc,
    endUtc: nextDate,
  };
}

// ==========================================
// GET
// ==========================================

export async function GET(request) {
  try {
    // ==========================================
    // GET TOKEN
    // ==========================================

    const token = request.cookies.get("token")?.value;

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

    // ==========================================
    // VERIFY JWT
    // ==========================================

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      console.error("JWT VERIFY ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired token",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================
    // GET USER ID
    // ==========================================

    const currentUserId =
      decoded?.id ||
      decoded?._id ||
      decoded?.userId ||
      null;

    if (!currentUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID not found",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================
    // GET CURRENT USER
    // ==========================================

    const [currentUserRows] = await pool.query(
      `
        SELECT
          id,
          name,
          role
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

    const currentUser = currentUserRows[0];

    // ==========================================
    // ADMIN CHECK
    // ==========================================

    const currentRole = String(
      currentUser.role || ""
    ).toLowerCase();

    if (currentRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required",
        },
        {
          status: 403,
        }
      );
    }

    // ==========================================
    // CALIFORNIA DATE/TIME
    // ==========================================

    const californiaTime =
      getCaliforniaDateTime();

    const californiaDate =
      californiaTime.date;

    // ==========================================
    // CALIFORNIA DAY UTC RANGE
    // ==========================================

    const {
      startUtc,
      endUtc,
    } = getCaliforniaDayUtcRange(
      californiaDate
    );

    // ==========================================
    // GET ALL USERS
    // ==========================================

    const [users] = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          role,
          availability_status
        FROM users
        ORDER BY
          CASE
            WHEN role = 'admin' THEN 0
            ELSE 1
          END,
          name ASC
      `
    );

    // ==========================================
    // GET TODAY'S BREAK HISTORY
    //
    // California day is converted to UTC range.
    // This avoids Pakistan/server timezone issues.
    // ==========================================

    let historyRows = [];

    try {
      const [rows] = await pool.query(
        `
          SELECT
            user_id,
            status,
            started_at,
            ended_at
          FROM user_status_history
          WHERE status IN (
            'Namaz Break',
            'Lunch Break',
            'Short Break',
            'Washroom Break',
            'Other'
          )
          AND started_at >= ?
          AND started_at < ?
          ORDER BY started_at DESC
        `,
        [
          startUtc,
          endUtc,
        ]
      );

      historyRows = rows || [];
    } catch (historyError) {
      console.error(
        "BREAK HISTORY QUERY ERROR:",
        historyError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch break history",
          error:
            process.env.NODE_ENV === "development"
              ? historyError.message
              : undefined,
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // CREATE BREAK COUNT MAP
    // ==========================================

    const breakCounts = {};

    users.forEach((user) => {
      breakCounts[user.id] =
        createEmptyBreakCount();
    });

    // ==========================================
    // COUNT BREAKS
    // ==========================================

    historyRows.forEach((record) => {
      const userId = record.user_id;
      const status = String(
        record.status || ""
      ).trim();

      if (!breakCounts[userId]) {
        breakCounts[userId] =
          createEmptyBreakCount();
      }

      // ========================================
      // TOTAL HISTORY
      //
      // Includes unlimited breaks too.
      // ========================================

      breakCounts[userId].total++;

      // ========================================
      // CONTROLLED BREAKS
      // ========================================

      switch (status) {
        case "Namaz Break":
          breakCounts[userId].namazBreak++;
          break;

        case "Lunch Break":
          breakCounts[userId].lunchBreak++;
          break;

        case "Short Break":
          breakCounts[userId].shortBreak++;
          break;

        case "Washroom Break":
          breakCounts[userId].washroomBreak++;
          break;

        case "Other":
          breakCounts[userId].other++;
          break;

        default:
          break;
      }
    });

    // ==========================================
    // FORMAT STAFF
    // ==========================================

    const staff = users.map((user) => {
      const availabilityStatus =
        user.availability_status || "Active";

      const userBreaks =
        breakCounts[user.id] ||
        createEmptyBreakCount();

      // ========================================
      // INDIVIDUAL REMAINING
      // ========================================

      const namazRemaining = Math.max(
        0,
        BREAK_LIMITS["Namaz Break"] -
          userBreaks.namazBreak
      );

      const lunchRemaining = Math.max(
        0,
        BREAK_LIMITS["Lunch Break"] -
          userBreaks.lunchBreak
      );

      const shortRemaining = Math.max(
        0,
        BREAK_LIMITS["Short Break"] -
          userBreaks.shortBreak
      );

      // ========================================
      // CONTROLLED TOTAL
      //
      // ONLY Namaz + Lunch + Short
      //
      // Washroom + Other are NOT included.
      // ========================================

      const controlledBreakCount =
        userBreaks.namazBreak +
        userBreaks.lunchBreak +
        userBreaks.shortBreak;

      // ========================================
      // TOTAL REMAINING
      // ========================================

      const remainingBreaks = Math.max(
        0,
        MAX_BREAKS_PER_DAY -
          controlledBreakCount
      );

      // ========================================
      // INDIVIDUAL LIMIT FLAGS
      // ========================================

      const namazLimitReached =
        userBreaks.namazBreak >=
        BREAK_LIMITS["Namaz Break"];

      const lunchLimitReached =
        userBreaks.lunchBreak >=
        BREAK_LIMITS["Lunch Break"];

      const shortLimitReached =
        userBreaks.shortBreak >=
        BREAK_LIMITS["Short Break"];

      // ========================================
      // TOTAL LIMIT
      // ========================================

      const breakLimitReached =
        controlledBreakCount >=
        MAX_BREAKS_PER_DAY;

      // ========================================
      // RETURN USER
      // ========================================

      return {
        id: user.id,

        name:
          user.name ||
          "Unknown User",

        email:
          user.email ||
          "",

        role:
          user.role ||
          "user",

        availability_status:
          availabilityStatus,

        // ======================================
        // BREAK COUNTS
        // ======================================

        break_count:
          controlledBreakCount,

        total_break_count:
          userBreaks.total,

        max_breaks:
          MAX_BREAKS_PER_DAY,

        remaining_breaks:
          remainingBreaks,

        break_limit_reached:
          breakLimitReached,

        // ======================================
        // INDIVIDUAL LIMITS
        // ======================================

        break_limits: {
          namaz:
            BREAK_LIMITS["Namaz Break"],

          lunch:
            BREAK_LIMITS["Lunch Break"],

          short:
            BREAK_LIMITS["Short Break"],
        },

        // ======================================
        // CURRENT COUNTS
        // ======================================

        breaks: {
          namaz:
            userBreaks.namazBreak,

          lunch:
            userBreaks.lunchBreak,

          short:
            userBreaks.shortBreak,

          washroom:
            userBreaks.washroomBreak,

          other:
            userBreaks.other,
        },

        // ======================================
        // REMAINING
        // ======================================

        remaining: {
          namaz:
            namazRemaining,

          lunch:
            lunchRemaining,

          short:
            shortRemaining,
        },

        // ======================================
        // LIMIT FLAGS
        // ======================================

        limits_reached: {
          namaz:
            namazLimitReached,

          lunch:
            lunchLimitReached,

          short:
            shortLimitReached,

          total:
            breakLimitReached,
        },

        // ======================================
        // BREAK AVAILABILITY
        // ======================================

        can_take_break: {
          namaz:
            !namazLimitReached &&
            !breakLimitReached,

          lunch:
            !lunchLimitReached &&
            !breakLimitReached,

          short:
            !shortLimitReached &&
            !breakLimitReached,

          washroom: true,

          other: true,
        },
      };
    });

    // ==========================================
    // STATUS COUNTS
    // ==========================================

    const counts = {
      total: staff.length,

      active: 0,

      namazBreak: 0,

      lunchBreak: 0,

      shortBreak: 0,

      inactive: 0,

      onCall: 0,

      washroomBreak: 0,

      meeting: 0,

      other: 0,

      breakLimitReached: 0,
    };

    // ==========================================
    // COUNT CURRENT STATUS
    // ==========================================

    staff.forEach((user) => {
      switch (user.availability_status) {
        case "Active":
          counts.active++;
          break;

        case "Namaz Break":
          counts.namazBreak++;
          break;

        case "Lunch Break":
          counts.lunchBreak++;
          break;

        case "Short Break":
          counts.shortBreak++;
          break;

        case "Inactive":
          counts.inactive++;
          break;

        case "On Call":
          counts.onCall++;
          break;

        case "Washroom Break":
          counts.washroomBreak++;
          break;

        case "Meeting":
          counts.meeting++;
          break;

        case "Other":
          counts.other++;
          break;

        default:
          counts.active++;
          break;
      }

      if (user.break_limit_reached) {
        counts.breakLimitReached++;
      }
    });

    // ==========================================
    // RESPONSE
    // ==========================================

    return NextResponse.json(
      {
        success: true,

        // ========================================
        // CALIFORNIA TIME
        // ========================================

        timezone:
          CALIFORNIA_TIMEZONE,

        california_time: {
          date:
            californiaTime.date,

          time:
            californiaTime.time,

          display:
            californiaTime.display,

          timestamp:
            californiaTime.timestamp,

          timezone:
            californiaTime.timezone,
        },

        // ========================================
        // BREAK POLICY
        // ========================================

        break_policy: {
          max_breaks_per_user_per_day:
            MAX_BREAKS_PER_DAY,

          individual_limits: {
            namaz:
              BREAK_LIMITS["Namaz Break"],

            lunch:
              BREAK_LIMITS["Lunch Break"],

            short:
              BREAK_LIMITS["Short Break"],
          },

          break_statuses:
            BREAK_STATUSES,

          counted_break_statuses:
            CONTROLLED_BREAK_STATUSES,

          non_counted_break_statuses:
            UNLIMITED_BREAK_STATUSES,

          reset_timezone:
            CALIFORNIA_TIMEZONE,

          current_california_date:
            californiaTime.date,

          current_california_time:
            californiaTime.time,
        },

        // ========================================
        // CURRENT USER
        // ========================================

        current_user: {
          id:
            currentUser.id,

          name:
            currentUser.name,

          role:
            currentUser.role,
        },

        // ========================================
        // STAFF
        // ========================================

        data: staff,

        // ========================================
        // COUNTS
        // ========================================

        counts,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma: "no-cache",

          Expires: "0",

          "Surrogate-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "ADMIN STAFF STATUS API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to fetch staff availability",

        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}