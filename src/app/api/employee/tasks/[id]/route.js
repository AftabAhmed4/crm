
import { NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

/*
============================================================
EMPLOYEE TASK [ID] API
============================================================

URL:
PATCH /api/employee/tasks/:id

SOURCE OF TRUTH:
daily_assignments

Employee selected status:
Callback
Follow UP
No Answer
Interested
Not Interested
Do Not Call
etc.

SAVE:
daily_assignments.status
daily_assignments.comment
daily_assignments.is_completed

ALSO UPDATE:
master_tasks.current_status
master_tasks.is_locked
============================================================
*/


// ============================================================
// PATCH
// ============================================================

export async function PATCH(request, { params }) {
  let connection = null;

  try {
    // ========================================================
    // GET TASK ID
    // ========================================================

    const resolvedParams = await params;

    const assignmentId = Number(resolvedParams?.id);

    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid task ID",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body",
        },
        {
          status: 400,
        }
      );
    }

    const selectedStatus =
      body?.status ??
      body?.selected_status ??
      body?.selectedStatus ??
      body?.result ??
      body?.disposition ??
      "";

    const selectedComment =
      body?.comment ??
      body?.comments ??
      body?.notes ??
      null;

    const finalStatus = String(selectedStatus).trim();

    const finalComment =
      selectedComment === null ||
      selectedComment === undefined
        ? null
        : String(selectedComment).trim();

    // ========================================================
    // STATUS REQUIRED
    // ========================================================

    if (!finalStatus) {
      return NextResponse.json(
        {
          success: false,
          message: "Status is required",
        },
        {
          status: 400,
        }
      );
    }

    if (finalStatus.length > 255) {
      return NextResponse.json(
        {
          success: false,
          message: "Status is too long",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const cookieStore = await cookies();

    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please login again.",
        },
        {
          status: 401,
        }
      );
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (authError) {
      console.error(
        "JWT VERIFY ERROR:",
        authError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired login session",
        },
        {
          status: 401,
        }
      );
    }

    const employeeId =
      decoded?.id ??
      decoded?._id ??
      decoded?.userId;

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user session",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================================
    // GET DATABASE CONNECTION
    // ========================================================

    /*
      query() is used for normal queries.

      For transaction we need a direct connection.
      The code below supports the common mysql2 pool
      exposed from lib/db.
    */

    const dbModule = await import("../../../../lib/db");

    const pool =
      dbModule.default ??
      dbModule.pool ??
      dbModule;

    if (!pool || typeof pool.getConnection !== "function") {
      throw new Error(
        "Database pool does not expose getConnection()"
      );
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();

    // ========================================================
    // FIND ASSIGNMENT
    // ========================================================

    const [assignmentRows] =
      await connection.execute(
        `
        SELECT
          da.id,
          da.employee_id,
          da.task_id,
          da.assignment_date,
          da.status,
          da.comment,
          da.is_completed,

          mt.id AS master_task_id,
          mt.current_status,
          mt.is_locked

        FROM daily_assignments da

        INNER JOIN master_tasks mt
          ON da.task_id = mt.id

        WHERE da.id = ?
          AND da.employee_id = ?

        LIMIT 1
        `,
        [
          assignmentId,
          employeeId,
        ]
      );

    if (!assignmentRows.length) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Task not found or this task is not assigned to you.",
        },
        {
          status: 404,
        }
      );
    }

    const assignment =
      assignmentRows[0];

    // ========================================================
    // ALREADY COMPLETED CHECK
    // ========================================================

    if (
      Number(assignment.is_completed) === 1
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "This task has already been completed.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // CHECK STATUS CONFIG
    // ========================================================

    let isLockingStatus = 0;

    try {
      const [statusRows] =
        await connection.execute(
          `
          SELECT
            is_locking_status

          FROM status_configs

          WHERE status_name = ?

          LIMIT 1
          `,
          [finalStatus]
        );

      if (statusRows.length) {
        isLockingStatus =
          Number(
            statusRows[0]
              .is_locking_status || 0
          );
      }
    } catch (statusConfigError) {
      /*
        If status_configs does not exist or has a
        slightly different schema, don't destroy the
        task save. Existing master_tasks.is_locked
        value will be preserved.
      */

      console.warn(
        "STATUS CONFIG CHECK WARNING:",
        statusConfigError?.message
      );

      isLockingStatus = 0;
    }

    // ========================================================
    // UPDATE DAILY ASSIGNMENT
    // ========================================================

    const [updateResult] =
      await connection.execute(
        `
        UPDATE daily_assignments

        SET
          status = ?,
          comment = ?,
          is_completed = 1,
          updated_at = NOW()

        WHERE id = ?
          AND employee_id = ?

          AND (
            is_completed = 0
            OR is_completed IS NULL
          )
        `,
        [
          finalStatus,
          finalComment,
          assignmentId,
          employeeId,
        ]
      );

    // ========================================================
    // VERIFY UPDATE
    // ========================================================

    if (
      Number(updateResult?.affectedRows || 0) !== 1
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Task was not updated. It may already be completed.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // UPDATE MASTER TASK
    // ========================================================

    /*
      Lock only when status_configs says this status
      is a locking status.

      Otherwise preserve existing lock value.
    */

    if (isLockingStatus === 1) {
      await connection.execute(
        `
        UPDATE master_tasks

        SET
          current_status = ?,
          is_locked = 1

        WHERE id = ?
        `,
        [
          finalStatus,
          assignment.task_id,
        ]
      );
    } else {
      await connection.execute(
        `
        UPDATE master_tasks

        SET
          current_status = ?

        WHERE id = ?
        `,
        [
          finalStatus,
          assignment.task_id,
        ]
      );
    }

    // ========================================================
    // GET UPDATED COUNTS
    // ========================================================

    const [countRows] =
      await connection.execute(
        `
        SELECT

          COUNT(*) AS total,

          SUM(
            CASE
              WHEN is_completed = 1
              THEN 1
              ELSE 0
            END
          ) AS completed,

          SUM(
            CASE
              WHEN is_completed = 0
                OR is_completed IS NULL
              THEN 1
              ELSE 0
            END
          ) AS remaining

        FROM daily_assignments

        WHERE employee_id = ?
          AND assignment_date = ?
        `,
        [
          employeeId,
          assignment.assignment_date,
        ]
      );

    const counts =
      countRows?.[0] || {};

    const total =
      Number(counts.total || 0);

    const completed =
      Number(counts.completed || 0);

    const remaining =
      Number(counts.remaining || 0);

    // ========================================================
    // COMMIT
    // ========================================================

    await connection.commit();

    // ========================================================
    // RELEASE
    // ========================================================

    connection.release();
    connection = null;

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Task saved successfully",

        data: {
          assignment_id:
            assignmentId,

          daily_assignment_id:
            assignmentId,

          task_id:
            Number(assignment.task_id),

          master_task_id:
            Number(assignment.master_task_id),

          employee_id:
            Number(employeeId),

          status:
            finalStatus,

          assignment_status:
            finalStatus,

          assignment_status_name:
            finalStatus,

          selected_status:
            finalStatus,

          selectedStatus:
            finalStatus,

          result:
            finalStatus,

          result_status:
            finalStatus,

          task_status:
            finalStatus,

          call_status:
            finalStatus,

          disposition:
            finalStatus,

          outcome:
            finalStatus,

          current_status:
            finalStatus,

          comment:
            finalComment,

          comments:
            finalComment,

          notes:
            finalComment,

          is_completed: 1,

          is_locked:
            isLockingStatus === 1
              ? 1
              : Number(
                  assignment.is_locked || 0
                ),

          counts: {
            total,
            completed,
            remaining,
          },
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    // ========================================================
    // ROLLBACK
    // ========================================================

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "EMPLOYEE TASK PATCH ERROR:",
      error
    );

    // ========================================================
    // RELEASE
    // ========================================================

    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error(
          "RELEASE ERROR:",
          releaseError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to save task",
      },
      {
        status: 500,
      }
    );
  }
}

