
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
//     => PREVIOUS OPERATIONAL DAY
//
// 07:00 AM - 11:59 PM
//     => CURRENT OPERATIONAL DAY
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
// PREVIOUS OPERATIONAL DATE
// ==================================================

function getPreviousOperationalDate(operationalDate) {
    const date = new Date(
        `${operationalDate}T00:00:00Z`
    );

    date.setUTCDate(
        date.getUTCDate() - 1
    );

    return (
        `${date.getUTCFullYear()}-` +
        `${String(
            date.getUTCMonth() + 1
        ).padStart(2, "0")}-` +
        `${String(
            date.getUTCDate()
        ).padStart(2, "0")}`
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

    const parsed = new Date(
        `${date}T00:00:00Z`
    );

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
// GET PREVIOUS DAY PENDING TASKS
// ==================================================

async function getPreviousDayPendingCount(
    employeeId,
    previousOperationalDate
) {
    const [rows] = await db.query(
        `
        SELECT
            COUNT(*) AS pending_count

        FROM daily_assignments da

        INNER JOIN master_tasks mt
            ON mt.id = da.task_id

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
        `,
        [
            employeeId,
            previousOperationalDate,
        ]
    );

    return Math.max(
        0,
        Number(
            rows?.[0]?.pending_count || 0
        )
    );
}

// ==================================================
// AUTO ASSIGN NEW TASKS
//
// RULE:
//
// Previous operational day pending > 0
//      => NO NEW NUMBERS
//
// Previous operational day pending = 0
//      => Assign up to 500 globally unused numbers
//
// IMPORTANT:
// A master task can ONLY be assigned once globally.
// ==================================================

async function autoAssignTasks(
    employeeId,
    assignmentDate
) {
    let totalAssignedNow = 0;

    // --------------------------------------------------
    // PREVIOUS OPERATIONAL DATE
    // --------------------------------------------------

    const previousOperationalDate =
        getPreviousOperationalDate(
            assignmentDate
        );

    // --------------------------------------------------
    // CHECK PREVIOUS PENDING
    // --------------------------------------------------

    const previousPending =
        await getPreviousDayPendingCount(
            employeeId,
            previousOperationalDate
        );

    // --------------------------------------------------
    // BLOCK NEW NUMBERS
    // --------------------------------------------------

    if (previousPending > 0) {
        return {
            assigned: 0,
            total_assigned: 0,
            previous_pending: previousPending,
            blocked_by_previous_pending: true,
        };
    }

    // --------------------------------------------------
    // CURRENT DAY ASSIGNMENTS
    // --------------------------------------------------

    const [existingRows] = await db.query(
        `
        SELECT
            COUNT(*) AS total_assigned

        FROM daily_assignments

        WHERE
            employee_id = ?

            AND assignment_date = ?
        `,
        [
            employeeId,
            assignmentDate,
        ]
    );

    let alreadyAssigned = Number(
        existingRows?.[0]?.total_assigned || 0
    );

    let needed = Math.max(
        0,
        DAILY_TASK_LIMIT - alreadyAssigned
    );

    // --------------------------------------------------
    // ALREADY 500
    // --------------------------------------------------

    if (needed <= 0) {
        return {
            assigned: 0,
            total_assigned: alreadyAssigned,
            previous_pending: 0,
            blocked_by_previous_pending: false,
        };
    }

    // --------------------------------------------------
    // MULTIPLE ROUNDS
    // --------------------------------------------------

    const MAX_ROUNDS = 20;

    for (
        let round = 0;
        round < MAX_ROUNDS && needed > 0;
        round++
    ) {
        const before = alreadyAssigned;

        // --------------------------------------------------
        // GET GLOBALLY UNUSED MASTER TASKS
        // --------------------------------------------------

        const [unusedTasks] = await db.query(
            `
            SELECT
                mt.id AS task_id

            FROM master_tasks mt

            LEFT JOIN daily_assignments used
                ON used.task_id = mt.id

            WHERE
                used.task_id IS NULL

                AND (
                    mt.is_locked = 0
                    OR mt.is_locked IS NULL
                )

            ORDER BY
                mt.sequence_no ASC,
                mt.id ASC

            LIMIT ?
            `,
            [needed]
        );

        if (
            !unusedTasks ||
            unusedTasks.length === 0
        ) {
            break;
        }

        // --------------------------------------------------
        // INSERT
        // --------------------------------------------------

        for (const task of unusedTasks) {
            try {
                const [insertResult] =
                    await db.query(
                        `
                        INSERT IGNORE INTO daily_assignments
                        (
                            employee_id,
                            task_id,
                            assignment_date,
                            status,
                            comment,
                            is_completed
                        )
                        VALUES
                        (
                            ?,
                            ?,
                            ?,
                            'Pending',
                            NULL,
                            0
                        )
                        `,
                        [
                            employeeId,
                            task.task_id,
                            assignmentDate,
                        ]
                    );

                if (
                    Number(
                        insertResult?.affectedRows || 0
                    ) > 0
                ) {
                    totalAssignedNow++;
                    alreadyAssigned++;
                    needed--;
                }

                if (needed <= 0) {
                    break;
                }
            } catch (insertError) {
                console.error(
                    "TASK AUTO ASSIGN INSERT ERROR:",
                    insertError
                );
            }
        }

        // --------------------------------------------------
        // NOTHING INSERTED
        // --------------------------------------------------

        if (alreadyAssigned === before) {
            break;
        }
    }

    return {
        assigned: totalAssignedNow,
        total_assigned: alreadyAssigned,
        previous_pending: 0,
        blocked_by_previous_pending: false,
    };
}

// ==================================================
// GET EMPLOYEE DAILY TASKS
// ==================================================

export async function GET(req) {
    try {
        // ==================================================
        // URL
        // ==================================================

        const { searchParams } =
            new URL(req.url);

        const selectedDate =
            searchParams.get("date");

        // ==================================================
        // DETERMINE DATE
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
            date =
                getShiftOperationalDate();
        }

        // ==================================================
        // AUTH
        // ==================================================

        const cookieStore =
            await cookies();

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
                    message:
                        "User ID not found",
                },
                {
                    status: 401,
                }
            );
        }

        // ==================================================
        // CALIFORNIA INFO
        // ==================================================

        const californiaDate =
            getCaliforniaDate();

        const californiaTime24 =
            getCaliforniaTime24();

        const californiaTime12 =
            getCaliforniaTime12();

        // ==================================================
        // CURRENT OPERATIONAL DATE
        // ==================================================

        const currentOperationalDate =
            getShiftOperationalDate();

        const previousOperationalDate =
            getPreviousOperationalDate(
                currentOperationalDate
            );

        // ==================================================
        // STEP 1
        //
        // CURRENT DAY ONLY
        // ==================================================

        let allocationResult = {
            assigned: 0,
            total_assigned: 0,
            previous_pending: 0,
            blocked_by_previous_pending: false,
        };

        if (
            date ===
            currentOperationalDate
        ) {
            allocationResult =
                await autoAssignTasks(
                    employeeId,
                    date
                );
        }

        // ==================================================
        // STEP 2
        //
        // LATEST PREVIOUS PENDING
        // ==================================================

        const previousPendingCount =
            await getPreviousDayPendingCount(
                employeeId,
                previousOperationalDate
            );

        // ==================================================
        // STEP 3
        //
        // SHOW PREVIOUS PENDING
        // ==================================================

        const showPreviousPending =
            date === currentOperationalDate &&
            previousPendingCount > 0;

        // ==================================================
        // STEP 4
        //
        // TASK SOURCE DATE
        // ==================================================

        const taskDate =
            showPreviousPending
                ? previousOperationalDate
                : date;

        // ==================================================
        // STEP 5
        //
        // COMPLETED COUNT
        // ==================================================

        const statsDate =
            showPreviousPending
                ? previousOperationalDate
                : date;

        const [completedRows] =
            await db.query(
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
                    statsDate,
                ]
            );

        const completedToday =
            Math.max(
                0,
                Number(
                    completedRows?.[0]
                        ?.completed_today || 0
                )
            );

        // ==================================================
        // STEP 6
        //
        // FETCH TASKS
        //
        // IMPORTANT:
        //
        // Return the actual saved status from
        // daily_assignments.status.
        //
        // Example:
        //
        // Callback
        // Follow Up
        // No Answer
        // Interested
        // Not Interested
        // etc.
        // ==================================================

        const [taskRows] =
            await db.query(
                `
                SELECT
                    da.id AS assignment_id,

                    da.id AS daily_assignment_id,

                    da.assignment_date,

                    da.status AS status,

                    da.status AS assignment_status,

                    da.status AS assignment_status_name,

                    da.status AS selected_status,

                    da.status AS result,

                    da.status AS result_status,

                    da.status AS disposition,

                    da.status AS outcome,

                    da.comment AS comment,

                    da.comment AS comments,

                    da.is_completed,

                    mt.id AS task_id,

                    mt.id AS master_task_id,

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

                LIMIT 500
                `,
                [
                    employeeId,
                    taskDate,
                ]
            );

        const tasks = taskRows || [];

        // ==================================================
        // STEP 7
        //
        // CURRENT DAY TOTAL ASSIGNED
        // ==================================================

        const [assignedRows] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total_assigned

                FROM daily_assignments

                WHERE
                    employee_id = ?

                    AND assignment_date = ?
                `,
                [
                    employeeId,
                    date,
                ]
            );

        const totalAssignedToday =
            Number(
                assignedRows?.[0]
                    ?.total_assigned || 0
            );

        // ==================================================
        // STEP 8
        //
        // PREVIOUS DAY TOTAL
        // ==================================================

        const [previousAssignedRows] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total_assigned

                FROM daily_assignments

                WHERE
                    employee_id = ?

                    AND assignment_date = ?
                `,
                [
                    employeeId,
                    previousOperationalDate,
                ]
            );

        const previousTotalAssigned =
            Number(
                previousAssignedRows?.[0]
                    ?.total_assigned || 0
            );

        // ==================================================
        // STEP 9
        //
        // CURRENT DAY PENDING
        // ==================================================

        const [currentPendingRows] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS pending_count

                FROM daily_assignments da

                INNER JOIN master_tasks mt
                    ON mt.id = da.task_id

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
                `,
                [
                    employeeId,
                    date,
                ]
            );

        const currentPendingCount =
            Number(
                currentPendingRows?.[0]
                    ?.pending_count || 0
            );

        // ==================================================
        // STEP 10
        //
        // PREVIOUS DAY PENDING
        // ==================================================

        const remaining =
            showPreviousPending
                ? previousPendingCount
                : currentPendingCount;

        // ==================================================
        // STEP 11
        //
        // ACTUAL VISIBLE COUNT
        // ==================================================

        const actualAvailableTasks =
            Number(tasks.length || 0);

        // ==================================================
        // STEP 12
        //
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
                // OPERATIONAL DATES
                // ------------------------------------------

                operational_date:
                    currentOperationalDate,

                previous_operational_date:
                    previousOperationalDate,

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
                // ALLOCATION
                // ------------------------------------------

                allocation: {
                    auto_assigned:
                        allocationResult.assigned,

                    total_assigned_today:
                        totalAssignedToday,

                    previous_day_pending:
                        previousPendingCount,

                    previous_day_total:
                        previousTotalAssigned,

                    blocked_by_previous_pending:
                        showPreviousPending,

                    new_numbers_allowed:
                        !showPreviousPending,

                    rule:
                        "Previous operational day pending tasks must be completed before new numbers are assigned.",

                    daily_rule:
                        "Maximum 500 new tasks are assigned when the previous operational day has zero pending tasks.",

                    pending_rule:
                        "If previous day has pending tasks, only those pending tasks are shown.",

                    duplicate_rule:
                        "A master task can only be assigned once globally.",
                },

                // ------------------------------------------
                // DAILY STATS
                // ------------------------------------------

                total:
                    DAILY_TASK_LIMIT,

                total_tasks:
                    DAILY_TASK_LIMIT,

                completed_today:
                    completedToday,

                remaining,

                remaining_tasks:
                    remaining,

                // ------------------------------------------
                // DATABASE COUNTS
                // ------------------------------------------

                total_assigned_today:
                    totalAssignedToday,

                current_day_pending:
                    currentPendingCount,

                previous_day_pending:
                    previousPendingCount,

                available_tasks:
                    actualAvailableTasks,

                count:
                    actualAvailableTasks,

                // ------------------------------------------
                // TASK SOURCE
                // ------------------------------------------

                task_source: {
                    type:
                        showPreviousPending
                            ? "previous_day_pending"
                            : "current_day",

                    date:
                        taskDate,

                    label:
                        showPreviousPending
                            ? "Previous Day Pending"
                            : "Current Day New Tasks",
                },

                // ------------------------------------------
                // FILTER INFO
                // ------------------------------------------

                filter: {
                    selected_date:
                        selectedDate || null,

                    applied_date:
                        date,

                    operational_date:
                        currentOperationalDate,

                    previous_operational_date:
                        previousOperationalDate,

                    filtered_by:
                        "employee_id + assignment_date + is_completed",

                    completion_rule:
                        "Completed tasks are excluded from Daily Desk.",

                    daily_quota_rule:
                        "Maximum 500 new tasks.",

                    pending_carry_forward_rule:
                        "Previous operational day pending tasks are shown first and block new task assignment until completed.",

                    allocation_rule:
                        "If previous pending exists, show only previous pending. If previous pending is zero, assign up to 500 globally unused master tasks.",
                },

                // ------------------------------------------
                // TASKS
                //
                // Every task now contains the actual
                // employee-selected status in multiple
                // compatible fields.
                // ------------------------------------------

                tasks,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate, proxy-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
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

