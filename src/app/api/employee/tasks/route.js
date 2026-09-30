
import { NextResponse } from "next/server";
import db from "../../../lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";
const OPERATIONAL_DAY_START_HOUR = 7;
const DAILY_TASK_LIMIT = 500;

// ==================================================
// CALIFORNIA DATE + TIME
// ==================================================

function getCaliforniaDateTime() {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: CALIFORNIA_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
    }).formatToParts(now);

    const getPart = (type) =>
        parts.find((part) => part.type === type)?.value;

    return {
        year: Number(getPart("year")),
        month: Number(getPart("month")),
        day: Number(getPart("day")),
        hour: Number(getPart("hour")),
        minute: Number(getPart("minute")),
        second: Number(getPart("second")),
    };
}

// ==================================================
// CALIFORNIA DATE
// ==================================================

function getCaliforniaDate() {
    const ca = getCaliforniaDateTime();

    return (
        `${ca.year}-` +
        `${String(ca.month).padStart(2, "0")}-` +
        `${String(ca.day).padStart(2, "0")}`
    );
}

// ==================================================
// CALIFORNIA 24 HOUR TIME
// ==================================================

function getCaliforniaTime24() {
    const ca = getCaliforniaDateTime();

    return (
        `${String(ca.hour).padStart(2, "0")}:` +
        `${String(ca.minute).padStart(2, "0")}:` +
        `${String(ca.second).padStart(2, "0")}`
    );
}

// ==================================================
// CALIFORNIA AM / PM
// ==================================================

function getCaliforniaTime12() {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: CALIFORNIA_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).format(new Date());
}

// ==================================================
// OPERATIONAL DATE
//
// 12:00 AM - 06:59 AM
//       => PREVIOUS DAY
//
// 07:00 AM - 11:59 PM
//       => CURRENT DAY
// ==================================================

function getShiftOperationalDate() {
    const ca = getCaliforniaDateTime();

    let year = ca.year;
    let month = ca.month;
    let day = ca.day;

    if (ca.hour < OPERATIONAL_DAY_START_HOUR) {
        const previousDate = new Date(
            Date.UTC(year, month - 1, day)
        );

        previousDate.setUTCDate(
            previousDate.getUTCDate() - 1
        );

        year = previousDate.getUTCFullYear();
        month = previousDate.getUTCMonth() + 1;
        day = previousDate.getUTCDate();
    }

    return (
        `${year}-` +
        `${String(month).padStart(2, "0")}-` +
        `${String(day).padStart(2, "0")}`
    );
}

// ==================================================
// VALIDATE YYYY-MM-DD
// ==================================================

function isValidDate(date) {
    if (!date) return false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00Z`);

    return (
        parsed.getUTCFullYear() ===
            Number(date.substring(0, 4)) &&
        parsed.getUTCMonth() + 1 ===
            Number(date.substring(5, 7)) &&
        parsed.getUTCDate() ===
            Number(date.substring(8, 10))
    );
}

// ==================================================
// GET EMPLOYEE DAILY TASKS
// ==================================================

export async function GET(req) {
    try {
        // ==================================================
        // URL
        // ==================================================

        const { searchParams } = new URL(req.url);

        const selectedDate =
            searchParams.get("date");

        // ==================================================
        // DETERMINE OPERATIONAL DATE
        // ==================================================

        let date;

        if (selectedDate) {
            if (!isValidDate(selectedDate)) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Invalid date format. Use YYYY-MM-DD.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            date = selectedDate;
        } else {
            date = getShiftOperationalDate();
        }

        // ==================================================
        // AUTH
        // ==================================================

        const cookieStore = await cookies();

        const token =
            cookieStore.get("token")?.value;

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Login required",
                },
                {
                    status: 401,
                }
            );
        }

        // ==================================================
        // VERIFY JWT
        // ==================================================

        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (jwtError) {
            console.error(
                "JWT VERIFY ERROR:",
                jwtError
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid or expired login session",
                },
                {
                    status: 401,
                }
            );
        }

        // ==================================================
        // EMPLOYEE ID
        // ==================================================

        const employeeId =
            decoded.id ||
            decoded._id ||
            decoded.userId ||
            null;

        if (!employeeId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User ID not found",
                },
                {
                    status: 401,
                }
            );
        }

        // ==================================================
        // CALIFORNIA CURRENT INFO
        // ==================================================

        const californiaDate =
            getCaliforniaDate();

        const californiaTime24 =
            getCaliforniaTime24();

        const californiaTime12 =
            getCaliforniaTime12();

        // ==================================================
        // STEP 1
        // COUNT COMPLETED TASKS
        //
        // This is IMPORTANT.
        //
        // Daily quota = 500
        //
        // Example:
        //
        // 14 completed
        // 500 - 14 = 486 remaining
        //
        // 500 completed
        // 500 - 500 = 0 remaining
        // ==================================================

        const [completedRows] = await db.query(
            `
            SELECT
                COUNT(*) AS completed_today

            FROM daily_assignments da

            WHERE
                da.employee_id = ?
                AND da.assignment_date = ?
                AND da.is_completed = 1
            `,
            [
                employeeId,
                date,
            ]
        );

        const completedToday = Math.max(
            0,
            Number(
                completedRows?.[0]?.completed_today || 0
            )
        );

        // ==================================================
        // STEP 2
        // CALCULATE REMAINING DAILY QUOTA
        //
        // NEVER use tasks.length for this calculation.
        //
        // The quota is:
        //
        // 500 - completed
        // ==================================================

        const remainingQuota = Math.max(
            0,
            DAILY_TASK_LIMIT - completedToday
        );

        // ==================================================
        // STEP 3
        // FETCH ONLY REMAINING QUOTA TASKS
        //
        // Completed tasks:
        // is_completed = 1
        //
        // are excluded.
        //
        // Pending tasks:
        // is_completed = 0
        // OR NULL
        //
        // remain visible.
        // ==================================================

        let tasks = [];

        if (remainingQuota > 0) {
            const [taskRows] =
                await db.query(
                    `
                    SELECT
                        da.id AS assignment_id,

                        da.assignment_date,

                        da.status AS assignment_status,

                        da.comment,

                        da.is_completed,

                        mt.id AS task_id,

                        mt.sequence_no,

                        mt.name,

                        mt.phone_number,

                        mt.business_name,

                        mt.is_locked

                    FROM daily_assignments da

                    INNER JOIN master_tasks mt
                        ON da.task_id = mt.id

                    WHERE
                        da.employee_id = ?
                        AND da.assignment_date = ?

                        AND (
                            da.is_completed = 0
                            OR da.is_completed IS NULL
                        )

                        AND (
                            mt.is_locked = 0
                            OR mt.is_locked IS NULL
                        )

                    ORDER BY
                        mt.sequence_no ASC,
                        da.id ASC

                    LIMIT ?
                    `,
                    [
                        employeeId,
                        date,
                        remainingQuota,
                    ]
                );

            tasks = taskRows || [];
        }

        // ==================================================
        // STEP 4
        // ACTUAL TASK COUNT
        // ==================================================

        const taskCount =
            Number(tasks.length || 0);

        // ==================================================
        // STEP 5
        // ACTUAL TOTAL ASSIGNED FOR DAILY QUOTA
        //
        // The daily quota can never exceed 500.
        //
        // If 14 completed:
        //
        // total = 500
        // completed = 14
        // remaining = 486
        // ==================================================

        const totalAssigned =
            DAILY_TASK_LIMIT;

        // ==================================================
        // STEP 6
        // SAFETY CHECK
        //
        // If fewer tasks actually exist in DB than
        // remaining quota, return the actual available
        // task count separately.
        // ==================================================

        const actualAvailableTasks =
            taskCount;

        // ==================================================
        // RESPONSE
        // ==================================================

        return NextResponse.json(
            {
                success: true,

                // ------------------------------------------
                // DATE
                // ------------------------------------------

                date,

                california_date:
                    californiaDate,

                california_time_24h:
                    californiaTime24,

                california_time_12h:
                    californiaTime12,

                timezone:
                    CALIFORNIA_TIMEZONE,

                operational_day_start:
                    "07:00:00",

                // ------------------------------------------
                // EMPLOYEE
                // ------------------------------------------

                employee_id:
                    employeeId,

                // ------------------------------------------
                // DAILY LIMIT
                // ------------------------------------------

                daily_limit:
                    DAILY_TASK_LIMIT,

                // ------------------------------------------
                // DAILY STATS
                //
                // Example:
                //
                // total_tasks     = 500
                // completed_today = 14
                // remaining       = 486
                // ------------------------------------------

                total:
                    totalAssigned,

                total_tasks:
                    totalAssigned,

                completed_today:
                    completedToday,

                remaining:
                    remainingQuota,

                remaining_tasks:
                    remainingQuota,

                // ------------------------------------------
                // ACTUAL VISIBLE TASK COUNT
                // ------------------------------------------

                count:
                    actualAvailableTasks,

                // ------------------------------------------
                // FILTER
                // ------------------------------------------

                filter: {
                    selected_date:
                        selectedDate || null,

                    applied_date:
                        date,

                    filtered_by:
                        "employee_id + assignment_date + is_completed",

                    completion_rule:
                        "completed tasks are excluded from Daily Desk",

                    daily_quota_rule:
                        "500 - completed_today",
                },

                // ------------------------------------------
                // TASKS
                // ------------------------------------------

                tasks,
            },
            {
                status: 200,
            }
        );

    } catch (error) {
        console.error(
            "EMPLOYEE TASKS API ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Failed to fetch employee tasks",

                error:
                    error?.message ||
                    "Unknown error",
            },
            {
                status: 500,
            }
        );
    }
}
