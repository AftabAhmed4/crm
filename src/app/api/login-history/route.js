import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../lib/db";

export const runtime = "nodejs";

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";
const ATTENDANCE_CUTOFF = "08:15:00";

/*
=========================================================
AUTH
=========================================================
*/

async function getCurrentUser() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId =
      decoded?.id ??
      decoded?._id ??
      decoded?.userId;

    if (!userId) {
      return null;
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        team,
        status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows || !rows.length) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error("AUTH ERROR:", error);
    return null;
  }
}

/*
=========================================================
ADMIN CHECK
=========================================================
*/

function isAdmin(user) {
  return (
    String(user?.role || "")
      .trim()
      .toLowerCase() === "admin"
  );
}

/*
=========================================================
VALID DATE
=========================================================
*/

function isValidDate(value) {
  const input = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return false;
  }

  const [year, month, day] =
    input.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/*
=========================================================
CALIFORNIA TODAY
=========================================================
*/

function getCaliforniaToday() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CALIFORNIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(now);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

/*
=========================================================
NEXT DATE
=========================================================
*/

function getNextDate(dateString) {
  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  date.setUTCDate(
    date.getUTCDate() + 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}

/*
=========================================================
PREVIOUS DATE
=========================================================
*/

function getPreviousDate(dateString) {
  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  date.setUTCDate(
    date.getUTCDate() - 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}

/*
=========================================================
DAY INFO
=========================================================
*/

function getDayInfo(dateString) {
  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  const dayNumber =
    date.getUTCDay();

  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return {
    dayNumber,
    dayName: names[dayNumber],
    isWeekend:
      dayNumber === 0 ||
      dayNumber === 6,
  };
}

/*
=========================================================
NORMALIZE MYSQL DATETIME
=========================================================
*/

function normalizeLocalDateTime(value) {
  if (!value) {
    return null;
  }

  const input = String(value)
    .trim()
    .replace("T", " ");

  const match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second = "00",
  ] = match;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/*
=========================================================
DATETIME VALIDATION
=========================================================
*/

function isValidDateTime(value) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
    String(value || "")
  );
}

/*
=========================================================
TIME TO SECONDS
=========================================================
*/

function timeToSeconds(time) {
  const match = String(time || "").match(
    /^(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);

  if (
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  return (
    hour * 3600 +
    minute * 60 +
    second
  );
}

/*
=========================================================
ATTENDANCE STATUS
=========================================================
*/

function getAttendanceStatus(loginTime) {
  if (!loginTime) {
    return "Absent";
  }

  const normalized =
    normalizeLocalDateTime(loginTime);

  if (!normalized) {
    return "Absent";
  }

  const loginSeconds =
    timeToSeconds(
      normalized.slice(11, 19)
    );

  const cutoffSeconds =
    timeToSeconds(
      ATTENDANCE_CUTOFF
    );

  if (
    loginSeconds === null ||
    cutoffSeconds === null
  ) {
    return "Absent";
  }

  return loginSeconds <= cutoffSeconds
    ? "On Time"
    : "Late";
}

/*
=========================================================
DURATION
=========================================================
*/

function getDurationSeconds(
  loginTime,
  logoutTime
) {
  if (!loginTime || !logoutTime) {
    return null;
  }

  const login =
    normalizeLocalDateTime(loginTime);

  const logout =
    normalizeLocalDateTime(logoutTime);

  if (!login || !logout) {
    return null;
  }

  const startDay = new Date(
    `${login.slice(0, 10)}T00:00:00Z`
  );

  const endDay = new Date(
    `${logout.slice(0, 10)}T00:00:00Z`
  );

  const startTime =
    timeToSeconds(
      login.slice(11, 19)
    );

  const endTime =
    timeToSeconds(
      logout.slice(11, 19)
    );

  if (
    Number.isNaN(startDay.getTime()) ||
    Number.isNaN(endDay.getTime()) ||
    startTime === null ||
    endTime === null
  ) {
    return null;
  }

  const startSeconds =
    Math.floor(
      startDay.getTime() / 1000
    ) + startTime;

  const endSeconds =
    Math.floor(
      endDay.getTime() / 1000
    ) + endTime;

  return Math.max(
    0,
    endSeconds - startSeconds
  );
}

/*
=========================================================
GET - ATTENDANCE
=========================================================

ADMIN:
- All users
- Specific user
- Specific team
- User + team
- Absent users included

NORMAL:
- Own user only

WEEKENDS:
- OFF
- Never Absent
=========================================================
*/

export async function GET(request) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const admin =
      isAdmin(user);

    const { searchParams } =
      new URL(request.url);

    let from =
      searchParams.get("from");

    let to =
      searchParams.get("to");

    const requestedUserId =
      searchParams.get("user_id");

    const requestedTeam =
      searchParams.get("team");

    /*
    =======================================================
    DEFAULT DATE
    =======================================================
    */

    if (!from && !to) {
      from =
        getCaliforniaToday();

      to = from;
    }

    if (!from) {
      from = to;
    }

    if (!to) {
      to = from;
    }

    /*
    =======================================================
    DATE VALIDATION
    =======================================================
    */

    if (
      !isValidDate(from) ||
      !isValidDate(to)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid date. Use YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        {
          success: false,
          message:
            "From date cannot be greater than to date.",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    USER FILTER
    =======================================================
    */

    let selectedUserId = null;

    if (admin) {
      if (
        requestedUserId &&
        requestedUserId !== "all" &&
        requestedUserId !== "All Users"
      ) {
        const parsed =
          Number(requestedUserId);

        if (
          !Number.isInteger(parsed) ||
          parsed <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Invalid user_id.",
            },
            { status: 400 }
          );
        }

        selectedUserId =
          parsed;
      }
    } else {
      selectedUserId =
        Number(user.id);
    }

    /*
    =======================================================
    TEAM FILTER
    =======================================================
    */

    let selectedTeam = null;

    if (admin) {
      const teamValue =
        String(
          requestedTeam || ""
        ).trim();

      if (
        teamValue &&
        teamValue.toLowerCase() !==
          "all" &&
        teamValue.toLowerCase() !==
          "all teams"
      ) {
        selectedTeam =
          teamValue;
      }
    }

    /*
    =======================================================
    GET ALL EMPLOYEES

    IMPORTANT:
    IDs 11,12,13,14,15 etc.
    All non-deleted users are returned.

    User with no login = Absent.
    =======================================================
    */

    let employeeSql = `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        team,
        status
      FROM users
      WHERE
        (
          status IS NULL
          OR LOWER(TRIM(status)) <> 'deleted'
        )
    `;

    const employeeParams = [];

    if (selectedUserId) {
      employeeSql += `
        AND id = ?
      `;

      employeeParams.push(
        selectedUserId
      );
    }

    if (selectedTeam) {
      employeeSql += `
        AND LOWER(TRIM(COALESCE(team, ''))) =
            LOWER(TRIM(?))
      `;

      employeeParams.push(
        selectedTeam
      );
    }

    /*
    IMPORTANT:
    ID ascending so 11,12,13,14,15...
    */

    employeeSql += `
      ORDER BY
        id ASC
    `;

    const [employeesRows] =
      await db.query(
        employeeSql,
        employeeParams
      );

    const employees =
      employeesRows || [];

    if (
      admin &&
      selectedUserId &&
      !employees.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Selected user not found or does not belong to selected team.",
        },
        { status: 404 }
      );
    }

    /*
    =======================================================
    NO EMPLOYEES
    =======================================================
    */

    if (!employees.length) {
      return NextResponse.json({
        success: true,
        from,
        to,
        timezone:
          CALIFORNIA_TIMEZONE,
        cutoff:
          ATTENDANCE_CUTOFF,

        current_user: {
          id: Number(user.id),
          name: user.name || "",
          role: user.role || "",
        },

        admin_view: admin,
        selected_user_id:
          selectedUserId,
        selected_team:
          selectedTeam,

        selected_user: null,

        attendance_users: [],

        weekends_off: true,
        off_days: [],

        counts: {
          total: 0,
          present: 0,
          on_time: 0,
          late: 0,
          absent: 0,
          off: 0,
        },

        date_counts: {},
        history: [],
      });
    }

    /*
    =======================================================
    SELECTED USER
    =======================================================
    */

    const selectedEmployee =
      selectedUserId
        ? employees.find(
            (employee) =>
              Number(employee.id) ===
              Number(selectedUserId)
          )
        : null;

    /*
    =======================================================
    EMPLOYEE IDS
    =======================================================
    */

    const employeeIds =
      employees
        .map((employee) =>
          Number(employee.id)
        )
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        );

    const placeholders =
      employeeIds
        .map(() => "?")
        .join(",");

    /*
    =======================================================
    QUERY RANGE

    One day before / after handles datetime safely.
    =======================================================
    */

    const queryFrom =
      getPreviousDate(from);

    const queryTo =
      getNextDate(to);

    /*
    =======================================================
    LOGIN HISTORY
    =======================================================
    */

    const [loginRows] =
      await db.query(
        `
        SELECT
          lh.id,
          lh.user_id,

          DATE_FORMAT(
            lh.login_time,
            '%Y-%m-%d %H:%i:%s'
          ) AS login_time,

          CASE
            WHEN lh.logout_time IS NULL
            THEN NULL
            ELSE DATE_FORMAT(
              lh.logout_time,
              '%Y-%m-%d %H:%i:%s'
            )
          END AS logout_time,

          lh.ip_address,
          lh.user_agent

        FROM login_history lh

        WHERE
          lh.user_id IN (${placeholders})

          AND lh.login_time >= ?

          AND lh.login_time < ?

        ORDER BY
          lh.user_id ASC,
          lh.login_time ASC,
          lh.id ASC
        `,
        [
          ...employeeIds,
          `${queryFrom} 00:00:00`,
          `${queryTo} 00:00:00`,
        ]
      );

    /*
    =======================================================
    ATTENDANCE USERS
    =======================================================
    */

    const attendanceUserIds =
      new Set();

    for (
      const row of loginRows || []
    ) {
      const userId =
        Number(row.user_id);

      const loginTime =
        normalizeLocalDateTime(
          row.login_time
        );

      if (
        Number.isInteger(userId) &&
        userId > 0 &&
        loginTime
      ) {
        const date =
          loginTime.slice(0, 10);

        if (
          date >= from &&
          date <= to
        ) {
          attendanceUserIds.add(
            userId
          );
        }
      }
    }

    const attendance_users =
      employees.map(
        (employee) => ({
          id:
            Number(employee.id),

          name:
            employee.name || "",

          email:
            employee.email || "",

          phone:
            employee.phone || "",

          role:
            employee.role || "",

          team:
            employee.team || "",

          status:
            employee.status || "",

          has_attendance:
            attendanceUserIds.has(
              Number(employee.id)
            ),
        })
      );

    /*
    =======================================================
    GROUP LOGIN RECORDS
    =======================================================
    */

    const attendanceMap =
      new Map();

    for (
      const row of loginRows || []
    ) {
      const loginTime =
        normalizeLocalDateTime(
          row.login_time
        );

      if (!loginTime) {
        continue;
      }

      const attendanceDate =
        loginTime.slice(0, 10);

      if (
        attendanceDate < from ||
        attendanceDate > to
      ) {
        continue;
      }

      const dayInfo =
        getDayInfo(
          attendanceDate
        );

      /*
      WEEKENDS ARE OFF
      */

      if (dayInfo.isWeekend) {
        continue;
      }

      const logoutTime =
        row.logout_time
          ? normalizeLocalDateTime(
              row.logout_time
            )
          : null;

      const userId =
        Number(row.user_id);

      const key =
        `${userId}_${attendanceDate}`;

      /*
      FIRST LOGIN
      */

      if (
        !attendanceMap.has(key)
      ) {
        attendanceMap.set(
          key,
          {
            id:
              Number(row.id),

            user_id:
              userId,

            login_time:
              loginTime,

            logout_time:
              logoutTime,

            ip_address:
              row.ip_address ||
              null,

            user_agent:
              row.user_agent ||
              null,
          }
        );

        continue;
      }

      const existing =
        attendanceMap.get(key);

      /*
      EARLIEST LOGIN
      */

      if (
        loginTime <
        existing.login_time
      ) {
        existing.login_time =
          loginTime;

        existing.id =
          Number(row.id);

        existing.ip_address =
          row.ip_address || null;

        existing.user_agent =
          row.user_agent || null;
      }

      /*
      LATEST LOGOUT
      */

      if (
        logoutTime &&
        (
          !existing.logout_time ||
          logoutTime >
            existing.logout_time
        )
      ) {
        existing.logout_time =
          logoutTime;
      }
    }

    /*
    =======================================================
    BUILD HISTORY
    =======================================================
    */

    const history = [];
    const offDays = [];

    let currentDate = from;

    while (
      currentDate <= to
    ) {
      const dayInfo =
        getDayInfo(
          currentDate
        );

      /*
      =====================================================
      WEEKEND = OFF
      =====================================================
      */

      if (dayInfo.isWeekend) {
        offDays.push({
          date:
            currentDate,

          day:
            dayInfo.dayName,

          status:
            "OFF",
        });

        currentDate =
          getNextDate(
            currentDate
          );

        continue;
      }

      /*
      =====================================================
      WEEKDAY
      EVERY USER GETS A ROW
      EVEN IF ABSENT
      =====================================================
      */

      for (
        const employee of employees
      ) {
        const employeeId =
          Number(employee.id);

        const key =
          `${employeeId}_${currentDate}`;

        const record =
          attendanceMap.get(key);

        /*
        ===================================================
        ABSENT

        IMPORTANT:
        id = null because database record does not exist.
        Admin PUT can now create it.
        ===================================================
        */

        if (!record) {
          history.push({
            id: null,

            user_id:
              employeeId,

            name:
              employee.name || "",

            email:
              employee.email || "",

            phone:
              employee.phone || "",

            role:
              employee.role || "",

            team:
              employee.team || "",

            attendance_date:
              currentDate,

            day_name:
              dayInfo.dayName,

            login_time:
              null,

            logout_time:
              null,

            ip_address:
              null,

            user_agent:
              null,

            duration_seconds:
              null,

            attendance_status:
              "Absent",
          });

          continue;
        }

        /*
        ===================================================
        PRESENT
        ===================================================
        */

        const attendanceStatus =
          getAttendanceStatus(
            record.login_time
          );

        const durationSeconds =
          getDurationSeconds(
            record.login_time,
            record.logout_time
          );

        history.push({
          id:
            record.id,

          user_id:
            employeeId,

          name:
            employee.name || "",

          email:
            employee.email || "",

          phone:
            employee.phone || "",

          role:
            employee.role || "",

          team:
            employee.team || "",

          attendance_date:
            currentDate,

          day_name:
            dayInfo.dayName,

          login_time:
            record.login_time,

          logout_time:
            record.logout_time,

          ip_address:
            record.ip_address,

          user_agent:
            record.user_agent,

          duration_seconds:
            durationSeconds,

          attendance_status:
            attendanceStatus,
        });
      }

      currentDate =
        getNextDate(
          currentDate
        );
    }

    /*
    =======================================================
    SORT
    DATE DESC
    USER ID ASC

    Example:
    2026-09-29
    11
    12
    13
    14
    15
    =======================================================
    */

    history.sort(
      (a, b) => {
        if (
          a.attendance_date !==
          b.attendance_date
        ) {
          return a.attendance_date <
            b.attendance_date
            ? 1
            : -1;
        }

        return (
          Number(a.user_id) -
          Number(b.user_id)
        );
      }
    );

    /*
    =======================================================
    COUNTS
    =======================================================
    */

    const counts = {
      total:
        history.length,

      present: 0,

      on_time: 0,

      late: 0,

      absent: 0,

      off:
        offDays.length,
    };

    for (
      const row of history
    ) {
      if (
        row.attendance_status ===
        "On Time"
      ) {
        counts.present++;
        counts.on_time++;
      } else if (
        row.attendance_status ===
        "Late"
      ) {
        counts.present++;
        counts.late++;
      } else if (
        row.attendance_status ===
        "Absent"
      ) {
        counts.absent++;
      }
    }

    /*
    =======================================================
    DATE COUNTS
    =======================================================
    */

    const dateCounts = {};

    for (
      const row of history
    ) {
      if (
        !dateCounts[
          row.attendance_date
        ]
      ) {
        dateCounts[
          row.attendance_date
        ] = {
          date:
            row.attendance_date,

          day:
            row.day_name,

          total: 0,

          present: 0,

          on_time: 0,

          late: 0,

          absent: 0,

          off: false,
        };
      }

      const current =
        dateCounts[
          row.attendance_date
        ];

      current.total++;

      if (
        row.attendance_status ===
        "On Time"
      ) {
        current.present++;
        current.on_time++;
      } else if (
        row.attendance_status ===
        "Late"
      ) {
        current.present++;
        current.late++;
      } else if (
        row.attendance_status ===
        "Absent"
      ) {
        current.absent++;
      }
    }

    /*
    =======================================================
    WEEKEND DATE COUNTS
    =======================================================
    */

    for (
      const offDay of offDays
    ) {
      dateCounts[
        offDay.date
      ] = {
        date:
          offDay.date,

        day:
          offDay.day,

        total: 0,

        present: 0,

        on_time: 0,

        late: 0,

        absent: 0,

        off: true,
      };
    }

    /*
    =======================================================
    RESPONSE
    =======================================================
    */

    return NextResponse.json({
      success: true,

      from,
      to,

      timezone:
        CALIFORNIA_TIMEZONE,

      cutoff:
        ATTENDANCE_CUTOFF,

      current_user: {
        id:
          Number(user.id),

        name:
          user.name || "",

        role:
          user.role || "",
      },

      admin_view:
        admin,

      selected_user_id:
        selectedUserId,

      selected_team:
        selectedTeam,

      selected_user:
        selectedEmployee
          ? {
              id:
                Number(
                  selectedEmployee.id
                ),

              name:
                selectedEmployee.name ||
                "",

              email:
                selectedEmployee.email ||
                "",

              phone:
                selectedEmployee.phone ||
                "",

              role:
                selectedEmployee.role ||
                "",

              team:
                selectedEmployee.team ||
                "",

              status:
                selectedEmployee.status ||
                "",
            }
          : null,

      /*
      ALL FILTERED USERS
      INCLUDING USERS WHO ARE ABSENT
      */

      attendance_users,

      weekends_off:
        true,

      off_days:
        offDays,

      counts,

      date_counts:
        dateCounts,

      history,
    });
  } catch (error) {
    console.error(
      "LOGIN HISTORY GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to load attendance",
      },
      { status: 500 }
    );
  }
}

/*
=========================================================
POST - ADMIN ADD ATTENDANCE
=========================================================

Used for adding a completely new attendance record.
=========================================================
*/

export async function POST(request) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only admin can add attendance",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const {
      user_id,
      login_time,
      logout_time,
      ip_address,
      user_agent,
    } = body;

    const employeeId =
      Number(user_id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid employee is required",
        },
        { status: 400 }
      );
    }

    const californiaLoginTime =
      normalizeLocalDateTime(
        login_time
      );

    const californiaLogoutTime =
      logout_time
        ? normalizeLocalDateTime(
            logout_time
          )
        : null;

    if (
      !californiaLoginTime ||
      !isValidDateTime(
        californiaLoginTime
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid login time",
        },
        { status: 400 }
      );
    }

    if (
      californiaLogoutTime &&
      !isValidDateTime(
        californiaLogoutTime
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid logout time",
        },
        { status: 400 }
      );
    }

    if (
      californiaLogoutTime &&
      californiaLogoutTime <
        californiaLoginTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Logout time cannot be before login time",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    EMPLOYEE EXISTS
    =======================================================
    */

    const [employeeRows] =
      await db.query(
        `
        SELECT
          id,
          status
        FROM users
        WHERE id = ?
        AND (
          status IS NULL
          OR LOWER(TRIM(status)) <> 'deleted'
        )
        LIMIT 1
        `,
        [employeeId]
      );

    if (
      !employeeRows ||
      !employeeRows.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Employee not found",
        },
        { status: 404 }
      );
    }

    /*
    =======================================================
    INSERT
    =======================================================
    */

    const [result] =
      await db.query(
        `
        INSERT INTO login_history
        (
          user_id,
          login_time,
          logout_time,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          employeeId,
          californiaLoginTime,
          californiaLogoutTime,
          ip_address || null,
          user_agent || null,
        ]
      );

    return NextResponse.json({
      success: true,

      message:
        "Attendance added successfully",

      id:
        result.insertId,
    });
  } catch (error) {
    console.error(
      "LOGIN HISTORY POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to add attendance",
      },
      { status: 500 }
    );
  }
}

/*
=========================================================
PUT - ADMIN EDIT / CONVERT ABSENT TO PRESENT
=========================================================

CASE 1:
Existing ID
-> UPDATE existing record

CASE 2:
id = null
-> Absent row
-> INSERT new login_history record

This allows Admin to edit an Absent row.
=========================================================
*/

export async function PUT(request) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only admin can edit attendance",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const {
      id,
      user_id,
      attendance_date,
      login_time,
      logout_time,
      ip_address,
      user_agent,
    } = body;

    /*
    =======================================================
    USER ID
    =======================================================
    */

    const employeeId =
      Number(user_id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid employee is required",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    LOGIN TIME
    =======================================================
    */

    const californiaLoginTime =
      normalizeLocalDateTime(
        login_time
      );

    const californiaLogoutTime =
      logout_time
        ? normalizeLocalDateTime(
            logout_time
          )
        : null;

    if (
      !californiaLoginTime ||
      !isValidDateTime(
        californiaLoginTime
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid login time is required",
        },
        { status: 400 }
      );
    }

    if (
      californiaLogoutTime &&
      !isValidDateTime(
        californiaLogoutTime
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid logout time",
        },
        { status: 400 }
      );
    }

    if (
      californiaLogoutTime &&
      californiaLogoutTime <
        californiaLoginTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Logout time cannot be before login time",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    EMPLOYEE EXISTS
    =======================================================
    */

    const [employeeRows] =
      await db.query(
        `
        SELECT
          id,
          name,
          status
        FROM users
        WHERE id = ?
        AND (
          status IS NULL
          OR LOWER(TRIM(status)) <> 'deleted'
        )
        LIMIT 1
        `,
        [employeeId]
      );

    if (
      !employeeRows ||
      !employeeRows.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Employee not found",
        },
        { status: 404 }
      );
    }

    /*
    =======================================================
    CASE 1
    EXISTING ATTENDANCE -> UPDATE
    =======================================================
    */

    const attendanceId =
      Number(id);

    if (
      Number.isInteger(attendanceId) &&
      attendanceId > 0
    ) {
      const [existingRows] =
        await db.query(
          `
          SELECT
            id,
            user_id,
            login_time
          FROM login_history
          WHERE id = ?
          LIMIT 1
          `,
          [attendanceId]
        );

      if (
        !existingRows ||
        !existingRows.length
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Attendance record not found",
          },
          { status: 404 }
        );
      }

      /*
      =====================================================
      UPDATE
      =====================================================
      */

      await db.query(
        `
        UPDATE login_history
        SET
          user_id = ?,
          login_time = ?,
          logout_time = ?,
          ip_address = ?,
          user_agent = ?
        WHERE id = ?
        `,
        [
          employeeId,
          californiaLoginTime,
          californiaLogoutTime,
          ip_address || null,
          user_agent || null,
          attendanceId,
        ]
      );

      return NextResponse.json({
        success: true,

        action: "updated",

        message:
          "Attendance updated successfully",

        id:
          attendanceId,
      });
    }

    /*
    =======================================================
    CASE 2
    ABSENT ROW -> CREATE ATTENDANCE
    =======================================================

    Frontend sends:

    {
      id: null,
      user_id: 11,
      attendance_date: "2026-09-29",
      login_time: "2026-09-29 08:00:00",
      logout_time: "2026-09-29 17:00:00"
    }

    =======================================================
    */

    if (
      !attendance_date ||
      !isValidDate(attendance_date)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid attendance_date is required when editing an Absent record",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    PREVENT WEEKEND ATTENDANCE
    =======================================================
    */

    const dayInfo =
      getDayInfo(
        attendance_date
      );

    if (dayInfo.isWeekend) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Saturday and Sunday are OFF days. Attendance cannot be added.",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    IMPORTANT DATE CHECK

    Login date must equal selected attendance date.
    =======================================================
    */

    if (
      californiaLoginTime.slice(0, 10) !==
      attendance_date
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Login date must match attendance date.",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    CHECK EXISTING ATTENDANCE FOR SAME USER + DATE
    =======================================================
    */

    const nextDate =
      getNextDate(
        attendance_date
      );

    const [existingDateRows] =
      await db.query(
        `
        SELECT
          id
        FROM login_history
        WHERE
          user_id = ?

          AND login_time >= ?

          AND login_time < ?

        ORDER BY
          login_time ASC,
          id ASC

        LIMIT 1
        `,
        [
          employeeId,
          `${attendance_date} 00:00:00`,
          `${nextDate} 00:00:00`,
        ]
      );

    /*
    =======================================================
    IF RECORD ALREADY EXISTS

    Update it instead of creating duplicate.
    =======================================================
    */

    if (
      existingDateRows &&
      existingDateRows.length
    ) {
      const existingId =
        Number(
          existingDateRows[0].id
        );

      await db.query(
        `
        UPDATE login_history
        SET
          login_time = ?,
          logout_time = ?,
          ip_address = ?,
          user_agent = ?
        WHERE id = ?
        `,
        [
          californiaLoginTime,
          californiaLogoutTime,
          ip_address || null,
          user_agent || null,
          existingId,
        ]
      );

      return NextResponse.json({
        success: true,

        action:
          "updated_absent_existing",

        message:
          "Absent attendance updated successfully",

        id:
          existingId,
      });
    }

    /*
    =======================================================
    INSERT NEW RECORD
    =======================================================
    */

    const [result] =
      await db.query(
        `
        INSERT INTO login_history
        (
          user_id,
          login_time,
          logout_time,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          employeeId,
          californiaLoginTime,
          californiaLogoutTime,
          ip_address || null,
          user_agent || null,
        ]
      );

    return NextResponse.json({
      success: true,

      action:
        "created_from_absent",

      message:
        "Absent attendance added successfully",

      id:
        result.insertId,
    });
  } catch (error) {
    console.error(
      "LOGIN HISTORY PUT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to update attendance",
      },
      { status: 500 }
    );
  }
}

/*
=========================================================
DELETE - ADMIN ONLY
=========================================================
*/

export async function DELETE(request) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only admin can delete attendance",
        },
        { status: 403 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const id =
      searchParams.get("id");

    const attendanceId =
      Number(id);

    if (
      !Number.isInteger(
        attendanceId
      ) ||
      attendanceId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid attendance ID is required",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    CHECK RECORD
    =======================================================
    */

    const [beforeDelete] =
      await db.query(
        `
        SELECT
          id,
          user_id,
          login_time
        FROM login_history
        WHERE id = ?
        LIMIT 1
        `,
        [attendanceId]
      );

    if (
      !beforeDelete ||
      !beforeDelete.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Attendance record not found",
        },
        { status: 404 }
      );
    }

    /*
    =======================================================
    DELETE
    =======================================================
    */

    const [result] =
      await db.query(
        `
        DELETE FROM login_history
        WHERE id = ?
        LIMIT 1
        `,
        [attendanceId]
      );

    if (
      result.affectedRows !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Attendance was not deleted",
        },
        { status: 500 }
      );
    }

    /*
    =======================================================
    VERIFY DELETE
    =======================================================
    */

    const [afterDelete] =
      await db.query(
        `
        SELECT id
        FROM login_history
        WHERE id = ?
        LIMIT 1
        `,
        [attendanceId]
      );

    if (
      afterDelete &&
      afterDelete.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delete verification failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Attendance deleted permanently",

      deletedId:
        attendanceId,
    });
  } catch (error) {
    console.error(
      "LOGIN HISTORY DELETE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to delete attendance",
      },
      { status: 500 }
    );
  }
}