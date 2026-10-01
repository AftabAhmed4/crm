import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONFIG
========================================================= */

const ZOOM_CALL_HISTORY_URL =
  "https://api.zoom.us/v2/phone/call_history";

const ZOOM_TOKEN_URL =
  "https://zoom.us/oauth/token";

const CRM_TIME_ZONE =
  "America/Los_Angeles";

const PAGE_SIZE = 300;

const MAX_FULL_PAGES = 200;
const MAX_LIVE_PAGES = 50;

const TOKEN_REFRESH_THRESHOLD_MS =
  2 * 60 * 1000;

/*
 * DB CACHE TTL
 *
 * FULL = 10 minutes
 * LIVE = 5 minutes
 */
const FULL_CACHE_TTL_SECONDS = 10 * 60;
const LIVE_CACHE_TTL_SECONDS = 5 * 60;

/*
 * If Zoom gives 429 and there is no cached data,
 * don't continuously hit Zoom.
 */
const FALLBACK_RATE_LIMIT_SECONDS =
  5 * 60;

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

/* =========================================================
   EXTENSION
========================================================= */

function normalizeExtension(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  let extension =
    String(value)
      .trim()
      .toLowerCase();

  if (!extension) {
    return "";
  }

  extension =
    extension
      .replace(
        /^extension[\s:._-]*/i,
        ""
      )
      .replace(
        /^ext[\s:._-]*/i,
        ""
      )
      .trim();

  if (/^\d+\.\d+$/.test(extension)) {
    const [numberPart, decimalPart] =
      extension.split(".");

    if (/^0+$/.test(decimalPart)) {
      extension = numberPart;
    }
  }

  extension =
    extension.replace(
      /[^0-9a-z_-]/g,
      ""
    );

  return extension;
}

/* =========================================================
   CALIFORNIA DATE
========================================================= */

function getCaliforniaDateString(
  date = new Date()
) {
  const parsed =
    date instanceof Date
      ? date
      : new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        CRM_TIME_ZONE,

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(parsed);
}

/* =========================================================
   CALIFORNIA DATE/TIME
========================================================= */

function getCaliforniaDateTimeInfo() {
  const now = new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          CRM_TIME_ZONE,

        year: "numeric",
        month: "2-digit",
        day: "2-digit",

        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",

        hour12: false,
      }
    ).formatToParts(now);

  const values = {};

  for (const part of parts) {
    if (
      part.type !==
      "literal"
    ) {
      values[part.type] =
        part.value;
    }
  }

  const hour =
    values.hour === "24"
      ? "00"
      : values.hour;

  const date =
    `${values.year}-${values.month}-${values.day}`;

  const time =
    `${hour}:${values.minute}:${values.second}`;

  return {
    now,
    date,
    time,
    iso:
      now.toISOString(),
  };
}

/* =========================================================
   DEFAULT RANGE
   LAST 7 DAYS
========================================================= */

function getDefaultDateRange() {
  const today =
    getCaliforniaDateString();

  const [
    year,
    month,
    day,
  ] =
    today
      .split("-")
      .map(Number);

  const fromDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  fromDate.setUTCDate(
    fromDate.getUTCDate() - 6
  );

  return {
    from:
      [
        fromDate.getUTCFullYear(),
        pad2(
          fromDate.getUTCMonth() + 1
        ),
        pad2(
          fromDate.getUTCDate()
        ),
      ].join("-"),

    to:
      today,
  };
}

/* =========================================================
   TODAY
========================================================= */

function getTodayRange() {
  const today =
    getCaliforniaDateString();

  return {
    from: today,
    to: today,
  };
}

/* =========================================================
   DATE PARSER
========================================================= */

function parseDateString(value) {
  if (
    !value ||
    typeof value !==
      "string"
  ) {
    return null;
  }

  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return date;
}

/* =========================================================
   DIRECTION
========================================================= */

function getCallDirection(call) {
  const raw =
    firstValue(
      call?.direction,
      call?.call_direction,
      call?.callDirection,
      call?.type,
      call?.call_type,
      call?.callType
    );

  return String(raw || "")
    .toLowerCase()
    .trim();
}

function isInboundCall(call) {
  const direction =
    getCallDirection(call);

  return (
    direction === "in" ||
    direction === "inbound" ||
    direction === "incoming" ||
    direction.includes(
      "inbound"
    ) ||
    direction.includes(
      "incoming"
    )
  );
}

function isOutboundCall(call) {
  const direction =
    getCallDirection(call);

  return (
    direction === "out" ||
    direction === "outbound" ||
    direction === "outgoing" ||
    direction.includes(
      "outbound"
    ) ||
    direction.includes(
      "outgoing"
    )
  );
}

/* =========================================================
   FIND EXTENSION
========================================================= */

function findExtension(
  ...values
) {
  for (const value of values) {
    const extension =
      normalizeExtension(
        value
      );

    if (extension) {
      return extension;
    }
  }

  return "";
}

/* =========================================================
   CALLER EXTENSION
========================================================= */

function getCallerExtension(call) {
  return findExtension(
    call?.caller_ext_number,
    call?.caller_extension,
    call?.caller_extension_number,
    call?.caller_extensionNumber,
    call?.caller_ext,
    call?.callerExt,
    call?.callerExtNumber,
    call?.caller_extension_id,

    call?.caller?.extension,
    call?.caller?.extension_number,
    call?.caller?.extensionNumber,
    call?.caller?.user_extension,
    call?.caller?.userExtension,
    call?.caller?.ext,
    call?.caller?.ext_number,
    call?.caller?.ext_id,
    call?.caller?.extension_id,

    call?.caller?.user?.extension,
    call?.caller?.user?.extension_number,
    call?.caller?.user?.extensionNumber,

    call?.source?.extension,
    call?.source?.extension_number,
    call?.source?.extensionNumber,
    call?.source?.user_extension,
    call?.source?.userExtension,
    call?.source?.ext,
    call?.source?.ext_number,

    call?.from?.extension,
    call?.from?.extension_number,
    call?.from?.extensionNumber,
    call?.from?.user_extension,
    call?.from?.userExtension,
    call?.from?.ext,
    call?.from?.ext_number,

    call?.raw?.caller_ext_number,
    call?.raw?.caller_extension,
    call?.raw?.caller_extension_number,

    call?.raw_zoom_data?.caller_ext_number,
    call?.raw_zoom_data?.caller_extension,
    call?.raw_zoom_data?.caller_extension_number
  );
}

/* =========================================================
   CALLEE EXTENSION
========================================================= */

function getCalleeExtension(call) {
  return findExtension(
    call?.callee_ext_number,
    call?.callee_extension,
    call?.callee_extension_number,
    call?.callee_extensionNumber,
    call?.callee_ext,
    call?.calleeExt,
    call?.calleeExtNumber,
    call?.callee_extension_id,

    call?.callee?.extension,
    call?.callee?.extension_number,
    call?.callee?.extensionNumber,
    call?.callee?.user_extension,
    call?.callee?.userExtension,
    call?.callee?.ext,
    call?.callee?.ext_number,
    call?.callee?.ext_id,
    call?.callee?.extension_id,

    call?.callee?.user?.extension,
    call?.callee?.user?.extension_number,
    call?.callee?.user?.extensionNumber,

    call?.destination?.extension,
    call?.destination?.extension_number,
    call?.destination?.extensionNumber,
    call?.destination?.user_extension,
    call?.destination?.userExtension,
    call?.destination?.ext,
    call?.destination?.ext_number,

    call?.to?.extension,
    call?.to?.extension_number,
    call?.to?.extensionNumber,
    call?.to?.user_extension,
    call?.to?.userExtension,
    call?.to?.ext,
    call?.to?.ext_number,

    call?.raw?.callee_ext_number,
    call?.raw?.callee_extension,
    call?.raw?.callee_extension_number,

    call?.raw_zoom_data?.callee_ext_number,
    call?.raw_zoom_data?.callee_extension,
    call?.raw_zoom_data?.callee_extension_number
  );
}

/* =========================================================
   TOP LEVEL EXTENSION
========================================================= */

function getTopLevelExtension(call) {
  return findExtension(
    call?.crm_extension,
    call?.extension,
    call?.extension_number,
    call?.extensionNumber,
    call?.user_extension,
    call?.userExtension,
    call?.ext,
    call?.ext_number,
    call?.ext_id,

    call?.user?.extension,
    call?.user?.extension_number,
    call?.user?.extensionNumber,
    call?.user?.user_extension,
    call?.user?.ext,

    call?.owner?.extension,
    call?.owner?.extension_number,
    call?.owner?.extensionNumber,
    call?.owner?.user_extension,
    call?.owner?.userExtension,
    call?.owner?.ext,

    call?.owner_extension,
    call?.owner_ext_number,
    call?.owner_extension_number,

    call?.raw?.extension,
    call?.raw?.extension_number,
    call?.raw?.user_extension,

    call?.raw_zoom_data?.extension,
    call?.raw_zoom_data?.extension_number,
    call?.raw_zoom_data?.user_extension
  );
}

/* =========================================================
   CRM EXTENSION
========================================================= */

function getExtensionFromCall(call) {
  const caller =
    getCallerExtension(call);

  const callee =
    getCalleeExtension(call);

  const top =
    getTopLevelExtension(call);

  if (isInboundCall(call)) {
    return (
      callee ||
      top ||
      caller ||
      ""
    );
  }

  if (isOutboundCall(call)) {
    return (
      caller ||
      top ||
      callee ||
      ""
    );
  }

  return (
    top ||
    caller ||
    callee ||
    ""
  );
}

/* =========================================================
   ENRICH
========================================================= */

function enrichCall(call) {
  const caller =
    getCallerExtension(call);

  const callee =
    getCalleeExtension(call);

  const extension =
    getExtensionFromCall(call);

  return {
    ...call,

    crm_extension:
      extension || null,

    crm_caller_extension:
      caller || null,

    crm_callee_extension:
      callee || null,

    crm_direction:
      getCallDirection(call) ||
      null,
  };
}

/* =========================================================
   ZOOM ERROR
========================================================= */

async function readZoomError(
  response
) {
  try {
    const data =
      await response.json();

    return {
      code:
        data?.code,

      message:
        data?.message ||
        data?.error ||
        `Zoom API returned ${response.status}`,

      raw:
        data,
    };
  } catch {
    return {
      code:
        undefined,

      message:
        `Zoom API returned ${response.status}`,

      raw:
        null,
    };
  }
}

/* =========================================================
   ZOOM PAGE
========================================================= */

async function fetchZoomPage({
  accessToken,
  from,
  to,
  nextPageToken = "",
  pageNumber = 1,
}) {
  const params =
    new URLSearchParams();

  params.set(
    "page_size",
    String(PAGE_SIZE)
  );

  params.set(
    "from",
    from
  );

  params.set(
    "to",
    to
  );

  if (nextPageToken) {
    params.set(
      "next_page_token",
      nextPageToken
    );
  }

  const response =
    await fetch(
      `${ZOOM_CALL_HISTORY_URL}?${params.toString()}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  if (response.ok) {
    return await response.json();
  }

  const error =
    await readZoomError(
      response
    );

  const err =
    new Error(
      error.message
    );

  err.status =
    response.status;

  err.zoomCode =
    error.code;

  err.zoomRaw =
    error.raw;

  err.retryAfter =
    response.headers.get(
      "retry-after"
    );

  err.rateLimitReset =
    response.headers.get(
      "x-ratelimit-reset"
    );

  err.pageNumber =
    pageNumber;

  /*
   * IMPORTANT:
   *
   * NO 429 RETRY HERE.
   */
  throw err;
}

/* =========================================================
   FETCH ALL CALLS
   NO DEDUPLICATION
========================================================= */

async function fetchAllCalls({
  accessToken,
  from,
  to,
  mode,
}) {
  const maxPages =
    mode === "live"
      ? MAX_LIVE_PAGES
      : MAX_FULL_PAGES;

  const allCalls = [];

  let nextPageToken =
    "";

  let pagesFetched =
    0;

  let stoppedBecauseNoNextToken =
    false;

  let stoppedBecauseMaxPages =
    false;

  const pageStats = [];

  /*
   * ONLY pagination-token protection.
   *
   * NOT call deduplication.
   */
  const seenPageTokens =
    new Set();

  while (
    pagesFetched <
    maxPages
  ) {
    if (
      nextPageToken &&
      seenPageTokens.has(
        nextPageToken
      )
    ) {
      console.warn(
        "[Zoom] Pagination token repeated. Stopping."
      );

      break;
    }

    if (nextPageToken) {
      seenPageTokens.add(
        nextPageToken
      );
    }

    const pageNumber =
      pagesFetched + 1;

    const data =
      await fetchZoomPage({
        accessToken,
        from,
        to,
        nextPageToken,
        pageNumber,
      });

    pagesFetched += 1;

    let pageCalls = [];

    if (
      Array.isArray(
        data?.call_logs
      )
    ) {
      pageCalls =
        data.call_logs;
    } else if (
      Array.isArray(
        data?.calls
      )
    ) {
      pageCalls =
        data.calls;
    } else if (
      Array.isArray(
        data?.call_history
      )
    ) {
      pageCalls =
        data.call_history;
    }

    /*
     * NEVER DEDUPE.
     */
    allCalls.push(
      ...pageCalls
    );

    nextPageToken =
      data?.next_page_token ||
      data?.nextPageToken ||
      "";

    pageStats.push({
      page:
        pageNumber,

      records:
        pageCalls.length,

      totalSoFar:
        allCalls.length,

      hasNextPage:
        Boolean(
          nextPageToken
        ),
    });

    console.log(
      `[Zoom] page=${pageNumber} records=${pageCalls.length} total=${allCalls.length}`
    );

    if (!nextPageToken) {
      stoppedBecauseNoNextToken =
        true;

      break;
    }
  }

  if (
    nextPageToken &&
    pagesFetched >=
      maxPages
  ) {
    stoppedBecauseMaxPages =
      true;
  }

  return {
    calls:
      allCalls,

    pagesFetched,

    stoppedBecauseNoNextToken,

    stoppedBecauseMaxPages,

    pageStats,
  };
}

/* =========================================================
   MYSQL CACHE
========================================================= */

function makeCacheKey({
  mode,
  from,
  to,
}) {
  return `zoom-call-history:${mode}:${from}:${to}`;
}

/* =========================================================
   GET CACHE
========================================================= */

async function getDbCache(
  cacheKey
) {
  const [rows] =
    await db.query(
      `
        SELECT
          id,
          cache_key,
          from_date,
          to_date,
          mode,
          payload_json,
          fetched_at,
          expires_at
        FROM zoom_call_history_cache
        WHERE cache_key = ?
        LIMIT 1
      `,
      [cacheKey]
    );

  if (
    !rows ||
    rows.length === 0
  ) {
    return null;
  }

  const row =
    rows[0];

  let payload = null;

  if (
    row.payload_json
  ) {
    try {
      payload =
        typeof row.payload_json ===
        "string"
          ? JSON.parse(
              row.payload_json
            )
          : row.payload_json;
    } catch (error) {
      console.error(
        "[Zoom Cache] Invalid JSON:",
        error
      );

      payload = null;
    }
  }

  return {
    ...row,

    payload,
  };
}

/* =========================================================
   CACHE FRESH CHECK
========================================================= */

function isCacheFresh(
  cache
) {
  if (
    !cache?.payload ||
    !cache?.expires_at
  ) {
    return false;
  }

  const expiresAt =
    new Date(
      cache.expires_at
    ).getTime();

  if (
    !Number.isFinite(
      expiresAt
    )
  ) {
    return false;
  }

  return (
    Date.now() <
    expiresAt
  );
}

/* =========================================================
   SAVE CACHE
========================================================= */

async function saveDbCache({
  cacheKey,
  from,
  to,
  mode,
  payload,
}) {
  const ttlSeconds =
    mode === "live"
      ? LIVE_CACHE_TTL_SECONDS
      : FULL_CACHE_TTL_SECONDS;

  const payloadJson =
    JSON.stringify(
      payload
    );

  const fetchedAt =
    new Date();

  const expiresAt =
    new Date(
      Date.now() +
        ttlSeconds * 1000
    );

  await db.query(
    `
      INSERT INTO zoom_call_history_cache
      (
        cache_key,
        from_date,
        to_date,
        mode,
        payload_json,
        fetched_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        payload_json = VALUES(payload_json),
        fetched_at = VALUES(fetched_at),
        expires_at = VALUES(expires_at),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      cacheKey,
      from,
      to,
      mode,
      payloadJson,
      fetchedAt,
      expiresAt,
    ]
  );

  console.log(
    `[Zoom Cache] SAVED ${cacheKey} records=${payload?.calls?.length || 0}`
  );
}

/* =========================================================
   TOKEN REFRESH
========================================================= */

async function refreshZoomToken(
  connection
) {
  const clientId =
    process.env.ZOOM_CLIENT_ID;

  const clientSecret =
    process.env.ZOOM_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET is missing"
    );
  }

  if (
    !connection?.refresh_token
  ) {
    throw new Error(
      "Zoom refresh token is missing"
    );
  }

  const basicAuth =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString(
      "base64"
    );

  const response =
    await fetch(
      ZOOM_TOKEN_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${basicAuth}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "refresh_token",

            refresh_token:
              connection.refresh_token,
          }),

        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    const error =
      await readZoomError(
        response
      );

    const err =
      new Error(
        error.message ||
          "Unable to refresh Zoom token"
      );

    err.status =
      response.status;

    err.zoomRaw =
      error.raw;

    throw err;
  }

  const data =
    await response.json();

  const accessToken =
    data?.access_token;

  const refreshToken =
    data?.refresh_token ||
    connection.refresh_token;

  const expiresIn =
    Number(
      data?.expires_in
    ) || 3600;

  if (!accessToken) {
    throw new Error(
      "Zoom token refresh returned no access token"
    );
  }

  const expiresAt =
    new Date(
      Date.now() +
        expiresIn * 1000
    );

  await db.query(
    `
      UPDATE zoom_connections
      SET
        access_token = ?,
        refresh_token = ?,
        expires_at = ?
      WHERE id = ?
    `,
    [
      accessToken,
      refreshToken,
      expiresAt,
      connection.id,
    ]
  );

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/* =========================================================
   DUPLICATE COUNT
   DIAGNOSTIC ONLY
========================================================= */

function calculateDuplicateTotal(
  calls
) {
  const map =
    new Map();

  for (const call of calls) {
    const id =
      firstValue(
        call?.call_history_uuid,
        call?.call_id,
        call?.zoom_call_id,
        call?.id
      );

    if (!id) {
      continue;
    }

    const key =
      String(id);

    map.set(
      key,
      (map.get(key) || 0) + 1
    );
  }

  let duplicates = 0;

  for (
    const count of
    map.values()
  ) {
    if (count > 1) {
      duplicates +=
        count - 1;
    }
  }

  return duplicates;
}

/* =========================================================
   CALL DATE
========================================================= */

function getDateFromCall(call) {
  const raw =
    firstValue(
      call?.start_time,
      call?.date_time,
      call?.timestamp,
      call?.startTime,
      call?.start_datetime,
      call?.datetime
    );

  if (!raw) {
    return null;
  }

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return getCaliforniaDateString(
    date
  );
}

/* =========================================================
   CALL TIMESTAMP
========================================================= */

function getCallTimestamp(call) {
  const raw =
    firstValue(
      call?.start_time,
      call?.date_time,
      call?.timestamp,
      call?.startTime,
      call?.start_datetime,
      call?.datetime
    );

  if (!raw) {
    return null;
  }

  const timestamp =
    new Date(raw).getTime();

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  return timestamp;
}

/* =========================================================
   DATE FILTER
========================================================= */

function filterCallsByDate({
  calls,
  from,
  to,
}) {
  return calls.filter(
    (call) => {
      const date =
        getDateFromCall(
          call
        );

      /*
       * Preserve calls whose date
       * cannot be determined.
       */
      if (!date) {
        return true;
      }

      if (
        from &&
        date < from
      ) {
        return false;
      }

      if (
        to &&
        date > to
      ) {
        return false;
      }

      return true;
    }
  );
}

/* =========================================================
   USER FILTER
========================================================= */

function filterCallsByUser({
  calls,
  isAdmin,
  userExtension,
}) {
  /*
   * ADMIN = ALL CALLS.
   */
  if (isAdmin) {
    return calls;
  }

  const extension =
    normalizeExtension(
      userExtension
    );

  if (!extension) {
    return [];
  }

  return calls.filter(
    (call) => {
      const caller =
        normalizeExtension(
          getCallerExtension(
            call
          )
        );

      const callee =
        normalizeExtension(
          getCalleeExtension(
            call
          )
        );

      const top =
        normalizeExtension(
          getTopLevelExtension(
            call
          )
        );

      const crm =
        normalizeExtension(
          call?.crm_extension
        );

      return (
        caller ===
          extension ||
        callee ===
          extension ||
        top ===
          extension ||
        crm ===
          extension
      );
    }
  );
}

/* =========================================================
   EXTENSION COUNTS
========================================================= */

function getExtensionCounts(
  calls
) {
  const counts = {};

  for (const call of calls) {
    const extension =
      normalizeExtension(
        call?.crm_extension
      );

    if (!extension) {
      continue;
    }

    counts[extension] =
      (counts[extension] || 0) +
      1;
  }

  return counts;
}

/* =========================================================
   AVAILABLE EXTENSIONS
========================================================= */

function getAvailableExtensions(
  calls
) {
  const set =
    new Set();

  for (const call of calls) {
    const extension =
      normalizeExtension(
        call?.crm_extension
      );

    if (extension) {
      set.add(
        extension
      );
    }
  }

  return Array.from(
    set
  ).sort(
    (a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity:
            "base",
        }
      )
  );
}

/* =========================================================
   DATE COUNTS
========================================================= */

function getDateCounts(
  calls
) {
  const counts = {};

  for (const call of calls) {
    const date =
      getDateFromCall(
        call
      );

    if (!date) {
      continue;
    }

    counts[date] =
      (counts[date] || 0) +
      1;
  }

  return counts;
}

/* =========================================================
   SORT
========================================================= */

function sortCallsNewestFirst(
  calls
) {
  return calls.sort(
    (a, b) => {
      const aTime =
        getCallTimestamp(
          a
        ) || 0;

      const bTime =
        getCallTimestamp(
          b
        ) || 0;

      return (
        bTime -
        aTime
      );
    }
  );
}

/* =========================================================
   GET CONNECTION
========================================================= */

async function getZoomConnection() {
  const [
    rows,
  ] =
    await db.query(
      `
        SELECT
          id,
          access_token,
          refresh_token,
          expires_at
        FROM zoom_connections
        ORDER BY id DESC
        LIMIT 1
      `
    );

  if (
    !rows ||
    rows.length === 0
  ) {
    return null;
  }

  return rows[0];
}

/* =========================================================
   MAIN
========================================================= */

export async function GET(
  request
) {
  try {
    /* =====================================================
       AUTH
    ===================================================== */

    const token =
      request.cookies.get(
        "token"
      )?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      return NextResponse.json(
        {
          success: false,
          message:
            "JWT_SECRET is missing",
        },
        {
          status: 500,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    let decoded;

    try {
      decoded =
        jwt.verify(
          token,
          jwtSecret
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid or expired session",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    const userId =
      decoded?.id ||
      decoded?.userId ||
      decoded?.user_id;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User ID missing from token",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    /* =====================================================
       USER
    ===================================================== */

    const [
      users,
    ] =
      await db.query(
        `
          SELECT
            id,
            name,
            email,
            role,
            zoom_extension,
            status
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [userId]
      );

    if (
      !users ||
      users.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User not found",
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    const user =
      users[0];

    const isAdmin =
      String(
        user.role || ""
      )
        .trim()
        .toLowerCase() ===
      "admin";

    const userExtension =
      normalizeExtension(
        user.zoom_extension
      );

    /* =====================================================
       QUERY
    ===================================================== */

    const params =
      new URL(request.url)
        .searchParams;

    let mode =
      String(
        params.get(
          "mode"
        ) || "full"
      )
        .trim()
        .toLowerCase();

    if (
      mode !== "full" &&
      mode !== "live"
    ) {
      mode = "full";
    }

    let from =
      params.get("from");

    let to =
      params.get("to");

    /* =====================================================
       LIVE = TODAY
    ===================================================== */

    if (mode === "live") {
      const today =
        getTodayRange();

      from =
        today.from;

      to =
        today.to;
    } else {
      if (!from && !to) {
        const range =
          getDefaultDateRange();

        from =
          range.from;

        to =
          range.to;
      } else if (
        from &&
        !to
      ) {
        to = from;
      } else if (
        !from &&
        to
      ) {
        from = to;
      }
    }

    /* =====================================================
       DATE VALIDATION
    ===================================================== */

    const fromDate =
      parseDateString(
        from
      );

    const toDate =
      parseDateString(
        to
      );

    if (
      !fromDate ||
      !toDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid date. Use YYYY-MM-DD.",
        },
        {
          status: 400,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    if (
      fromDate >
      toDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "From date cannot be after To date.",
        },
        {
          status: 400,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    const timeInfo =
      getCaliforniaDateTimeInfo();

    const currentDate =
      timeInfo.date;

    /* =====================================================
       USER WITHOUT EXTENSION
    ===================================================== */

    if (
      !isAdmin &&
      !userExtension
    ) {
      return NextResponse.json(
        {
          success: true,

          calls: [],

          total: 0,

          rawTotal: 0,

          enrichedTotal: 0,

          uniqueTotal: 0,

          duplicateTotal: 0,

          filteredTotal: 0,

          dateFilteredTotal: 0,

          mode,

          live:
            mode === "live",

          from,

          to,

          timeZone:
            CRM_TIME_ZONE,

          currentDate,

          currentTime:
            timeInfo.time,

          currentTimeIso:
            timeInfo.iso,

          currentTimeApplied:
            false,

          isAdmin: false,

          user: {
            id:
              user.id,

            name:
              user.name,

            email:
              user.email,

            role:
              user.role,

            zoom_extension:
              null,
          },

          pagesFetched: 0,

          pageStats: [],

          pagination: {
            pageSize:
              PAGE_SIZE,

            maxPages:
              mode === "live"
                ? MAX_LIVE_PAGES
                : MAX_FULL_PAGES,

            stoppedBecauseNoNextToken:
              true,

            stoppedBecauseMaxPages:
              false,
          },

          extensionCounts: {},

          availableExtensions: [],

          detectedExtensions: [],

          detectedExtensionCounts: {},

          detectedTotal: 0,

          callsWithoutExtension: 0,

          dateCounts: {},

          cache: {
            hit: false,

            stale: false,

            rateLimited: false,
          },
        },

        {
          status: 200,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    /* =====================================================
       CACHE KEY
    ===================================================== */

    const cacheKey =
      makeCacheKey({
        mode,
        from,
        to,
      });

    console.log(
      `[Call History] cacheKey=${cacheKey}`
    );

    /* =====================================================
       STEP 1:
       CHECK DB CACHE FIRST
    ===================================================== */

    let cache =
      await getDbCache(
        cacheKey
      );

    let fetchResult =
      null;

    let cacheHit =
      false;

    let staleCache =
      false;

    let rateLimited =
      false;

    if (
      cache &&
      isCacheFresh(cache)
    ) {
      console.log(
        `[Zoom DB Cache] FRESH HIT ${cacheKey}`
      );

      fetchResult =
        cache.payload;

      cacheHit =
        true;
    }

    /* =====================================================
       STEP 2:
       CACHE MISS
    ===================================================== */

    if (!fetchResult) {
      /*
       * Get Zoom connection only now.
       *
       * Cache hit does NOT need Zoom token.
       */
      let connection =
        await getZoomConnection();

      if (!connection) {
        /*
         * If old cache exists, use it.
         */
        if (cache?.payload) {
          fetchResult =
            cache.payload;

          cacheHit =
            true;

          staleCache =
            true;
        } else {
          return NextResponse.json(
            {
              success: false,
              message:
                "Zoom is not connected.",
            },
            {
              status: 400,
              headers:
                NO_CACHE_HEADERS,
            }
          );
        }
      }

      /* ===================================================
         TOKEN
      =================================================== */

      let accessToken =
        connection?.access_token;

      let tokenRefreshed =
        false;

      if (
        connection &&
        accessToken &&
        connection.expires_at
      ) {
        const expiresAt =
          new Date(
            connection.expires_at
          ).getTime();

        if (
          Number.isFinite(
            expiresAt
          ) &&
          expiresAt -
            Date.now() <=
            TOKEN_REFRESH_THRESHOLD_MS
        ) {
          const refreshed =
            await refreshZoomToken(
              connection
            );

          accessToken =
            refreshed.accessToken;

          tokenRefreshed =
            true;
        }
      }

      /* ===================================================
         FETCH IF CACHE MISS
      =================================================== */

      if (
        !fetchResult &&
        accessToken
      ) {
        try {
          /*
           * Re-check DB cache.
           *
           * Another browser/user may have filled it.
           */
          cache =
            await getDbCache(
              cacheKey
            );

          if (
            cache &&
            isCacheFresh(cache)
          ) {
            console.log(
              `[Zoom DB Cache] SECOND HIT ${cacheKey}`
            );

            fetchResult =
              cache.payload;

            cacheHit =
              true;
          }

          /* ===============================================
             ACTUAL ZOOM REQUEST
          =============================================== */

          if (!fetchResult) {
            console.log(
              `[Zoom] FETCHING ${from} -> ${to} mode=${mode}`
            );

            fetchResult =
              await fetchAllCalls({
                accessToken,
                from,
                to,
                mode,
              });

            /*
             * SAVE RAW ZOOM DATA.
             *
             * Duplicates preserved.
             */
            await saveDbCache({
              cacheKey,
              from,
              to,
              mode,
              payload:
                fetchResult,
            });

            console.log(
              `[Zoom] FETCH COMPLETE records=${fetchResult.calls.length}`
            );
          }
        } catch (error) {
          /* ===============================================
             TOKEN EXPIRED
          =============================================== */

          const authError =
            Number(
              error?.status
            ) === 401 ||
            Number(
              error?.zoomCode
            ) === 124;

          if (
            authError &&
            connection?.refresh_token &&
            !tokenRefreshed
          ) {
            console.log(
              "[Zoom] Access token expired. Refreshing..."
            );

            const refreshed =
              await refreshZoomToken(
                connection
              );

            accessToken =
              refreshed.accessToken;

            tokenRefreshed =
              true;

            fetchResult =
              await fetchAllCalls({
                accessToken,
                from,
                to,
                mode,
              });

            await saveDbCache({
              cacheKey,
              from,
              to,
              mode,
              payload:
                fetchResult,
            });
          } else if (
            Number(
              error?.status
            ) === 429
          ) {
            /*
             * =============================================
             * ZOOM DAILY RATE LIMIT
             * =============================================
             *
             * DO NOT RETRY.
             *
             * Use stale DB cache if available.
             */

            console.error(
              "[Zoom] DAILY RATE LIMIT REACHED"
            );

            if (
              cache?.payload
            ) {
              console.warn(
                "[Zoom] Returning stale DB cache."
              );

              fetchResult =
                cache.payload;

              cacheHit =
                true;

              staleCache =
                true;

              rateLimited =
                true;
            } else {
              return NextResponse.json(
                {
                  success: false,

                  message:
                    "Zoom API daily rate limit has been reached and no cached data is available yet.",

                  rateLimited:
                    true,

                  retryAfter:
                    FALLBACK_RATE_LIMIT_SECONDS,
                },
                {
                  status: 429,

                  headers: {
                    ...NO_CACHE_HEADERS,

                    "Retry-After":
                      String(
                        FALLBACK_RATE_LIMIT_SECONDS
                      ),
                  },
                }
              );
            }
          } else {
            throw error;
          }
        }
      }
    }

    /* =====================================================
       SAFETY
    ===================================================== */

    const rawCalls =
      Array.isArray(
        fetchResult?.calls
      )
        ? fetchResult.calls
        : [];

    /* =====================================================
       ENRICH
    ===================================================== */

    const enrichedCalls =
      rawCalls.map(
        enrichCall
      );

    /*
     * NO DEDUPLICATION.
     */
    const allCalls =
      enrichedCalls;

    /* =====================================================
       DUPLICATES
       DIAGNOSTIC ONLY
    ===================================================== */

    const duplicateTotal =
      calculateDuplicateTotal(
        allCalls
      );

    /* =====================================================
       DATE FILTER
    ===================================================== */

    const dateFilteredCalls =
      filterCallsByDate({
        calls:
          allCalls,

        from,

        to,
      });

    /* =====================================================
       USER FILTER
    ===================================================== */

    const filteredCalls =
      filterCallsByUser({
        calls:
          dateFilteredCalls,

        isAdmin,

        userExtension,
      });

    /* =====================================================
       SORT
    ===================================================== */

    sortCallsNewestFirst(
      filteredCalls
    );

    /* =====================================================
       EXTENSIONS
    ===================================================== */

    const extensionCounts =
      getExtensionCounts(
        filteredCalls
      );

    const availableExtensions =
      getAvailableExtensions(
        filteredCalls
      );

    const detectedExtensionCounts =
      getExtensionCounts(
        dateFilteredCalls
      );

    const detectedExtensions =
      getAvailableExtensions(
        dateFilteredCalls
      );

    /* =====================================================
       DATE COUNTS
    ===================================================== */

    const dateCounts =
      getDateCounts(
        filteredCalls
      );

    const dateCountsTotal =
      Object.values(
        dateCounts
      ).reduce(
        (
          total,
          value
        ) =>
          total +
          Number(
            value || 0
          ),
        0
      );

    /* =====================================================
       WITHOUT EXTENSION
    ===================================================== */

    const callsWithoutExtension =
      dateFilteredCalls.filter(
        (call) =>
          !normalizeExtension(
            call?.crm_extension
          )
      );

    /* =====================================================
       FINAL
    ===================================================== */

    const total =
      filteredCalls.length;

    console.log(
      "================================================="
    );

    console.log(
      "[Call History] FINAL"
    );

    console.log({
      userId:
        user.id,

      user:
        user.name,

      role:
        user.role,

      isAdmin,

      userExtension,

      mode,

      from,

      to,

      cacheHit,

      staleCache,

      rateLimited,

      rawTotal:
        rawCalls.length,

      enrichedTotal:
        enrichedCalls.length,

      filteredTotal:
        filteredCalls.length,

      duplicateTotal,

      pagesFetched:
        fetchResult?.pagesFetched ||
        0,
    });

    console.log(
      "================================================="
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        /*
         * ALL RECORDS.
         *
         * DUPLICATES INCLUDED.
         */
        calls:
          filteredCalls,

        total,

        rawTotal:
          rawCalls.length,

        enrichedTotal:
          enrichedCalls.length,

        /*
         * NOT UNIQUE.
         *
         * Kept for frontend compatibility.
         */
        uniqueTotal:
          allCalls.length,

        duplicateTotal,

        dateFilteredTotal:
          dateFilteredCalls.length,

        filteredTotal:
          filteredCalls.length,

        mode,

        live:
          mode === "live",

        from,

        to,

        timeZone:
          CRM_TIME_ZONE,

        currentDate:
          currentDate,

        currentTime:
          timeInfo.time,

        currentTimeIso:
          timeInfo.iso,

        currentTimeApplied:
          false,

        isAdmin,

        user: {
          id:
            user.id,

          name:
            user.name,

          email:
            user.email,

          role:
            user.role,

          zoom_extension:
            userExtension ||
            null,
        },

        /* =================================================
           PAGINATION
        ================================================= */

        pagesFetched:
          fetchResult?.pagesFetched ||
          0,

        pageStats:
          fetchResult?.pageStats ||
          [],

        pagination: {
          pageSize:
            PAGE_SIZE,

          maxPages:
            mode === "live"
              ? MAX_LIVE_PAGES
              : MAX_FULL_PAGES,

          stoppedBecauseNoNextToken:
            Boolean(
              fetchResult?.stoppedBecauseNoNextToken
            ),

          stoppedBecauseMaxPages:
            Boolean(
              fetchResult?.stoppedBecauseMaxPages
            ),
        },

        /* =================================================
           EXTENSIONS
        ================================================= */

        extensionCounts,

        availableExtensions,

        detectedExtensions,

        detectedExtensionCounts,

        detectedTotal:
          dateFilteredCalls.length,

        callsWithoutExtension:
          callsWithoutExtension.length,

        /* =================================================
           DATES
        ================================================= */

        dateCounts,

        countCheck: {
          total,

          dateCountsTotal,

          matched:
            total ===
            dateCountsTotal,
        },

        /* =================================================
           CACHE STATUS
        ================================================= */

        cache: {
          hit:
            cacheHit,

          stale:
            staleCache,

          rateLimited,

          ttlMinutes:
            mode === "live"
              ? LIVE_CACHE_TTL_SECONDS /
                60
              : FULL_CACHE_TTL_SECONDS /
                60,
        },

        zoom: {
          tokenRefreshed:
            typeof tokenRefreshed !==
            "undefined"
              ? tokenRefreshed
              : false,

          rateLimited,

          staleCache,

          cacheHit,
        },

        /*
         * Useful frontend message.
         */
        warning:
          rateLimited
            ? "Zoom rate limit reached. Showing cached call history."
            : null,
      },

      {
        status: 200,

        headers:
          NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "Zoom call history API error:",
      error
    );

    /* =====================================================
       429
    ===================================================== */

    if (
      Number(
        error?.status
      ) === 429
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Zoom API daily rate limit has been reached. Please wait for Zoom's limit to reset.",

          error:
            error?.message ||
            "Too many requests",

          rateLimited:
            true,
        },
        {
          status: 429,

          headers: {
            ...NO_CACHE_HEADERS,

            "Retry-After":
              String(
                FALLBACK_RATE_LIMIT_SECONDS
              ),
          },
        }
      );
    }

    /* =====================================================
       AUTH ERROR
    ===================================================== */

    if (
      Number(
        error?.status
      ) === 401 ||
      Number(
        error?.zoomCode
      ) === 124
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Zoom authorization has expired. Please reconnect Zoom.",

          error:
            error?.message ||
            "Zoom authorization expired",
        },
        {
          status: 401,

          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    /* =====================================================
       GENERAL
    ===================================================== */

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to fetch Zoom call history.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? {
                status:
                  error?.status,

                zoomCode:
                  error?.zoomCode,

                raw:
                  error?.zoomRaw,

                pageNumber:
                  error?.pageNumber,
              }
            : undefined,
      },
      {
        status: 500,

        headers:
          NO_CACHE_HEADERS,
      }
    );
  }
}