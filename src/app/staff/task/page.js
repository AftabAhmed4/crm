"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  X,
  AlertCircle,
  CalendarDays,
  Filter,
  RefreshCw,
} from "lucide-react";

import Sidebar from "@/components/Sidebar";
import LogoutModal from "@/components/LogoutModal";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Loader from "@/components/Loader";

const PAGE_SIZE = 50;
const DAILY_TASK_LIMIT = 500;
const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

/* =========================================================
   GENERIC STRING
========================================================= */

function stringValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/* =========================================================
   CALIFORNIA TODAY
========================================================= */

function getCaliforniaDate() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: CALIFORNIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/* =========================================================
   DATE ONLY NORMALIZER
========================================================= */

function normalizeDateOnly(value) {
  if (!value) {
    return "";
  }

  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  /*
    Direct database DATE:
    YYYY-MM-DD
    YYYY/MM/DD

    Do NOT convert these through JS Date because timezone
    can shift the date.
  */

  const ymdMatch = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
  );

  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(ymdMatch[2]).padStart(2, "0");
    const day = String(ymdMatch[3]).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  /*
    Other date/time values.
    Convert to California date.
  */

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: CALIFORNIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

/* =========================================================
   CALIFORNIA DISPLAY DATE
========================================================= */

function formatCaliforniaDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  try {
    const raw = String(dateValue).trim();

    const directMatch = raw.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
    );

    if (directMatch) {
      const year = Number(directMatch[1]);
      const month = Number(directMatch[2]);
      const day = Number(directMatch[3]);

      const localDate = new Date(
        year,
        month - 1,
        day
      );

      if (!Number.isNaN(localDate.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }).format(localDate);
      }
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return new Intl.DateTimeFormat("en-US", {
      timeZone: CALIFORNIA_TIMEZONE,
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return String(dateValue);
  }
}

/* =========================================================
   DATE SEARCH VALUE
========================================================= */

function getSearchableDate(value) {
  if (!value) {
    return "";
  }

  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  const values = [raw];

  const directMatch = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
  );

  if (directMatch) {
    const year = Number(directMatch[1]);
    const month = Number(directMatch[2]);
    const day = Number(directMatch[3]);

    const yyyy = String(year);
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");

    values.push(`${yyyy}-${mm}-${dd}`);
    values.push(`${dd}-${mm}-${yyyy}`);
    values.push(`${mm}-${dd}-${yyyy}`);
    values.push(`${dd}/${mm}/${yyyy}`);
    values.push(`${mm}/${dd}/${yyyy}`);
    values.push(`${yyyy}/${mm}/${dd}`);
    values.push(`${dd}.${mm}.${yyyy}`);

    try {
      const localDate = new Date(
        year,
        month - 1,
        day
      );

      values.push(
        new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }).format(localDate)
      );

      values.push(
        new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric",
        }).format(localDate)
      );
    } catch {}

    return values
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  const date = new Date(raw);

  if (!Number.isNaN(date.getTime())) {
    try {
      const partsArray =
        new Intl.DateTimeFormat("en-US", {
          timeZone: CALIFORNIA_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(date);

      const parts = {};

      partsArray.forEach((part) => {
        if (part.type !== "literal") {
          parts[part.type] = part.value;
        }
      });

      const yyyy = parts.year || "";
      const mm = parts.month || "";
      const dd = parts.day || "";

      if (yyyy && mm && dd) {
        values.push(`${yyyy}-${mm}-${dd}`);
        values.push(`${dd}-${mm}-${yyyy}`);
        values.push(`${mm}-${dd}-${yyyy}`);
        values.push(`${dd}/${mm}/${yyyy}`);
        values.push(`${mm}/${dd}/${yyyy}`);
        values.push(`${yyyy}/${mm}/${dd}`);
        values.push(`${dd}.${mm}.${yyyy}`);
      }

      values.push(
        new Intl.DateTimeFormat("en-US", {
          timeZone: CALIFORNIA_TIMEZONE,
          month: "short",
          day: "2-digit",
          year: "numeric",
        }).format(date)
      );

      values.push(
        new Intl.DateTimeFormat("en-US", {
          timeZone: CALIFORNIA_TIMEZONE,
          month: "long",
          day: "2-digit",
          year: "numeric",
        }).format(date)
      );
    } catch {}
  }

  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/* =========================================================
   PHONE
========================================================= */

function cleanPhone(phone) {
  if (!phone) {
    return "";
  }

  return String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
}

function getSearchablePhone(phone) {
  if (!phone) {
    return "";
  }

  const raw = String(phone).trim();
  const cleaned = cleanPhone(raw);

  return [
    raw,
    cleaned,
    cleaned.replace(/^\+/, ""),
  ]
    .filter(Boolean)
    .join(" ");
}

/* =========================================================
   ALL STATUS FIELDS
========================================================= */

const STATUS_FIELDS = [
  "status",
  "assignment_status",
  "call_status",
  "disposition",
  "outcome",
  "status_name",
  "task_status",
  "current_status",
  "result",
  "resolution",
  "activity_status",
  "call_disposition",
  "lead_status",
  "contact_status",
  "processing_status",
  "final_status",
  "selected_status",
  "selectedStatus",
  "statusName",
  "result_status",
  "call_result",
  "contact_result",
  "task_result",
  "action_status",
  "status_label",
  "label",
  "outcome_status",
  "disposition_status",
  "lead_result",
  "customer_status",
  "crm_status",
  "latest_status",
];

/* =========================================================
   GET ALL STATUS VALUES FROM TASK
========================================================= */

function getAllTaskStatuses(row) {
  if (!row) {
    return [];
  }

  const values = [];

  STATUS_FIELDS.forEach((field) => {
    const value = row?.[field];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      values.push(String(value).trim());
    }
  });

  /*
    Also inspect keys dynamically.
    This catches future status fields that are not
    currently listed in STATUS_FIELDS.
  */

  Object.entries(row).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    const looksLikeStatusField =
      lowerKey.includes("status") ||
      lowerKey.includes("disposition") ||
      lowerKey.includes("outcome") ||
      lowerKey.includes("result");

    if (!looksLikeStatusField) {
      return;
    }

    if (
      value !== null &&
      value !== undefined &&
      typeof value !== "object" &&
      String(value).trim() !== ""
    ) {
      values.push(String(value).trim());
    }
  });

  const unique = [];
  const seen = new Set();

  values.forEach((value) => {
    const normalized = value.toLowerCase();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(value);
    }
  });

  return unique;
}

/* =========================================================
   PRIMARY STATUS
========================================================= */

function getTaskStatus(row) {
  const statuses = getAllTaskStatuses(row);

  return statuses.length > 0
    ? statuses[0]
    : "";
}

/* =========================================================
   COMPLETED CHECK
========================================================= */

function isTaskCompleted(row) {
  if (!row) {
    return false;
  }

  const statuses = getAllTaskStatuses(row).map(
    (value) => value.toLowerCase()
  );

  const completedStatusExists = statuses.some(
    (value) =>
      value === "completed" ||
      value === "complete" ||
      value === "done"
  );

  return (
    row?.is_completed === true ||
    row?.is_completed === 1 ||
    row?.is_completed === "1" ||
    row?.completed === true ||
    row?.completed === 1 ||
    row?.completed === "1" ||
    row?.processed === true ||
    row?.processed === 1 ||
    row?.processed === "1" ||
    row?.is_locked === true ||
    row?.is_locked === 1 ||
    row?.is_locked === "1" ||
    row?.locked === true ||
    row?.locked === 1 ||
    row?.locked === "1" ||
    row?.assignment_completed === true ||
    row?.assignment_completed === 1 ||
    row?.assignment_completed === "1" ||
    Boolean(row?.completed_at) ||
    Boolean(row?.processed_at) ||
    Boolean(row?.finished_at) ||
    completedStatusExists
  );
}

/* =========================================================
   DATE FIELD FROM TASK
========================================================= */

function getTaskDateValue(task) {
  if (!task) {
    return "";
  }

  return (
    task?.assignment_date ??
    task?.date ??
    task?.task_date ??
    task?.created_at ??
    task?.assigned_at ??
    task?.updated_at ??
    ""
  );
}

/* =========================================================
   SEARCH ALL OBJECT VALUES
   This makes ANY future DB field searchable too.
========================================================= */

function flattenSearchValues(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      flattenSearchValues(item)
    );
  }

  if (typeof value === "object") {
    return Object.values(value).flatMap((item) =>
      flattenSearchValues(item)
    );
  }

  return [String(value)];
}

/* =========================================================
   COMPLETE TASK SEARCH TEXT

   IMPORTANT:
   Search:
   - name
   - phone
   - business
   - ID
   - comments
   - dates
   - ALL status fields
   - ANY future DB fields
========================================================= */

function getTaskSearchText(task) {
  if (!task) {
    return "";
  }

  const dateValue = getTaskDateValue(task);

  const phoneValue =
    task?.phone_number ??
    task?.phone ??
    task?.number ??
    task?.phoneNumber ??
    "";

  const allStatuses =
    getAllTaskStatuses(task);

  const knownValues = [
    /* IDs */
    task?.assignment_id,
    task?.task_id,
    task?.id,
    task?.task_number,
    task?.assignment_number,
    task?.number_id,

    /* DATE */
    dateValue,
    getSearchableDate(dateValue),

    /* NAME */
    task?.name,
    task?.contact_name,
    task?.customer_name,
    task?.full_name,
    task?.lead_name,
    task?.client_name,
    task?.first_name,
    task?.last_name,
    task?.firstName,
    task?.lastName,

    /* PHONE */
    phoneValue,
    getSearchablePhone(phoneValue),

    /* BUSINESS */
    task?.business,
    task?.business_name,
    task?.company,
    task?.company_name,
    task?.organization,
    task?.companyName,
    task?.businessName,

    /* FILE */
    task?.source_file,
    task?.source,
    task?.source_file_name,
    task?.file_name,
    task?.filename,
    task?.file,
    task?.sheet_name,
    task?.sheet,
    task?.source_type,
    task?.campaign,
    task?.campaign_name,

    /* ALL STATUS */
    ...allStatuses,

    /* COMMENTS */
    task?.comment,
    task?.comments,
    task?.notes,
    task?.note,
    task?.remarks,
    task?.description,

    /* OTHER */
    task?.category,
    task?.type,

    /* STATUS TEXT */
    isTaskCompleted(task)
      ? "completed"
      : "pending",
  ];

  /*
    Automatically add ALL fields from DB object.
    Therefore if backend returns:
       status_2
       custom_status
       follow_up_status
       some_new_field

    it will also be searchable.
  */

  const automaticValues =
    flattenSearchValues(task);

  return [
    ...knownValues,
    ...automaticValues,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .map((value) =>
      String(value).toLowerCase()
    )
    .join(" ");
}

/* =========================================================
   COMPONENT
========================================================= */

export default function StaffDashboardPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState([]);
  const [staff, setStaff] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const [apiDate, setApiDate] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  /* DATE FILTER */
  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [showLogout, setShowLogout] =
    useState(false);

  /* =======================================================
     COUNTERS
  ======================================================= */

  const [dailyTotal, setDailyTotal] =
    useState(DAILY_TASK_LIMIT);

  const [completedToday, setCompletedToday] =
    useState(0);

  const [remainingTasks, setRemainingTasks] =
    useState(DAILY_TASK_LIMIT);

  /* =======================================================
     LOAD STAFF
  ======================================================= */

  const loadStaff = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/auth/me",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        router.replace("/login");
        return null;
      }

      const data =
        await response.json();

      if (!data?.user) {
        router.replace("/login");
        return null;
      }

      setStaff(data.user);

      return data.user;
    } catch (err) {
      console.error(
        "loadStaff error:",
        err
      );

      router.replace("/login");

      return null;
    }
  }, [router]);

  /* =======================================================
     FETCH TASKS
  ======================================================= */

  const fetchData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const currentStaff =
          await loadStaff();

        if (!currentStaff) {
          return;
        }

        const res = await fetch(
          `/api/employee/tasks?_=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control":
                "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        const data =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Failed to load daily tasks."
          );
        }

        const incomingTasks =
          Array.isArray(data?.tasks)
            ? data.tasks
            : [];

        const activeTasks =
          incomingTasks
            .filter(
              (task) =>
                !isTaskCompleted(task)
            )
            .slice(
              0,
              DAILY_TASK_LIMIT
            );

        setTasks(activeTasks);

        /* =================================================
           COUNTERS
        ================================================= */

        const backendTotal =
          Number(data?.total);

        const backendCompleted =
          Number(
            data?.completed_today
          );

        const backendRemaining =
          Number(data?.remaining);

        if (
          Number.isFinite(
            backendTotal
          ) &&
          backendTotal >= 0
        ) {
          setDailyTotal(
            Math.min(
              backendTotal,
              DAILY_TASK_LIMIT
            )
          );
        } else {
          setDailyTotal(
            DAILY_TASK_LIMIT
          );
        }

        if (
          Number.isFinite(
            backendCompleted
          ) &&
          backendCompleted >= 0
        ) {
          setCompletedToday(
            backendCompleted
          );
        }

        if (
          Number.isFinite(
            backendRemaining
          ) &&
          backendRemaining >= 0
        ) {
          setRemainingTasks(
            Math.min(
              backendRemaining,
              DAILY_TASK_LIMIT
            )
          );
        } else {
          setRemainingTasks(
            activeTasks.length
          );

          if (
            !Number.isFinite(
              backendCompleted
            )
          ) {
            setCompletedToday(
              Math.max(
                0,
                DAILY_TASK_LIMIT -
                  activeTasks.length
              )
            );
          }
        }

        setApiDate(
          data?.california_date ||
            data?.date ||
            getCaliforniaDate()
        );

        setPage(1);
      } catch (err) {
        console.error(
          "Fetch tasks error:",
          err
        );

        setError(
          err?.message ||
            "Something went wrong while loading Daily Desk."
        );

        toast.error(
          err?.message ||
            "Failed to load daily tasks."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadStaff]
  );

  /* =======================================================
     FETCH STATUS
  ======================================================= */

  const fetchStatus =
    useCallback(async () => {
      try {
        const res = await fetch(
          `/api/employee/tasks-status?_=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control":
                "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        const data =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Failed to load statuses."
          );
        }

        const dbStatuses =
          Array.isArray(data?.data)
            ? data.data
            : Array.isArray(
                data?.statuses
              )
            ? data.statuses
            : [];

        const normalized =
          dbStatuses
            .map((item) => {
              if (
                typeof item ===
                "string"
              ) {
                return {
                  status_name:
                    item.trim(),
                };
              }

              return {
                ...item,
                status_name:
                  item?.status_name ??
                  item?.name ??
                  item?.status ??
                  item?.label ??
                  "",
              };
            })
            .map((item) => ({
              ...item,
              status_name:
                String(
                  item?.status_name ||
                    ""
                ).trim(),
            }))
            .filter(
              (item) =>
                item.status_name
                  .length > 0
            );

        const uniqueStatuses =
          Array.from(
            new Map(
              normalized.map(
                (item) => [
                  item.status_name.toLowerCase(),
                  item,
                ]
              )
            ).values()
          );

        setStatus(
          uniqueStatuses
        );
      } catch (err) {
        console.error(
          "Fetch status error:",
          err
        );

        toast.error(
          err?.message ||
            "Failed to load statuses."
        );

        setStatus([]);
      }
    }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    fetchData(false);
    fetchStatus();
  }, [
    fetchData,
    fetchStatus,
  ]);

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh =
    async () => {
      await Promise.all([
        fetchData(true),
        fetchStatus(),
      ]);
    };

  /* =======================================================
     STATUS OPTIONS
  ======================================================= */

  const statusOptions =
    useMemo(() => {
      const result = [];
      const seen = new Set();

      const addStatus = (
        value
      ) => {
        const name =
          stringValue(value);

        if (!name) {
          return;
        }

        const key =
          name.toLowerCase();

        if (seen.has(key)) {
          return;
        }

        seen.add(key);

        result.push({
          status_name: name,
        });
      };

      /* DB STATUS */
      status.forEach((item) => {
        addStatus(
          item?.status_name
        );
      });

      /* TASK STATUS */
      tasks.forEach((task) => {
        getAllTaskStatuses(
          task
        ).forEach(addStatus);
      });

      return result;
    }, [status, tasks]);

  /* =======================================================
     STATS
  ======================================================= */

  const totalTasks =
    Math.max(
      0,
      Number.isFinite(
        remainingTasks
      )
        ? remainingTasks
        : tasks.length
    );

  const completedTasks =
    Math.max(
      0,
      completedToday
    );

  const pendingTasks =
    Math.max(
      0,
      totalTasks
    );

  /* =======================================================
     SEARCH + DATE + FILTER
  ======================================================= */

  const filteredTasks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return tasks.filter(
        (task) => {
          /* ---------------------------------------------
             STATUS FILTER
          --------------------------------------------- */

          const completed =
            isTaskCompleted(
              task
            );

          let matchesFilter =
            true;

          if (
            filter ===
            "pending"
          ) {
            matchesFilter =
              !completed;
          }

          if (
            filter ===
            "completed"
          ) {
            matchesFilter =
              completed;
          }

          if (!matchesFilter) {
            return false;
          }

          /* ---------------------------------------------
             DATE FILTER
          --------------------------------------------- */

          const taskDate =
            normalizeDateOnly(
              getTaskDateValue(
                task
              )
            );

          if (
            fromDate &&
            (!taskDate ||
              taskDate <
                fromDate)
          ) {
            return false;
          }

          if (
            toDate &&
            (!taskDate ||
              taskDate >
                toDate)
          ) {
            return false;
          }

          /* ---------------------------------------------
             SEARCH
          --------------------------------------------- */

          if (!query) {
            return true;
          }

          const searchable =
            getTaskSearchText(
              task
            );

          return searchable.includes(
            query
          );
        }
      );
    }, [
      tasks,
      search,
      filter,
      fromDate,
      toDate,
    ]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredTasks.length /
          PAGE_SIZE
      )
    );

  const safePage =
    Math.min(
      page,
      totalPages
    );

  const paginatedTasks =
    useMemo(() => {
      const start =
        (safePage - 1) *
        PAGE_SIZE;

      return filteredTasks.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredTasks,
      safePage,
    ]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const handleSearch =
    (value) => {
      setSearch(value);
      setPage(1);
    };

  /* =======================================================
     FILTER
  ======================================================= */

  const handleFilter =
    (value) => {
      setFilter(value);
      setPage(1);
    };

  /* =======================================================
     FROM DATE
  ======================================================= */

  const handleFromDate =
    (value) => {
      setFromDate(value);
      setPage(1);
    };

  /* =======================================================
     TO DATE
  ======================================================= */

  const handleToDate =
    (value) => {
      setToDate(value);
      setPage(1);
    };

  /* =======================================================
     CLEAR DATE
  ======================================================= */

  const clearDateFilters =
    () => {
      setFromDate("");
      setToDate("");
      setPage(1);
    };

  /* =======================================================
     COMMENT CHANGE
  ======================================================= */

  const handleCommentChange =
    (
      id,
      newComment
    ) => {
      setTasks((prev) =>
        prev.map((row) => {
          const rowId =
            row?.assignment_id ??
            row?.id;

          if (
            String(rowId) !==
            String(id)
          ) {
            return row;
          }

          return {
            ...row,
            comment:
              newComment,
            comments:
              newComment,
          };
        })
      );
    };

  /* =======================================================
     STATUS CHANGE

     IMPORTANT:
     User-selected status immediately becomes part of
     searchable row data.
  ======================================================= */

  const handleStatusChange =
    (
      id,
      newStatus
    ) => {
      setTasks((prev) =>
        prev.map((row) => {
          const rowId =
            row?.assignment_id ??
            row?.id;

          if (
            String(rowId) !==
            String(id)
          ) {
            return row;
          }

          return {
            ...row,

            status:
              newStatus,

            assignment_status:
              newStatus,

            current_status:
              newStatus,

            selected_status:
              newStatus,

            selectedStatus:
              newStatus,
          };
        })
      );
    };

  /* =======================================================
     SAVE TASK
  ======================================================= */

  const handleCallClick =
    async (
      id,
      selectedStatus,
      comment
    ) => {
      if (isSubmitting) {
        return;
      }

      const statusValue =
        String(
          selectedStatus || ""
        ).trim();

      const commentValue =
        String(
          comment || ""
        ).trim();

      if (
        id === null ||
        id === undefined ||
        String(id).trim() === ""
      ) {
        toast.error(
          "Task ID is missing."
        );
        return;
      }

      if (!statusValue) {
        toast.error(
          "Please select a status."
        );
        return;
      }

      if (!commentValue) {
        toast.error(
          "Please add a comment."
        );
        return;
      }

      try {
        setIsSubmitting(true);

        const response =
          await fetch(
            `/api/employee/tasks/${id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache: "no-store",
              body: JSON.stringify({
                status:
                  statusValue,
                comment:
                  commentValue,
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
              result?.message ||
              "Failed to update task."
          );
        }

        /* ---------------------------------------------
           REMOVE FROM DAILY DESK
        --------------------------------------------- */

        setTasks(
          (prevTasks) =>
            prevTasks.filter(
              (task) => {
                const taskId =
                  task?.assignment_id ??
                  task?.id;

                return (
                  String(taskId) !==
                  String(id)
                );
              }
            )
        );

        /* ---------------------------------------------
           COUNTERS
        --------------------------------------------- */

        setCompletedToday(
          (prev) => prev + 1
        );

        setRemainingTasks(
          (prev) =>
            Math.max(
              0,
              prev - 1
            )
        );

        /* ---------------------------------------------
           BACKEND COUNTERS
        --------------------------------------------- */

        if (
          result?.completed_today !==
            undefined &&
          Number.isFinite(
            Number(
              result.completed_today
            )
          )
        ) {
          setCompletedToday(
            Number(
              result.completed_today
            )
          );
        }

        if (
          result?.remaining !==
            undefined &&
          Number.isFinite(
            Number(
              result.remaining
            )
          )
        ) {
          setRemainingTasks(
            Math.max(
              0,
              Number(
                result.remaining
              )
            )
          );
        }

        if (
          result?.total !==
            undefined &&
          Number.isFinite(
            Number(result.total)
          )
        ) {
          setDailyTotal(
            Math.min(
              DAILY_TASK_LIMIT,
              Math.max(
                0,
                Number(
                  result.total
                )
              )
            )
          );
        }

        toast.success(
          `${statusValue} — Task saved successfully!`
        );

        /* ---------------------------------------------
           PAGE CORRECTION
        --------------------------------------------- */

        setPage(
          (currentPage) => {
            const newLength =
              Math.max(
                0,
                filteredTasks.length -
                  1
              );

            const newTotalPages =
              Math.max(
                1,
                Math.ceil(
                  newLength /
                    PAGE_SIZE
                )
              );

            return Math.min(
              currentPage,
              newTotalPages
            );
          }
        );

        return result;
      } catch (error) {
        console.error(
          "Save task error:",
          error
        );

        toast.error(
          error?.message ||
            "Failed to update task."
        );

        return null;
      } finally {
        setIsSubmitting(false);
      }
    };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout =
    async () => {
      try {
        await fetch(
          "/api/logout",
          {
            method: "POST",
            credentials:
              "include",
            cache: "no-store",
          }
        );
      } catch (err) {
        console.error(
          "Logout error:",
          err
        );
      }

      try {
        localStorage.removeItem(
          "crm_login_time"
        );

        localStorage.removeItem(
          "crm_status_timer"
        );
      } catch {}

      router.replace(
        "/login"
      );
    };

  /* =======================================================
     ROW NUMBER
  ======================================================= */

  const getRowNumber =
    (index) =>
      (safePage - 1) *
        PAGE_SIZE +
      index +
      1;

  /* =======================================================
     SKELETON
  ======================================================= */

  const renderStatsSkeleton =
    () => (
      <div className="px-4 md:px-6 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                    <div className="h-7 w-12 bg-gray-200 rounded mt-2" />
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-gray-200" />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );

  const renderTableSkeleton =
    () => (
      <tbody>
        {Array.from({
          length: 8,
        }).map((_, row) => (
          <tr
            key={row}
            className="border-b border-gray-200 animate-pulse"
          >
            {Array.from({
              length: 9,
            }).map(
              (_, col) => (
                <td
                  key={col}
                  className="py-2 px-2"
                >
                  <div className="h-5 bg-gray-200 rounded w-full" />
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    );

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />

      <main className="md:ml-64 min-h-screen">
        {/* =================================================
            TOP
        ================================================= */}

        <div className="px-4 md:px-6 pt-5">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#741C29] text-white flex items-center justify-center shadow-sm">
                    <CalendarDays className="w-5 h-5" />
                  </div>

                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                      Daily Desk
                    </h1>

                    <p className="text-xs md:text-sm text-gray-500">
                      {staff?.name
                        ? `Welcome, ${staff.name}`
                        : "Your daily call assignments"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-xs text-gray-600">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {apiDate ||
                      getCaliforniaDate()}
                  </span>

                  <span className="px-2.5 py-1 rounded-md bg-[#741C29]/10 text-[#741C29] border border-[#741C29]/20 text-xs font-medium">
                    California Time
                  </span>

                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
                    Max {DAILY_TASK_LIMIT} Tasks
                  </span>

                  <span className="px-2.5 py-1 rounded-md bg-green-50 text-green-700 border border-green-100 text-xs font-medium">
                    {completedTasks} Completed Today
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={
                  refreshing ||
                  isSubmitting
                }
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#741C29] text-white text-sm font-medium hover:bg-[#5f1722] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="px-4 md:px-6 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />

              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">
                  Daily Desk Error
                </p>

                <p className="text-xs text-red-700 mt-1">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        {loading ? (
          renderStatsSkeleton()
        ) : (
          <div className="px-4 md:px-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      Total Remaining
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {totalTasks}
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      Completed Today
                    </p>

                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {completedTasks}
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      Remaining
                    </p>

                    <p className="text-2xl font-bold text-orange-600 mt-1">
                      {pendingTasks}
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-700 flex items-center justify-center">
                    <Clock3 className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            SEARCH / FILTER
        ================================================= */}

        <div className="px-4 md:px-6 mt-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
            {/* SEARCH */}
            <div className="flex flex-col xl:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    handleSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search name, phone, business, Callback, Follow Up, No Answer, comment, task ID..."
                  className="w-full h-10 pl-9 pr-9 border border-gray-300 rounded-lg bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#741C29]/20 focus:border-[#741C29]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* DATE FILTERS */}

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) =>
                      handleFromDate(
                        e.target.value
                      )
                    }
                    className="h-10 w-full sm:w-[165px] pl-9 pr-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#741C29]/20 focus:border-[#741C29]"
                    title="From Date"
                  />
                </div>

                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) =>
                      handleToDate(
                        e.target.value
                      )
                    }
                    className="h-10 w-full sm:w-[165px] pl-9 pr-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#741C29]/20 focus:border-[#741C29]"
                    title="To Date"
                  />
                </div>

                {(fromDate ||
                  toDate) && (
                  <button
                    type="button"
                    onClick={
                      clearDateFilters
                    }
                    className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Clear Dates
                  </button>
                )}
              </div>

              {/* STATUS FILTER */}

              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <Filter className="w-4 h-4 text-gray-400 ml-2 mr-1" />

                {[
                  {
                    value: "all",
                    label: "All",
                  },
                  {
                    value: "pending",
                    label: "Pending",
                  },
                ].map(
                  (item) => (
                    <button
                      key={
                        item.value
                      }
                      type="button"
                      onClick={() =>
                        handleFilter(
                          item.value
                        )
                      }
                      className={`px-3 py-2 rounded-md text-xs font-medium transition ${
                        filter ===
                        item.value
                          ? "bg-white text-[#741C29] shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* FILTER INFO */}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-[11px] text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-600">
                  {
                    filteredTasks.length
                  }
                </span>{" "}
                matching tasks
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[11px] text-gray-400">
                  {
                    statusOptions.length
                  }{" "}
                  statuses available
                </p>

                {(fromDate ||
                  toDate) && (
                  <p className="text-[11px] text-blue-600 font-medium">
                    Date:{" "}
                    {fromDate ||
                      "Any"}{" "}
                    →{" "}
                    {toDate ||
                      "Any"}
                  </p>
                )}

                {search && (
                  <p className="text-[11px] text-[#741C29] font-medium">
                    Searching all task fields + all status fields
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="p-4 md:px-6">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] rounded-lg border border-gray-300 shadow-sm bg-white">
            <table className="border-collapse min-w-[1100px] w-full bg-white text-xs md:text-sm">
              <thead>
                {/* COLUMN LETTERS */}

                <tr className="bg-gray-100 text-gray-600 font-semibold text-center divide-x divide-gray-300 border-b border-gray-300">
                  <th className="w-10 min-w-[40px] py-1">
                    #
                  </th>

                  <th className="w-32 min-w-[130px] py-1">
                    A
                  </th>

                  <th className="w-36 min-w-[140px] py-1">
                    B
                  </th>

                  <th className="w-40 min-w-[160px] py-1">
                    C
                  </th>

                  <th className="w-72 min-w-[280px] py-1">
                    D
                  </th>

                  <th className="w-52 min-w-[210px] py-1">
                    E
                  </th>

                  <th className="w-64 min-w-[250px] py-1">
                    F
                  </th>

                  <th className="w-40 min-w-[160px] py-1">
                    G
                  </th>

                  <th className="w-32 min-w-[130px] py-1">
                    H
                  </th>
                </tr>

                {/* MAIN HEADER */}

                <tr className="bg-[#1b365d] text-white font-bold text-center divide-x divide-gray-400 border-b border-gray-400">
                  <td className="bg-gray-200 text-gray-600 font-normal border-r border-gray-300 text-center">
                    1
                  </td>

                  <td className="py-2">
                    Date
                  </td>

                  <td className="py-2">
                    Name
                  </td>

                  <td className="py-2">
                    Phone Number
                  </td>

                  <td className="py-2">
                    Business Name
                  </td>

                  <td className="py-2">
                    Status
                  </td>

                  <td className="py-2">
                    Comments
                  </td>

                  <td className="py-2">
                    Task ID
                  </td>

                  <td className="py-2">
                    Action
                  </td>
                </tr>
              </thead>

              {/* BODY */}

              {loading ? (
                renderTableSkeleton()
              ) : (
                <tbody>
                  {paginatedTasks.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-16 text-center"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <Search className="w-5 h-5 text-gray-400" />
                          </div>

                          <p className="mt-3 font-medium text-gray-700">
                            No tasks found
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            Try another
                            date,
                            status,
                            name,
                            phone or
                            task ID.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map(
                      (
                        row,
                        index
                      ) => {
                        const taskStatus =
                          getTaskStatus(
                            row
                          );

                        const phone =
                          cleanPhone(
                            row?.phone_number ??
                              row?.phone ??
                              row?.number ??
                              row?.phoneNumber ??
                              ""
                          );

                        const taskId =
                          row?.assignment_id ??
                          row?.task_id ??
                          row?.id ??
                          "";

                        const assignmentId =
                          row?.assignment_id ??
                          row?.id;

                        const commentValue =
                          row?.comment ??
                          row?.comments ??
                          "";

                        const dateValue =
                          getTaskDateValue(
                            row
                          );

                        const businessName =
                          row?.business_name ??
                          row?.business ??
                          row?.company_name ??
                          row?.company ??
                          row?.organization ??
                          "";

                        const name =
                          row?.name ??
                          row?.contact_name ??
                          row?.customer_name ??
                          row?.full_name ??
                          row?.lead_name ??
                          row?.client_name ??
                          "";

                        return (
                          <tr
                            key={
                              assignmentId ??
                              index
                            }
                            className="divide-x divide-gray-300 border-b border-gray-300 text-center transition hover:bg-blue-50"
                          >
                            {/* ROW */}

                            <td className="text-gray-600 text-center font-normal py-1 bg-gray-100">
                              {getRowNumber(
                                index
                              )}
                            </td>

                            {/* DATE */}

                            <td className="py-1 px-2 whitespace-nowrap">
                              {formatCaliforniaDate(
                                dateValue
                              )}
                            </td>

                            {/* NAME */}

                            <td className="py-1 px-2 font-medium text-gray-800">
                              {name ||
                                "—"}
                            </td>

                            {/* PHONE */}

                            <td className="py-1 px-2">
                              <span className="font-mono text-gray-800">
                                {phone ||
                                  "—"}
                              </span>
                            </td>

                            {/* BUSINESS */}

                            <td className="py-1 px-2 text-left text-gray-800">
                              <div
                                className="truncate max-w-[280px]"
                                title={
                                  businessName
                                }
                              >
                                {businessName ||
                                  "—"}
                              </div>
                            </td>

                            {/* STATUS */}

                            <td className="py-1 px-1">
                              <select
                                value={
                                  taskStatus
                                }
                                onChange={(
                                  e
                                ) =>
                                  handleStatusChange(
                                    assignmentId,
                                    e.target
                                      .value
                                  )
                                }
                                disabled={
                                  isSubmitting
                                }
                                className="w-full min-w-[170px] bg-white border border-gray-300 text-gray-800 rounded px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#741C29] disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                <option value="">
                                  Select Status
                                </option>

                                {statusOptions.map(
                                  (
                                    statusOption,
                                    statusIndex
                                  ) => {
                                    const statusName =
                                      String(
                                        statusOption?.status_name ||
                                          ""
                                      ).trim();

                                    if (
                                      !statusName
                                    ) {
                                      return null;
                                    }

                                    return (
                                      <option
                                        key={`${statusName}-${statusIndex}`}
                                        value={
                                          statusName
                                        }
                                      >
                                        {
                                          statusName
                                        }
                                      </option>
                                    );
                                  }
                                )}
                              </select>
                            </td>

                            {/* COMMENTS */}

                            <td className="py-1 px-2 text-left">
                              <input
                                type="text"
                                value={
                                  commentValue
                                }
                                onChange={(
                                  e
                                ) =>
                                  handleCommentChange(
                                    assignmentId,
                                    e.target
                                      .value
                                  )
                                }
                                placeholder="Add comment..."
                                disabled={
                                  isSubmitting
                                }
                                className="w-full max-w-[230px] border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                title={
                                  commentValue
                                }
                              />
                            </td>

                            {/* TASK ID */}

                            <td className="py-1 px-2 font-mono text-gray-500">
                              {taskId ||
                                "—"}
                            </td>

                            {/* ACTION */}

                            <td className="py-1 px-1">
                              <button
                                type="button"
                                disabled={
                                  isSubmitting
                                }
                                onClick={() =>
                                  handleCallClick(
                                    assignmentId,
                                    getTaskStatus(
                                      row
                                    ),
                                    commentValue
                                  )
                                }
                                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#741C29] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#5f1722] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Save
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>

        {/* =================================================
            PAGINATION
        ================================================= */}

        <div className="px-4 md:px-6 pb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-800">
                {filteredTasks.length ===
                0
                  ? 0
                  : (safePage - 1) *
                      PAGE_SIZE +
                    1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-gray-800">
                {Math.min(
                  safePage *
                    PAGE_SIZE,
                  filteredTasks.length
                )}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-800">
                {
                  filteredTasks.length
                }
              </span>{" "}
              tasks
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  safePage <= 1
                }
                onClick={() =>
                  changePage(
                    safePage - 1
                  )
                }
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="px-3 py-2 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700">
                {safePage} /{" "}
                {totalPages}
              </div>

              <button
                type="button"
                disabled={
                  safePage >=
                  totalPages
                }
                onClick={() =>
                  changePage(
                    safePage + 1
                  )
                }
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            INFO
        ================================================= */}

        <div className="px-4 md:px-6 pb-6">
          <div className="text-[10px] text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Timezone:{" "}
              {
                CALIFORNIA_TIMEZONE
              }
            </span>

            <span>
              Daily Limit:{" "}
              {DAILY_TASK_LIMIT}
            </span>

            <span>
              Total Daily:{" "}
              {dailyTotal}
            </span>

            <span>
              Completed Today:{" "}
              {completedTasks}
            </span>

            <span>
              Remaining:{" "}
              {totalTasks}
            </span>

            <span>
              DB Statuses:{" "}
              {statusOptions.length}
            </span>

            <span>
              Search Results:{" "}
              {
                filteredTasks.length
              }
            </span>

            <span>
              API Date:{" "}
              {apiDate || "—"}
            </span>
          </div>
        </div>
      </main>

      {/* ===================================================
          LOGOUT
      =================================================== */}

      {showLogout && (
        <LogoutModal
          onCancel={() =>
            setShowLogout(false)
          }
          onConfirm={
            handleLogout
          }
        />
      )}

      {/* ===================================================
          SUBMIT LOADER
      =================================================== */}

      {isSubmitting && (
        <Loader />
      )}
    </div>
  );
}