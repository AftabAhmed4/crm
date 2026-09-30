import { NextResponse } from "next/server";
import db from "../../lib/db";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/*
=========================================================
CONFIG
=========================================================
*/

const ALLOWED_ROLES = [
  "agent",
  "staff",
  "admin",
  "HR",
  "Supervisor",
  "Management",
  "Team Lead",
];

const ALLOWED_TEAMS = [
  "Design",
  "Sales",
  "Developer",
  "SMM",
  "HR",
  "Supervisor",
  "Management",
  "Team Lead",
  "Support",
  "Marketing",
];

/*
=========================================================
HELPERS
=========================================================
*/

function cleanString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/*
=========================================================
GET USERS
=========================================================
*/

export async function GET() {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        name,
        email,
        phone,
        zoom_extension,
        role,
        team,
        status,
        availability_status,
        status_started_at,
        avatar,
        last_login,
        login_time,
        logout_time,
        break_start,
        break_end,
        created_at,
        updated_at
      FROM users
      ORDER BY id DESC
    `);

    return jsonResponse({
      success: true,
      users: rows,
    });
  } catch (error) {
    console.error("GET /api/new-users ERROR:", error);

    return jsonResponse(
      {
        success: false,
        message: error?.message || "Failed to fetch users",
        error: error?.sqlMessage || error?.message || "Unknown database error",
        code: error?.code || null,
      },
      500
    );
  }
}

/*
=========================================================
POST - CREATE USER
=========================================================
*/

export async function POST(request) {
  try {
    let name = "";
    let email = "";
    let phone = "";
    let zoom_extension = "";
    let role = "";
    let team = "";
    let password = "";
    let status = "Active";
    let availability_status = "Active";
    let avatarPath = null;
    let avatarFile = null;

    /*
    -------------------------------------------------------
    SUPPORT BOTH:
    1. multipart/form-data
    2. application/json
    -------------------------------------------------------
    */

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      name = cleanString(
        formData.get("name") || formData.get("fullName")
      );

      email = cleanString(formData.get("email"));
      phone = cleanString(formData.get("phone"));

      zoom_extension = cleanString(
        formData.get("zoom_extension") ||
        formData.get("zoomExtension")
      );

      role = cleanString(formData.get("role"));
      team = cleanString(formData.get("team"));
      password = cleanString(formData.get("password"));

      status = cleanString(formData.get("status")) || "Active";

      availability_status =
        cleanString(formData.get("availability_status")) || "Active";

      const uploadedAvatar = formData.get("avatar");

      if (
        uploadedAvatar &&
        typeof uploadedAvatar === "object" &&
        typeof uploadedAvatar.arrayBuffer === "function"
      ) {
        avatarFile = uploadedAvatar;
      }
    } else {
      const body = await request.json();

      name = cleanString(body.name || body.fullName);
      email = cleanString(body.email);
      phone = cleanString(body.phone);

      zoom_extension = cleanString(
        body.zoom_extension || body.zoomExtension
      );

      role = cleanString(body.role);
      team = cleanString(body.team);
      password = cleanString(body.password);

      status = cleanString(body.status) || "Active";

      availability_status =
        cleanString(body.availability_status) || "Active";

      if (body.avatar) {
        avatarPath = cleanString(body.avatar) || null;
      }
    }

    /*
    -------------------------------------------------------
    VALIDATION
    -------------------------------------------------------
    */

    if (!name) {
      return jsonResponse(
        {
          success: false,
          message: "Full name is required",
        },
        400
      );
    }

    if (!email) {
      return jsonResponse(
        {
          success: false,
          message: "Email is required",
        },
        400
      );
    }

    if (!password) {
      return jsonResponse(
        {
          success: false,
          message: "Password is required",
        },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        {
          success: false,
          message: "Password must be at least 6 characters",
        },
        400
      );
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return jsonResponse(
        {
          success: false,
          message: "Please enter a valid email address",
        },
        400
      );
    }

    if (!role) {
      return jsonResponse(
        {
          success: false,
          message: "Role is required",
        },
        400
      );
    }

    if (!team) {
      return jsonResponse(
        {
          success: false,
          message: "Team is required",
        },
        400
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return jsonResponse(
        {
          success: false,
          message: `Invalid role: ${role}`,
          allowedRoles: ALLOWED_ROLES,
        },
        400
      );
    }

    if (!ALLOWED_TEAMS.includes(team)) {
      return jsonResponse(
        {
          success: false,
          message: `Invalid team: ${team}`,
          allowedTeams: ALLOWED_TEAMS,
        },
        400
      );
    }

    /*
    -------------------------------------------------------
    CHECK DUPLICATE EMAIL
    -------------------------------------------------------
    */

    const [existingUsers] = await db.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
      `,
      [email]
    );

    if (existingUsers.length > 0) {
      return jsonResponse(
        {
          success: false,
          message: "A user with this email already exists",
        },
        409
      );
    }

    /*
    -------------------------------------------------------
    PASSWORD HASH
    -------------------------------------------------------
    IMPORTANT:
    Database column is password_hash
    NOT password
    -------------------------------------------------------
    */

    const hashedPassword = await bcrypt.hash(password, 10);

    /*
    -------------------------------------------------------
    AVATAR UPLOAD
    -------------------------------------------------------
    */

    if (avatarFile) {
      const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

      if (avatarFile.size > MAX_FILE_SIZE) {
        return jsonResponse(
          {
            success: false,
            message: "Avatar image must be less than 2MB",
          },
          400
        );
      }

      const uploadsDir = path.join(
        process.cwd(),
        "public",
        "uploads"
      );

      await mkdir(uploadsDir, {
        recursive: true,
      });

      const originalName =
        cleanString(avatarFile.name) || "avatar";

      const safeName = originalName
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-");

      const fileName = `${Date.now()}-${safeName}`;

      const filePath = path.join(
        uploadsDir,
        fileName
      );

      const buffer = Buffer.from(
        await avatarFile.arrayBuffer()
      );

      await writeFile(filePath, buffer);

      avatarPath = `/uploads/${fileName}`;
    }

    /*
    -------------------------------------------------------
    CREATE USER
    -------------------------------------------------------
    */

    const [result] = await db.query(
      `
        INSERT INTO users
        (
          name,
          email,
          phone,
          zoom_extension,
          role,
          team,
          password_hash,
          status,
          availability_status,
          status_started_at,
          avatar,
          break_start,
          break_end,
          created_at,
          updated_at
        )
        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          NULL,
          ?,
          NULL,
          NULL,
          NOW(),
          NOW()
        )
      `,
      [
        name,
        email,
        phone || null,
        zoom_extension || null,
        role,
        team,
        hashedPassword,
        status || "Active",
        availability_status || "Active",
        avatarPath,
      ]
    );

    /*
    -------------------------------------------------------
    GET CREATED USER
    -------------------------------------------------------
    */

    const [createdRows] = await db.query(
      `
        SELECT
          id,
          name,
          email,
          phone,
          zoom_extension,
          role,
          team,
          status,
          availability_status,
          status_started_at,
          avatar,
          last_login,
          login_time,
          logout_time,
          break_start,
          break_end,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return jsonResponse(
      {
        success: true,
        message: "User created successfully",
        user: createdRows[0] || {
          id: result.insertId,
          name,
          email,
          phone,
          zoom_extension,
          role,
          team,
          status,
          availability_status,
          avatar: avatarPath,
        },
      },
      201
    );
  } catch (error) {
    console.error(
      "POST /api/new-users ERROR:",
      error
    );

    return jsonResponse(
      {
        success: false,
        message:
          error?.sqlMessage ||
          error?.message ||
          "Failed to create user",
        error:
          error?.sqlMessage ||
          error?.message ||
          "Unknown database error",
        code: error?.code || null,
        errno: error?.errno || null,
        sqlState: error?.sqlState || null,
      },
      500
    );
  }
}

/*
=========================================================
PATCH - UPDATE USER
=========================================================
*/

export async function PATCH(request) {
  try {
    const body = await request.json();

    const id = Number(body.id);

    if (!id) {
      return jsonResponse(
        {
          success: false,
          message: "User ID is required",
        },
        400
      );
    }

    /*
    -------------------------------------------------------
    GET EXISTING USER
    -------------------------------------------------------
    */

    const [existingRows] = await db.query(
      `
        SELECT
          id,
          role,
          team,
          zoom_extension,
          status,
          availability_status,
          break_start,
          break_end
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!existingRows.length) {
      return jsonResponse(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    const existingUser = existingRows[0];

    /*
    =======================================================
    ROLE / TEAM / ZOOM UPDATE
    =======================================================
    */

    const hasRole =
      Object.prototype.hasOwnProperty.call(
        body,
        "role"
      );

    const hasTeam =
      Object.prototype.hasOwnProperty.call(
        body,
        "team"
      );

    const hasZoom =
      Object.prototype.hasOwnProperty.call(
        body,
        "zoom_extension"
      ) ||
      Object.prototype.hasOwnProperty.call(
        body,
        "zoomExtension"
      );

    if (hasRole || hasTeam || hasZoom) {
      const role = hasRole
        ? cleanString(body.role)
        : existingUser.role;

      const team = hasTeam
        ? cleanString(body.team)
        : existingUser.team;

      const zoom_extension = hasZoom
        ? cleanString(
            body.zoom_extension ||
            body.zoomExtension
          )
        : existingUser.zoom_extension;

      if (!ALLOWED_ROLES.includes(role)) {
        return jsonResponse(
          {
            success: false,
            message: `Invalid role: ${role}`,
            allowedRoles: ALLOWED_ROLES,
          },
          400
        );
      }

      if (!ALLOWED_TEAMS.includes(team)) {
        return jsonResponse(
          {
            success: false,
            message: `Invalid team: ${team}`,
            allowedTeams: ALLOWED_TEAMS,
          },
          400
        );
      }

      await db.query(
        `
          UPDATE users
          SET
            role = ?,
            team = ?,
            zoom_extension = ?,
            updated_at = NOW()
          WHERE id = ?
        `,
        [
          role,
          team,
          zoom_extension || null,
          id,
        ]
      );

      return jsonResponse({
        success: true,
        message: "User updated successfully",
      });
    }

    /*
    =======================================================
    BREAK UPDATE
    =======================================================
    */

    const hasBreakStart =
      Object.prototype.hasOwnProperty.call(
        body,
        "break_start"
      );

    const hasBreakEnd =
      Object.prototype.hasOwnProperty.call(
        body,
        "break_end"
      );

    if (hasBreakStart || hasBreakEnd) {
      const breakStart = hasBreakStart
        ? body.break_start || null
        : existingUser.break_start;

      const breakEnd = hasBreakEnd
        ? body.break_end || null
        : existingUser.break_end;

      await db.query(
        `
          UPDATE users
          SET
            break_start = ?,
            break_end = ?,
            updated_at = NOW()
          WHERE id = ?
        `,
        [
          breakStart,
          breakEnd,
          id,
        ]
      );

      return jsonResponse({
        success: true,
        message: "Break updated successfully",
      });
    }

    /*
    =======================================================
    STATUS UPDATE
    =======================================================
    */

    const hasStatus =
      Object.prototype.hasOwnProperty.call(
        body,
        "status"
      );

    const hasAvailabilityStatus =
      Object.prototype.hasOwnProperty.call(
        body,
        "availability_status"
      );

    if (hasStatus || hasAvailabilityStatus) {
      const newStatus = hasStatus
        ? cleanString(body.status)
        : existingUser.status;

      const newAvailabilityStatus =
        hasAvailabilityStatus
          ? cleanString(body.availability_status)
          : existingUser.availability_status;

      await db.query(
        `
          UPDATE users
          SET
            status = ?,
            availability_status = ?,
            status_started_at = NOW(),
            updated_at = NOW()
          WHERE id = ?
        `,
        [
          newStatus || "Active",
          newAvailabilityStatus || "Active",
          id,
        ]
      );

      return jsonResponse({
        success: true,
        message: "Status updated successfully",
      });
    }

    /*
    =======================================================
    PASSWORD UPDATE
    =======================================================
    */

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "password"
      )
    ) {
      const newPassword = cleanString(
        body.password
      );

      if (!newPassword) {
        return jsonResponse(
          {
            success: false,
            message: "Password cannot be empty",
          },
          400
        );
      }

      if (newPassword.length < 6) {
        return jsonResponse(
          {
            success: false,
            message:
              "Password must be at least 6 characters",
          },
          400
        );
      }

      const hashedPassword =
        await bcrypt.hash(newPassword, 10);

      await db.query(
        `
          UPDATE users
          SET
            password_hash = ?,
            updated_at = NOW()
          WHERE id = ?
        `,
        [
          hashedPassword,
          id,
        ]
      );

      return jsonResponse({
        success: true,
        message: "Password updated successfully",
      });
    }

    /*
    =======================================================
    NOTHING TO UPDATE
    =======================================================
    */

    return jsonResponse(
      {
        success: false,
        message: "No valid update fields provided",
      },
      400
    );
  } catch (error) {
    console.error(
      "PATCH /api/new-users ERROR:",
      error
    );

    return jsonResponse(
      {
        success: false,
        message:
          error?.sqlMessage ||
          error?.message ||
          "Failed to update user",
        error:
          error?.sqlMessage ||
          error?.message ||
          "Unknown database error",
        code: error?.code || null,
        errno: error?.errno || null,
        sqlState: error?.sqlState || null,
      },
      500
    );
  }
}