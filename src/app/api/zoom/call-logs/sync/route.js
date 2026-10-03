import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// CONFIG
// ============================================================

const ZOOM_CALL_HISTORY_URL =
  "https://api.zoom.us/v2/phone/call_history";

const ZOOM_TOKEN_URL =
  "https://zoom.us/oauth/token";

const CRM_TIME_ZONE = "America/Los_Angeles";

const DEFAULT_PAGE_SIZE = 300;
const MAX_PAGE_SIZE = 300;

// 200 pages x 300 = 60,000 records maximum
const MAX_PAGES = 200;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ============================================================
// FIRST VALID VALUE
// ============================================================

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return null;
}

// ============================================================
// NORMALIZE EXTENSION
// ============================================================

function normalizeExtension(value) {
  if (value === undefined || value === null) {
    return "";
  }

  let valueString = String(value).trim();

  if (!valueString) {
    return "";
  }

  valueString = valueString
    .replace(/^extension[\s:._-]*/i, "")
    .replace(/^ext[\s:._-]*/i, "")
    .trim();

  // 800.0 -> 800
  // 802.00 -> 802
  if (/^\d+\.\d+$/.test(valueString)) {
    const parts = valueString.split(".");

    if (/^0+$/.test(parts[1])) {
      valueString = parts[0];
    }
  }

  const match = valueString.match(/\d+/);

  if (!match) {
    return "";
  }

  return match[0];
}

// ============================================================
// DIRECTION
// ============================================================

function getDirection(call) {
  return String(
    firstValue(
      call?.direction,
      call?.call_direction,
      call?.callDirection,
      call?.raw?.direction,
      call?.raw_zoom_data?.direction,
      ""
    )
  )
    .trim()
    .toLowerCase();
}

// ============================================================
// CALLER EXTENSION
// ============================================================

function getCallerExtension(call) {
  return normalizeExtension(
    firstValue(
      call?.caller_ext_number,
      call?.caller_extension,
      call?.caller_extension_number,
      call?.caller_ext,

      call?.caller?.extension_number,
      call?.caller?.extension,
      call?.caller?.ext_number,
      call?.caller?.ext,

      call?.from?.extension_number,
      call?.from?.extension,
      call?.from?.ext_number,
      call?.from?.ext,

      call?.raw?.caller_ext_number,
      call?.raw?.caller_extension,
      call?.raw?.caller_extension_number,
      call?.raw?.caller_ext,

      call?.raw?.caller?.extension_number,
      call?.raw?.caller?.extension,

      call?.raw?.from?.extension_number,
      call?.raw?.from?.extension,

      call?.raw_zoom_data?.caller_ext_number,
      call?.raw_zoom_data?.caller_extension,
      call?.raw_zoom_data?.caller_extension_number,

      call?.raw_zoom_data?.caller?.extension_number,
      call?.raw_zoom_data?.caller?.extension,

      call?.raw_zoom_data?.from?.extension_number,
      call?.raw_zoom_data?.from?.extension,

      null
    )
  );
}

// ============================================================
// CALLEE EXTENSION
// ============================================================

function getCalleeExtension(call) {
  return normalizeExtension(
    firstValue(
      call?.callee_ext_number,
      call?.callee_extension,
      call?.callee_extension_number,
      call?.callee_ext,

      call?.callee?.extension_number,
      call?.callee?.extension,
      call?.callee?.ext_number,
      call?.callee?.ext,

      call?.to?.extension_number,
      call?.to?.extension,
      call?.to?.ext_number,
      call?.to?.ext,

      call?.raw?.callee_ext_number,
      call?.raw?.callee_extension,
      call?.raw?.callee_extension_number,
      call?.raw?.callee_ext,

      call?.raw?.callee?.extension_number,
      call?.raw?.callee?.extension,

      call?.raw?.to?.extension_number,
      call?.raw?.to?.extension,

      call?.raw_zoom_data?.callee_ext_number,
      call?.raw_zoom_data?.callee_extension,
      call?.raw_zoom_data?.callee_extension_number,

      call?.raw_zoom_data?.callee?.extension_number,
      call?.raw_zoom_data?.callee?.extension,

      call?.raw_zoom_data?.to?.extension_number,
      call?.raw_zoom_data?.to?.extension,

      null
    )
  );
}

// ============================================================
// OWNER EXTENSION
// ============================================================

function getOwnerExtension(call) {
  return normalizeExtension(
    firstValue(
      call?.owner?.extension_number,
      call?.owner?.extension,
      call?.owner?.ext_number,
      call?.owner?.ext,

      call?.owner_extension,
      call?.owner_ext_number,
      call?.owner_ext,

      call?.raw?.owner?.extension_number,
      call?.raw?.owner?.extension,
      call?.raw?.owner?.ext_number,
      call?.raw?.owner?.ext,

      call?.raw_zoom_data?.owner?.extension_number,
      call?.raw_zoom_data?.owner?.extension,
      call?.raw_zoom_data?.owner?.ext_number,
      call?.raw_zoom_data?.owner?.ext,

      null
    )
  );
}

// ============================================================
// TOP LEVEL EXTENSION
// ============================================================

function getTopLevelExtension(call) {
  return normalizeExtension(
    firstValue(
      call?.extension_number,
      call?.extension,
      call?.ext_number,
      call?.ext,

      // IMPORTANT:
      // Do NOT use call.crm_extension here.
      // crm_extension is calculated by CRM.
      // It is not a raw Zoom source.

      call?.raw?.extension_number,
      call?.raw?.extension,
      call?.raw?.ext_number,
      call?.raw?.ext,

      call?.raw_zoom_data?.extension_number,
      call?.raw_zoom_data?.extension,
      call?.raw_zoom_data?.ext_number,
      call?.raw_zoom_data?.ext,

      null
    )
  );
}

// ============================================================
// CRM EXTENSION
// ============================================================
//
// INBOUND:
//   Employee = CALLEE
//
// OUTBOUND:
//   Employee = CALLER
//
// UNKNOWN:
//   owner -> top -> caller -> callee
// ============================================================

function getCrmExtension(call) {
  const direction = getDirection(call);

  const callerExtension =
    getCallerExtension(call);

  const calleeExtension =
    getCalleeExtension(call);

  const ownerExtension =
    getOwnerExtension(call);

  const topExtension =
    getTopLevelExtension(call);

  // ----------------------------------------------------------
  // INBOUND
  // ----------------------------------------------------------

  if (
    direction.includes("inbound") ||
    direction === "in"
  ) {
    return (
      calleeExtension ||
      ownerExtension ||
      topExtension ||
      ""
    );
  }

  // ----------------------------------------------------------
  // OUTBOUND
  // ----------------------------------------------------------

  if (
    direction.includes("outbound") ||
    direction === "out"
  ) {
    return (
      callerExtension ||
      ownerExtension ||
      topExtension ||
      ""
    );
  }

  // ----------------------------------------------------------
  // UNKNOWN
  // ----------------------------------------------------------

  return (
    ownerExtension ||
    topExtension ||
    callerExtension ||
    calleeExtension ||
    ""
  );
}

// ============================================================
// OWNER NAME
// ============================================================

function getOwnerName(call) {
  return String(
    firstValue(
      call?.owner?.name,
      call?.owner_name,
      call?.raw?.owner?.name,
      call?.raw_zoom_data?.owner?.name,
      ""
    )
  ).trim();
}

// ============================================================
// CALLER NAME
// ============================================================

function getCallerName(call) {
  return String(
    firstValue(
      call?.caller_name,
      call?.caller?.name,
      call?.from?.name,

      call?.raw?.caller_name,
      call?.raw?.caller?.name,
      call?.raw?.from?.name,

      call?.raw_zoom_data?.caller_name,
      call?.raw_zoom_data?.caller?.name,

      ""
    )
  ).trim();
}

// ============================================================
// CALLEE NAME
// ============================================================

function getCalleeName(call) {
  return String(
    firstValue(
      call?.callee_name,
      call?.callee?.name,
      call?.to?.name,

      call?.raw?.callee_name,
      call?.raw?.callee?.name,
      call?.raw?.to?.name,

      call?.raw_zoom_data?.callee_name,
      call?.raw_zoom_data?.callee?.name,

      ""
    )
  ).trim();
}

// ============================================================
// START TIME
// ============================================================

function getStartTime(call) {
  return firstValue(
    call?.start_time,
    call?.date_time,
    call?.startTime,
    call?.start_datetime,
    call?.datetime,
    call?.date,

    call?.raw?.start_time,
    call?.raw?.date_time,

    call?.raw_zoom_data?.start_time,

    null
  );
}

// ============================================================
// END TIME
// ============================================================

function getEndTime(call) {
  return firstValue(
    call?.end_time,
    call?.endTime,
    call?.end_datetime,

    call?.raw?.end_time,
    call?.raw_zoom_data?.end_time,

    null
  );
}

// ============================================================
// DURATION
// ============================================================

function getDuration(call) {
  const value = firstValue(
    call?.duration,
    call?.duration_seconds,
    call?.durationSeconds,

    call?.raw?.duration,
    call?.raw_zoom_data?.duration,

    0
  );

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(number);
}

// ============================================================
// CALL HISTORY UUID
// ============================================================

function getCallHistoryUuid(call) {
  return firstValue(
    call?.call_history_uuid,
    call?.callHistoryUuid,
    call?.history_uuid,

    call?.raw?.call_history_uuid,
    call?.raw_zoom_data?.call_history_uuid,

    null
  );
}

// ============================================================
// ZOOM CALL ID
// ============================================================

function getZoomCallId(call) {
  return firstValue(
    call?.call_id,
    call?.callId,
    call?.zoom_call_id,

    call?.raw?.call_id,
    call?.raw_zoom_data?.call_id,

    null
  );
}

// ============================================================
// FALLBACK KEY
// ============================================================

function getFallbackCallKey(call) {
  const direction =
    getDirection(call);

  const callerExtension =
    getCallerExtension(call);

  const calleeExtension =
    getCalleeExtension(call);

  const startTime =
    getStartTime(call);

  const duration =
    getDuration(call);

  const callerNumber =
    firstValue(
      call?.caller_number,
      call?.caller,
      ""
    );

  const calleeNumber =
    firstValue(
      call?.callee_number,
      call?.receiver_number,
      call?.callee,
      ""
    );

  return [
    direction,
    callerExtension,
    calleeExtension,
    callerNumber,
    calleeNumber,
    startTime,
    duration,
  ]
    .map((value) =>
      String(value ?? "").trim()
    )
    .join("|");
}

// ============================================================
// CALIFORNIA DATE
// ============================================================

function getCaliforniaDate(date) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: CRM_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

// ============================================================
// DEFAULT DATE RANGE
// ============================================================

function getDefaultDateRange() {
  const now = new Date();

  const today =
    getCaliforniaDate(now);

  const previous =
    new Date(
      now.getTime() -
        6 *
          24 *
          60 *
          60 *
          1000
    );

  const previousDate =
    getCaliforniaDate(previous);

  return {
    from: previousDate,
    to: today,
  };
}

// ============================================================
// DATE VALIDATION
// ============================================================

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
}

// ============================================================
// REFRESH ZOOM TOKEN
// ============================================================

async function refreshZoomToken(connection) {
  const clientId =
    process.env.ZOOM_CLIENT_ID;

  const clientSecret =
    process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Zoom client configuration is missing"
    );
  }

  if (!connection?.refresh_token) {
    throw new Error(
      "Zoom refresh token is missing. Please reconnect Zoom."
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const response =
    await fetch(
      ZOOM_TOKEN_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "refresh_token",

            refresh_token:
              connection.refresh_token,
          }).toString(),

        cache: "no-store",
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.reason ||
        data?.message ||
        "Could not refresh Zoom access token"
    );
  }

  if (!data?.access_token) {
    throw new Error(
      "Zoom did not return a new access token"
    );
  }

  const newAccessToken =
    data.access_token;

  const newRefreshToken =
    data.refresh_token ||
    connection.refresh_token;

  let newExpiresAt = null;

  if (data.expires_in) {
    newExpiresAt =
      new Date(
        Date.now() +
          Number(data.expires_in) *
            1000
      );
  }

  await query(
    `
      UPDATE zoom_connections
      SET
        access_token = ?,
        refresh_token = ?,
        expires_at = ?
      WHERE id = ?
    `,
    [
      newAccessToken,
      newRefreshToken,
      newExpiresAt,
      connection.id,
    ]
  );

  return {
    accessToken:
      newAccessToken,

    refreshToken:
      newRefreshToken,

    expiresAt:
      newExpiresAt,
  };
}

// ============================================================
// GET ZOOM CONNECTION
// ============================================================

async function getZoomConnection(crmUserId) {
  // ----------------------------------------------------------
  // CURRENT USER CONNECTION
  // ----------------------------------------------------------

  const ownConnections =
    await query(
      `
        SELECT
          id,
          user_id,
          zoom_account_id,
          zoom_user_id,
          zoom_email,
          access_token,
          refresh_token,
          expires_at
        FROM zoom_connections
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [crmUserId]
    );

  if (ownConnections.length > 0) {
    return ownConnections[0];
  }

  // ----------------------------------------------------------
  // FALLBACK TO NEWEST ACCOUNT CONNECTION
  // ----------------------------------------------------------

  const connections =
    await query(
      `
        SELECT
          id,
          user_id,
          zoom_account_id,
          zoom_user_id,
          zoom_email,
          access_token,
          refresh_token,
          expires_at
        FROM zoom_connections
        ORDER BY id DESC
        LIMIT 1
      `
    );

  return (
    connections[0] ||
    null
  );
}

// ============================================================
// FETCH ONE ZOOM PAGE
// ============================================================

async function fetchZoomPage({
  accessToken,
  from,
  to,
  pageSize,
  nextPageToken,
  connection,
}) {
  const url =
    new URL(
      ZOOM_CALL_HISTORY_URL
    );

  url.searchParams.set(
    "from",
    from
  );

  url.searchParams.set(
    "to",
    to
  );

  url.searchParams.set(
    "page_size",
    String(pageSize)
  );

  if (nextPageToken) {
    url.searchParams.set(
      "next_page_token",
      nextPageToken
    );
  }

  let currentToken =
    accessToken;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    let response;

    try {
      response =
        await fetch(
          url.toString(),
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${currentToken}`,

              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );
    } catch (error) {
      if (
        attempt >=
        MAX_RETRIES
      ) {
        throw error;
      }

      await sleep(
        RETRY_DELAY_MS *
          attempt
      );

      continue;
    }

    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    if (response.ok) {
      return {
        data,
        accessToken:
          currentToken,
      };
    }

    // --------------------------------------------------------
    // RATE LIMIT
    // --------------------------------------------------------

    if (
      response.status === 429
    ) {
      const retryAfterHeader =
        response.headers.get(
          "retry-after"
        );

      const retryAfter =
        Number(
          retryAfterHeader
        );

      console.warn(
        "ZOOM RATE LIMIT:",
        {
          attempt,
          retryAfter,
          message:
            data?.message ||
            data?.reason ||
            "Rate limited",
        }
      );

      if (
        attempt >=
        MAX_RETRIES
      ) {
        throw new Error(
          "Zoom API rate limit reached. Please try again shortly."
        );
      }

      const wait =
        Number.isFinite(
          retryAfter
        ) &&
        retryAfter > 0
          ? retryAfter *
            1000
          : RETRY_DELAY_MS *
            attempt;

      await sleep(wait);

      continue;
    }

    // --------------------------------------------------------
    // ACCESS TOKEN INVALID
    // --------------------------------------------------------

    if (
      response.status === 401 &&
      connection?.refresh_token
    ) {
      try {
        const refreshed =
          await refreshZoomToken(
            connection
          );

        currentToken =
          refreshed.accessToken;

        continue;
      } catch (
        refreshError
      ) {
        throw new Error(
          `Zoom authentication failed: ${refreshError.message}`
        );
      }
    }

    // --------------------------------------------------------
    // OTHER ERROR
    // --------------------------------------------------------

    const message =
      data?.message ||
      data?.reason ||
      "Could not retrieve Zoom call history";

    throw new Error(
      `${message} (HTTP ${response.status})`
    );
  }

  throw new Error(
    "Zoom request failed"
  );
}

// ============================================================
// EXTRACT CALLS
// ============================================================

function extractCalls(data) {
  if (
    Array.isArray(
      data?.call_history
    )
  ) {
    return data.call_history;
  }

  if (
    Array.isArray(
      data?.call_logs
    )
  ) {
    return data.call_logs;
  }

  if (
    Array.isArray(
      data?.calls
    )
  ) {
    return data.calls;
  }

  return [];
}

// ============================================================
// FIND EXISTING CALL
// ============================================================
//
// IMPORTANT:
//
// This is ONLY for database synchronization.
//
// It does NOT remove records from Zoom response.
//
// Duplicate rows from SAME Zoom response are inserted
// using duplicateIndex > 0.
// ============================================================

async function findExistingCall(call) {
  const callHistoryUuid =
    getCallHistoryUuid(call);

  const zoomCallId =
    getZoomCallId(call);

  // ----------------------------------------------------------
  // CALL HISTORY UUID
  // ----------------------------------------------------------

  if (callHistoryUuid) {
    const rows =
      await query(
        `
          SELECT id
          FROM zoom_call_logs
          WHERE call_history_uuid = ?
          ORDER BY id ASC
          LIMIT 1
        `,
        [callHistoryUuid]
      );

    if (rows.length > 0) {
      return rows[0];
    }
  }

  // ----------------------------------------------------------
  // ZOOM CALL ID
  // ----------------------------------------------------------

  if (zoomCallId) {
    const rows =
      await query(
        `
          SELECT id
          FROM zoom_call_logs
          WHERE zoom_call_id = ?
          ORDER BY id ASC
          LIMIT 1
        `,
        [zoomCallId]
      );

    if (rows.length > 0) {
      return rows[0];
    }
  }

  return null;
}

// ============================================================
// TABLE COLUMNS
// ============================================================

async function getTableColumns() {
  const rows =
    await query(
      `
        SHOW COLUMNS
        FROM zoom_call_logs
      `
    );

  return new Set(
    rows.map(
      (row) => row.Field
    )
  );
}

// ============================================================
// BUILD DATABASE DATA
// ============================================================

function getCallDatabaseData(call) {
  const callHistoryUuid =
    getCallHistoryUuid(call);

  const zoomCallId =
    getZoomCallId(call);

  const direction =
    firstValue(
      call?.direction,
      null
    );

  const callType =
    firstValue(
      call?.call_type,
      null
    );

  const connectType =
    firstValue(
      call?.connect_type,
      null
    );

  const callerNumber =
    firstValue(
      call?.caller_number,
      call?.caller,
      null
    );

  const receiverNumber =
    firstValue(
      call?.receiver_number,
      call?.callee_number,
      call?.callee,
      null
    );

  const callerName =
    firstValue(
      call?.caller_name,
      getCallerName(call),
      null
    );

  const receiverName =
    firstValue(
      call?.receiver_name,
      getCalleeName(call),
      null
    );

  const callStatus =
    firstValue(
      call?.call_status,
      call?.result,
      call?.status,
      null
    );

  const startTime =
    getStartTime(call);

  const endTime =
    getEndTime(call);

  const durationSeconds =
    getDuration(call);

  const aiSummary =
    firstValue(
      call?.ai_summary,
      null
    );

  const crmExtension =
    getCrmExtension(call);

  const callerExtension =
    getCallerExtension(call);

  const calleeExtension =
    getCalleeExtension(call);

  const ownerExtension =
    getOwnerExtension(call);

  const ownerName =
    getOwnerName(call);

  const zoomData =
    JSON.stringify(call);

  return {
    callHistoryUuid,
    zoomCallId,
    direction,
    callType,
    connectType,
    callerNumber,
    receiverNumber,
    callerName,
    receiverName,
    callStatus,
    startTime,
    endTime,
    durationSeconds,
    aiSummary,
    crmExtension,
    callerExtension,
    calleeExtension,
    ownerExtension,
    ownerName,
    zoomData,
  };
}

// ============================================================
// INSERT CALL
// ============================================================

async function insertCall(
  call,
  tableColumns
) {
  const data =
    getCallDatabaseData(call);

  const columns = [
    "call_history_uuid",
    "zoom_call_id",
    "direction",
    "call_type",
    "connect_type",
    "caller_name",
    "caller_number",
    "receiver_name",
    "receiver_number",
    "call_status",
    "start_time",
    "end_time",
    "duration_seconds",
    "ai_summary",
    "zoom_data",
  ];

  const values = [
    data.callHistoryUuid,
    data.zoomCallId,
    data.direction,
    data.callType,
    data.connectType,
    data.callerName,
    data.callerNumber,
    data.receiverName,
    data.receiverNumber,
    data.callStatus,
    data.startTime,
    data.endTime,
    data.durationSeconds,
    data.aiSummary,
    data.zoomData,
  ];

  // ----------------------------------------------------------
  // OPTIONAL CRM EXTENSION COLUMNS
  // ----------------------------------------------------------

  if (
    tableColumns.has(
      "crm_extension"
    )
  ) {
    columns.push(
      "crm_extension"
    );

    values.push(
      data.crmExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "caller_extension"
    )
  ) {
    columns.push(
      "caller_extension"
    );

    values.push(
      data.callerExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "callee_extension"
    )
  ) {
    columns.push(
      "callee_extension"
    );

    values.push(
      data.calleeExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "owner_extension"
    )
  ) {
    columns.push(
      "owner_extension"
    );

    values.push(
      data.ownerExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "owner_name"
    )
  ) {
    columns.push(
      "owner_name"
    );

    values.push(
      data.ownerName ||
        null
    );
  }

  const placeholders =
    columns
      .map(() => "?")
      .join(", ");

  await query(
    `
      INSERT INTO zoom_call_logs
      (
        ${columns.join(",\n        ")}
      )
      VALUES
      (
        ${placeholders}
      )
    `,
    values
  );

  return {
    action: "inserted",

    extension:
      data.crmExtension ||
      null,
  };
}

// ============================================================
// UPDATE CALL
// ============================================================

async function updateCall(
  call,
  tableColumns,
  existingId
) {
  const data =
    getCallDatabaseData(call);

  const updateFields = [
    "zoom_call_id = ?",
    "direction = ?",
    "call_type = ?",
    "connect_type = ?",
    "caller_name = ?",
    "caller_number = ?",
    "receiver_name = ?",
    "receiver_number = ?",
    "call_status = ?",
    "start_time = ?",
    "end_time = ?",
    "duration_seconds = ?",
    "ai_summary = ?",
    "zoom_data = ?",
    "updated_at = CURRENT_TIMESTAMP",
  ];

  const updateValues = [
    data.zoomCallId,
    data.direction,
    data.callType,
    data.connectType,
    data.callerName,
    data.callerNumber,
    data.receiverName,
    data.receiverNumber,
    data.callStatus,
    data.startTime,
    data.endTime,
    data.durationSeconds,
    data.aiSummary,
    data.zoomData,
  ];

  // ----------------------------------------------------------
  // OPTIONAL CRM EXTENSION COLUMNS
  // ----------------------------------------------------------

  if (
    tableColumns.has(
      "crm_extension"
    )
  ) {
    updateFields.push(
      "crm_extension = ?"
    );

    updateValues.push(
      data.crmExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "caller_extension"
    )
  ) {
    updateFields.push(
      "caller_extension = ?"
    );

    updateValues.push(
      data.callerExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "callee_extension"
    )
  ) {
    updateFields.push(
      "callee_extension = ?"
    );

    updateValues.push(
      data.calleeExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "owner_extension"
    )
  ) {
    updateFields.push(
      "owner_extension = ?"
    );

    updateValues.push(
      data.ownerExtension ||
        null
    );
  }

  if (
    tableColumns.has(
      "owner_name"
    )
  ) {
    updateFields.push(
      "owner_name = ?"
    );

    updateValues.push(
      data.ownerName ||
        null
    );
  }

  updateValues.push(
    existingId
  );

  await query(
    `
      UPDATE zoom_call_logs
      SET
        ${updateFields.join(",\n        ")}
      WHERE id = ?
    `,
    updateValues
  );

  return {
    action: "updated",

    extension:
      data.crmExtension ||
      null,
  };
}

// ============================================================
// SAVE CALL
// ============================================================
//
// duplicateIndex = 0
//   -> existing DB record may UPDATE
//
// duplicateIndex > 0
//   -> ALWAYS INSERT
//
// Therefore duplicate rows returned by Zoom remain.
// ============================================================

async function saveCall(
  call,
  tableColumns,
  duplicateIndex = 0
) {
  // ----------------------------------------------------------
  // DUPLICATE FROM SAME ZOOM RESPONSE
  // ----------------------------------------------------------

  if (
    duplicateIndex > 0
  ) {
    return insertCall(
      call,
      tableColumns
    );
  }

  // ----------------------------------------------------------
  // FIRST OCCURRENCE
  // ----------------------------------------------------------

  const existing =
    await findExistingCall(
      call
    );

  if (existing) {
    return updateCall(
      call,
      tableColumns,
      existing.id
    );
  }

  return insertCall(
    call,
    tableColumns
  );
}

// ============================================================
// FILTER FOR USER
// ============================================================
//
// IMPORTANT:
//
// Zoom fetch/sync = ALL records.
//
// UI response:
// ADMIN  = ALL
// USER   = own extension
//
// This keeps database sync complete while protecting
// normal users from seeing other users' calls.
// ============================================================

function filterCallsForUser(
  calls,
  currentUser,
  isAdmin
) {
  // ----------------------------------------------------------
  // ADMIN = ALL
  // ----------------------------------------------------------

  if (isAdmin) {
    return calls;
  }

  // ----------------------------------------------------------
  // NORMAL USER
  // ----------------------------------------------------------

  const userExtension =
    normalizeExtension(
      currentUser?.zoom_extension
    );

  if (!userExtension) {
    return [];
  }

  return calls.filter(
    (call) => {
      const crmExtension =
        normalizeExtension(
          getCrmExtension(call)
        );

      return (
        crmExtension ===
        userExtension
      );
    }
  );
}

// ============================================================
// FORMAT CALL
// ============================================================

function formatCallForResponse(
  call,
  index
) {
  const direction =
    getDirection(call);

  const callerExtension =
    getCallerExtension(call);

  const calleeExtension =
    getCalleeExtension(call);

  const ownerExtension =
    getOwnerExtension(call);

  const crmExtension =
    getCrmExtension(call);

  const callerName =
    getCallerName(call);

  const calleeName =
    getCalleeName(call);

  const ownerName =
    getOwnerName(call);

  const startTime =
    getStartTime(call);

  const endTime =
    getEndTime(call);

  const durationSeconds =
    getDuration(call);

  return {
    ...call,

    // Every row gets its own index.
    // Duplicate rows remain distinguishable.
    _row_index: index,

    direction,

    caller_extension:
      callerExtension ||
      null,

    callee_extension:
      calleeExtension ||
      null,

    owner_extension:
      ownerExtension ||
      null,

    crm_extension:
      crmExtension ||
      null,

    caller_name:
      callerName ||
      call?.caller_name ||
      null,

    receiver_name:
      calleeName ||
      call?.receiver_name ||
      null,

    owner_name:
      ownerName ||
      null,

    start_time:
      startTime ||
      null,

    end_time:
      endTime ||
      null,

    duration_seconds:
      durationSeconds,

    call_history_uuid:
      getCallHistoryUuid(call),

    zoom_call_id:
      getZoomCallId(call),
  };
}

// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    // ========================================================
    // 1. LOGIN
    // ========================================================

    const token =
      request.cookies.get(
        "token"
      )?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CRM login required",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // 2. JWT
    // ========================================================

    let decoded;

    try {
      decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );
    } catch (error) {
      console.error(
        "JWT VERIFY ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired CRM session",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    const crmUserId =
      decoded?.id ||
      decoded?.userId ||
      decoded?.user_id;

    if (!crmUserId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CRM user ID not found",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // 3. CURRENT USER
    // ========================================================

    const users =
      await query(
        `
          SELECT
            id,
            name,
            email,
            role,
            zoom_extension
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [crmUserId]
      );

    if (
      users.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CRM user not found",
        },
        {
          status: 404,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    const currentUser =
      users[0];

    const isAdmin =
      String(
        currentUser.role ||
          ""
      )
        .trim()
        .toLowerCase() ===
      "admin";

    const userExtension =
      normalizeExtension(
        currentUser.zoom_extension
      );

    // ========================================================
    // 4. QUERY PARAMETERS
    // ========================================================

    const { searchParams } =
      new URL(
        request.url
      );

    const defaultRange =
      getDefaultDateRange();

    let from =
      searchParams.get(
        "from"
      ) ||
      defaultRange.from;

    let to =
      searchParams.get(
        "to"
      ) ||
      defaultRange.to;

    if (
      !isValidDateString(from)
    ) {
      from =
        defaultRange.from;
    }

    if (
      !isValidDateString(to)
    ) {
      to =
        defaultRange.to;
    }

    // Swap if reversed
    if (from > to) {
      const temp = from;
      from = to;
      to = temp;
    }

    // ========================================================
    // PAGE SIZE
    // ========================================================

    let pageSize =
      Number(
        searchParams.get(
          "page_size"
        ) ||
          DEFAULT_PAGE_SIZE
      );

    if (
      !Number.isFinite(
        pageSize
      ) ||
      pageSize < 1
    ) {
      pageSize =
        DEFAULT_PAGE_SIZE;
    }

    pageSize =
      Math.min(
        Math.floor(
          pageSize
        ),
        MAX_PAGE_SIZE
      );

    // ========================================================
    // KEYWORD
    // ========================================================

    const requestedKeyword =
      normalizeExtension(
        searchParams.get(
          "keyword"
        )
      );

    // Admin can request a specific extension.
    // Normal user is locked to own extension.

    const effectiveKeyword =
      isAdmin
        ? requestedKeyword
        : userExtension;

    // ========================================================
    // LOG START
    // ========================================================

    console.log(
      "=========================================="
    );

    console.log(
      "ZOOM CALL LOG SYNC START"
    );

    console.log(
      "CRM USER:",
      currentUser.name,
      crmUserId
    );

    console.log(
      "ROLE:",
      currentUser.role
    );

    console.log(
      "ADMIN:",
      isAdmin
    );

    console.log(
      "USER EXTENSION:",
      userExtension ||
        "NONE"
    );

    console.log(
      "REQUESTED KEYWORD:",
      requestedKeyword ||
        "NONE"
    );

    console.log(
      "EFFECTIVE EXTENSION:",
      effectiveKeyword ||
        "ALL"
    );

    console.log(
      "DATE FROM:",
      from
    );

    console.log(
      "DATE TO:",
      to
    );

    console.log(
      "PAGE SIZE:",
      pageSize
    );

    console.log(
      "=========================================="
    );

    // ========================================================
    // 5. ZOOM CONNECTION
    // ========================================================

    const connection =
      await getZoomConnection(
        crmUserId
      );

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No Zoom connection found. Please connect Zoom first.",
        },
        {
          status: 404,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    console.log(
      "ZOOM CONNECTION:",
      connection.zoom_email
    );

    // ========================================================
    // 6. ACCESS TOKEN
    // ========================================================

    let accessToken =
      connection.access_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom access token is missing. Please reconnect Zoom.",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // 7. TOKEN REFRESH
    // ========================================================

    if (
      connection.expires_at
    ) {
      const expiresAt =
        new Date(
          connection.expires_at
        ).getTime();

      const refreshBuffer =
        2 *
        60 *
        1000;

      if (
        Number.isFinite(
          expiresAt
        ) &&
        expiresAt <=
          Date.now() +
            refreshBuffer
      ) {
        console.log(
          "ZOOM TOKEN EXPIRED / EXPIRING - REFRESHING"
        );

        const refreshed =
          await refreshZoomToken(
            connection
          );

        accessToken =
          refreshed.accessToken;
      }
    }

    // ========================================================
    // 8. FETCH ALL ZOOM RECORDS
    // ========================================================
    //
    // CRITICAL:
    //
    // NO DEDUPE
    // NO USER FILTER
    // NO KEYWORD FILTER
    // NO LOCAL DATE FILTER
    //
    // allCalls = EXACTLY all records returned by Zoom.
    // ========================================================

    let allCalls = [];

    let nextPageToken =
      null;

    let pageNumber = 0;

    const seenPageTokens =
      new Set();

    do {
      pageNumber++;

      // ------------------------------------------------------
      // MAX PAGE SAFETY
      // ------------------------------------------------------

      if (
        pageNumber >
        MAX_PAGES
      ) {
        console.warn(
          "MAX ZOOM PAGES REACHED:",
          MAX_PAGES
        );

        break;
      }

      // ------------------------------------------------------
      // PREVENT REPEATED TOKEN LOOP
      // ------------------------------------------------------

      if (nextPageToken) {
        if (
          seenPageTokens.has(
            nextPageToken
          )
        ) {
          console.warn(
            "REPEATED NEXT PAGE TOKEN - STOPPING"
          );

          break;
        }

        seenPageTokens.add(
          nextPageToken
        );
      }

      console.log(
        `Fetching Zoom page ${pageNumber}`
      );

      // ------------------------------------------------------
      // FETCH PAGE
      // ------------------------------------------------------

      const result =
        await fetchZoomPage({
          accessToken,
          from,
          to,
          pageSize,
          nextPageToken,
          connection,
        });

      accessToken =
        result.accessToken;

      const zoomData =
        result.data;

      const calls =
        extractCalls(
          zoomData
        );

      console.log(
        "ZOOM PAGE:",
        pageNumber,
        "CALLS:",
        calls.length,
        "HAS NEXT TOKEN:",
        Boolean(
          zoomData?.next_page_token
        )
      );

      // ------------------------------------------------------
      // CRITICAL:
      //
      // DIRECTLY APPEND EVERYTHING.
      //
      // NOTHING IS REMOVED.
      // ------------------------------------------------------

      allCalls.push(
        ...calls
      );

      // ------------------------------------------------------
      // NEXT PAGE
      // ------------------------------------------------------

      nextPageToken =
        zoomData?.next_page_token ||
        null;

      if (
        nextPageToken
      ) {
        await sleep(300);
      }
    } while (
      nextPageToken
    );

    // ========================================================
    // 9. ZOOM RAW TOTAL
    // ========================================================

    const zoomRawTotal =
      allCalls.length;

    console.log(
      "=========================================="
    );

    console.log(
      "ZOOM RAW TOTAL:",
      zoomRawTotal
    );

    console.log(
      "ZOOM PAGES FETCHED:",
      pageNumber
    );

    console.log(
      "=========================================="
    );

    // ========================================================
    // 10. DUPLICATE COUNT
    // ========================================================
    //
    // REPORT ONLY.
    //
    // NOTHING IS REMOVED.
    // ========================================================

    const occurrenceMap =
      new Map();

    let duplicateCount = 0;

    for (
      const call of allCalls
    ) {
      const historyUuid =
        getCallHistoryUuid(
          call
        );

      const zoomCallId =
        getZoomCallId(
          call
        );

      let key;

      if (historyUuid) {
        key =
          `history:${String(
            historyUuid
          ).trim()}`;
      } else if (
        zoomCallId
      ) {
        key =
          `call:${String(
            zoomCallId
          ).trim()}`;
      } else {
        key =
          `fallback:${getFallbackCallKey(
            call
          )}`;
      }

      const count =
        occurrenceMap.get(
          key
        ) || 0;

      if (count > 0) {
        duplicateCount++;
      }

      occurrenceMap.set(
        key,
        count + 1
      );
    }

    // ========================================================
    // 11. DATABASE COLUMNS
    // ========================================================

    const tableColumns =
      await getTableColumns();

    // ========================================================
    // 12. SAVE ALL RECORDS
    // ========================================================
    //
    // IMPORTANT:
    //
    // ALL Zoom records are synchronized.
    //
    // User filtering happens AFTER sync.
    // ========================================================

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    const errors = [];

    const extensionCounts =
      {};

    const syncOccurrenceMap =
      new Map();

    for (
      let index = 0;
      index <
      allCalls.length;
      index++
    ) {
      const call =
        allCalls[index];

      try {
        const historyUuid =
          getCallHistoryUuid(
            call
          );

        const zoomCallId =
          getZoomCallId(
            call
          );

        // ----------------------------------------------------
        // OCCURRENCE KEY
        // ----------------------------------------------------

        let occurrenceKey;

        if (historyUuid) {
          occurrenceKey =
            `history:${String(
              historyUuid
            ).trim()}`;
        } else if (
          zoomCallId
        ) {
          occurrenceKey =
            `call:${String(
              zoomCallId
            ).trim()}`;
        } else {
          occurrenceKey =
            `fallback:${getFallbackCallKey(
              call
            )}`;
        }

        const occurrenceIndex =
          syncOccurrenceMap.get(
            occurrenceKey
          ) || 0;

        syncOccurrenceMap.set(
          occurrenceKey,
          occurrenceIndex + 1
        );

        // ----------------------------------------------------
        // EXTENSION COUNT
        // ----------------------------------------------------

        const extension =
          getCrmExtension(
            call
          );

        if (extension) {
          extensionCounts[
            extension
          ] =
            (
              extensionCounts[
                extension
              ] || 0
            ) + 1;
        }

        // ----------------------------------------------------
        // SAVE
        // ----------------------------------------------------

        const result =
          await saveCall(
            call,
            tableColumns,
            occurrenceIndex
          );

        if (
          result.action ===
          "inserted"
        ) {
          inserted++;
        } else {
          updated++;
        }
      } catch (
        saveError
      ) {
        failed++;

        console.error(
          "FAILED TO SAVE ZOOM CALL:",
          saveError
        );

        if (
          errors.length <
          20
        ) {
          errors.push({
            row_index:
              index,

            error:
              saveError?.message ||
              "Unknown save error",

            call_id:
              getZoomCallId(
                call
              ),

            call_history_uuid:
              getCallHistoryUuid(
                call
              ),

            crm_extension:
              getCrmExtension(
                call
              ),
          });
        }
      }
    }

    // ========================================================
    // 13. FILTER ONLY FOR RESPONSE/UI
    // ========================================================
    //
    // IMPORTANT:
    //
    // allCalls already contains ALL Zoom records.
    //
    // Admin:
    //   ALL records
    //
    // Normal user:
    //   ONLY own extension
    //
    // This does NOT affect:
    //   zoomRawTotal
    //   database sync
    //   duplicate count
    // ========================================================

    let filteredCalls =
      filterCallsForUser(
        allCalls,
        currentUser,
        isAdmin
      );

    // ========================================================
    // 14. ADMIN KEYWORD FILTER
    // ========================================================
    //
    // Only response/UI filter.
    //
    // Database has already received ALL records.
    // ========================================================

    if (
      isAdmin &&
      requestedKeyword
    ) {
      filteredCalls =
        filteredCalls.filter(
          (call) =>
            normalizeExtension(
              getCrmExtension(
                call
              )
            ) ===
            requestedKeyword
        );
    }

    // ========================================================
    // 15. FORMAT RESPONSE
    // ========================================================

    const responseCalls =
      filteredCalls.map(
        (
          call,
          index
        ) =>
          formatCallForResponse(
            call,
            index
          )
      );

    // ========================================================
    // 16. DETECTED EXTENSIONS
    // ========================================================

    const detectedExtensions =
      Object.keys(
        extensionCounts
      ).sort(
        (a, b) =>
          Number(a) -
          Number(b)
      );

    // ========================================================
    // 17. CURRENT USER EXTENSION COUNT
    // ========================================================
    //
    // This count is calculated from ALL Zoom records.
    //
    // Therefore user total is based on Zoom data,
    // not database INSERT/UPDATE counts.
    // ========================================================

    const currentUserExtensionCount =
      userExtension
        ? allCalls.filter(
            (call) =>
              normalizeExtension(
                getCrmExtension(
                  call
                )
              ) ===
              userExtension
          ).length
        : 0;

    // ========================================================
    // 18. KEYWORD EXACT COUNT
    // ========================================================

    const keywordCount =
      requestedKeyword
        ? allCalls.filter(
            (call) =>
              normalizeExtension(
                getCrmExtension(
                  call
                )
              ) ===
              requestedKeyword
          ).length
        : null;

    // ========================================================
    // 19. FINAL LOGS
    // ========================================================

    console.log(
      "=========================================="
    );

    console.log(
      "ZOOM CALL LOG SYNC COMPLETE"
    );

    console.log(
      "FROM:",
      from
    );

    console.log(
      "TO:",
      to
    );

    console.log(
      "RAW TOTAL FROM ZOOM:",
      zoomRawTotal
    );

    console.log(
      "DUPLICATES:",
      duplicateCount
    );

    console.log(
      "REQUESTED KEYWORD:",
      requestedKeyword ||
        "NONE"
    );

    console.log(
      "KEYWORD TOTAL:",
      keywordCount
    );

    console.log(
      "USER EXTENSION:",
      userExtension ||
        "NONE"
    );

    console.log(
      "USER EXTENSION TOTAL:",
      currentUserExtensionCount
    );

    console.log(
      "RETURNED TO UI:",
      responseCalls.length
    );

    console.log(
      "INSERTED:",
      inserted
    );

    console.log(
      "UPDATED:",
      updated
    );

    console.log(
      "FAILED:",
      failed
    );

    console.log(
      "EXTENSION COUNTS:",
      extensionCounts
    );

    console.log(
      "PAGES:",
      pageNumber
    );

    console.log(
      "=========================================="
    );

    // ========================================================
    // 20. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success:
          failed === 0,

        message:
          "Zoom call history synchronized successfully",

        from,
        to,

        timezone:
          CRM_TIME_ZONE,

        // ----------------------------------------------------
        // CURRENT USER
        // ----------------------------------------------------

        current_user: {
          id:
            currentUser.id,

          name:
            currentUser.name,

          email:
            currentUser.email,

          role:
            currentUser.role,

          zoom_extension:
            userExtension ||
            null,
        },

        // ----------------------------------------------------
        // REQUEST
        // ----------------------------------------------------

        requested_keyword:
          requestedKeyword ||
          null,

        effective_extension:
          effectiveKeyword ||
          null,

        // ----------------------------------------------------
        // SCOPE
        // ----------------------------------------------------

        // Database sync ALWAYS covers all Zoom calls.
        sync_scope:
          "ALL_ZOOM_ACCOUNT_CALLS",

        // UI/display scope depends on user.
        display_scope:
          isAdmin
            ? requestedKeyword
              ? "ADMIN_EXTENSION_FILTER"
              : "ALL_CALLS"
            : "CURRENT_USER_EXTENSION",

        // ----------------------------------------------------
        // IMPORTANT TOTALS
        // ----------------------------------------------------

        // EXACT NUMBER OF ROWS RECEIVED FROM ZOOM
        total_from_zoom:
          zoomRawTotal,

        raw_total:
          zoomRawTotal,

        // Number returned for current user/admin filter
        total:
          responseCalls.length,

        total_returned:
          responseCalls.length,

        // ----------------------------------------------------
        // USER TOTAL
        // ----------------------------------------------------

        // Exact count from ALL Zoom records
        // for this user's extension.
        current_user_total:
          currentUserExtensionCount,

        // ----------------------------------------------------
        // PAGE INFORMATION
        // ----------------------------------------------------

        pages_fetched:
          pageNumber,

        page_size:
          pageSize,

        max_pages:
          MAX_PAGES,

        // ----------------------------------------------------
        // DUPLICATES
        // ----------------------------------------------------

        duplicate_total:
          duplicateCount,

        no_deduplication:
          true,

        duplicates_preserved:
          true,

        // ----------------------------------------------------
        // KEYWORD
        // ----------------------------------------------------

        keyword_total:
          keywordCount,

        // ----------------------------------------------------
        // USER EXTENSION
        // ----------------------------------------------------

        current_user_extension_count:
          currentUserExtensionCount,

        // ----------------------------------------------------
        // DATABASE
        // ----------------------------------------------------

        inserted,

        updated,

        failed,

        // ----------------------------------------------------
        // EXTENSIONS
        // ----------------------------------------------------

        detected_extensions:
          detectedExtensions,

        extension_counts:
          extensionCounts,

        // ----------------------------------------------------
        // DATABASE COLUMNS
        // ----------------------------------------------------

        database_extension_columns: {
          crm_extension:
            tableColumns.has(
              "crm_extension"
            ),

          caller_extension:
            tableColumns.has(
              "caller_extension"
            ),

          callee_extension:
            tableColumns.has(
              "callee_extension"
            ),

          owner_extension:
            tableColumns.has(
              "owner_extension"
            ),

          owner_name:
            tableColumns.has(
              "owner_name"
            ),
        },

        // ----------------------------------------------------
        // ACTUAL CALL DATA
        // ----------------------------------------------------

        calls:
          responseCalls,

        // ----------------------------------------------------
        // ERRORS
        // ----------------------------------------------------

        errors:
          errors.length > 0
            ? errors
            : undefined,
      },

      {
        status: 200,
        headers:
          NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "=========================================="
    );

    console.error(
      "ZOOM CALL LOG SYNC ERROR"
    );

    console.error(
      error
    );

    console.error(
      "MESSAGE:",
      error?.message
    );

    console.error(
      "STACK:",
      error?.stack
    );

    console.error(
      "=========================================="
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Zoom call sync failed",
      },

      {
        status: 500,
        headers:
          NO_CACHE_HEADERS,
      }
    );
  }
}