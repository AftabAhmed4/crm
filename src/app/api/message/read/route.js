import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../../lib/db";

export const runtime = "nodejs";

/*
==================================================
GET CURRENT USER
==================================================
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
      decoded._id ??
      decoded.userId;

    const numericId = Number(id);

    if (
      !Number.isInteger(numericId) ||
      numericId <= 0
    ) {
      return null;
    }

    return {
      id: numericId,

      name:
        decoded.name ||
        decoded.username ||
        "",

      email:
        decoded.email ||
        "",

      role: String(
        decoded.role || "user"
      )
        .trim()
        .toLowerCase(),
    };
  } catch (error) {
    console.error(
      "JWT ERROR:",
      error
    );

    return null;
  }
}

/*
==================================================
ADMIN CHECK
==================================================
*/
function isAdmin(user) {
  const role = String(
    user?.role || ""
  )
    .trim()
    .toLowerCase();

  return (
    role === "admin" ||
    role === "administrator"
  );
}

/*
==================================================
GET
==================================================

GET:

/api/message/read

Returns all unread conversation counts.

Specific:

/api/message/read?conversationId=13

Returns unread messages for conversation.

IMPORTANT:

GET does NOT mark messages as read.
==================================================
*/
export async function GET(request) {
  try {
    /* ==============================================
       AUTH
    ============================================== */

    const currentUser =
      getCurrentUser(request);

    if (!currentUser?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const conversationIdParam =
      searchParams.get(
        "conversationId"
      );

    const admin =
      isAdmin(currentUser);

    /* ==============================================
       SPECIFIC CONVERSATION
    ============================================== */

    if (conversationIdParam) {
      const conversationId =
        Number(
          conversationIdParam
        );

      if (
        !Number.isInteger(
          conversationId
        ) ||
        conversationId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid conversationId",
          },
          {
            status: 400,
          }
        );
      }

      /* ============================================
         CHECK CONVERSATION EXISTS
      ============================================ */

      const [conversationRows] =
        await db.query(
          `
          SELECT
            id,
            type,
            created_by,
            created_at,
            updated_at
          FROM conversations
          WHERE id = ?
          LIMIT 1
          `,
          [conversationId]
        );

      if (
        conversationRows.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Conversation not found",
          },
          {
            status: 404,
          }
        );
      }

      /* ============================================
         CHECK MEMBERSHIP
      ============================================ */

      const [memberRows] =
        await db.query(
          `
          SELECT
            id,
            conversation_id,
            user_id,
            role
          FROM conversation_members
          WHERE conversation_id = ?
            AND user_id = ?
          LIMIT 1
          `,
          [
            conversationId,
            currentUser.id,
          ]
        );

      /*
       * Normal users must be members.
       *
       * Admins can inspect conversations
       * without being members.
       */

      if (
        memberRows.length === 0 &&
        !admin
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "You are not a member of this conversation",
          },
          {
            status: 403,
          }
        );
      }

      /* ============================================
         GET UNREAD RECEIVED MESSAGES
      ============================================ */

      const [messages] =
        await db.query(
          `
          SELECT
            m.id,
            m.conversation_id,
            m.sender_id,
            m.sender_type,
            m.text,
            m.msg_type,
            m.file_name,
            m.file_size,
            m.file_url,
            m.is_read,
            m.created_at,

            u.name AS sender_name,
            u.email AS sender_email,
            u.role AS sender_role

          FROM messages m

          LEFT JOIN users u
            ON u.id = m.sender_id

          WHERE m.conversation_id = ?

            AND m.sender_id != ?

            AND m.is_read = 0

          ORDER BY
            m.created_at ASC,
            m.id ASC
          `,
          [
            conversationId,
            currentUser.id,
          ]
        );

      return NextResponse.json({
        success: true,

        currentUser: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        },

        isAdmin: admin,

        conversationId,

        unread_count:
          messages.length,

        unread_messages:
          messages,
      });
    }

    /* ==============================================
       ALL CONVERSATIONS UNREAD COUNTS
    ============================================== */

    let rows;

    /*
     * NORMAL USER
     *
     * Only conversations where user
     * is actually a member.
     */

    if (!admin) {
      const [normalRows] =
        await db.query(
          `
          SELECT
            m.conversation_id,

            COUNT(*) AS unread_count

          FROM messages m

          INNER JOIN conversation_members cm
            ON cm.conversation_id =
               m.conversation_id

          WHERE cm.user_id = ?

            AND m.sender_id != ?

            AND m.is_read = 0

          GROUP BY
            m.conversation_id

          ORDER BY
            m.conversation_id DESC
          `,
          [
            currentUser.id,
            currentUser.id,
          ]
        );

      rows = normalRows;
    } else {
      /*
       * ADMIN
       *
       * Admin can see conversations even when
       * admin is not a member.
       *
       * BUT we still only count messages sent
       * by someone other than this admin.
       */

      const [adminRows] =
        await db.query(
          `
          SELECT
            m.conversation_id,

            COUNT(*) AS unread_count

          FROM messages m

          INNER JOIN conversations c
            ON c.id = m.conversation_id

          WHERE m.sender_id != ?

            AND m.is_read = 0

          GROUP BY
            m.conversation_id

          ORDER BY
            m.conversation_id DESC
          `,
          [
            currentUser.id,
          ]
        );

      rows = adminRows;
    }

    /* ==============================================
       FORMAT
    ============================================== */

    const unread =
      rows.map((row) => ({
        conversation_id:
          Number(
            row.conversation_id
          ),

        unread_count:
          Number(
            row.unread_count
          ),
      }));

    /* ==============================================
       TOTAL UNREAD
    ============================================== */

    const totalUnread =
      unread.reduce(
        (total, item) =>
          total +
          item.unread_count,
        0
      );

    /* ==============================================
       RESPONSE
    ============================================== */

    return NextResponse.json({
      success: true,

      currentUser: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      },

      isAdmin: admin,

      total_unread:
        totalUnread,

      conversations:
        unread,
    });
  } catch (error) {
    console.error(
      "GET READ API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to get unread messages",
      },
      {
        status: 500,
      }
    );
  }
}

/*
==================================================
POST
==================================================

POST:

/api/message/read

Body:

{
  "conversationId": 13
}

Marks received messages as read.
==================================================
*/
export async function POST(request) {
  try {
    /* ==============================================
       AUTH
    ============================================== */

    const currentUser =
      getCurrentUser(request);

    if (!currentUser?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const conversationId =
      Number(
        body?.conversationId
      );

    if (
      !Number.isInteger(
        conversationId
      ) ||
      conversationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid conversationId is required",
        },
        {
          status: 400,
        }
      );
    }

    /* ==============================================
       CHECK CONVERSATION EXISTS
    ============================================== */

    const [conversationRows] =
      await db.query(
        `
        SELECT
          id,
          type,
          created_by
        FROM conversations
        WHERE id = ?
        LIMIT 1
        `,
        [conversationId]
      );

    if (
      conversationRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Conversation not found",
        },
        {
          status: 404,
        }
      );
    }

    /* ==============================================
       CHECK MEMBERSHIP
    ============================================== */

    const [memberRows] =
      await db.query(
        `
        SELECT
          id,
          conversation_id,
          user_id,
          role
        FROM conversation_members
        WHERE conversation_id = ?
          AND user_id = ?
        LIMIT 1
        `,
        [
          conversationId,
          currentUser.id,
        ]
      );

    const admin =
      isAdmin(currentUser);

    /*
     * IMPORTANT:
     *
     * Admin can READ/inspect any conversation.
     * Therefore admin can also mark messages read.
     */

    if (
      memberRows.length === 0 &&
      !admin
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not a member of this conversation",
        },
        {
          status: 403,
        }
      );
    }

    /* ==============================================
       MARK RECEIVED MESSAGES AS READ
    ============================================== */

    const [result] =
      await db.query(
        `
        UPDATE messages

        SET is_read = 1

        WHERE conversation_id = ?

          AND sender_id != ?

          AND is_read = 0
        `,
        [
          conversationId,
          currentUser.id,
        ]
      );

    /* ==============================================
       RESPONSE
    ============================================== */

    return NextResponse.json({
      success: true,

      message:
        "Messages marked as read",

      conversationId,

      marked_read:
        Number(
          result?.affectedRows || 0
        ),

      currentUser: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      },

      isAdmin: admin,
    });
  } catch (error) {
    console.error(
      "POST READ API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to mark messages as read",
      },
      {
        status: 500,
      }
    );
  }
}