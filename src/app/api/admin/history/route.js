// import { NextResponse } from "next/server";
// import { connectDB } from "../../../lib/db"; // Apne DB connection helper ka path check kar lein
// import Task from "@/models/Task"; // Apne Task Mongoose model ka path check kar lein

// export async function GET(request) {
//   try {
//     await connectDB();

//     const { searchParams } = new URL(request.url);
//     const dateStr = searchParams.get("date"); // e.g. "2026-08-18"

//     let filter = {};

//     if (dateStr) {
//       // Puray din ki Start aur End range calculate karein (00:00:00 se 23:59:59 tak)
//       const startDate = new Date(dateStr);
//       startDate.setHours(0, 0, 0, 0);

//       const endDate = new Date(dateStr);
//       endDate.setHours(23, 59, 59, 999);

//       filter.createdAt = {
//         $gte: startDate,
//         $lte: endDate,
//       };
//     }

//     // Tasks retrieve karein aur latest tasks ko sab se upar rakhein
//     const tasks = await Task.find(filter)
//       .sort({ createdAt: -1 })
//       .lean();

//     return NextResponse.json({
//       success: true,
//       count: tasks.length,
//       data: tasks,
//     });
//   } catch (error) {
//     console.error("Error fetching daily tasks history:", error);
//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to fetch task history.",
//         error: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }

// import { NextResponse } from "next/server";
// import connectDB from "../../../lib/db"; // Ya jo bhi aap ka db path hai
// import Task from "../../../../model/Task";

// export async function GET(request) {
//   try {
//     // Check karein ki connectDB function hai ya object
//     if (typeof connectDB === "function") {
//       await connectDB();
//     } else if (connectDB && typeof connectDB.connectDB === "function") {
//       await connectDB.connectDB();
//     }

//     const { searchParams } = new URL(request.url);
//     const dateStr = searchParams.get("date");

//     let filter = {};

//     if (dateStr) {
//       const startDate = new Date(dateStr);
//       startDate.setHours(0, 0, 0, 0);

//       const endDate = new Date(dateStr);
//       endDate.setHours(23, 59, 59, 999);

//       filter.createdAt = {
//         $gte: startDate,
//         $lte: endDate,
//       };
//     }

//     const tasks = await Task.find(filter)
//       .sort({ createdAt: -1 })
//       .lean();

//     return NextResponse.json({
//       success: true,
//       count: tasks.length,
//       data: tasks,
//     });
//   } catch (error) {
//     console.error("Error fetching tasks history:", error);
//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to fetch task history.",
//         error: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }




// import { NextResponse } from "next/server";
// import { query } from "../../../lib/db";

// export async function GET(request) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const dateStr = searchParams.get("date"); // e.g. "2026-08-18"

//     let sql = `
//       SELECT 
//         dda.id AS id,
//         ddt.task_id AS taskId,
//         ddt.phone AS phone,
//         u.id AS staffId,
//         u.name AS assignedToName,
//         u.email AS staffEmail,
//         dda.assigned_date AS assignedDate,
//         dda.assigned_at AS createdAt,
//         dda.status AS status
//       FROM daily_desk_assignments dda
//       INNER JOIN daily_desk_tasks ddt ON dda.task_id = ddt.id
//       INNER JOIN users u ON dda.staff_id = u.id
//     `;

//     const params = [];

//     if (dateStr) {
//       sql += ` WHERE dda.assigned_date = ?`;
//       params.push(dateStr);
//     }

//     sql += ` ORDER BY dda.assigned_at DESC`;

//     const tasks = await query(sql, params);

//     return NextResponse.json({
//       success: true,
//       data: tasks,
//     });
//   } catch (error) {
//     console.error("Error fetching tasks history:", error);
//     return NextResponse.json(
//       { success: false, message: error.message },
//       { status: 500 }
//     );
//   }
// }


import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const dateStr = searchParams.get("date"); // YYYY-MM-DD

    let sql = `
      SELECT
        dda.id AS id,

        /* Daily Desk Task */
        ddt.id AS deskTaskId,
        ddt.task_id AS taskId,
        ddt.phone AS phone,

        /* Staff */
        u.id AS staffId,
        u.name AS assignedToName,
        u.email AS staffEmail,

        /* Assignment */
        DATE(dda.assigned_date) AS assignedDate,
        dda.assigned_at AS createdAt,

        /* User selected status */
        dda.status AS status

      FROM daily_desk_assignments dda

      INNER JOIN daily_desk_tasks ddt
        ON dda.task_id = ddt.id

      INNER JOIN users u
        ON dda.staff_id = u.id
    `;

    const params = [];

    /*
      Date filter
      Example:
      /api/admin/history?date=2026-09-30
    */
    if (dateStr) {
      sql += `
        WHERE DATE(dda.assigned_date) = ?
      `;

      params.push(dateStr);
    }

    sql += `
      ORDER BY
        dda.assigned_date DESC,
        dda.assigned_at DESC
    `;

    const tasks = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length,
      date: dateStr || null,
    });
  } catch (error) {
    console.error("Error fetching tasks history:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}

