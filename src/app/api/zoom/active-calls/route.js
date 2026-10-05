import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "token";

const ACTIVE_STATUSES = [
  "ringing",
  "connected",
  "answered",
  "in_progress",
  "on_hold",
];

/* ============================================================
   HELPERS
============================================================ */

function normalizeExtension(value) {
  if (value === null || value === undefined) {
    return "";
  }

  let valueString = String(value).trim();

  // 800.0 -> 800
  if (/^\d+\.0+$/.test(valueString)) {
    valueString = valueString.split(".")[0];
  }

  return valueString.replace(/[^\d+]/g, "");
}

function clean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const valueString = String(value).trim();

  return valueString || null;
}

async function verifyUser(request) {
  try {
    const token =
      request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error(
        "[ZOOM ACTIVE CALLS] JWT_SECRET missing"
      );

      return null;
    }

    return jwt.verify(token, secret);
  } catch (error) {
    console.error(
      "[ZOOM ACTIVE CALLS] JWT verification failed:",
      error?.message
    );

    return null;
  }
}

/* ============================================================
   GET ACTIVE CALLS
============================================================ */

export async function GET(request) {
  try {
    /* ----------------------------------------------------------
       AUTH
    ---------------------------------------------------------- */

    const user = await verifyUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          count: 0,
          calls: [],
          activeCalls: [],
          data: [],
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    /* ----------------------------------------------------------
       CLOSE STALE CALLS
       
       If Zoom webhook stops sending events, an old call should
       not remain On Call forever.
    ---------------------------------------------------------- */

    await pool.execute(`
      UPDATE zoom_active_calls
      SET
        status = 'ended',
        call_end_time = COALESCE(
          call_end_time,
          CURRENT_TIMESTAMP
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE
        status IN (
          'ringing',
          'connected',
          'answered',
          'in_progress',
          'on_hold'
        )
        AND updated_at < DATE_SUB(
          CURRENT_TIMESTAMP,
          INTERVAL 10 MINUTE
        )
    `);

    /* ----------------------------------------------------------
       ACTIVE STATUS PLACEHOLDERS
    ---------------------------------------------------------- */

    const placeholders = ACTIVE_STATUSES
      .map(() => "?")
      .join(",");

    /* ----------------------------------------------------------
       READ ACTIVE CALLS FROM DATABASE
    ---------------------------------------------------------- */

    const [rows] = await pool.execute(
      `
      SELECT
        id,
        call_id,
        account_id,
        direction,
        status,

        caller_extension,
        caller_name,
        caller_user_id,
        caller_phone,

        callee_extension,
        callee_name,
        callee_user_id,
        callee_phone,

        ringing_start_time,
        answer_start_time,
        call_end_time,

        last_event,
        last_event_ts,

        created_at,
        updated_at

      FROM zoom_active_calls

      WHERE status IN (${placeholders})

      ORDER BY
        updated_at DESC,
        id DESC
      `,
      ACTIVE_STATUSES
    );

    /* ----------------------------------------------------------
       NORMALIZE DATABASE DATA
    ---------------------------------------------------------- */

    const calls = rows.map((row) => {
      return {
        id: row.id,

        call_id:
          clean(row.call_id),

        account_id:
          clean(row.account_id),

        direction:
          clean(row.direction),

        status:
          clean(row.status) || "ringing",

        caller_extension:
          normalizeExtension(
            row.caller_extension
          ),

        caller_name:
          clean(row.caller_name),

        caller_user_id:
          clean(row.caller_user_id),

        caller_phone:
          clean(row.caller_phone),

        callee_extension:
          normalizeExtension(
            row.callee_extension
          ),

        callee_name:
          clean(row.callee_name),

        callee_user_id:
          clean(row.callee_user_id),

        ringing_start_time:
          row.ringing_start_time,

        answer_start_time:
          row.answer_start_time,

        call_end_time:
          row.call_end_time,

        last_event:
          clean(row.last_event),

        last_event_ts:
          row.last_event_ts,

        created_at:
          row.created_at,

        updated_at:
          row.updated_at,
      };
    });

    /* ----------------------------------------------------------
       RESPONSE
    ---------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        count: calls.length,

        calls,

        // Compatibility for existing Users page
        activeCalls: calls,
        data: calls,

        fetched_at:
          new Date().toISOString(),
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
      "[ZOOM ACTIVE CALLS ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Unable to load active Zoom calls",

        count: 0,

        calls: [],

        activeCalls: [],

        data: [],

        fetched_at:
          new Date().toISOString(),
      },
      {
        status: 500,

        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}