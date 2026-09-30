import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "../../lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/*
============================================================
HELPER: GET CURRENT USER
============================================================
*/
function getCurrentUser(request) {
  try {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const id =
      decoded.id ??
      decoded.userId ??
      decoded.user_id ??
      decoded._id;

    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    return {
      id: userId,

      name:
        decoded.name ||
        decoded.username ||
        decoded.email ||
        "",

      email:
        decoded.email || "",

      role: String(
        decoded.role || "user"
      ).toLowerCase(),
    };
  } catch (error) {
    console.error(
      "NOTIFICATION AUTH ERROR:",
      error
    );

    return null;
  }
}

/*
============================================================
HELPER: NO CACHE
============================================================
*/
function noCacheHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

/*
============================================================
HELPER: NORMALIZE QUERY RESULT
============================================================

This handles different query() return formats:

1. mysql2:
   [rows, fields]

2. custom helper:
   rows

3. object:
   { rows: [...] }

4. object:
   { result: {...} }
============================================================
*/
function getRows(response) {
  /*
  ------------------------------------------
  FORMAT:
  { rows: [...] }
  ------------------------------------------
  */
  if (
    response &&
    !Array.isArray(response) &&
    Array.isArray(response.rows)
  ) {
    return response.rows;
  }

  /*
  ------------------------------------------
  FORMAT:
  [rows, fields]
  ------------------------------------------
  */
  if (
    Array.isArray(response) &&
    Array.isArray(response[0])
  ) {
    return response[0];
  }

  /*
  ------------------------------------------
  FORMAT:
  direct rows array
  ------------------------------------------
  */
  if (Array.isArray(response)) {
    return response;
  }

  /*
  ------------------------------------------
  Nothing
  ------------------------------------------
  */
  return [];
}

/*
============================================================
HELPER: GET QUERY RESULT FOR INSERT / UPDATE / DELETE
============================================================
*/
function getResult(response) {
  /*
  ------------------------------------------
  { result: {...} }
  ------------------------------------------
  */
  if (
    response &&
    !Array.isArray(response) &&
    response.result
  ) {
    return response.result;
  }

  /*
  ------------------------------------------
  [result, fields]
  ------------------------------------------
  */
  if (
    Array.isArray(response) &&
    response.length > 0 &&
    !Array.isArray(response[0])
  ) {
    return response[0] || {};
  }

  /*
  ------------------------------------------
  direct result object
  ------------------------------------------
  */
  if (
    response &&
    !Array.isArray(response)
  ) {
    return response;
  }

  return {};
}

/*
============================================================
HELPER: FORMAT NOTIFICATION
============================================================
*/
function formatNotification(notification) {
  return {
    id: Number(
      notification?.id || 0
    ),

    user_id: Number(
      notification?.user_id || 0
    ),

    title:
      notification?.title ||
      "Notification",

    message:
      notification?.message ||
      "",

    type:
      notification?.type ||
      "info",

    is_read: Number(
      notification?.is_read || 0
    ),

    read_at:
      notification?.read_at ||
      null,

    created_at:
      notification?.created_at ||
      null,
  };
}

/*
============================================================
GET NOTIFICATIONS
============================================================

ALL:
GET /api/notifications

UNREAD:
GET /api/notifications?unread=true

LIMIT:
GET /api/notifications?limit=50

UNREAD + LIMIT:
GET /api/notifications?unread=true&limit=100
============================================================
*/
export async function GET(request) {
  try {
    /*
    ========================================================
    AUTH
    ========================================================
    */
    const user =
      getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
          notifications: [],
          unread_count: 0,
        },
        {
          status: 401,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    URL PARAMS
    ========================================================
    */
    const { searchParams } =
      new URL(request.url);

    const unreadParam =
      String(
        searchParams.get("unread") || ""
      ).toLowerCase();

    const unreadOnly =
      unreadParam === "true" ||
      unreadParam === "1" ||
      unreadParam === "yes";

    /*
    ========================================================
    LIMIT
    ========================================================
    */
    let limit = Number(
      searchParams.get("limit")
    );

    if (
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      limit = 50;
    }

    limit = Math.min(
      limit,
      100
    );

    /*
    ========================================================
    WHERE
    ========================================================
    */
    let where = `
      WHERE n.user_id = ?
    `;

    const params = [
      user.id,
    ];

    if (unreadOnly) {
      where += `
        AND COALESCE(
          n.is_read,
          0
        ) = 0
      `;
    }

    /*
    ========================================================
    GET NOTIFICATIONS
    ========================================================
    */
    const notificationQuery =
      await query(
        `
        SELECT
          n.id,
          n.user_id,
          n.title,
          n.message,
          n.type,
          n.is_read,
          n.created_at,
          n.read_at

        FROM notifications n

        ${where}

        ORDER BY
          n.created_at DESC,
          n.id DESC

        LIMIT ${limit}
        `,
        params
      );

    /*
    IMPORTANT:
    Always convert result into an array.
    */
    const notifications =
      getRows(
        notificationQuery
      );

    /*
    ========================================================
    GET TOTAL UNREAD COUNT
    ========================================================
    */
    const unreadQuery =
      await query(
        `
        SELECT
          COUNT(*) AS unread_count

        FROM notifications

        WHERE user_id = ?

          AND COALESCE(
            is_read,
            0
          ) = 0
        `,
        [user.id]
      );

    const unreadRows =
      getRows(
        unreadQuery
      );

    const unreadCount =
      Number(
        unreadRows?.[0]
          ?.unread_count || 0
      );

    /*
    ========================================================
    FORMAT
    ========================================================
    */
    const formattedNotifications =
      Array.isArray(
        notifications
      )
        ? notifications.map(
            formatNotification
          )
        : [];

    /*
    ========================================================
    RESPONSE
    ========================================================
    */
    return NextResponse.json(
      {
        success: true,

        user_id: user.id,

        unread_only:
          unreadOnly,

        notifications:
          formattedNotifications,

        unread_count:
          unreadCount,

        count:
          formattedNotifications.length,
      },
      {
        status: 200,
        headers: noCacheHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "GET NOTIFICATIONS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to load notifications",

        notifications: [],

        unread_count: 0,

        error:
          process.env.NODE_ENV ===
          "development"
            ? String(
                error?.message ||
                  error
              )
            : undefined,
      },
      {
        status: 500,
        headers: noCacheHeaders(),
      }
    );
  }
}

/*
============================================================
POST NOTIFICATION
============================================================

BODY:

{
  "user_id": 15,
  "title": "New message",
  "message": "You have received a new message",
  "type": "message"
}
============================================================
*/
export async function POST(request) {
  try {
    /*
    ========================================================
    AUTH
    ========================================================
    */
    const creator =
      getCurrentUser(request);

    if (!creator) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    BODY
    ========================================================
    */
    const body =
      await request.json();

    const userId =
      Number(
        body.user_id ??
          body.userId ??
          body.targetUserId
      );

    const title =
      String(
        body.title || ""
      ).trim();

    const message =
      String(
        body.message || ""
      ).trim();

    const type =
      String(
        body.type || "info"
      ).trim();

    /*
    ========================================================
    VALIDATE USER ID
    ========================================================
    */
    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid user_id is required",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    VALIDATE TITLE
    ========================================================
    */
    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notification title is required",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    VALIDATE MESSAGE
    ========================================================
    */
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notification message is required",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    CHECK TARGET USER
    ========================================================
    */
    const usersQuery =
      await query(
        `
        SELECT
          id,
          name,
          email

        FROM users

        WHERE id = ?

        LIMIT 1
        `,
        [userId]
      );

    const users =
      getRows(usersQuery);

    if (
      users.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Target user not found",
        },
        {
          status: 404,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    INSERT
    ========================================================
    */
    const insertQuery =
      await query(
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

        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          0,
          NOW()
        )
        `,
        [
          userId,
          title,
          message,
          type || "info",
        ]
      );

    const insertResult =
      getResult(
        insertQuery
      );

    const notificationId =
      Number(
        insertResult?.insertId || 0
      );

    /*
    ========================================================
    GET CREATED NOTIFICATION
    ========================================================
    */
    let createdNotification = null;

    if (notificationId > 0) {
      const createdQuery =
        await query(
          `
          SELECT
            id,
            user_id,
            title,
            message,
            type,
            is_read,
            created_at,
            read_at

          FROM notifications

          WHERE id = ?

          LIMIT 1
          `,
          [notificationId]
        );

      const createdRows =
        getRows(
          createdQuery
        );

      createdNotification =
        createdRows?.[0]
          ? formatNotification(
              createdRows[0]
            )
          : null;
    }

    /*
    ========================================================
    RESPONSE
    ========================================================
    */
    return NextResponse.json(
      {
        success: true,

        message:
          "Notification created successfully",

        created_by:
          creator.id,

        notification:
          createdNotification,
      },
      {
        status: 201,
        headers: noCacheHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "POST NOTIFICATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to create notification",

        error:
          process.env.NODE_ENV ===
          "development"
            ? String(
                error?.message ||
                  error
              )
            : undefined,
      },
      {
        status: 500,
        headers: noCacheHeaders(),
      }
    );
  }
}

/*
============================================================
PATCH NOTIFICATION
============================================================

MARK ONE:

{
  "id": 15
}

MARK ALL:

{
  "all": true
}
============================================================
*/
export async function PATCH(request) {
  try {
    /*
    ========================================================
    AUTH
    ========================================================
    */
    const user =
      getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    BODY
    ========================================================
    */
    const body =
      await request.json();

    const markAll =
      body.all === true ||
      body.markAll === true;

    /*
    ========================================================
    MARK ALL READ
    ========================================================
    */
    if (markAll) {
      const updateQuery =
        await query(
          `
          UPDATE notifications

          SET
            is_read = 1,
            read_at = NOW()

          WHERE user_id = ?

            AND COALESCE(
              is_read,
              0
            ) = 0
          `,
          [user.id]
        );

      const result =
        getResult(
          updateQuery
        );

      return NextResponse.json(
        {
          success: true,

          message:
            "All notifications marked as read",

          updated:
            Number(
              result?.affectedRows || 0
            ),

          unread_count: 0,
        },
        {
          status: 200,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    ONE NOTIFICATION
    ========================================================
    */
    const notificationId =
      Number(
        body.id ??
          body.notification_id
      );

    if (
      !Number.isInteger(
        notificationId
      ) ||
      notificationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid notification id is required",
        },
        {
          status: 400,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    CHECK OWNERSHIP
    ========================================================
    */
    const existingQuery =
      await query(
        `
        SELECT
          id

        FROM notifications

        WHERE id = ?

          AND user_id = ?

        LIMIT 1
        `,
        [
          notificationId,
          user.id,
        ]
      );

    const existing =
      getRows(
        existingQuery
      );

    if (
      existing.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notification not found",
        },
        {
          status: 404,
          headers: noCacheHeaders(),
        }
      );
    }

    /*
    ========================================================
    MARK READ
    ========================================================
    */
    await query(
      `
      UPDATE notifications

      SET
        is_read = 1,
        read_at = NOW()

      WHERE id = ?

        AND user_id = ?
      `,
      [
        notificationId,
        user.id,
      ]
    );

    /*
    ========================================================
    NEW UNREAD COUNT
    ========================================================
    */
    const unreadQuery =
      await query(
        `
        SELECT
          COUNT(*) AS unread_count

        FROM notifications

        WHERE user_id = ?

          AND COALESCE(
            is_read,
            0
          ) = 0
        `,
        [user.id]
      );

    const unreadRows =
      getRows(
        unreadQuery
      );

    const unreadCount =
      Number(
        unreadRows?.[0]
          ?.unread_count || 0
      );

    /*
    ========================================================
    RESPONSE
    ========================================================
    */
    return NextResponse.json(
      {
        success: true,

        message:
          "Notification marked as read",

        notification_id:
          notificationId,

        unread_count:
          unreadCount,
      },
      {
        status: 200,
        headers: noCacheHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "PATCH NOTIFICATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to update notification",

        error:
          process.env.NODE_ENV ===
          "development"
            ? String(
                error?.message ||
                  error
              )
            : undefined,
      },
      {
        status: 500,
        headers: noCacheHeaders(),
      }
    );
  }
}