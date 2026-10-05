
// app/api/admin/history/route.js

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =========================================================
// CONFIG
// =========================================================

const COOKIE_NAME = "token";
const JWT_SECRET = process.env.JWT_SECRET;

const COMPLETED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
]);

// =========================================================
// DB QUERY HELPER
// =========================================================

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// =========================================================
// HELPERS
// =========================================================

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);

  return (
    normalized === "admin" ||
    normalized === "administrator" ||
    normalized === "superadmin" ||
    normalized === "super_admin"
  );
}

function normalizeStatus(status) {
  return String(status || "").trim();
}

function isCompletedStatus(status) {
  return COMPLETED_STATUSES.has(
    normalizeStatus(status).toLowerCase()
  );
}

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function validDate(value) {
  if (!value) {
    return false;
  }

  const str = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }

  const date = new Date(`${str}T00:00:00`);

  return !Number.isNaN(date.getTime());
}

function getCaliforniaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// =========================================================
// GET NEXT SEQUENCE NUMBER
//
// master_tasks.sequence_no = INT NOT NULL
// =========================================================

async function getNextSequenceNumber() {
  const rows = await query(`
    SELECT
      COALESCE(MAX(sequence_no), 0) + 1 AS next_sequence
    FROM master_tasks
  `);

  const nextSequence = Number(
    rows?.[0]?.next_sequence
  );

  if (
    !Number.isInteger(nextSequence) ||
    nextSequence <= 0
  ) {
    return 1;
  }

  return nextSequence;
}

// =========================================================
// AUTHENTICATION
// =========================================================

async function authenticate(request) {
  try {
    if (!JWT_SECRET) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "JWT_SECRET is not configured",
          },
          { status: 500 }
        ),
      };
    }

    const token =
      request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "Unauthorized",
          },
          { status: 401 }
        ),
      };
    }

    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "Invalid or expired token",
          },
          { status: 401 }
        ),
      };
    }

    const currentUserId = Number(
      decoded?.id ??
        decoded?.userId ??
        decoded?.user_id ??
        decoded?.uid
    );

    if (
      !Number.isInteger(currentUserId) ||
      currentUserId <= 0
    ) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "Invalid user ID in token",
          },
          { status: 401 }
        ),
      };
    }

    // Always load real user from DB.
    const users = await query(
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
      [currentUserId]
    );

    if (!users || users.length === 0) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: "User not found",
          },
          { status: 401 }
        ),
      };
    }

    const currentUser = users[0];

    const isAdmin = isAdminRole(
      currentUser.role
    );

    return {
      currentUser,
      currentUserId,
      isAdmin,
    };
  } catch (error) {
    console.error(
      "[History Auth Error]",
      error
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Authentication failed",
        },
        { status: 500 }
      ),
    };
  }
}

// =========================================================
// GET ONE HISTORY RECORD
//
// RELATION:
//
// daily_assignments.task_id
//          ↓
// master_tasks.id
//
// IMPORTANT:
// master_tasks.task_id DOES NOT EXIST.
// =========================================================

async function getHistoryRecord(assignmentId) {
  const rows = await query(
    `
    SELECT

      da.id AS assignment_id,
      da.id AS assignmentId,

      da.task_id AS task_id,
      da.task_id AS taskId,

      da.employee_id AS employee_id,
      da.employee_id AS employeeId,

      da.assignment_date AS assignment_date,
      da.assignment_date AS assignmentDate,

      da.assigned_at AS assigned_at,
      da.assigned_at AS assignedAt,

      da.status AS assignment_status,
      da.status AS status,

      da.comment AS assignment_comment,
      da.comment AS comment,

      da.is_completed AS is_completed,
      da.is_completed AS isCompleted,

      da.updated_at AS assignment_updated_at,
      da.updated_at AS updatedAt,

      da.created_at AS assignment_created_at,
      da.created_at AS createdAt,

      mt.id AS master_task_id,
      mt.id AS masterTaskId,

      mt.pool_id AS pool_id,
      mt.pool_id AS poolId,

      mt.sequence_no AS sequence_no,
      mt.sequence_no AS sequenceNo,

      mt.task_date AS task_date,
      mt.task_date AS taskDate,

      mt.business_name AS business_name,
      mt.business_name AS businessName,

      mt.name AS contact_name,
      mt.name AS contactName,

      mt.name AS name,

      mt.phone_number AS phone_number,
      mt.phone_number AS phoneNumber,

      mt.current_status AS task_status,
      mt.current_status AS taskStatus,

      mt.is_locked AS is_locked,
      mt.is_locked AS isLocked,

      u.id AS user_id,
      u.id AS userId,

      u.name AS employee_name,
      u.name AS employeeName,

      u.email AS employee_email,
      u.email AS employeeEmail,

      u.role AS employee_role,
      u.role AS employeeRole

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

// =========================================================
// GET
//
// ADMIN:
//   All history records.
//
// NORMAL USER:
//   Only own history records.
// =========================================================

export async function GET(request) {
  try {
    const auth = await authenticate(request);

    if (auth.error) {
      return auth.error;
    }

    const {
      currentUserId,
      isAdmin,
    } = auth;

    const { searchParams } =
      new URL(request.url);

    const from = safeString(
      searchParams.get("from")
    );

    const to = safeString(
      searchParams.get("to")
    );

    const date = safeString(
      searchParams.get("date")
    );

    let sql = `
      SELECT

        da.id AS assignment_id,
        da.id AS assignmentId,

        da.task_id AS task_id,
        da.task_id AS taskId,

        da.employee_id AS employee_id,
        da.employee_id AS employeeId,

        da.assignment_date AS assignment_date,
        da.assignment_date AS assignmentDate,

        da.assigned_at AS assigned_at,
        da.assigned_at AS assignedAt,

        da.status AS assignment_status,
        da.status AS status,

        da.comment AS assignment_comment,
        da.comment AS comment,

        da.is_completed AS is_completed,
        da.is_completed AS isCompleted,

        da.updated_at AS assignment_updated_at,
        da.updated_at AS updatedAt,

        da.created_at AS assignment_created_at,
        da.created_at AS createdAt,

        mt.id AS master_task_id,
        mt.id AS masterTaskId,

        mt.pool_id AS pool_id,
        mt.pool_id AS poolId,

        mt.sequence_no AS sequence_no,
        mt.sequence_no AS sequenceNo,

        mt.task_date AS task_date,
        mt.task_date AS taskDate,

        mt.business_name AS business_name,
        mt.business_name AS businessName,

        mt.name AS contact_name,
        mt.name AS contactName,

        mt.name AS name,

        mt.phone_number AS phone_number,
        mt.phone_number AS phoneNumber,

        mt.current_status AS task_status,
        mt.current_status AS taskStatus,

        mt.is_locked AS is_locked,
        mt.is_locked AS isLocked,

        u.id AS user_id,
        u.id AS userId,

        u.name AS employee_name,
        u.name AS employeeName,

        u.email AS employee_email,
        u.email AS employeeEmail,

        u.role AS employee_role,
        u.role AS employeeRole

      FROM daily_assignments da

      LEFT JOIN master_tasks mt
        ON mt.id = da.task_id

      LEFT JOIN users u
        ON u.id = da.employee_id

      WHERE 1 = 1
    `;

    const params = [];

    // =====================================================
    // NORMAL USER = ONLY OWN RECORDS
    // =====================================================

    if (!isAdmin) {
      sql += `
        AND da.employee_id = ?
      `;

      params.push(currentUserId);
    }

    // =====================================================
    // DATE FILTER
    // =====================================================

    if (date) {
      if (!validDate(date)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid date format. Use YYYY-MM-DD.",
          },
          { status: 400 }
        );
      }

      sql += `
        AND da.assignment_date = ?
      `;

      params.push(date);
    } else {
      if (from) {
        if (!validDate(from)) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Invalid from date.",
            },
            { status: 400 }
          );
        }

        sql += `
          AND da.assignment_date >= ?
        `;

        params.push(from);
      }

      if (to) {
        if (!validDate(to)) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Invalid to date.",
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

    const rows = await query(
      sql,
      params
    );

    return NextResponse.json({
      success: true,
      data: rows,
      records: rows,
      total: rows.length,
    });
  } catch (error) {
    console.error(
      "[History GET Error]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load history",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

// =========================================================
// POST - CREATE NEW ROW
//
// ADMIN:
//   Can create for ANY employee.
//
// NORMAL USER:
//   Can create ONLY for own login user.
//
// =========================================================

export async function POST(request) {
  let createdMasterTaskId = 0;

  try {
    const auth = await authenticate(request);

    if (auth.error) {
      return auth.error;
    }

    const {
      currentUserId,
      isAdmin,
    } = auth;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON body",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // EMPLOYEE ID
    // =====================================================

    const rawEmployeeId =
      body?.employee_id ??
      body?.employeeId ??
      body?.assigned_employee_id ??
      body?.assignedEmployeeId;

    let employeeId;

    if (
      rawEmployeeId === undefined ||
      rawEmployeeId === null ||
      rawEmployeeId === ""
    ) {
      // Normal user automatically gets own ID.
      if (!isAdmin) {
        employeeId = currentUserId;
      } else {
        return NextResponse.json(
          {
            success: false,
            message:
              "Employee is required for admin.",
          },
          { status: 400 }
        );
      }
    } else {
      employeeId = Number(rawEmployeeId);
    }

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid employee ID.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // SECURITY
    //
    // NORMAL USER CAN ONLY CREATE OWN RECORD.
    // =====================================================

    if (
      !isAdmin &&
      employeeId !== Number(currentUserId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You can only create records for your own user ID.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // VERIFY EMPLOYEE
    // =====================================================

    const employeeRows =
      await query(
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
      !employeeRows ||
      employeeRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Selected employee does not exist.",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // DATE
    // =====================================================

    const assignmentDate =
      safeString(
        body?.assignment_date ??
          body?.assignmentDate ??
          body?.date
      ) || getCaliforniaDate();

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

    // =====================================================
    // BUSINESS NAME
    // =====================================================

    const businessName =
      safeString(
        body?.business_name ??
          body?.businessName ??
          body?.business
      );

    if (businessName.length > 150) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Business name must be 150 characters or less.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CONTACT NAME
    // =====================================================

    const contactName =
      safeString(
        body?.contact_name ??
          body?.contactName ??
          body?.name ??
          body?.contact
      );

    if (contactName.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Contact name must be 100 characters or less.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // PHONE
    // =====================================================

    const phoneNumber =
      safeString(
        body?.phone_number ??
          body?.phoneNumber ??
          body?.phone
      );

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number is required.",
        },
        { status: 400 }
      );
    }

    if (phoneNumber.length > 30) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number must be 30 characters or less.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // STATUS
    // =====================================================

    const status =
      normalizeStatus(
        body?.status ??
          body?.assignment_status ??
          body?.assignmentStatus
      ) || "Pending";

    if (status.length > 50) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Status must be 50 characters or less.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // COMMENT
    // =====================================================

    const comment =
      safeString(
        body?.comment ??
          body?.comments
      );

    if (comment.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Comment must be 5000 characters or less.",
        },
        { status: 400 }
      );
    }

    const isCompleted =
      isCompletedStatus(status)
        ? 1
        : 0;

    // =====================================================
    // GET NEXT SEQUENCE
    // =====================================================

    const sequenceNo =
      await getNextSequenceNumber();

    // =====================================================
    // CREATE MASTER TASK
    //
    // CURRENT SCHEMA:
    //
    // id
    // pool_id
    // sequence_no
    // task_date
    // name
    // phone_number
    // business_name
    // current_status
    // is_locked
    //
    // master_tasks.task_id DOES NOT EXIST.
    // =====================================================

    const masterTaskResult =
      await query(
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
        masterTaskResult?.insertId
      );

    if (
      !Number.isInteger(
        createdMasterTaskId
      ) ||
      createdMasterTaskId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Master task was not created.",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // CREATE DAILY ASSIGNMENT
    //
    // daily_assignments.task_id
    // = master_tasks.id
    // =====================================================

    let assignmentId = 0;

    try {
      const assignmentResult =
        await query(
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

      assignmentId =
        Number(
          assignmentResult?.insertId
        );
    } catch (assignmentError) {
      // Remove orphan master task.
      try {
        await query(
          `
          DELETE FROM master_tasks
          WHERE id = ?
          LIMIT 1
          `,
          [createdMasterTaskId]
        );
      } catch (cleanupError) {
        console.error(
          "[History POST Cleanup Error]",
          cleanupError
        );
      }

      throw assignmentError;
    }

    if (
      !Number.isInteger(
        assignmentId
      ) ||
      assignmentId <= 0
    ) {
      try {
        await query(
          `
          DELETE FROM master_tasks
          WHERE id = ?
          LIMIT 1
          `,
          [createdMasterTaskId]
        );
      } catch (cleanupError) {
        console.error(
          "[History POST Cleanup Error 2]",
          cleanupError
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "Daily assignment was not created.",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // GET CREATED RECORD
    // =====================================================

    const newRecord =
      await getHistoryRecord(
        assignmentId
      );

    return NextResponse.json(
      {
        success: true,
        message:
          "New row created successfully.",

        data: newRecord,
        record: newRecord,

        assignment_id:
          assignmentId,

        // This is master_tasks.id
        task_id:
          createdMasterTaskId,

        sequence_no:
          sequenceNo,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[History POST Error]",
      error
    );

    // =====================================================
    // FINAL CLEANUP
    // =====================================================

    if (
      createdMasterTaskId > 0
    ) {
      try {
        await query(
          `
          DELETE FROM master_tasks
          WHERE id = ?
          LIMIT 1
          `,
          [createdMasterTaskId]
        );
      } catch (cleanupError) {
        console.error(
          "[History POST Final Cleanup Error]",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create new row.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

// =========================================================
// PUT - UPDATE EXISTING ROW
//
// ADMIN:
//   Can edit ANY employee.
//
// NORMAL USER:
//   Can edit ONLY their own record.
// =========================================================

export async function PUT(request) {
  try {
    const auth =
      await authenticate(request);

    if (auth.error) {
      return auth.error;
    }

    const {
      currentUserId,
      isAdmin,
    } = auth;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid JSON body",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // ASSIGNMENT ID
    // =====================================================

    const assignmentId =
      Number(
        body?.assignment_id ??
          body?.assignmentId ??
          body?.id
      );

    if (
      !Number.isInteger(
        assignmentId
      ) ||
      assignmentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid assignment ID.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // GET EXISTING ASSIGNMENT
    // =====================================================

    const existingRows =
      await query(
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
      !existingRows ||
      existingRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "History record not found.",
        },
        { status: 404 }
      );
    }

    const existing =
      existingRows[0];

    // =====================================================
    // OWNERSHIP SECURITY
    //
    // ADMIN:
    //   Can edit anyone.
    //
    // NORMAL USER:
    //   Can edit ONLY own record.
    // =====================================================

    if (
      !isAdmin &&
      Number(existing.employee_id) !==
        Number(currentUserId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You can only edit your own history records.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // MASTER TASK ID
    // =====================================================

    const taskId =
      Number(existing.task_id);

    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid master task ID.",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // DATE
    // =====================================================

    let assignmentDate =
      existing.assignment_date;

    if (
      body?.assignment_date !==
        undefined ||
      body?.assignmentDate !==
        undefined ||
      body?.date !== undefined
    ) {
      assignmentDate =
        safeString(
          body?.assignment_date ??
            body?.assignmentDate ??
            body?.date
        );

      if (
        !validDate(
          assignmentDate
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid date. Use YYYY-MM-DD.",
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // EMPLOYEE
    // =====================================================

    let employeeId =
      Number(existing.employee_id);

    if (
      body?.employee_id !==
        undefined ||
      body?.employeeId !==
        undefined
    ) {
      employeeId =
        Number(
          body?.employee_id ??
            body?.employeeId
        );
    }

    if (
      !Number.isInteger(
        employeeId
      ) ||
      employeeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid employee ID.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // NORMAL USER CANNOT TRANSFER OWN RECORD
    // TO ANOTHER EMPLOYEE.
    // =====================================================

    if (
      !isAdmin &&
      employeeId !==
        Number(currentUserId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot assign your history record to another employee.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // VERIFY EMPLOYEE
    // =====================================================

    const employeeCheck =
      await query(
        `
        SELECT
          id
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [employeeId]
      );

    if (
      !employeeCheck ||
      employeeCheck.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Selected employee does not exist.",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // STATUS
    // =====================================================

    let status =
      safeString(
        existing.status
      );

    if (
      body?.status !== undefined ||
      body?.assignment_status !==
        undefined
    ) {
      status =
        normalizeStatus(
          body?.status ??
            body?.assignment_status
        );

      if (!status) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status cannot be empty.",
          },
          { status: 400 }
        );
      }
    }

    if (status.length > 50) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Status must be 50 characters or less.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // COMMENT
    // =====================================================

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

    if (comment.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Comment must be 5000 characters or less.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // GET MASTER TASK
    // =====================================================

    const taskRows =
      await query(
        `
        SELECT
          id,
          business_name,
          name,
          phone_number
        FROM master_tasks
        WHERE id = ?
        LIMIT 1
        `,
        [taskId]
      );

    if (
      !taskRows ||
      taskRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Master task not found.",
        },
        { status: 404 }
      );
    }

    let businessName =
      taskRows[0]
        .business_name || "";

    let contactName =
      taskRows[0]
        .name || "";

    let phoneNumber =
      taskRows[0]
        .phone_number || "";

    // =====================================================
    // BUSINESS UPDATE
    // =====================================================

    if (
      body?.business_name !==
        undefined ||
      body?.businessName !==
        undefined ||
      body?.business !==
        undefined
    ) {
      businessName =
        safeString(
          body?.business_name ??
            body?.businessName ??
            body?.business
        );
    }

    // =====================================================
    // CONTACT UPDATE
    // =====================================================

    if (
      body?.contact_name !==
        undefined ||
      body?.contactName !==
        undefined ||
      body?.name !== undefined ||
      body?.contact !== undefined
    ) {
      contactName =
        safeString(
          body?.contact_name ??
            body?.contactName ??
            body?.name ??
            body?.contact
        );
    }

    // =====================================================
    // PHONE UPDATE
    // =====================================================

    if (
      body?.phone_number !==
        undefined ||
      body?.phoneNumber !==
        undefined ||
      body?.phone !== undefined
    ) {
      phoneNumber =
        safeString(
          body?.phone_number ??
            body?.phoneNumber ??
            body?.phone
        );
    }

    // =====================================================
    // VALIDATION
    // =====================================================

    if (businessName.length > 150) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Business name must be 150 characters or less.",
        },
        { status: 400 }
      );
    }

    if (contactName.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Contact name must be 100 characters or less.",
        },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number is required.",
        },
        { status: 400 }
      );
    }

    if (phoneNumber.length > 30) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number must be 30 characters or less.",
        },
        { status: 400 }
      );
    }

    const isCompleted =
      isCompletedStatus(status)
        ? 1
        : 0;

    // =====================================================
    // UPDATE DAILY ASSIGNMENT
    // =====================================================

    await query(
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

    // =====================================================
    // UPDATE MASTER TASK
    //
    // Only existing columns.
    //
    // sequence_no stays unchanged.
    // pool_id stays unchanged.
    // =====================================================

    await query(
      `
      UPDATE master_tasks
      SET
        task_date = ?,
        business_name = ?,
        name = ?,
        phone_number = ?,
        current_status = ?
      WHERE id = ?
      LIMIT 1
      `,
      [
        assignmentDate,
        businessName || null,
        contactName || null,
        phoneNumber,
        status,
        taskId,
      ]
    );

    // =====================================================
    // GET UPDATED RECORD
    // =====================================================

    const updatedRecord =
      await getHistoryRecord(
        assignmentId
      );

    return NextResponse.json({
      success: true,
      message:
        "History updated successfully.",
      data: updatedRecord,
      record: updatedRecord,
    });
  } catch (error) {
    console.error(
      "[History PUT Error]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update history.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

