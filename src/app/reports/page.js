"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  RefreshCw,
  Download,
  CalendarDays,
  Users,
  Layers3,
  CheckCircle2,
  Phone,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Activity,
  MessageSquare,
  Filter,
  FileText,
  TrendingUp,
  CircleDot,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";

import Sidebar from "@/components/Sidebar";
import LogoutModal from "@/components/LogoutModal";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Loader from "@/components/Loader";

const ACCENT = "#ec3737";
const PAGE_SIZE = 50;

const API_URLS = {
  history: "/api/admin/history",
  staff: "/api/staffes/list",
};

/* ============================================================
   HELPERS
============================================================ */

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
function normalizeDate(value) {
  if (!value) return "";

  try {
    const str = String(value).trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // MYSQL datetime
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }

    const date = new Date(str);

    if (isNaN(date.getTime())) {
      return "";
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "—";

  const normalized = normalizeDate(value);

  if (!normalized) return String(value);

  const [year, month, day] = normalized.split("-");

  return `${month}/${day}/${year}`;
}

function formatPhone(value) {
  const phone = safeString(value);
  return phone || "—";
}

/*
 * IMPORTANT:
 * assignment_status = actual status selected by employee.
 */
function getStatus(record) {
  return (
    safeString(record?.selected_status) ||
    safeString(record?.selectedStatus) ||
    safeString(record?.assignment_status) ||
    safeString(record?.status) ||
    safeString(record?.task_status) ||
    safeString(record?.call_status) ||
    safeString(record?.disposition) ||
    safeString(record?.result) ||
    "Pending"
  );
}

function getDate(record) {
  return (
    safeString(record?.assignment_date) ||
    safeString(record?.assignmentDate) ||
    safeString(record?.assigned_date) ||
    safeString(record?.assignedDate) ||
    safeString(record?.task_date) ||
    safeString(record?.taskDate) ||
    safeString(record?.date) ||
    safeString(record?.created_at) ||
    safeString(record?.createdAt) ||
    safeString(record?.updated_at) ||
    safeString(record?.updatedAt) ||
    ""
  );
}

function getPhone(record) {
  return (
    record?.phoneNumber ||
    record?.phone_number ||
    record?.phone ||
    ""
  );
}

function getBusiness(record) {
  return (
    safeString(record?.businessName) ||
    safeString(record?.business_name) ||
    "—"
  );
}

function getName(record) {
  return (
    safeString(record?.name) ||
    safeString(record?.contactName) ||
    safeString(record?.contact_name) ||
    "Unknown"
  );
}

function getComment(record) {
  return (
    safeString(record?.comment) ||
    safeString(record?.comments) ||
    safeString(record?.notes) ||
    safeString(record?.remark) ||
    safeString(record?.remarks) ||
    ""
  );
}

function getSheet(record) {
  return (
    safeString(record?.sourceSheet) ||
    safeString(record?.source_sheet) ||
    safeString(record?.sheetName) ||
    safeString(record?.sheet_name) ||
    "—"
  );
}

function getUserName(record) {
  return (
    safeString(record?.employee_name) ||
    safeString(record?.employeeName) ||
    safeString(record?.user_name) ||
    safeString(record?.userName) ||
    safeString(record?.staff_name) ||
    safeString(record?.staffName) ||
    safeString(record?.assigned_to) ||
    "—"
  );
}

function getTaskId(record) {
  return (
    record?.taskId ||
    record?.task_id ||
    record?.assignment_id ||
    record?.id ||
    "—"
  );
}

function getInitials(value) {
  return (
    safeString(value)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}

function statusClasses(status) {
  const value = safeString(status).toLowerCase();

  if (value.includes("callback")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (value.includes("follow")) {
    return "bg-sky-50 text-sky-700 border-sky-200";
  }

  if (
    value.includes("no answer") ||
    value.includes("busy")
  ) {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  if (
    value.includes("voicemail") ||
    value.includes("straight")
  ) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  if (
    value.includes("complete") ||
    value.includes("success") ||
    value.includes("interested")
  ) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (
    value.includes("not interested") ||
    value.includes("wrong")
  ) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  if (
    value.includes("pending") ||
    value.includes("progress")
  ) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function downloadCSV(records) {
  if (!records?.length) {
    toast.error("No records available to export.");
    return;
  }

  const headers = [
    "#",
    "Date",
    "User",
    "Business",
    "Contact",
    "Phone",
    "Status",
    "Comments",
    "Sheet",
    "Task ID",
  ];

  const rows = records.map((record, index) => [
    index + 1,
    getDate(record),
    getUserName(record),
    getBusiness(record),
    getName(record),
    getPhone(record),
    getStatus(record),
    getComment(record),
    getSheet(record),
    getTaskId(record),
  ]);

  const escapeCSV = (value) => {
    const text = safeString(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  const csv = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) =>
      row.map(escapeCSV).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-report-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  toast.success("Report exported successfully.");
}

/* ============================================================
   PAGE
============================================================ */

export default function AdminReportsPage() {
  const router = useRouter();

  const [records, setRecords] = useState([]);
  const [staff, setStaff] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [sheetFilter, setSheetFilter] = useState("all");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [showFilters, setShowFilters] = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  /* ============================================================
     LOAD STAFF
  ============================================================ */

  const loadStaff = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URLS.staff}?_=${Date.now()}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.users)
        ? data.users
        : Array.isArray(data?.staff)
        ? data.staff
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setStaff(list);
    } catch (err) {
      console.error("Staff load error:", err);
    }
  }, []);

  /* ============================================================
     LOAD REPORT
  ============================================================ */


const fetchReport = useCallback(
  async (showRefresh = false, isLive = false) => {
    try {
      if (showRefresh && !isLive) {
        setRefreshing(true);
      } else if (!isLive) {
        setLoading(true);
      }

      setError("");

      // =====================================================
      // BUILD API URL
      // =====================================================

      const params = new URLSearchParams();

      // Single date
      if (fromDate && toDate && fromDate === toDate) {
        params.set("date", fromDate);
      }

      // Date range
      else {
        if (fromDate) {
          params.set("from", fromDate);
        }

        if (toDate) {
          params.set("to", toDate);
        }
      }

      params.set("_", Date.now().toString());

      const response = await fetch(
        `${API_URLS.history}?${params.toString()}`,
        {
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const responseText = await response.text();

      let data = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        throw new Error(
          "Server returned invalid JSON response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to load admin report."
        );
      }

      // =====================================================
      // SUPPORT ALL POSSIBLE API RESPONSE SHAPES
      // =====================================================

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.history)
        ? data.history
        : Array.isArray(data?.tasks)
        ? data.tasks
        : Array.isArray(data?.results)
        ? data.results
        : [];

      console.log(
        "ADMIN HISTORY API:",
        {
          requestedFrom: fromDate,
          requestedTo: toDate,
          count: list.length,
          firstRecord: list[0],
          response: data,
        }
      );

      setRecords(list);
    } catch (err) {
      console.error(
        isLive
          ? "Live report update error:"
          : "Report error:",
        err
      );

      if (!isLive) {
        setError(
          err?.message ||
            "Unable to load report."
        );

        setRecords([]);

        toast.error(
          err?.message ||
            "Unable to load report."
        );
      }
    } finally {
      if (!isLive) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  },
  [fromDate, toDate]
);



useEffect(() => {
  loadStaff();
  fetchReport(false, false);

  const intervalId = setInterval(() => {
    if (document.visibilityState === "visible") {
      fetchReport(false, true);
    }
  }, 5000);

  return () => {
    clearInterval(intervalId);
  };
}, [loadStaff, fetchReport]);



  /* ============================================================
     STATUS OPTIONS
  ============================================================ */

  const statusOptions = useMemo(() => {
    const values = new Map();

    records.forEach((record) => {
      const status = getStatus(record);

      if (status) {
        values.set(
          status.toLowerCase(),
          status
        );
      }
    });

    return Array.from(values.values()).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [records]);

  /* ============================================================
     USER OPTIONS
  ============================================================ */

  const userOptions = useMemo(() => {
    const values = new Map();

    staff.forEach((user) => {
      const id =
        user?.id ||
        user?.user_id ||
        user?._id;

      const name =
        safeString(user?.name) ||
        safeString(user?.full_name) ||
        safeString(user?.email);

      if (id && name) {
        values.set(String(id), {
          id: String(id),
          name,
        });
      }
    });

    records.forEach((record) => {
      const id =
        record?.employee_id ||
        record?.employeeId ||
        record?.user_id ||
        record?.userId;

      const name = getUserName(record);

      if (id && name !== "—") {
        values.set(String(id), {
          id: String(id),
          name,
        });
      }
    });

    return Array.from(values.values()).sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );
  }, [staff, records]);

  /* ============================================================
     SHEET OPTIONS
  ============================================================ */

  const sheetOptions = useMemo(() => {
    const values = new Map();

    records.forEach((record) => {
      const sheet = getSheet(record);

      if (sheet && sheet !== "—") {
        values.set(
          sheet.toLowerCase(),
          sheet
        );
      }
    });

    return Array.from(values.values()).sort(
      (a, b) =>
        a.localeCompare(b)
    );
  }, [records]);

  /* ============================================================
     FILTERED
  ============================================================ */

  const filteredRecords = useMemo(() => {
    const search = searchQuery
      .trim()
      .toLowerCase();

    return records.filter((record) => {
     const recordDate = normalizeDate(
  getDate(record)
);


// FROM DATE
if (fromDate) {
  if (!recordDate) return false;

  if (recordDate < fromDate) {
    return false;
  }
}


// TO DATE
if (toDate) {
  if (!recordDate) return false;

  if (recordDate > toDate) {
    return false;
  }
}

      if (
        statusFilter !== "all" &&
        getStatus(record).toLowerCase() !==
          statusFilter.toLowerCase()
      ) {
        return false;
      }

      if (userFilter !== "all") {
        const recordUserId = String(
          record?.employee_id ||
            record?.employeeId ||
            record?.user_id ||
            record?.userId ||
            ""
        );

        if (
          recordUserId !==
          String(userFilter)
        ) {
          return false;
        }
      }

      if (
        sheetFilter !== "all" &&
        getSheet(record).toLowerCase() !==
          sheetFilter.toLowerCase()
      ) {
        return false;
      }

      if (search) {
        const searchable = [
          getName(record),
          getBusiness(record),
          getPhone(record),
          getStatus(record),
          getComment(record),
          getSheet(record),
          getUserName(record),
          getTaskId(record),
          getDate(record),
          safeString(record?.email),
          safeString(record?.sourceFile),
          safeString(record?.source_file),
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [
    records,
    searchQuery,
    statusFilter,
    userFilter,
    sheetFilter,
    fromDate,
    toDate,
  ]);

  /* ============================================================
     STATS
  ============================================================ */
const reportStats = useMemo(() => {
  let completed = 0;
  let callback = 0;
  let followUp = 0;
  let noAnswer = 0;
  let voicemail = 0;
  let pending = 0;

  filteredRecords.forEach((record) => {
    // =====================================================
    // EXACT EMPLOYEE SELECTED STATUS
    // || use kiya hai taake empty string par next field mile
    // =====================================================
    const status = String(
      record?.selected_status ||
        record?.selectedStatus ||
        record?.assignment_status ||
        record?.status ||
        record?.result ||
        record?.task_status ||
        record?.call_status ||
        record?.disposition ||
        ""
    )
      .trim()
      .toLowerCase();

    // =====================================================
    // NORMALIZED STATUS
    // Removes spaces, "-", "_"
    //
    // Example:
    // Callback  -> callback
    // Call Back -> callback
    // Call-Back -> callback
    // Call_Back -> callback
    // =====================================================
    const normalizedStatus = status.replace(/[\s_-]+/g, "");

    // =====================================================
    // COMPLETED
    // =====================================================
    if (
      Number(record?.is_completed) === 1 ||
      status.includes("complete") ||
      normalizedStatus === "completed"
    ) {
      completed++;
    }

    // =====================================================
    // CALLBACK
    // Supports:
    // Callback
    // CALLBACK
    // callback
    // Call Back
    // Call-Back
    // Call_Back
    // =====================================================
    if (normalizedStatus.includes("callback")) {
      callback++;
    }

    // =====================================================
    // FOLLOW UP
    // Supports:
    // Follow Up
    // Follow UP
    // Follow-Up
    // Followup
    // Follow_Up
    // =====================================================
    if (normalizedStatus.includes("followup")) {
      followUp++;
    }

    // =====================================================
    // NO ANSWER
    // Supports:
    // No Answer
    // No-Answer
    // No_Answer
    // =====================================================
    if (normalizedStatus.includes("noanswer")) {
      noAnswer++;
    }

    // =====================================================
    // VOICEMAIL
    // Supports:
    // Voicemail
    // Voice Mail
    // Voice-Mail
    // Straight to Voicemail
    // =====================================================
    if (
      normalizedStatus.includes("voicemail") ||
      normalizedStatus.includes("straight")
    ) {
      voicemail++;
    }

    // =====================================================
    // PENDING / IN PROGRESS
    // =====================================================
    if (
      status.includes("pending") ||
      normalizedStatus.includes("inprogress") ||
      normalizedStatus === "progress"
    ) {
      pending++;
    }
  });

  // =====================================================
  // UNIQUE USERS
  // =====================================================
  const uniqueUsers = new Set(
    filteredRecords
      .map((record) => getUserName(record))
      .filter(
        (name) =>
          name &&
          name !== "—"
      )
  ).size;

  // =====================================================
  // UNIQUE SHEETS
  // =====================================================
  const uniqueSheets = new Set(
    filteredRecords
      .map((record) => getSheet(record))
      .filter(
        (sheet) =>
          sheet &&
          sheet !== "—"
      )
  ).size;

  // =====================================================
  // RETURN REPORT STATS
  // =====================================================
  return {
    total: filteredRecords.length,
    completed,
    callback,
    followUp,
    noAnswer,
    voicemail,
    pending,
    uniqueUsers,
    uniqueSheets,
  };
}, [filteredRecords]);
  /* ============================================================
     STATUS BREAKDOWN
  ============================================================ */

  const statusBreakdown = useMemo(() => {
    const map = new Map();

    filteredRecords.forEach((record) => {
      const status = getStatus(record);
      const key = status.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          name: status,
          count: 0,
        });
      }

      map.get(key).count++;
    });

    return Array.from(map.values())
      .sort(
        (a, b) => b.count - a.count
      )
      .slice(0, 8);
  }, [filteredRecords]);

  /* ============================================================
     PAGINATION
  ============================================================ */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRecords.length /
        PAGE_SIZE
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedRecords =
    filteredRecords.slice(
      (safeCurrentPage - 1) *
        PAGE_SIZE,
      safeCurrentPage *
        PAGE_SIZE
    );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    statusFilter,
    userFilter,
    sheetFilter,
    fromDate,
    toDate,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setUserFilter("all");
    setSheetFilter("all");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const changePage = (page) => {
    setCurrentPage(
      Math.max(
        1,
        Math.min(page, totalPages)
      )
    );
  };

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Sidebar />

        <main className="lg:ml-[260px] min-h-screen flex items-center justify-center">
          <Loader />
        </main>
      </div>
    );
  }

  /* ============================================================
     UI
  ============================================================ */

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-800">
      <Sidebar />

      <main className="lg:ml-[260px] min-h-screen">
        <div className="max-w-[1900px] mx-auto px-4 sm:px-6 xl:px-8 py-5 sm:py-7">

          {/* ==================================================
              PREMIUM HEADER
          ================================================== */}

          <div className="relative overflow-hidden rounded-[24px] bg-slate-950 text-white mb-5 shadow-[0_10px_40px_rgba(15,23,42,0.12)]">

            <div
              className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-20"
              style={{
                backgroundColor: ACCENT,
              }}
            />

            <div className="relative px-5 sm:px-7 py-6 sm:py-7">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">

                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor:
                          "rgba(236,55,55,0.14)",
                        color: ACCENT,
                      }}
                    >
                      <BarChart3 size={22} />
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                        Digital Orbit CRM
                      </p>

                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                        Reports
                      </h1>
                    </div>
                  </div>

                  <p className="text-sm text-slate-400 max-w-2xl">
                    Complete task activity, employee performance
                    and customer outcomes in one place.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      fetchReport(true)
                    }
                    disabled={refreshing}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 inline-flex items-center gap-2 text-xs font-bold transition disabled:opacity-50"
                  >
                    <RefreshCw
                      size={15}
                      className={
                        refreshing
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadCSV(
                        filteredRecords
                      )
                    }
                    className="h-10 px-4 rounded-xl inline-flex items-center gap-2 text-xs font-black text-white shadow-lg transition hover:opacity-90"
                    style={{
                      backgroundColor:
                        ACCENT,
                    }}
                  >
                    <Download size={15} />
                    Export
                  </button>

                </div>
              </div>
            </div>
          </div>

          {/* ==================================================
              KPI STRIP
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-[20px] shadow-[0_5px_25px_rgba(15,23,42,0.04)] mb-5 overflow-hidden">

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-slate-100">

              {[
                {
                  label: "Total Tasks",
                  value: reportStats.total,
                  icon: FileText,
                  accent: "text-slate-800",
                },
                {
                  label: "Completed",
                  value: reportStats.completed,
                  icon: CheckCircle2,
                  accent: "text-emerald-600",
                },
                {
                  label: "Callback",
                  value: reportStats.callback,
                  icon: Phone,
                  accent: "text-amber-600",
                },
                {
                  label: "Follow Up",
                  value: reportStats.followUp,
                  icon: Activity,
                  accent: "text-sky-600",
                },
                {
                  label: "No Answer",
                  value: reportStats.noAnswer,
                  icon: CircleDot,
                  accent: "text-orange-600",
                },
                {
                  label: "Voicemail",
                  value: reportStats.voicemail,
                  icon: MessageSquare,
                  accent: "text-violet-600",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="px-4 sm:px-5 py-4 hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-center justify-between gap-3">

                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                          {item.label}
                        </p>

                        <p
                          className={`text-2xl font-black mt-1 ${item.accent}`}
                        >
                          {item.value.toLocaleString()}
                        </p>
                      </div>

                      <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Icon
                          size={16}
                          className="text-slate-400"
                        />
                      </div>

                    </div>
                  </div>
                );
              })}

            </div>
          </section>

          {/* ==================================================
              FILTER TOOLBAR
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-[20px] shadow-[0_5px_25px_rgba(15,23,42,0.04)] mb-5">

            <div className="px-4 sm:px-5 py-4">

              <div className="flex flex-col xl:flex-row xl:items-center gap-3">

                {/* SEARCH */}

                <div className="relative flex-1 min-w-0">

                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                    placeholder="Search business, contact, phone, user, status or task ID..."
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-medium text-slate-700 outline-none transition focus:bg-white focus:border-red-300 focus:ring-4 focus:ring-red-50"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearchQuery("")
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
                    >
                      <X size={14} />
                    </button>
                  )}

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowFilters(
                      (v) => !v
                    )
                  }
                  className={`h-11 px-4 rounded-xl border inline-flex items-center justify-center gap-2 text-xs font-black transition ${
                    showFilters
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal
                    size={15}
                  />
                  Filters
                </button>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
                >
                  Clear
                </button>

              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">

                  {/* DATE FROM */}

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-black text-slate-400 block mb-1.5">
                      From Date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
 type="date"
 value={fromDate}
 max={toDate || undefined}
 onChange={(e)=>setFromDate(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                      />
                    </div>
                  </div>

                  {/* DATE TO */}

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-black text-slate-400 block mb-1.5">
                      To Date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                     <input
 type="date"
 value={toDate}
 min={fromDate || undefined}
 onChange={(e)=>setToDate(e.target.value)}

                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                      />
                    </div>
                  </div>

                  {/* USER */}

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-black text-slate-400 block mb-1.5">
                      Employee
                    </label>

                    <select
                      value={userFilter}
                      onChange={(e) =>
                        setUserFilter(
                          e.target.value
                        )
                      }
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                    >
                      <option value="all">
                        All Employees
                      </option>

                      {userOptions.map(
                        (user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* SHEET */}

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-black text-slate-400 block mb-1.5">
                      Sheet
                    </label>

                    <select
                      value={sheetFilter}
                      onChange={(e) =>
                        setSheetFilter(
                          e.target.value
                        )
                      }
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                    >
                      <option value="all">
                        All Sheets
                      </option>

                      {sheetOptions.map(
                        (sheet) => (
                          <option
                            key={sheet}
                            value={sheet}
                          >
                            {sheet}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* STATUS */}

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-black text-slate-400 block mb-1.5">
                      Status
                    </label>

                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value
                        )
                      }
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                    >
                      <option value="all">
                        All Statuses
                      </option>

                      {statusOptions.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                </div>
              )}

            </div>
          </section>

          {/* ==================================================
              STATUS QUICK FILTER
          ================================================== */}

          <section className="mb-5">

            <div className="flex items-center gap-2 mb-3 px-1">
              <Activity
                size={15}
                style={{
                  color: ACCENT,
                }}
              />

              <span className="text-xs font-black text-slate-700">
                Status Overview
              </span>

              <span className="text-[10px] font-bold text-slate-400">
                {statusBreakdown.length} active statuses
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">

              <button
                type="button"
                onClick={() =>
                  setStatusFilter("all")
                }
                className={`shrink-0 h-9 px-4 rounded-xl border text-xs font-black transition ${
                  statusFilter === "all"
                    ? "text-white border-transparent"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
                style={
                  statusFilter === "all"
                    ? {
                        backgroundColor:
                          ACCENT,
                      }
                    : undefined
                }
              >
                All
                <span className="ml-2 opacity-70">
                  {filteredRecords.length}
                </span>
              </button>

              {statusBreakdown.map(
                (item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        item.name
                      )
                    }
                    className={`shrink-0 h-9 px-4 rounded-xl border text-xs font-black transition ${statusClasses(
                      item.name
                    )}`}
                  >
                    {item.name}
                    <span className="ml-2 opacity-70">
                      {item.count}
                    </span>
                  </button>
                )
              )}

            </div>
          </section>

          {/* ==================================================
              REPORT TABLE
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-[22px] shadow-[0_8px_35px_rgba(15,23,42,0.05)] overflow-hidden">

            {/* TABLE TOP */}

            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                <div className="flex items-center gap-3">

                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor:
                        "#fff1f1",
                      color: ACCENT,
                    }}
                  >
                    <TrendingUp
                      size={18}
                    />
                  </div>

                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900">
                      Task Activity
                    </h2>

                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Employee activity and customer outcomes
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-2">

                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-black text-slate-500">
                    <Users size={13} />
                    {reportStats.uniqueUsers}
                    Users
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-black text-slate-500">
                    <Layers3 size={13} />
                    {reportStats.uniqueSheets}
                    Sheets
                  </span>

                  <span className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-black">
                    {filteredRecords.length.toLocaleString()} Records
                  </span>

                </div>

              </div>
            </div>

            {/* ERROR */}

            {error && (
              <div className="mx-4 sm:mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                {error}
              </div>
            )}

            {/* EMPTY */}

            {filteredRecords.length === 0 ? (
              <div className="py-20 px-6 text-center">

                <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Search
                    size={26}
                    className="text-slate-400"
                  />
                </div>

                <h3 className="mt-5 text-base font-black text-slate-800">
                  No matching records
                </h3>

                <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
                  No task activity matches the selected filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 h-10 px-4 rounded-xl text-xs font-black text-white"
                  style={{
                    backgroundColor:
                      ACCENT,
                  }}
                >
                  Clear Filters
                </button>

              </div>
            ) : (
              <>
                {/* TABLE */}

           <div className="max-h-[400px] overflow-auto">

                  <table className="w-full min-w-[1450px] text-left">

                    <thead className="sticky top-0 z-10">

                      <tr className="bg-slate-50/95 backdrop-blur border-b border-slate-200">

                        {[
                          "#",
                          "Date",
                          "Employee",
                          "Business",
                          "Contact",
                          "Phone",
                          "Status",
                          "Comments",
                          "Sheet",
                          "Task ID",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-5 py-3.5 text-[10px] uppercase tracking-[0.12em] font-black text-slate-500 whitespace-nowrap"
                          >
                            {heading}
                          </th>
                        ))}

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {paginatedRecords.map(
                        (record, index) => {

                          const globalIndex =
                            (safeCurrentPage - 1) *
                              PAGE_SIZE +
                            index +
                            1;

                          const user =
                            getUserName(
                              record
                            );

                          const contact =
                            getName(record);

                          const business =
                            getBusiness(
                              record
                            );

                          const phone =
                            getPhone(record);

                          const status =
                            getStatus(
                              record
                            );

                          const comment =
                            getComment(
                              record
                            );

                          const sheet =
                            getSheet(record);

                          const date =
                            getDate(record);

                          const taskId =
                            getTaskId(
                              record
                            );

                          return (
                            <tr
                              key={`${record?.assignment_id || record?.id || globalIndex}-${globalIndex}`}
                              className="group hover:bg-[#fffafa] transition-colors"
                            >

                              {/* NUMBER */}

                              <td className="px-5 py-4">
                                <span className="text-[11px] font-black text-slate-400">
                                  {String(
                                    globalIndex
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>
                              </td>

                              {/* DATE */}

                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2.5">

                                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <CalendarDays
                                      size={14}
                                      className="text-slate-500"
                                    />
                                  </div>

                                  <div>
                                    <p className="text-xs font-black text-slate-700 whitespace-nowrap">
                                      {formatDate(
                                        date
                                      )}
                                    </p>

                                    {normalizeDate(
                                      date
                                    ) && (
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Task date
                                      </p>
                                    )}
                                  </div>

                                </div>
                              </td>

                              {/* EMPLOYEE */}

                              <td className="px-5 py-4">

                                <div className="flex items-center gap-2.5">

                                  <div
                                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black"
                                    style={{
                                      backgroundColor:
                                        "#fff1f1",
                                      color:
                                        ACCENT,
                                    }}
                                  >
                                    {getInitials(
                                      user
                                    )}
                                  </div>

                                  <div className="max-w-[145px]">

                                    <p
                                      title={
                                        user
                                      }
                                      className="text-xs font-black text-slate-800 truncate"
                                    >
                                      {user}
                                    </p>

                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Assigned employee
                                    </p>

                                  </div>

                                </div>

                              </td>

                              {/* BUSINESS */}

                              <td className="px-5 py-4">

                                <div className="max-w-[210px]">

                                  <p
                                    title={
                                      business
                                    }
                                    className="text-xs font-black text-slate-800 truncate"
                                  >
                                    {business}
                                  </p>

                                  {safeString(
                                    record?.sourceFile
                                  ) && (
                                    <p
                                      title={safeString(
                                        record?.sourceFile
                                      )}
                                      className="text-[10px] text-slate-400 mt-1 truncate"
                                    >
                                      {safeString(
                                        record?.sourceFile
                                      )}
                                    </p>
                                  )}

                                </div>

                              </td>

                              {/* CONTACT */}

                              <td className="px-5 py-4">

                                <div className="flex items-center gap-2.5">

                                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                                    {getInitials(
                                      contact
                                    )}
                                  </div>

                                  <span
                                    title={
                                      contact
                                    }
                                    className="text-xs font-bold text-slate-700 max-w-[150px] truncate"
                                  >
                                    {contact}
                                  </span>

                                </div>

                              </td>

                              {/* PHONE */}

                              <td className="px-5 py-4">

                                <div className="flex items-center gap-2 whitespace-nowrap">

                                  <Phone
                                    size={14}
                                    className="text-slate-400"
                                  />

                                  <span className="text-xs font-black text-slate-700">
                                    {formatPhone(
                                      phone
                                    )}
                                  </span>

                                </div>

                              </td>

                              {/* STATUS */}

                              <td className="px-5 py-4">

                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusFilter(
                                      status
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black whitespace-nowrap hover:shadow-sm transition ${statusClasses(
                                    status
                                  )}`}
                                  title="Filter by this status"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />

                                  {status}
                                </button>

                              </td>

                              {/* COMMENTS */}

                              <td className="px-5 py-4">

                                <div className="flex items-start gap-2 max-w-[260px]">

                                  <MessageSquare
                                    size={14}
                                    className="text-slate-300 mt-0.5 shrink-0"
                                  />

                                  <p
                                    title={
                                      comment
                                    }
                                    className="text-xs text-slate-500 leading-5 truncate"
                                  >
                                    {comment ||
                                      "No comments"}
                                  </p>

                                </div>

                              </td>

                              {/* SHEET */}

                              <td className="px-5 py-4">

                                <button
                                  type="button"
                                  onClick={() =>
                                    sheet !==
                                      "—" &&
                                    setSheetFilter(
                                      sheet
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 max-w-[180px] px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-100 transition"
                                >
                                  <Layers3
                                    size={12}
                                    className="shrink-0"
                                  />

                                  <span className="truncate">
                                    {sheet}
                                  </span>
                                </button>

                              </td>

                              {/* TASK ID */}

                              <td className="px-5 py-4">

                                <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-slate-950 text-white text-[10px] font-black font-mono whitespace-nowrap">
                                  #{taskId}
                                </span>

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>

                {/* ==================================================
                    PAGINATION
                ================================================== */}

                <div className="px-4 sm:px-6 py-4 border-t border-slate-100">

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                    <div className="text-[11px] text-slate-400 font-medium">

                      Showing{" "}

                      <span className="font-black text-slate-700">
                        {filteredRecords.length ===
                        0
                          ? 0
                          : (safeCurrentPage -
                              1) *
                              PAGE_SIZE +
                            1}
                      </span>

                      {" "}—{" "}

                      <span className="font-black text-slate-700">
                        {Math.min(
                          safeCurrentPage *
                            PAGE_SIZE,
                          filteredRecords.length
                        )}
                      </span>

                      {" "}of{" "}

                      <span className="font-black text-slate-700">
                        {
                          filteredRecords.length
                        }
                      </span>

                      {" "}records

                    </div>

                    <div className="flex items-center gap-1.5">

                      <button
                        type="button"
                        onClick={() =>
                          changePage(
                            safeCurrentPage -
                              1
                          )
                        }
                        disabled={
                          safeCurrentPage <=
                          1
                        }
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft
                          size={15}
                        />
                      </button>

                      {Array.from(
                        {
                          length: Math.min(
                            totalPages,
                            7
                          ),
                        },
                        (_, index) => {

                          let page =
                            index + 1;

                          if (
                            totalPages >
                              7 &&
                            safeCurrentPage >
                              4
                          ) {
                            page =
                              Math.min(
                                totalPages -
                                  6 +
                                  index,
                                totalPages
                              );
                          }

                          return (
                            <button
                              type="button"
                              key={page}
                              onClick={() =>
                                changePage(
                                  page
                                )
                              }
                              className={`h-9 min-w-9 px-2 rounded-lg text-[11px] font-black transition ${
                                safeCurrentPage ===
                                page
                                  ? "text-white"
                                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              }`}
                              style={
                                safeCurrentPage ===
                                page
                                  ? {
                                      backgroundColor:
                                        ACCENT,
                                    }
                                  : undefined
                              }
                            >
                              {page}
                            </button>
                          );
                        }
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          changePage(
                            safeCurrentPage +
                              1
                          )
                        }
                        disabled={
                          safeCurrentPage >=
                          totalPages
                        }
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight
                          size={15}
                        />
                      </button>

                    </div>

                  </div>

                </div>
              </>
            )}

          </section>

        </div>
      </main>

      {/* ==========================================================
          LOGOUT
      ========================================================== */}

      {showLogout && (
        <LogoutModal
          onClose={() =>
            setShowLogout(false)
          }
          onConfirm={() => {
            setShowLogout(false);
            router.push("/login");
          }}
        />
      )}
    </div>
  );
}