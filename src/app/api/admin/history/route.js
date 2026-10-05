import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "token";

const COMPLETED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
]);

const ADMIN_ROLES = new Set([
  "admin",
  "administrator",
  "superadmin",
  "super_admin",
]);

const STATUS_LIST = [
  "Follow UP",
  "Call Back",
  "Wrong Num",
  "Not Interested",
  "DNC",
  "No Business",
  "Pending",
  "Busy",
  "Voice Mail",
  "Straight To VM",
  "No Answer/VM",
  "Hang Up",
  "Unable To Complete",
  "Not In Service",
  "Lang Barrier",
  "Transfer M/R",
  "Retired",
  "Completed",
];

/* =========================================================
   BASIC HELPERS
========================================================= */

function safeString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeRole(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

/* =========================================================
   DATE HELPERS
========================================================= */

function validDate(value) {
  const str = safeString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }

  const [year, month, day] = str
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getCaliforniaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/*
  Calendar next day without timezone conversion.
*/
function nextDate(dateString) {
  if (!validDate(dateString)) {
    return null;
  }

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + 1)
  );

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/* =========================================================
   MYSQL DATE SERIALIZATION
   IMPORTANT:
   Prevents date shifting in UI.
========================================================= */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDbDateOnly(value) {
  if (value === null || value === undefined) {
    return null;
  }

  /*
    mysql2 may return DATE as string.
  */
  if (typeof value === "string") {
    const str = value.trim();

    if (!str) {
      return null;
    }

    const match = str.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }

    return str;
  }

  /*
    mysql2 may also return a JavaScript Date.
    Use local calendar getters so the stored calendar
    date does not get shifted by toISOString().
  */
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return [
      value.getFullYear(),
      pad2(value.getMonth() + 1),
      pad2(value.getDate()),
    ].join("-");
  }

  return safeString(value) || null;
}

function formatDbDateTime(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const str = value.trim();

    if (!str) {
      return null;
    }

    return str.replace("T", " ").slice(0, 19);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return [
      value.getFullYear(),
      pad2(value.getMonth() + 1),
      pad2(value.getDate()),
    ].join("-") +
      " " +
      [
        pad2(value.getHours()),
        pad2(value.getMinutes()),
        pad2(value.getSeconds()),
      ].join(":");
  }

  return safeString(value) || null;
}

/* =========================================================
   STATUS HELPERS
========================================================= */

function normalizeStatus(value) {
  const raw = safeString(
    value || "Pending",
    "Pending"
  );

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function statusKey(value) {
  return normalizeStatus(value).toLowerCase();
}

function canonicalStatus(value) {
  const normalized = normalizeStatus(value);
  const key = normalized.toLowerCase();

  const aliases = {
    "follow up": "Follow UP",
    "followup": "Follow UP",

    "call back": "Call Back",
    callback: "Call Back",

    "wrong num": "Wrong Num",
    wrongnumber: "Wrong Num",
    "wrong number": "Wrong Num",

    "not interested": "Not Interested",

    dnc: "DNC",

    "no business": "No Business",

    pending: "Pending",

    busy: "Busy",

    "voice mail": "Voice Mail",
    voicemail: "Voice Mail",

    "straight to vm": "Straight To VM",
    "straight to voicemail": "Straight To VM",

    "no answer/vm": "No Answer/VM",
    "no answer vm": "No Answer/VM",

    "hang up": "Hang Up",

    "unable to complete": "Unable To Complete",

    "not in service": "Not In Service",

    "lang barrier": "Lang Barrier",
    "language barrier": "Lang Barrier",

    "transfer m/r": "Transfer M/R",
    "transfer mr": "Transfer M/R",

    retired: "Retired",

    completed: "Completed",
    complete: "Completed",
    done: "Completed",
  };

  return aliases[key] || normalized;
}

function isCompletedStatus(status) {
  return COMPLETED_STATUSES.has(
    statusKey(status)
  );
}

/* =========================================================
   STATUS SQL
========================================================= */

const STATUS_SQL = `
  COALESCE(
    NULLIF(TRIM(da.status), ''),
    NULLIF(TRIM(mt.current_status), ''),
    'Pending'
  )
`;

const NORMALIZED_STATUS_SQL = `
  LOWER(
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              ${STATUS_SQL},
              '_',
              ' '
            ),
            '-',
            ' '
          ),
          ' / ',
          '/'
        ),
        '  ',
        ' '
      )
    )
  )
`;

/* =========================================================
   DB
========================================================= */

async function dbQuery(sql, params = []) {
  const [rows] = await pool.execute(
    sql,
    params
  );

  return rows;
}

/* =========================================================
   JSON
========================================================= */

function jsonResponse(body, options = {}) {
  const response = NextResponse.json(
    body,
    options
  );

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  response.headers.set(
    "Pragma",
    "no-cache"
  );

  response.headers.set(
    "Expires",
    "0"
  );

  return response;
}

/* =========================================================
   AUTH
========================================================= */

async function authenticate(request) {
  try {
    const token =
      request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return {
        ok: false,
        response: jsonResponse(
          {
            success: false,
            message: "Unauthorized",
          },
          { status: 401 }
        ),
      };
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "[History API] JWT_SECRET is missing"
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            success: false,
            message:
              "Server authentication configuration is missing.",
          },
          { status: 500 }
        ),
      };
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      console.error(
        "[History API] JWT verify error:",
        error
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            success: false,
            message:
              "Invalid or expired session.",
          },
          { status: 401 }
        ),
      };
    }

    const userId = Number(
      decoded?.id ??
        decoded?.userId ??
        decoded?.user_id ??
        decoded?.sub
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return {
        ok: false,
        response: jsonResponse(
          {
            success: false,
            message:
              "Invalid user session.",
          },
          { status: 401 }
        ),
      };
    }

    const users = await dbQuery(
      `
      SELECT
        id,
        name,
        email,
        role,
        status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!users.length) {
      return {
        ok: false,
        response: jsonResponse(
          {
            success: false,
            message:
              "User account not found.",
          },
          { status: 401 }
        ),
      };
    }

    const user = users[0];

    return {
      ok: true,
      user: {
        id: Number(user.id),
        name: safeString(user.name),
        email: safeString(user.email),
        role: safeString(user.role),
        status: safeString(user.status),
        isAdmin: isAdminRole(user.role),
      },
    };
  } catch (error) {
    console.error(
      "[History API] Authentication error:",
      error
    );

    return {
      ok: false,
      response: jsonResponse(
        {
          success: false,
          message: "Authentication failed.",
        },
        { status: 500 }
      ),
    };
  }
}

/* =========================================================
   FORMAT HISTORY RECORD
========================================================= */

function formatHistoryRecord(row) {
  const finalStatus =
    row.assignment_status ||
    row.current_status ||
    "Pending";

  return {
    assignment_id:
      row.assignment_id === null ||
      row.assignment_id === undefined
        ? null
        : Number(row.assignment_id),

    task_id:
      row.task_id === null ||
      row.task_id === undefined
        ? null
        : Number(row.task_id),

    employee_id:
      row.employee_id === null ||
      row.employee_id === undefined
        ? null
        : Number(row.employee_id),

    /*
      IMPORTANT:
      Exact DB calendar date.
    */
    assignment_date:
      formatDbDateOnly(
        row.assignment_date
      ),

    assigned_at:
      formatDbDateTime(
        row.assigned_at
      ),

    assignment_status:
      finalStatus,

    status:
      finalStatus,

    comment:
      row.comment || "",

    is_completed:
      Number(row.is_completed) === 1 ||
      isCompletedStatus(finalStatus),

    updated_at:
      formatDbDateTime(
        row.updated_at
      ),

    created_at:
      formatDbDateTime(
        row.created_at
      ),

    master_task_id:
      row.master_task_id === null ||
      row.master_task_id === undefined
        ? null
        : Number(row.master_task_id),

    pool_id:
      row.pool_id === null ||
      row.pool_id === undefined
        ? null
        : Number(row.pool_id),

    sequence_no:
      row.sequence_no === null ||
      row.sequence_no === undefined
        ? null
        : Number(row.sequence_no),

    task_date:
      formatDbDateOnly(
        row.task_date
      ),

    contact_name:
      row.contact_name || "",

    name:
      row.contact_name || "",

    phone_number:
      row.phone_number || "",

    phone:
      row.phone_number || "",

    business_name:
      row.business_name || "",

    business:
      row.business_name || "",

    current_status:
      row.current_status || "",

    is_locked:
      Number(row.is_locked) === 1,

    employee_user_id:
      row.employee_user_id === null ||
      row.employee_user_id === undefined
        ? null
        : Number(row.employee_user_id),

    employee_name:
      row.employee_name || "",

    employee_email:
      row.employee_email || "",

    employee_role:
      row.employee_role || "",
  };
}

/* =========================================================
   HISTORY RECORD QUERY
========================================================= */

async function getHistoryRecord(
  assignmentId
) {
  const rows = await dbQuery(
    `
    SELECT

      da.id AS assignment_id,
      da.task_id,
      da.employee_id,
      da.assignment_date,
      da.assigned_at,
      da.status AS assignment_status,
      da.comment,
      da.is_completed,
      da.updated_at,
      da.created_at,

      mt.id AS master_task_id,
      mt.pool_id,
      mt.sequence_no,
      mt.task_date,
      mt.name AS contact_name,
      mt.phone_number,
      mt.business_name,
      mt.current_status,
      mt.is_locked,

      u.id AS employee_user_id,
      u.name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role

    FROM daily_assignments da

    LEFT JOIN master_tasks mt
      ON mt.id = da.task_id

    LEFT JOIN users u
      ON u.id = da.employee_id

    WHERE da.id = ?

    LIMIT 1
    `,
    [assignmentId]
  );

  if (!rows?.length) {
    return null;
  }

  return formatHistoryRecord(
    rows[0]
  );
}

/* =========================================================
   BUILD FILTER
========================================================= */

function buildHistoryFilter({
  user,
  from,
  to,
  date,
  employeeId,
  status,
  search,
}) {
  let where = `WHERE 1 = 1`;
  const params = [];

  /* =====================================================
     NORMAL USER
     Only own records
  ===================================================== */

  if (!user.isAdmin) {
    where += `
      AND da.employee_id = ?
    `;

    params.push(user.id);
  }

  /* =====================================================
     ADMIN EMPLOYEE FILTER
  ===================================================== */

  if (user.isAdmin && employeeId) {
    where += `
      AND da.employee_id = ?
    `;

    params.push(employeeId);
  }

  /* =====================================================
     EXACT DATE
  ===================================================== */

  if (date) {
    const next = nextDate(date);

    where += `
      AND da.assignment_date >= ?
      AND da.assignment_date < ?
    `;

    params.push(
      date,
      next
    );
  } else {
    /* ===================================================
       FROM
    =================================================== */

    if (from) {
      where += `
        AND da.assignment_date >= ?
      `;

      params.push(from);
    }

    /* ===================================================
       TO
    =================================================== */

    if (to) {
      const next = nextDate(to);

      where += `
        AND da.assignment_date < ?
      `;

      params.push(next);
    }
  }

  /* =====================================================
     STATUS FILTER
  ===================================================== */

  if (status) {
    const canonical =
      canonicalStatus(status);

    if (
      canonical === "Other"
    ) {
      const known = STATUS_LIST.map(
        (item) =>
          statusKey(item)
      );

      if (known.length) {
        where += `
          AND ${NORMALIZED_STATUS_SQL}
          NOT IN (${known.map(() => "?").join(",")})
        `;

        params.push(...known);
      }
    } else {
      const values = [
        statusKey(canonical),
      ];

      /*
        Completed aliases.
      */
      if (
        canonical === "Completed"
      ) {
        values.push(
          "complete",
          "done"
        );
      }

      /*
        Pending should also catch blank/null,
        because blank status becomes Pending.
      */
      if (
        canonical === "Pending"
      ) {
        where += `
          AND (
            ${NORMALIZED_STATUS_SQL} = ?
            OR da.status IS NULL
            OR TRIM(da.status) = ''
          )
        `;

        params.push(
          statusKey(canonical)
        );
      } else {
        where += `
          AND ${NORMALIZED_STATUS_SQL}
          IN (${values.map(() => "?").join(",")})
        `;

        params.push(...values);
      }
    }
  }

  /* =====================================================
     SEARCH
     Business / Name / Phone / Employee
  ===================================================== */

  if (search) {
    where += `
      AND (
        mt.business_name LIKE ?
        OR mt.name LIKE ?
        OR mt.phone_number LIKE ?
        OR u.name LIKE ?
        OR u.email LIKE ?
        OR da.comment LIKE ?
      )
    `;

    const searchValue =
      `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue
    );
  }

  return {
    where,
    params,
  };
}

/* =========================================================
   VALIDATE DATE FILTERS
========================================================= */

function validateDateFilters({
  date,
  from,
  to,
}) {
  if (date && !validDate(date)) {
    return "Invalid date. Use YYYY-MM-DD.";
  }

  if (from && !validDate(from)) {
    return "Invalid from date. Use YYYY-MM-DD.";
  }

  if (to && !validDate(to)) {
    return "Invalid to date. Use YYYY-MM-DD.";
  }

  if (
    from &&
    to &&
    from > to
  ) {
    return "From date cannot be after To date.";
  }

  return null;
}

/* =========================================================
   GET HISTORY
========================================================= */

export async function GET(request) {
  try {
    const auth =
      await authenticate(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { searchParams } =
      new URL(request.url);

    const from =
      safeString(
        searchParams.get("from")
      );

    const to =
      safeString(
        searchParams.get("to")
      );

    const date =
      safeString(
        searchParams.get("date")
      );

    const status =
      safeString(
        searchParams.get("status")
      );

    const search =
      safeString(
        searchParams.get("search")
      );

    const employeeRaw =
      safeString(
        searchParams.get(
          "employee_id"
        ) ||
          searchParams.get(
            "employeeId"
          )
      );

    let employeeId = null;

    if (
      employeeRaw
    ) {
      employeeId =
        Number(employeeRaw);

      if (
        !Number.isInteger(
          employeeId
        ) ||
        employeeId <= 0
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "Invalid employee_id.",
          },
          { status: 400 }
        );
      }
    }

    /* =====================================================
       VALIDATE DATES
    ===================================================== */

    const dateError =
      validateDateFilters({
        date,
        from,
        to,
      });

    if (dateError) {
      return jsonResponse(
        {
          success: false,
          message: dateError,
        },
        { status: 400 }
      );
    }

    /* =====================================================
       FILTER
    ===================================================== */

    const filter =
      buildHistoryFilter({
        user,
        from,
        to,
        date,
        employeeId,
        status,
        search,
      });

    /* =====================================================
       DATA QUERY
       NO DISTINCT
       EVERY ASSIGNMENT COUNTS
    ===================================================== */

    const dataSql = `
      SELECT

        da.id AS assignment_id,
        da.task_id,
        da.employee_id,
        da.assignment_date,
        da.assigned_at,
        da.status AS assignment_status,
        da.comment,
        da.is_completed,
        da.updated_at,
        da.created_at,

        mt.id AS master_task_id,
        mt.pool_id,
        mt.sequence_no,
        mt.task_date,
        mt.name AS contact_name,
        mt.phone_number,
        mt.business_name,
        mt.current_status,
        mt.is_locked,

        u.id AS employee_user_id,
        u.name AS employee_name,
        u.email AS employee_email,
        u.role AS employee_role

      FROM daily_assignments da

      LEFT JOIN master_tasks mt
        ON mt.id = da.task_id

      LEFT JOIN users u
        ON u.id = da.employee_id

      ${filter.where}

      ORDER BY
        da.assignment_date DESC,
        da.id DESC
    `;

    const rows =
      await dbQuery(
        dataSql,
        filter.params
      );

    const data =
      rows.map(
        formatHistoryRecord
      );

    /* =====================================================
       TOTAL COUNT
       SAME FILTER
       NO DISTINCT
    ===================================================== */

    const totalRows =
      await dbQuery(
        `
        SELECT COUNT(*) AS total
        FROM daily_assignments da

        LEFT JOIN master_tasks mt
          ON mt.id = da.task_id

        LEFT JOIN users u
          ON u.id = da.employee_id

        ${filter.where}
        `,
        filter.params
      );

    const total =
      Number(
        totalRows?.[0]?.total
      ) || 0;

    /* =====================================================
       STATUS COUNTS
       SAME FILTER
       NO DISTINCT
    ===================================================== */

    const countRows =
      await dbQuery(
        `
        SELECT
          ${NORMALIZED_STATUS_SQL}
            AS normalized_status,

          COUNT(*) AS status_count

        FROM daily_assignments da

        LEFT JOIN master_tasks mt
          ON mt.id = da.task_id

        LEFT JOIN users u
          ON u.id = da.employee_id

        ${filter.where}

        GROUP BY
          ${NORMALIZED_STATUS_SQL}
        `,
        filter.params
      );

    /* =====================================================
       CREATE COUNTS
    ===================================================== */

    const counts = {};

    for (
      const item of STATUS_LIST
    ) {
      counts[item] = 0;
    }

    counts["Other"] = 0;

    for (
      const row of countRows
    ) {
      const raw =
        row.normalized_status ||
        "pending";

      const canonical =
        canonicalStatus(raw);

      const count =
        Number(
          row.status_count
        ) || 0;

      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          canonical
        )
      ) {
        counts[canonical] += count;
      } else {
        counts["Other"] += count;
      }
    }

    /*
      Total must always equal the sum
      of all status buckets.
    */
    const statusCountTotal =
      Object.values(counts).reduce(
        (sum, value) =>
          sum + Number(value || 0),
        0
      );

    /*
      Safety fallback.
      If database has an unexpected status
      that somehow wasn't grouped, Other gets it.
    */
    if (
      statusCountTotal < total
    ) {
      counts["Other"] +=
        total - statusCountTotal;
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return jsonResponse({
      success: true,

      data,

      records: data,

      total,

      counts,

      /*
        Useful for UI/debugging.
      */
      filters: {
        date: date || null,
        from: from || null,
        to: to || null,
        status: status || null,
        search: search || null,
        employee_id:
          employeeId || null,
      },

      pagination: {
        total,
        count: data.length,
      },

      server: {
        california_date:
          getCaliforniaDate(),
      },
    });
  } catch (error) {
    console.error(
      "=========================================="
    );

    console.error(
      "[History API] GET ERROR"
    );

    console.error(
      "Message:",
      error?.message
    );

    console.error(
      "Code:",
      error?.code
    );

    console.error(
      "SQL State:",
      error?.sqlState
    );

    console.error(
      "SQL Message:",
      error?.sqlMessage
    );

    console.error(
      "Stack:",
      error?.stack
    );

    console.error(
      "=========================================="
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Failed to load history.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request
) {
  let createdMasterTaskId =
    null;

  try {
    const auth =
      await authenticate(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body =
      await request.json();

    /* =====================================================
       EMPLOYEE
    ===================================================== */

    const requestedEmployeeIdRaw =
      body?.employee_id ??
      body?.employeeId ??
      body?.assigned_employee_id ??
      body?.assignedEmployeeId;

    let employeeId;

    if (
      requestedEmployeeIdRaw ===
        undefined ||
      requestedEmployeeIdRaw ===
        null ||
      safeString(
        requestedEmployeeIdRaw
      ) === ""
    ) {
      if (user.isAdmin) {
        return jsonResponse(
          {
            success: false,
            message:
              "employee_id is required for admin.",
          },
          { status: 400 }
        );
      }

      employeeId =
        user.id;
    } else {
      employeeId =
        Number(
          requestedEmployeeIdRaw
        );

      if (
        !Number.isInteger(
          employeeId
        ) ||
        employeeId <= 0
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "Invalid employee_id.",
          },
          { status: 400 }
        );
      }

      if (
        !user.isAdmin &&
        employeeId !== user.id
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "You can only add your own history record.",
          },
          { status: 403 }
        );
      }
    }

    /* =====================================================
       VERIFY EMPLOYEE
    ===================================================== */

    const employeeRows =
      await dbQuery(
        `
        SELECT
          id,
          name,
          email,
          role,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [employeeId]
      );

    if (
      !employeeRows.length
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Employee not found.",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       DATE
    ===================================================== */

    const assignmentDate =
      safeString(
        body?.assignment_date ??
          body?.assignmentDate ??
          body?.date
      ) ||
      getCaliforniaDate();

    if (
      !validDate(
        assignmentDate
      )
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid assignment date. Use YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       FIELDS
    ===================================================== */

    const businessName =
      safeString(
        body?.business_name ??
          body?.businessName ??
          body?.business
      ).slice(0, 150);

    const contactName =
      safeString(
        body?.contact_name ??
          body?.contactName ??
          body?.name ??
          body?.contact
      ).slice(0, 100);

    const phoneNumber =
      safeString(
        body?.phone_number ??
          body?.phoneNumber ??
          body?.phone
      ).slice(0, 30);

    if (!phoneNumber) {
      return jsonResponse(
        {
          success: false,
          message:
            "Phone number is required.",
        },
        { status: 400 }
      );
    }

    const status =
      normalizeStatus(
        body?.status ??
          body?.assignment_status ??
          body?.assignmentStatus ??
          "Pending"
      ).slice(0, 50);

    const comment =
      safeString(
        body?.comment ??
          body?.comments
      ).slice(0, 5000);

    const isCompleted =
      isCompletedStatus(
        status
      )
        ? 1
        : 0;

    /* =====================================================
       SEQUENCE
    ===================================================== */

    const sequenceRows =
      await dbQuery(
        `
        SELECT
          COALESCE(
            MAX(sequence_no),
            0
          ) + 1 AS next_sequence
        FROM master_tasks
        `
      );

    const sequenceNo =
      Number(
        sequenceRows?.[0]
          ?.next_sequence
      ) || 1;

    /* =====================================================
       CREATE MASTER TASK
    ===================================================== */

    const masterResult =
      await dbQuery(
        `
        INSERT INTO master_tasks
        (
          sequence_no,
          task_date,
          name,
          phone_number,
          business_name,
          current_status,
          is_locked
        )
        VALUES (?, ?, ?, ?, ?, ?, 0)
        `,
        [
          sequenceNo,
          assignmentDate,
          contactName || null,
          phoneNumber,
          businessName || null,
          status,
        ]
      );

    createdMasterTaskId =
      Number(
        masterResult.insertId
      );

    if (
      !createdMasterTaskId
    ) {
      throw new Error(
        "Failed to create master task."
      );
    }

    /* =====================================================
       CREATE ASSIGNMENT
    ===================================================== */

    const assignmentResult =
      await dbQuery(
        `
        INSERT INTO daily_assignments
        (
          task_id,
          employee_id,
          assignment_date,
          status,
          comment,
          is_completed,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          createdMasterTaskId,
          employeeId,
          assignmentDate,
          status,
          comment || null,
          isCompleted,
        ]
      );

    const assignmentId =
      Number(
        assignmentResult.insertId
      );

    if (!assignmentId) {
      throw new Error(
        "Failed to create assignment."
      );
    }

    const createdRecord =
      await getHistoryRecord(
        assignmentId
      );

    return jsonResponse(
      {
        success: true,

        message:
          "History record added successfully.",

        data: createdRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[History API] POST ERROR:",
      error
    );

    if (
      createdMasterTaskId
    ) {
      try {
        await dbQuery(
          `
          DELETE FROM master_tasks
          WHERE id = ?
          LIMIT 1
          `,
          [createdMasterTaskId]
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "[History API] Cleanup error:",
          cleanupError?.message
        );
      }
    }

    let message =
      "Failed to add history record.";

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      message =
        "This history record could not be created because a duplicate assignment exists.";
    }

    return jsonResponse(
      {
        success: false,
        message,

        error:
          process.env.NODE_ENV ===
          "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PUT
   ADMIN = CAN EDIT ANY RECORD
   USER = CAN EDIT ONLY OWN RECORD
========================================================= */

export async function PUT(
  request
) {
  try {
    const auth =
      await authenticate(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body =
      await request.json();

    /* =====================================================
       ASSIGNMENT ID
    ===================================================== */

    const assignmentIdRaw =
      body?.assignment_id ??
      body?.assignmentId ??
      body?.id;

    const assignmentId =
      Number(assignmentIdRaw);

    if (
      !Number.isInteger(
        assignmentId
      ) ||
      assignmentId <= 0
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Valid assignment_id is required.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       LOAD ASSIGNMENT
    ===================================================== */

    const assignmentRows =
      await dbQuery(
        `
        SELECT
          id,
          task_id,
          employee_id,
          assignment_date,
          status,
          comment,
          is_completed
        FROM daily_assignments
        WHERE id = ?
        LIMIT 1
        `,
        [assignmentId]
      );

    if (
      !assignmentRows.length
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "History record not found.",
        },
        { status: 404 }
      );
    }

    const existing =
      assignmentRows[0];

    /* =====================================================
       PERMISSION

       ADMIN:
       Can edit any record.

       USER:
       Can edit ONLY own record.
    ===================================================== */

    if (
      !user.isAdmin &&
      Number(existing.employee_id) !==
        Number(user.id)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "You can only edit your own history records.",
        },
        { status: 403 }
      );
    }

    /* =====================================================
       MASTER TASK
    ===================================================== */

    const masterTaskId =
      Number(existing.task_id);

    if (!masterTaskId) {
      return jsonResponse(
        {
          success: false,
          message:
            "Master task reference is missing.",
        },
        { status: 500 }
      );
    }

    const masterRows =
      await dbQuery(
        `
        SELECT
          id,
          pool_id,
          sequence_no,
          task_date,
          name,
          phone_number,
          business_name,
          current_status,
          is_locked
        FROM master_tasks
        WHERE id = ?
        LIMIT 1
        `,
        [masterTaskId]
      );

    if (
      !masterRows.length
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Master task not found.",
        },
        { status: 404 }
      );
    }

    const master =
      masterRows[0];

    /* =====================================================
       EMPLOYEE

       Admin can change employee.

       Normal user cannot move the record
       to another employee.
    ===================================================== */

    const employeeRaw =
      body?.employee_id ??
      body?.employeeId ??
      body?.assigned_employee_id ??
      body?.assignedEmployeeId;

    let employeeId =
      Number(existing.employee_id);

    if (
      employeeRaw !== undefined &&
      employeeRaw !== null &&
      safeString(employeeRaw) !== ""
    ) {
      employeeId =
        Number(employeeRaw);
    }

    if (
      !Number.isInteger(
        employeeId
      ) ||
      employeeId <= 0
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid employee_id.",
        },
        { status: 400 }
      );
    }

    /*
      Normal employee can ONLY keep
      the record assigned to himself.
    */
    if (
      !user.isAdmin &&
      employeeId !==
        Number(user.id)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "You cannot assign your record to another employee.",
        },
        { status: 403 }
      );
    }

    /* =====================================================
       VERIFY EMPLOYEE
    ===================================================== */

    const employeeRows =
      await dbQuery(
        `
        SELECT
          id,
          name,
          email,
          role,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [employeeId]
      );

    if (
      !employeeRows.length
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Employee not found.",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       DATE

       IMPORTANT:
       Existing DATE/DATETIME is converted
       without timezone shifting.
    ===================================================== */

    let assignmentDate =
      formatDbDateOnly(
        existing.assignment_date
      );

    const dateRaw =
      body?.assignment_date ??
      body?.assignmentDate ??
      body?.date;

    if (
      dateRaw !== undefined &&
      dateRaw !== null &&
      safeString(dateRaw) !== ""
    ) {
      assignmentDate =
        safeString(dateRaw);

      if (
        !validDate(
          assignmentDate
        )
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "Invalid assignment date. Use YYYY-MM-DD.",
          },
          { status: 400 }
        );
      }
    }

    if (
      !validDate(
        assignmentDate
      )
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Existing assignment date is invalid.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       BUSINESS
    ===================================================== */

    let businessName =
      master.business_name || "";

    const businessRaw =
      body?.business_name ??
      body?.businessName ??
      body?.business;

    if (
      businessRaw !== undefined &&
      businessRaw !== null
    ) {
      businessName =
        safeString(
          businessRaw
        );
    }

    businessName =
      businessName.slice(
        0,
        150
      );

    /* =====================================================
       CONTACT NAME
    ===================================================== */

    let contactName =
      master.name || "";

    const contactRaw =
      body?.contact_name ??
      body?.contactName ??
      body?.name ??
      body?.contact;

    if (
      contactRaw !== undefined &&
      contactRaw !== null
    ) {
      contactName =
        safeString(
          contactRaw
        );
    }

    contactName =
      contactName.slice(
        0,
        100
      );

    /* =====================================================
       PHONE
    ===================================================== */

    let phoneNumber =
      master.phone_number || "";

    const phoneRaw =
      body?.phone_number ??
      body?.phoneNumber ??
      body?.phone;

    if (
      phoneRaw !== undefined &&
      phoneRaw !== null
    ) {
      phoneNumber =
        safeString(
          phoneRaw
        );
    }

    phoneNumber =
      phoneNumber.slice(
        0,
        30
      );

    if (!phoneNumber) {
      return jsonResponse(
        {
          success: false,
          message:
            "Phone number is required.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       STATUS
    ===================================================== */

    let status =
      existing.status ||
      master.current_status ||
      "Pending";

    const statusRaw =
      body?.status ??
      body?.assignment_status ??
      body?.assignmentStatus;

    if (
      statusRaw !== undefined &&
      statusRaw !== null
    ) {
      status =
        safeString(
          statusRaw
        );
    }

    status =
      normalizeStatus(
        status
      ).slice(0, 50);

    const isCompleted =
      isCompletedStatus(
        status
      )
        ? 1
        : 0;

    /* =====================================================
       COMMENT
    ===================================================== */

    let comment =
      existing.comment || "";

    if (
      body?.comment !== undefined ||
      body?.comments !== undefined
    ) {
      comment =
        safeString(
          body?.comment ??
            body?.comments
        );
    }

    comment =
      comment.slice(
        0,
        5000
      );

    /* =====================================================
       UPDATE DAILY ASSIGNMENT
    ===================================================== */

    await dbQuery(
      `
      UPDATE daily_assignments
      SET
        employee_id = ?,
        assignment_date = ?,
        status = ?,
        comment = ?,
        is_completed = ?,
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1
      `,
      [
        employeeId,
        assignmentDate,
        status,
        comment || null,
        isCompleted,
        assignmentId,
      ]
    );

    /* =====================================================
       UPDATE MASTER TASK
    ===================================================== */

    await dbQuery(
      `
      UPDATE master_tasks
      SET
        task_date = ?,
        name = ?,
        phone_number = ?,
        business_name = ?,
        current_status = ?
      WHERE id = ?
      LIMIT 1
      `,
      [
        assignmentDate,
        contactName || null,
        phoneNumber,
        businessName || null,
        status,
        masterTaskId,
      ]
    );

    /* =====================================================
       RETURN UPDATED RECORD
    ===================================================== */

    const updatedRecord =
      await getHistoryRecord(
        assignmentId
      );

    return jsonResponse({
      success: true,

      message:
        "History record updated successfully.",

      data: updatedRecord,
    });
  } catch (error) {
    console.error(
      "=========================================="
    );

    console.error(
      "[History API] PUT ERROR"
    );

    console.error(
      "Message:",
      error?.message
    );

    console.error(
      "Code:",
      error?.code
    );

    console.error(
      "SQL State:",
      error?.sqlState
    );

    console.error(
      "SQL Message:",
      error?.sqlMessage
    );

    console.error(
      "Stack:",
      error?.stack
    );

    console.error(
      "=========================================="
    );

    return jsonResponse(
      {
        success: false,

        message:
          "Failed to update history record.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}