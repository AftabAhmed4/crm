import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// ==================================================
// PATCH EMPLOYEE TASK
// ==================================================
//
// Flow:
//
// User selects:
// Callback / Follow Up / No Answer / etc.
//
//        ↓
//
// daily_assignments
// status       = selected status
// comment      = user comment
// is_completed = 1
//
//        ↓
//
// Task disappears from Daily Desk
//
//        ↓
//
// Record remains in database/history
//
//        ↓
//
// master_tasks.current_status = selected status
//
// ==================================================

export async function PATCH(req, context) {
    let connection;

    try {
        // ==================================================
        // 1. GET ASSIGNMENT ID
        // ==================================================

        const { id } = await context.params;

        const assignmentId =
            id && /^\d+$/.test(String(id))
                ? parseInt(id, 10)
                : null;

        if (!assignmentId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid assignment ID",
                },
                {
                    status: 400,
                }
            );
        }

        // ==================================================
        // 2. READ REQUEST BODY
        // ==================================================

        let body;

        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid JSON request body",
                },
                {
                    status: 400,
                }
            );
        }

        const status =
            typeof body?.status === "string"
                ? body.status.trim()
                : "";

        const comment =
            typeof body?.comment === "string"
                ? body.comment.trim()
                : "";

        // ==================================================
        // 3. VALIDATE STATUS
        // ==================================================

        if (!status) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Status is required",
                },
                {
                    status: 400,
                }
            );
        }

        // Prevent extremely large accidental values
        if (status.length > 255) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Status is too long",
                },
                {
                    status: 400,
                }
            );
        }

        // ==================================================
        // 4. AUTHENTICATION
        // ==================================================

        const cookieStore = await cookies();

        const token =
            cookieStore.get("token")?.value;

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Login required",
                },
                {
                    status: 401,
                }
            );
        }

        // ==================================================
        // 5. VERIFY JWT
        // ==================================================

        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid or expired login session",
                },
                {
                    status: 401,
                }
            );
        }

        const employeeId =
            decoded?.id ||
            decoded?._id ||
            decoded?.userId ||
            null;

        if (!employeeId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "User ID not found",
                },
                {
                    status: 401,
                }
            );
        }

        // ==================================================
        // 6. GET DB CONNECTION
        // ==================================================

        connection = await db.getConnection();

        // ==================================================
        // 7. START TRANSACTION
        // ==================================================

        await connection.beginTransaction();

        // ==================================================
        // 8. FETCH ASSIGNMENT
        //
        // IMPORTANT:
        // Employee can only update HIS OWN assignment.
        // ==================================================

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

                WHERE
                    da.id = ?
                    AND da.employee_id = ?

                LIMIT 1
                `,
                [
                    assignmentId,
                    employeeId,
                ]
            );

        // ==================================================
        // 9. ASSIGNMENT NOT FOUND
        // ==================================================

        if (!assignmentRows.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Assignment record not found or does not belong to this user",
                },
                {
                    status: 404,
                }
            );
        }

        const assignment =
            assignmentRows[0];

        const taskId =
            assignment.task_id;

        // ==================================================
        // 10. CHECK IF ALREADY COMPLETED
        //
        // Don't allow accidental duplicate processing.
        // ==================================================

        if (
            Number(assignment.is_completed) === 1
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    error:
                        "This task has already been processed",
                    assignmentId,
                    taskId,
                },
                {
                    status: 409,
                }
            );
        }

        // ==================================================
        // 11. GET STATUS CONFIGURATION
        //
        // is_locking_status is ONLY for master task locking.
        //
        // It does NOT control daily completion.
        //
        // Every saved status completes the daily assignment.
        // ==================================================

        const [statusConfig] =
            await connection.execute(
                `
                SELECT
                    is_locking_status

                FROM status_configs

                WHERE
                    LOWER(TRIM(status_name))
                    =
                    LOWER(TRIM(?))

                LIMIT 1
                `,
                [status]
            );

        const isLocking =
            statusConfig.length > 0
                ? Number(
                    statusConfig[0]
                        .is_locking_status
                ) === 1
                : false;

        // ==================================================
        // 12. UPDATE DAILY ASSIGNMENT
        //
        // THIS IS THE MOST IMPORTANT PART.
        //
        // Any selected status means the task has been
        // processed for today's Daily Desk.
        // ==================================================

        await connection.execute(
            `
            UPDATE daily_assignments

            SET
                status = ?,
                comment = ?,
                is_completed = 1,
                updated_at = NOW()

            WHERE
                id = ?
                AND employee_id = ?
            `,
            [
                status,
                comment || null,
                assignmentId,
                employeeId,
            ]
        );

        // ==================================================
        // 13. UPDATE MASTER TASK
        //
        // Save latest status.
        //
        // Lock only when the selected status is configured
        // as a locking status.
        // ==================================================

        await connection.execute(
            `
            UPDATE master_tasks

            SET
                current_status = ?,
                is_locked = ?

            WHERE id = ?
            `,
            [
                status,
                isLocking ? 1 : 0,
                taskId,
            ]
        );

        // ==================================================
        // 14. GET UPDATED DAILY COUNTS
        //
        // These are returned to frontend so the cards can
        // immediately become:
        //
        // Completed Today: +1
        // Remaining: -1
        // ==================================================

        const [completedRows] =
            await connection.execute(
                `
                SELECT
                    COUNT(*) AS completed_today

                FROM daily_assignments

                WHERE
                    employee_id = ?
                    AND assignment_date = ?
                    AND is_completed = 1
                `,
                [
                    employeeId,
                    assignment.assignment_date,
                ]
            );

        const completedToday =
            Number(
                completedRows?.[0]
                    ?.completed_today || 0
            );

        // ==================================================
        // GET REMAINING TASKS
        // ==================================================

        const [remainingRows] =
            await connection.execute(
                `
                SELECT
                    COUNT(*) AS remaining

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
                `,
                [
                    employeeId,
                    assignment.assignment_date,
                ]
            );

        const remaining =
            Number(
                remainingRows?.[0]
                    ?.remaining || 0
            );

        // ==================================================
        // TOTAL PROCESSED
        // ==================================================

        const totalProcessed =
            completedToday + remaining;

        // ==================================================
        // 15. COMMIT
        // ==================================================

        await connection.commit();

        // ==================================================
        // 16. SUCCESS RESPONSE
        // ==================================================

        return NextResponse.json(
            {
                success: true,

                message:
                    "Task updated successfully",

                // IDs
                assignmentId,
                taskId,
                employeeId,

                // Selected disposition
                status,

                // Comment
                comment: comment || null,

                // Daily Desk processing
                isCompleted: true,

                // Master task locking
                isLocked: isLocking,

                // Assignment date
                assignmentDate:
                    assignment.assignment_date,

                // Updated stats
                daily_limit: 500,

                total:
                    totalProcessed,

                total_tasks:
                    totalProcessed,

                completed_today:
                    completedToday,

                remaining:
                    remaining,

                remaining_tasks:
                    remaining,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        // ==================================================
        // ROLLBACK
        // ==================================================

        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Rollback Error:",
                    rollbackError
                );
            }
        }

        console.error(
            "EMPLOYEE TASK PATCH ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                error:
                    error?.message ||
                    "Internal server error",
            },
            {
                status: 500,
            }
        );
    } finally {
        // ==================================================
        // RELEASE CONNECTION
        // ==================================================

        if (connection) {
            connection.release();
        }
    }
}