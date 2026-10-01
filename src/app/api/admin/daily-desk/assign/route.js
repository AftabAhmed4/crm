

import { NextResponse } from "next/server";
import pool from "../../../../lib/db";

// =====================================================
// CALIFORNIA DATE HELPER
// =====================================================

function getCaliforniaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// =====================================================
// PHONE NORMALIZER
//
// Examples:
//
// 15551234567  -> 5551234567
// 5551234567   -> 5551234567
// (555) 123-4567 -> 5551234567
//
// Is se different formatting wale same numbers
// duplicate count nahi honge.
// =====================================================

function normalizePhone(phone) {
  if (phone === null || phone === undefined) {
    return "";
  }

  let digits = String(phone).replace(/\D/g, "");

  // US country code remove
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.substring(1);
  }

  return digits;
}

// =====================================================
// 1. GET API
// Date Wise Daily Desk History
// =====================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const dateParam = searchParams.get("date");

    const californiaDate = getCaliforniaDate();

    const targetDate = dateParam || californiaDate;

    // =================================================
    // DATE VALIDATION
    // =================================================

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid date. Format YYYY-MM-DD hona chahiye.",
        },
        { status: 400 }
      );
    }

    // =================================================
    // FETCH DAILY DESK HISTORY
    // =================================================

    const [rows] = await pool.execute(
      `
      SELECT
        dda.id AS assignment_id,

        ddt.task_id AS taskId,
        ddt.phone,
        ddt.source_file AS sourceFile,

        u.id AS staffId,
        u.name AS staffName,
        u.email AS staffEmail,

        dda.assigned_date AS assignedDate,
        dda.assigned_at AS assignedAt,
        dda.completed_at AS completedAt,
        dda.status

      FROM daily_desk_assignments dda

      INNER JOIN daily_desk_tasks ddt
        ON dda.task_id = ddt.id

      INNER JOIN users u
        ON dda.staff_id = u.id

      WHERE DATE(dda.assigned_date) = ?

      ORDER BY dda.assigned_at DESC
      `,
      [targetDate]
    );

    // =================================================
    // REMOVE DUPLICATES FROM HISTORY RESPONSE
    //
    // Same phone same date = only one UI record.
    //
    // Ye existing old duplicate records ko database se
    // delete nahi karta. Sirf GET response mein duplicate
    // hide karta hai.
    // =================================================

    const uniqueRows = [];
    const seenPhones = new Set();

    for (const row of rows) {
      const phoneKey = normalizePhone(row.phone);

      if (!phoneKey) {
        uniqueRows.push(row);
        continue;
      }

      if (seenPhones.has(phoneKey)) {
        continue;
      }

      seenPhones.add(phoneKey);
      uniqueRows.push(row);
    }

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      timezone: "America/Los_Angeles",

      californiaDate,

      date: targetDate,

      count: uniqueRows.length,

      totalDatabaseRows: rows.length,

      duplicatesRemoved:
        rows.length - uniqueRows.length,

      data: uniqueRows,
    });
  } catch (error) {
    console.error(
      "DAILY DESK HISTORY FETCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error.message ||
          "Database se data fetch nahi ho saka.",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// 2. POST API
// Assign / Save Daily Desk Tasks
//
// DUPLICATE PROTECTION:
//
// Same phone:
// - same date
// - same staff
//
// => dobara assignment create nahi hogi.
//
// Also input ke andar duplicate phone numbers remove
// honge before inserting.
// =====================================================

export async function POST(request) {
  const connection = await pool.getConnection();

  try {
    const body = await request.json();

    const {
      numbers = [],
      selectedStaff = [],
      distribution = "equal",
      sourceFile = null,
    } = body;

    // =================================================
    // CALIFORNIA BUSINESS DATE
    // =================================================

    const californiaDate = getCaliforniaDate();

    console.log(
      "DAILY DESK CALIFORNIA DATE:",
      californiaDate
    );

    // =================================================
    // VALIDATION
    // =================================================

    if (!Array.isArray(numbers) || !numbers.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Numbers nahi mile.",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(selectedStaff) ||
      !selectedStaff.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff select nahi kiya gaya.",
        },
        { status: 400 }
      );
    }

    // =================================================
    // START TRANSACTION
    // =================================================

    await connection.beginTransaction();

    let tasksSaved = 0;
    let assignmentsSaved = 0;

    let duplicateInputSkipped = 0;
    let duplicateDatabaseSkipped = 0;
    let invalidSkipped = 0;

    // =================================================
    // MAX UNIQUE DAILY NUMBERS
    //
    // Daily Desk mein maximum 500 UNIQUE numbers.
    // =================================================

    const MAX_DAILY_TASKS = 500;

    // =================================================
    // STEP 1:
    // CLEAN + DEDUPLICATE INPUT NUMBERS
    // =================================================

    const uniqueNumbers = [];
    const inputPhoneKeys = new Set();

    for (const item of numbers) {
      if (!item?.phone) {
        invalidSkipped++;
        continue;
      }

      if (!item?.taskId) {
        invalidSkipped++;
        continue;
      }

      const phoneKey = normalizePhone(item.phone);

      if (!phoneKey) {
        invalidSkipped++;
        continue;
      }

      // -----------------------------------------------
      // INPUT DUPLICATE CHECK
      // -----------------------------------------------

      if (inputPhoneKeys.has(phoneKey)) {
        duplicateInputSkipped++;

        console.log(
          `DUPLICATE INPUT SKIPPED: ${phoneKey}`
        );

        continue;
      }

      inputPhoneKeys.add(phoneKey);

      uniqueNumbers.push({
        ...item,
        phoneKey,
      });

      // -----------------------------------------------
      // Only first 500 unique numbers
      // -----------------------------------------------

      if (uniqueNumbers.length >= MAX_DAILY_TASKS) {
        break;
      }
    }

    // =================================================
    // NO UNIQUE NUMBERS
    // =================================================

    if (!uniqueNumbers.length) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Koi unique valid phone number nahi mila.",
        },
        { status: 400 }
      );
    }

    console.log(
      "UNIQUE INPUT NUMBERS:",
      uniqueNumbers.length
    );

    console.log(
      "DUPLICATE INPUT SKIPPED:",
      duplicateInputSkipped
    );

    // =================================================
    // TRACK TASK COUNT PER STAFF
    //
    // Example:
    //
    // {
    //   1: 167,
    //   2: 167,
    //   3: 166
    // }
    // =================================================

    const assignedTaskCounts = {};

    // =================================================
    // TRACK STAFF PHONE ASSIGNMENTS
    //
    // Important:
    //
    // Same phone + same staff + same date
    // should never be inserted again.
    // =================================================

    const staffPhoneKeys = new Set();

    // =================================================
    // STEP 2:
    // PROCESS UNIQUE NUMBERS
    // =================================================

    for (
      let index = 0;
      index < uniqueNumbers.length;
      index++
    ) {
      const item = uniqueNumbers[index];

      // =================================================
      // STAFF DISTRIBUTION
      // =================================================

      const staffId =
        selectedStaff[
          index % selectedStaff.length
        ];

      if (!staffId) {
        invalidSkipped++;
        continue;
      }

      const phoneKey = item.phoneKey;

      // =================================================
      // SAME STAFF + SAME PHONE
      // =================================================

      const staffPhoneKey =
        `${Number(staffId)}:${phoneKey}`;

      if (staffPhoneKeys.has(staffPhoneKey)) {
        duplicateInputSkipped++;

        console.log(
          `DUPLICATE STAFF PHONE SKIPPED: staff=${staffId}, phone=${phoneKey}`
        );

        continue;
      }

      // =================================================
      // CHECK DATABASE
      //
      // Kya ye phone already isi staff ko isi date par
      // assigned hai?
      // =================================================

      const [existingAssignments] =
        await connection.execute(
          `
          SELECT
            dda.id,
            dda.task_id,
            ddt.phone
          FROM daily_desk_assignments dda

          INNER JOIN daily_desk_tasks ddt
            ON dda.task_id = ddt.id

          WHERE dda.staff_id = ?
            AND DATE(dda.assigned_date) = ?
            AND REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(ddt.phone, ' ', ''),
                        '-',
                        ''
                      ),
                      '(',
                      ''
                    ),
                    ')',
                    ''
                  ),
                  '+',
                  ''
                ) LIKE ?
          LIMIT 1
          `,
          [
            staffId,
            californiaDate,
            `%${phoneKey}`,
          ]
        );

      // =================================================
      // DATABASE DUPLICATE FOUND
      // =================================================

      if (existingAssignments.length > 0) {
        duplicateDatabaseSkipped++;

        console.log(
          `DATABASE DUPLICATE SKIPPED: staff=${staffId}, phone=${phoneKey}`
        );

        staffPhoneKeys.add(staffPhoneKey);

        continue;
      }

      // =================================================
      // 1. SAVE TASK
      // =================================================

      const [taskResult] =
        await connection.execute(
          `
          INSERT INTO daily_desk_tasks
          (
            task_id,
            phone,
            source_file,
            task_date
          )
          VALUES (?, ?, ?, ?)
          `,
          [
            item.taskId,
            item.phone,
            sourceFile,
            californiaDate,
          ]
        );

      const taskDatabaseId =
        taskResult.insertId;

      tasksSaved++;

      // =================================================
      // 2. SAVE ASSIGNMENT
      // =================================================

      await connection.execute(
        `
        INSERT INTO daily_desk_assignments
        (
          task_id,
          staff_id,
          assigned_date,
          status
        )
        VALUES (?, ?, ?, 'Pending')
        `,
        [
          taskDatabaseId,
          staffId,
          californiaDate,
        ]
      );

      assignmentsSaved++;

      // =================================================
      // MARK PHONE AS ASSIGNED
      // =================================================

      staffPhoneKeys.add(staffPhoneKey);

      // =================================================
      // COUNT TASKS FOR STAFF
      // =================================================

      assignedTaskCounts[staffId] =
        (assignedTaskCounts[staffId] || 0) + 1;
    }

    // =================================================
    // CHECK IF ANY TASK WAS ACTUALLY SAVED
    // =================================================

    if (assignmentsSaved === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,

          message:
            "Koi new unique task assignment save nahi hui.",

          data: {
            duplicateInputSkipped,
            duplicateDatabaseSkipped,
            invalidSkipped,
          },
        },
        { status: 400 }
      );
    }

    // =================================================
    // CREATE ONE NOTIFICATION PER STAFF
    //
    // 500 tasks = 1 notification
    //
    // NOT 500 notifications.
    // =================================================

    for (const [staffId, taskCount] of Object.entries(
      assignedTaskCounts
    )) {
      const numericStaffId = Number(staffId);
      const numericTaskCount = Number(taskCount);

      if (
        !numericStaffId ||
        numericTaskCount <= 0
      ) {
        continue;
      }

      await connection.execute(
        `
        INSERT INTO notifications
        (
          user_id,
          title,
          message,
          type,
          is_read,
          created_at
        )
        VALUES (?, ?, ?, ?, 0, NOW())
        `,
        [
          numericStaffId,
          "New Daily Tasks Assigned",
          `You have been assigned ${numericTaskCount} new daily tasks for today.`,
          "task",
        ]
      );

      console.log(
        `TASK NOTIFICATION CREATED: staff=${numericStaffId}, tasks=${numericTaskCount}`
      );
    }

    // =================================================
    // COMMIT
    // =================================================

    await connection.commit();

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Daily Desk tasks successfully saved. Duplicate numbers were skipped.",

      timezone:
        "America/Los_Angeles",

      californiaDate,

      data: {
        tasksSaved,

        assignmentsSaved,

        staffCount:
          selectedStaff.length,

        distribution,

        maxDailyUniqueTasks:
          MAX_DAILY_TASKS,

        uniqueInputNumbers:
          uniqueNumbers.length,

        duplicateInputSkipped,

        duplicateDatabaseSkipped,

        invalidSkipped,

        notificationsCreated:
          Object.values(
            assignedTaskCounts
          ).filter(
            (count) => Number(count) > 0
          ).length,

        assignedTaskCounts,
      },
    });
  } catch (error) {
    // =================================================
    // ROLLBACK
    // =================================================

    try {
      await connection.rollback();
    } catch {}

    console.error(
      "DAILY DESK DATABASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error.message ||
          "Database mein data save nahi ho saka.",
      },
      { status: 500 }
    );
  } finally {
    // =================================================
    // RELEASE CONNECTION
    // =================================================

    connection.release();
  }
}
