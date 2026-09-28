import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../lib/db";

export const runtime = "nodejs";

/* =========================================================
   GET CURRENT USER
========================================================= */

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
    console.error(
      "GET CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

/* =========================================================
   ADMIN
========================================================= */

function isAdmin(user) {
  const role = String(
    user?.role || ""
  ).toLowerCase();

  return (
    role === "admin" ||
    role === "administrator"
  );
}

/* =========================================================
   INITIALS
========================================================= */

function getInitials(
  name,
  email = ""
) {
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
    .replace(
      /[^a-zA-Z0-9]/g,
      ""
    )
    .slice(0, 2)
    .toUpperCase();
}

/* =========================================================
   FORMAT USER
========================================================= */

function formatUser(user) {
  return {
    id: Number(user.id),

    name:
      user.name ||
      user.email ||
      "",

    email:
      user.email || "",

    phone:
      user.phone || "",

    role:
      user.role || "user",

    team:
      user.team || "",

    status:
      user.status || "",

    avatar:
      user.avatar || null,

    last_login:
      user.last_login || null,

    login_time:
      user.login_time || null,

    logout_time:
      user.logout_time || null,

    created_at:
      user.created_at || null,

    updated_at:
      user.updated_at || null,

    initials:
      getInitials(
        user.name,
        user.email
      ),
  };
}

/* =========================================================
   EXTRACT USER IDS
========================================================= */

function extractUserIds(rawMembers) {
  if (!Array.isArray(rawMembers)) {
    return [];
  }

  const ids = [];

  for (const member of rawMembers) {
    let id = null;

    if (
      typeof member ===
      "number"
    ) {
      id = member;
    } else if (
      typeof member ===
      "string"
    ) {
      id = member.trim();
    } else if (
      member &&
      typeof member ===
        "object"
    ) {
      id =
        member.user_id ??
        member.userId ??
        member.id ??
        member.value ??
        member.uid;
    }

    const numericId =
      Number(id);

    if (
      Number.isInteger(
        numericId
      ) &&
      numericId > 0
    ) {
      ids.push(numericId);
    }
  }

  return [
    ...new Set(ids),
  ];
}

/* =========================================================
   GET CONVERSATION MEMBERS
========================================================= */

async function getConversationMembers(
  conversationId
) {
  const [rows] =
    await db.query(
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

      WHERE
        cm.conversation_id = ?

      ORDER BY
        cm.id ASC
      `,
      [conversationId]
    );

  return rows.map(
    (member) => ({
      member_id:
        Number(
          member.member_id
        ),

      id:
        Number(
          member.user_id
        ),

      user_id:
        Number(
          member.user_id
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
    })
  );
}

/* =========================================================
   GET LAST MESSAGE
========================================================= */

async function getLastMessage(
  conversationId
) {
  const [rows] =
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
        ) AS sender_email

      FROM messages m

      LEFT JOIN users u
        ON u.id = m.sender_id

      WHERE
        m.conversation_id = ?

      ORDER BY
        m.created_at DESC,
        m.id DESC

      LIMIT 1
      `,
      [conversationId]
    );

  return rows[0] || null;
}

/* =========================================================
   FORMAT LAST MESSAGE
========================================================= */

function formatLastMessage(
  message
) {
  if (!message) {
    return "No messages yet";
  }

  if (
    message.msg_type ===
    "image"
  ) {
    return (
      message.text ||
      "📷 Image"
    );
  }

  if (
    message.msg_type ===
    "file"
  ) {
    return (
      message.text ||
      `📎 ${
        message.file_name ||
        "File"
      }`
    );
  }

  return message.text || "";
}

/* =========================================================
   UNREAD COUNT
========================================================= */

async function getUnreadCount(
  conversationId,
  userId
) {
  const [rows] =
    await db.query(
      `
      SELECT
        COUNT(*) AS unread_count

      FROM messages

      WHERE
        conversation_id = ?

        AND sender_id != ?

        AND is_read = 0
      `,
      [
        conversationId,
        userId,
      ]
    );

  return Number(
    rows[0]?.unread_count || 0
  );
}

/* =========================================================
   GET
   /api/conversations
========================================================= */

export async function GET(request) {
  try {
    /* -----------------------------------------------------
       CURRENT USER
    ----------------------------------------------------- */

    const currentUser =
      getCurrentUser(request);

    if (!currentUser) {
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
      isAdmin(currentUser);

    /* -----------------------------------------------------
       USERS
    ----------------------------------------------------- */

    const [userRows] =
      await db.query(
        `
        SELECT
          id,
          name,
          email,
          phone,
          role,
          team,
          status,
          avatar,
          last_login,
          login_time,
          logout_time,
          created_at,
          updated_at

        FROM users

        WHERE id != ?

        ORDER BY id ASC
        `,
        [currentUser.id]
      );

    const users =
      userRows.map(
        formatUser
      );

    /* -----------------------------------------------------
       CONVERSATIONS
    ----------------------------------------------------- */

    let conversationRows = [];

    if (admin) {
      /*
       ADMIN CAN SEE ALL CONVERSATIONS
      */

      const [rows] =
        await db.query(
          `
          SELECT
            c.id,
            c.type,
            c.name,
            c.created_by,
            c.created_at,
            c.updated_at,
            c.last_msg,
            c.last_msg_time

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

      conversationRows =
        rows;
    } else {
      /*
       NORMAL USER ONLY SEES
       HIS OWN CONVERSATIONS
      */

      const [rows] =
        await db.query(
          `
          SELECT DISTINCT
            c.id,
            c.type,
            c.name,
            c.created_by,
            c.created_at,
            c.updated_at,
            c.last_msg,
            c.last_msg_time

          FROM conversations c

          INNER JOIN conversation_members cm
            ON cm.conversation_id =
               c.id

          WHERE
            cm.user_id = ?

          ORDER BY
            COALESCE(
              c.last_msg_time,
              c.updated_at,
              c.created_at
            ) DESC,

            c.id DESC
          `,
          [currentUser.id]
        );

      conversationRows =
        rows;
    }

    /* -----------------------------------------------------
       BUILD RESULT
    ----------------------------------------------------- */

    const conversations = [];

    for (
      const conversation
      of conversationRows
    ) {
      const conversationId =
        Number(
          conversation.id
        );

      if (
        !Number.isInteger(
          conversationId
        ) ||
        conversationId <= 0
      ) {
        continue;
      }

      /* ---------------------------------------------------
         MEMBERS
      --------------------------------------------------- */

      const members =
        await getConversationMembers(
          conversationId
        );

      /* ---------------------------------------------------
         DIRECT MUST HAVE 2 MEMBERS
      --------------------------------------------------- */

      if (
        conversation.type ===
          "direct" &&
        members.length !== 2
      ) {
        console.warn(
          `Skipping invalid direct conversation ${conversationId}. Members=${members.length}`
        );

        continue;
      }

      /* ---------------------------------------------------
         NORMAL USER SECURITY
      --------------------------------------------------- */

      if (!admin) {
        const isMember =
          members.some(
            (member) =>
              Number(
                member.user_id
              ) ===
              Number(
                currentUser.id
              )
          );

        if (!isMember) {
          continue;
        }
      }

      /* ---------------------------------------------------
         LAST MESSAGE
      --------------------------------------------------- */

      const lastMessage =
        await getLastMessage(
          conversationId
        );

      /* ---------------------------------------------------
         UNREAD
      --------------------------------------------------- */

      const unreadCount =
        await getUnreadCount(
          conversationId,
          currentUser.id
        );

      /* ---------------------------------------------------
         DISPLAY
      --------------------------------------------------- */

      let chatName = "";
      let chatEmail = "";
      let chatAvatar = null;
      let initials = "";

      /* ===================================================
         GROUP
      =================================================== */

      if (
        conversation.type ===
        "group"
      ) {
        chatName =
          conversation.name ||
          "Unnamed Group";

        initials =
          getInitials(
            chatName
          );
      }

      /* ===================================================
         DIRECT
      =================================================== */

      else {
        const otherUser =
          members.find(
            (member) =>
              Number(
                member.user_id
              ) !==
              Number(
                currentUser.id
              )
          );

        /*
         IMPORTANT:
         BOTH ADMIN AND NORMAL USER
         GET THE OTHER USER HERE.

         This fixes Admin -> Admin
         private chat display.
        */

        chatName =
          otherUser?.name ||
          otherUser?.email ||
          "Unknown User";

        chatEmail =
          otherUser?.email ||
          "";

        chatAvatar =
          otherUser?.avatar ||
          null;

        initials =
          getInitials(
            chatName,
            chatEmail
          );
      }

      /* ---------------------------------------------------
         LAST MESSAGE TEXT
      --------------------------------------------------- */

      const lastMsg =
        formatLastMessage(
          lastMessage
        );

      /* ---------------------------------------------------
         TIME
      --------------------------------------------------- */

      const time =
        lastMessage?.created_at
          ? new Date(
              lastMessage.created_at
            ).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            )
          : "";

      /* ---------------------------------------------------
         PUSH
      --------------------------------------------------- */

      conversations.push({
        id: conversationId,

        type:
          conversation.type ||
          "direct",

        name: chatName,

        email: chatEmail,

        initials,

        avatar: chatAvatar,

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

        members,

        member_count:
          members.length,

        can_view: true,

        can_send:
          conversation.type ===
          "group"
            ? members.some(
                (member) =>
                  Number(
                    member.user_id
                  ) ===
                  Number(
                    currentUser.id
                  )
              )
            : members.some(
                (member) =>
                  Number(
                    member.user_id
                  ) ===
                  Number(
                    currentUser.id
                  )
              ),

        is_admin: admin,

        created_by:
          Number(
            conversation.created_by
          ),

        created_at:
          conversation.created_at,

        updated_at:
          conversation.updated_at,

        messages: [],

        lastMsg,

        last_msg: lastMsg,

        last_msg_time:
          lastMessage?.created_at ||
          null,

        unread_count:
          unreadCount,

        last_message:
          lastMessage || null,

        time,
      });
    }

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return NextResponse.json({
      success: true,

      currentUser: {
        id: currentUser.id,

        name:
          currentUser.name,

        email:
          currentUser.email,

        role:
          currentUser.role,

        isAdmin: admin,
      },

      users,

      conversations,

      adminCanViewAllChats:
        admin,
    });
  } catch (error) {
    console.error(
      "GET /api/conversations ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error.message ||
          "Failed to load conversations",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   CREATE DIRECT OR GROUP CONVERSATION
========================================================= */

export async function POST(request) {
  let connection = null;

  try {
    /* -----------------------------------------------------
       CURRENT USER
    ----------------------------------------------------- */

    const currentUser =
      getCurrentUser(request);

    if (!currentUser) {
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

    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    const body =
      await request.json();

    const type =
      String(
        body?.type || "direct"
      )
        .trim()
        .toLowerCase();

    const name =
      String(
        body?.name || ""
      ).trim();

    let rawMembers =
      body?.members;

    if (
      !Array.isArray(
        rawMembers
      )
    ) {
      rawMembers =
        body?.userIds;
    }

    if (
      !Array.isArray(
        rawMembers
      )
    ) {
      rawMembers =
        body?.selectedUsers;
    }

    if (
      !Array.isArray(
        rawMembers
      )
    ) {
      rawMembers = [];
    }

    /* -----------------------------------------------------
       ONLY DIRECT OR GROUP
    ----------------------------------------------------- */

    if (
      type !== "direct" &&
      type !== "group"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Conversation type must be direct or group",
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------------------
       EXTRACT IDS
    ----------------------------------------------------- */

    let memberIds =
      extractUserIds(
        rawMembers
      );

    /* -----------------------------------------------------
       DIRECT CHAT
       MUST HAVE EXACTLY ONE OTHER USER
    ----------------------------------------------------- */

    if (
      type === "direct"
    ) {
      /*
       If frontend sends current user too,
       remove current user first.
      */

      memberIds =
        memberIds.filter(
          (id) =>
            Number(id) !==
            Number(
              currentUser.id
            )
        );

      /*
       DIRECT CHAT REQUIRES
       EXACTLY ONE OTHER USER.
      */

      if (
        memberIds.length !== 1
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              "A private chat requires exactly one other user",

            receivedMembers:
              memberIds,
          },
          {
            status: 400,
          }
        );
      }
    }

    /* -----------------------------------------------------
       GROUP CHAT
    ----------------------------------------------------- */

    if (
      type === "group"
    ) {
      /*
       ADD CREATOR
      */

      if (
        !memberIds.includes(
          currentUser.id
        )
      ) {
        memberIds.unshift(
          currentUser.id
        );
      }

      if (
        memberIds.length < 2
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              "A group must have at least 2 members",
          },
          {
            status: 400,
          }
        );
      }

      if (!name) {
        return NextResponse.json(
          {
            success: false,

            message:
              "Group name is required",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* -----------------------------------------------------
       FINAL MEMBER LIST
    ----------------------------------------------------- */

    const finalMemberIds =
      [
        ...new Set(
          [
            ...memberIds,
            currentUser.id,
          ]
        ),
      ];

    /* -----------------------------------------------------
       DIRECT FINAL VALIDATION
    ----------------------------------------------------- */

    if (
      type === "direct" &&
      finalMemberIds.length !== 2
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "A private conversation must contain exactly 2 users",
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------------------
       VERIFY USERS
    ----------------------------------------------------- */

    const placeholders =
      finalMemberIds
        .map(() => "?")
        .join(",");

    const [
      validUsers,
    ] =
      await db.query(
        `
        SELECT
          id,
          name,
          email,
          role,
          team,
          status,
          avatar

        FROM users

        WHERE
          id IN (${placeholders})
        `,
        finalMemberIds
      );

    const validUserIds =
      validUsers.map(
        (user) =>
          Number(
            user.id
          )
      );

    const invalidUsers =
      finalMemberIds.filter(
        (id) =>
          !validUserIds.includes(
            Number(id)
          )
      );

    if (
      invalidUsers.length
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "One or more users do not exist",

          invalidUsers,
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------------------
       TRANSACTION
    ----------------------------------------------------- */

    connection =
      await db.getConnection();

    await connection.beginTransaction();

    /* =====================================================
       DIRECT CHAT
       FIND EXISTING CONVERSATION
    ===================================================== */

    if (
      type === "direct"
    ) {
      const otherUserId =
        finalMemberIds.find(
          (id) =>
            Number(id) !==
            Number(
              currentUser.id
            )
        );

      /*
       Find a direct conversation
       containing BOTH users.

       GROUPS ARE NOT MATCHED.
      */

      const [
        existingRows,
      ] =
        await connection.query(
          `
          SELECT
            c.id,
            c.type,
            c.name,
            c.created_by,
            c.created_at,
            c.updated_at

          FROM conversations c

          INNER JOIN conversation_members cm1
            ON cm1.conversation_id = c.id
            AND cm1.user_id = ?

          INNER JOIN conversation_members cm2
            ON cm2.conversation_id = c.id
            AND cm2.user_id = ?

          WHERE
            c.type = 'direct'

          GROUP BY
            c.id

          HAVING
            COUNT(DISTINCT cm1.user_id) = 1
            AND COUNT(DISTINCT cm2.user_id) = 1

          ORDER BY
            c.id DESC

          LIMIT 1
          `,
          [
            currentUser.id,
            otherUserId,
          ]
        );

      if (
        existingRows.length
      ) {
        const existing =
          existingRows[0];

        /*
         VERIFY IT HAS EXACTLY
         TWO MEMBERS.

         This prevents accidentally
         reusing a broken direct chat.
        */

        const [
          memberRows,
        ] =
          await connection.query(
            `
            SELECT
              user_id

            FROM conversation_members

            WHERE
              conversation_id = ?
            `,
            [
              existing.id,
            ]
          );

        const existingMemberIds =
          memberRows.map(
            (row) =>
              Number(
                row.user_id
              )
          );

        const validDirect =
          existingMemberIds.length ===
            2 &&
          existingMemberIds.includes(
            Number(
              currentUser.id
            )
          ) &&
          existingMemberIds.includes(
            Number(
              otherUserId
            )
          );

        if (validDirect) {
          await connection.commit();

          const members =
            await getConversationMembers(
              existing.id
            );

          const lastMessage =
            await getLastMessage(
              existing.id
            );

          const unreadCount =
            await getUnreadCount(
              existing.id,
              currentUser.id
            );

          const otherUser =
            members.find(
              (member) =>
                Number(
                  member.user_id
                ) !==
                Number(
                  currentUser.id
                )
            );

          return NextResponse.json(
            {
              success: true,

              existing: true,

              message:
                "Private conversation already exists",

              conversationId:
                Number(
                  existing.id
                ),

              conversation: {
                id:
                  Number(
                    existing.id
                  ),

                type:
                  "direct",

                name:
                  otherUser?.name ||
                  otherUser?.email ||
                  "Private Chat",

                email:
                  otherUser?.email ||
                  "",

                avatar:
                  otherUser?.avatar ||
                  null,

                initials:
                  getInitials(
                    otherUser?.name,
                    otherUser?.email
                  ),

                created_by:
                  Number(
                    existing.created_by
                  ),

                created_at:
                  existing.created_at,

                updated_at:
                  existing.updated_at,

                member_count:
                  members.length,

                members,

                messages: [],

                lastMsg:
                  formatLastMessage(
                    lastMessage
                  ),

                last_msg:
                  formatLastMessage(
                    lastMessage
                  ),

                last_msg_time:
                  lastMessage?.created_at ||
                  null,

                unread_count:
                  unreadCount,

                last_message:
                  lastMessage || null,
              },
            },
            {
              status: 200,
            }
          );
        }
      }

      /* =================================================
         CREATE NEW DIRECT CHAT
      ================================================= */

      const [
        conversationResult,
      ] =
        await connection.query(
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
          [
            currentUser.id,
          ]
        );

      const conversationId =
        Number(
          conversationResult.insertId
        );

      /* ---------------------------------------------------
         ADD BOTH MEMBERS
      --------------------------------------------------- */

      for (
        const userId
        of finalMemberIds
      ) {
        const memberRole =
          Number(userId) ===
          Number(
            currentUser.id
          )
            ? "admin"
            : "member";

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
            ?
          )
          `,
          [
            conversationId,
            userId,
            memberRole,
          ]
        );
      }

      await connection.commit();

      const members =
        await getConversationMembers(
          conversationId
        );

      const otherUser =
        members.find(
          (member) =>
            Number(
              member.user_id
            ) !==
            Number(
              currentUser.id
            )
        );

      return NextResponse.json(
        {
          success: true,

          existing: false,

          message:
            "Private conversation created successfully",

          conversationId,

          conversation: {
            id:
              conversationId,

            type:
              "direct",

            name:
              otherUser?.name ||
              otherUser?.email ||
              "Private Chat",

            email:
              otherUser?.email ||
              "",

            avatar:
              otherUser?.avatar ||
              null,

            initials:
              getInitials(
                otherUser?.name,
                otherUser?.email
              ),

            created_by:
              currentUser.id,

            created_at:
              new Date(),

            updated_at:
              new Date(),

            member_count:
              members.length,

            members,

            messages: [],

            lastMsg:
              "No messages yet",

            last_msg:
              "No messages yet",

            last_msg_time:
              null,

            unread_count: 0,

            last_message:
              null,
          },
        },
        {
          status: 201,
        }
      );
    }

    /* =====================================================
       GROUP CHAT
    ===================================================== */

    const [
      conversationResult,
    ] =
      await connection.query(
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
          'group',
          ?,
          ?,
          NOW(),
          NOW()
        )
        `,
        [
          name,
          currentUser.id,
        ]
      );

    const conversationId =
      Number(
        conversationResult.insertId
      );

    /* -----------------------------------------------------
       ADD GROUP MEMBERS
    ----------------------------------------------------- */

    for (
      const userId
      of finalMemberIds
    ) {
      const memberRole =
        Number(userId) ===
        Number(
          currentUser.id
        )
          ? "admin"
          : "member";

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
          ?
        )
        `,
        [
          conversationId,
          userId,
          memberRole,
        ]
      );
    }

    await connection.commit();

    const members =
      await getConversationMembers(
        conversationId
      );

    return NextResponse.json(
      {
        success: true,

        existing: false,

        message:
          "Group created successfully",

        conversationId,

        conversation: {
          id:
            conversationId,

          type:
            "group",

          name,

          created_by:
            currentUser.id,

          created_at:
            new Date(),

          updated_at:
            new Date(),

          member_count:
            members.length,

          members,

          messages: [],

          lastMsg:
            "No messages yet",

          last_msg:
            "No messages yet",

          last_msg_time:
            null,

          unread_count: 0,

          last_message:
            null,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      "POST /api/conversations ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error.message ||
          "Failed to create conversation",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}