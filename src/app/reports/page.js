"use client";

import {
  Plus,
  X,
  Save,
  Pencil,
  RefreshCw,
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  UserRound,
  Building2,
  Phone,
  MessageSquare,
  FileSpreadsheet,
  Hash,
  Check,
  AlertCircle,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Sidebar from "@/components/Sidebar";
import LogoutModal from "../../components/LogoutModal";
import { useRouter } from "next/navigation";

const ACCENT = "#ec3737";
const PAGE_SIZE = 50;

const DEFAULT_STATUS = "Pending";

const STATUS_OPTIONS = [
  "Pending",
  "In Progress",
  "Completed",
  "Not Interested",
  "DNC",
  "Follow UP",
  "Call Back",
  "No Business",
  "Wrong Num",
  "Busy",
  "Voice Mail",
  "Straight To VM",
  "No Answer/VM",
  "Hang Up",
  "Unable To Complete",
  "Not In Service",
  "Lang Barrier",
  "Transfer M/R",
  "Retired",
];

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeDate(value) {
  if (!value) return "";

  const str = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  const normalized = normalizeDate(value);

  if (!normalized) return "—";

  const [year, month, day] = normalized.split("-");

  return `${month}/${day}/${year}`;
}

function formatPhone(value) {
  const phone = safeString(value).trim();

  if (!phone) return "—";

  return phone;
}

function getStatus(row) {
  return (
    row?.status ??
    row?.assignment_status ??
    row?.current_status ??
    "Pending"
  );
}

function getDate(row) {
  return (
    row?.assignment_date ??
    row?.assigned_date ??
    row?.date ??
    ""
  );
}

function getPhone(row) {
  return (
    row?.phone_number ??
    row?.phone ??
    row?.contact_phone ??
    ""
  );
}

function getBusiness(row) {
  return (
    row?.business_name ??
    row?.business ??
    ""
  );
}

function getName(row) {
  return (
    row?.name ??
    row?.contact_name ??
    row?.customer_name ??
    ""
  );
}

function getComment(row) {
  return (
    row?.comment ??
    row?.comments ??
    ""
  );
}

function getSheet(row) {
  return (
    row?.sheet_name ??
    row?.sheet ??
    row?.upload_name ??
    ""
  );
}

function getUserName(row) {
  return (
    row?.employee_name ??
    row?.user_name ??
    row?.staff_name ??
    row?.employee ??
    "—"
  );
}

function getEmployeeId(row) {
  return (
    row?.employee_id ??
    row?.staff_id ??
    row?.user_id ??
    ""
  );
}

function getTaskId(row) {
  return (
    row?.task_id ??
    row?.master_task_id ??
    row?.id ??
    ""
  );
}

function getAssignmentId(row) {
  return (
    row?.assignment_id ??
    row?.daily_assignment_id ??
    row?.id ??
    ""
  );
}

function getInitials(name) {
  const value = safeString(name).trim();

  if (!value) return "—";

  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function statusClasses(status) {
  const value = safeString(status).toLowerCase();

  if (
    value.includes("completed") ||
    value === "complete" ||
    value === "done"
  ) {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (
    value.includes("progress") ||
    value === "in progress"
  ) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (
    value.includes("pending")
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (
    value.includes("dnc") ||
    value.includes("not interested")
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function downloadCSV(rows) {
  if (!rows?.length) return;

  const headers = [
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
  ];

  const escapeCSV = (value) => {
    const str = safeString(value);
    return `"${str.replaceAll('"', '""')}"`;
  };

  const data = rows.map((row, index) => [
    index + 1,
    formatDate(getDate(row)),
    getUserName(row),
    getBusiness(row),
    getName(row),
    getPhone(row),
    getStatus(row),
    getComment(row),
    getSheet(row),
    getTaskId(row),
  ]);

  const csv = [
    headers,
    ...data,
  ]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `admin-history-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function AdminHistoryPage() {
  const router = useRouter();

  const [records, setRecords] = useState([]);
  const [staff, setStaff] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [page, setPage] = useState(1);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  const [newRow, setNewRow] = useState({
    assignment_date: normalizeDate(new Date()),
    employee_id: "",
    business_name: "",
    name: "",
    phone_number: "",
    status: DEFAULT_STATUS,
    comment: "",
  });

  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  const addFormRef = useRef(null);

  // =========================================================
  // CURRENT USER
  // =========================================================

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        router.push("/login");
        return null;
      }

      const data = await response.json();

      const user =
        data?.user ??
        data?.data ??
        data;

      if (!user) {
        router.push("/login");
        return null;
      }

      setCurrentUser(user);

      const admin =
        String(user.role || "").toLowerCase() === "admin";

      setIsAdmin(admin);

      return user;
    } catch (err) {
      console.error(err);
      router.push("/login");
      return null;
    }
  }, [router]);

  // =========================================================
  // STAFF
  // =========================================================

  const fetchStaff = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/staffes/list",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const list =
        Array.isArray(data)
          ? data
          : data?.users ??
            data?.staff ??
            data?.data ??
            [];

      setStaff(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Staff fetch error:", err);
    }
  }, []);

  // =========================================================
  // HISTORY
  // =========================================================

  const fetchReport = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const params = new URLSearchParams();

        if (fromDate) {
          params.set("from", fromDate);
        }

        if (toDate) {
          params.set("to", toDate);
        }

        if (employeeFilter) {
          params.set(
            "employee_id",
            employeeFilter
          );
        }

        if (statusFilter) {
          params.set(
            "status",
            statusFilter
          );
        }

        const url =
          `/api/admin/history?${params.toString()}`;

        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to load history."
          );
        }

        const list =
          Array.isArray(data)
            ? data
            : data?.records ??
              data?.rows ??
              data?.data ??
              [];

        setRecords(
          Array.isArray(list) ? list : []
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "Unable to load history."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      fromDate,
      toDate,
      employeeFilter,
      statusFilter,
    ]
  );

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    let mounted = true;

    async function init() {
      const user = await fetchCurrentUser();

      if (!mounted) return;

      await fetchStaff();

      if (!mounted) return;

      if (user && !isAdmin) {
        setNewRow((prev) => ({
          ...prev,
          employee_id: String(
            user.id ??
              user.user_id ??
              ""
          ),
        }));
      }

      await fetchReport(true);
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================
  // SET OWN EMPLOYEE AFTER USER LOAD
  // =========================================================

  useEffect(() => {
    if (!currentUser) return;

    const ownId =
      currentUser.id ??
      currentUser.user_id;

    if (
      ownId !== undefined &&
      ownId !== null
    ) {
      setNewRow((prev) => {
        if (!prev.employee_id || !isAdmin) {
          return {
            ...prev,
            employee_id: String(ownId),
          };
        }

        return prev;
      });
    }
  }, [currentUser, isAdmin]);

  // =========================================================
  // LIVE REFRESH
  // =========================================================

  useEffect(() => {
    const interval = setInterval(() => {
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      if (editingId) return;
      if (showAddForm) return;
      if (savingNew) return;

      fetchReport(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [
    editingId,
    showAddForm,
    savingNew,
    fetchReport,
  ]);

  // =========================================================
  // FILTER
  // =========================================================

  const filteredRecords = useMemo(() => {
    const query =
      safeString(search)
        .trim()
        .toLowerCase();

    if (!query) {
      return records;
    }

    return records.filter((row) => {
      const searchable = [
        getBusiness(row),
        getName(row),
        getPhone(row),
        getStatus(row),
        getComment(row),
        getUserName(row),
        getSheet(row),
        getTaskId(row),
        getEmployeeId(row),
      ]
        .map(safeString)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [records, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRecords.length / PAGE_SIZE
    )
  );

  const paginatedRecords = useMemo(() => {
    const start =
      (page - 1) * PAGE_SIZE;

    return filteredRecords.slice(
      start,
      start + PAGE_SIZE
    );
  }, [
    filteredRecords,
    page,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // =========================================================
  // ADD FORM
  // =========================================================

  const openAddForm = () => {
    setAddError("");
    setAddSuccess("");

    const ownId =
      currentUser?.id ??
      currentUser?.user_id ??
      "";

    setNewRow({
      assignment_date:
        normalizeDate(new Date()),
      employee_id: isAdmin
        ? ""
        : String(ownId),
      business_name: "",
      name: "",
      phone_number: "",
      status: DEFAULT_STATUS,
      comment: "",
    });

    setShowAddForm(true);

    setTimeout(() => {
      addFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const closeAddForm = () => {
    if (savingNew) return;

    setShowAddForm(false);
    setAddError("");
    setAddSuccess("");
  };

  const handleNewChange = (
    field,
    value
  ) => {
    setNewRow((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // =========================================================
  // SAVE NEW ROW
  // =========================================================

  const handleCreateRow = async (event) => {
    event.preventDefault();

    setAddError("");
    setAddSuccess("");

    const ownId =
      currentUser?.id ??
      currentUser?.user_id;

    const employeeId = isAdmin
      ? newRow.employee_id
      : String(ownId ?? "");

    if (!employeeId) {
      setAddError(
        "Employee select karein."
      );
      return;
    }

    if (!newRow.assignment_date) {
      setAddError(
        "Date select karein."
      );
      return;
    }

    if (!newRow.status?.trim()) {
      setAddError(
        "Status select karein."
      );
      return;
    }

    setSavingNew(true);

    try {
      const response = await fetch(
        "/api/admin/history",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            assignment_date:
              newRow.assignment_date,

            employee_id:
              employeeId,

            business_name:
              newRow.business_name.trim(),

            name:
              newRow.name.trim(),

            phone_number:
              newRow.phone_number.trim(),

            status:
              newRow.status.trim(),

            comment:
              newRow.comment.trim(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to create row."
        );
      }

      const created =
        data?.record ??
        data?.row ??
        data?.data ??
        data;

      if (
        created &&
        typeof created === "object" &&
        !Array.isArray(created)
      ) {
        setRecords((prev) => [
          created,
          ...prev,
        ]);
      } else {
        await fetchReport(false);
      }

      setAddSuccess(
        "New row successfully add ho gayi."
      );

      setNewRow({
        assignment_date:
          normalizeDate(new Date()),
        employee_id: isAdmin
          ? ""
          : String(ownId ?? ""),
        business_name: "",
        name: "",
        phone_number: "",
        status: DEFAULT_STATUS,
        comment: "",
      });

      setPage(1);

      setTimeout(() => {
        setShowAddForm(false);
        setAddSuccess("");
      }, 800);
    } catch (err) {
      console.error(
        "Create row error:",
        err
      );

      setAddError(
        err?.message ||
          "Unable to create row."
      );
    } finally {
      setSavingNew(false);
    }
  };

  // =========================================================
  // EDIT
  // =========================================================

  const startEdit = (row) => {
    const id =
      getAssignmentId(row);

    setEditingId(id);

    setEditForm({
      assignment_date:
        normalizeDate(getDate(row)),

      employee_id:
        String(getEmployeeId(row) || ""),

      business_name:
        getBusiness(row),

      name:
        getName(row),

      phone_number:
        getPhone(row),

      status:
        getStatus(row),

      comment:
        getComment(row),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (
    field,
    value
  ) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveEdit = async (row) => {
    const assignmentId =
      getAssignmentId(row);

    if (!assignmentId) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        "/api/admin/history",
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: assignmentId,

            assignment_date:
              editForm.assignment_date,

            employee_id:
              editForm.employee_id,

            business_name:
              editForm.business_name,

            name:
              editForm.name,

            phone_number:
              editForm.phone_number,

            status:
              editForm.status,

            comment:
              editForm.comment,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to update row."
        );
      }

      const updated =
        data?.record ??
        data?.row ??
        data?.data ??
        data;

      if (
        updated &&
        typeof updated ===
          "object" &&
        !Array.isArray(updated)
      ) {
        setRecords((prev) =>
          prev.map((item) =>
            String(
              getAssignmentId(item)
            ) ===
            String(assignmentId)
              ? updated
              : item
          )
        );
      } else {
        await fetchReport(false);
      }

      cancelEdit();
    } catch (err) {
      console.error(
        "Update error:",
        err
      );

      setError(
        err?.message ||
          "Unable to update row."
      );
    }
  };

  // =========================================================
  // RESET FILTERS
  // =========================================================

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setEmployeeFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  // =========================================================
  // SIDEBAR
  // =========================================================

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-gray-900">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        onLogout={() =>
          setShowLogoutModal(true)
        }
      />


      <div className="lg:pl-[260px]">
        {/* =========================================================
    STATUS SUMMARY
========================================================= */}

<div className="mb-5 py-10 px-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">

  {/* TOTAL */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      Total
    </div>

    <div className="mt-2 text-2xl font-extrabold text-gray-900">
      {records.length.toLocaleString()}
    </div>

    <div className="mt-1 text-[11px] text-gray-500">
      All Records
    </div>
  </div>

  {/* FOLLOW UP */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      Follow UP
    </div>

    <div className="mt-2 text-2xl font-extrabold text-blue-600">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "follow up"
        ).length.toLocaleString()
      }
    </div>
  </div>

  {/* CALL BACK */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      Call Back
    </div>

    <div className="mt-2 text-2xl font-extrabold text-purple-600">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "call back"
        ).length.toLocaleString()
      }
    </div>
  </div>

  {/* WRONG NUM */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      Wrong Num
    </div>

    <div className="mt-2 text-2xl font-extrabold text-red-600">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "wrong num"
        ).length.toLocaleString()
      }
    </div>
  </div>

  {/* NOT INTERESTED */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      Not Interested
    </div>

    <div className="mt-2 text-2xl font-extrabold text-orange-600">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "not interested"
        ).length.toLocaleString()
      }
    </div>
  </div>

  {/* DNC */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      DNC
    </div>

    <div className="mt-2 text-2xl font-extrabold text-red-700">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "dnc"
        ).length.toLocaleString()
      }
    </div>
  </div>

  {/* NO BUSINESS */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      No Business
    </div>

    <div className="mt-2 text-2xl font-extrabold text-gray-700">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "no business"
        ).length.toLocaleString()
      }
    </div>
  </div>

  {/* PENDING */}

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
      Pending
    </div>

    <div className="mt-2 text-2xl font-extrabold text-amber-600">
      {
        records.filter(
          (row) =>
            String(getStatus(row))
              .toLowerCase()
              .trim() === "pending"
        ).length.toLocaleString()
      }
    </div>
  </div>

</div>
        {/* =====================================================
            MOBILE TOP BAR
        ===================================================== */}

        <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
            >
              Menu
            </button>

            <div className="text-sm font-bold">
              Admin History
            </div>

            <button
              type="button"
              onClick={() =>
                fetchReport(false)
              }
              className="rounded-xl border border-gray-200 p-2"
              title="Refresh"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
            </button>
          </div>
        </div>

        {/* =====================================================
            MAIN
        ===================================================== */}

        <main className="px-3 py-4 sm:px-5 md:px-7 lg:px-8 lg:py-7">
          {/* HEADER */}

          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  Admin Reports
                </h1>

                {isAdmin && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                    style={{
                      backgroundColor:
                        ACCENT,
                    }}
                  >
                    ADMIN
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Call activity and task history
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  fetchReport(false)
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <RefreshCw
                  size={16}
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <Download size={16} />
                Export CSV
              </button>

              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                style={{
                  backgroundColor:
                    ACCENT,
                }}
              >
                <Plus size={18} />
                Add New Row
              </button>
            </div>
          </div>

          {/* ===================================================
              ADD NEW ROW FORM
          =================================================== */}

          {showAddForm && (
            <section
              ref={addFormRef}
              className="mb-5 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm"
            >
              <div
                className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                style={{
                  background:
                    "linear-gradient(to right, #fff5f5, #ffffff)",
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                      style={{
                        backgroundColor:
                          ACCENT,
                      }}
                    >
                      <Plus size={18} />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-900">
                        Add New Row
                      </h2>

                      <p className="text-xs text-gray-500">
                        Manually create a brand-new task record
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingNew}
                  onClick={closeAddForm}
                  className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 sm:self-auto"
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>

              <form
                onSubmit={handleCreateRow}
                className="p-4 sm:p-5"
              >
                {addError && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      {addError}
                    </span>
                  </div>
                )}

                {addSuccess && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    <Check size={17} />
                    {addSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {/* DATE */}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="date"
                        value={
                          newRow.assignment_date
                        }
                        onChange={(e) =>
                          handleNewChange(
                            "assignment_date",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        required
                      />
                    </div>
                  </div>

                  {/* EMPLOYEE */}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Employee
                    </label>

                    {isAdmin ? (
                      <div className="relative">
                        <UserRound
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />

                        <select
                          value={
                            newRow.employee_id
                          }
                          onChange={(e) =>
                            handleNewChange(
                              "employee_id",
                              e.target.value
                            )
                          }
                          className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                          required
                        >
                          <option value="">
                            Select employee
                          </option>

                          {staff.map(
                            (person) => {
                              const id =
                                person.id ??
                                person.user_id;

                              const name =
                                person.name ??
                                person.full_name ??
                                person.email ??
                                `Employee ${id}`;

                              return (
                                <option
                                  key={id}
                                  value={String(
                                    id
                                  )}
                                >
                                  {name}
                                </option>
                              );
                            }
                          )}
                        </select>
                      </div>
                    ) : (
                      <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
                        <UserRound
                          size={16}
                          className="text-gray-400"
                        />

                        <span className="truncate text-sm font-semibold text-gray-700">
                          {currentUser?.name ||
                            currentUser?.full_name ||
                            currentUser?.email ||
                            "My Account"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BUSINESS */}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Business
                    </label>

                    <div className="relative">
                      <Building2
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="text"
                        value={
                          newRow.business_name
                        }
                        onChange={(e) =>
                          handleNewChange(
                            "business_name",
                            e.target.value
                          )
                        }
                        placeholder="Business name"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>

                  {/* CONTACT */}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Contact
                    </label>

                    <div className="relative">
                      <UserRound
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="text"
                        value={newRow.name}
                        onChange={(e) =>
                          handleNewChange(
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="Contact name"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>

                  {/* PHONE */}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Phone
                    </label>

                    <div className="relative">
                      <Phone
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="text"
                        value={
                          newRow.phone_number
                        }
                        onChange={(e) =>
                          handleNewChange(
                            "phone_number",
                            e.target.value
                          )
                        }
                        placeholder="Phone number"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>

                  {/* STATUS */}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Status
                    </label>

                    <select
                      value={newRow.status}
                      onChange={(e) =>
                        handleNewChange(
                          "status",
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      required
                    >
                      {STATUS_OPTIONS.map(
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

                  {/* COMMENT */}

                  <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">
                      Comments
                    </label>

                    <div className="relative">
                      <MessageSquare
                        size={16}
                        className="pointer-events-none absolute left-3 top-3.5 text-gray-400"
                      />

                      <textarea
                        value={
                          newRow.comment
                        }
                        onChange={(e) =>
                          handleNewChange(
                            "comment",
                            e.target.value
                          )
                        }
                        placeholder="Comments..."
                        rows={1}
                        className="min-h-[44px] w-full resize-y rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={savingNew}
                    onClick={closeAddForm}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X size={16} />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingNew}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      backgroundColor:
                        ACCENT,
                    }}
                  >
                    {savingNew ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={17} />
                        Save New Row
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ===================================================
              FILTER CARD
          =================================================== */}

          <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Filters
                </h2>

                <p className="text-xs text-gray-500">
                  Search and filter history records
                </p>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="self-start text-xs font-semibold text-gray-500 hover:text-gray-900 sm:self-auto"
              >
                Reset filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* SEARCH */}

              <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-2">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(
                      e.target.value
                    );
                    setPage(1);
                  }}
                  placeholder="Search business, phone, employee..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* STATUS */}

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value
                  );
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
              >
                <option value="">
                  All Status
                </option>

                {STATUS_OPTIONS.map(
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

              {/* EMPLOYEE */}

              {isAdmin ? (
                <select
                  value={employeeFilter}
                  onChange={(e) => {
                    setEmployeeFilter(
                      e.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                >
                  <option value="">
                    All Employees
                  </option>

                  {staff.map((person) => {
                    const id =
                      person.id ??
                      person.user_id;

                    const name =
                      person.name ??
                      person.full_name ??
                      person.email ??
                      `Employee ${id}`;

                    return (
                      <option
                        key={id}
                        value={String(id)}
                      >
                        {name}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="flex h-11 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-600">
                  My Records
                </div>
              )}

              {/* FROM */}

              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(
                    e.target.value
                  );
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
              />

              {/* TO */}

              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(
                    e.target.value
                  );
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>
          </section>

          {/* ===================================================
              ERROR
          =================================================== */}

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <span>{error}</span>
            </div>
          )}

          {/* ===================================================
              TABLE CARD
          =================================================== */}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* TABLE HEADER */}

            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900">
                    History Records
                  </h2>

                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                    {filteredRecords.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  All matching records
                </p>
              </div>

              <div className="text-xs text-gray-500">
                {refreshing
                  ? "Updating..."
                  : "Live"}
              </div>
            </div>

            {/* LOADING */}

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Loader2
                    size={30}
                    className="animate-spin"
                    style={{
                      color: ACCENT,
                    }}
                  />

                  <span className="text-sm font-medium">
                    Loading records...
                  </span>
                </div>
              </div>
            ) : filteredRecords.length ===
              0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                  <FileSpreadsheet
                    size={25}
                    className="text-gray-400"
                  />
                </div>

                <h3 className="font-bold text-gray-900">
                  No records found
                </h3>

                <p className="mt-1 max-w-md text-sm text-gray-500">
                  No history records match your current filters.
                </p>

                <button
                  type="button"
                  onClick={openAddForm}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                  style={{
                    backgroundColor:
                      ACCENT,
                  }}
                >
                  <Plus size={17} />
                  Add New Row
                </button>
              </div>
            ) : (
              <>
                {/* =================================================
                    DESKTOP TABLE
                ================================================= */}

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1250px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left">
                        <th className="w-[55px] px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          #
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Date
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Employee
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Business
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Contact
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Phone
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Status
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Comments
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Sheet
                        </th>

                        <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Task ID
                        </th>

                        <th className="sticky right-0 z-10 bg-gray-50 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedRecords.map(
                        (row, index) => {
                          const assignmentId =
                            getAssignmentId(
                              row
                            );

                          const isEditing =
                            String(
                              editingId
                            ) ===
                            String(
                              assignmentId
                            );

                          return (
                            <tr
                              key={`${assignmentId}-${index}`}
                              className="border-b border-gray-100 transition hover:bg-gray-50"
                            >
                              {/* # */}

                              <td className="px-3 py-3 align-top text-sm font-semibold text-gray-500">
                                {(page - 1) *
                                  PAGE_SIZE +
                                  index +
                                  1}
                              </td>

                              {/* DATE */}

                              <td className="px-3 py-3 align-top">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={
                                      editForm.assignment_date ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "assignment_date",
                                        e.target.value
                                      )
                                    }
                                    className="h-9 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  />
                                ) : (
                                  <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                                    {formatDate(
                                      getDate(
                                        row
                                      )
                                    )}
                                  </span>
                                )}
                              </td>

                              {/* EMPLOYEE */}

                              <td className="px-3 py-3 align-top">
                                {isEditing ? (
                                  isAdmin ? (
                                    <select
                                      value={
                                        editForm.employee_id ||
                                        ""
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        handleEditChange(
                                          "employee_id",
                                          e.target.value
                                        )
                                      }
                                      className="h-9 min-w-[150px] rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                    >
                                      <option value="">
                                        Select
                                      </option>

                                      {staff.map(
                                        (
                                          person
                                        ) => {
                                          const id =
                                            person.id ??
                                            person.user_id;

                                          const name =
                                            person.name ??
                                            person.full_name ??
                                            person.email ??
                                            `Employee ${id}`;

                                          return (
                                            <option
                                              key={
                                                id
                                              }
                                              value={String(
                                                id
                                              )}
                                            >
                                              {
                                                name
                                              }
                                            </option>
                                          );
                                        }
                                      )}
                                    </select>
                                  ) : (
                                    <span className="text-xs font-semibold text-gray-600">
                                      {getUserName(
                                        row
                                      )}
                                    </span>
                                  )
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                      style={{
                                        backgroundColor:
                                          ACCENT,
                                      }}
                                    >
                                      {getInitials(
                                        getUserName(
                                          row
                                        )
                                      )}
                                    </div>

                                    <span className="max-w-[140px] truncate text-sm font-semibold text-gray-700">
                                      {getUserName(
                                        row
                                      )}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* BUSINESS */}

                              <td className="max-w-[190px] px-3 py-3 align-top">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={
                                      editForm.business_name ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "business_name",
                                        e.target.value
                                      )
                                    }
                                    className="h-9 w-[180px] rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  />
                                ) : (
                                  <span
                                    className="block max-w-[180px] truncate text-sm font-semibold text-gray-800"
                                    title={getBusiness(
                                      row
                                    )}
                                  >
                                    {getBusiness(
                                      row
                                    ) || "—"}
                                  </span>
                                )}
                              </td>

                              {/* CONTACT */}

                              <td className="max-w-[150px] px-3 py-3 align-top">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={
                                      editForm.name ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "name",
                                        e.target.value
                                      )
                                    }
                                    className="h-9 w-[145px] rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  />
                                ) : (
                                  <span
                                    className="block max-w-[145px] truncate text-sm text-gray-700"
                                    title={getName(
                                      row
                                    )}
                                  >
                                    {getName(
                                      row
                                    ) || "—"}
                                  </span>
                                )}
                              </td>

                              {/* PHONE */}

                              <td className="px-3 py-3 align-top">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={
                                      editForm.phone_number ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "phone_number",
                                        e.target.value
                                      )
                                    }
                                    className="h-9 w-[130px] rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  />
                                ) : (
                                  <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                                    {formatPhone(
                                      getPhone(
                                        row
                                      )
                                    )}
                                  </span>
                                )}
                              </td>

                              {/* STATUS */}

                              <td className="px-3 py-3 align-top">
                                {isEditing ? (
                                  <select
                                    value={
                                      editForm.status ||
                                      DEFAULT_STATUS
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "status",
                                        e.target.value
                                      )
                                    }
                                    className="h-9 min-w-[135px] rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  >
                                    {STATUS_OPTIONS.map(
                                      (
                                        status
                                      ) => (
                                        <option
                                          key={
                                            status
                                          }
                                          value={
                                            status
                                          }
                                        >
                                          {
                                            status
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>
                                ) : (
                                  <span
                                    className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                      getStatus(
                                        row
                                      )
                                    )}`}
                                  >
                                    {getStatus(
                                      row
                                    )}
                                  </span>
                                )}
                              </td>

                              {/* COMMENTS */}

                              <td className="max-w-[220px] px-3 py-3 align-top">
                                {isEditing ? (
                                  <textarea
                                    value={
                                      editForm.comment ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "comment",
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    className="w-[210px] resize-y rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  />
                                ) : (
                                  <span
                                    className="block max-w-[210px] truncate text-sm text-gray-600"
                                    title={getComment(
                                      row
                                    )}
                                  >
                                    {getComment(
                                      row
                                    ) || "—"}
                                  </span>
                                )}
                              </td>

                              {/* SHEET */}

                              <td className="px-3 py-3 align-top">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
                                  <FileSpreadsheet
                                    size={14}
                                  />
                                  {getSheet(
                                    row
                                  ) || "—"}
                                </span>
                              </td>

                              {/* TASK ID */}

                              <td className="px-3 py-3 align-top">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-semibold text-gray-600">
                                  <Hash
                                    size={12}
                                  />
                                  {getTaskId(
                                    row
                                  ) || "—"}
                                </span>
                              </td>

                              {/* ACTION */}

                              <td className="sticky right-0 z-10 bg-white px-3 py-3 align-top">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        saveEdit(
                                          row
                                        )
                                      }
                                      className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-white"
                                      style={{
                                        backgroundColor:
                                          ACCENT,
                                      }}
                                    >
                                      <Save
                                        size={
                                          13
                                        }
                                      />
                                      Save
                                    </button>

                                    <button
                                      type="button"
                                      onClick={
                                        cancelEdit
                                      }
                                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                                    >
                                      <X
                                        size={
                                          13
                                        }
                                      />
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEdit(
                                        row
                                      )
                                    }
                                    className="mx-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50"
                                  >
                                    <Pencil
                                      size={
                                        13
                                      }
                                    />
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                {/* =================================================
                    MOBILE CARDS
                ================================================= */}

                <div className="divide-y divide-gray-100 md:hidden">
                  {paginatedRecords.map(
                    (row, index) => {
                      const assignmentId =
                        getAssignmentId(
                          row
                        );

                      const isEditing =
                        String(
                          editingId
                        ) ===
                        String(
                          assignmentId
                        );

                      return (
                        <div
                          key={`${assignmentId}-${index}`}
                          className="p-4"
                        >
                          {/* CARD TOP */}

                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                                style={{
                                  backgroundColor:
                                    ACCENT,
                                }}
                              >
                                {getInitials(
                                  getUserName(
                                    row
                                  )
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-gray-900">
                                  {getBusiness(
                                    row
                                  ) ||
                                    "No Business"}
                                </div>

                                <div className="mt-0.5 truncate text-xs text-gray-500">
                                  {getUserName(
                                    row
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="shrink-0 text-[11px] font-semibold text-gray-400">
                              #
                              {(page - 1) *
                                PAGE_SIZE +
                                index +
                                1}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="space-y-3">
                              {/* EDIT DATE */}

                              <div>
                                <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                  Date
                                </label>

                                <input
                                  type="date"
                                  value={
                                    editForm.assignment_date ||
                                    ""
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleEditChange(
                                      "assignment_date",
                                      e.target.value
                                    )
                                  }
                                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                />
                              </div>

                              {/* EDIT EMPLOYEE */}

                              {isAdmin && (
                                <div>
                                  <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                    Employee
                                  </label>

                                  <select
                                    value={
                                      editForm.employee_id ||
                                      ""
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleEditChange(
                                        "employee_id",
                                        e.target.value
                                      )
                                    }
                                    className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                  >
                                    <option value="">
                                      Select employee
                                    </option>

                                    {staff.map(
                                      (
                                        person
                                      ) => {
                                        const id =
                                          person.id ??
                                          person.user_id;

                                        const name =
                                          person.name ??
                                          person.full_name ??
                                          person.email ??
                                          `Employee ${id}`;

                                        return (
                                          <option
                                            key={
                                              id
                                            }
                                            value={String(
                                              id
                                            )}
                                          >
                                            {
                                              name
                                            }
                                          </option>
                                        );
                                      }
                                    )}
                                  </select>
                                </div>
                              )}

                              {/* EDIT BUSINESS */}

                              <div>
                                <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                  Business
                                </label>

                                <input
                                  type="text"
                                  value={
                                    editForm.business_name ||
                                    ""
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleEditChange(
                                      "business_name",
                                      e.target.value
                                    )
                                  }
                                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                />
                              </div>

                              {/* EDIT CONTACT */}

                              <div>
                                <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                  Contact
                                </label>

                                <input
                                  type="text"
                                  value={
                                    editForm.name ||
                                    ""
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleEditChange(
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                />
                              </div>

                              {/* EDIT PHONE */}

                              <div>
                                <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                  Phone
                                </label>

                                <input
                                  type="text"
                                  value={
                                    editForm.phone_number ||
                                    ""
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleEditChange(
                                      "phone_number",
                                      e.target.value
                                    )
                                  }
                                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                />
                              </div>

                              {/* EDIT STATUS */}

                              <div>
                                <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                  Status
                                </label>

                                <select
                                  value={
                                    editForm.status ||
                                    DEFAULT_STATUS
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleEditChange(
                                      "status",
                                      e.target.value
                                    )
                                  }
                                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                >
                                  {STATUS_OPTIONS.map(
                                    (
                                      status
                                    ) => (
                                      <option
                                        key={
                                          status
                                        }
                                        value={
                                          status
                                        }
                                      >
                                        {
                                          status
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              {/* EDIT COMMENT */}

                              <div>
                                <label className="mb-1 block text-[11px] font-bold text-gray-500">
                                  Comments
                                </label>

                                <textarea
                                  value={
                                    editForm.comment ||
                                    ""
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    handleEditChange(
                                      "comment",
                                      e.target.value
                                    )
                                  }
                                  rows={3}
                                  className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    saveEdit(
                                      row
                                    )
                                  }
                                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white"
                                  style={{
                                    backgroundColor:
                                      ACCENT,
                                  }}
                                >
                                  <Save
                                    size={
                                      16
                                    }
                                  />
                                  Save
                                </button>

                                <button
                                  type="button"
                                  onClick={
                                    cancelEdit
                                  }
                                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700"
                                >
                                  <X
                                    size={
                                      16
                                    }
                                  />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* CARD INFO */}

                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Date
                                  </div>

                                  <div className="mt-1 text-sm font-semibold text-gray-700">
                                    {formatDate(
                                      getDate(
                                        row
                                      )
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Status
                                  </div>

                                  <div className="mt-1">
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${statusClasses(
                                        getStatus(
                                          row
                                        )
                                      )}`}
                                    >
                                      {getStatus(
                                        row
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Contact
                                  </div>

                                  <div className="mt-1 truncate text-sm font-semibold text-gray-700">
                                    {getName(
                                      row
                                    ) ||
                                      "—"}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Phone
                                  </div>

                                  <div className="mt-1 truncate text-sm font-semibold text-gray-700">
                                    {formatPhone(
                                      getPhone(
                                        row
                                      )
                                    )}
                                  </div>
                                </div>

                                <div className="col-span-2 rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Comments
                                  </div>

                                  <div className="mt-1 text-sm text-gray-600">
                                    {getComment(
                                      row
                                    ) ||
                                      "—"}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Sheet
                                  </div>

                                  <div className="mt-1 truncate text-xs font-semibold text-gray-600">
                                    {getSheet(
                                      row
                                    ) ||
                                      "—"}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                    Task ID
                                  </div>

                                  <div className="mt-1 font-mono text-xs font-bold text-gray-600">
                                    {getTaskId(
                                      row
                                    ) ||
                                      "—"}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(
                                    row
                                  )
                                }
                                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
                              >
                                <Pencil
                                  size={16}
                                />
                                Edit Row
                              </button>
                            </>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>

                {/* =================================================
                    PAGINATION
                ================================================= */}

                <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-gray-500">
                    Showing{" "}
                    <span className="font-bold text-gray-700">
                      {filteredRecords.length ===
                      0
                        ? 0
                        : (page - 1) *
                            PAGE_SIZE +
                          1}
                    </span>{" "}
                    to{" "}
                    <span className="font-bold text-gray-700">
                      {Math.min(
                        page * PAGE_SIZE,
                        filteredRecords.length
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-gray-700">
                      {
                        filteredRecords.length
                      }
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() =>
                        setPage(
                          (p) =>
                            Math.max(
                              1,
                              p - 1
                            )
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft
                        size={16}
                      />
                    </button>

                    <div className="flex h-9 min-w-[42px] items-center justify-center rounded-lg bg-gray-100 px-2 text-xs font-bold text-gray-700">
                      {page} /{" "}
                      {totalPages}
                    </div>

                    <button
                      type="button"
                      disabled={
                        page >= totalPages
                      }
                      onClick={() =>
                        setPage(
                          (p) =>
                            Math.min(
                              totalPages,
                              p + 1
                            )
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight
                        size={16}
                      />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
      </div>

      {/* =========================================================
          LOGOUT MODAL
      ========================================================= */}

      {showLogoutModal && (
        <LogoutModal
          open={showLogoutModal}
          onClose={() =>
            setShowLogoutModal(false)
          }
        />
      )}
    </div>
  );
}