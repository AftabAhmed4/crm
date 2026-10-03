import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// HELPERS
// ============================================================

function isValidDate(value) {
  if (!value) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const d = new Date(Date.UTC(year, month - 1, day));

  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function cleanString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getUserIdFromToken(decoded) {
  return (
    decoded?.id ??
    decoded?.userId ??
    decoded?.user_id ??
    decoded?._id
  );
}

function isAdminRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();

  return (
    normalized === "admin" ||
    normalized === "administrator" ||
    normalized === "superadmin" ||
    normalized === "super_admin"
  );
}

// ============================================================
// AUTHENTICATION
// ============================================================

async function authenticate(request) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please login again.",
        },
        { status: 401 }
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
      "ADMIN HISTORY JWT ERROR:",
      error
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Invalid or expired login session.",
        },
        { status: 401 }
      ),
    };
  }

  const currentUserId =
    getUserIdFromToken(decoded);

  if (!currentUserId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "User ID not found in token.",
        },
        { status: 401 }
      ),
    };
  }

  const users = await query(
    `
      SELECT
        id,
        name,
        email,
        role
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [currentUserId]
  );

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Logged-in user was not found.",
        },
        { status: 401 }
      ),
    };
  }

  const currentUser = users[0];

  return {
    currentUser,
    currentUserId,
    isAdmin: isAdminRole(currentUser.role),
  };
}

// ============================================================
// RESPONSE HEADERS
// ============================================================

function noCacheHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  };
}

// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    // ========================================================
    // QUERY PARAMS
    // ========================================================

    const { searchParams } =
      new URL(request.url);

    const dateStr = String(
      searchParams.get("date") || ""
    ).trim();

    const fromDate = String(
      searchParams.get("from") || ""
    ).trim();

    const toDate = String(
      searchParams.get("to") || ""
    ).trim();

    // ========================================================
    // DATE VALIDATION
    // ========================================================

    if (
      !isValidDate(dateStr) ||
      !isValidDate(fromDate) ||
      !isValidDate(toDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid date format. Use YYYY-MM-DD.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    if (
      fromDate &&
      toDate &&
      fromDate > toDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "From date cannot be greater than To date.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // AUTH
    // ========================================================

    const auth = await authenticate(request);

    if (auth.error) {
      return auth.error;
    }

    const {
      currentUser,
      currentUserId,
      isAdmin,
    } = auth;

    // ========================================================
    // MAIN QUERY
    // ========================================================
    //
    // IMPORTANT:
    // NO updated_at COLUMN IS USED.
    //
    // Your daily_assignments table uses created_at.
    //
    // ========================================================

    let sql = `
      SELECT

        /* ==================================================
           DAILY ASSIGNMENT
        ================================================== */

        da.id AS id,

        da.id AS assignment_id,

        da.id AS daily_assignment_id,

        da.task_id AS assignment_task_id,

        da.task_id AS assignmentTaskId,

        da.employee_id AS employee_id,

        da.employee_id AS employeeId,

        da.employee_id AS assigned_employee_id,

        da.employee_id AS assignedEmployeeId,

        /* ==================================================
           DATE
        ================================================== */

        da.assignment_date AS assignment_date,

        da.assignment_date AS assignmentDate,

        DATE(da.assignment_date) AS assignedDate,

        DATE(da.assignment_date) AS assignmentDateOnly,

        DATE(da.assignment_date) AS task_date,

        DATE(da.assignment_date) AS taskDate,

        DATE(da.assignment_date) AS date,

        /* ==================================================
           CREATED TIME
           updated_at REMOVED
        ================================================== */

        da.created_at AS created_at,

        da.created_at AS createdAt,

        /* ==================================================
           STATUS
        ================================================== */

        da.status AS status,

        da.status AS assignment_status,

        da.status AS assignmentStatus,

        da.status AS assignment_status_name,

        da.status AS selected_status,

        da.status AS selectedStatus,

        da.status AS result,

        da.status AS result_status,

        da.status AS task_status,

        da.status AS taskStatus,

        da.status AS call_status,

        da.status AS callStatus,

        da.status AS disposition,

        da.status AS outcome,

        da.status AS current_status,

        da.status AS selected_result,

        /* ==================================================
           COMMENT
        ================================================== */

        da.comment AS comment,

        da.comment AS comments,

        da.comment AS notes,

        da.comment AS task_comment,

        da.comment AS taskComment,

        /* ==================================================
           COMPLETION
        ================================================== */

        da.is_completed AS is_completed,

        da.is_completed AS isCompleted,

        /* ==================================================
           MASTER TASK
        ================================================== */

        mt.id AS taskId,

        mt.id AS task_id,

        mt.id AS master_task_id,

        mt.id AS masterTaskId,

        mt.name AS name,

        mt.name AS contactName,

        mt.name AS contact_name,

        mt.phone_number AS phone,

        mt.phone_number AS phoneNumber,

        mt.phone_number AS phone_number,

        mt.business_name AS businessName,

        mt.business_name AS business_name,

        mt.current_status AS master_current_status,

        mt.is_locked AS is_locked,

        /* ==================================================
           USER
        ================================================== */

        u.id AS staffId,

        u.id AS staff_id,

        u.id AS userId,

        u.name AS assignedToName,

        u.name AS assigned_to,

        u.name AS employeeName,

        u.name AS employee_name,

        u.name AS staffName,

        u.name AS staff_name,

        u.name AS userName,

        u.name AS user_name,

        u.email AS staffEmail,

        u.email AS employeeEmail,

        u.email AS userEmail,

        u.email AS email,

        u.role AS staffRole,

        u.role AS employeeRole,

        u.role AS userRole

      FROM daily_assignments da

      LEFT JOIN master_tasks mt
        ON da.task_id = mt.id

      LEFT JOIN users u
        ON da.employee_id = u.id
    `;

    // ========================================================
    // WHERE
    // ========================================================

    const where = [];
    const params = [];

    // --------------------------------------------------------
    // NORMAL USER
    // --------------------------------------------------------

    if (!isAdmin) {
      where.push(
        `da.employee_id = ?`
      );

      params.push(currentUserId);
    }

    // --------------------------------------------------------
    // SINGLE DATE
    // --------------------------------------------------------

    if (dateStr) {
      where.push(
        `DATE(da.assignment_date) = ?`
      );

      params.push(dateStr);
    }

    // --------------------------------------------------------
    // FROM DATE
    // --------------------------------------------------------

    if (fromDate) {
      where.push(
        `DATE(da.assignment_date) >= ?`
      );

      params.push(fromDate);
    }

    // --------------------------------------------------------
    // TO DATE
    // --------------------------------------------------------

    if (toDate) {
      where.push(
        `DATE(da.assignment_date) <= ?`
      );

      params.push(toDate);
    }

    // ========================================================
    // APPLY WHERE
    // ========================================================

    if (where.length > 0) {
      sql += `
        WHERE ${where.join(" AND ")}
      `;
    }

    // ========================================================
    // ORDER
    // ========================================================
    //
    // updated_at REMOVED.
    //
    // Newest assignment date first,
    // then newest ID.
    //
    // ========================================================

    sql += `
      ORDER BY
        da.assignment_date DESC,
        da.id DESC
    `;

    // ========================================================
    // DATABASE
    // ========================================================

    const rows = await query(
      sql,
      params
    );

    // ========================================================
    // NORMALIZE
    // ========================================================

    const normalizedTasks =
      Array.isArray(rows)
        ? rows.map((row) => {
            const status =
              row?.status === null ||
              row?.status === undefined
                ? ""
                : String(
                    row.status
                  ).trim();

            const comment =
              row?.comment === null ||
              row?.comment === undefined
                ? ""
                : String(
                    row.comment
                  ).trim();

            return {
              ...row,

              // ==================================================
              // DATE
              // ==================================================

              assignment_date:
                row?.assignment_date ||
                null,

              assignmentDate:
                row?.assignmentDate ||
                row?.assignment_date ||
                null,

              assignedDate:
                row?.assignedDate ||
                null,

              assignmentDateOnly:
                row?.assignmentDateOnly ||
                row?.assignedDate ||
                null,

              task_date:
                row?.task_date ||
                row?.assignedDate ||
                null,

              taskDate:
                row?.taskDate ||
                row?.assignedDate ||
                null,

              date:
                row?.date ||
                row?.assignedDate ||
                null,

              // ==================================================
              // STATUS
              // ==================================================

              status,

              assignment_status:
                status,

              assignmentStatus:
                status,

              assignment_status_name:
                status,

              selected_status:
                status,

              selectedStatus:
                status,

              result:
                status,

              result_status:
                status,

              task_status:
                status,

              taskStatus:
                status,

              call_status:
                status,

              callStatus:
                status,

              disposition:
                status,

              outcome:
                status,

              current_status:
                status,

              selected_result:
                status,

              // ==================================================
              // COMMENT
              // ==================================================

              comment:
                comment || null,

              comments:
                comment || null,

              notes:
                comment || null,

              task_comment:
                comment || null,

              taskComment:
                comment || null,

              // ==================================================
              // COMPLETION
              // ==================================================

              is_completed:
                Number(
                  row?.is_completed ?? 0
                ),

              isCompleted:
                Number(
                  row?.is_completed ?? 0
                ),

              // ==================================================
              // EMPLOYEE
              // ==================================================

              employee_id:
                row?.employee_id ??
                null,

              employeeId:
                row?.employeeId ??
                row?.employee_id ??
                null,

              assigned_employee_id:
                row?.assigned_employee_id ??
                row?.employee_id ??
                null,

              assignedEmployeeId:
                row?.assignedEmployeeId ??
                row?.employee_id ??
                null,

              employee_name:
                row?.employee_name ||
                row?.employeeName ||
                row?.assignedToName ||
                "",

              employeeName:
                row?.employeeName ||
                row?.employee_name ||
                row?.assignedToName ||
                "",

              assignedToName:
                row?.assignedToName ||
                row?.employeeName ||
                "",

              assigned_to:
                row?.assigned_to ||
                row?.employeeName ||
                "",

              staffName:
                row?.staffName ||
                row?.employeeName ||
                "",

              userName:
                row?.userName ||
                row?.employeeName ||
                "",

              user_name:
                row?.user_name ||
                row?.employeeName ||
                "",
            };
          })
        : [];

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        data: normalizedTasks,

        records: normalizedTasks,

        history: normalizedTasks,

        tasks: normalizedTasks,

        count:
          normalizedTasks.length,

        date:
          dateStr || null,

        from:
          fromDate || null,

        to:
          toDate || null,

        source:
          "daily_assignments",

        timezone:
          "America/Los_Angeles",

        viewer: {
          id:
            currentUser.id,

          name:
            currentUser.name || "",

          email:
            currentUser.email || "",

          role:
            currentUser.role || "",

          isAdmin,
        },
      },
      {
        status: 200,
        headers: noCacheHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "ADMIN HISTORY GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to fetch admin history",

        error:
          process.env.NODE_ENV ===
          "development"
            ? String(error)
            : undefined,
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}

// ============================================================
// PUT
// EDIT REPORT / HISTORY RECORD
// ============================================================

export async function PUT(request) {
  try {
    // ========================================================
    // AUTH
    // ========================================================

    const auth =
      await authenticate(request);

    if (auth.error) {
      return auth.error;
    }

    const {
      currentUserId,
      isAdmin,
    } = auth;

    // ========================================================
    // ADMIN ONLY
    // ========================================================

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only admin can edit report records.",
        },
        {
          status: 403,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // BODY
    // ========================================================

    let body;

    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid JSON request body.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // ASSIGNMENT ID
    // ========================================================

    const assignmentId = Number(
      body?.assignment_id ??
      body?.assignmentId ??
      body?.daily_assignment_id ??
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
            "Valid assignment_id is required.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // FIND ASSIGNMENT
    // ========================================================

    const assignmentRows =
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
      !Array.isArray(
        assignmentRows
      ) ||
      assignmentRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Assignment record not found.",
        },
        {
          status: 404,
          headers: noCacheHeaders(),
        }
      );
    }

    const assignment =
      assignmentRows[0];

    const taskId = Number(
      assignment.task_id
    );

    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This assignment does not have a valid task.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // FIND MASTER TASK
    // ========================================================

    const taskRows =
      await query(
        `
          SELECT
            id,
            name,
            phone_number,
            business_name
          FROM master_tasks
          WHERE id = ?
          LIMIT 1
        `,
        [taskId]
      );

    if (
      !Array.isArray(taskRows) ||
      taskRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Master task not found.",
        },
        {
          status: 404,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // BODY FIELD HELPER
    // ========================================================

    const hasOwn = (key) =>
      Object.prototype.hasOwnProperty.call(
        body,
        key
      );

    // ========================================================
    // DATE
    // ========================================================

    let assignmentDate;

    if (hasOwn("assignment_date")) {
      assignmentDate =
        cleanString(
          body.assignment_date
        );
    } else if (
      hasOwn("assignmentDate")
    ) {
      assignmentDate =
        cleanString(
          body.assignmentDate
        );
    } else if (
      hasOwn("date")
    ) {
      assignmentDate =
        cleanString(
          body.date
        );
    }

    if (
      assignmentDate !== undefined
    ) {
      if (!assignmentDate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Assignment date cannot be empty.",
          },
          {
            status: 400,
            headers:
              noCacheHeaders(),
          }
        );
      }

      if (
        !isValidDate(
          assignmentDate
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid assignment date. Use YYYY-MM-DD.",
          },
          {
            status: 400,
            headers:
              noCacheHeaders(),
          }
        );
      }
    }

    // ========================================================
    // EMPLOYEE
    // ========================================================

    let employeeId;

    if (hasOwn("employee_id")) {
      employeeId = Number(
        body.employee_id
      );
    } else if (
      hasOwn("employeeId")
    ) {
      employeeId = Number(
        body.employeeId
      );
    } else if (
      hasOwn(
        "assigned_employee_id"
      )
    ) {
      employeeId = Number(
        body.assigned_employee_id
      );
    }

    if (
      employeeId !== undefined
    ) {
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
              "Valid employee_id is required.",
          },
          {
            status: 400,
            headers:
              noCacheHeaders(),
          }
        );
      }

      const employeeRows =
        await query(
          `
            SELECT
              id,
              name,
              role
            FROM users
            WHERE id = ?
            LIMIT 1
          `,
          [employeeId]
        );

      if (
        !Array.isArray(
          employeeRows
        ) ||
        employeeRows.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Selected employee was not found.",
          },
          {
            status: 400,
            headers:
              noCacheHeaders(),
          }
        );
      }
    }

    // ========================================================
    // STATUS
    // ========================================================

    let status;

    if (hasOwn("status")) {
      status = cleanString(
        body.status
      );
    } else if (
      hasOwn("selected_status")
    ) {
      status = cleanString(
        body.selected_status
      );
    } else if (
      hasOwn("selectedStatus")
    ) {
      status = cleanString(
        body.selectedStatus
      );
    }

    if (status !== undefined) {
      if (!status) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status cannot be empty.",
          },
          {
            status: 400,
            headers:
              noCacheHeaders(),
          }
        );
      }

      if (status.length > 100) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status is too long.",
          },
          {
            status: 400,
            headers:
              noCacheHeaders(),
          }
        );
      }
    }

    // ========================================================
    // COMMENT
    // ========================================================

    let comment;

    if (hasOwn("comment")) {
      comment = cleanString(
        body.comment
      );
    } else if (
      hasOwn("comments")
    ) {
      comment = cleanString(
        body.comments
      );
    } else if (
      hasOwn("notes")
    ) {
      comment = cleanString(
        body.notes
      );
    }

    if (
      comment !== undefined &&
      comment.length > 5000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Comment is too long. Maximum 5000 characters.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // BUSINESS NAME
    // ========================================================

    let businessName;

    if (
      hasOwn("business_name")
    ) {
      businessName =
        cleanString(
          body.business_name
        );
    } else if (
      hasOwn("businessName")
    ) {
      businessName =
        cleanString(
          body.businessName
        );
    }

    if (
      businessName !== undefined &&
      businessName.length > 500
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Business name is too long.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // CONTACT NAME
    // ========================================================

    let contactName;

    if (hasOwn("name")) {
      contactName =
        cleanString(
          body.name
        );
    } else if (
      hasOwn("contactName")
    ) {
      contactName =
        cleanString(
          body.contactName
        );
    } else if (
      hasOwn("contact_name")
    ) {
      contactName =
        cleanString(
          body.contact_name
        );
    }

    if (
      contactName !== undefined &&
      contactName.length > 500
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Contact name is too long.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // PHONE
    // ========================================================

    let phone;

    if (hasOwn("phone")) {
      phone = cleanString(
        body.phone
      );
    } else if (
      hasOwn("phone_number")
    ) {
      phone = cleanString(
        body.phone_number
      );
    } else if (
      hasOwn("phoneNumber")
    ) {
      phone = cleanString(
        body.phoneNumber
      );
    }

    if (
      phone !== undefined &&
      phone.length > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number is too long.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // CHECK EDITABLE FIELDS
    // ========================================================

    if (
      assignmentDate === undefined &&
      employeeId === undefined &&
      status === undefined &&
      comment === undefined &&
      businessName === undefined &&
      contactName === undefined &&
      phone === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No editable fields were provided.",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    // ========================================================
    // UPDATE DAILY ASSIGNMENT
    // ========================================================

    const assignmentUpdates = [];
    const assignmentParams = [];

    if (
      assignmentDate !== undefined
    ) {
      assignmentUpdates.push(
        "assignment_date = ?"
      );

      assignmentParams.push(
        assignmentDate
      );
    }

    if (
      employeeId !== undefined
    ) {
      assignmentUpdates.push(
        "employee_id = ?"
      );

      assignmentParams.push(
        employeeId
      );
    }

    if (status !== undefined) {
      assignmentUpdates.push(
        "status = ?"
      );

      assignmentParams.push(
        status
      );

      // ------------------------------------------------------
      // AUTO COMPLETION
      // ------------------------------------------------------

      const normalizedStatus =
        status
          .trim()
          .toLowerCase();

      const completedStatuses = [
        "completed",
        "complete",
        "done",
      ];

      const isCompleted =
        completedStatuses.includes(
          normalizedStatus
        );

      assignmentUpdates.push(
        "is_completed = ?"
      );

      assignmentParams.push(
        isCompleted ? 1 : 0
      );
    }

    if (
      comment !== undefined
    ) {
      assignmentUpdates.push(
        "comment = ?"
      );

      assignmentParams.push(
        comment || null
      );
    }

    // ========================================================
    // SAVE ASSIGNMENT
    // ========================================================

    if (
      assignmentUpdates.length > 0
    ) {
      assignmentParams.push(
        assignmentId
      );

      await query(
        `
          UPDATE daily_assignments
          SET
            ${assignmentUpdates.join(
              ", "
            )}
          WHERE id = ?
          LIMIT 1
        `,
        assignmentParams
      );
    }

    // ========================================================
    // UPDATE MASTER TASK
    // ========================================================

    const taskUpdates = [];
    const taskParams = [];

    if (
      businessName !== undefined
    ) {
      taskUpdates.push(
        "business_name = ?"
      );

      taskParams.push(
        businessName || null
      );
    }

    if (
      contactName !== undefined
    ) {
      taskUpdates.push(
        "name = ?"
      );

      taskParams.push(
        contactName || null
      );
    }

    if (phone !== undefined) {
      taskUpdates.push(
        "phone_number = ?"
      );

      taskParams.push(
        phone || null
      );
    }

    // ========================================================
    // SAVE MASTER TASK
    // ========================================================

    if (
      taskUpdates.length > 0
    ) {
      taskParams.push(taskId);

      await query(
        `
          UPDATE master_tasks
          SET
            ${taskUpdates.join(
              ", "
            )}
          WHERE id = ?
          LIMIT 1
        `,
        taskParams
      );
    }

    // ========================================================
    // FETCH UPDATED RECORD
    // ========================================================

    const updatedRows =
      await query(
        `
          SELECT

            /* ==================================================
               ASSIGNMENT
            ================================================== */

            da.id AS id,

            da.id AS assignment_id,

            da.id AS daily_assignment_id,

            da.task_id AS assignment_task_id,

            da.task_id AS assignmentTaskId,

            da.employee_id AS employee_id,

            da.employee_id AS employeeId,

            da.employee_id AS assigned_employee_id,

            da.employee_id AS assignedEmployeeId,

            /* ==================================================
               DATE
            ================================================== */

            da.assignment_date AS assignment_date,

            da.assignment_date AS assignmentDate,

            DATE(da.assignment_date) AS assignedDate,

            DATE(da.assignment_date) AS assignmentDateOnly,

            DATE(da.assignment_date) AS task_date,

            DATE(da.assignment_date) AS taskDate,

            DATE(da.assignment_date) AS date,

            /* ==================================================
               CREATED
               updated_at REMOVED
            ================================================== */

            da.created_at AS created_at,

            da.created_at AS createdAt,

            /* ==================================================
               STATUS
            ================================================== */

            da.status AS status,

            da.status AS assignment_status,

            da.status AS assignmentStatus,

            da.status AS assignment_status_name,

            da.status AS selected_status,

            da.status AS selectedStatus,

            da.status AS result,

            da.status AS result_status,

            da.status AS task_status,

            da.status AS taskStatus,

            da.status AS call_status,

            da.status AS callStatus,

            da.status AS disposition,

            da.status AS outcome,

            da.status AS current_status,

            da.status AS selected_result,

            /* ==================================================
               COMMENT
            ================================================== */

            da.comment AS comment,

            da.comment AS comments,

            da.comment AS notes,

            da.comment AS task_comment,

            da.comment AS taskComment,

            /* ==================================================
               COMPLETION
            ================================================== */

            da.is_completed AS is_completed,

            da.is_completed AS isCompleted,

            /* ==================================================
               MASTER TASK
            ================================================== */

            mt.id AS taskId,

            mt.id AS task_id,

            mt.id AS master_task_id,

            mt.id AS masterTaskId,

            mt.name AS name,

            mt.name AS contactName,

            mt.name AS contact_name,

            mt.phone_number AS phone,

            mt.phone_number AS phoneNumber,

            mt.phone_number AS phone_number,

            mt.business_name AS businessName,

            mt.business_name AS business_name,

            mt.current_status AS master_current_status,

            mt.is_locked AS is_locked,

            /* ==================================================
               USER
            ================================================== */

            u.id AS staffId,

            u.id AS staff_id,

            u.id AS userId,

            u.name AS assignedToName,

            u.name AS assigned_to,

            u.name AS employeeName,

            u.name AS employee_name,

            u.name AS staffName,

            u.name AS staff_name,

            u.name AS userName,

            u.name AS user_name,

            u.email AS staffEmail,

            u.email AS employeeEmail,

            u.email AS userEmail,

            u.email AS email,

            u.role AS staffRole,

            u.role AS employeeRole,

            u.role AS userRole

          FROM daily_assignments da

          LEFT JOIN master_tasks mt
            ON da.task_id = mt.id

          LEFT JOIN users u
            ON da.employee_id = u.id

          WHERE da.id = ?

          LIMIT 1
        `,
        [assignmentId]
      );

    const updatedRecord =
      Array.isArray(updatedRows) &&
      updatedRows.length > 0
        ? updatedRows[0]
        : null;

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Report record updated successfully.",

        data:
          updatedRecord,

        updated: {
          assignment_id:
            assignmentId,

          task_id:
            taskId,

          employee_id:
            employeeId ??
            assignment.employee_id,

          assignment_date:
            assignmentDate ??
            assignment.assignment_date ??
            null,

          status:
            status ??
            assignment.status ??
            null,

          comment:
            comment ??
            assignment.comment ??
            null,

          business_name:
            businessName ??
            taskRows[0]
              ?.business_name ??
            null,

          name:
            contactName ??
            taskRows[0]?.name ??
            null,

          phone:
            phone ??
            taskRows[0]?.phone_number ??
            null,

          updated_by:
            currentUserId,
        },
      },
      {
        status: 200,
        headers: noCacheHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "ADMIN HISTORY PUT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to update report record.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? String(error)
            : undefined,
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}