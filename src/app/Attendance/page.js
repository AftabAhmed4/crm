"use client";

import {
  CalendarDays,
  Search,
  Download,
  Users,
  UserCheck,
  Clock3,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Eye,
  EyeOff,
  Settings2,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Sidebar from "@/components/Sidebar";

/* =========================================================
   CONSTANTS
========================================================= */

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

const HIDDEN_ATTENDANCE_STORAGE_KEY =
  "crm_hidden_attendance_records";

/* =========================================================
   CALIFORNIA DATE
========================================================= */

function getCaliforniaDateInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALIFORNIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day}`;
}

function getCaliforniaMonthStart() {
  const today = getCaliforniaDateInput();

  return `${today.slice(0, 8)}01`;
}

/* =========================================================
   DATE ONLY NORMALIZER
========================================================= */

function normalizeDateOnly(value) {
  if (!value) return "";

  const text = String(value).trim();

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return "";

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/* =========================================================
   DB DATE PARSER
========================================================= */

function parseDbDateTime(value) {
  const text = String(value ?? "").trim();

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
  };
}

/* =========================================================
   DISPLAY DATE
========================================================= */

function formatCaliforniaDate(value) {
  if (!value) return "-";

  const dateOnly = normalizeDateOnly(value);

  if (dateOnly) {
    const [year, month, day] =
      dateOnly.split("-").map(Number);

    const date = new Date(
      year,
      month - 1,
      day
    );

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }).format(date);
    }
  }

  const p = parseDbDateTime(value);

  if (!p) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(
    new Date(
      p.year,
      p.month - 1,
      p.day
    )
  );
}

/* =========================================================
   DAY NAME
========================================================= */

function getDayName(value) {
  const dateOnly = normalizeDateOnly(value);

  if (!dateOnly) return "-";

  const [year, month, day] =
    dateOnly.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(date);
}

/* =========================================================
   DISPLAY TIME
========================================================= */

function formatCaliforniaTime(value) {
  const p = parseDbDateTime(value);

  if (!p) return "-";

  const hour = p.hour;

  const suffix = hour >= 12 ? "PM" : "AM";

  const hour12 = hour % 12 || 12;

  return `${hour12}:${String(
    p.minute
  ).padStart(2, "0")}:${String(
    p.second
  ).padStart(2, "0")} ${suffix}`;
}

/* =========================================================
   DATETIME LOCAL VALUE
========================================================= */

function toDateTimeLocal(value) {
  const p = parseDbDateTime(value);

  if (!p) return "";

  return [
    String(p.year).padStart(4, "0"),
    "-",
    String(p.month).padStart(2, "0"),
    "-",
    String(p.day).padStart(2, "0"),
    "T",
    String(p.hour).padStart(2, "0"),
    ":",
    String(p.minute).padStart(2, "0"),
    ":",
    String(p.second).padStart(2, "0"),
  ].join("");
}

/* =========================================================
   DURATION
========================================================= */

function formatDuration(seconds) {
  if (
    seconds === null ||
    seconds === undefined ||
    Number.isNaN(Number(seconds))
  ) {
    return "-";
  }

  const total = Math.max(
    0,
    Number(seconds)
  );

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

/* =========================================================
   STATUS
========================================================= */

function getStatus(row) {
  const raw = String(
    row?.attendance_status ||
      row?.status ||
      ""
  )
    .trim()
    .toLowerCase();

  if (
    raw === "off" ||
    raw === "weekend off" ||
    raw === "weekend"
  ) {
    return "OFF";
  }

  if (
    raw === "absent" ||
    raw.includes("absent")
  ) {
    return "Absent";
  }

  if (
    raw === "late" ||
    raw.includes("late")
  ) {
    return "Late";
  }

  if (
    raw === "on time" ||
    raw === "present" ||
    raw === "ontime"
  ) {
    return "Present";
  }

  return "Present";
}

/* =========================================================
   FORM DEFAULT
========================================================= */

function getDefaultForm() {
  const today = getCaliforniaDateInput();

  return {
    user_id: "",
    login_time: `${today}T08:00:00`,
    logout_time: "",
    ip_address: "",
    user_agent: "",
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AttendancePage() {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  const [attendance, setAttendance] =
    useState([]);

  const [weekendOffDays, setWeekendOffDays] =
    useState([]);

  const [attendanceCounts, setAttendanceCounts] =
    useState({
      total: 0,
      on_time: 0,
      late: 0,
      absent: 0,
      off: 0,
    });

  const [attendanceUsers, setAttendanceUsers] =
    useState([]);

  const [currentUser, setCurrentUser] =
    useState(null);

  const [staff, setStaff] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =======================================================
     FILTERS
  ======================================================= */

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [teamFilter, setTeamFilter] =
    useState("All Teams");

  /* =======================================================
     ADMIN USER FILTER
  ======================================================= */

  const [userFilter, setUserFilter] =
    useState("All Users");

  const [fromDate, setFromDate] =
    useState(
      getCaliforniaMonthStart()
    );

  const [toDate, setToDate] =
    useState(
      getCaliforniaDateInput()
    );

  /* =======================================================
     HIDDEN ROWS
  ======================================================= */

  const [
    hiddenAttendanceIds,
    setHiddenAttendanceIds,
  ] = useState([]);

  const [showHiddenMenu, setShowHiddenMenu] =
    useState(false);

  /* =======================================================
     MODALS
  ======================================================= */

  const [showModal, setShowModal] =
    useState(false);

  const [editingRecord, setEditingRecord] =
    useState(null);

  const [form, setForm] =
    useState(getDefaultForm());

  const [saving, setSaving] =
    useState(false);

  const [deleteRecord, setDeleteRecord] =
    useState(null);

  const [deleting, setDeleting] =
    useState(false);

  /* =======================================================
     ADMIN
  ======================================================= */

  const isAdmin =
    String(
      currentUser?.role || ""
    ).toLowerCase() === "admin";

  /* =======================================================
     LOAD HIDDEN ROWS
  ======================================================= */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          HIDDEN_ATTENDANCE_STORAGE_KEY
        );

      if (!saved) {
        setHiddenAttendanceIds([]);
        return;
      }

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setHiddenAttendanceIds(
          parsed
            .map((id) => String(id))
            .filter(Boolean)
        );
      }
    } catch (err) {
      console.error(
        "HIDDEN ATTENDANCE LOAD ERROR:",
        err
      );

      setHiddenAttendanceIds([]);
    }
  }, []);

  /* =======================================================
     SAVE HIDDEN ROWS
  ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        HIDDEN_ATTENDANCE_STORAGE_KEY,
        JSON.stringify(
          hiddenAttendanceIds
        )
      );
    } catch (err) {
      console.error(
        "HIDDEN ATTENDANCE SAVE ERROR:",
        err
      );
    }
  }, [hiddenAttendanceIds]);

  /* =======================================================
     HIDE RECORD
  ======================================================= */

  function hideAttendanceRecord(row) {
    if (
      !row?.id ||
      row?.row_type === "weekend_off"
    ) {
      return;
    }

    const id = String(row.id);

    setHiddenAttendanceIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      }

      return [...prev, id];
    });

    setSuccess(
      `${
        row.name ||
        "Attendance record"
      } hidden from the table.`
    );

    setShowHiddenMenu(false);
  }

  /* =======================================================
     UNHIDE RECORD
  ======================================================= */

  function unhideAttendanceRecord(id) {
    const recordId = String(id);

    setHiddenAttendanceIds((prev) =>
      prev.filter(
        (item) =>
          String(item) !== recordId
      )
    );

    setSuccess(
      "Attendance record shown again."
    );
  }

  /* =======================================================
     UNHIDE ALL
  ======================================================= */

  function unhideAllAttendance() {
    setHiddenAttendanceIds([]);

    setSuccess(
      "All hidden attendance records are visible again."
    );
  }

  /* =======================================================
     LOAD CURRENT USER
  ======================================================= */

  const loadCurrentUser =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.user
        ) {
          window.location.href =
            "/login";

          return null;
        }

        setCurrentUser(data.user);

        return data.user;
      } catch (err) {
        console.error(err);

        window.location.href =
          "/login";

        return null;
      }
    }, []);

  /* =======================================================
     LOAD STAFF
  ======================================================= */

  const loadStaff =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/staffes/list",
            {
              credentials:
                "include",
              cache:
                "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        const list =
          Array.isArray(
            data?.staffes
          )
            ? data.staffes
            : Array.isArray(
                data?.staff
              )
            ? data.staff
            : Array.isArray(
                data?.users
              )
            ? data.users
            : Array.isArray(
                data?.data
              )
            ? data.data
            : [];

        const normalized =
          list
            .map((item) => ({
              id: item.id,

              name:
                item.name ||
                item.full_name ||
                item.fullName ||
                "Unknown",

              email:
                item.email ||
                "",

              team:
                item.team ||
                "",

              role:
                item.role ||
                "",
            }))
            .filter(
              (item) =>
                item.id
            );

        setStaff(
          normalized
        );
      } catch (err) {
        console.error(
          "STAFF LOAD ERROR:",
          err
        );
      }
    }, []);

  /* =======================================================
     USER OPTIONS
  ======================================================= */

  const userOptions = useMemo(() => {
    const map = new Map();

    /*
     * API se complete users aaye hon
     */
    if (
      Array.isArray(
        attendanceUsers
      )
    ) {
      attendanceUsers.forEach(
        (user) => {
          if (!user) {
            return;
          }

          /*
           * Agar API sirf ID return karti hai
           */
          if (
            typeof user ===
              "number" ||
            typeof user ===
              "string"
          ) {
            const id =
              String(user);

            const employee =
              staff.find(
                (item) =>
                  String(
                    item.id
                  ) === id
              );

            if (
              employee
            ) {
              map.set(
                id,
                employee
              );
            }

            return;
          }

          /*
           * Agar API object return karti hai
           */
          if (user.id) {
            map.set(
              String(
                user.id
              ),
              {
                id: user.id,

                name:
                  user.name ||
                  user.full_name ||
                  "Unknown",

                email:
                  user.email ||
                  "",

                team:
                  user.team ||
                  "",

                role:
                  user.role ||
                  "",
              }
            );
          }
        }
      );
    }

    /*
     * Staff list ko bhi include karein
     */
    staff.forEach(
      (employee) => {
        if (!employee?.id) {
          return;
        }

        const id =
          String(
            employee.id
          );

        if (
          !map.has(id)
        ) {
          map.set(
            id,
            employee
          );
        }
      }
    );

    return Array.from(
      map.values()
    ).sort((a, b) =>
      String(
        a.name || ""
      ).localeCompare(
        String(
          b.name || ""
        )
      )
    );
  }, [
    attendanceUsers,
    staff,
  ]);

  /* =======================================================
     LOAD ATTENDANCE
  ======================================================= */

  const loadAttendance =
    useCallback(
      async (
        showLoader = true
      ) => {
        try {
          if (showLoader) {
            setLoading(true);
          } else {
            setRefreshing(true);
          }

          setError("");

          /*
           * Date validation
           */
          if (
            fromDate &&
            toDate &&
            fromDate > toDate
          ) {
            throw new Error(
              "From date cannot be after To date."
            );
          }

          const params =
            new URLSearchParams();

          if (fromDate) {
            params.set(
              "from",
              fromDate
            );
          }

          if (toDate) {
            params.set(
              "to",
              toDate
            );
          }

          /*
           * ADMIN USER FILTER
           *
           * All Users:
           * user_id nahi bhejna
           *
           * Specific User:
           * selected user_id API ko bhejna
           */
          if (
            isAdmin &&
            userFilter !==
              "All Users"
          ) {
            const selectedId =
              Number(
                userFilter
              );

            if (
              Number.isInteger(
                selectedId
              ) &&
              selectedId > 0
            ) {
              params.set(
                "user_id",
                String(
                  selectedId
                )
              );
            }
          }

          /*
           * Cache bust
           */
          params.set(
            "_",
            String(
              Date.now()
            )
          );

          const response =
            await fetch(
              `/api/login-history?${params.toString()}`,
              {
                credentials:
                  "include",

                cache:
                  "no-store",

                headers: {
                  "Cache-Control":
                    "no-cache",
                },
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.message ||
                "Failed to load attendance"
            );
          }

          const history =
            Array.isArray(
              data?.history
            )
              ? data.history
              : [];

          const offDays =
            Array.isArray(
              data?.off_days
            )
              ? data.off_days
              : [];

          const users =
            Array.isArray(
              data?.attendance_users
            )
              ? data.attendance_users
              : [];

          setAttendance(
            history
          );

          setWeekendOffDays(
            offDays
          );

          setAttendanceUsers(
            users
          );

          setAttendanceCounts({
            total: Number(
              data?.counts
                ?.total || 0
            ),

            on_time: Number(
              data?.counts
                ?.on_time || 0
            ),

            late: Number(
              data?.counts
                ?.late || 0
            ),

            absent: Number(
              data?.counts
                ?.absent || 0
            ),

            off: Number(
              data?.counts
                ?.off ??
                offDays.length ??
                0
            ),
          });
        } catch (err) {
          console.error(
            "ATTENDANCE LOAD ERROR:",
            err
          );

          setError(
            err?.message ||
              "Failed to load attendance"
          );

          setAttendance([]);

          setWeekendOffDays([]);

          setAttendanceCounts({
            total: 0,
            on_time: 0,
            late: 0,
            absent: 0,
            off: 0,
          });
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        fromDate,
        toDate,
        isAdmin,
        userFilter,
      ]
    );

  /* =======================================================
     INITIAL
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function init() {
      const user =
        await loadCurrentUser();

      if (
        !mounted ||
        !user
      ) {
        return;
      }

      if (
        String(
          user.role || ""
        ).toLowerCase() ===
        "admin"
      ) {
        await loadStaff();
      }

      if (!mounted) {
        return;
      }

      /*
       * Initial attendance
       */
      await loadAttendance(
        true
      );
    }

    init();

    return () => {
      mounted = false;
    };
  }, [
    loadCurrentUser,
    loadStaff,
  ]);

  /* =======================================================
     FILTER / DATE / USER CHANGE
  ======================================================= */

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    loadAttendance(false);
  }, [
    currentUser,
    fromDate,
    toDate,
    userFilter,
    loadAttendance,
  ]);

  /* =======================================================
     WEEKEND OFF EMPLOYEES
  ======================================================= */

  const weekendEmployees =
    useMemo(() => {
      let employees = [];

      /*
       * ADMIN
       */
      if (isAdmin) {
        employees =
          staff
            .filter(
              (employee) => {
                /*
                 * Selected user filter
                 */
                if (
                  userFilter !==
                  "All Users"
                ) {
                  return (
                    String(
                      employee.id
                    ) ===
                    String(
                      userFilter
                    )
                  );
                }

                /*
                 * API configured attendance users
                 */
                if (
                  attendanceUsers.length ===
                  0
                ) {
                  return true;
                }

                return attendanceUsers.some(
                  (item) => {
                    const id =
                      typeof item ===
                        "object"
                        ? item?.id
                        : item;

                    return (
                      String(
                        id
                      ) ===
                      String(
                        employee.id
                      )
                    );
                  }
                );
              }
            )
            .map(
              (employee) => ({
                id: employee.id,

                name:
                  employee.name ||
                  "Unknown Employee",

                email:
                  employee.email ||
                  "",

                team:
                  employee.team ||
                  "",

                role:
                  employee.role ||
                  "",
              })
            );
      }

      /*
       * NORMAL USER
       */
      if (
        !isAdmin &&
        currentUser?.id
      ) {
        employees = [
          {
            id:
              currentUser.id,

            name:
              currentUser.name ||
              currentUser.full_name ||
              "Current User",

            email:
              currentUser.email ||
              "",

            team:
              currentUser.team ||
              "",

            role:
              currentUser.role ||
              "",
          },
        ];
      }

      /*
       * FALLBACK
       */
      if (
        employees.length ===
        0
      ) {
        const employeeMap =
          new Map();

        attendance.forEach(
          (row) => {
            if (
              !row.user_id
            ) {
              return;
            }

            const key =
              String(
                row.user_id
              );

            if (
              !employeeMap.has(
                key
              )
            ) {
              employeeMap.set(
                key,
                {
                  id:
                    row.user_id,

                  name:
                    row.name ||
                    "Unknown Employee",

                  email:
                    row.email ||
                    "",

                  team:
                    row.team ||
                    "",

                  role:
                    row.role ||
                    "",
                }
              );
            }
          }
        );

        employees =
          Array.from(
            employeeMap.values()
          );
      }

      return employees;
    }, [
      isAdmin,
      staff,
      attendanceUsers,
      currentUser,
      attendance,
      userFilter,
    ]);

  /* =======================================================
     WEEKEND OFF ROWS
  ======================================================= */

  const weekendRows =
    useMemo(() => {
      if (
        !Array.isArray(
          weekendOffDays
        )
      ) {
        return [];
      }

      const rows = [];

      weekendOffDays.forEach(
        (offDay) => {
          const date =
            normalizeDateOnly(
              offDay?.date
            );

          if (!date) {
            return;
          }

          weekendEmployees.forEach(
            (employee) => {
              rows.push({
                id: null,

                row_type:
                  "weekend_off",

                user_id:
                  employee.id,

                name:
                  employee.name,

                email:
                  employee.email,

                team:
                  employee.team,

                role:
                  employee.role,

                attendance_date:
                  date,

                day_name:
                  offDay?.day ||
                  getDayName(
                    date
                  ),

                login_time:
                  null,

                logout_time:
                  null,

                duration_seconds:
                  null,

                attendance_status:
                  "OFF",

                status: "OFF",
              });
            }
          );
        }
      );

      return rows;
    }, [
      weekendOffDays,
      weekendEmployees,
    ]);

  /* =======================================================
     COMBINED ATTENDANCE
  ======================================================= */

  const combinedAttendance =
    useMemo(() => {
      const rows = [
        ...attendance,
        ...weekendRows,
      ];

      return rows.sort(
        (a, b) => {
          const dateA =
            normalizeDateOnly(
              a.attendance_date ||
                a.login_time
            );

          const dateB =
            normalizeDateOnly(
              b.attendance_date ||
                b.login_time
            );

          if (
            dateA !==
            dateB
          ) {
            return dateB.localeCompare(
              dateA
            );
          }

          return (
            Number(
              a.user_id || 0
            ) -
            Number(
              b.user_id || 0
            )
          );
        }
      );
    }, [
      attendance,
      weekendRows,
    ]);

  /* =======================================================
     TEAMS
  ======================================================= */

  const teams =
    useMemo(() => {
      const uniqueTeams =
        new Set();

      combinedAttendance.forEach(
        (row) => {
          const team =
            String(
              row.team || ""
            ).trim();

          if (team) {
            uniqueTeams.add(
              team
            );
          }
        }
      );

      return Array.from(
        uniqueTeams
      ).sort((a, b) =>
        a.localeCompare(b)
      );
    }, [
      combinedAttendance,
    ]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredAttendance =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return combinedAttendance.filter(
        (row) => {
          const status =
            getStatus(row);

          const rowTeam =
            String(
              row.team || ""
            ).trim();

          const matchesSearch =
            !term ||
            String(
              row.name || ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              row.email || ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              row.team || ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              row.day_name || ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              row.attendance_status ||
                ""
            )
              .toLowerCase()
              .includes(term);

          const matchesStatus =
            statusFilter ===
              "All" ||
            status ===
              statusFilter;

          const matchesTeam =
            teamFilter ===
              "All Teams" ||
            rowTeam ===
              teamFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesTeam
          );
        }
      );
    }, [
      combinedAttendance,
      search,
      statusFilter,
      teamFilter,
    ]);

  /* =======================================================
     VISIBLE ATTENDANCE
  ======================================================= */

  const visibleAttendance =
    useMemo(() => {
      return filteredAttendance.filter(
        (row) => {
          if (
            row.row_type ===
            "weekend_off"
          ) {
            return true;
          }

          return !hiddenAttendanceIds.includes(
            String(row.id)
          );
        }
      );
    }, [
      filteredAttendance,
      hiddenAttendanceIds,
    ]);

  /* =======================================================
     HIDDEN RECORDS
  ======================================================= */

  const hiddenRecords =
    useMemo(() => {
      return attendance.filter(
        (row) =>
          row.id &&
          hiddenAttendanceIds.includes(
            String(row.id)
          )
      );
    }, [
      attendance,
      hiddenAttendanceIds,
    ]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats =
    useMemo(() => {
      let totalSeconds = 0;

      attendance.forEach(
        (row) => {
          if (
            row.duration_seconds !==
              null &&
            row.duration_seconds !==
              undefined
          ) {
            totalSeconds +=
              Number(
                row.duration_seconds
              ) || 0;
          }
        }
      );

      return {
        total: Number(
          attendanceCounts.total ||
            attendance.length
        ),

        present: Number(
          attendanceCounts.on_time ||
            0
        ),

        late: Number(
          attendanceCounts.late ||
            0
        ),

        absent: Number(
          attendanceCounts.absent ||
            0
        ),

        off: Number(
          attendanceCounts.off ??
            weekendOffDays.length ??
            0
        ),

        totalHours:
          Math.round(
            (totalSeconds /
              3600) *
              10
          ) / 10,
      };
    }, [
      attendance,
      attendanceCounts,
      weekendOffDays,
    ]);

  /* =======================================================
     OPEN ADD
  ======================================================= */

  function openAddModal() {
    if (!isAdmin) {
      return;
    }

    setEditingRecord(null);

    setForm({
      ...getDefaultForm(),

      /*
       * Agar user filter selected hai
       * to Add modal mein wahi employee
       * default select hoga.
       */
      user_id:
        userFilter !==
        "All Users"
          ? String(
              userFilter
            )
          : staff.length > 0
          ? String(
              staff[0].id
            )
          : "",
    });

    setError("");
    setSuccess("");

    setShowModal(true);
  }

  /* =======================================================
     OPEN EDIT
  ======================================================= */

  function openEditModal(row) {
    if (
      !isAdmin ||
      row?.row_type ===
        "weekend_off"
    ) {
      return;
    }

    const employeeId =
      String(
        row.user_id || ""
      );

    if (employeeId) {
      setStaff((prev) => {
        const alreadyExists =
          prev.some(
            (employee) =>
              String(
                employee.id
              ) ===
              employeeId
          );

        if (
          alreadyExists
        ) {
          return prev;
        }

        return [
          {
            id:
              row.user_id,

            name:
              row.name ||
              "Current Employee",

            email:
              row.email ||
              "",

            team:
              row.team ||
              "",

            role:
              row.role ||
              "",
          },
          ...prev,
        ];
      });
    }

    setEditingRecord(row);

    setForm({
      user_id:
        employeeId,

      login_time:
        toDateTimeLocal(
          row.login_time
        ),

      logout_time:
        row.logout_time
          ? toDateTimeLocal(
              row.logout_time
            )
          : "",

      ip_address:
        row.ip_address ||
        "",

      user_agent:
        row.user_agent ||
        "",
    });

    setError("");
    setSuccess("");

    setShowModal(true);
  }

  /* =======================================================
     DELETE CONFIRM OPEN
  ======================================================= */

  function openDeleteConfirm(
    row
  ) {
    if (
      !isAdmin ||
      row?.row_type ===
        "weekend_off"
    ) {
      return;
    }

    setError("");
    setSuccess("");

    setDeleteRecord(row);
  }

  /* =======================================================
     CLOSE DELETE
  ======================================================= */

  function closeDeleteConfirm() {
    if (deleting) {
      return;
    }

    setDeleteRecord(null);
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete() {
    if (
      !isAdmin ||
      !deleteRecord?.id
    ) {
      return;
    }

    const attendanceId =
      Number(
        deleteRecord.id
      );

    if (
      !Number.isInteger(
        attendanceId
      ) ||
      attendanceId <= 0
    ) {
      setError(
        "Invalid attendance record ID."
      );

      return;
    }

    try {
      setDeleting(true);

      setError("");
      setSuccess("");

      const response =
        await fetch(
          `/api/login-history?id=${encodeURIComponent(
            attendanceId
          )}`,
          {
            method:
              "DELETE",

            credentials:
              "include",

            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to delete attendance"
        );
      }

      setHiddenAttendanceIds(
        (prev) =>
          prev.filter(
            (id) =>
              String(id) !==
              String(
                attendanceId
              )
          )
      );

      setDeleteRecord(null);

      setSuccess(
        "Attendance deleted permanently."
      );

      await loadAttendance(
        false
      );
    } catch (err) {
      console.error(
        "DELETE ATTENDANCE ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to delete attendance"
      );
    } finally {
      setDeleting(false);
    }
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);

    setEditingRecord(null);

    setForm(
      getDefaultForm()
    );
  }

  /* =======================================================
     CHANGE FORM
  ======================================================= */

  function updateForm(
    key,
    value
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSave(e) {
    e.preventDefault();

    if (!isAdmin) {
      return;
    }

    if (!form.user_id) {
      setError(
        "Please select employee."
      );

      return;
    }

    if (!form.login_time) {
      setError(
        "Please select login time."
      );

      return;
    }

    if (
      form.logout_time &&
      form.logout_time <
        form.login_time
    ) {
      setError(
        "Logout time cannot be before login time."
      );

      return;
    }

    try {
      setSaving(true);

      setError("");
      setSuccess("");

      const payload = {
        user_id: Number(
          form.user_id
        ),

        login_time:
          form.login_time.replace(
            "T",
            " "
          ),

        logout_time:
          form.logout_time
            ? form.logout_time.replace(
                "T",
                " "
              )
            : null,

        ip_address:
          form.ip_address ||
          null,

        user_agent:
          form.user_agent ||
          null,
      };

      let response;

      if (editingRecord) {
        response =
          await fetch(
            "/api/login-history",
            {
              method:
                "PUT",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  ...payload,

                  id: Number(
                    editingRecord.id
                  ),
                }),
            }
          );
      } else {
        response =
          await fetch(
            "/api/login-history",
            {
              method:
                "POST",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to save attendance"
        );
      }

      setSuccess(
        editingRecord
          ? "Attendance updated successfully."
          : "Attendance added successfully."
      );

      setShowModal(false);

      setEditingRecord(null);

      await loadAttendance(
        false
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Failed to save attendance"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     PDF
  ======================================================= */

  async function exportPDF() {
    try {
      setError("");

      const jsPDFModule =
        await import(
          "jspdf"
        );

      const autoTableModule =
        await import(
          "jspdf-autotable"
        );

      const jsPDF =
        jsPDFModule.default ||
        jsPDFModule.jsPDF;

      const autoTable =
        autoTableModule.default ||
        autoTableModule.autoTable;

      if (
        typeof jsPDF !==
          "function" ||
        typeof autoTable !==
          "function"
      ) {
        throw new Error(
          "PDF libraries are not available."
        );
      }

      const doc =
        new jsPDF({
          orientation:
            "landscape",

          unit: "mm",

          format: "a4",
        });

      const primaryRed = [
        204,
        0,
        0,
      ];

      const rows =
        visibleAttendance || [];

      if (
        rows.length ===
        0
      ) {
        setError(
          "There are no attendance records to export."
        );

        return;
      }

      /* =====================================================
         EMPLOYEE INFO
      ===================================================== */

      const firstEmployee =
        rows.find(
          (row) =>
            row.row_type !==
            "weekend_off"
        ) ||
        rows[0] ||
        {};

      const employeeId =
        firstEmployee.user_id ||
        "-";

      const employeeName =
        firstEmployee.name ||
        "-";

      const payroll =
        firstEmployee.payroll ||
        "-";

      const campaign =
        firstEmployee.campaign ||
        "-";

      const agentWD =
        firstEmployee.agent_wd ||
        "-";

      /* =====================================================
         TOP HEADER
      ===================================================== */

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        0,
        0,
        0
      );

      doc.text(
        "Dear",
        8,
        12
      );

      doc.setDrawColor(
        0,
        128,
        0
      );

      doc.rect(
        20,
        8,
        55,
        6
      );

      doc.text(
        String(
          employeeName
        ),
        22,
        12
      );

      doc.text(
        `Total Hours: ${
          stats?.totalHours ??
          0
        }`,
        85,
        12
      );

      doc.text(
        `Period: ${fromDate} to ${toDate}`,
        150,
        12
      );

      /* =====================================================
         EMPLOYEE SUMMARY
      ===================================================== */

      autoTable(doc, {
        startY: 16,

        margin: {
          left: 8,
          right: 8,
        },

        head: [[
          "EMP ID",
          "Employee Name",
          "Payroll",
          "Campaign",
          "Agent WD",
        ]],

        body: [[
          employeeId,
          employeeName,
          payroll,
          campaign,
          agentWD,
        ]],

        theme:
          "grid",

        styles: {
          fontSize: 7,

          cellPadding: 2,

          halign:
            "center",

          valign:
            "middle",

          lineColor: [
            200,
            200,
            200,
          ],

          lineWidth:
            0.2,
        },

        headStyles: {
          fillColor:
            primaryRed,

          textColor: [
            255,
            255,
            255,
          ],

          fontStyle:
            "bold",

          fontSize:
            7.5,

          lineColor: [
            255,
            255,
            255,
          ],

          lineWidth:
            0.2,
        },
      });

      let currentY =
        doc.lastAutoTable
          .finalY + 5;

      /* =====================================================
         ATTENDANCE TABLE
      ===================================================== */

      const pdfBody =
        rows.map(
          (row) => {
            const status =
              getStatus(
                row
              );

            const date =
              row.row_type ===
              "weekend_off"
                ? formatCaliforniaDate(
                    row.attendance_date
                  )
                : formatCaliforniaDate(
                    row.login_time
                  );

            const day =
              row.day_name ||
              getDayName(
                row.attendance_date ||
                  row.login_time
              );

            if (
              row.row_type ===
              "weekend_off"
            ) {
              return [
                row.user_id ||
                  "-",

                row.name ||
                  "-",

                row.team ||
                  "-",

                date,

                day,

                "-",

                "-",

                "-",

                "Weekend Off",
              ];
            }

            return [
              row.user_id ||
                "-",

              row.name ||
                "-",

              row.team ||
                "-",

              date,

              day,

              formatCaliforniaTime(
                row.login_time
              ),

              formatCaliforniaTime(
                row.logout_time
              ),

              formatDuration(
                row.duration_seconds
              ),

              status,
            ];
          }
        );

      autoTable(doc, {
        startY:
          currentY,

        margin: {
          left: 8,
          right: 8,
        },

        head: [[
          "EMP ID",
          "Employee",
          "Team",
          "Date",
          "Day",
          "Login",
          "Logout",
          "Duration",
          "Status",
        ]],

        body: pdfBody,

        theme:
          "grid",

        styles: {
          fontSize:
            6.5,

          cellPadding:
            1.8,

          halign:
            "center",

          valign:
            "middle",

          lineColor: [
            200,
            200,
            200,
          ],

          lineWidth:
            0.2,
        },

        headStyles: {
          fillColor:
            primaryRed,

          textColor: [
            255,
            255,
            255,
          ],

          fontStyle:
            "bold",

          fontSize:
            7,

          lineColor: [
            255,
            255,
            255,
          ],

          lineWidth:
            0.2,
        },

        columnStyles: {
          0: {
            cellWidth:
              18,
          },

          1: {
            cellWidth:
              35,

            halign:
              "left",
          },

          2: {
            cellWidth:
              25,
          },

          3: {
            cellWidth:
              27,
          },

          4: {
            cellWidth:
              20,
          },

          5: {
            cellWidth:
              30,
          },

          6: {
            cellWidth:
              30,
          },

          7: {
            cellWidth:
              25,
          },

          8: {
            cellWidth:
              28,
          },
        },

        didParseCell:
          (hookData) => {
            if (
              hookData.section ===
              "body"
            ) {
              const rowData =
                hookData.row
                  .raw;

              if (
                rowData?.[8] ===
                "Weekend Off"
              ) {
                hookData.cell.styles.fillColor =
                  [
                    245,
                    245,
                    245,
                  ];

                hookData.cell.styles.textColor =
                  [
                    100,
                    100,
                    100,
                  ];

                hookData.cell.styles.fontStyle =
                  "bold";
              }
            }
          },
      });

      currentY =
        doc.lastAutoTable
          .finalY + 5;

      /* =====================================================
         SUMMARY
      ===================================================== */

      if (
        currentY >
        175
      ) {
        doc.addPage();

        currentY = 12;
      }

      autoTable(doc, {
        startY:
          currentY,

        margin: {
          left: 8,
          right: 8,
        },

        head: [[
          "Present",
          "Late",
          "Absent",
          "Weekend Off",
          "Total Hours",
        ]],

        body: [[
          stats?.present ??
            0,

          stats?.late ??
            0,

          stats?.absent ??
            0,

          stats?.off ??
            0,

          stats?.totalHours ??
            0,
        ]],

        theme:
          "grid",

        styles: {
          fontSize:
            7,

          cellPadding:
            2,

          halign:
            "center",

          valign:
            "middle",

          lineColor: [
            200,
            200,
            200,
          ],

          lineWidth:
            0.2,
        },

        headStyles: {
          fillColor:
            primaryRed,

          textColor: [
            255,
            255,
            255,
          ],

          fontStyle:
            "bold",

          fontSize:
            7,

          lineColor: [
            255,
            255,
            255,
          ],

          lineWidth:
            0.2,
        },
      });

      /* =====================================================
         FOOTER
      ===================================================== */

      const pageCount =
        doc.internal
          .getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {
        doc.setPage(page);

        const pageHeight =
          doc.internal
            .pageSize.height;

        doc.setFontSize(
          6.5
        );

        doc.setTextColor(
          120,
          120,
          120
        );

        doc.text(
          `Digital Orbits CRM • Attendance Report • ${CALIFORNIA_TIMEZONE}`,
          8,
          pageHeight - 6
        );

        doc.text(
          `Page ${page} of ${pageCount}`,
          289,
          pageHeight - 6,
          {
            align:
              "right",
          }
        );
      }

      /* =====================================================
         DOWNLOAD
      ===================================================== */

      const selectedEmployee =
        userFilter !==
        "All Users"
          ? userOptions.find(
              (user) =>
                String(
                  user.id
                ) ===
                String(
                  userFilter
                )
            )
          : null;

      const employeeSlug =
        selectedEmployee?.name
          ? `-${String(
              selectedEmployee.name
            )
              .trim()
              .replace(
                /\s+/g,
                "-"
              )
              .replace(
                /[^a-zA-Z0-9-_]/g,
                ""
              )}`
          : "";

      doc.save(
        `attendance${employeeSlug}-${fromDate}-${toDate}.pdf`
      );

      setSuccess(
        "Attendance PDF downloaded successfully."
      );
    } catch (error) {
      console.error(
        "PDF ERROR:",
        error
      );

      setError(
        "Unable to generate PDF. Please make sure jspdf and jspdf-autotable are installed."
      );
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#741C29]/20 border-t-[#741C29] rounded-full animate-spin" />

          <p className="text-sm text-slate-500">
            Loading attendance...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen lg:pl-[270px]">
      <div className="p-4 sm:p-6 lg:p-8">

        {/* SIDEBAR */}

        <Sidebar />

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">

          <div>
            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-xl bg-[#741C29] flex items-center justify-center shadow-sm">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Attendance
                </h1>

                <p className="text-sm text-slate-500">
                  Employee attendance and login history
                </p>
              </div>

              {isAdmin && (
                <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#741C29]/10 text-[#741C29]">
                  Admin View
                </span>
              )}

            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* REFRESH */}

            <button
              type="button"
              onClick={() =>
                loadAttendance(false)
              }
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>

            {/* PDF */}

            <button
              type="button"
              onClick={exportPDF}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <Download className="w-4 h-4" />

              Export PDF
            </button>

            {/* ADMIN ADD */}

            {isAdmin && (
              <button
                type="button"
                onClick={
                  openAddModal
                }
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#741C29] text-white text-sm font-semibold shadow-sm hover:bg-[#611621] transition"
              >
                <Plus className="w-4 h-4" />

                Add Attendance
              </button>
            )}

          </div>
        </div>

        {/* =================================================
            ALERTS
        ================================================= */}

        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <AlertCircle className="w-5 h-5 shrink-0" />

            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>

          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">

            <UserCheck className="w-5 h-5" />

            <span>
              {success}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>

          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">

          <StatCard
            icon={Users}
            title="Total Records"
            value={stats.total}
            subtitle={`Weekdays • ${stats.off} weekend off`}
          />

          <StatCard
            icon={UserCheck}
            title="Present"
            value={stats.present}
            subtitle="On time attendance"
          />

          <StatCard
            icon={AlertCircle}
            title="Late"
            value={stats.late}
            subtitle="Late arrivals"
          />

          <StatCard
            icon={Clock3}
            title="Total Hours"
            value={stats.totalHours}
            subtitle="Logged working hours"
          />

          <StatCard
            icon={FileText}
            title="Absent"
            value={stats.absent}
            subtitle="Weekdays without attendance"
          />

          <StatCard
            icon={CalendarDays}
            title="Weekend Off"
            value={stats.off}
            subtitle="Saturday & Sunday"
          />

        </div>

        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">

            {/* SEARCH */}

            <div className="xl:col-span-2 relative">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search employee, email or team..."
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
              />

            </div>

            {/* FROM */}

            <div className="relative">

              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

              <input
                type="date"
                value={fromDate}
                onChange={(e) =>
                  setFromDate(
                    e.target.value
                  )
                }
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
              />

            </div>

            {/* TO */}

            <div className="relative">

              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

              <input
                type="date"
                value={toDate}
                onChange={(e) =>
                  setToDate(
                    e.target.value
                  )
                }
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
              />

            </div>

            {/* USER */}

            {isAdmin && (
              <div className="relative">

                <select
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(
                      e.target.value
                    );

                    /*
                     * User change par team
                     * filter reset
                     */
                    setTeamFilter(
                      "All Teams"
                    );
                  }}
                  className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
                >

                  <option value="All Users">
                    All Users
                  </option>

                  {userOptions.map(
                    (user) => (
                      <option
                        key={
                          user.id
                        }
                        value={String(
                          user.id
                        )}
                      >
                        {user.name}
                        {user.email
                          ? ` — ${user.email}`
                          : ""}
                      </option>
                    )
                  )}

                </select>

                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

              </div>
            )}

            {/* TEAM */}

            <div className="relative">

              <select
                value={
                  teamFilter
                }
                onChange={(e) =>
                  setTeamFilter(
                    e.target.value
                  )
                }
                className="appearance-none w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] px-3 pr-9 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
              >

                <option>
                  All Teams
                </option>

                {teams.map(
                  (team) => (
                    <option
                      key={team}
                      value={team}
                    >
                      {team}
                    </option>
                  )
                )}

              </select>

              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

            </div>

            {/* STATUS */}

            <div className="relative">

              <select
                value={
                  statusFilter
                }
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
                className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
              >

                <option value="All">
                  All Status
                </option>

                <option value="Present">
                  Present
                </option>

                <option value="Late">
                  Late
                </option>

                <option value="Absent">
                  Absent
                </option>

                <option value="OFF">
                  Weekend Off
                </option>

              </select>

              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

            </div>

          </div>

          {/* =================================================
              HIDE / UNHIDE
          ================================================= */}

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div className="text-xs text-slate-400">

              {hiddenRecords.length >
              0
                ? `${
                    hiddenRecords.length
                  } attendance ${
                    hiddenRecords.length ===
                    1
                      ? "record"
                      : "records"
                  } hidden`
                : "No hidden attendance records"}

            </div>

            <div className="relative">

              <button
                type="button"
                onClick={() =>
                  setShowHiddenMenu(
                    (prev) =>
                      !prev
                  )
                }
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#741C29]/30 transition"
              >

                <Settings2 className="w-4 h-4 text-[#741C29]" />

                Hide / Unhide Lines

                {hiddenRecords.length >
                  0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#741C29] text-white text-[10px] font-bold">
                    {
                      hiddenRecords.length
                    }
                  </span>
                )}

                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showHiddenMenu
                      ? "rotate-180"
                      : ""
                  }`}
                />

              </button>

              {/* HIDDEN MENU */}

              {showHiddenMenu && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-full sm:w-[420px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">

                  <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/80">

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <div className="flex items-center gap-2">

                          <EyeOff className="w-4 h-4 text-[#741C29]" />

                          <h3 className="text-sm font-bold text-slate-900">
                            Hidden Lines
                          </h3>

                        </div>

                        <p className="text-xs text-slate-500 mt-1">
                          Manage hidden attendance records.
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setShowHiddenMenu(
                            false
                          )
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>

                    </div>

                  </div>

                  {hiddenRecords.length ===
                  0 ? (
                    <div className="px-5 py-10 text-center">

                      <div className="w-11 h-11 rounded-xl bg-slate-100 mx-auto flex items-center justify-center mb-3">

                        <Eye className="w-5 h-5 text-slate-400" />

                      </div>

                      <p className="text-sm font-semibold text-slate-700">
                        No hidden lines
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        Click Hide in the Action column to hide a record.
                      </p>

                    </div>
                  ) : (
                    <>
                      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">

                        {hiddenRecords.map(
                          (row) => (
                            <div
                              key={
                                row.id
                              }
                              className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50"
                            >

                              <div className="w-9 h-9 shrink-0 rounded-full bg-[#741C29]/10 text-[#741C29] flex items-center justify-center font-bold text-xs">
                                {String(
                                  row.name ||
                                    "U"
                                )
                                  .slice(
                                    0,
                                    1
                                  )
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">

                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {row.name ||
                                    "Unknown Employee"}
                                </p>

                                <p className="text-xs text-slate-400 truncate">
                                  {formatCaliforniaDate(
                                    row.login_time
                                  )}{" "}
                                  •{" "}
                                  {formatCaliforniaTime(
                                    row.login_time
                                  )}
                                </p>

                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  unhideAttendanceRecord(
                                    row.id
                                  )
                                }
                                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                              >

                                <Eye className="w-3.5 h-3.5" />

                                Unhide

                              </button>

                            </div>
                          )
                        )}

                      </div>

                      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70">

                        <button
                          type="button"
                          onClick={
                            unhideAllAttendance
                          }
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-[#741C29] hover:text-[#741C29] transition"
                        >
                          Unhide All Lines
                        </button>

                      </div>
                    </>
                  )}

                </div>
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1150px]">

              <thead>

                <tr className="bg-slate-50 border-b border-slate-200">

                  {isAdmin && (
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Staff
                    </th>
                  )}

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Day
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Login
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Logout
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Duration
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  {isAdmin && (
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  )}

                  {!isAdmin && (
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Email
                    </th>
                  )}

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {visibleAttendance.length ===
                0 ? (
                  <tr>

                    <td
                      colSpan={
                        isAdmin
                          ? 8
                          : 7
                      }
                      className="px-5 py-14 text-center"
                    >

                      <div className="flex flex-col items-center">

                        {filteredAttendance.length >
                        0 ? (
                          <>
                            <EyeOff className="w-10 h-10 text-slate-300 mb-3" />

                            <p className="font-semibold text-slate-700">
                              All filtered lines are hidden
                            </p>

                            <p className="text-sm text-slate-400 mt-1">
                              Open Hide / Unhide Lines to show them again.
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                setShowHiddenMenu(
                                  true
                                )
                              }
                              className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#741C29] text-white text-xs font-semibold hover:bg-[#611621] transition"
                            >
                              <Eye className="w-3.5 h-3.5" />

                              Show Hidden Lines
                            </button>
                          </>
                        ) : (
                          <>
                            <FileText className="w-10 h-10 text-slate-300 mb-3" />

                            <p className="font-semibold text-slate-700">
                              No attendance found
                            </p>

                            <p className="text-sm text-slate-400 mt-1">
                              Try changing the filters or date range.
                            </p>
                          </>
                        )}

                      </div>

                    </td>

                  </tr>
                ) : (
                  visibleAttendance.map(
                    (row) => {
                      const status =
                        getStatus(
                          row
                        );

                      const rowKey =
                        row.row_type ===
                        "weekend_off"
                          ? `off-${row.user_id}-${row.attendance_date}`
                          : row.id;

                      return (
                        <tr
                          key={
                            rowKey
                          }
                          className={
                            row.row_type ===
                            "weekend_off"
                              ? "bg-slate-50 hover:bg-slate-100 transition"
                              : "hover:bg-slate-50/70 transition"
                          }
                        >

                          {/* STAFF */}

                          {isAdmin && (
                            <td className="px-5 py-4">

                              <div className="flex items-center gap-3">

                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                                    row.row_type ===
                                    "weekend_off"
                                      ? "bg-slate-200 text-slate-600"
                                      : "bg-[#741C29]/10 text-[#741C29]"
                                  }`}
                                >
                                  {String(
                                    row.name ||
                                      "U"
                                  )
                                    .slice(
                                      0,
                                      1
                                    )
                                    .toUpperCase()}
                                </div>

                                <div>

                                  <div className="font-semibold text-sm text-slate-800">
                                    {row.name ||
                                      "-"}
                                  </div>

                                  <div className="text-xs text-slate-400">
                                    {row.team ||
                                      "Staff"}
                                  </div>

                                </div>

                              </div>

                            </td>
                          )}

                          {/* DATE */}

                          <td className="px-5 py-4 text-sm text-slate-700 whitespace-nowrap">
                            {row.row_type ===
                            "weekend_off"
                              ? formatCaliforniaDate(
                                  row.attendance_date
                                )
                              : formatCaliforniaDate(
                                  row.login_time
                                )}
                          </td>

                          {/* DAY */}

                          <td className="px-5 py-4 text-sm font-medium text-slate-600 whitespace-nowrap">
                            {row.day_name ||
                              getDayName(
                                row.attendance_date ||
                                  row.login_time
                              )}
                          </td>

                          {/* LOGIN */}

                          <td className="px-5 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                            {row.row_type ===
                            "weekend_off"
                              ? "—"
                              : formatCaliforniaTime(
                                  row.login_time
                                )}
                          </td>

                          {/* LOGOUT */}

                          <td className="px-5 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                            {row.row_type ===
                            "weekend_off"
                              ? "—"
                              : formatCaliforniaTime(
                                  row.logout_time
                                )}
                          </td>

                          {/* DURATION */}

                          <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                            {row.row_type ===
                            "weekend_off"
                              ? "OFF"
                              : formatDuration(
                                  row.duration_seconds
                                )}
                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">

                            {status ===
                            "OFF" ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Weekend Off
                              </span>
                            ) : status ===
                              "Absent" ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                                Absent
                              </span>
                            ) : status ===
                              "Late" ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                Late
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Present
                              </span>
                            )}

                          </td>

                          {/* ADMIN ACTION */}

                          {isAdmin && (
                            <td className="px-5 py-4 text-right">

                              {row.row_type ===
                              "weekend_off" ? (
                                <span className="text-xs font-semibold text-slate-400">
                                  Weekend Off
                                </span>
                              ) : (
                                <div className="inline-flex items-center gap-2">

                                  {/* EDIT */}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditModal(
                                        row
                                      )
                                    }
                                    className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:border-[#741C29] hover:text-[#741C29] transition"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />

                                    Edit
                                  </button>

                                  {/* DELETE */}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDeleteConfirm(
                                        row
                                      )
                                    }
                                    className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 hover:border-red-300 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />

                                    Delete
                                  </button>

                                  {/* HIDE */}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      hideAttendanceRecord(
                                        row
                                      )
                                    }
                                    className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 hover:border-[#741C29]/30 hover:text-[#741C29] transition"
                                    title="Hide this attendance record"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />

                                    Hide
                                  </button>

                                </div>
                              )}

                            </td>
                          )}

                          {/* NON ADMIN EMAIL */}

                          {!isAdmin && (
                            <td className="px-5 py-4 text-sm text-slate-500">
                              {row.email ||
                                "-"}
                            </td>
                          )}

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">

            Showing{" "}

            <span className="font-semibold text-slate-700">
              {
                visibleAttendance.length
              }
            </span>

            {" "}of{" "}

            <span className="font-semibold text-slate-700">
              {
                filteredAttendance.length
              }
            </span>

            {" "}rows

            {hiddenRecords.length >
              0 && (
              <>
                {" "}
                •{" "}
                <span className="font-semibold text-[#741C29]">
                  {
                    hiddenRecords.length
                  }{" "}
                  hidden
                </span>
              </>
            )}

            {" "}
            •{" "}

            <span className="font-semibold text-slate-700">
              {stats.off}
            </span>{" "}
            weekend off

          </div>

        </div>

      </div>

      {/* ===================================================
          ADMIN ADD / EDIT MODAL
      =================================================== */}

      {showModal &&
        isAdmin && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
              onClick={
                closeModal
              }
            />

            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">

              {/* HEADER */}

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">

                <div className="flex items-center gap-3">

                  <div className="w-10 h-10 rounded-xl bg-[#741C29]/10 flex items-center justify-center">

                    {editingRecord ? (
                      <Pencil className="w-5 h-5 text-[#741C29]" />
                    ) : (
                      <Plus className="w-5 h-5 text-[#741C29]" />
                    )}

                  </div>

                  <div>

                    <h2 className="text-lg font-bold text-slate-900">
                      {editingRecord
                        ? "Edit Attendance"
                        : "Add Attendance"}
                    </h2>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Time is saved using California timezone
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>

              </div>

              {/* FORM */}

              <form
                onSubmit={
                  handleSave
                }
                className="p-6"
              >

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* EMPLOYEE */}

                  <div className="md:col-span-2">

                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Employee
                    </label>

                    <div className="relative">

                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                      <select
                        value={
                          form.user_id
                        }
                        onChange={(
                          e
                        ) =>
                          updateForm(
                            "user_id",
                            e.target
                              .value
                          )
                        }
                        required
                        className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
                      >

                        <option value="">
                          Select employee
                        </option>

                        {staff.map(
                          (
                            employee
                          ) => (
                            <option
                              key={
                                employee.id
                              }
                              value={
                                employee.id
                              }
                            >
                              {
                                employee.name
                              }

                              {employee.email
                                ? ` — ${employee.email}`
                                : ""}
                            </option>
                          )
                        )}

                      </select>

                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                    </div>

                  </div>

                  {/* LOGIN */}

                  <div>

                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Login Time
                    </label>

                    <input
                      type="datetime-local"
                      step="1"
                      value={
                        form.login_time
                      }
                      onChange={(
                        e
                      ) =>
                        updateForm(
                          "login_time",
                          e.target
                            .value
                        )
                      }
                      required
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
                    />

                  </div>

                  {/* LOGOUT */}

                  <div>

                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Logout Time
                    </label>

                    <input
                      type="datetime-local"
                      step="1"
                      value={
                        form.logout_time
                      }
                      onChange={(
                        e
                      ) =>
                        updateForm(
                          "logout_time",
                          e.target
                            .value
                        )
                      }
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
                    />

                    <p className="text-xs text-slate-400 mt-1.5">
                      Leave empty if employee is still logged in.
                    </p>

                  </div>

                  {/* IP */}

                  <div>

                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      IP Address
                    </label>

                    <input
                      type="text"
                      value={
                        form.ip_address
                      }
                      onChange={(
                        e
                      ) =>
                        updateForm(
                          "ip_address",
                          e.target
                            .value
                        )
                      }
                      placeholder="Optional"
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
                    />

                  </div>

                  {/* USER AGENT */}

                  <div>

                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      User Agent
                    </label>

                    <input
                      type="text"
                      value={
                        form.user_agent
                      }
                      onChange={(
                        e
                      ) =>
                        updateForm(
                          "user_agent",
                          e.target
                            .value
                        )
                      }
                      placeholder="Optional"
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-[#741C29] focus:ring-4 focus:ring-[#741C29]/10"
                    />

                  </div>

                </div>

                {/* MODAL ERROR */}

                {error && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">

                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />

                    <span>
                      {error}
                    </span>

                  </div>
                )}

                {/* FOOTER */}

                <div className="flex items-center justify-end gap-3 mt-7 pt-5 border-t border-slate-100">

                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      saving
                    }
                    className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    className="h-11 px-5 rounded-xl bg-[#741C29] text-white text-sm font-semibold hover:bg-[#611621] transition disabled:opacity-60 inline-flex items-center gap-2"
                  >

                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />

                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />

                        {editingRecord
                          ? "Update Attendance"
                          : "Add Attendance"}
                      </>
                    )}

                  </button>

                </div>

              </form>

            </div>
          </div>
        )}

      {/* ===================================================
          DELETE CONFIRMATION MODAL
      =================================================== */}

      {deleteRecord &&
        isAdmin && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">

            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
              onClick={
                closeDeleteConfirm
              }
            />

            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

              <div className="p-6">

                <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">

                  <AlertTriangle className="w-6 h-6 text-red-600" />

                </div>

                <h2 className="text-xl font-bold text-slate-900">
                  Are you sure?
                </h2>

                <p className="text-sm text-slate-500 mt-2 leading-6">
                  Are you sure you want to permanently delete this attendance record?
                  This action cannot be undone.
                </p>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-full bg-[#741C29]/10 text-[#741C29] flex items-center justify-center font-bold text-sm">

                      {String(
                        deleteRecord.name ||
                          "U"
                      )
                        .slice(
                          0,
                          1
                        )
                        .toUpperCase()}

                    </div>

                    <div className="min-w-0">

                      <p className="font-semibold text-sm text-slate-800 truncate">
                        {deleteRecord.name ||
                          "Unknown Employee"}
                      </p>

                      <p className="text-xs text-slate-500 truncate">
                        {deleteRecord.email ||
                          deleteRecord.team ||
                          "Attendance Record"}
                      </p>

                    </div>

                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">

                    <div>

                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                        Date
                      </p>

                      <p className="text-sm font-medium text-slate-700 mt-1">
                        {formatCaliforniaDate(
                          deleteRecord.login_time
                        )}
                      </p>

                    </div>

                    <div>

                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                        Login
                      </p>

                      <p className="text-sm font-medium text-slate-700 mt-1">
                        {formatCaliforniaTime(
                          deleteRecord.login_time
                        )}
                      </p>

                    </div>

                  </div>

                </div>

                <div className="flex items-center justify-end gap-3 mt-6">

                  <button
                    type="button"
                    onClick={
                      closeDeleteConfirm
                    }
                    disabled={
                      deleting
                    }
                    className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleDelete
                    }
                    disabled={
                      deleting
                    }
                    className="h-11 px-5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60 inline-flex items-center gap-2"
                  >

                    {deleting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />

                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />

                        Yes, Delete
                      </>
                    )}

                  </button>

                </div>

              </div>

            </div>
          </div>
        )}

    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="text-2xl font-bold text-slate-900 mt-1">
            {value}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            {subtitle}
          </p>

        </div>

        <div className="w-10 h-10 rounded-xl bg-[#741C29]/10 flex items-center justify-center">

          <Icon className="w-5 h-5 text-[#741C29]" />

        </div>

      </div>

    </div>
  );
}