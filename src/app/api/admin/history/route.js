import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "token";
const COMPLETED_STATUSES = new Set(["completed", "complete", "done"]);

const ADMIN_ROLES = new Set([
  "admin",
  "administrator",
  "superadmin",
  "super_admin",
]);

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeRole(value) {
  return safeString(value).toLowerCase().replace(/\s+/g, "_");
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

function validDate(value) {
  if (!value) return false;

  const str = safeString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }

  const date = new Date(`${str}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === str;
}

function normalizeStatus(value) {
  return safeString(value || "Pending", "Pending");
}

function isCompletedStatus(status) {
  return COMPLETED_STATUSES.has(
    safeString(status).toLowerCase()
  );
}

async function dbQuery(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/* =========================================================
   AUTH
========================================================= */

async function authenticate(request) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: "Unauthorized",
          },
          { status: 401 }
        ),
      };
    }

    if (!process.env.JWT_SECRET) {
      console.error("[History API] JWT_SECRET is missing");

      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: "Server authentication configuration is missing.",
          },
          { status: 500 }
        ),
      };
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error("[History API] JWT verify error:", error);

      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: "Invalid or expired session.",
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

    if (!Number.isInteger(userId) || userId <= 0) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: "Invalid user session.",
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
        response: NextResponse.json(
          {
            success: false,
            message: "User account not found.",
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
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
        status: user.status || "",
        isAdmin: isAdminRole(user.role),
      },
    };
  } catch (error) {
    console.error("[History API] Authentication error:", error);

    return {
      ok: false,
      response: NextResponse.json(
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
   GET SINGLE RECORD
========================================================= */

async function getHistoryRecord(assignmentId) {
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

  return rows?.[0] || null;
}

/* =========================================================
   GET HISTORY
========================================================= */

export async function GET(request) {
  try {
    const auth = await authenticate(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { searchParams } = new URL(request.url);

    const from = safeString(searchParams.get("from"));
    const to = safeString(searchParams.get("to"));
    const date = safeString(searchParams.get("date"));

    let sql = `
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

      WHERE 1 = 1
    `;

    const params = [];

    /* =====================================================
       NORMAL USER = ONLY OWN HISTORY
    ===================================================== */

    if (!user.isAdmin) {
      sql += `
        AND da.employee_id = ?
      `;

      params.push(user.id);
    }

    /* =====================================================
       EXACT DATE
    ===================================================== */

    if (date) {
      if (!validDate(date)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid date. Use YYYY-MM-DD.",
          },
          { status: 400 }
        );
      }

      sql += `
        AND da.assignment_date = ?
      `;

      params.push(date);
    } else {
      /* ===================================================
         FROM DATE
      =================================================== */

      if (from) {
        if (!validDate(from)) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid from date. Use YYYY-MM-DD.",
            },
            { status: 400 }
          );
        }

        sql += `
          AND da.assignment_date >= ?
        `;

        params.push(from);
      }

      /* ===================================================
         TO DATE
      =================================================== */

      if (to) {
        if (!validDate(to)) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid to date. Use YYYY-MM-DD.",
            },
            { status: 400 }
          );
        }

        sql += `
          AND da.assignment_date <= ?
        `;

        params.push(to);
      }
    }

    sql += `
      ORDER BY
        da.assignment_date DESC,
        da.id DESC
    `;

    const rows = await dbQuery(sql, params);

    const data = rows.map((row) => ({
      assignment_id: Number(row.assignment_id),
      task_id:
        row.task_id === null || row.task_id === undefined
          ? null
          : Number(row.task_id),

      employee_id:
        row.employee_id === null || row.employee_id === undefined
          ? null
          : Number(row.employee_id),

      assignment_date: row.assignment_date,
      assigned_at: row.assigned_at,

      assignment_status:
        row.assignment_status || row.current_status || "Pending",

      status:
        row.assignment_status || row.current_status || "Pending",

      comment: row.comment || "",

      is_completed:
        Number(row.is_completed) === 1 ||
        isCompletedStatus(row.assignment_status),

      updated_at: row.updated_at,
      created_at: row.created_at,

      master_task_id:
        row.master_task_id === null ||
        row.master_task_id === undefined
          ? null
          : Number(row.master_task_id),

      pool_id:
        row.pool_id === null || row.pool_id === undefined
          ? null
          : Number(row.pool_id),

      sequence_no:
        row.sequence_no === null ||
        row.sequence_no === undefined
          ? null
          : Number(row.sequence_no),

      task_date: row.task_date,

      contact_name: row.contact_name || "",
      name: row.contact_name || "",

      phone_number: row.phone_number || "",
      phone: row.phone_number || "",

      business_name: row.business_name || "",
      business: row.business_name || "",

      current_status: row.current_status || "",

      is_locked: Number(row.is_locked) === 1,

      employee_user_id:
        row.employee_user_id === null ||
        row.employee_user_id === undefined
          ? null
          : Number(row.employee_user_id),

      employee_name: row.employee_name || "",
      employee_email: row.employee_email || "",
      employee_role: row.employee_role || "",
    }));

    return NextResponse.json({
      success: true,
      data,
      records: data,
      total: data.length,
    });
  } catch (error) {
    console.error("==========================================");
    console.error("[History API] GET ERROR");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("SQL State:", error?.sqlState);
    console.error("SQL Message:", error?.sqlMessage);
    console.error("Stack:", error?.stack);
    console.error("==========================================");

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load history.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
   ADMIN = CAN ADD FOR ANY EMPLOYEE
   USER = CAN ADD ONLY FOR THEMSELVES
========================================================= */

export async function POST(request) {
  let createdMasterTaskId = null;

  try {
    const auth = await authenticate(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await request.json();

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
      requestedEmployeeIdRaw === undefined ||
      requestedEmployeeIdRaw === null ||
      safeString(requestedEmployeeIdRaw) === ""
    ) {
      if (user.isAdmin) {
        return NextResponse.json(
          {
            success: false,
            message: "employee_id is required for admin.",
          },
          { status: 400 }
        );
      }

      employeeId = user.id;
    } else {
      employeeId = Number(requestedEmployeeIdRaw);

      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid employee_id.",
          },
          { status: 400 }
        );
      }

      /* USER CANNOT ADD FOR ANOTHER EMPLOYEE */

      if (!user.isAdmin && employeeId !== user.id) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only add your own history record.",
          },
          { status: 403 }
        );
      }
    }

    /* =====================================================
       VERIFY EMPLOYEE
    ===================================================== */

    const employeeRows = await dbQuery(
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

    if (!employeeRows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee not found.",
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
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    if (!validDate(assignmentDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid assignment date. Use YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       FIELDS
    ===================================================== */

    const businessName = safeString(
      body?.business_name ??
        body?.businessName ??
        body?.business
    ).slice(0, 150);

    const contactName = safeString(
      body?.contact_name ??
        body?.contactName ??
        body?.name ??
        body?.contact
    ).slice(0, 100);

    const phoneNumber = safeString(
      body?.phone_number ??
        body?.phoneNumber ??
        body?.phone
    ).slice(0, 30);

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          message: "Phone number is required.",
        },
        { status: 400 }
      );
    }

    const status = normalizeStatus(
      body?.status ??
        body?.assignment_status ??
        body?.assignmentStatus ??
        "Pending"
    ).slice(0, 50);

    const comment = safeString(
      body?.comment ?? body?.comments
    ).slice(0, 5000);

    const isCompleted = isCompletedStatus(status) ? 1 : 0;

    /* =====================================================
       GENERATE SEQUENCE
       sequence_no IS REQUIRED IN master_tasks
    ===================================================== */

    const sequenceRows = await dbQuery(
      `
      SELECT
        COALESCE(MAX(sequence_no), 0) + 1 AS next_sequence
      FROM master_tasks
      `
    );

    const sequenceNo =
      Number(sequenceRows?.[0]?.next_sequence) || 1;

    /* =====================================================
       CREATE MASTER TASK

       IMPORTANT:
       master_tasks DOES NOT HAVE task_id COLUMN.
    ===================================================== */

    const masterResult = await dbQuery(
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

    createdMasterTaskId = Number(masterResult.insertId);

    if (!createdMasterTaskId) {
      throw new Error("Failed to create master task.");
    }

    /* =====================================================
       CREATE DAILY ASSIGNMENT
    ===================================================== */

    const assignmentResult = await dbQuery(
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

    const assignmentId = Number(assignmentResult.insertId);

    /* =====================================================
       GET CREATED RECORD
    ===================================================== */

    const createdRecord = await getHistoryRecord(
      assignmentId
    );

    return NextResponse.json(
      {
        success: true,
        message: "History record added successfully.",
        data: createdRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("==========================================");
    console.error("[History API] POST ERROR");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("SQL State:", error?.sqlState);
    console.error("SQL Message:", error?.sqlMessage);
    console.error("Stack:", error?.stack);
    console.error("==========================================");

    /* =====================================================
       CLEANUP MASTER TASK IF ASSIGNMENT INSERT FAILED
    ===================================================== */

    if (createdMasterTaskId) {
      try {
        await dbQuery(
          `
          DELETE FROM master_tasks
          WHERE id = ?
          LIMIT 1
          `,
          [createdMasterTaskId]
        );
      } catch (cleanupError) {
        console.error(
          "[History API] Cleanup error:",
          cleanupError?.message
        );
      }
    }

    let message = "Failed to add history record.";

    if (error?.code === "ER_DUP_ENTRY") {
      message =
        "This history record could not be created because a duplicate assignment exists.";
    }

    return NextResponse.json(
      {
        success: false,
        message,
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PUT
   ONLY ADMIN CAN EDIT
========================================================= */

export async function PUT(request) {
  try {
    const auth = await authenticate(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    /* =====================================================
       ONLY ADMIN
    ===================================================== */

    if (!user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "Only admin can edit history records.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const assignmentIdRaw =
      body?.assignment_id ??
      body?.assignmentId ??
      body?.id;

    const assignmentId = Number(assignmentIdRaw);

    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid assignment_id is required.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       LOAD EXISTING ASSIGNMENT
    ===================================================== */

    const assignmentRows = await dbQuery(
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

    if (!assignmentRows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "History record not found.",
        },
        { status: 404 }
      );
    }

    const existing = assignmentRows[0];

    const masterTaskId = Number(existing.task_id);

    if (!masterTaskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Master task reference is missing.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       LOAD MASTER TASK
    ===================================================== */

    const masterRows = await dbQuery(
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

    if (!masterRows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Master task not found.",
        },
        { status: 404 }
      );
    }

    const master = masterRows[0];

    /* =====================================================
       EMPLOYEE
    ===================================================== */

    const employeeRaw =
      body?.employee_id ??
      body?.employeeId ??
      body?.assigned_employee_id ??
      body?.assignedEmployeeId;

    let employeeId = Number(existing.employee_id);

    if (
      employeeRaw !== undefined &&
      employeeRaw !== null &&
      safeString(employeeRaw) !== ""
    ) {
      employeeId = Number(employeeRaw);
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid employee_id.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       VERIFY EMPLOYEE
    ===================================================== */

    const employeeRows = await dbQuery(
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

    if (!employeeRows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee not found.",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       DATE
    ===================================================== */

    let assignmentDate =
      existing.assignment_date;

    const dateRaw =
      body?.assignment_date ??
      body?.assignmentDate ??
      body?.date;

    if (
      dateRaw !== undefined &&
      dateRaw !== null &&
      safeString(dateRaw) !== ""
    ) {
      assignmentDate = safeString(dateRaw);

      if (!validDate(assignmentDate)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid assignment date. Use YYYY-MM-DD.",
          },
          { status: 400 }
        );
      }
    }

    /* =====================================================
       BUSINESS NAME
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
      businessName = safeString(businessRaw);
    }

    businessName = businessName.slice(0, 150);

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
      contactName = safeString(contactRaw);
    }

    contactName = contactName.slice(0, 100);

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
      phoneNumber = safeString(phoneRaw);
    }

    phoneNumber = phoneNumber.slice(0, 30);

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          message: "Phone number is required.",
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
      status = safeString(statusRaw);
    }

    status = status.slice(0, 50);

    const isCompleted = isCompletedStatus(status)
      ? 1
      : 0;

    /* =====================================================
       COMMENT
    ===================================================== */

    let comment = existing.comment || "";

    if (
      body?.comment !== undefined ||
      body?.comments !== undefined
    ) {
      comment = safeString(
        body?.comment ?? body?.comments
      );
    }

    comment = comment.slice(0, 5000);

    /* =====================================================
       UPDATE DAILY ASSIGNMENT

       sequence_no and pool_id remain untouched.
    ===================================================== */

    await dbQuery(
      `
      UPDATE daily_assignments
      SET
        employee_id = ?,
        assignment_date = ?,
        status = ?,
        comment = ?,
        is_completed = ?
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

       IMPORTANT:
       NO task_id COLUMN HERE.
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
       GET UPDATED RECORD
    ===================================================== */

    const updatedRecord =
      await getHistoryRecord(assignmentId);

    return NextResponse.json({
      success: true,
      message: "History record updated successfully.",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("==========================================");
    console.error("[History API] PUT ERROR");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("SQL State:", error?.sqlState);
    console.error("SQL Message:", error?.sqlMessage);
    console.error("Stack:", error?.stack);
    console.error("==========================================");

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update history record.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}