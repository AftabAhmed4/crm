import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/*
==================================================
GET CURRENT USER FROM JWT
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
      decoded.id ||
      decoded.userId ||
      decoded._id;

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
        decoded.email ||
        "",

      email:
        decoded.email || "",

      role: String(
        decoded.role || "user"
      ).toLowerCase(),
    };
  } catch (error) {
    console.error("JWT Error:", error);
    return null;
  }
}

/*
==================================================
IS ADMIN
==================================================
*/
function isAdmin(user) {
  const role = String(
    user?.role || ""
  ).toLowerCase();

  return (
    role === "admin" ||
    role === "administrator"
  );
}

/*
==================================================
FORMAT FILE SIZE
==================================================
*/
function formatFileSize(bytes) {
  if (!bytes) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

/*
==================================================
GET INITIALS
==================================================
*/
function getInitials(name, email = "") {
  const value =
    String(name || "").trim() ||
    String(email || "").trim();

  if (!value) {
    return "";
  }

  const words = value
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return (
      words[0][0] +
      words[1][0]
    ).toUpperCase();
  }

  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

/*
==================================================
CHECK CONVERSATION MEMBER
==================================================
*/
async function isConversationMember(
  conversationId,
  userId
) {
  const [rows] = await db.query(
    `
    SELECT id

    FROM conversation_members

    WHERE conversation_id = ?
      AND user_id = ?

    LIMIT 1
    `,
    [
      conversationId,
      userId,
    ]
  );

  return rows.length > 0;
}

/*
==================================================
GET CONVERSATION MEMBERS
==================================================
*/
async function getConversationMembers(
  conversationId
) {
  const [rows] = await db.query(
    `
    SELECT
      cm.id AS member_id,
      cm.user_id,
      cm.role AS member_role,

      u.name,
      u.email,
      u.phone,
      u.role,
      u.team,
      u.status,
      u.avatar

    FROM conversation_members cm

    INNER JOIN users u
      ON u.id = cm.user_id

    WHERE cm.conversation_id = ?

    ORDER BY cm.id ASC
    `,
    [conversationId]
  );

  return rows;
}

/*
==================================================
FORMAT MEMBER
==================================================
*/
function formatMember(member) {
  return {
    id: Number(member.user_id),

    user_id: Number(
      member.user_id
    ),

    member_id: Number(
      member.member_id
    ),

    name:
      member.name ||
      member.email ||
      "",

    email:
      member.email || "",

    phone:
      member.phone || "",

    role:
      member.role || "user",

    member_role:
      member.member_role ||
      "member",

    team:
      member.team || "",

    status:
      member.status || "",

    avatar:
      member.avatar || null,

    initials:
      getInitials(
        member.name,
        member.email
      ),
  };
}

/*
==================================================
FIND EXACT DIRECT CONVERSATION
==================================================
*/
async function findDirectConversation(
  userId,
  targetUserId
) {
  const [rows] = await db.query(
    `
    SELECT
      c.id

    FROM conversations c

    WHERE c.type = 'direct'

      AND EXISTS (
        SELECT 1
        FROM conversation_members cm
        WHERE cm.conversation_id = c.id
          AND cm.user_id = ?
      )

      AND EXISTS (
        SELECT 1
        FROM conversation_members cm
        WHERE cm.conversation_id = c.id
          AND cm.user_id = ?
      )

      AND (
        SELECT COUNT(*)
        FROM conversation_members cm
        WHERE cm.conversation_id = c.id
      ) = 2

    ORDER BY c.id DESC

    LIMIT 1
    `,
    [
      userId,
      targetUserId,
    ]
  );

  return rows.length
    ? Number(rows[0].id)
    : null;
}

/*
==================================================
CREATE DIRECT CONVERSATION
==================================================
*/
async function createDirectConversation(
  userId,
  targetUserId
) {
  let connection = null;

  try {
    connection =
      await db.getConnection();

    await connection.beginTransaction();

    /*
    DOUBLE CHECK EXISTING CHAT
    */
    const [existingRows] =
      await connection.query(
        `
        SELECT
          c.id

        FROM conversations c

        WHERE c.type = 'direct'

          AND EXISTS (
            SELECT 1
            FROM conversation_members cm
            WHERE cm.conversation_id = c.id
              AND cm.user_id = ?
          )

          AND EXISTS (
            SELECT 1
            FROM conversation_members cm
            WHERE cm.conversation_id = c.id
              AND cm.user_id = ?
          )

          AND (
            SELECT COUNT(*)
            FROM conversation_members cm
            WHERE cm.conversation_id = c.id
          ) = 2

        ORDER BY c.id DESC

        LIMIT 1
        `,
        [
          userId,
          targetUserId,
        ]
      );

    if (existingRows.length) {
      await connection.rollback();

      return Number(
        existingRows[0].id
      );
    }

    /*
    CREATE CONVERSATION
    */
    const [
      conversationResult,
    ] = await connection.query(
      `
      INSERT INTO conversations
      (
        type,
        name,
        created_by,
        created_at,
        updated_at
      )

      VALUES
      (
        'direct',
        NULL,
        ?,
        NOW(),
        NOW()
      )
      `,
      [userId]
    );

    const conversationId =
      Number(
        conversationResult.insertId
      );

    /*
    ADD CURRENT USER
    */
    await connection.query(
      `
      INSERT INTO conversation_members
      (
        conversation_id,
        user_id,
        role
      )

      VALUES
      (
        ?,
        ?,
        'member'
      )
      `,
      [
        conversationId,
        userId,
      ]
    );

    /*
    ADD TARGET USER
    */
    await connection.query(
      `
      INSERT INTO conversation_members
      (
        conversation_id,
        user_id,
        role
      )

      VALUES
      (
        ?,
        ?,
        'member'
      )
      `,
      [
        conversationId,
        targetUserId,
      ]
    );

    await connection.commit();

    return conversationId;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/*
==================================================
GET
==================================================

GET /api/messages

GET /api/messages?conversationId=5
==================================================
*/
export async function GET(request) {
  try {
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
        }
      );
    }

    const {
      searchParams,
    } = new URL(request.url);

    const conversationIdParam =
      searchParams.get(
        "conversationId"
      );

    const admin =
      isAdmin(user);

    /*
    ==================================================
    ONE CONVERSATION
    ==================================================
    */
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
              "Invalid conversation ID",
          },
          {
            status: 400,
          }
        );
      }

      /*
      GET CONVERSATION
      */
      const [
        conversationRows,
      ] = await db.query(
        `
        SELECT
          id,
          name,
          type,
          avatar_bg,
          initials,
          last_msg,
          last_msg_time,
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

      const conversation =
        conversationRows[0];

      /*
      GET MEMBERS
      */
      const memberRows =
        await getConversationMembers(
          conversationId
        );

      /*
      DIRECT VALIDATION
      */
      if (
        conversation.type ===
          "direct" &&
        memberRows.length !== 2
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid direct conversation. A direct conversation must have exactly 2 members.",
          },
          {
            status: 400,
          }
        );
      }

      /*
      ==================================================
      ACCESS
      ==================================================

      ADMIN:
        Can read any conversation.

      NORMAL USER:
        Must be a member.
      ==================================================
      */
      const member =
        await isConversationMember(
          conversationId,
          user.id
        );

      if (
        !member &&
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

      /*
      ==================================================
      MARK RECEIVED MESSAGES READ
      ==================================================

      IMPORTANT:
      This only runs when a specific conversation
      is opened.

      Background conversation refresh should use:
      GET /api/messages

      and NOT:
      GET /api/messages?conversationId=...
      ==================================================
      */
      await db.query(
        `
        UPDATE messages

        SET is_read = 1

        WHERE conversation_id = ?

          AND sender_id != ?

          AND COALESCE(is_read, 0) = 0
        `,
        [
          conversationId,
          user.id,
        ]
      );

      /*
      ==================================================
      GET MESSAGES
      ==================================================
      */
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

            COALESCE(
              NULLIF(
                TRIM(u.name),
                ''
              ),
              NULLIF(
                TRIM(u.email),
                ''
              ),
              ''
            ) AS sender_name,

            COALESCE(
              u.email,
              ''
            ) AS sender_email,

            u.role AS sender_role,
            u.avatar AS sender_avatar

          FROM messages m

          LEFT JOIN users u
            ON u.id = m.sender_id

          WHERE m.conversation_id = ?

          ORDER BY
            m.created_at ASC,
            m.id ASC
          `,
          [conversationId]
        );

      /*
      ==================================================
      UNREAD COUNT
      ==================================================
      */

      /*
      After opening the conversation,
      received messages have been marked read.

      Therefore this will normally return 0.

      This is intentional.
      */
      const [
        unreadRows,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS unread_count

        FROM messages

        WHERE conversation_id = ?

          AND sender_id != ?

          AND COALESCE(is_read, 0) = 0
        `,
        [
          conversationId,
          user.id,
        ]
      );

      /*
      RETURN ONE CONVERSATION
      */
      return NextResponse.json({
        success: true,

        currentUser: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },

        isAdmin: admin,

        conversation,

        conversationId,

        members:
          memberRows.map(
            formatMember
          ),

        messages,

        unread_count: Number(
          unreadRows[0]
            ?.unread_count || 0
        ),
      });
    }

    /*
    ==================================================
    GET ALL USERS
    ==================================================
    */
    const [users] =
      await db.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          u.role,
          u.team,
          u.status,
          u.avatar,
          u.last_login,
          u.login_time,
          u.logout_time,
          u.created_at,
          u.updated_at

        FROM users u

        WHERE u.id != ?

        ORDER BY u.id ASC
        `,
        [user.id]
      );

    const formattedUsers =
      users.map((item) => ({
        ...item,

        id: Number(item.id),

        name:
          item.name ||
          item.email ||
          "",

        email:
          item.email || "",

        initials:
          getInitials(
            item.name,
            item.email
          ),
      }));

    /*
    ==================================================
    GET CONVERSATIONS
    ==================================================

    ADMIN:
      ALL conversations.

    NORMAL USER:
      Only conversations where user is member.
    ==================================================
    */
    let conversationRows;

    if (admin) {
      const [rows] =
        await db.query(
          `
          SELECT
            c.id,
            c.type,
            c.name,
            c.created_by,
            c.created_at,
            c.updated_at

          FROM conversations c

          ORDER BY
            COALESCE(
              c.last_msg_time,
              c.updated_at,
              c.created_at
            ) DESC,

            c.id DESC
          `
        );

      conversationRows = rows;
    } else {
      const [rows] =
        await db.query(
          `
          SELECT
            c.id,
            c.type,
            c.name,
            c.created_by,
            c.created_at,
            c.updated_at

          FROM conversations c

          INNER JOIN conversation_members cm
            ON cm.conversation_id = c.id

          WHERE cm.user_id = ?

          ORDER BY
            COALESCE(
              c.last_msg_time,
              c.updated_at,
              c.created_at
            ) DESC,

            c.id DESC
          `,
          [user.id]
        );

      conversationRows = rows;
    }

    const conversations = [];

    /*
    ==================================================
    BUILD CONVERSATIONS
    ==================================================
    */
    for (
      const conversation of
        conversationRows
    ) {
      const id =
        Number(
          conversation.id
        );

      /*
      GET MEMBERS
      */
      const memberRows =
        await getConversationMembers(
          id
        );

      /*
      DIRECT VALIDATION
      */
      if (
        conversation.type ===
          "direct" &&
        memberRows.length !== 2
      ) {
        console.warn(
          `Skipping invalid direct conversation ${id}. Members: ${memberRows.length}`
        );

        continue;
      }

      /*
      ==================================================
      GET LAST MESSAGE
      ==================================================
      */
      const [
        lastMessageRows,
      ] = await db.query(
        `
        SELECT
          m.id,
          m.sender_id,
          m.text,
          m.msg_type,
          m.file_name,
          m.file_size,
          m.file_url,
          m.is_read,
          m.created_at,

          COALESCE(
            NULLIF(
              TRIM(u.name),
              ''
            ),
            NULLIF(
              TRIM(u.email),
              ''
            ),
            ''
          ) AS sender_name,

          COALESCE(
            u.email,
            ''
          ) AS sender_email

        FROM messages m

        LEFT JOIN users u
          ON u.id = m.sender_id

        WHERE m.conversation_id = ?

        ORDER BY
          m.created_at DESC,
          m.id DESC

        LIMIT 1
        `,
        [id]
      );

      const lastMessage =
        lastMessageRows[0] ||
        null;

      /*
      ==================================================
      UNREAD COUNT
      ==================================================

      IMPORTANT:

      Count only messages:

      1. In this conversation
      2. Not sent by current user
      3. is_read = 0

      COALESCE handles NULL safely.
      ==================================================
      */
      const [
        unreadRows,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS unread_count

        FROM messages

        WHERE conversation_id = ?

          AND sender_id != ?

          AND COALESCE(is_read, 0) = 0
        `,
        [
          id,
          user.id,
        ]
      );

      const unreadCount =
        Number(
          unreadRows[0]
            ?.unread_count || 0
        );

      /*
      ==================================================
      FORMAT MEMBERS
      ==================================================
      */
      const formattedMembers =
        memberRows.map(
          formatMember
        );

      /*
      ==================================================
      CONVERSATION NAME
      ==================================================
      */
      let name = "";
      let email = "";
      let avatar = null;

      if (
        conversation.type ===
        "group"
      ) {
        name =
          conversation.name ||
          "Unnamed Group";
      } else {
        /*
        DIRECT CHAT
        */

        const otherUsers =
          memberRows.filter(
            (member) =>
              Number(
                member.user_id
              ) !==
              Number(user.id)
          );

        /*
        ADMIN
        */
        if (admin) {
          /*
          ADMIN IS MEMBER
          */
          if (
            memberRows.some(
              (member) =>
                Number(
                  member.user_id
                ) ===
                Number(user.id)
            )
          ) {
            const otherUser =
              otherUsers[0] ||
              null;

            name =
              otherUser?.name ||
              otherUser?.email ||
              "";

            email =
              otherUser?.email ||
              "";

            avatar =
              otherUser?.avatar ||
              null;
          } else {
            /*
            ADMIN IS NOT MEMBER

            SHOW BOTH USERS
            */
            const personNames =
              memberRows
                .map(
                  (member) =>
                    member.name ||
                    member.email ||
                    `User ${member.user_id}`
                )
                .filter(Boolean);

            name =
              personNames.join(
                " ↔ "
              );

            email =
              memberRows
                .map(
                  (member) =>
                    member.email ||
                    ""
                )
                .filter(Boolean)
                .join(", ");

            avatar = null;
          }
        } else {
          /*
          NORMAL USER
          */
          const otherUser =
            otherUsers[0] ||
            null;

          name =
            otherUser?.name ||
            otherUser?.email ||
            "";

          email =
            otherUser?.email ||
            "";

          avatar =
            otherUser?.avatar ||
            null;
        }
      }

      /*
      ==================================================
      LAST MESSAGE TEXT
      ==================================================
      */
      let lastMsg =
        "No messages yet";

      if (lastMessage) {
        if (
          lastMessage.msg_type ===
          "image"
        ) {
          lastMsg =
            lastMessage.text ||
            "📷 Image";
        } else if (
          lastMessage.msg_type ===
          "file"
        ) {
          lastMsg =
            lastMessage.text ||
            `📎 ${
              lastMessage.file_name ||
              "File"
            }`;
        } else {
          lastMsg =
            lastMessage.text || "";
        }
      }

      /*
      ==================================================
      MEMBER COUNT
      ==================================================
      */
      const memberCount =
        memberRows.length;

      /*
      ==================================================
      PUSH CONVERSATION
      ==================================================
      */
      conversations.push({
        id,

        type:
          conversation.type ||
          "direct",

        name,

        email,

        initials:
          getInitials(
            name,
            email
          ),

        avatar,

        avatar_bg:
          conversation.type ===
          "group"
            ? "bg-rose-100 text-rose-600"
            : "bg-emerald-100 text-emerald-600",

        avatarBg:
          conversation.type ===
          "group"
            ? "bg-rose-100 text-rose-600"
            : "bg-emerald-100 text-emerald-600",

        members:
          formattedMembers,

        member_count:
          memberCount,

        created_by:
          Number(
            conversation.created_by
          ),

        created_at:
          conversation.created_at,

        updated_at:
          conversation.updated_at,

        lastMsg,

        last_msg:
          lastMsg,

        last_msg_time:
          lastMessage?.created_at ||
          null,

        /*
        ==============================================
        IMPORTANT UNREAD COUNT
        ==============================================
        */
        unread_count:
          unreadCount,

        last_message:
          lastMessage || null,

        /*
        ==============================================
        CAN SEND
        ==============================================
        */
        can_send:
          admin ||
          member,
      });
    }

    /*
    ==================================================
    RETURN ALL DATA
    ==================================================
    */
    return NextResponse.json({
      success: true,

      currentUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },

      isAdmin: admin,

      users:
        formattedUsers,

      conversations,
    });
  } catch (error) {
    console.error(
      "GET Messages API Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to load messages",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}

/*
==================================================
POST MESSAGE
==================================================
*/
export async function POST(request) {
  try {
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
        }
      );
    }

    const admin =
      isAdmin(user);

    const contentType =
      request.headers.get(
        "content-type"
      ) || "";

    let conversationId = null;
    let targetUserId = null;
    let text = null;
    let msgType = "text";
    let fileName = null;
    let fileSize = null;
    let fileUrl = null;

    /*
    ==================================================
    FORM DATA
    ==================================================
    */
    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      const conversationValue =
        formData.get(
          "conversationId"
        );

      const targetUserValue =
        formData.get("userId") ||
        formData.get(
          "targetUserId"
        );

      const textValue =
        formData.get("text");

      const msgTypeValue =
        formData.get("msgType");

      const file =
        formData.get("file");

      if (conversationValue) {
        conversationId =
          Number(
            conversationValue
          );
      }

      if (targetUserValue) {
        targetUserId =
          Number(
            targetUserValue
          );
      }

      if (
        typeof textValue ===
          "string" &&
        textValue.trim()
      ) {
        text =
          textValue.trim();
      }

      if (
        [
          "text",
          "image",
          "file",
        ].includes(
          msgTypeValue
        )
      ) {
        msgType =
          msgTypeValue;
      }

      /*
      FILE UPLOAD
      */
      if (
        file instanceof File &&
        file.size > 0
      ) {
        const bytes =
          await file.arrayBuffer();

        const buffer =
          Buffer.from(bytes);

        const uploadDirectory =
          path.join(
            process.cwd(),
            "public",
            "uploads",
            "messages"
          );

        await mkdir(
          uploadDirectory,
          {
            recursive: true,
          }
        );

        const originalName =
          file.name;

        const safeName =
          originalName
            .replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            )
            .replace(
              /_+/g,
              "_"
            );

        const uniqueName =
          `${Date.now()}-${Math.random()
            .toString(36)
            .substring(
              2,
              8
            )}-${safeName}`;

        const filePath =
          path.join(
            uploadDirectory,
            uniqueName
          );

        await writeFile(
          filePath,
          buffer
        );

        fileName =
          originalName;

        fileSize =
          formatFileSize(
            file.size
          );

        fileUrl =
          `/uploads/messages/${uniqueName}`;

        if (
          file.type.startsWith(
            "image/"
          )
        ) {
          msgType =
            "image";
        } else {
          msgType =
            "file";
        }
      }
    } else {
      /*
      ==================================================
      JSON
      ==================================================
      */
      const body =
        await request.json();

      if (
        body.conversationId
      ) {
        conversationId =
          Number(
            body.conversationId
          );
      }

      if (
        body.userId ||
        body.targetUserId
      ) {
        targetUserId =
          Number(
            body.userId ||
              body.targetUserId
          );
      }

      if (
        typeof body.text ===
          "string" &&
        body.text.trim()
      ) {
        text =
          body.text.trim();
      }

      if (
        [
          "text",
          "image",
          "file",
        ].includes(
          body.msgType
        )
      ) {
        msgType =
          body.msgType;
      }

      fileName =
        body.fileName ||
        null;

      fileSize =
        body.fileSize ||
        null;

      fileUrl =
        body.fileUrl ||
        null;
    }

    /*
    ==================================================
    VALIDATE TARGET USER
    ==================================================
    */
    if (
      targetUserId !== null &&
      (
        !Number.isInteger(
          targetUserId
        ) ||
        targetUserId <= 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid target user",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ==================================================
    CANNOT MESSAGE SELF
    ==================================================
    */
    if (
      targetUserId &&
      Number(targetUserId) ===
        Number(user.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot send a message to yourself",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ==================================================
    VALIDATE MESSAGE
    ==================================================
    */
    if (
      !text &&
      !fileUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message text or file is required",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ==================================================
    TARGET USER PROVIDED
    ==================================================
    */
    if (targetUserId) {
      /*
      TARGET EXISTS
      */
      const [
        targetRows,
      ] = await db.query(
        `
        SELECT
          id,
          name,
          email,
          role,
          status,
          avatar

        FROM users

        WHERE id = ?

        LIMIT 1
        `,
        [targetUserId]
      );

      if (
        targetRows.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Target user not found",
          },
          {
            status: 404,
          }
        );
      }

      /*
      FIND EXACT 2-PERSON CHAT
      */
      conversationId =
        await findDirectConversation(
          user.id,
          targetUserId
        );

      /*
      CREATE IF NOT EXISTS
      */
      if (!conversationId) {
        conversationId =
          await createDirectConversation(
            user.id,
            targetUserId
          );
      }
    }

    /*
    ==================================================
    CONVERSATION ID REQUIRED
    ==================================================
    */
    if (
      !conversationId ||
      !Number.isInteger(
        Number(conversationId)
      ) ||
      Number(conversationId) <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "conversationId or userId is required",
        },
        {
          status: 400,
        }
      );
    }

    conversationId =
      Number(
        conversationId
      );

    /*
    ==================================================
    GET CONVERSATION
    ==================================================
    */
    const [
      conversationRows,
    ] = await db.query(
      `
      SELECT
        id,
        type,
        name

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

    const conversation =
      conversationRows[0];

    /*
    ==================================================
    DIRECT CHAT SECURITY
    ==================================================
    */
    if (
      conversation.type ===
      "direct"
    ) {
      const [
        directMembers,
      ] = await db.query(
        `
        SELECT
          user_id

        FROM conversation_members

        WHERE conversation_id = ?
        `,
        [conversationId]
      );

      if (
        directMembers.length !==
        2
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid direct conversation. A direct conversation must have exactly 2 members.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    ==================================================
    CHECK CURRENT USER MEMBERSHIP
    ==================================================

    NORMAL USER:
      Must be member.

    ADMIN:
      Can send into ANY conversation.
    ==================================================
    */
    const member =
      await isConversationMember(
        conversationId,
        user.id
      );

    if (
      !member &&
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

    /*
    ==================================================
    ADMIN AUTO-ADD AS MEMBER
    ==================================================
    */
    if (
      admin &&
      !member
    ) {
      await db.query(
        `
        INSERT INTO conversation_members
        (
          conversation_id,
          user_id,
          role
        )

        VALUES
        (
          ?,
          ?,
          'admin'
        )
        `,
        [
          conversationId,
          user.id,
        ]
      );
    }

    /*
    ==================================================
    INSERT MESSAGE
    ==================================================
    */

    /*
    IMPORTANT:

    is_read = 1

    because the sender has already
    "read" their own message.

    Recipient will see:
    is_read = 0
    and therefore unread_count will increase.
    */
    const [
      result,
    ] = await db.query(
      `
      INSERT INTO messages
      (
        conversation_id,
        sender_id,
        sender_type,
        text,
        msg_type,
        file_name,
        file_size,
        file_url,
        is_read
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
        ?
      )
      `,
      [
        conversationId,

        user.id,

        "me",

        text,

        msgType,

        fileName,

        fileSize,

        fileUrl,

        1,
      ]
    );

    const messageId =
      Number(
        result.insertId
      );

    /*
    ==================================================
    LAST MESSAGE TEXT
    ==================================================
    */
    let lastMessage =
      text || "";

    if (
      msgType === "image"
    ) {
      lastMessage =
        text ||
        "📷 Image";
    }

    if (
      msgType === "file"
    ) {
      lastMessage =
        text ||
        `📎 ${
          fileName ||
          "File"
        }`;
    }

    /*
    ==================================================
    UPDATE CONVERSATION
    ==================================================
    */
    await db.query(
      `
      UPDATE conversations

      SET
        last_msg = ?,
        last_msg_time = NOW(),
        updated_at = NOW()

      WHERE id = ?
      `,
      [
        lastMessage,
        conversationId,
      ]
    );

    /*
    ==================================================
    GET INSERTED MESSAGE
    ==================================================
    */
    const [
      newMessageRows,
    ] = await db.query(
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

        COALESCE(
          NULLIF(
            TRIM(u.name),
            ''
          ),
          NULLIF(
            TRIM(u.email),
            ''
          ),
          ''
        ) AS sender_name,

        COALESCE(
          u.email,
          ''
        ) AS sender_email,

        u.role AS sender_role,

        u.avatar AS sender_avatar

      FROM messages m

      LEFT JOIN users u
        ON u.id = m.sender_id

      WHERE m.id = ?

      LIMIT 1
      `,
      [messageId]
    );

    /*
    ==================================================
    RETURN
    ==================================================
    */
    return NextResponse.json(
      {
        success: true,

        message:
          "Message sent successfully",

        conversationId,

        targetUserId:
          targetUserId ||
          null,

        isAdmin: admin,

        data:
          newMessageRows[0],

        /*
        Sender doesn't have an unread
        message from their own send.
        */
        unread_count: 0,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST Messages API Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to send message",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}