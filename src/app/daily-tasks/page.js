"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Upload,
  Users,
  Phone,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  ShieldCheck,
  XCircle,
  X,
  Menu,
  Calendar,
  Search,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Database,
  Layers3,
  Check,
  AlertCircle,
  FileText,
  UserCheck,
  Clock3,
} from "lucide-react";

import Sidebar from "@/components/Sidebar";
import LogoutModal from "@/components/LogoutModal";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

/* =========================================================
   CONFIG
========================================================= */

const DB_NAME = "crm_daily_desk_db_v1";
const DB_VERSION = 1;
const SHEETS_STORE = "sheets";
const META_STORE = "meta";
const LEGACY_STORAGE_KEY = "crm_admin_daily_desk_state_v3";
const PAGE_SIZE = 25;
const ACCENT = "#ec3737";

/* =========================================================
   GENERAL HELPERS
========================================================= */

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/[\s_\-./\\()]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers, aliases) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  const normalizedAliases = aliases.map(normalizeHeader);

  // Exact match first
  for (const alias of normalizedAliases) {
    const found = normalizedHeaders.find(
      (header) => header.normalized === alias
    );

    if (found) return found.original;
  }

  // Partial match second
  for (const alias of normalizedAliases) {
    const found = normalizedHeaders.find(
      (header) =>
        header.normalized.includes(alias) ||
        alias.includes(header.normalized)
    );

    if (found) return found.original;
  }

  return null;
}

/* =========================================================
   PHONE HELPERS
========================================================= */

function normalizePhone(value) {
  let phone = safeString(value);

  if (!phone) return "";

  phone = phone.replace(/[^\d+]/g, "");

  if (phone.startsWith("00")) {
    phone = "+" + phone.slice(2);
  }

  return phone;
}

function phoneDigits(value) {
  return safeString(value).replace(/\D/g, "");
}

function formatPhone(value) {
  const phone = normalizePhone(value);

  if (!phone) return "—";

  const digits = phoneDigits(phone);

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(
      3,
      6
    )}-${digits.slice(6)}`;
  }

  return phone;
}

/* =========================================================
   ACTUAL / SELECTED STATUS
   IMPORTANT:
   This function always tries to show the user's actual
   selected call/result status first.
========================================================= */

function getActualStatus(record) {
  if (!record || typeof record !== "object") {
    return "";
  }

  const possibleStatuses = [
    record.selected_status,
    record.selectedStatus,
    record.assignment_status,
    record.result,
    record.call_status,
    record.disposition,
    record.status,
    record.task_status,
  ];

  for (const value of possibleStatuses) {
    const status = safeString(value);

    if (status) {
      return status;
    }
  }

  return "";
}

/* =========================================================
   WORKFLOW STATUS NORMALIZER

   This does NOT destroy custom statuses.

   Example:
   Completed -> Completed
   Pending -> Pending
   In Progress -> In Progress
   Callback -> Callback
   Follow Up -> Follow Up
   No Answer -> No Answer
   Voicemail -> Voicemail
========================================================= */

function normalizeStatus(value) {
  const status = safeString(value);

  if (!status) return "";

  const normalized = status
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "done"
  ) {
    return "Completed";
  }

  if (
    normalized === "pending" ||
    normalized === "new" ||
    normalized === "notstarted"
  ) {
    return "Pending";
  }

  if (
    normalized === "inprogress" ||
    normalized === "working"
  ) {
    return "In Progress";
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancel"
  ) {
    return "Cancelled";
  }

  // IMPORTANT:
  // Do not convert custom statuses.
  return status;
}

/* =========================================================
   STATUS KEY

   Used for reliable filtering.
========================================================= */

function getStatusKey(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/* =========================================================
   EXCEL DATE
========================================================= */

function excelDateToYMD(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    const year = value.getFullYear();

    const month = String(
      value.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      value.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(
      Date.UTC(1899, 11, 30)
    );

    const date = new Date(
      excelEpoch.getTime() +
        value * 24 * 60 * 60 * 1000
    );

    if (!Number.isNaN(date.getTime())) {
      const year = date.getUTCFullYear();

      const month = String(
        date.getUTCMonth() + 1
      ).padStart(2, "0");

      const day = String(
        date.getUTCDate()
      ).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }
  }

  const raw = safeString(value);

  if (!raw) return "";

  const directMatch = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
  );

  if (directMatch) {
    return `${directMatch[1]}-${String(
      directMatch[2]
    ).padStart(2, "0")}-${String(
      directMatch[3]
    ).padStart(2, "0")}`;
  }

  const usMatch = raw.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  );

  if (usMatch) {
    return `${usMatch[3]}-${String(
      usMatch[1]
    ).padStart(2, "0")}-${String(
      usMatch[2]
    ).padStart(2, "0")}`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(
      parsed.getMonth() + 1
    ).padStart(2, "0")}-${String(
      parsed.getDate()
    ).padStart(2, "0")}`;
  }

  return "";
}

/* =========================================================
   CALIFORNIA DATE
========================================================= */

function getCaliforniaToday() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
}

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(
    `${date}T00:00:00`
  );

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

/* =========================================================
   SHEET HELPERS
========================================================= */

function createSheetId() {
  return `sheet_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeSheetNames(sheets) {
  return sheets.map((sheet, index) => ({
    ...sheet,
    name: `Sheet ${index + 1}`,
    order: index,
  }));
}

/* =========================================================
   INDEXED DB
========================================================= */

function openDailyDeskDB() {
  return new Promise((resolve, reject) => {
    if (
      typeof window === "undefined" ||
      !window.indexedDB
    ) {
      reject(
        new Error(
          "IndexedDB is not supported in this browser."
        )
      );

      return;
    }

    const request = window.indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (
        !db.objectStoreNames.contains(
          SHEETS_STORE
        )
      ) {
        db.createObjectStore(
          SHEETS_STORE,
          {
            keyPath: "id",
          }
        );
      }

      if (
        !db.objectStoreNames.contains(
          META_STORE
        )
      ) {
        db.createObjectStore(
          META_STORE,
          {
            keyPath: "key",
          }
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getAllSheetsFromDB() {
  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      SHEETS_STORE,
      "readonly"
    );

    const store =
      transaction.objectStore(
        SHEETS_STORE
      );

    const request = store.getAll();

    request.onsuccess = () => {
      const rows = Array.isArray(
        request.result
      )
        ? request.result
        : [];

      db.close();

      rows.sort((a, b) => {
        const aOrder = Number.isFinite(
          a.order
        )
          ? a.order
          : 0;

        const bOrder = Number.isFinite(
          b.order
        )
          ? b.order
          : 0;

        return aOrder - bOrder;
      });

      resolve(rows);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function putSheetsToDB(sheets) {
  if (!sheets?.length) return;

  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      SHEETS_STORE,
      "readwrite"
    );

    const store =
      transaction.objectStore(
        SHEETS_STORE
      );

    sheets.forEach((sheet) => {
      store.put(sheet);
    });

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function deleteSheetFromDB(sheetId) {
  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      SHEETS_STORE,
      "readwrite"
    );

    transaction
      .objectStore(SHEETS_STORE)
      .delete(sheetId);

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function replaceAllSheetsInDB(sheets) {
  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      SHEETS_STORE,
      "readwrite"
    );

    const store =
      transaction.objectStore(
        SHEETS_STORE
      );

    store.clear();

    sheets.forEach((sheet) => {
      store.put(sheet);
    });

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function clearSheetsFromDB() {
  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      SHEETS_STORE,
      "readwrite"
    );

    transaction
      .objectStore(SHEETS_STORE)
      .clear();

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getMetaFromDB(key) {
  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      META_STORE,
      "readonly"
    );

    const request =
      transaction
        .objectStore(META_STORE)
        .get(key);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function setMetaInDB(data) {
  const db = await openDailyDeskDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      META_STORE,
      "readwrite"
    );

    transaction
      .objectStore(META_STORE)
      .put(data);

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

/* =========================================================
   LEGACY LOCAL STORAGE MIGRATION
========================================================= */

async function migrateLegacyStorageIfNeeded() {
  try {
    const existingSheets =
      await getAllSheetsFromDB();

    if (existingSheets.length > 0) {
      return null;
    }

    const legacyRaw =
      window.localStorage.getItem(
        LEGACY_STORAGE_KEY
      );

    if (!legacyRaw) {
      return null;
    }

    let legacy;

    try {
      legacy = JSON.parse(legacyRaw);
    } catch {
      window.localStorage.removeItem(
        LEGACY_STORAGE_KEY
      );

      return null;
    }

    if (
      !legacy ||
      !Array.isArray(
        legacy.excelSheets
      ) ||
      legacy.excelSheets.length === 0
    ) {
      window.localStorage.removeItem(
        LEGACY_STORAGE_KEY
      );

      return null;
    }

    const migratedSheets =
      normalizeSheetNames(
        legacy.excelSheets.map(
          (sheet) => ({
            ...sheet,
            id:
              sheet.id ||
              createSheetId(),
          })
        )
      );

    await putSheetsToDB(
      migratedSheets
    );

    await setMetaInDB({
      key: "page",

      selectedSheets:
        Array.isArray(
          legacy.selectedSheets
        )
          ? legacy.selectedSheets
          : migratedSheets.map(
              (sheet) => sheet.id
            ),

      selectedStaff:
        Array.isArray(
          legacy.selectedStaff
        )
          ? legacy.selectedStaff
          : [],

      savedFileName:
        legacy.savedFileName || "",

      selectedDate:
        legacy.selectedDate || "",

      searchQuery:
        legacy.searchQuery || "",

      statusFilter:
        legacy.statusFilter || "all",
    });

    window.localStorage.removeItem(
      LEGACY_STORAGE_KEY
    );

    return migratedSheets;
  } catch {
    return null;
  }
}

/* =========================================================
   EXCEL PROCESSING
========================================================= */

function processSheetRows(rawRows) {
  if (
    !Array.isArray(rawRows) ||
    rawRows.length === 0
  ) {
    return {
      records: [],
      invalidRows: 0,
      duplicateRows: 0,
      missingColumns: [],
      totalRows: 0,
    };
  }

  const headers = Object.keys(
    rawRows[0] || {}
  );

  /* -------------------------------------------------------
     BASIC COLUMNS
  ------------------------------------------------------- */

  const businessNameColumn =
    findColumn(headers, [
      "Business Name",
      "Business",
      "Company Name",
      "Company",
    ]);

  const nameColumn =
    findColumn(headers, [
      "Name",
      "Customer Name",
      "Contact Name",
      "Full Name",
    ]);

  const phoneColumn =
    findColumn(headers, [
      "Phone Number",
      "Phone",
      "Phone No",
      "Phone #",
      "Telephone",
      "Mobile",
    ]);

  const dateColumn =
    findColumn(headers, [
      "Date",
      "Task Date",
      "Due Date",
      "Call Date",
    ]);

  /* -------------------------------------------------------
     IMPORTANT STATUS COLUMN

     Priority:
     1. Selected Status
     2. SelectedStatus
     3. Call Result
     4. Result
     5. Outcome
     6. Call Status
     7. Disposition
     8. Status
     9. Task Status
  ------------------------------------------------------- */

  const statusColumn =
    findColumn(headers, [
      "Selected Status",
      "SelectedStatus",
      "Call Result",
      "Result",
      "Outcome",
      "Call Status",
      "Disposition",
      "Status",
      "Task Status",
    ]);

  const commentColumn =
    findColumn(headers, [
      "Comment",
      "Comments",
      "Note",
      "Notes",
      "Remark",
      "Remarks",
    ]);

  const missingColumns = [];

  if (!businessNameColumn) {
    missingColumns.push(
      "Business Name"
    );
  }

  if (!nameColumn) {
    missingColumns.push("Name");
  }

  if (!phoneColumn) {
    missingColumns.push(
      "Phone Number"
    );
  }

  if (!dateColumn) {
    missingColumns.push("Date");
  }

  if (!statusColumn) {
    missingColumns.push("Status");
  }

  if (missingColumns.length > 0) {
    return {
      records: [],
      invalidRows: rawRows.length,
      duplicateRows: 0,
      missingColumns,
      totalRows: rawRows.length,
    };
  }

  const records = [];
  let invalidRows = 0;
  let duplicateRows = 0;
  const seenPhones = new Set();

  rawRows.forEach((row) => {
    const businessName =
      safeString(
        row[businessNameColumn]
      );

    const name =
      safeString(row[nameColumn]);

    const phone =
      normalizePhone(
        row[phoneColumn]
      );

    const digits =
      phoneDigits(phone);

    const date =
      excelDateToYMD(
        row[dateColumn]
      );

    /*
      DO NOT use normalizeStatus here.

      We want the exact status from Excel:
      Callback
      Follow Up
      No Answer
      Voicemail
      Completed
      Pending
      etc.
    */
    const rawStatus =
      safeString(
        row[statusColumn]
      );

    const selectedStatus =
      rawStatus;

    const comment =
      commentColumn
        ? safeString(
            row[commentColumn]
          )
        : "";

    if (
      !businessName ||
      !name ||
      !phone ||
      digits.length < 10 ||
      !date ||
      !rawStatus
    ) {
      invalidRows += 1;
      return;
    }

    if (seenPhones.has(digits)) {
      duplicateRows += 1;
      return;
    }

    seenPhones.add(digits);

    records.push({
      taskId: null,

      businessName,
      name,

      phoneNumber: phone,
      phone,

      date,

      /*
        EXACT ORIGINAL STATUS
      */
      status: selectedStatus,
      selectedStatus: selectedStatus,
      selected_status: selectedStatus,

      /*
        Optional generic workflow status.
        This is kept separately and does not replace
        the actual selected status.
      */
      taskStatus:
        normalizeStatus(
          selectedStatus
        ),

      comment,
    });
  });

  return {
    records,
    invalidRows,
    duplicateRows,
    missingColumns,
    totalRows: rawRows.length,
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function DailyDeskPage() {
  const router = useRouter();

  const fileInputRef =
    useRef(null);

  const saveMetaTimerRef =
    useRef(null);

  const [file, setFile] =
    useState(null);

  const [
    savedFileName,
    setSavedFileName,
  ] = useState("");

  const [
    excelSheets,
    setExcelSheets,
  ] = useState([]);

  const [
    selectedSheets,
    setSelectedSheets,
  ] = useState([]);

  const [staff, setStaff] =
    useState([]);

  const [
    selectedStaff,
    setSelectedStaff,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    showLogoutModal,
    setShowLogoutModal,
  ] = useState(false);

  const [
    todayStr,
    setTodayStr,
  ] = useState("");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState("");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    storageReady,
    setStorageReady,
  ] = useState(false);

  const [
    storageError,
    setStorageError,
  ] = useState("");

  /* =======================================================
     NORMAL ALERT
  ======================================================= */

  const [alert, setAlert] =
    useState({
      show: false,
      type: "success",
      message: "",
    });

  /* =======================================================
     ASSIGNMENT MODAL
  ======================================================= */

  const [
    assignmentModal,
    setAssignmentModal,
  ] = useState({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  const closeAssignmentModal =
    useCallback(() => {
      setAssignmentModal(
        (previous) => ({
          ...previous,
          show: false,
        })
      );
    }, []);

  const showAssignmentModal =
    useCallback(
      (type, title, text) => {
        setAssignmentModal({
          show: true,
          type,
          title,
          message: text,
        });
      },
      []
    );

  /* =======================================================
     ALERT
  ======================================================= */

  const showAlert =
    useCallback(
      (type, text) => {
        setAlert({
          show: true,
          type,
          message: text,
        });

        window.setTimeout(() => {
          setAlert((previous) => ({
            ...previous,
            show: false,
          }));
        }, 4000);
      },
      []
    );

  /* =======================================================
     INITIAL DATE
  ======================================================= */

  useEffect(() => {
    const today =
      getCaliforniaToday();

    setTodayStr(today);

    setSelectedDate(
      (previous) =>
        previous || today
    );
  }, []);

  /* =======================================================
     LOAD PERSISTENT DATA
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadPersistentData() {
      try {
        setLoading(true);

        await migrateLegacyStorageIfNeeded();

        const [
          dbSheets,
          meta,
        ] = await Promise.all([
          getAllSheetsFromDB(),
          getMetaFromDB("page"),
        ]);

        if (cancelled) return;

        const normalizedSheets =
          normalizeSheetNames(
            dbSheets || []
          );

        if (
          normalizedSheets.length !==
            dbSheets.length ||
          normalizedSheets.some(
            (sheet, index) =>
              sheet.name !==
                `Sheet ${index + 1}` ||
              sheet.order !== index
          )
        ) {
          await replaceAllSheetsInDB(
            normalizedSheets
          );
        }

        setExcelSheets(
          normalizedSheets
        );

        const validIds = new Set(
          normalizedSheets.map(
            (sheet) => sheet.id
          )
        );

        const restoredSelectedSheets =
          Array.isArray(
            meta?.selectedSheets
          )
            ? [
                ...new Set(
                  meta.selectedSheets.filter(
                    (id) =>
                      validIds.has(id)
                  )
                ),
              ]
            : normalizedSheets.map(
                (sheet) => sheet.id
              );

        setSelectedSheets(
          restoredSelectedSheets
        );

        if (
          Array.isArray(
            meta?.selectedStaff
          )
        ) {
          setSelectedStaff(
            meta.selectedStaff
          );
        }

        if (meta?.savedFileName) {
          setSavedFileName(
            meta.savedFileName
          );
        }

        if (meta?.selectedDate) {
          setSelectedDate(
            meta.selectedDate
          );
        }

        if (
          typeof meta?.searchQuery ===
          "string"
        ) {
          setSearchQuery(
            meta.searchQuery
          );
        }

        if (meta?.statusFilter) {
          setStatusFilter(
            meta.statusFilter
          );
        }

        setStorageReady(true);
      } catch (error) {
        console.error(
          "Daily Desk storage load error:",
          error
        );

        if (!cancelled) {
          setStorageReady(true);

          setStorageError(
            "Persistent browser storage could not be initialized. Uploaded sheets may not survive a browser refresh."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPersistentData();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     SAVE PAGE META
  ======================================================= */

  useEffect(() => {
    if (!storageReady) return;

    if (saveMetaTimerRef.current) {
      window.clearTimeout(
        saveMetaTimerRef.current
      );
    }

    saveMetaTimerRef.current =
      window.setTimeout(
        async () => {
          try {
            await setMetaInDB({
              key: "page",

              selectedSheets,

              selectedStaff,

              savedFileName,

              selectedDate,

              searchQuery,

              statusFilter,
            });
          } catch (error) {
            console.error(
              "Daily Desk meta save error:",
              error
            );
          }
        },
        250
      );

    return () => {
      if (
        saveMetaTimerRef.current
      ) {
        window.clearTimeout(
          saveMetaTimerRef.current
        );
      }
    };
  }, [
    storageReady,
    selectedSheets,
    selectedStaff,
    savedFileName,
    selectedDate,
    searchQuery,
    statusFilter,
  ]);

  /* =======================================================
     FETCH STAFF
  ======================================================= */

  const fetchStaff =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/new-users",
              {
                cache: "no-store",
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.message ||
                "Failed to load staff."
            );
          }

          const users =
            Array.isArray(data)
              ? data
              : Array.isArray(
                  data?.users
                )
              ? data.users
              : Array.isArray(
                  data?.data
                )
              ? data.data
              : [];

          const staffUsers =
            users.filter(
              (user) => {
                const role =
                  safeString(
                    user?.role
                  ).toLowerCase();

                return (
                  role === "staff" ||
                  role === "agent"
                );
              }
            );

          setStaff(
            staffUsers
          );
        } catch (error) {
          console.error(
            "Staff fetch error:",
            error
          );

          showAlert(
            "error",
            error.message ||
              "Unable to load staff."
          );
        }
      },
      [showAlert]
    );

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  /* =======================================================
     SELECTED SHEET OBJECTS
  ======================================================= */

  const selectedSheetObjects =
    useMemo(() => {
      const selected =
        new Set(
          selectedSheets
        );

      return excelSheets.filter(
        (sheet) =>
          selected.has(
            sheet.id
          )
      );
    }, [
      excelSheets,
      selectedSheets,
    ]);

  /* =======================================================
     SELECTED SHEET RECORDS
  ======================================================= */

  const selectedSheetRecords =
    useMemo(() => {
      const records = [];

      const globalPhones =
        new Set();

      selectedSheetObjects.forEach(
        (sheet) => {
          const rows =
            Array.isArray(
              sheet.records
            )
              ? sheet.records
              : [];

          rows.forEach((row) => {
            const digits =
              phoneDigits(
                row.phoneNumber ||
                  row.phone
              );

            if (!digits) return;

            if (
              globalPhones.has(
                digits
              )
            ) {
              return;
            }

            globalPhones.add(
              digits
            );

            records.push({
              ...row,

              sourceSheet:
                sheet.name,

              sourceSheetId:
                sheet.id,

              sourceFile:
                sheet.fileName ||
                null,
            });
          });
        }
      );

      return records;
    }, [selectedSheetObjects]);

  const selectedSheetTotals =
    useMemo(() => {
      const rawValidRows =
        selectedSheetObjects.reduce(
          (sum, sheet) =>
            sum +
            Number(sheet.validRows || 0),
          0
        );

      return {
        validRows: selectedSheetRecords.length,
        duplicateRows: Math.max(
          0,
          rawValidRows - selectedSheetRecords.length
        ) +
          selectedSheetObjects.reduce(
            (sum, sheet) =>
              sum +
              Number(sheet.duplicateRows || 0),
            0
          ),
        invalidRows:
          selectedSheetObjects.reduce(
            (sum, sheet) =>
              sum +
              Number(sheet.invalidRows || 0),
            0
          ),
      };
    }, [
      selectedSheetObjects,
      selectedSheetRecords,
    ]);

  /* =======================================================
     FILTERED HISTORY

     IMPORTANT:
     Uses getActualStatus()
     instead of record.status directly.
  ======================================================= */

  const filteredHistory =
    useMemo(() => {
      const query =
        safeString(
          searchQuery
        ).toLowerCase();

      return selectedSheetRecords.filter(
        (record) => {
          const actualStatus =
            getActualStatus(
              record
            );

          const normalizedActualStatus =
            normalizeStatus(
              actualStatus
            );

          /* ----------------------------------------------
             STATUS FILTER
          ---------------------------------------------- */

          if (
            statusFilter !== "all" &&
            getStatusKey(
              normalizedActualStatus
            ) !==
              getStatusKey(
                statusFilter
              )
          ) {
            return false;
          }

          /* ----------------------------------------------
             SEARCH
          ---------------------------------------------- */

          if (!query) {
            return true;
          }

          const searchableText = [
            record.businessName,
            record.name,
            record.phoneNumber,
            record.phone,

            /*
              Search exact selected status
            */
            actualStatus,

            record.selectedStatus,
            record.selected_status,

            record.result,
            record.call_status,
            record.disposition,

            record.comment,

            record.sourceSheet,
            record.sourceFile,
            record.date,
          ]
            .map(safeString)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            query
          );
        }
      );
    }, [
      selectedSheetRecords,
      searchQuery,
      statusFilter,
    ]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredHistory.length /
          PAGE_SIZE
      )
    );

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages
    );

  const paginatedHistory =
    useMemo(() => {
      const start =
        (safeCurrentPage - 1) *
        PAGE_SIZE;

      return filteredHistory.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredHistory,
      safeCurrentPage,
    ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    statusFilter,
    selectedSheets,
  ]);

  /* =======================================================
     HISTORY STATS

     Generic workflow counts are based on the ACTUAL
     selected status.

     Custom statuses remain untouched.
  ======================================================= */

  const historyStats =
    useMemo(() => {
      const rows =
        selectedSheetRecords;

      return {
        total: rows.length,

        completed:
          rows.filter(
            (row) =>
              normalizeStatus(
                getActualStatus(
                  row
                )
              ) ===
              "Completed"
          ).length,

        pending:
          rows.filter(
            (row) =>
              normalizeStatus(
                getActualStatus(
                  row
                )
              ) ===
              "Pending"
          ).length,

        inProgress:
          rows.filter(
            (row) =>
              normalizeStatus(
                getActualStatus(
                  row
                )
              ) ===
              "In Progress"
          ).length,

        cancelled:
          rows.filter(
            (row) =>
              normalizeStatus(
                getActualStatus(
                  row
                )
              ) ===
              "Cancelled"
          ).length,
      };
    }, [selectedSheetRecords]);

  /* =======================================================
     UPLOAD EXCEL
  ======================================================= */

  const handleFileUpload =
    useCallback(
      async (event) => {
        const selectedFile =
          event.target.files?.[0];

        if (!selectedFile) return;

        const extension =
          selectedFile.name
            .split(".")
            .pop()
            ?.toLowerCase();

        const allowedExtensions =
          [
            "xlsx",
            "xls",
            "csv",
          ];

        if (
          !allowedExtensions.includes(
            extension
          )
        ) {
          showAlert(
            "error",
            "Please upload an Excel or CSV file."
          );

          event.target.value = "";

          return;
        }

        try {
          setIsSubmitting(true);
          setMessage("");

          const XLSX =
            await import("xlsx");

          const arrayBuffer =
            await selectedFile.arrayBuffer();

          const workbook =
            XLSX.read(
              arrayBuffer,
              {
                type: "array",
                cellDates: true,
              }
            );

          if (
            !workbook.SheetNames ||
            workbook.SheetNames.length ===
              0
          ) {
            throw new Error(
              "No worksheet was found in this file."
            );
          }

          const baseCount =
            excelSheets.length;

          const newSheets = [];

          workbook.SheetNames.forEach(
            (
              originalSheetName,
              index
            ) => {
              const worksheet =
                workbook.Sheets[
                  originalSheetName
                ];

              const rows =
                XLSX.utils.sheet_to_json(
                  worksheet,
                  {
                    defval: "",
                    raw: true,
                  }
                );

              const processed =
                processSheetRows(
                  rows
                );

              newSheets.push({
                id: createSheetId(),

                name: `Sheet ${
                  baseCount +
                  index +
                  1
                }`,

                order:
                  baseCount +
                  index,

                originalSheetName,

                fileName:
                  selectedFile.name,

                fileSize:
                  selectedFile.size,

                uploadedAt:
                  new Date().toISOString(),

                records:
                  processed.records,

                totalRows:
                  processed.totalRows,

                validRows:
                  processed.records
                    .length,

                invalidRows:
                  processed.invalidRows,

                duplicateRows:
                  processed.duplicateRows,

                missingColumns:
                  processed.missingColumns,
              });
            }
          );

          const combined =
            normalizeSheetNames([
              ...excelSheets,
              ...newSheets,
            ]);

          await putSheetsToDB(
            newSheets
          );

          if (
            combined.length !==
            excelSheets.length +
              newSheets.length
          ) {
            await replaceAllSheetsInDB(
              combined
            );
          }

          setExcelSheets(
            combined
          );

          setSelectedSheets(
            (previous) => [
              ...previous,
              ...newSheets.map(
                (sheet) =>
                  sheet.id
              ),
            ]
          );

          setFile(
            selectedFile
          );

          setSavedFileName(
            selectedFile.name
          );

          const uploadedPhones = new Set();
          let totalNewRows = 0;
          let crossSheetDuplicateRows = 0;

          newSheets.forEach((sheet) => {
            sheet.records.forEach((record) => {
              const digits = phoneDigits(
                record.phoneNumber || record.phone
              );

              if (!digits) return;

              if (uploadedPhones.has(digits)) {
                crossSheetDuplicateRows += 1;
                return;
              }

              uploadedPhones.add(digits);
              totalNewRows += 1;
            });
          });

          const totalInvalidRows =
            newSheets.reduce(
              (sum, sheet) =>
                sum +
                Number(
                  sheet.invalidRows ||
                    0
                ),
              0
            );

          const totalDuplicateRows =
            crossSheetDuplicateRows +
            newSheets.reduce(
              (sum, sheet) =>
                sum +
                Number(sheet.duplicateRows || 0),
              0
            );

          showAlert(
            "success",
            `${newSheets.length} sheet${
              newSheets.length ===
              1
                ? ""
                : "s"
            } added successfully. Existing sheets were preserved.`
          );

          setMessage(
            `${newSheets.length} sheet${
              newSheets.length ===
              1
                ? ""
                : "s"
            } added • ${totalNewRows.toLocaleString()} valid rows • ${totalDuplicateRows.toLocaleString()} duplicate rows skipped • ${totalInvalidRows.toLocaleString()} invalid rows`
          );
        } catch (error) {
          console.error(
            "Excel upload error:",
            error
          );

          showAlert(
            "error",
            error.message ||
              "Unable to process the uploaded file."
          );
        } finally {
          setIsSubmitting(false);

          if (event.target) {
            event.target.value =
              "";
          }
        }
      },
      [excelSheets, showAlert]
    );

  /* =======================================================
     SHEET SELECT
  ======================================================= */

  const toggleSheet =
    useCallback(
      (sheetId) => {
        setSelectedSheets(
          (previous) => {
            if (
              previous.includes(
                sheetId
              )
            ) {
              return previous.filter(
                (id) =>
                  id !== sheetId
              );
            }

            return [
              ...previous,
              sheetId,
            ];
          }
        );
      },
      []
    );

  const selectAllSheets =
    useCallback(() => {
      setSelectedSheets(
        excelSheets.map(
          (sheet) => sheet.id
        )
      );
    }, [excelSheets]);

  const unselectAllSheets =
    useCallback(() => {
      setSelectedSheets([]);
    }, []);

  /* =======================================================
     DELETE SHEET
  ======================================================= */

  const handleDeleteSheet =
    useCallback(
      async (sheetId) => {
        const sheet =
          excelSheets.find(
            (item) =>
              item.id === sheetId
          );

        if (!sheet) return;

        const confirmed =
          window.confirm(
            `${sheet.name} will be removed permanently from this browser. Continue?`
          );

        if (!confirmed) return;

        try {
          await deleteSheetFromDB(
            sheetId
          );

          const remaining =
            normalizeSheetNames(
              excelSheets.filter(
                (item) =>
                  item.id !==
                  sheetId
              )
            );

          await replaceAllSheetsInDB(
            remaining
          );

          setExcelSheets(
            remaining
          );

          setSelectedSheets(
            (previous) =>
              previous.filter(
                (id) =>
                  id !== sheetId
              )
          );

          if (
            file?.name ===
            sheet.fileName
          ) {
            setFile(null);

            const remainingSameFile =
              remaining.some(
                (item) =>
                  item.fileName ===
                  sheet.fileName
              );

            if (
              !remainingSameFile
            ) {
              setSavedFileName(
                ""
              );
            }
          }

          showAlert(
            "success",
            `${sheet.name} removed. Remaining sheets have been renumbered automatically.`
          );
        } catch (error) {
          console.error(
            "Delete sheet error:",
            error
          );

          showAlert(
            "error",
            "Unable to remove this sheet."
          );
        }
      },
      [
        excelSheets,
        file,
        showAlert,
      ]
    );

  /* =======================================================
     CLEAR ALL
  ======================================================= */

  const handleClearAllSheets =
    useCallback(
      async () => {
        if (
          excelSheets.length ===
          0
        ) {
          return;
        }

        const confirmed =
          window.confirm(
            "This will permanently remove all uploaded sheets from this browser. Continue?"
          );

        if (!confirmed) return;

        try {
          await clearSheetsFromDB();

          setExcelSheets([]);
          setSelectedSheets([]);
          setFile(null);
          setSavedFileName("");

          showAlert(
            "success",
            "All uploaded sheets have been removed."
          );
        } catch (error) {
          console.error(
            "Clear sheets error:",
            error
          );

          showAlert(
            "error",
            "Unable to clear uploaded sheets."
          );
        }
      },
      [
        excelSheets.length,
        showAlert,
      ]
    );

  /* =======================================================
     STAFF
  ======================================================= */

  const toggleStaff =
    useCallback(
      (staffId) => {
        const id =
          String(staffId);

        setSelectedStaff(
          (previous) => {
            const normalized =
              previous.map(
                String
              );

            if (
              normalized.includes(
                id
              )
            ) {
              return previous.filter(
                (item) =>
                  String(item) !==
                  id
              );
            }

            return [
              ...previous,
              id,
            ];
          }
        );
      },
      []
    );

  const selectAllStaff =
    useCallback(() => {
      setSelectedStaff(
        staff.map((user) =>
          String(user.id)
        )
      );
    }, [staff]);

  const unselectAllStaff =
    useCallback(() => {
      setSelectedStaff([]);
    }, []);

  /* =======================================================
     CREATE TASK POOLS
  ======================================================= */

  const handleAssignTasks =
    useCallback(
      async () => {
        /* -----------------------------------------------
           VALIDATION
        ----------------------------------------------- */

        if (
          selectedSheetObjects.length ===
          0
        ) {
          showAssignmentModal(
            "error",
            "Assignment Failed",
            "Please select at least one sheet before creating task pools."
          );

          return;
        }

        if (
          selectedSheetRecords.length ===
          0
        ) {
          showAssignmentModal(
            "error",
            "Assignment Failed",
            "Selected sheets do not contain valid records. Please select a sheet with valid task records."
          );

          return;
        }

        if (
          selectedStaff.length ===
          0
        ) {
          showAssignmentModal(
            "error",
            "Assignment Failed",
            "Please select at least one staff member who should receive the tasks."
          );

          return;
        }

        try {
          setIsSubmitting(true);

          const response =
            await fetch(
              "/api/admin/create-task-pools",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  selectedEmployees:
                    selectedStaff,

                  /*
                    IMPORTANT:
                    selectedSheetRecords already
                    contains:
                    status
                    selectedStatus
                    selected_status
                    taskStatus
                  */
                  csvData:
                    selectedSheetRecords,

                  selectedSheets:
                    selectedSheetObjects.map(
                      (sheet) => ({
                        id: sheet.id,

                        name: sheet.name,

                        originalSheetName:
                          sheet.originalSheetName ||
                          null,

                        fileName:
                          sheet.fileName ||
                          null,
                      })
                    ),

                  sourceFile:
                    file?.name ||
                    savedFileName ||
                    null,

                  selectedDate,
                }),
              }
            );

          let data = {};

          try {
            data =
              await response.json();
          } catch {
            data = {};
          }

          if (!response.ok) {
            throw new Error(
              data?.message ||
                data?.error ||
                "Unable to create task pools."
            );
          }

          showAssignmentModal(
            "success",
            "Tasks Assigned Successfully",
            "Your tasks have been successfully assigned."
          );
        } catch (error) {
          console.error(
            "Create task pool error:",
            error
          );

          showAssignmentModal(
            "error",
            "Task Assignment Failed",
            error.message ||
              "Unable to assign tasks. Please try again."
          );
        } finally {
          setIsSubmitting(false);
        }
      },
      [
        selectedSheetObjects,
        selectedSheetRecords,
        selectedStaff,
        file,
        savedFileName,
        selectedDate,
        showAssignmentModal,
      ]
    );

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const sheets =
            await getAllSheetsFromDB();

          const normalized =
            normalizeSheetNames(
              sheets
            );

          await replaceAllSheetsInDB(
            normalized
          );

          setExcelSheets(
            normalized
          );

          const validIds =
            new Set(
              normalized.map(
                (sheet) =>
                  sheet.id
              )
            );

          setSelectedSheets(
            (previous) =>
              previous.filter(
                (id) =>
                  validIds.has(id)
              )
          );

          await fetchStaff();

          showAlert(
            "success",
            "Daily Desk refreshed successfully."
          );
        } catch (error) {
          console.error(
            "Refresh error:",
            error
          );

          showAlert(
            "error",
            "Unable to refresh Daily Desk."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        fetchStaff,
        showAlert,
      ]
    );

  /* =======================================================
     FILTER RESET
  ======================================================= */

  const clearFilters =
    useCallback(() => {
      setSearchQuery("");
      setStatusFilter("all");
      setCurrentPage(1);
    }, []);

  /* =======================================================
     AVAILABLE STATUSES

     IMPORTANT:
     Show exact statuses from records.
  ======================================================= */

  const availableStatuses =
    useMemo(() => {
      const statuses =
        new Set();

      selectedSheetRecords.forEach(
        (row) => {
          const actualStatus =
            getActualStatus(
              row
            );

          if (
            actualStatus
          ) {
            statuses.add(
              actualStatus
            );
          }
        }
      );

      return Array.from(
        statuses
      ).sort(
        (a, b) =>
          a.localeCompare(b)
      );
    }, [
      selectedSheetRecords,
    ]);

  /* =======================================================
     STATUS CLASSES

     Supports standard + call/result statuses.
  ======================================================= */

  function statusClasses(status) {
    const normalized =
      safeString(
        status
      )
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    /* ----------------------------------------------
       WORKFLOW
    ---------------------------------------------- */

    if (
      [
        "completed",
        "complete",
        "done",
      ].includes(normalized)
    ) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (
      [
        "pending",
        "new",
        "notstarted",
      ].includes(normalized)
    ) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }

    if (
      [
        "inprogress",
        "working",
      ].includes(normalized)
    ) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }

    if (
      [
        "cancelled",
        "canceled",
        "cancel",
      ].includes(normalized)
    ) {
      return "bg-red-50 text-red-700 border-red-200";
    }

    /* ----------------------------------------------
       CALL RESULT STATUSES
    ---------------------------------------------- */

    if (
      [
        "callback",
        "callbacklater",
      ].includes(normalized)
    ) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }

    if (
      [
        "followup",
        "follow-up",
      ].includes(normalized)
    ) {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }

    if (
      [
        "noanswer",
      ].includes(normalized)
    ) {
      return "bg-orange-50 text-orange-700 border-orange-200";
    }

    if (
      [
        "voicemail",
        "voicemailleft",
      ].includes(normalized)
    ) {
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    }

    if (
      [
        "busy",
      ].includes(normalized)
    ) {
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    }

    if (
      [
        "wrongnumber",
        "wrongno",
      ].includes(normalized)
    ) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }

    if (
      [
        "interested",
      ].includes(normalized)
    ) {
      return "bg-green-50 text-green-700 border-green-200";
    }

    if (
      [
        "notinterested",
      ].includes(normalized)
    ) {
      return "bg-slate-100 text-slate-700 border-slate-300";
    }

    if (
      [
        "connected",
        "answered",
      ].includes(normalized)
    ) {
      return "bg-teal-50 text-teal-700 border-teal-200";
    }

    /* ----------------------------------------------
       DEFAULT
    ---------------------------------------------- */

    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  /* =======================================================
     LOADER
  ======================================================= */

  if (
    loading &&
    !storageReady
  ) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <Loader />
      </div>
    );
  }




  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        onLogout={() =>
          setShowLogoutModal(true)
        }
      />

      <div className="lg:pl-[260px]">
        {/* =================================================
            MOBILE HEADER
        ================================================= */}

        <div className="lg:hidden sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="h-16 px-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
            >
              <Menu size={20} />
            </button>

            <div className="text-center">
              <div className="font-bold text-sm">
                Daily Desk
              </div>

              <div className="text-[11px] text-slate-500">
                Task Management
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
            >
              <RefreshCw
                size={18}
              />
            </button>
          </div>
        </div>

        {/* =================================================
            MAIN
        ================================================= */}

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto">
          {/* =================================================
              HEADER
          ================================================= */}

          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-7">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{
                    backgroundColor:
                      ACCENT,
                  }}
                >
                  <Layers3
                    size={22}
                  />
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Daily Desk
                  </h1>

                  <p className="text-sm text-slate-500 mt-1">
                    Manage uploaded
                    sheets, records,
                    staff distribution
                    and daily tasks.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <Calendar
                  size={18}
                  className="text-slate-500"
                />

                <div>
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    Task Date
                  </div>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(
                      event
                    ) =>
                      setSelectedDate(
                        event.target
                          .value
                      )
                    }
                    className="text-sm font-semibold bg-transparent outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={
                  handleRefresh
                }
                className="hidden lg:flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-sm hover:bg-slate-50 transition"
              >
                <RefreshCw
                  size={17}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* =================================================
              NORMAL ALERT
          ================================================= */}

          {alert.show && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 flex items-start gap-3 ${
                alert.type ===
                "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
            >
              {alert.type ===
              "error" ? (
                <XCircle
                  size={19}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <CheckCircle2
                  size={19}
                  className="mt-0.5 shrink-0"
                />
              )}

              <div className="text-sm font-medium flex-1">
                {alert.message}
              </div>

              <button
                type="button"
                onClick={() =>
                  setAlert(
                    (
                      previous
                    ) => ({
                      ...previous,
                      show: false,
                    })
                  )
                }
                className="opacity-60 hover:opacity-100"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {/* =================================================
              STORAGE STATUS
          ================================================= */}

          <div
            className={`mb-6 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
              storageError
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                storageError
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {storageError ? (
                <AlertCircle
                  size={18}
                />
              ) : (
                <Database
                  size={18}
                />
              )}
            </div>

            <div className="flex-1">
              <div className="text-sm font-semibold">
                {storageError
                  ? "Browser storage warning"
                  : "Persistent sheet storage active"}
              </div>

              <div className="text-xs text-slate-500 mt-0.5">
                {storageError ||
                  "Uploaded sheets are stored individually in IndexedDB. Refreshing the page will not remove them."}
              </div>
            </div>

            {!storageError && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
                <ShieldCheck
                  size={14}
                />
                IndexedDB
              </div>
            )}
          </div>

          {/* =================================================
              STATS
          ================================================= */}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
            <StatCard
              icon={
                <FileSpreadsheet
                  size={20}
                />
              }
              label="Saved Sheets"
              value={
                excelSheets.length
              }
              description="Persistent uploads"
            />

            <StatCard
              icon={
                <CheckCircle2
                  size={20}
                />
              }
              label="Selected Records"
              value={
                selectedSheetRecords.length
              }
              description="Ready from selected sheets"
            />

            <StatCard
              icon={
                <Users size={20} />
              }
              label="Selected Staff"
              value={
                selectedStaff.length
              }
              description="Agents selected"
            />

            <StatCard
              icon={
                <Clock3
                  size={20}
                />
              }
              label="Filtered History"
              value={
                filteredHistory.length
              }
              description="Current table results"
            />
          </div>

          {/* =================================================
              UPLOAD SECTION
          ================================================= */}

          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-7">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">
                  Upload Daily Sheets
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Add new Excel sheets
                  without replacing
                  previously uploaded
                  data.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <FileSpreadsheet
                  size={15}
                />
                XLSX • XLS • CSV
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <label
                htmlFor="daily-desk-file"
                className="group block cursor-pointer"
              >
                <div className="rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center transition border-slate-200">
                  <div
                    className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4 transition group-hover:scale-105"
                    style={{
                      backgroundColor:
                        "#fff1f1",
                      color: ACCENT,
                    }}
                  >
                    {isSubmitting ? (
                      <Loader2
                        size={27}
                        className="animate-spin"
                      />
                    ) : (
                      <Upload
                        size={27}
                      />
                    )}
                  </div>

                  <div className="text-base font-bold">
                    {isSubmitting
                      ? "Processing workbook..."
                      : "Click to upload your workbook"}
                  </div>

                  <div className="text-sm text-slate-500 mt-2">
                    Each worksheet will
                    be added as a separate
                    sheet.
                  </div>

                  <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
                    <ShieldCheck
                      size={14}
                    />
                    Existing sheets
                    remain untouched
                  </div>
                </div>

                <input
                  id="daily-desk-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={
                    handleFileUpload
                  }
                  disabled={
                    isSubmitting
                  }
                />
              </label>

              {(file ||
                savedFileName) && (
                <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        "#fff1f1",
                      color: ACCENT,
                    }}
                  >
                    <FileText
                      size={18}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {file?.name ||
                        savedFileName}
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5">
                      Saved in browser
                      storage
                    </div>
                  </div>

                  <Check
                    size={18}
                    className="text-emerald-600"
                  />
                </div>
              )}

              {message && (
                <div className="mt-4 text-sm font-medium text-slate-600">
                  {message}
                </div>
              )}
            </div>
          </section>

          {/* =================================================
              SHEETS
          ================================================= */}

          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-7">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers3
                      size={19}
                      style={{
                        color: ACCENT,
                      }}
                    />

                    <h2 className="font-bold text-lg">
                      Select Sheets
                    </h2>
                  </div>

                  <p className="text-sm text-slate-500 mt-1">
                    Choose which uploaded
                    sheets should be
                    included in the task
                    desk.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      selectAllSheets
                    }
                    disabled={
                      excelSheets.length ===
                      0
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={
                      unselectAllSheets
                    }
                    disabled={
                      selectedSheetObjects.length ===
                      0
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    Unselect
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleClearAllSheets
                    }
                    disabled={
                      excelSheets.length ===
                      0
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Trash2
                        size={14}
                      />
                      Clear All
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                <MiniMetric
                  label="Total Sheets"
                  value={
                    excelSheets.length
                  }
                />

                <MiniMetric
                  label="Selected"
                  value={
                    selectedSheetObjects.length
                  }
                />

                <MiniMetric
                  label="Unique Valid Rows"
                  value={selectedSheetTotals.validRows}
                />

                <MiniMetric
                  label="Duplicates Skipped"
                  value={selectedSheetTotals.duplicateRows}
                />

                <MiniMetric
                  label="Invalid Rows"
                  value={selectedSheetTotals.invalidRows}
                />
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {excelSheets.length ===
              0 ? (
                <EmptyState
                  icon={
                    <FileSpreadsheet
                      size={27}
                    />
                  }
                  title="No sheets uploaded yet"
                  description="Upload an Excel workbook to start building your Daily Desk."
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {excelSheets.map(
                    (sheet) => {
                      const selected =
                        selectedSheets.includes(
                          sheet.id
                        );

                      return (
                        <div
                          key={
                            sheet.id
                          }
                          className={`rounded-2xl border p-4 transition ${
                            selected
                              ? "border-red-200 bg-red-50/30 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleSheet(
                                  sheet.id
                                )
                              }
                              className={`h-6 w-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                                selected
                                  ? "text-white border-transparent"
                                  : "bg-white border-slate-300"
                              }`}
                              style={
                                selected
                                  ? {
                                      backgroundColor:
                                        ACCENT,
                                    }
                                  : undefined
                              }
                            >
                              {selected && (
                                <Check
                                  size={
                                    15
                                  }
                                />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="font-bold"
                                    style={{
                                      color:
                                        selected
                                          ? ACCENT
                                          : undefined,
                                    }}
                                  >
                                    {
                                      sheet.name
                                    }
                                  </span>

                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                                    #
                                    {sheet.order +
                                      1}
                                  </span>
                                </div>

                                {selected && (
                                  <span className="w-fit inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                                    <Check
                                      size={
                                        11
                                      }
                                    />
                                    Selected
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-xs text-slate-500 truncate">
                                {
                                  sheet.fileName
                                }
                              </div>

                              <div className="mt-1 text-xs text-slate-400">
                                Excel tab:{" "}
                                <span className="font-semibold text-slate-500">
                                  {sheet.originalSheetName ||
                                    "—"}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteSheet(
                                  sheet.id
                                )
                              }
                              className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 flex items-center justify-center shrink-0"
                              title="Remove sheet"
                            >
                              <Trash2
                                size={
                                  16
                                }
                              />
                            </button>
                          </div>

                          <div className="mt-4 grid grid-cols-4 gap-2">
                            <SheetMetric
                              label="Rows"
                              value={
                                sheet.totalRows
                              }
                            />

                            <SheetMetric
                              label="Valid"
                              value={
                                sheet.validRows
                              }
                              success
                            />

                            <SheetMetric
                              label="Duplicates"
                              value={
                                sheet.duplicateRows
                              }
                            />

                            <SheetMetric
                              label="Invalid"
                              value={
                                sheet.invalidRows
                              }
                              danger={
                                Number(
                                  sheet.invalidRows ||
                                    0
                                ) > 0
                              }
                            />
                          </div>

                          {sheet
                            .missingColumns
                            ?.length >
                            0 && (
                            <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                              <span className="font-bold">
                                Missing
                                columns:
                              </span>{" "}
                              {sheet.missingColumns.join(
                                ", "
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </section>

          {/* =================================================
              STAFF
          ================================================= */}

          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-7">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users
                    size={19}
                    style={{
                      color: ACCENT,
                    }}
                  />

                  <h2 className="font-bold text-lg">
                    Staff Distribution
                  </h2>
                </div>

                <p className="text-sm text-slate-500 mt-1">
                  Select the agents who
                  should receive today's
                  tasks.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={
                    selectAllStaff
                  }
                  disabled={
                    staff.length ===
                    0
                  }
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Select All
                </button>

                <button
                  type="button"
                  onClick={
                    unselectAllStaff
                  }
                  disabled={
                    selectedStaff.length ===
                    0
                  }
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {staff.length ===
              0 ? (
                <EmptyState
                  icon={
                    <Users
                      size={27}
                    />
                  }
                  title="No staff found"
                  description="No staff or agent users are currently available."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {staff.map(
                    (user) => {
                      const selected =
                        selectedStaff.includes(
                          String(
                            user.id
                          )
                        );

                      return (
                        <button
                          key={
                            user.id
                          }
                          type="button"
                          onClick={() =>
                            toggleStaff(
                              user.id
                            )
                          }
                          className={`text-left rounded-2xl border p-4 transition ${
                            selected
                              ? "border-red-200 bg-red-50/40"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                              style={{
                                backgroundColor:
                                  selected
                                    ? "#ffe4e4"
                                    : "#f1f5f9",
                                color:
                                  selected
                                    ? ACCENT
                                    : "#475569",
                              }}
                            >
                              {safeString(
                                user.name
                              )
                                .slice(
                                  0,
                                  2
                                )
                                .toUpperCase() ||
                                "U"}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm truncate">
                                {user.name ||
                                  "Unnamed User"}
                              </div>

                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {user.email ||
                                  user.phone ||
                                  user.role ||
                                  "Staff"}
                              </div>
                            </div>

                            <div
                              className={`h-6 w-6 rounded-lg flex items-center justify-center border ${
                                selected
                                  ? "border-transparent text-white"
                                  : "border-slate-300 text-transparent"
                              }`}
                              style={
                                selected
                                  ? {
                                      backgroundColor:
                                        ACCENT,
                                    }
                                  : undefined
                              }
                            >
                              <Check
                                size={
                                  14
                                }
                              />
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </section>

          {/* =================================================
              READY TO ASSIGN
          ================================================= */}

          <section className="mb-7">
            <div
              className="rounded-3xl p-5 sm:p-6 text-white shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #ec3737 0%, #b91c1c 100%)",
              }}
            >
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCheck
                      size={21}
                    />

                    <h2 className="font-bold text-xl">
                      Ready to Assign
                    </h2>
                  </div>

                  <p className="text-sm text-white/80 mt-1">
                    Review your selection
                    before creating
                    today's task pools.
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <ReadyPill
                      label="Sheets"
                      value={
                          selectedSheetObjects.length
                      }
                    />

                    <ReadyPill
                      label="Records"
                      value={
                        selectedSheetRecords.length
                      }
                    />

                    <ReadyPill
                      label="Staff"
                      value={
                        selectedStaff.length
                      }
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    handleAssignTasks
                  }
                  disabled={
                    isSubmitting ||
                    selectedSheetRecords.length ===
                      0 ||
                    selectedStaff.length ===
                      0
                  }
                  className="w-full xl:w-auto px-6 py-3.5 rounded-2xl bg-white text-red-700 font-bold text-sm shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={18}
                      />
                      Create Task
                      Pools
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* =================================================
              DAILY TASK HISTORY
          ================================================= */}


<section className="bg-white border border-slate-200 rounded-3xl shadow-[0_8px_30px_rgba(15,23,42,0.05)] overflow-hidden">
  {/* =========================================================
      HEADER
  ========================================================= */}

  <div className="px-5 sm:px-6 py-5 border-b border-slate-100">
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: "#fff1f1",
              color: ACCENT,
            }}
          >
            <Clock3 size={18} />
          </div>

          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-slate-900">
              Daily Task History
            </h2>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live Data
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-500 mt-2">
          Showing records from your{" "}
          <span className="font-semibold text-slate-700">
            selected sheets
          </span>
          . Review the latest status and comments updated by users.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* SHEETS */}
        <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Sheets
          </div>

          <div className="text-sm font-bold text-slate-800 mt-0.5">
            {selectedSheetObjects.length}
          </div>
        </div>

        {/* RECORDS */}
        <div className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-100">
          <div className="text-[10px] uppercase tracking-wider font-bold text-red-400">
            Records
          </div>

          <div
            className="text-sm font-bold mt-0.5"
            style={{
              color: ACCENT,
            }}
          >
            {historyStats.total.toLocaleString()}
          </div>
        </div>
      </div>
    </div>

    {/* =========================================================
        STAT CARDS
    ========================================================= */}

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
      <HistoryStat
        label="Total Records"
        value={historyStats.total}
      />

      <HistoryStat
        label="Completed"
        value={historyStats.completed}
        type="success"
      />

      <HistoryStat
        label="Pending"
        value={historyStats.pending}
        type="warning"
      />

      <HistoryStat
        label="In Progress"
        value={historyStats.inProgress}
        type="info"
      />
    </div>
  </div>

  {/* =========================================================
      FILTER BAR
  ========================================================= */}

  <div className="px-5 sm:px-6 py-5 border-b border-slate-100 bg-slate-50/60">
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
      {/* SEARCH */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />

        <input
          type="text"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search business, name, phone, status, sheet, comment..."
          className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setCurrentPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* STATUS FILTER */}
      <div className="relative">
        <Filter
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />

        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setCurrentPage(1);
          }}
          className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none appearance-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
        >
          <option value="all">
            All Statuses
          </option>

          {availableStatuses.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* CLEAR FILTERS */}
      <button
        type="button"
        onClick={clearFilters}
        disabled={
          !searchQuery &&
          statusFilter === "all"
        }
        className="h-12 px-5 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Clear Filters
      </button>
    </div>

    {/* ACTIVE FILTERS */}
    {(searchQuery || statusFilter !== "all") && (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-500">
          Active filters:
        </span>

        {searchQuery && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">
            Search:
            <span className="font-bold text-slate-800">
              “{searchQuery}”
            </span>
          </span>
        )}

        {statusFilter !== "all" && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">
            Status:
            <span className="font-bold text-slate-800">
              {statusFilter}
            </span>
          </span>
        )}
      </div>
    )}

    {/* =========================================================
        SELECTED SHEETS
    ========================================================= */}

    {selectedSheetObjects.length > 0 && (
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
          Selected Sheets
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedSheetObjects.map((sheet) => (
            <div
              key={sheet.id}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm"
            >
              <div
                className="h-6 w-6 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: "#fff1f1",
                  color: ACCENT,
                }}
              >
                <FileSpreadsheet size={13} />
              </div>

              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-700">
                  {sheet.name}
                </div>

                <div className="text-[10px] text-slate-400">
                  {(sheet.records || []).length.toLocaleString()} records
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>

  {/* =========================================================
      TABLE
  ========================================================= */}



<div className="overflow-x-auto">
  {selectedSheetObjects.length === 0 ? (
    <div className="p-8 sm:p-14">
      <EmptyState
        icon={<Layers3 size={27} />}
        title="No sheet selected"
        description="Select one or more sheets above and their records will appear here automatically."
      />
    </div>
  ) : filteredHistory.length === 0 ? (
    <div className="p-8 sm:p-14">
      <EmptyState
        icon={<Search size={27} />}
        title="No matching records"
        description={
          searchQuery || statusFilter !== "all"
            ? "Try changing your search text or status filter."
            : "The selected sheets do not contain any displayable records."
        }
        action={
          searchQuery || statusFilter !== "all"
            ? clearFilters
            : undefined
        }
        actionLabel="Clear Filters"
      />
    </div>
  ) : (
    <table className="w-full min-w-[1200px] text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            #
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Business
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Contact
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Phone
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Task Date
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Status
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Source
          </th>

          <th className="px-5 py-4 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Notes
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {paginatedHistory.map((record, index) => {
          const globalIndex =
            (safeCurrentPage - 1) * PAGE_SIZE + index + 1;

          /* ==========================================================
             CONTACT
          ========================================================== */

          const contactName =
            safeString(record?.name) ||
            safeString(record?.contactName) ||
            safeString(record?.contact_name) ||
            safeString(record?.customerName) ||
            safeString(record?.customer_name) ||
            "Unknown";

          const initials =
            contactName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) =>
                part.charAt(0).toUpperCase()
              )
              .join("") || "—";

          /* ==========================================================
             EXACT USER SAVED STATUS
             
             Priority:
             1. selected_status
             2. selectedStatus
             3. assignment_status
             4. status
             5. result
             6. task_status
             7. call_status
             8. disposition
          ========================================================== */

          const displayStatus =
            getActualStatus(record) || "Pending";

          /* ==========================================================
             PHONE
          ========================================================== */

          const phoneValue =
            safeString(record?.phoneNumber) ||
            safeString(record?.phone_number) ||
            safeString(record?.phone) ||
            safeString(record?.mobile) ||
            "";

          /* ==========================================================
             BUSINESS
          ========================================================== */

          const businessName =
            safeString(record?.businessName) ||
            safeString(record?.business_name) ||
            safeString(record?.companyName) ||
            safeString(record?.company_name) ||
            "—";

          /* ==========================================================
             TASK DATE
          ========================================================== */

          const taskDate =
            record?.assignment_date ||
            record?.taskDate ||
            record?.task_date ||
            record?.date ||
            record?.created_at ||
            "";

          /* ==========================================================
             USER SAVED COMMENT
          ========================================================== */

          const notes =
            safeString(record?.comment) ||
            safeString(record?.comments) ||
            safeString(record?.assignment_comment) ||
            safeString(record?.task_comment) ||
            safeString(record?.notes) ||
            safeString(record?.remarks) ||
            safeString(record?.description) ||
            "";

          /* ==========================================================
             SOURCE
          ========================================================== */

          const sourceSheet =
            safeString(record?.sourceSheet) ||
            safeString(record?.source_sheet) ||
            safeString(record?.sheetName) ||
            safeString(record?.sheet_name) ||
            "—";

          const sourceFile =
            safeString(record?.sourceFile) ||
            safeString(record?.source_file) ||
            safeString(record?.fileName) ||
            safeString(record?.file_name) ||
            "";

          /* ==========================================================
             TASK ID
          ========================================================== */

          const taskId =
            record?.taskId ??
            record?.task_id ??
            record?.master_task_id ??
            record?.id ??
            globalIndex;

          /* ==========================================================
             UNIQUE ROW KEY
          ========================================================== */

          const rowKey = [
            record?.sourceSheetId ??
              record?.source_sheet_id ??
              "sheet",

            record?.assignment_id ??
              record?.daily_assignment_id ??
              taskId,

            phoneValue || "phone",

            taskId,
          ].join("-");

          return (
            <tr
              key={rowKey}
              className="hover:bg-slate-50/80 transition-colors"
            >
              {/* ======================================================
                  #
              ======================================================= */}

              <td className="px-5 py-4">
                <span className="text-xs font-bold text-slate-400">
                  {globalIndex}
                </span>
              </td>

              {/* ======================================================
                  BUSINESS
              ======================================================= */}

              <td className="px-5 py-4">
                <div className="max-w-[240px]">
                  <div
                    className="text-sm font-bold text-slate-800 truncate"
                    title={businessName}
                  >
                    {businessName}
                  </div>

                  {sourceFile && (
                    <div
                      className="text-[11px] text-slate-400 mt-1 truncate"
                      title={sourceFile}
                    >
                      {sourceFile}
                    </div>
                  )}
                </div>
              </td>

              {/* ======================================================
                  CONTACT
              ======================================================= */}

              <td className="px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      backgroundColor: "#fff1f1",
                      color: ACCENT,
                    }}
                  >
                    {initials}
                  </div>

                  <div
                    className="text-sm font-semibold text-slate-700 max-w-[180px] truncate"
                    title={contactName}
                  >
                    {contactName}
                  </div>
                </div>
              </td>

              {/* ======================================================
                  PHONE
              ======================================================= */}

              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Phone
                      size={14}
                      className="text-slate-500"
                    />
                  </div>

                  <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                    {formatPhone(phoneValue)}
                  </span>
                </div>
              </td>

              {/* ======================================================
                  TASK DATE
              ======================================================= */}

              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <Calendar
                    size={14}
                    className="text-slate-400"
                  />

                  <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                    {formatDate(taskDate)}
                  </span>
                </div>
              </td>

              {/* ======================================================
                  EXACT USER SAVED STATUS
              ======================================================= */}

              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${statusClasses(
                    displayStatus
                  )}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />

                  {displayStatus}
                </span>
              </td>

              {/* ======================================================
                  SOURCE
              ======================================================= */}

              <td className="px-5 py-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 whitespace-nowrap">
                  <Layers3 size={13} />

                  {sourceSheet}
                </span>
              </td>

              {/* ======================================================
                  EXACT USER SAVED COMMENT
              ======================================================= */}

              <td className="px-5 py-4">
                <div
                  className="max-w-[280px] truncate text-sm text-slate-500"
                  title={notes || ""}
                >
                  {notes || "—"}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  )}
</div>





  {/* =========================================================
      PAGINATION
  ========================================================= */}

  {filteredHistory.length > 0 && (
    <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-xs text-slate-500">
        Showing{" "}
        <span className="font-bold text-slate-700">
          {(safeCurrentPage - 1) *
              PAGE_SIZE +
            1}
        </span>{" "}
        to{" "}
        <span className="font-bold text-slate-700">
          {Math.min(
            safeCurrentPage * PAGE_SIZE,
            filteredHistory.length
          )}
        </span>{" "}
        of{" "}
        <span className="font-bold text-slate-700">
          {filteredHistory.length}
        </span>{" "}
        records
      </div>

      <div className="flex items-center gap-2">
        {/* PREVIOUS */}
        <button
          type="button"
          onClick={() =>
            setCurrentPage((page) =>
              Math.max(1, page - 1)
            )
          }
          disabled={safeCurrentPage <= 1}
          className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={17} />
        </button>

        {/* PAGE */}
        <div className="min-w-[110px] h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
          Page {safeCurrentPage} of{" "}
          {totalPages}
        </div>

        {/* NEXT */}
        <button
          type="button"
          onClick={() =>
            setCurrentPage((page) =>
              Math.min(
                totalPages,
                page + 1
              )
            )
          }
          disabled={
            safeCurrentPage >= totalPages
          }
          className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )}
</section>

        </main>
      </div>

      {/* =====================================================
          ASSIGNMENT SUCCESS / ERROR MODAL
      ===================================================== */}

      {assignmentModal.show && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-modal-title"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAssignmentModal();
            }
          }}
        >
          {/* BACKDROP */}

          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

          {/* MODAL */}

          <div className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.25)] animate-in fade-in zoom-in-95 duration-200">
            {/* TOP ACCENT */}

            <div
              className="h-1.5 w-full"
              style={{
                backgroundColor:
                  assignmentModal.type ===
                  "error"
                    ? "#dc2626"
                    : "#10b981",
              }}
            />

            <div className="p-6 sm:p-8">
              {/* CLOSE */}

              <button
                type="button"
                onClick={
                  closeAssignmentModal
                }
                className="absolute right-4 top-4 h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              {/* ICON */}

              <div
                className={`mx-auto h-[76px] w-[76px] rounded-[24px] flex items-center justify-center ${
                  assignmentModal.type ===
                  "error"
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {assignmentModal.type ===
                "error" ? (
                  <XCircle
                    size={38}
                    strokeWidth={2}
                  />
                ) : (
                  <CheckCircle2
                    size={38}
                    strokeWidth={2}
                  />
                )}
              </div>

              {/* CONTENT */}

              <div className="text-center mt-6">
                <h3
                  id="assignment-modal-title"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900"
                >
                  {
                    assignmentModal.title
                  }
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {
                    assignmentModal.message
                  }
                </p>
              </div>

              {/* SUCCESS DETAILS */}

              {assignmentModal.type ===
                "success" && (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-lg bg-white flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                      <Check
                        size={15}
                        strokeWidth={
                          3
                        }
                      />
                    </div>

                    <div className="text-left">
                      <div className="text-xs font-bold text-emerald-800">
                        Assignment
                        completed
                      </div>

                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        The selected records
                        have been sent to the
                        selected staff members.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR DETAILS */}

              {assignmentModal.type ===
                "error" && (
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-lg bg-white flex items-center justify-center text-red-600 shrink-0 shadow-sm">
                      <AlertCircle
                        size={16}
                      />
                    </div>

                    <div className="text-left">
                      <div className="text-xs font-bold text-red-800">
                        Please review
                        the error
                      </div>

                      <div className="text-[11px] text-red-700 mt-0.5 leading-5 break-words">
                        The task assignment
                        could not be completed.
                        You can close this
                        message and try again.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BUTTON */}

              <button
                type="button"
                onClick={
                  closeAssignmentModal
                }
                className={`w-full mt-6 h-12 rounded-2xl text-sm font-bold text-white shadow-sm transition ${
                  assignmentModal.type ===
                  "error"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {assignmentModal.type ===
                "error"
                  ? "Close"
                  : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          LOGOUT
      ===================================================== */}

      {showLogoutModal && (
        <LogoutModal
          onClose={() =>
            setShowLogoutModal(false)
          }
          onConfirm={() => {
            setShowLogoutModal(false);
            router.push("/login");
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  label,
  value,
  description,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">
            {label}
          </div>

          <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {Number(
              value || 0
            ).toLocaleString()}
          </div>

          <div className="text-[11px] text-slate-400 mt-1">
            {description}
          </div>
        </div>

        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor:
              "#fff1f1",
            color: ACCENT,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MINI METRIC
========================================================= */

function MiniMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
        {label}
      </div>

      <div className="text-lg font-bold text-slate-800 mt-1">
        {Number(
          value || 0
        ).toLocaleString()}
      </div>
    </div>
  );
}

/* =========================================================
   SHEET METRIC
========================================================= */

function SheetMetric({
  label,
  value,
  success,
  danger,
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2 border ${
        success
          ? "bg-emerald-50 border-emerald-100"
          : danger
          ? "bg-red-50 border-red-100"
          : "bg-slate-50 border-slate-100"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
        {label}
      </div>

      <div
        className={`text-sm font-bold mt-0.5 ${
          success
            ? "text-emerald-700"
            : danger
            ? "text-red-700"
            : "text-slate-700"
        }`}
      >
        {Number(
          value || 0
        ).toLocaleString()}
      </div>
    </div>
  );
}

/* =========================================================
   HISTORY STAT
========================================================= */

function HistoryStat({
  label,
  value,
  type = "default",
}) {
  const classes = {
    default:
      "bg-slate-50 border-slate-100 text-slate-700",

    success:
      "bg-emerald-50 border-emerald-100 text-emerald-700",

    warning:
      "bg-amber-50 border-amber-100 text-amber-700",

    info:
      "bg-blue-50 border-blue-100 text-blue-700",
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${classes[type]}`}
    >
      <div className="text-[10px] uppercase tracking-wide font-bold opacity-60">
        {label}
      </div>

      <div className="text-lg font-bold mt-1">
        {Number(
          value || 0
        ).toLocaleString()}
      </div>
    </div>
  );
}

/* =========================================================
   READY PILL
========================================================= */

function ReadyPill({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/60 font-bold">
        {label}
      </div>

      <div className="text-base font-bold mt-0.5">
        {Number(
          value || 0
        ).toLocaleString()}
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-5">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
        {icon}
      </div>

      <h3 className="font-bold text-slate-800 mt-4">
        {title}
      </h3>

      <p className="text-sm text-slate-500 max-w-md mt-1.5">
        {description}
      </p>

      {action && (
        <button
          type="button"
          onClick={action}
          className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
        >
          {actionLabel ||
            "Continue"}
        </button>
      )}
    </div>
  );
}