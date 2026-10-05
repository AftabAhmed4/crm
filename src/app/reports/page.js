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
  BarChart3,
  Filter,
  RotateCcw,
  ShieldCheck,
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

const ADMIN_ROLES = [
  "admin",
  "administrator",
  "superadmin",
  "super_admin",
];

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeDate(value) {
  if (!value) return "";

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const str = String(value);

  const directMatch = str.match(
    /^(\d{4}-\d{2}-\d{2})/
  );

  if (directMatch) {
    return directMatch[1];
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  const normalized = normalizeDate(value);

  if (!normalized) return "—";

  const [year, month, day] =
    normalized.split("-");

  return `${month}/${day}/${year}`;
}

function formatPhone(value) {
  const phone = safeString(value).trim();

  return phone || "—";
}

function getStatus(row) {
  return (
    row?.status ??
    row?.assignment_status ??
    row?.current_status ??
    DEFAULT_STATUS
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

  const parts = value
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function statusClasses(status) {
  const value = safeString(status)
    .toLowerCase()
    .trim();

  if (
    value.includes("completed") ||
    value === "complete" ||
    value === "done"
  ) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (value.includes("progress")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (value.includes("pending")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (
    value.includes("dnc") ||
    value.includes("not interested")
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (
    value.includes("follow") ||
    value.includes("call back") ||
    value.includes("callback")
  ) {
    return "bg-purple-50 text-purple-700 border-purple-200";
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

    return `"${str.replaceAll(
      '"',
      '""'
    )}"`;
  };

  const data = rows.map(
    (row, index) => [
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
    ]
  );

  const csv = [
    headers,
    ...data,
  ]
    .map((row) =>
      row.map(escapeCSV).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `admin-history-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

export default function AdminHistoryPage() {
  const router = useRouter();

  const [records, setRecords] =
    useState([]);

  const [staff, setStaff] =
    useState([]);

  const [currentUser, setCurrentUser] =
    useState(null);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [employeeFilter, setEmployeeFilter] =
    useState("");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [page, setPage] =
    useState(1);

  /*
   * IMPORTANT
   * API TOTAL
   */
  const [totalRecords, setTotalRecords] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(1);

  const [currentPageRecords, setCurrentPageRecords] =
    useState(0);

  const [editingId, setEditingId] =
    useState(null);

  const [editForm, setEditForm] =
    useState({});

  const [showAddForm, setShowAddForm] =
    useState(false);

  const [savingNew, setSavingNew] =
    useState(false);

  const [newRow, setNewRow] =
    useState({
      assignment_date:
        normalizeDate(new Date()),

      employee_id: "",

      business_name: "",

      name: "",

      phone_number: "",

      status: DEFAULT_STATUS,

      comment: "",
    });

  const [addError, setAddError] =
    useState("");

  const [addSuccess, setAddSuccess] =
    useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  const addFormRef =
    useRef(null);

  // =========================================================
  // CURRENT USER
  // =========================================================

  const fetchCurrentUser =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/auth/me",
            {
              credentials: "include",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          router.push("/login");
          return null;
        }

        const data =
          await response.json();

        const user =
          data?.user ??
          data?.data ??
          data;

        if (!user) {
          router.push("/login");
          return null;
        }

        setCurrentUser(user);

        const role =
          String(
            user.role || ""
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              "_"
            );

        const admin =
          ADMIN_ROLES.includes(
            role
          );

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

  const fetchStaff =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/staffes/list",
            {
              credentials: "include",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        const list =
          Array.isArray(data)
            ? data
            : data?.users ??
              data?.staff ??
              data?.data ??
              [];

        setStaff(
          Array.isArray(list)
            ? list
            : []
        );
      } catch (err) {
        console.error(
          "Staff fetch error:",
          err
        );
      }
    }, []);

  // =========================================================
  // HISTORY API
  // =========================================================

  const fetchReport =
    useCallback(
      async (
        showLoader = false,
        overrideFilters = {},
        overridePage = null
      ) => {
        try {
          if (showLoader) {
            setLoading(true);
          } else {
            setRefreshing(true);
          }

          setError("");

          const selectedSearch =
            overrideFilters.search ??
            search;

          const selectedEmployee =
            overrideFilters.employee_id ??
            employeeFilter;

          const selectedStatus =
            overrideFilters.status ??
            statusFilter;

          const selectedFrom =
            overrideFilters.from ??
            fromDate;

          const selectedTo =
            overrideFilters.to ??
            toDate;

          const selectedPage =
            overridePage ??
            page;

          const params =
            new URLSearchParams();

          /*
           * SERVER-SIDE PAGINATION
           */
          params.set(
            "page",
            String(selectedPage)
          );

          params.set(
            "limit",
            String(PAGE_SIZE)
          );

          if (selectedFrom) {
            params.set(
              "from",
              selectedFrom
            );
          }

          if (selectedTo) {
            params.set(
              "to",
              selectedTo
            );
          }

          if (selectedEmployee) {
            params.set(
              "employee_id",
              String(
                selectedEmployee
              )
            );
          }

          if (selectedStatus) {
            params.set(
              "status",
              selectedStatus
            );
          }

          if (
            selectedSearch &&
            selectedSearch.trim()
          ) {
            params.set(
              "search",
              selectedSearch.trim()
            );
          }

          const url =
            `/api/admin/history?${params.toString()}`;

          const response =
            await fetch(
              url,
              {
                credentials: "include",
                cache: "no-store",
              }
            );

          const data =
            await response.json();

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

          const safeList =
            Array.isArray(list)
              ? list
              : [];

          setRecords(
            safeList
          );

          /*
           * THIS IS THE IMPORTANT FIX
           *
           * Do NOT use safeList.length
           * as total.
           */
          const apiTotal =
            Number(
              data?.totalRecords ??
                data?.total ??
                data?.filteredTotal ??
                safeList.length
            );

          setTotalRecords(
            Number.isFinite(apiTotal)
              ? apiTotal
              : safeList.length
          );

          const apiPages =
            Number(
              data?.totalPages ??
                Math.max(
                  1,
                  Math.ceil(
                    apiTotal /
                      PAGE_SIZE
                  )
                )
            );

          setTotalPages(
            Number.isFinite(
              apiPages
            ) && apiPages > 0
              ? apiPages
              : 1
          );

          setCurrentPageRecords(
            Number(
              data?.currentPageRecords ??
                safeList.length
            )
          );

          if (
            selectedPage !== page
          ) {
            setPage(
              selectedPage
            );
          }
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
        search,
        employeeFilter,
        statusFilter,
        fromDate,
        toDate,
        page,
      ]
    );

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    let mounted = true;

    async function init() {
      const user =
        await fetchCurrentUser();

      if (!mounted) return;

      await fetchStaff();

      if (!mounted) return;

      if (user) {
        const ownId =
          user.id ??
          user.user_id ??
          "";

        const role =
          String(
            user.role || ""
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              "_"
            );

        const admin =
          ADMIN_ROLES.includes(
            role
          );

        if (!admin) {
          setNewRow(
            (prev) => ({
              ...prev,
              employee_id:
                String(
                  ownId
                ),
            })
          );
        }
      }

      await fetchReport(
        true,
        {},
        1
      );
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================
  // OWN EMPLOYEE
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
      setNewRow(
        (prev) => {
          if (
            !prev.employee_id ||
            !isAdmin
          ) {
            return {
              ...prev,
              employee_id:
                String(
                  ownId
                ),
            };
          }

          return prev;
        }
      );
    }
  }, [
    currentUser,
    isAdmin,
  ]);

  // =========================================================
  // LIVE REFRESH
  // =========================================================

  useEffect(() => {
    const interval =
      setInterval(() => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        if (editingId) return;

        if (showAddForm) return;

        if (savingNew) return;

        fetchReport(
          false,
          {},
          page
        );
      }, 5000);

    return () =>
      clearInterval(interval);
  }, [
    editingId,
    showAddForm,
    savingNew,
    fetchReport,
    page,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  /*
   * NOTE:
   *
   * These status cards are based on the records
   * returned by the current API page.
   *
   * TOTAL however is the REAL API TOTAL.
   */
  const summary =
    useMemo(() => {
      const count =
        (status) =>
          records.filter(
            (row) =>
              safeString(
                getStatus(row)
              )
                .toLowerCase()
                .trim() ===
              status
          ).length;

      return {
        total: totalRecords,

        followUp:
          count(
            "follow up"
          ),

        callBack:
          count(
            "call back"
          ),

        wrongNum:
          count(
            "wrong num"
          ),

        notInterested:
          count(
            "not interested"
          ),

        dnc:
          count("dnc"),

        noBusiness:
          count(
            "no business"
          ),

        pending:
          count("pending"),
      };
    }, [
      records,
      totalRecords,
    ]);

  // =========================================================
  // FILTER HANDLERS
  // =========================================================

  const handleEmployeeFilter =
    (value) => {
      setEmployeeFilter(
        value
      );

      setPage(1);

      fetchReport(
        false,
        {
          employee_id:
            value,
        },
        1
      );
    };

  const handleStatusFilter =
    (value) => {
      setStatusFilter(
        value
      );

      setPage(1);

      fetchReport(
        false,
        {
          status: value,
        },
        1
      );
    };

  const handleFromDate =
    (value) => {
      setFromDate(value);

      setPage(1);

      fetchReport(
        false,
        {
          from: value,
        },
        1
      );
    };

  const handleToDate =
    (value) => {
      setToDate(value);

      setPage(1);

      fetchReport(
        false,
        {
          to: value,
        },
        1
      );
    };

  const handleSearch =
    (value) => {
      setSearch(value);

      setPage(1);
    };

  // =========================================================
  // SEARCH ENTER
  // =========================================================

  const runSearch = () => {
    setPage(1);

    fetchReport(
      false,
      {},
      1
    );
  };

  // =========================================================
  // PAGINATION
  // =========================================================

  const goToPage =
    (nextPage) => {
      const safePage =
        Math.max(
          1,
          Math.min(
            nextPage,
            totalPages
          )
        );

      setPage(
        safePage
      );

      fetchReport(
        false,
        {},
        safePage
      );
    };

  // =========================================================
  // ADD FORM
  // =========================================================

  const openAddForm =
    () => {
      setAddError("");
      setAddSuccess("");

      const ownId =
        currentUser?.id ??
        currentUser?.user_id ??
        "";

      setNewRow({
        assignment_date:
          normalizeDate(
            new Date()
          ),

        employee_id:
          isAdmin
            ? ""
            : String(
                ownId
              ),

        business_name:
          "",

        name: "",

        phone_number:
          "",

        status:
          DEFAULT_STATUS,

        comment: "",
      });

      setShowAddForm(
        true
      );

      setTimeout(() => {
        addFormRef.current?.scrollIntoView(
          {
            behavior:
              "smooth",
            block:
              "start",
          }
        );
      }, 100);
    };

  const closeAddForm =
    () => {
      if (savingNew) return;

      setShowAddForm(
        false
      );

      setAddError("");
      setAddSuccess("");
    };

  const handleNewChange =
    (
      field,
      value
    ) => {
      setNewRow(
        (prev) => ({
          ...prev,
          [field]:
            value,
        })
      );
    };

  // =========================================================
  // CREATE
  // =========================================================

  const handleCreateRow =
    async (event) => {
      event.preventDefault();

      setAddError("");
      setAddSuccess("");

      const ownId =
        currentUser?.id ??
        currentUser?.user_id;

      const employeeId =
        isAdmin
          ? newRow.employee_id
          : String(
              ownId ?? ""
            );

      if (!employeeId) {
        setAddError(
          "Employee select karein."
        );
        return;
      }

      if (
        !newRow.assignment_date
      ) {
        setAddError(
          "Date select karein."
        );
        return;
      }

      if (
        !newRow.status?.trim()
      ) {
        setAddError(
          "Status select karein."
        );
        return;
      }

      if (
        !newRow.phone_number?.trim()
      ) {
        setAddError(
          "Phone number enter karein."
        );
        return;
      }

      setSavingNew(true);

      try {
        const response =
          await fetch(
            "/api/admin/history",
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
                JSON.stringify({
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

        setAddSuccess(
          "New row successfully add ho gayi."
        );

        setNewRow({
          assignment_date:
            normalizeDate(
              new Date()
            ),

          employee_id:
            isAdmin
              ? ""
              : String(
                  ownId ?? ""
                ),

          business_name:
            "",

          name: "",

          phone_number:
            "",

          status:
            DEFAULT_STATUS,

          comment: "",
        });

        /*
         * Reload page 1 because new record
         * can change total and ordering.
         */
        setPage(1);

        await fetchReport(
          false,
          {},
          1
        );

        setTimeout(() => {
          setShowAddForm(
            false
          );

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

  const startEdit =
    (row) => {
      const id =
        getAssignmentId(
          row
        );

      if (!id) return;

      /*
       * IMPORTANT:
       * Both admin and normal user can reach
       * this function.
       *
       * API decides whether the record belongs
       * to the logged-in user.
       */
      setEditingId(id);

      setEditForm({
        assignment_date:
          normalizeDate(
            getDate(row)
          ),

        employee_id:
          String(
            getEmployeeId(
              row
            ) || ""
          ),

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

  const cancelEdit =
    () => {
      setEditingId(null);

      setEditForm({});
    };

  const handleEditChange =
    (
      field,
      value
    ) => {
      setEditForm(
        (prev) => ({
          ...prev,
          [field]:
            value,
        })
      );
    };

  const saveEdit =
    async (row) => {
      const assignmentId =
        getAssignmentId(
          row
        );

      if (!assignmentId)
        return;

      try {
        setError("");

        const response =
          await fetch(
            "/api/admin/history",
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
                  id:
                    assignmentId,

                  assignment_date:
                    editForm.assignment_date,

                  /*
                   * Admin can change employee.
                   * Normal user API will reject
                   * another employee.
                   */
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

        cancelEdit();

        /*
         * Reload current page.
         */
        await fetchReport(
          false,
          {},
          page
        );
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
  // RESET
  // =========================================================

  const resetFilters =
    () => {
      setSearch("");

      setStatusFilter("");

      setEmployeeFilter("");

      setFromDate("");

      setToDate("");

      setPage(1);

      fetchReport(
        false,
        {
          search: "",
          status: "",
          employee_id: "",
          from: "",
          to: "",
        },
        1
      );
    };

  // =========================================================
  // EXPORT CURRENT LOADED RECORDS
  // =========================================================

  const exportCurrentPage =
    () => {
      downloadCSV(
        records
      );
    };

  // =========================================================
  // RANGE
  // =========================================================

  const showingFrom =
    totalRecords === 0
      ? 0
      : (page - 1) *
          PAGE_SIZE +
        1;

  const showingTo =
    totalRecords === 0
      ? 0
      : Math.min(
          (page - 1) *
            PAGE_SIZE +
            currentPageRecords,
          totalRecords
        );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-gray-900">
      <Sidebar
        open={
          sidebarOpen
        }
        setOpen={
          setSidebarOpen
        }
        onLogout={() =>
          setShowLogoutModal(
            true
          )
        }
      />

      <div className="lg:pl-[260px]">
        {/* HEADER */}

        <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-xl">
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSidebarOpen(
                      true
                    )
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm lg:hidden"
                >
                  ☰
                </button>

                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{
                    background:
                      `linear-gradient(135deg, ${ACCENT}, #b91c1c)`,
                  }}
                >
                  <BarChart3
                    size={21}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-extrabold tracking-tight text-gray-950 sm:text-xl">
                      Admin Reports
                    </h1>

                    {isAdmin && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white"
                        style={{
                          backgroundColor:
                            ACCENT,
                        }}
                      >
                        <ShieldCheck
                          size={12}
                        />
                        Admin
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
                    Call activity and task history
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 sm:block">
                  <span className="text-gray-400">
                    Total:
                  </span>{" "}
                  <span className="font-extrabold text-gray-900">
                    {totalRecords.toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    fetchReport(
                      false,
                      {},
                      page
                    )
                  }
                  disabled={
                    refreshing
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
                >
                  <RefreshCw
                    size={16}
                    className={
                      refreshing
                        ? "animate-spin"
                        : ""
                    }
                  />

                  <span className="hidden sm:inline">
                    Refresh
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    exportCurrentPage
                  }
                  disabled={
                    !records.length
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-bold text-gray-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download
                    size={16}
                  />

                  <span className="hidden sm:inline">
                    Export
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    openAddForm
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white shadow-sm"
                  style={{
                    backgroundColor:
                      ACCENT,
                  }}
                >
                  <Plus
                    size={17}
                  />
                  Add New
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-3 py-5 sm:px-5 md:px-7 lg:px-8 lg:py-7">
          {/* SUMMARY */}

          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            <SummaryCard
              label="Total"
              value={
                summary.total
              }
              icon={
                <BarChart3
                  size={17}
                />
              }
              accent="gray"
            />

            <SummaryCard
              label="Follow UP"
              value={
                summary.followUp
              }
              accent="blue"
            />

            <SummaryCard
              label="Call Back"
              value={
                summary.callBack
              }
              accent="purple"
            />

            <SummaryCard
              label="Wrong Num"
              value={
                summary.wrongNum
              }
              accent="red"
            />

            <SummaryCard
              label="Not Interested"
              value={
                summary.notInterested
              }
              accent="orange"
            />

            <SummaryCard
              label="DNC"
              value={
                summary.dnc
              }
              accent="redDark"
            />

            <SummaryCard
              label="No Business"
              value={
                summary.noBusiness
              }
              accent="gray"
            />

            <SummaryCard
              label="Pending"
              value={
                summary.pending
              }
              accent="amber"
            />
          </section>

          {/* ADD FORM */}

          {showAddForm && (
            <section
              ref={
                addFormRef
              }
              className="mb-6 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-red-100 bg-[#fff5f5] px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                    style={{
                      backgroundColor:
                        ACCENT,
                    }}
                  >
                    <Plus
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="font-extrabold text-gray-900">
                      Add New Row
                    </h2>

                    <p className="text-xs text-gray-500">
                      Manually create a new task history record
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    savingNew
                  }
                  onClick={
                    closeAddForm
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600"
                >
                  <X
                    size={15}
                  />
                  Close
                </button>
              </div>

              <form
                onSubmit={
                  handleCreateRow
                }
                className="p-4 sm:p-5"
              >
                {addError && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle
                      size={17}
                    />
                    {addError}
                  </div>
                )}

                {addSuccess && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    <Check
                      size={17}
                    />
                    {addSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <FormField label="Date">
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
                        className="input pl-10"
                        required
                      />
                    </div>
                  </FormField>

                  <FormField label="Employee">
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
                          className="input pl-10"
                          required
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
                                    String(
                                      id
                                    )
                                  }
                                  value={
                                    String(
                                      id
                                    )
                                  }
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
                  </FormField>

                  <FormField label="Business">
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
                        className="input pl-10"
                      />
                    </div>
                  </FormField>

                  <FormField label="Contact">
                    <div className="relative">
                      <UserRound
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="text"
                        value={
                          newRow.name
                        }
                        onChange={(e) =>
                          handleNewChange(
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="Contact name"
                        className="input pl-10"
                      />
                    </div>
                  </FormField>

                  <FormField label="Phone">
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
                        className="input pl-10"
                        required
                      />
                    </div>
                  </FormField>

                  <FormField label="Status">
                    <select
                      value={
                        newRow.status
                      }
                      onChange={(e) =>
                        handleNewChange(
                          "status",
                          e.target.value
                        )
                      }
                      className="input"
                      required
                    >
                      {STATUS_OPTIONS.map(
                        (status) => (
                          <option
                            key={
                              status
                            }
                            value={
                              status
                            }
                          >
                            {status}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
                    <FormField label="Comments">
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
                        className="min-h-[44px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </FormField>
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={
                      savingNew
                    }
                    onClick={
                      closeAddForm
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700"
                  >
                    <X
                      size={16}
                    />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      savingNew
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white disabled:opacity-60"
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
                        <Save
                          size={17}
                        />
                        Save New Row
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* FILTERS */}

          <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                  <Filter
                    size={17}
                  />
                </div>

                <div>
                  <h2 className="text-sm font-extrabold text-gray-900">
                    Filters
                  </h2>

                  <p className="text-xs text-gray-500">
                    Search and filter history records
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500"
              >
                <RotateCcw
                  size={13}
                />
                Reset filters
              </button>
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-2">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={
                      search
                    }
                    onChange={(e) =>
                      handleSearch(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key ===
                        "Enter"
                      ) {
                        runSearch();
                      }
                    }}
                    placeholder="Search business, phone, employee..."
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                  />
                </div>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(e) =>
                    handleStatusFilter(
                      e.target.value
                    )
                  }
                  className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium outline-none"
                >
                  <option value="">
                    All Status
                  </option>

                  {STATUS_OPTIONS.map(
                    (status) => (
                      <option
                        key={
                          status
                        }
                        value={
                          status
                        }
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>

                {isAdmin ? (
                  <div className="relative">
                    <UserRound
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                    />

                    <select
                      value={
                        employeeFilter
                      }
                      onChange={(e) =>
                        handleEmployeeFilter(
                          e.target.value
                        )
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm font-semibold outline-none"
                    >
                      <option value="">
                        All Employees
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
                                String(
                                  id
                                )
                              }
                              value={
                                String(
                                  id
                                )
                              }
                            >
                              {name}
                            </option>
                          );
                        }
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600">
                    <UserRound
                      size={16}
                      className="text-gray-400"
                    />
                    My Records
                  </div>
                )}

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={
                      fromDate
                    }
                    onChange={(e) =>
                      handleFromDate(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm"
                  />
                </div>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={
                      toDate
                    }
                    onChange={(e) =>
                      handleToDate(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm"
                  />
                </div>
              </div>

              {(employeeFilter ||
                statusFilter ||
                fromDate ||
                toDate ||
                search) && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Active:
                  </span>

                  {employeeFilter && (
                    <FilterBadge
                      label="Employee"
                      value={
                        staff.find(
                          (
                            person
                          ) =>
                            String(
                              person.id ??
                                person.user_id
                            ) ===
                            String(
                              employeeFilter
                            )
                        )?.name ||
                        `ID ${employeeFilter}`
                      }
                    />
                  )}

                  {statusFilter && (
                    <FilterBadge
                      label="Status"
                      value={
                        statusFilter
                      }
                    />
                  )}

                  {fromDate && (
                    <FilterBadge
                      label="From"
                      value={formatDate(
                        fromDate
                      )}
                    />
                  )}

                  {toDate && (
                    <FilterBadge
                      label="To"
                      value={formatDate(
                        toDate
                      )}
                    />
                  )}

                  {search && (
                    <FilterBadge
                      label="Search"
                      value={
                        search
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ERROR */}

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle
                size={17}
              />

              <span>
                {error}
              </span>
            </div>
          )}

          {/* TABLE */}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-gray-900">
                    History Records
                  </h2>

                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-600">
                    {totalRecords.toLocaleString()}
                  </span>
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  {totalRecords.toLocaleString()} matching records
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      refreshing
                        ? "#f59e0b"
                        : "#22c55e",
                  }}
                />

                {refreshing
                  ? "Updating..."
                  : "Live"}
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Loader2
                    size={30}
                    className="animate-spin"
                    style={{
                      color:
                        ACCENT,
                    }}
                  />

                  <span className="text-sm font-semibold">
                    Loading records...
                  </span>
                </div>
              </div>
            ) : records.length ===
              0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                  <FileSpreadsheet
                    size={27}
                    className="text-gray-400"
                  />
                </div>

                <h3 className="font-extrabold text-gray-900">
                  No records found
                </h3>

                <p className="mt-1 max-w-md text-sm text-gray-500">
                  No history records match your current filters.
                </p>

                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700"
                >
                  <RotateCcw
                    size={16}
                  />
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                {/* DESKTOP */}

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1250px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left">
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
                          "Action",
                        ].map(
                          (
                            heading
                          ) => (
                            <th
                              key={
                                heading
                              }
                              className="px-3 py-3 text-[11px] font-extrabold uppercase tracking-wide text-gray-500"
                            >
                              {
                                heading
                              }
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {records.map(
                        (
                          row,
                          index
                        ) => {
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
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-3 py-3 align-top text-sm font-bold text-gray-400">
                                {(page -
                                  1) *
                                  PAGE_SIZE +
                                  index +
                                  1}
                              </td>

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
                                    className="h-9 rounded-lg border border-gray-200 px-2 text-xs"
                                  />
                                ) : (
                                  <span className="whitespace-nowrap text-sm font-semibold text-gray-700">
                                    {formatDate(
                                      getDate(
                                        row
                                      )
                                    )}
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-3 align-top">
                                {isEditing &&
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
                                    className="h-9 min-w-[150px] rounded-lg border border-gray-200 px-2 text-xs"
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
                                            value={
                                              String(
                                                id
                                              )
                                            }
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
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
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

                                    <span className="max-w-[140px] truncate text-sm font-bold text-gray-700">
                                      {getUserName(
                                        row
                                      )}
                                    </span>
                                  </div>
                                )}
                              </td>

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
                                    className="h-9 w-[180px] rounded-lg border border-gray-200 px-2 text-xs"
                                  />
                                ) : (
                                  <span
                                    className="block max-w-[180px] truncate text-sm font-bold text-gray-800"
                                    title={getBusiness(
                                      row
                                    )}
                                  >
                                    {getBusiness(
                                      row
                                    ) ||
                                      "—"}
                                  </span>
                                )}
                              </td>

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
                                    className="h-9 w-[145px] rounded-lg border border-gray-200 px-2 text-xs"
                                  />
                                ) : (
                                  <span className="block max-w-[145px] truncate text-sm text-gray-700">
                                    {getName(
                                      row
                                    ) ||
                                      "—"}
                                  </span>
                                )}
                              </td>

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
                                    className="h-9 w-[130px] rounded-lg border border-gray-200 px-2 text-xs"
                                  />
                                ) : (
                                  <span className="whitespace-nowrap text-sm font-semibold text-gray-700">
                                    {formatPhone(
                                      getPhone(
                                        row
                                      )
                                    )}
                                  </span>
                                )}
                              </td>

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
                                    className="h-9 min-w-[135px] rounded-lg border border-gray-200 px-2 text-xs"
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
                                    className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusClasses(
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
                                    className="w-[210px] rounded-lg border border-gray-200 px-2 py-2 text-xs"
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
                                    ) ||
                                      "—"}
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-3 align-top">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                                  <FileSpreadsheet
                                    size={14}
                                  />
                                  {getSheet(
                                    row
                                  ) ||
                                    "—"}
                                </span>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-bold text-gray-600">
                                  <Hash
                                    size={12}
                                  />
                                  {getTaskId(
                                    row
                                  ) ||
                                    "—"}
                                </span>
                              </td>

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
                                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-600"
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
                                  /*
                                   * IMPORTANT:
                                   * NO isAdmin here.
                                   *
                                   * Admin + normal user
                                   * both get Edit button.
                                   *
                                   * API enforces ownership.
                                   */
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

                {/* MOBILE */}

                <div className="divide-y divide-gray-100 md:hidden">
                  {records.map(
                    (
                      row,
                      index
                    ) => {
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
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white"
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
                                <div className="truncate text-sm font-extrabold text-gray-900">
                                  {getBusiness(
                                    row
                                  ) ||
                                    "No Business"}
                                </div>

                                <div className="mt-0.5 truncate text-xs font-medium text-gray-500">
                                  {getUserName(
                                    row
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="shrink-0 text-[11px] font-bold text-gray-400">
                              #
                              {(page -
                                1) *
                                PAGE_SIZE +
                                index +
                                1}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="space-y-3">
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
                                    className="input"
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
                                            value={
                                              String(
                                                id
                                              )
                                            }
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

                              <EditInput
                                label="Date"
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
                              />

                              <EditInput
                                label="Business"
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
                              />

                              <EditInput
                                label="Contact"
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
                              />

                              <EditInput
                                label="Phone"
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
                              />

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
                                  className="input"
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
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
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
                              <div className="grid grid-cols-2 gap-2">
                                <InfoBox
                                  label="Date"
                                  value={formatDate(
                                    getDate(
                                      row
                                    )
                                  )}
                                />

                                <InfoBox
                                  label="Status"
                                  value={
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-extrabold ${statusClasses(
                                        getStatus(
                                          row
                                        )
                                      )}`}
                                    >
                                      {getStatus(
                                        row
                                      )}
                                    </span>
                                  }
                                />

                                <InfoBox
                                  label="Contact"
                                  value={
                                    getName(
                                      row
                                    ) ||
                                    "—"
                                  }
                                />

                                <InfoBox
                                  label="Phone"
                                  value={formatPhone(
                                    getPhone(
                                      row
                                    )
                                  )}
                                />

                                <div className="col-span-2 rounded-xl bg-gray-50 p-3">
                                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">
                                    Comments
                                  </div>

                                  <div className="mt-1 text-sm text-gray-600">
                                    {getComment(
                                      row
                                    ) ||
                                      "—"}
                                  </div>
                                </div>

                                <InfoBox
                                  label="Sheet"
                                  value={
                                    getSheet(
                                      row
                                    ) ||
                                    "—"
                                  }
                                />

                                <InfoBox
                                  label="Task ID"
                                  value={
                                    getTaskId(
                                      row
                                    ) ||
                                    "—"
                                  }
                                />
                              </div>

                              {/*
                               * BOTH ADMIN AND NORMAL USER
                               */
                              }

                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(
                                    row
                                  )
                                }
                                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 shadow-sm"
                              >
                                <Pencil
                                  size={
                                    16
                                  }
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

                {/* PAGINATION */}

                <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-gray-500">
                    Showing{" "}
                    <span className="font-extrabold text-gray-700">
                      {showingFrom.toLocaleString()}
                    </span>{" "}
                    to{" "}
                    <span className="font-extrabold text-gray-700">
                      {showingTo.toLocaleString()}
                    </span>{" "}
                    of{" "}
                    <span className="font-extrabold text-gray-700">
                      {totalRecords.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      disabled={
                        page <= 1 ||
                        refreshing
                      }
                      onClick={() =>
                        goToPage(
                          page - 1
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft
                        size={16}
                      />
                    </button>

                    <div className="flex h-9 min-w-[75px] items-center justify-center rounded-lg bg-gray-100 px-2 text-xs font-extrabold text-gray-700">
                      {page} /{" "}
                      {totalPages}
                    </div>

                    <button
                      type="button"
                      disabled={
                        page >=
                          totalPages ||
                        refreshing
                      }
                      onClick={() =>
                        goToPage(
                          page + 1
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

      {showLogoutModal && (
        <LogoutModal
          open={
            showLogoutModal
          }
          onClose={() =>
            setShowLogoutModal(
              false
            )
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function SummaryCard({
  label,
  value,
  icon,
  accent,
}) {
  const accentClass = {
    gray: "text-gray-900",
    blue: "text-blue-600",
    purple: "text-purple-600",
    red: "text-red-600",
    redDark: "text-red-700",
    orange: "text-orange-600",
    amber: "text-amber-600",
  };

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
          {label}
        </div>

        {icon && (
          <div className="text-gray-300">
            {icon}
          </div>
        )}
      </div>

      <div
        className={`mt-2 text-2xl font-extrabold ${
          accentClass[
            accent
          ] ||
          "text-gray-900"
        }`}
      >
        {Number(
          value || 0
        ).toLocaleString()}
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-extrabold text-gray-600">
        {label}
      </label>

      {children}
    </div>
  );
}

function EditInput({
  label,
  type = "text",
  value,
  onChange,
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-extrabold text-gray-500">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={onChange}
        className="input"
      />
    </div>
  );
}

function InfoBox({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-1 truncate text-sm font-bold text-gray-700">
        {value}
      </div>
    </div>
  );
}

function FilterBadge({
  label,
  value,
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600">
      <span className="text-gray-400">
        {label}:
      </span>

      <span className="max-w-[180px] truncate text-gray-800">
        {value}
      </span>
    </span>
  );
}