import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// CONFIG
// ============================================================

const ACTIVE_STATUSES = new Set([
  "ringing",
  "connected",
  "answered",
  "in_progress",
  "on_hold",
]);

const END_EVENTS = new Set([
  "phone.caller_ended",
  "phone.callee_ended",
  "phone.caller_rejected",
  "phone.callee_rejected",
  "phone.callee_missed",
]);

// ============================================================
// HELPERS
// ============================================================

function clean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function normalizeExtension(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/[^\d+]/g, "");
}

function toMysqlDateTime(value) {
  if (!value) {
    return null;
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
  } catch {
    return null;
  }
}

function getObject(body) {
  return body?.payload?.object || {};
}

function getAccountId(body) {
  return clean(
    body?.payload?.account_id ||
      body?.account_id
  );
}

function getCallId(object) {
  return clean(
    object?.call_id ||
      object?.callId ||
      object?.call_history_uuid ||
      object?.call_history_id ||
      object?.id
  );
}

function getEventTimestamp(body) {
  const value = body?.event_ts;

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getPartyExtension(party) {
  if (!party) {
    return "";
  }

  return normalizeExtension(
    party?.extension_number ??
      party?.extension ??
      party?.extension_id ??
      party?.extensionNumber
  );
}

function getPartyPhone(party) {
  if (!party) {
    return null;
  }

  return clean(
    party?.phone_number ||
      party?.did_number ||
      party?.phone ||
      party?.number
  );
}

function getPartyName(party) {
  if (!party) {
    return null;
  }

  return clean(
    party?.name ||
      party?.user_name ||
      party?.display_name ||
      party?.displayName ||
      party?.email
  );
}

function getPartyUserId(party) {
  if (!party) {
    return null;
  }

  return clean(
    party?.user_id ||
      party?.userId ||
      party?.id
  );
}

function getStatusFromEvent(event) {
  switch (event) {
    // --------------------------------------------------------
    // RINGING
    // --------------------------------------------------------

    case "phone.caller_ringing":
    case "phone.callee_ringing":
      return "ringing";

    // --------------------------------------------------------
    // CONNECTED / ANSWERED
    // --------------------------------------------------------

    case "phone.caller_connected":
    case "phone.callee_connected":
    case "phone.callee_answered":
      return "connected";

    case "phone.caller_answered":
      return "answered";

    // --------------------------------------------------------
    // HOLD
    // --------------------------------------------------------

    case "phone.caller_on_hold":
    case "phone.callee_hold":
    case "phone.callee_on_hold":
      return "on_hold";

    // --------------------------------------------------------
    // UNHOLD
    // --------------------------------------------------------

    case "phone.caller_unhold":
    case "phone.callee_unhold":
      return "connected";

    default:
      return "ringing";
  }
}

function createValidationHash(plainToken) {
  const secret =
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

  if (!secret || !plainToken) {
    return null;
  }

  return crypto
    .createHmac("sha256", secret)
    .update(plainToken)
    .digest("hex");
}

// ============================================================
// GET
// ============================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Zoom Phone webhook endpoint is running",
    endpoint: "/api/zoom/webhook",
  });
}

// ============================================================
// POST
// ============================================================

export async function POST(request) {
  try {
    const body = await request.json();

    const event = clean(
      body?.event ||
        body?.event_type
    );

    console.log(
      "[ZOOM WEBHOOK]",
      event || "unknown"
    );

    // ========================================================
    // ZOOM URL VALIDATION
    // ========================================================

    if (
      event === "endpoint.url_validation"
    ) {
      const plainToken =
        body?.payload?.plainToken ||
        body?.plainToken ||
        "";

      const encryptedToken =
        createValidationHash(
          plainToken
        );

      if (
        !plainToken ||
        !encryptedToken
      ) {
        console.error(
          "[ZOOM WEBHOOK] URL validation failed"
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Webhook validation configuration missing",
          },
          {
            status: 400,
          }
        );
      }

      console.log(
        "[ZOOM WEBHOOK] URL validation successful"
      );

      return NextResponse.json({
        plainToken,
        encryptedToken,
      });
    }

    // ========================================================
    // NO EVENT
    // ========================================================

    if (!event) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "Missing event",
      });
    }

    // ========================================================
    // PAYLOAD
    // ========================================================

    const object = getObject(body);

    const callId = getCallId(object);

    // ========================================================
    // EVENTS WITHOUT CALL ID
    // ========================================================

    if (!callId) {
      console.log(
        "[ZOOM WEBHOOK] No call_id",
        event
      );

      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "Missing call_id",
        event,
      });
    }

    // ========================================================
    // ACCOUNT
    // ========================================================

    const accountId =
      getAccountId(body);

    // ========================================================
    // CALLER / CALLEE
    // ========================================================

    const caller =
      object?.caller || {};

    const callee =
      object?.callee || {};

    // ========================================================
    // CALLER DATA
    // ========================================================

    const callerExtension =
      getPartyExtension(caller);

    const callerPhone =
      getPartyPhone(caller);

    const callerName =
      getPartyName(caller);

    const callerUserId =
      getPartyUserId(caller);

    // ========================================================
    // CALLEE DATA
    // ========================================================

    const calleeExtension =
      getPartyExtension(callee);

    const calleePhone =
      getPartyPhone(callee);

    const calleeName =
      getPartyName(callee);

    const calleeUserId =
      getPartyUserId(callee);

    // ========================================================
    // EVENT TIMESTAMP
    // ========================================================

    const eventTs =
      getEventTimestamp(body);

    // ========================================================
    // END CALL
    // ========================================================

    if (END_EVENTS.has(event)) {
      const callEndTime =
        toMysqlDateTime(
          object?.call_end_time
        ) ||
        toMysqlDateTime(
          object?.end_time
        ) ||
        toMysqlDateTime(
          object?.call_end_timestamp
        ) ||
        toMysqlDateTime(
          new Date()
        );

      console.log(
        "[ZOOM WEBHOOK] CALL ENDED",
        {
          callId,
          event,
        }
      );

      const [result] =
        await pool.execute(
          `
          UPDATE zoom_active_calls
          SET
            status = 'ended',
            call_end_time = ?,
            last_event = ?,
            last_event_ts = ?,
            raw_payload = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE call_id = ?
          `,
          [
            callEndTime,
            event,
            eventTs,
            JSON.stringify(body),
            callId,
          ]
        );

      console.log(
        "[ZOOM WEBHOOK] END UPDATE",
        {
          callId,
          affectedRows:
            result?.affectedRows ?? 0,
        }
      );

      return NextResponse.json({
        success: true,
        event,
        call_id: callId,
        status: "ended",
        affectedRows:
          result?.affectedRows ?? 0,
      });
    }

    // ========================================================
    // ACTIVE CALL
    // ========================================================

    const status =
      getStatusFromEvent(event);

    if (
      ACTIVE_STATUSES.has(status)
    ) {
      const ringingStartTime =
        toMysqlDateTime(
          object?.ringing_start_time
        ) ||
        toMysqlDateTime(
          object?.start_time
        );

      const answerStartTime =
        toMysqlDateTime(
          object?.answer_start_time
        ) ||
        toMysqlDateTime(
          object?.connected_start_time
        );

      const direction =
        clean(
          object?.direction
        );

      console.log(
        "[ZOOM WEBHOOK] ACTIVE CALL",
        {
          callId,
          status,
          direction,
          callerExtension,
          callerName,
          callerUserId,
          calleeExtension,
          calleeName,
          calleeUserId,
        }
      );

      await pool.execute(
        `
        INSERT INTO zoom_active_calls (
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
          raw_payload
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,

          ?,
          ?,

          NULL,
          ?,
          ?,
          ?
        )

        ON DUPLICATE KEY UPDATE

          account_id =
            COALESCE(
              VALUES(account_id),
              account_id
            ),

          direction =
            COALESCE(
              VALUES(direction),
              direction
            ),

          status =
            VALUES(status),

          caller_extension =
            COALESCE(
              VALUES(caller_extension),
              caller_extension
            ),

          caller_name =
            COALESCE(
              VALUES(caller_name),
              caller_name
            ),

          caller_user_id =
            COALESCE(
              VALUES(caller_user_id),
              caller_user_id
            ),

          caller_phone =
            COALESCE(
              VALUES(caller_phone),
              caller_phone
            ),

          callee_extension =
            COALESCE(
              VALUES(callee_extension),
              callee_extension
            ),

          callee_name =
            COALESCE(
              VALUES(callee_name),
              callee_name
            ),

          callee_user_id =
            COALESCE(
              VALUES(callee_user_id),
              callee_user_id
            ),

          callee_phone =
            COALESCE(
              VALUES(callee_phone),
              callee_phone
            ),

          ringing_start_time =
            COALESCE(
              VALUES(ringing_start_time),
              ringing_start_time
            ),

          answer_start_time =
            COALESCE(
              VALUES(answer_start_time),
              answer_start_time
            ),

          last_event =
            VALUES(last_event),

          last_event_ts =
            VALUES(last_event_ts),

          raw_payload =
            VALUES(raw_payload),

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          callId,
          accountId,
          direction,
          status,

          callerExtension || null,
          callerName,
          callerUserId,
          callerPhone,

          calleeExtension || null,
          calleeName,
          calleeUserId,
          calleePhone,

          ringingStartTime,
          answerStartTime,

          event,
          eventTs,

          JSON.stringify(body),
        ]
      );

      return NextResponse.json({
        success: true,
        event,
        call_id: callId,
        status,
        caller: {
          extension:
            callerExtension ||
            null,
          name:
            callerName ||
            null,
          user_id:
            callerUserId ||
            null,
        },
        callee: {
          extension:
            calleeExtension ||
            null,
          name:
            calleeName ||
            null,
          user_id:
            calleeUserId ||
            null,
        },
      });
    }

    // ========================================================
    // OTHER CALL EVENTS
    // ========================================================

    const [result] =
      await pool.execute(
        `
        UPDATE zoom_active_calls
        SET
          last_event = ?,
          last_event_ts = ?,
          raw_payload = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE call_id = ?
        `,
        [
          event,
          eventTs,
          JSON.stringify(body),
          callId,
        ]
      );

    console.log(
      "[ZOOM WEBHOOK] OTHER EVENT",
      {
        event,
        callId,
        affectedRows:
          result?.affectedRows ?? 0,
      }
    );

    return NextResponse.json({
      success: true,
      ignored: true,
      event,
      call_id: callId,
      affectedRows:
        result?.affectedRows ?? 0,
    });
  } catch (error) {
    console.error(
      "[ZOOM WEBHOOK ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Webhook processing failed",
      },
      {
        status: 500,
      }
    );
  }
}