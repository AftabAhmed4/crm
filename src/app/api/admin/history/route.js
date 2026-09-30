// import { NextResponse } from "next/server";
// import { query } from "../../../lib/db";
// import jwt from "jsonwebtoken";

// /*
// ============================================================
// ADMIN HISTORY / REPORTS API
// ============================================================

// ROLE RULE
// ------------------------------------------------------------
// ADMIN
// -----
// Admin / Administrator / Superadmin:
//     -> ALL employees ke records dekh sakta hai.

// NORMAL USER / EMPLOYEE
// ----------------------
// Normal employee:
//     -> Sirf apne records dekh sakta hai.

// SECURITY
// ------------------------------------------------------------
// Filtering DATABASE level par hoti hai.

// Frontend se employee ID bhejne ki zaroorat nahi.

// Normal user ke liye:
//     WHERE da.employee_id = loggedInUserId

// Admin ke liye:
//     koi employee restriction nahi.

// SOURCE OF TRUTH
// ------------------------------------------------------------

// daily_assignments
//     status
//     comment
//     is_completed
//     assignment_date
//     employee_id
//     task_id

// master_tasks
//     name
//     phone_number
//     business_name
//     sequence_no

// users
//     employee information
//     role

// IMPORTANT
// ------------------------------------------------------------

// Employee PATCH jab status save karta hai:

// daily_assignments.status

// Aur comment save karta hai:

// daily_assignments.comment

// Isliye Reports API hamesha exact status/comment
// daily_assignments se read karti hai.

// ============================================================
// */

// export async function GET(request) {
//   try {
//     // ======================================================
//     // REQUEST
//     // ======================================================

//     const { searchParams } = new URL(request.url);

//     const dateStr = searchParams.get("date");

//     // ======================================================
//     // DATE VALIDATION
//     // ======================================================

//     if (
//       dateStr &&
//       !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Invalid date format. Use YYYY-MM-DD.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     // ======================================================
//     // GET LOGIN TOKEN
//     // ======================================================

//     const token = request.cookies.get("token")?.value;

//     if (!token) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Unauthorized. Please login again.",
//         },
//         {
//           status: 401,
//         }
//       );
//     }

//     // ======================================================
//     // VERIFY JWT
//     // ======================================================

//     let decoded;

//     try {
//       decoded = jwt.verify(
//         token,
//         process.env.JWT_SECRET
//       );
//     } catch (authError) {
//       console.error(
//         "ADMIN HISTORY JWT ERROR:",
//         authError
//       );

//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Invalid or expired login session.",
//         },
//         {
//           status: 401,
//         }
//       );
//     }

//     // ======================================================
//     // GET LOGGED-IN USER ID
//     // ======================================================

//     const currentUserId =
//       decoded?.id ??
//       decoded?._id ??
//       decoded?.userId ??
//       decoded?.user_id;

//     if (!currentUserId) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "User ID not found in login session.",
//         },
//         {
//           status: 401,
//         }
//       );
//     }

//     // ======================================================
//     // GET CURRENT USER
//     // ======================================================

//     const currentUsers = await query(
//       `
//         SELECT
//           id,
//           name,
//           email,
//           role
//         FROM users
//         WHERE id = ?
//         LIMIT 1
//       `,
//       [currentUserId]
//     );

//     if (
//       !Array.isArray(currentUsers) ||
//       currentUsers.length === 0
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Logged-in user was not found.",
//         },
//         {
//           status: 401,
//         }
//       );
//     }

//     const currentUser = currentUsers[0];

//     // ======================================================
//     // NORMALIZE ROLE
//     // ======================================================

//     const role = String(
//       currentUser?.role || ""
//     )
//       .trim()
//       .toLowerCase();

//     // ======================================================
//     // ADMIN ROLES
//     // ======================================================

//     const isAdmin =
//       role === "admin" ||
//       role === "administrator" ||
//       role === "superadmin" ||
//       role === "super_admin";

//     // ======================================================
//     // BASE SQL
//     // ======================================================

//     let sql = `
//       SELECT

//         /* ==================================================
//            DAILY ASSIGNMENT
//         ================================================== */

//         da.id AS id,

//         da.id AS assignment_id,

//         da.id AS daily_assignment_id,

//         da.assignment_date AS assignmentDate,

//         DATE(da.assignment_date) AS assignedDate,

//         da.assignment_date AS assignment_date,

//         da.updated_at AS updatedAt,

//         da.updated_at AS updated_at,

//         da.created_at AS createdAt,

//         da.created_at AS created_at,

//         /* ==================================================
//            EMPLOYEE ID
//         ================================================== */

//         da.employee_id AS employee_id,

//         da.employee_id AS assigned_employee_id,

//         /* ==================================================
//            EXACT USER SELECTED STATUS
//         ================================================== */

//         da.status AS status,

//         da.status AS assignment_status,

//         da.status AS assignment_status_name,

//         da.status AS selected_status,

//         da.status AS selectedStatus,

//         da.status AS result,

//         da.status AS result_status,

//         da.status AS task_status,

//         da.status AS call_status,

//         da.status AS disposition,

//         da.status AS outcome,

//         da.status AS current_status,

//         /* ==================================================
//            EXACT USER COMMENT
//         ================================================== */

//         da.comment AS comment,

//         da.comment AS comments,

//         da.comment AS notes,

//         /* ==================================================
//            COMPLETION
//         ================================================== */

//         da.is_completed AS is_completed,

//         /* ==================================================
//            MASTER TASK
//         ================================================== */

//         mt.id AS taskId,

//         mt.id AS task_id,

//         mt.id AS master_task_id,

//         mt.sequence_no AS sequenceNo,

//         mt.sequence_no AS sequence_no,

//         mt.name AS name,

//         mt.name AS contactName,

//         mt.name AS contact_name,

//         mt.phone_number AS phone,

//         mt.phone_number AS phoneNumber,

//         mt.phone_number AS phone_number,

//         mt.business_name AS businessName,

//         mt.business_name AS business_name,

//         mt.current_status AS master_current_status,

//         mt.is_locked AS is_locked,

//         /* ==================================================
//            STAFF / EMPLOYEE
//         ================================================== */

//         u.id AS staffId,

//         u.id AS employeeId,

//         u.id AS userId,

//         u.id AS staff_id,

//         u.id AS employee_id_user,

//         u.name AS assignedToName,

//         u.name AS employeeName,

//         u.name AS staffName,

//         u.name AS userName,

//         u.name AS user_name,

//         u.email AS staffEmail,

//         u.email AS employeeEmail,

//         u.email AS userEmail,

//         u.role AS staffRole,

//         u.role AS employeeRole,

//         u.role AS userRole

//       FROM daily_assignments da

//       INNER JOIN master_tasks mt
//         ON da.task_id = mt.id

//       INNER JOIN users u
//         ON da.employee_id = u.id
//     `;

//     // ======================================================
//     // WHERE CONDITIONS
//     // ======================================================

//     const where = [];
//     const params = [];

//     // ======================================================
//     // NORMAL EMPLOYEE
//     // ======================================================
//     //
//     // Employee ko sirf apne records milenge.
//     //
//     // Example:
//     //
//     // Logged-in employee ID = 7
//     //
//     // WHERE da.employee_id = 7
//     //
//     // ======================================================

//     if (!isAdmin) {
//       where.push(
//         `da.employee_id = ?`
//       );

//       params.push(currentUserId);
//     }

//     // ======================================================
//     // DATE FILTER
//     // ======================================================

//     if (dateStr) {
//       where.push(
//         `DATE(da.assignment_date) = ?`
//       );

//       params.push(dateStr);
//     }

//     // ======================================================
//     // ADD WHERE CLAUSE
//     // ======================================================

//     if (where.length > 0) {
//       sql += `
//         WHERE ${where.join(" AND ")}
//       `;
//     }

//     // ======================================================
//     // ORDER
//     // ======================================================

//     sql += `
//       ORDER BY
//         da.assignment_date DESC,
//         da.updated_at DESC,
//         da.id DESC
//     `;

//     // ======================================================
//     // DATABASE QUERY
//     // ======================================================

//     const tasks = await query(
//       sql,
//       params
//     );

//     // ======================================================
//     // NORMALIZE DATA
//     // ======================================================

//     const normalizedTasks = Array.isArray(tasks)
//       ? tasks.map((row) => {
//           // ----------------------------------------------
//           // EXACT STATUS
//           // ----------------------------------------------

//           const exactStatus =
//             row?.status !== null &&
//             row?.status !== undefined
//               ? String(row.status).trim()
//               : "";

//           // ----------------------------------------------
//           // EXACT COMMENT
//           // ----------------------------------------------

//           const exactComment =
//             row?.comment !== null &&
//             row?.comment !== undefined
//               ? String(row.comment).trim()
//               : "";

//           // ----------------------------------------------
//           // RETURN
//           // ----------------------------------------------

//           return {
//             ...row,

//             // ============================================
//             // STATUS
//             // ============================================

//             status: exactStatus,

//             assignment_status:
//               exactStatus,

//             assignment_status_name:
//               exactStatus,

//             selected_status:
//               exactStatus,

//             selectedStatus:
//               exactStatus,

//             result:
//               exactStatus,

//             result_status:
//               exactStatus,

//             task_status:
//               exactStatus,

//             call_status:
//               exactStatus,

//             disposition:
//               exactStatus,

//             outcome:
//               exactStatus,

//             current_status:
//               exactStatus,

//             // ============================================
//             // COMMENT
//             // ============================================

//             comment:
//               exactComment || null,

//             comments:
//               exactComment || null,

//             notes:
//               exactComment || null,

//             // ============================================
//             // COMPLETION
//             // ============================================

//             is_completed:
//               Number(
//                 row?.is_completed || 0
//               ),
//           };
//         })
//       : [];

//     // ======================================================
//     // RESPONSE
//     // ======================================================

//     return NextResponse.json(
//       {
//         success: true,

//         data: normalizedTasks,

//         count: normalizedTasks.length,

//         date: dateStr || null,

//         timezone:
//           "America/Los_Angeles",

//         source:
//           "daily_assignments",

//         // ==================================================
//         // CURRENT VIEWER
//         // ==================================================

//         viewer: {
//           id: currentUser.id,

//           name:
//             currentUser.name || "",

//           email:
//             currentUser.email || "",

//           role:
//             currentUser.role || "",

//           isAdmin,
//         },
//       },
//       {
//         status: 200,

//         headers: {
//           "Cache-Control":
//             "no-store, no-cache, must-revalidate, proxy-revalidate",
//           Pragma: "no-cache",
//           Expires: "0",
//         },
//       }
//     );
//   } catch (error) {
//     // ======================================================
//     // ERROR
//     // ======================================================

//     console.error(
//       "ADMIN HISTORY ERROR:",
//       error
//     );

//     return NextResponse.json(
//       {
//         success: false,

//         message:
//           error?.message ||
//           "Failed to fetch admin history",
//       },
//       {
//         status: 500,
//       }
//     );
//   }
// }



import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // =====================================================
    // QUERY PARAMS
    // =====================================================

    const { searchParams } = new URL(request.url);

    const dateStr = String(
      searchParams.get("date") || ""
    ).trim();

    const fromDate = String(
      searchParams.get("from") || ""
    ).trim();

    const toDate = String(
      searchParams.get("to") || ""
    ).trim();

    // =====================================================
    // DATE VALIDATOR
    // =====================================================

    function isValidDate(value) {
      if (!value) return true;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const [year, month, day] = value
        .split("-")
        .map(Number);

      const d = new Date(
        Date.UTC(year, month - 1, day)
      );

      return (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
      );
    }

    if (
      !isValidDate(dateStr) ||
      !isValidDate(fromDate) ||
      !isValidDate(toDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          success: false,
          message: "From date cannot be greater than To date.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // AUTH TOKEN
    // =====================================================

    const token =
      request.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please login again.",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // VERIFY JWT
    // =====================================================

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

      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired login session.",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // CURRENT USER ID
    // =====================================================

    const currentUserId =
      decoded?.id ??
      decoded?.userId ??
      decoded?.user_id ??
      decoded?._id;

    if (!currentUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID not found in token.",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // CURRENT USER
    // =====================================================

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
      return NextResponse.json(
        {
          success: false,
          message: "Logged-in user was not found.",
        },
        { status: 401 }
      );
    }

    const currentUser = users[0];

    // =====================================================
    // ROLE
    // =====================================================

    const role = String(
      currentUser?.role || ""
    )
      .trim()
      .toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "administrator" ||
      role === "superadmin" ||
      role === "super_admin";

    // =====================================================
    // MAIN QUERY
    //
    // IMPORTANT:
    // LEFT JOIN means history will NOT disappear if
    // master_tasks or users record is missing.
    // =====================================================

    let sql = `
      SELECT

        /* =================================================
           DAILY ASSIGNMENT
        ================================================= */

        da.id AS id,

        da.id AS assignment_id,

        da.id AS daily_assignment_id,

        da.task_id AS assignment_task_id,

        da.task_id AS assignmentTaskId,

        da.employee_id AS employee_id,

        da.employee_id AS employeeId,

        da.employee_id AS assigned_employee_id,

        da.employee_id AS assignedEmployeeId,

        /* =================================================
           DATE
        ================================================= */

        da.assignment_date AS assignment_date,

        da.assignment_date AS assignmentDate,

        DATE(da.assignment_date) AS assignedDate,

        DATE(da.assignment_date) AS assignmentDateOnly,

        DATE(da.assignment_date) AS task_date,

        DATE(da.assignment_date) AS taskDate,

        DATE(da.assignment_date) AS date,

        /* =================================================
           TIME
        ================================================= */

        da.created_at AS created_at,

        da.created_at AS createdAt,

        da.updated_at AS updated_at,

        da.updated_at AS updatedAt,

        /* =================================================
           EMPLOYEE SELECTED STATUS
           THIS IS THE MAIN STATUS
        ================================================= */

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

        /* =================================================
           EMPLOYEE COMMENT
        ================================================= */

        da.comment AS comment,

        da.comment AS comments,

        da.comment AS notes,

        da.comment AS task_comment,

        da.comment AS taskComment,

        /* =================================================
           COMPLETION
        ================================================= */

        da.is_completed AS is_completed,

        da.is_completed AS isCompleted,

        /* =================================================
           MASTER TASK
        ================================================= */

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

        /* =================================================
           USER / EMPLOYEE
        ================================================= */

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

    // =====================================================
    // WHERE
    // =====================================================

    const where = [];
    const params = [];

    // =====================================================
    // NORMAL USER
    // ONLY OWN HISTORY
    // =====================================================

    if (!isAdmin) {
      where.push(
        `da.employee_id = ?`
      );

      params.push(currentUserId);
    }

    // =====================================================
    // SINGLE DATE
    // ?date=2026-09-30
    // =====================================================

    if (dateStr) {
      where.push(
        `DATE(da.assignment_date) = ?`
      );

      params.push(dateStr);
    }

    // =====================================================
    // FROM DATE
    // ?from=2026-09-01
    // =====================================================

    if (fromDate) {
      where.push(
        `DATE(da.assignment_date) >= ?`
      );

      params.push(fromDate);
    }

    // =====================================================
    // TO DATE
    // ?to=2026-09-30
    // =====================================================

    if (toDate) {
      where.push(
        `DATE(da.assignment_date) <= ?`
      );

      params.push(toDate);
    }

    // =====================================================
    // APPLY WHERE
    // =====================================================

    if (where.length > 0) {
      sql += `
        WHERE ${where.join(" AND ")}
      `;
    }

    // =====================================================
    // ORDER
    // =====================================================

    sql += `
      ORDER BY
        da.assignment_date DESC,
        da.updated_at DESC,
        da.id DESC
    `;

    // =====================================================
    // DATABASE QUERY
    // =====================================================

    const rows = await query(
      sql,
      params
    );

    // =====================================================
    // NORMALIZE RESPONSE
    // =====================================================

    const normalizedTasks =
      Array.isArray(rows)
        ? rows.map((row) => {

            const status =
              row?.status === null ||
              row?.status === undefined
                ? ""
                : String(row.status).trim();

            const comment =
              row?.comment === null ||
              row?.comment === undefined
                ? ""
                : String(row.comment).trim();

            return {
              ...row,

              // ===========================================
              // DATE
              // ===========================================

              assignment_date:
                row?.assignment_date || null,

              assignmentDate:
                row?.assignmentDate ||
                row?.assignment_date ||
                null,

              assignedDate:
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

              // ===========================================
              // STATUS
              // ===========================================

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

              // ===========================================
              // COMMENT
              // ===========================================

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

              // ===========================================
              // COMPLETED
              // ===========================================

              is_completed:
                Number(
                  row?.is_completed ?? 0
                ),

              isCompleted:
                Number(
                  row?.is_completed ?? 0
                ),

              // ===========================================
              // EMPLOYEE
              // ===========================================

              employee_id:
                row?.employee_id ?? null,

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

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        success: true,

        // Main
        data: normalizedTasks,

        // Compatibility
        records: normalizedTasks,

        history: normalizedTasks,

        tasks: normalizedTasks,

        count:
          normalizedTasks.length,

        // Filters
        date:
          dateStr || null,

        from:
          fromDate || null,

        to:
          toDate || null,

        // Information
        source:
          "daily_assignments",

        timezone:
          "America/Los_Angeles",

        // Viewer
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

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "Surrogate-Control":
            "no-store",
        },
      }
    );

  } catch (error) {
    console.error(
      "ADMIN HISTORY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to fetch admin history",

        error:
          process.env.NODE_ENV === "development"
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