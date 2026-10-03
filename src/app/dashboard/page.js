"use client";

import {
  Phone,
  Menu,
  X,
  Clock,
  PhoneIncoming,
  PhoneOff,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Radio,
} from "lucide-react";

import LogoutModal from "../../components/LogoutModal";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import Sidebar from "@/components/Sidebar";
import DashboardTopBar from "@/components/DashboardTopBar";

const CALIFORNIA_TZ = "America/Los_Angeles";

const LIVE_REFRESH_MS = 60 * 1000;
const CALIFORNIA_CLOCK_MS = 1000;

/* =========================================================
   CALIFORNIA DATE HELPERS
========================================================= */

function getCaliforniaDateString(date = new Date()) {
  const parsedDate =
    date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALIFORNIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsedDate);
}

function getCaliforniaToday() {
  return getCaliforniaDateString(new Date());
}

function getCaliforniaTimeString(date = new Date()) {
  const parsedDate =
    date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parsedDate);
}

function shiftCalendarDate(dateString, days) {
  if (!dateString) return "";

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return "";
  }

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function getPrevious7DaysDate() {
  const today = getCaliforniaToday();

  return shiftCalendarDate(today, -6);
}

/* =========================================================
   CALENDAR DATE RANGE
========================================================= */

function buildDateKeys(from, to) {
  if (!from || !to || from > to) {
    return [];
  }

  const result = [];

  const cursor = new Date(
    `${from}T12:00:00Z`
  );

  const end = new Date(
    `${to}T12:00:00Z`
  );

  if (
    Number.isNaN(cursor.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return [];
  }

  while (cursor <= end) {
    result.push(
      cursor.toISOString().slice(0, 10)
    );

    cursor.setUTCDate(
      cursor.getUTCDate() + 1
    );
  }

  return result;
}

function formatChartDate(dateKey) {
  if (!dateKey) return "";

  const date = new Date(
    `${dateKey}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/* =========================================================
   SKELETON
========================================================= */

function DashboardSkeleton() {
  const SkeletonBlock = ({
    className = "",
  }) => (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );

  return (
    <div
      className="space-y-6"
      aria-label="Loading dashboard"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-9 w-44" />
          <SkeletonBlock className="h-4 w-64 max-w-full" />
        </div>

        <div className="flex flex-wrap gap-3">
          <SkeletonBlock className="h-11 w-44" />
          <SkeletonBlock className="h-11 w-44" />
          <SkeletonBlock className="h-11 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <div
              key={index}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-9 w-16" />
                </div>

                <SkeletonBlock className="h-11 w-11 rounded-xl" />
              </div>

              <SkeletonBlock className="mt-5 h-3 w-36" />
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-[330px] rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 xl:col-span-2">
          <SkeletonBlock className="h-6 w-36" />
          <SkeletonBlock className="mt-2 h-4 w-28" />

          <div className="mt-8 flex h-[210px] items-end gap-4">
            {Array.from({ length: 7 }).map(
              (_, index) => (
                <SkeletonBlock
                  key={index}
                  className={`w-full max-w-[42px] rounded-t-xl ${
                    [
                      "h-20",
                      "h-32",
                      "h-24",
                      "h-40",
                      "h-28",
                      "h-36",
                      "h-16",
                    ][index]
                  }`}
                />
              )
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <SkeletonBlock className="h-6 w-32" />
          <SkeletonBlock className="mt-2 h-4 w-36" />

          <SkeletonBlock className="mx-auto mt-8 h-48 w-48 rounded-full" />

          <div className="mt-7 grid grid-cols-2 gap-3">
            <SkeletonBlock className="h-16 rounded-xl" />
            <SkeletonBlock className="h-16 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map(
          (_, cardIndex) => (
            <div
              key={cardIndex}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"
            >
              <SkeletonBlock className="h-6 w-32" />
              <SkeletonBlock className="mt-2 h-4 w-44" />

              <div className="mt-6 space-y-3">
                {Array.from({ length: 4 }).map(
                  (_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex items-center justify-between rounded-xl border border-gray-100 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <SkeletonBlock className="h-10 w-10 rounded-full" />

                        <div className="space-y-2">
                          <SkeletonBlock className="h-4 w-28" />
                          <SkeletonBlock className="h-3 w-20" />
                        </div>
                      </div>

                      <SkeletonBlock className="h-4 w-14" />
                    </div>
                  )
                )}
              </div>
            </div>
          )
        )}
      </div>

      <SkeletonBlock className="h-20 rounded-2xl" />
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [liveRefreshing, setLiveRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [staff, setStaff] = useState(null);
  const [allStaff, setAllStaff] = useState([]);

  const [rawApiResponse, setRawApiResponse] =
    useState(null);

  const [numbers, setNumbers] = useState([]);
  const [calls, setCalls] = useState([]);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  /* =======================================================
     CALIFORNIA CLOCK
  ======================================================= */

  const [
    currentCaliforniaTime,
    setCurrentCaliforniaTime,
  ] = useState(() =>
    getCaliforniaTimeString()
  );

  const [
    currentCaliforniaDate,
    setCurrentCaliforniaDate,
  ] = useState(() =>
    getCaliforniaToday()
  );

  /* =======================================================
     DATE FILTER
  ======================================================= */

  const [startDate, setStartDate] =
    useState(() =>
      getPrevious7DaysDate()
    );

  const [endDate, setEndDate] =
    useState(() =>
      getCaliforniaToday()
    );

  /* =======================================================
     REFS
  ======================================================= */

  const initialLoadDoneRef =
    useRef(false);

  const previousRangeRef = useRef(
    `${getPrevious7DaysDate()}|${getCaliforniaToday()}`
  );

  const requestIdRef = useRef(0);

  const liveRequestRef =
    useRef(false);

  /* =======================================================
     CALIFORNIA CLOCK
  ======================================================= */

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();

      setCurrentCaliforniaTime(
        getCaliforniaTimeString(now)
      );

      setCurrentCaliforniaDate(
        getCaliforniaDateString(now)
      );
    };

    updateClock();

    const interval = setInterval(
      updateClock,
      CALIFORNIA_CLOCK_MS
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* =======================================================
     NORMALIZE EXTENSION
  ======================================================= */

  const normalizeExtension =
    useCallback((value) => {
      if (
        value === undefined ||
        value === null
      ) {
        return null;
      }

      let cleaned = String(value)
        .trim()
        .toLowerCase();

      cleaned = cleaned
        .replace(
          /^extension[\s:._-]*/i,
          ""
        )
        .replace(
          /^ext[\s:._-]*/i,
          ""
        )
        .trim();

      if (!cleaned) {
        return null;
      }

      /*
       * 804.0 -> 804
       * 804.00 -> 804
       */
      if (
        /^\d+\.\d+$/.test(cleaned)
      ) {
        const [
          numberPart,
          decimalPart,
        ] = cleaned.split(".");

        if (/^0+$/.test(decimalPart)) {
          cleaned = numberPart;
        }
      }

      cleaned = cleaned.replace(
        /[^0-9a-z_-]/g,
        ""
      );

      return cleaned || null;
    }, []);

  /* =======================================================
     GET CALL LIST
  ======================================================= */

  const getCallList = useCallback(
    (data) => {
      if (!data) return [];

      if (Array.isArray(data)) {
        return data;
      }

      const possibleKeys = [
        "calls",
        "call_history",
        "callHistory",
        "call_logs",
        "callLogs",
        "history",
        "records",
        "results",
        "items",
        "rows",
        "logs",
        "data",
      ];

      for (const key of possibleKeys) {
        if (
          Array.isArray(data?.[key])
        ) {
          return data[key];
        }
      }

      if (
        data?.data &&
        typeof data.data === "object"
      ) {
        if (Array.isArray(data.data)) {
          return data.data;
        }

        for (const key of possibleKeys) {
          if (
            Array.isArray(
              data.data?.[key]
            )
          ) {
            return data.data[key];
          }
        }
      }

      if (
        data?.response &&
        typeof data.response === "object"
      ) {
        if (
          Array.isArray(data.response)
        ) {
          return data.response;
        }

        for (const key of possibleKeys) {
          if (
            Array.isArray(
              data.response?.[key]
            )
          ) {
            return data.response[key];
          }
        }
      }

      if (
        data?.result &&
        typeof data.result === "object"
      ) {
        if (
          Array.isArray(data.result)
        ) {
          return data.result;
        }

        for (const key of possibleKeys) {
          if (
            Array.isArray(
              data.result?.[key]
            )
          ) {
            return data.result[key];
          }
        }
      }

      return [];
    },
    []
  );

  /* =======================================================
     GET CALL DATE
  ======================================================= */

  const getCallDate = useCallback(
    (call) => {
      if (!call) return null;

      const value =
        call?.start_time ||
        call?.startTime ||
        call?.start_datetime ||
        call?.startDateTime ||
        call?.date_time ||
        call?.datetime ||
        call?.created_at ||
        call?.createdAt ||
        call?.timestamp ||
        call?.time ||
        call?.date;

      if (!value) return null;

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    },
    []
  );

  /* =======================================================
     GET DURATION
  ======================================================= */

  const getDurationSeconds =
    useCallback((call) => {
      if (!call) return 0;

      const value =
        call?.duration_seconds ??
        call?.durationSeconds ??
        call?.duration ??
        call?.talk_time ??
        call?.talkTime ??
        call?.seconds ??
        call?.duration_sec ??
        0;

      if (typeof value === "number") {
        return Number.isFinite(value)
          ? value
          : 0;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();

        const timeMatch =
          trimmed.match(
            /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/
          );

        if (timeMatch) {
          return (
            Number(timeMatch[1]) *
              3600 +
            Number(timeMatch[2]) * 60 +
            Number(timeMatch[3])
          );
        }

        const shortTimeMatch =
          trimmed.match(
            /^(\d{1,3}):(\d{1,2})$/
          );

        if (shortTimeMatch) {
          return (
            Number(shortTimeMatch[1]) *
              60 +
            Number(shortTimeMatch[2])
          );
        }

        const hMatch =
          trimmed.match(
            /(\d+)\s*h/i
          );

        const mMatch =
          trimmed.match(
            /(\d+)\s*m/i
          );

        const sMatch =
          trimmed.match(
            /(\d+)\s*s/i
          );

        if (
          hMatch ||
          mMatch ||
          sMatch
        ) {
          return (
            Number(
              hMatch?.[1] || 0
            ) *
              3600 +
            Number(
              mMatch?.[1] || 0
            ) *
              60 +
            Number(
              sMatch?.[1] || 0
            )
          );
        }

        const numeric =
          Number(trimmed);

        if (!Number.isNaN(numeric)) {
          return numeric;
        }
      }

      return 0;
    }, []);

  /* =======================================================
     GET STATUS
  ======================================================= */

  const getCallStatus = useCallback(
    (call) => {
      if (!call) return "missed";

      const raw =
        call?.status ??
        call?.call_status ??
        call?.callStatus ??
        call?.result ??
        call?.disposition ??
        call?.connect_type ??
        call?.connectType ??
        "";

      const status = String(raw)
        .toLowerCase()
        .trim();

      if (
        status.includes("miss") ||
        status.includes("no answer") ||
        status.includes("no_answer") ||
        status.includes("unanswered") ||
        status.includes("failed") ||
        status.includes("cancel") ||
        status.includes("busy") ||
        status.includes("voicemail")
      ) {
        return "missed";
      }

      if (
        status.includes("answer") ||
        status.includes("answered") ||
        status.includes("completed") ||
        status.includes("connected") ||
        status.includes("success")
      ) {
        return "answered";
      }

      if (
        getDurationSeconds(call) > 0
      ) {
        return "answered";
      }

      return "missed";
    },
    [getDurationSeconds]
  );

  /* =======================================================
     GET STAFF NAME
  ======================================================= */

  const getStaffName = useCallback(
    (call) => {
      if (!call) {
        return "Unknown Staff";
      }

      const name =
        call?.user_name ||
        call?.userName ||
        call?.agent_name ||
        call?.agentName ||
        call?.staff_name ||
        call?.staffName ||
        call?.owner_name ||
        call?.ownerName ||
        call?.extension_name ||
        call?.extensionName ||
        call?.caller_name ||
        call?.callerName ||
        call?.from_name ||
        call?.fromName ||
        call?.display_name ||
        call?.displayName ||
        call?.user?.name ||
        call?.agent?.name ||
        call?.staff?.name ||
        call?.owner?.name ||
        "";

      return name
        ? String(name)
        : "Unknown Staff";
    },
    []
  );

  /* =======================================================
     GET DIRECTION
  ======================================================= */

  const getCallDirection =
    useCallback((call) => {
      const raw =
        call?.direction ||
        call?.call_direction ||
        call?.callDirection ||
        call?.type ||
        call?.call_type ||
        call?.callType ||
        "";

      const direction = String(raw)
        .toLowerCase()
        .trim();

      if (
        direction === "in" ||
        direction === "incoming" ||
        direction.includes("inbound") ||
        direction.includes("incoming")
      ) {
        return "inbound";
      }

      if (
        direction === "out" ||
        direction === "outgoing" ||
        direction.includes("outbound") ||
        direction.includes("outgoing")
      ) {
        return "outbound";
      }

      return "";
    }, []);

  /* =======================================================
     GET OWNER EXTENSION

     crm_extension = PRIMARY OWNER
  ======================================================= */

  const getCallOwnerExtension =
    useCallback(
      (call) => {
        if (!call) return null;

        /*
         * FIRST PRIORITY:
         * API calculated CRM extension.
         */
        const apiExtension =
          normalizeExtension(
            call?.crm_extension
          );

        if (apiExtension) {
          return apiExtension;
        }

        /*
         * SECOND:
         * Existing owner extension.
         */
        const ownerExtension =
          normalizeExtension(
            call?.owner_extension
          );

        if (ownerExtension) {
          return ownerExtension;
        }

        const direction =
          getCallDirection(call);

        /*
         * CALLER EXTENSION
         */

        const callerExtension =
          normalizeExtension(
            call?.caller_extension
          ) ||
          normalizeExtension(
            call?.caller_ext_number
          ) ||
          normalizeExtension(
            call?.caller_ext
          ) ||
          normalizeExtension(
            call?.callerExtension
          ) ||
          normalizeExtension(
            call?.caller?.extension
          ) ||
          normalizeExtension(
            call?.caller?.extension_number
          ) ||
          normalizeExtension(
            call?.caller?.extensionNumber
          ) ||
          normalizeExtension(
            call?.caller?.ext
          ) ||
          normalizeExtension(
            call?.caller?.ext_number
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.caller
              ?.extension
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.caller
              ?.extension_number
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.caller
              ?.extensionNumber
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.caller?.ext
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.caller
              ?.ext_number
          );

        /*
         * CALLEE EXTENSION
         */

        const receiverExtension =
          normalizeExtension(
            call?.receiver_extension
          ) ||
          normalizeExtension(
            call?.receiver_ext_number
          ) ||
          normalizeExtension(
            call?.receiver_ext
          ) ||
          normalizeExtension(
            call?.receiverExtension
          ) ||
          normalizeExtension(
            call?.callee_extension
          ) ||
          normalizeExtension(
            call?.callee_ext_number
          ) ||
          normalizeExtension(
            call?.callee_ext
          ) ||
          normalizeExtension(
            call?.calleeExtension
          ) ||
          normalizeExtension(
            call?.callee?.extension
          ) ||
          normalizeExtension(
            call?.callee?.extension_number
          ) ||
          normalizeExtension(
            call?.callee?.extensionNumber
          ) ||
          normalizeExtension(
            call?.callee?.ext
          ) ||
          normalizeExtension(
            call?.callee?.ext_number
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.callee
              ?.extension
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.callee
              ?.extension_number
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.callee
              ?.extensionNumber
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.callee?.ext
          ) ||
          normalizeExtension(
            call?.raw_zoom_data?.callee
              ?.ext_number
          );

        /*
         * INBOUND:
         * CRM user = callee
         */

        if (direction === "inbound") {
          return (
            receiverExtension ||
            callerExtension ||
            null
          );
        }

        /*
         * OUTBOUND:
         * CRM user = caller
         */

        if (direction === "outbound") {
          return (
            callerExtension ||
            receiverExtension ||
            null
          );
        }

        /*
         * UNKNOWN
         */

        return (
          normalizeExtension(
            call?.extension
          ) ||
          normalizeExtension(
            call?.extension_number
          ) ||
          normalizeExtension(
            call?.user_extension
          ) ||
          callerExtension ||
          receiverExtension ||
          null
        );
      },
      [
        getCallDirection,
        normalizeExtension,
      ]
    );

  /* =======================================================
     STAFF EXTENSION MAP
  ======================================================= */

  const staffByExtension =
    useMemo(() => {
      const map = new Map();

      if (!Array.isArray(allStaff)) {
        return map;
      }

      for (const user of allStaff) {
        const extension =
          normalizeExtension(
            user?.zoom_extension
          );

        if (extension) {
          map.set(extension, user);
        }
      }

      return map;
    }, [
      allStaff,
      normalizeExtension,
    ]);

  /* =======================================================
     CURRENT USER
  ======================================================= */

  const loadCurrentUser =
    useCallback(async () => {
      const res = await fetch(
        "/api/auth/me",
        {
          cache: "no-store",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to load current user."
        );
      }

      const currentUser =
        data?.user ||
        data?.data ||
        data;

      setStaff(currentUser);
    }, []);

  /* =======================================================
     STAFF LIST
  ======================================================= */

  const loadStaffList =
    useCallback(async () => {
      try {
        const res = await fetch(
          "/api/staffes/list",
          {
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

        const contentType =
          res.headers.get(
            "content-type"
          ) || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "Staff API returned a non-JSON response."
          );
        }

        const data =
          await res.json();

        if (!res.ok) {
          setAllStaff([]);
          return;
        }

        const staffList =
          data?.staff ||
          data?.users ||
          data?.data ||
          data?.results ||
          [];

        setAllStaff(
          Array.isArray(staffList)
            ? staffList
            : []
        );
      } catch (error) {
        console.error(
          "STAFF LIST ERROR:",
          error
        );

        setAllStaff([]);
      }
    }, []);

  /* =======================================================
     DAILY DESK
  ======================================================= */

  const loadDailyDesk =
    useCallback(async () => {
      try {
        const res = await fetch(
          "/api/staff/daily",
          {
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

        const contentType =
          res.headers.get(
            "content-type"
          ) || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "Daily desk API returned a non-JSON response."
          );
        }

        const data =
          await res.json();

        if (!res.ok) {
          setNumbers([]);
          return;
        }

        const deskNumbers =
          data?.numbers ||
          data?.data ||
          data?.extensions ||
          [];

        setNumbers(
          Array.isArray(deskNumbers)
            ? deskNumbers
            : []
        );
      } catch (error) {
        console.error(
          "DAILY DESK ERROR:",
          error
        );

        setNumbers([]);
      }
    }, []);

  /* =======================================================
     FETCH CALL HISTORY

     IMPORTANT:
     NO DEDUPLICATION HERE.
     Every API record remains a separate call.
  ======================================================= */

  const fetchCallHistory =
    useCallback(
      async ({
        from,
        to,
        mode = "full",
        signal,
      }) => {
        const params =
          new URLSearchParams();

        params.set("from", from);
        params.set("to", to);
        params.set("mode", mode);

        const url =
          `/api/zoom/call-history?${params.toString()}`;

        const response =
          await fetch(url, {
            method: "GET",
            cache: "no-store",
            signal,
            headers: {
              Accept:
                "application/json",
            },
          });

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "Call history API returned a non-JSON response."
          );
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Failed to load Zoom call history."
          );
        }

        /*
         * IMPORTANT:
         * Directly return API array.
         * NO Set.
         * NO Map.
         * NO unique filtering.
         * NO phone filtering.
         * NO ID filtering.
         */

        return {
          data,
          calls: getCallList(data),
        };
      },
      [getCallList]
    );

  /* =======================================================
     LOAD FULL CALL HISTORY
  ======================================================= */

  const loadCallHistory =
    useCallback(
      async (showSpinner = false) => {
        if (
          !startDate ||
          !endDate ||
          startDate > endDate
        ) {
          return;
        }

        const currentRequestId =
          ++requestIdRef.current;

        try {
          if (showSpinner) {
            setRefreshing(true);
          }

          setErrorMessage("");

          const result =
            await fetchCallHistory({
              from: startDate,
              to: endDate,
              mode: "full",
            });

          if (
            currentRequestId !==
            requestIdRef.current
          ) {
            return;
          }

          /*
           * Keep complete API response
           * for debug information.
           */
          setRawApiResponse(
            result.data
          );

          /*
           * IMPORTANT:
           * Store EVERY record.
           * No dedupe.
           */
          setCalls(
            Array.isArray(result.calls)
              ? result.calls
              : []
          );
        } catch (error) {
          if (
            error?.name ===
            "AbortError"
          ) {
            return;
          }

          console.error(
            "CALL HISTORY ERROR:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Unable to load call history."
          );
        } finally {
          if (showSpinner) {
            setRefreshing(false);
          }
        }
      },
      [
        startDate,
        endDate,
        fetchCallHistory,
      ]
    );

  /* =======================================================
     LIVE TODAY REFRESH

     IMPORTANT:
     NEVER USE MAP / UNIQUE KEY.

     Historical calls remain.
     Today's old calls are replaced by
     today's complete API response.

     Duplicate records are preserved.
  ======================================================= */

  const loadTodayLiveCalls =
    useCallback(async () => {
      if (liveRequestRef.current) {
        return;
      }

      if (
        !startDate ||
        !endDate
      ) {
        return;
      }

      const today =
        getCaliforniaToday();

      if (
        today < startDate ||
        today > endDate
      ) {
        return;
      }

      liveRequestRef.current = true;

      const currentRequestId =
        ++requestIdRef.current;

      try {
        setLiveRefreshing(true);

        const result =
          await fetchCallHistory({
            from: today,
            to: today,
            mode: "live",
          });

        if (
          currentRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        const todayCalls =
          Array.isArray(result.calls)
            ? result.calls
            : [];

        /*
         * Functional state update avoids
         * stale "calls" closure.
         */
        setCalls((previousCalls) => {
          const oldCalls =
            Array.isArray(
              previousCalls
            )
              ? previousCalls
              : [];

          /*
           * Keep only calls outside today.
           *
           * IMPORTANT:
           * This does NOT deduplicate.
           */
          const oldHistoricalCalls =
            oldCalls.filter(
              (call) => {
                const date =
                  getCallDate(call);

                if (!date) {
                  return true;
                }

                const californiaDate =
                  getCaliforniaDateString(
                    date
                  );

                return (
                  californiaDate !==
                  today
                );
              }
            );

          /*
           * Simply append ALL today's
           * records returned by API.
           *
           * Duplicate IDs / phone numbers
           * are intentionally preserved.
           */
          return [
            ...oldHistoricalCalls,
            ...todayCalls,
          ];
        });

        setRawApiResponse(
          result.data
        );

        setErrorMessage("");
      } catch (error) {
        if (
          error?.name !==
          "AbortError"
        ) {
          console.error(
            "LIVE CALL REFRESH ERROR:",
            error
          );
        }
      } finally {
        liveRequestRef.current =
          false;

        setLiveRefreshing(false);
      }
    }, [
      startDate,
      endDate,
      getCallDate,
      fetchCallHistory,
    ]);

  /* =======================================================
     INITIAL DASHBOARD LOAD
  ======================================================= */

  const loadInitialDashboard =
    useCallback(async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const results =
          await Promise.allSettled([
            loadCurrentUser(),
            loadStaffList(),
            loadDailyDesk(),
            loadCallHistory(false),
          ]);

        const userResult =
          results[0];

        if (
          userResult?.status ===
          "rejected"
        ) {
          throw userResult.reason;
        }
      } catch (error) {
        console.error(
          "INITIAL DASHBOARD ERROR:",
          error
        );

        setErrorMessage(
          error?.message ||
            "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }, [
      loadCurrentUser,
      loadStaffList,
      loadDailyDesk,
      loadCallHistory,
    ]);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (
      !startDate ||
      !endDate
    ) {
      return;
    }

    if (
      initialLoadDoneRef.current
    ) {
      return;
    }

    initialLoadDoneRef.current =
      true;

    previousRangeRef.current =
      `${startDate}|${endDate}`;

    loadInitialDashboard();
  }, [
    startDate,
    endDate,
    loadInitialDashboard,
  ]);

  /* =======================================================
     DATE CHANGE
  ======================================================= */

  useEffect(() => {
    if (
      !startDate ||
      !endDate
    ) {
      return;
    }

    const currentRange =
      `${startDate}|${endDate}`;

    if (
      previousRangeRef.current ===
      currentRange
    ) {
      return;
    }

    previousRangeRef.current =
      currentRange;

    loadCallHistory(true);
  }, [
    startDate,
    endDate,
    loadCallHistory,
  ]);

  /* =======================================================
     LIVE REFRESH
  ======================================================= */

  useEffect(() => {
    if (
      !startDate ||
      !endDate
    ) {
      return;
    }

    const interval =
      setInterval(() => {
        loadTodayLiveCalls();
      }, LIVE_REFRESH_MS);

    return () => {
      clearInterval(interval);
    };
  }, [
    startDate,
    endDate,
    loadTodayLiveCalls,
  ]);

  /* =======================================================
     USER ROLE
  ======================================================= */

  const currentUserRole =
    String(
      staff?.role || ""
    )
      .trim()
      .toLowerCase();

  const isAdmin =
    currentUserRole === "admin";

  const currentUserExtension =
    normalizeExtension(
      staff?.zoom_extension
    );

  /* =======================================================
     NORMALIZED CALLS

     ADMIN:
       ALL API RECORDS

     USER:
       ONLY crm_extension === MY EXTENSION

     VERY IMPORTANT:
       Do NOT check crm_caller_extension
       Do NOT check crm_callee_extension
       for user ownership.
  ======================================================= */

  const normalizedCalls =
    useMemo(() => {
      if (!Array.isArray(calls)) {
        return [];
      }

      const result = [];

      for (
        let index = 0;
        index < calls.length;
        index++
      ) {
        const call = calls[index];

        const date =
          getCallDate(call);

        if (!date) {
          continue;
        }

        /*
         * =================================================
         * PRIMARY OWNER
         *
         * API crm_extension is authoritative.
         * =================================================
         */

        const apiOwnerExtension =
          normalizeExtension(
            call?.crm_extension
          );

        /*
         * USER FILTER
         *
         * ONLY exact crm_extension.
         *
         * Example:
         *
         * API:
         * crm_extension = 804
         *
         * Logged user:
         * zoom_extension = 804
         *
         * => COUNT
         *
         * Even if:
         * crm_caller_extension = 804
         * or
         * crm_callee_extension = 804
         *
         * those fields are NOT used for ownership.
         */

        if (!isAdmin) {
          if (
            !currentUserExtension ||
            apiOwnerExtension !==
              currentUserExtension
          ) {
            continue;
          }
        }

        const status =
          getCallStatus(call);

        const staffName =
          getStaffName(call);

        const duration =
          getDurationSeconds(call);

        /*
         * Owner:
         *
         * Admin -> API crm_extension
         * User  -> API crm_extension
         */
        const normalizedOwner =
          apiOwnerExtension ||
          (isAdmin
            ? getCallOwnerExtension(
                call
              )
            : null);

        const staffFromExtension =
          normalizedOwner
            ? staffByExtension.get(
                normalizedOwner
              )
            : null;

        const finalStaffName =
          staffFromExtension?.name ||
          staffFromExtension?.full_name ||
          staffFromExtension?.display_name ||
          staffName;

        const californiaDate =
          getCaliforniaDateString(
            date
          );

        /*
         * IMPORTANT:
         *
         * Every call pushes one record.
         *
         * No Map.
         * No Set.
         * No unique ID.
         * No phone dedupe.
         */
        result.push({
          original: call,
          sourceIndex: index,
          date,
          californiaDate,
          status,
          staffName:
            finalStaffName ||
            "Unknown Staff",
          duration,
          ownerExtension:
            normalizedOwner,
          direction:
            getCallDirection(call),
        });
      }

      return result;
    }, [
      calls,
      isAdmin,
      currentUserExtension,
      getCallDate,
      getCallStatus,
      getStaffName,
      getDurationSeconds,
      getCallOwnerExtension,
      normalizeExtension,
      staffByExtension,
      getCallDirection,
    ]);

  /* =======================================================
     DATE FILTER
  ======================================================= */

  const filteredCalls =
    useMemo(() => {
      if (
        !startDate ||
        !endDate
      ) {
        return normalizedCalls;
      }

      if (
        startDate > endDate
      ) {
        return [];
      }

      return normalizedCalls.filter(
        (call) =>
          call.californiaDate >=
            startDate &&
          call.californiaDate <=
            endDate
      );
    }, [
      normalizedCalls,
      startDate,
      endDate,
    ]);

  /* =======================================================
     AVAILABLE EXTENSIONS
  ======================================================= */

  const availableExtensions =
    useMemo(() => {
      const extensions =
        new Set();

      for (const call of filteredCalls) {
        const extension =
          normalizeExtension(
            call.ownerExtension
          );

        if (extension) {
          extensions.add(
            extension
          );
        }
      }

      if (
        !isAdmin &&
        currentUserExtension
      ) {
        extensions.add(
          currentUserExtension
        );
      }

      return Array.from(
        extensions
      ).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);

        if (
          Number.isFinite(na) &&
          Number.isFinite(nb)
        ) {
          return na - nb;
        }

        return String(a).localeCompare(
          String(b),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      });
    }, [
      filteredCalls,
      normalizeExtension,
      isAdmin,
      currentUserExtension,
    ]);

  /* =======================================================
     STATS

     EVERY filteredCalls item = 1 call.

     Duplicate call IDs:
       COUNTED

     Duplicate phone:
       COUNTED

     Duplicate timestamp:
       COUNTED
  ======================================================= */

  const stats = useMemo(() => {
    let total = 0;
    let answered = 0;
    let missed = 0;
    let talkSeconds = 0;

    for (const call of filteredCalls) {
      /*
       * One returned record = one call.
       */
      total++;

      if (
        call.status ===
        "answered"
      ) {
        answered++;

        talkSeconds +=
          Number(call.duration) || 0;
      } else {
        missed++;
      }
    }

    const answeredPercentage =
      total > 0
        ? Math.round(
            (answered / total) *
              100
          )
        : 0;

    const missedPercentage =
      total > 0
        ? Math.round(
            (missed / total) *
              100
          )
        : 0;

    return {
      total,
      answered,
      missed,
      talkSeconds,
      answeredPercentage,
      missedPercentage,
    };
  }, [filteredCalls]);

  const totalCalls =
    stats.total;

  const answeredCount =
    stats.answered;

  const missedCount =
    stats.missed;

  const answeredPercentage =
    stats.answeredPercentage;

  const missedPercentage =
    stats.missedPercentage;

  const totalTalkSeconds =
    stats.talkSeconds;

  /* =======================================================
     FORMAT DURATION
  ======================================================= */

  const formatDuration =
    useCallback((seconds) => {
      const value =
        Number(seconds) || 0;

      const hours = Math.floor(
        value / 3600
      );

      const minutes = Math.floor(
        (value % 3600) / 60
      );

      const secs = Math.floor(
        value % 60
      );

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }

      if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      }

      return `${secs}s`;
    }, []);

  /* =======================================================
     TOP STAFF

     Groups records by crm_extension.

     IMPORTANT:
     Grouping is NOT deduplication.

     If extension 804 has:
       610 records

     then:
       totalCalls = 610
  ======================================================= */

  const topStaff =
    useMemo(() => {
      if (
        !Array.isArray(
          filteredCalls
        )
      ) {
        return [];
      }

      const statsByExtension =
        new Map();

      for (const call of filteredCalls) {
        const extension =
          normalizeExtension(
            call.ownerExtension
          );

        if (!extension) {
          continue;
        }

        let data =
          statsByExtension.get(
            extension
          );

        if (!data) {
          data = {
            totalCalls: 0,
            answered: 0,
            missed: 0,
            talkTime: 0,
          };

          statsByExtension.set(
            extension,
            data
          );
        }

        /*
         * Every record increments.
         */
        data.totalCalls++;

        if (
          call.status ===
          "answered"
        ) {
          data.answered++;

          data.talkTime +=
            Number(
              call.duration
            ) || 0;
        } else {
          data.missed++;
        }
      }

      const result = [];

      for (const [
        extension,
        callStats,
      ] of statsByExtension.entries()) {
        const user =
          staffByExtension.get(
            extension
          );

        result.push({
          ...(user || {}),

          extension,

          name:
            user?.name ||
            user?.full_name ||
            user?.display_name ||
            `Extension ${extension}`,

          totalCalls:
            callStats.totalCalls,

          answered:
            callStats.answered,

          missed:
            callStats.missed,

          talkTime:
            callStats.talkTime,
        });
      }

      result.sort(
        (a, b) =>
          b.totalCalls -
          a.totalCalls
      );

      return result.slice(0, 5);
    }, [
      filteredCalls,
      staffByExtension,
      normalizeExtension,
    ]);

  /* =======================================================
     CHART
  ======================================================= */

  const chartData =
    useMemo(() => {
      const dateKeys =
        buildDateKeys(
          startDate,
          endDate
        );

      if (
        dateKeys.length === 0
      ) {
        return [];
      }

      const dayMap = new Map();

      for (const dayKey of dateKeys) {
        dayMap.set(dayKey, {
          date: dayKey,
          total: 0,
          answered: 0,
          missed: 0,
          label:
            formatChartDate(
              dayKey
            ),
        });
      }

      for (const call of filteredCalls) {
        const day =
          call.californiaDate;

        const bucket =
          dayMap.get(day);

        if (!bucket) {
          continue;
        }

        /*
         * Every call increments once.
         */
        bucket.total++;

        if (
          call.status ===
          "answered"
        ) {
          bucket.answered++;
        } else {
          bucket.missed++;
        }
      }

      return dateKeys.map(
        (day) =>
          dayMap.get(day)
      );
    }, [
      startDate,
      endDate,
      filteredCalls,
    ]);

  const chartMax = useMemo(() => {
    let max = 1;

    for (const item of chartData) {
      if (
        item.total > max
      ) {
        max = item.total;
      }
    }

    return max;
  }, [chartData]);

  /* =======================================================
     RECENT CALLS
  ======================================================= */

  const liveActivities =
    useMemo(() => {
      if (
        filteredCalls.length ===
        0
      ) {
        return [];
      }

      const sorted =
        [...filteredCalls].sort(
          (a, b) =>
            b.date.getTime() -
            a.date.getTime()
        );

      return sorted
        .slice(0, 8)
        .map(
          (call, index) => {
            const original =
              call.original;

            const phone =
              original?.caller_number ||
              original?.callerNumber ||
              original?.from_number ||
              original?.fromNumber ||
              original?.receiver_number ||
              original?.receiverNumber ||
              original?.to_number ||
              original?.toNumber ||
              "Unknown Number";

            /*
             * UI key only.
             *
             * This does NOT affect
             * call counting.
             */
            const activityId =
              original?.id ||
              original?.zoom_call_id ||
              original?.call_history_uuid ||
              `${call.date.getTime()}-${call.sourceIndex}-${index}`;

            return {
              id: String(
                activityId
              ),

              name:
                call.staffName ||
                "Unknown Staff",

              extension:
                call.ownerExtension ||
                "-",

              phone,

              status:
                call.status,

              direction:
                call.direction,

              duration:
                call.duration,

              date:
                call.date,
            };
          }
        );
    }, [filteredCalls]);

  /* =======================================================
     DATE HANDLERS
  ======================================================= */

  const handleStartDateChange =
    useCallback(
      (value) => {
        if (!value) return;

        if (
          endDate &&
          value > endDate
        ) {
          setStartDate(value);
          setEndDate(value);
          return;
        }

        setStartDate(value);
      },
      [endDate]
    );

  const handleEndDateChange =
    useCallback(
      (value) => {
        if (!value) return;

        if (
          startDate &&
          value < startDate
        ) {
          setStartDate(value);
          setEndDate(value);
          return;
        }

        setEndDate(value);
      },
      [startDate]
    );

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh =
    useCallback(() => {
      loadCallHistory(true);
    }, [loadCallHistory]);

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout =
    async () => {
      if (loggingOut) return;

      try {
        setLoggingOut(true);

        const res =
          await fetch(
            "/api/auth/logout",
            {
              method: "POST",
              credentials:
                "include",
              cache: "no-store",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
            }
          );

        try {
          await res.json();
        } catch {}

        try {
          localStorage.removeItem(
            "crm_login_time"
          );

          localStorage.removeItem(
            "crm_status_timer"
          );

          sessionStorage.clear();
        } catch {}

        setStaff(null);
        setAllStaff([]);
        setCalls([]);
        setNumbers([]);

        window.location.replace(
          "/login"
        );
      } catch (error) {
        console.error(
          "LOGOUT ERROR:",
          error
        );

        try {
          localStorage.removeItem(
            "crm_login_time"
          );

          localStorage.removeItem(
            "crm_status_timer"
          );

          sessionStorage.clear();
        } catch {}

        window.location.replace(
          "/login"
        );
      } finally {
        setLoggingOut(false);
        setShowLogoutModal(false);
      }
    };

  /* =======================================================
     API DEBUG VALUES
  ======================================================= */

  const apiReportedTotal =
    Number(
      rawApiResponse?.total
    );

  const apiReportedFilteredTotal =
    Number(
      rawApiResponse?.filteredTotal
    );

  const apiReportedRawTotal =
    Number(
      rawApiResponse?.rawTotal
    );

  const apiReportedDuplicateTotal =
    Number(
      rawApiResponse?.duplicateTotal
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fa] text-[#171717]">
      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* SIDEBAR */}

      <Sidebar />

      {/* MAIN */}

      <main className="min-h-screen min-w-0 lg:pl-[270px]">
        {/* TOP BAR */}

        <div className="sticky top-0 z-30 bg-[#f7f8fa]/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(
                  !sidebarOpen
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm"
            >
              {sidebarOpen ? (
                <X size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>
          </div>

          <DashboardTopBar
            staff={staff}
            onLogout={() =>
              setShowLogoutModal(
                true
              )
            }
          />
        </div>

        {/* CONTENT */}

        <div className="min-w-0 px-3 pb-10 pt-4 sm:px-5 sm:pt-5 md:px-6 lg:px-8">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* ERROR */}

              {errorMessage && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="font-semibold">
                    Dashboard data issue
                  </div>

                  <div className="mt-1 break-words">
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* HEADER */}

              <div className="mb-6 flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#790214]">
                      Call Analytics
                    </p>

                    {liveRefreshing ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                        <Radio
                          size={10}
                          className="animate-pulse"
                        />
                        Updating
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                        Live
                      </span>
                    )}
                  </div>

                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#191919] sm:text-3xl">
                    Dashboard
                  </h1>

                  <p className="mt-1 text-sm text-gray-500">
                    {isAdmin
                      ? "Monitor all team's Zoom call activity."
                      : "Monitor your Zoom call activity."}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span>
                      California:
                    </span>

                    <span className="font-semibold text-gray-600">
                      {
                        currentCaliforniaDate
                      }
                    </span>

                    <span>•</span>

                    <span className="font-semibold text-gray-600">
                      {
                        currentCaliforniaTime
                      }
                    </span>

                    {!isAdmin &&
                      currentUserExtension && (
                        <>
                          <span>•</span>

                          <span className="font-semibold text-[#790214]">
                            Ext.{" "}
                            {
                              currentUserExtension
                            }
                          </span>
                        </>
                      )}

                    {isAdmin && (
                      <>
                        <span>•</span>

                        <span className="font-semibold text-[#790214]">
                          Admin • All
                          Extensions
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* DATE FILTERS */}

                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="min-w-0 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="whitespace-nowrap text-xs text-gray-500 sm:text-sm">
                        Start Date:
                      </span>

                      <input
                        type="date"
                        value={
                          startDate
                        }
                        max={
                          endDate ||
                          undefined
                        }
                        onChange={(e) =>
                          handleStartDateChange(
                            e.target
                              .value
                          )
                        }
                        className="min-w-0 max-w-full cursor-pointer bg-transparent text-xs font-semibold text-gray-700 outline-none sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="whitespace-nowrap text-xs text-gray-500 sm:text-sm">
                        End Date:
                      </span>

                      <input
                        type="date"
                        value={
                          endDate
                        }
                        min={
                          startDate ||
                          undefined
                        }
                        onChange={(e) =>
                          handleEndDateChange(
                            e.target
                              .value
                          )
                        }
                        className="min-w-0 max-w-full cursor-pointer bg-transparent text-xs font-semibold text-gray-700 outline-none sm:text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleRefresh
                    }
                    disabled={
                      refreshing
                    }
                    className="flex h-[42px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      size={16}
                      className={
                        refreshing
                          ? "animate-spin"
                          : ""
                      }
                    />

                    <span>
                      {refreshing
                        ? "Refreshing..."
                        : "Refresh"}
                    </span>
                  </button>

                  <div className="rounded-xl bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-black/5">
                    <span className="text-gray-500">
                      Total records:
                    </span>{" "}
                    <span className="font-semibold text-[#790214]">
                      {totalCalls}
                    </span>
                  </div>
                </div>
              </div>

              {/* STATS */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* TOTAL */}

                <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Total Calls
                      </p>

                      <h2 className="mt-2 text-3xl font-bold">
                        {
                          totalCalls
                        }
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#790214]/10 text-[#790214]">
                      <Phone
                        size={21}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <TrendingUp
                      size={14}
                    />

                    <span>
                      Selected date range
                    </span>
                  </div>
                </div>

                {/* ANSWERED */}

                <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Answered
                      </p>

                      <h2 className="mt-2 text-3xl font-bold text-green-600">
                        {
                          answeredCount
                        }
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
                      <PhoneIncoming
                        size={21}
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-500">
                    {
                      answeredPercentage
                    }
                    % answer rate
                  </div>
                </div>

                {/* MISSED */}

                <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Missed
                      </p>

                      <h2 className="mt-2 text-3xl font-bold text-red-600">
                        {
                          missedCount
                        }
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <PhoneOff
                        size={21}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <TrendingDown
                      size={14}
                    />

                    <span>
                      {
                        missedPercentage
                      }
                      % missed rate
                    </span>
                  </div>
                </div>

                {/* TALK TIME */}

                <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Talk Time
                      </p>

                      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                        {formatDuration(
                          totalTalkSeconds
                        )}
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Clock
                        size={21}
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-500">
                    Total answered-call
                    duration
                  </div>
                </div>
              </div>

              {/* CHART + DONUT */}

              <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
                {/* CHART */}

                <div className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6 xl:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold">
                        Call Activity
                      </h2>

                      <p className="text-sm text-gray-500">
                        Selected date range
                      </p>
                    </div>

                    <div className="text-sm text-gray-500">
                      Peak:
                      <span className="ml-1 font-semibold text-[#790214]">
                        {
                          chartMax
                        }
                      </span>
                    </div>
                  </div>

                  {chartData.length ===
                  0 ? (
                    <div className="mt-7 flex h-[230px] items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500">
                      No call activity
                      found.
                    </div>
                  ) : (
                    <div className="mt-7 w-full overflow-x-auto overflow-y-hidden pb-2">
                      <div
                        className="flex h-[250px] items-end gap-2 sm:gap-3 md:gap-4"
                        style={{
                          minWidth:
                            chartData.length >
                            7
                              ? `${Math.max(
                                  chartData.length *
                                    72,
                                  720
                                )}px`
                              : "100%",
                        }}
                      >
                        {chartData.map(
                          (item) => {
                            const height =
                              item.total >
                              0
                                ? Math.max(
                                    (item.total /
                                      chartMax) *
                                      100,
                                    6
                                  )
                                : 0;

                            return (
                              <div
                                key={
                                  item.date
                                }
                                className="flex h-full min-w-[56px] flex-1 flex-col justify-end"
                              >
                                <div className="flex h-full items-end justify-center">
                                  <div
                                    title={`${item.total} calls on ${item.date}`}
                                    className="w-full max-w-[42px] rounded-t-xl bg-[#790214] transition-[height] duration-300 hover:opacity-80"
                                    style={{
                                      height: `${height}%`,
                                    }}
                                  />
                                </div>

                                <div className="mt-3 whitespace-nowrap text-center text-[10px] font-medium text-gray-500 sm:text-[11px]">
                                  {
                                    item.label
                                  }
                                </div>

                                <div className="mt-1 text-center text-xs font-bold text-gray-700">
                                  {
                                    item.total
                                  }
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* DONUT */}

                <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
                  <h2 className="text-lg font-bold">
                    Call Outcome
                  </h2>

                  <p className="text-sm text-gray-500">
                    Answered vs missed
                  </p>

                  <div className="mt-7 flex items-center justify-center">
                    <div className="relative h-44 w-44 sm:h-48 sm:w-48">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background:
                            totalCalls ===
                            0
                              ? "#e5e7eb"
                              : `conic-gradient(
                                  #16a34a 0% ${answeredPercentage}%,
                                  #dc2626 ${answeredPercentage}% 100%
                                )`,
                        }}
                      />

                      <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-white">
                        <div className="text-3xl font-bold">
                          {
                            answeredPercentage
                          }
                          %
                        </div>

                        <div className="text-xs text-gray-500">
                          Answered
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-green-50 p-3">
                      <div className="text-xs text-green-700">
                        Answered
                      </div>

                      <div className="mt-1 text-lg font-bold text-green-700">
                        {
                          answeredCount
                        }
                      </div>
                    </div>

                    <div className="rounded-xl bg-red-50 p-3">
                      <div className="text-xs text-red-700">
                        Missed
                      </div>

                      <div className="mt-1 text-lg font-bold text-red-700">
                        {
                          missedCount
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STAFF + RECENT */}

              <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                {/* TOP STAFF */}

                <div className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        {isAdmin
                          ? "Top Staff"
                          : "My Calls"}
                      </h2>

                      <p className="text-sm text-gray-500">
                        {isAdmin
                          ? "Calls by extension"
                          : `Extension ${currentUserExtension || "-"}`}
                      </p>
                    </div>

                    <Phone
                      size={20}
                      className="shrink-0 text-[#790214]"
                    />
                  </div>

                  <div className="mt-5 space-y-3">
                    {topStaff.length ===
                    0 ? (
                      <div className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">
                        No staff call
                        data found.
                      </div>
                    ) : (
                      topStaff.map(
                        (
                          user,
                          index
                        ) => (
                          <div
                            key={
                              user?.id ||
                              user?.extension ||
                              index
                            }
                            className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 transition hover:bg-gray-50"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#790214]/10 text-sm font-bold text-[#790214]">
                                {String(
                                  user?.name ||
                                    user?.full_name ||
                                    `E${user.extension}`
                                )
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {user?.name ||
                                    user?.full_name ||
                                    user?.display_name ||
                                    `Extension ${user.extension}`}
                                </div>

                                <div className="text-xs text-gray-500">
                                  Ext.{" "}
                                  {
                                    user.extension
                                  }
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-sm font-bold">
                                {
                                  user.totalCalls
                                }
                              </div>

                              <div className="text-[11px] text-gray-500">
                                {
                                  user.answered
                                }{" "}
                                answered
                              </div>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>

                {/* RECENT CALLS */}

                <div className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        Recent Calls
                      </h2>

                      <p className="truncate text-sm text-gray-500">
                        Latest Zoom call
                        activity
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-green-600">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      Live
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {liveActivities.length ===
                    0 ? (
                      <div className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">
                        No call activity
                        found.
                      </div>
                    ) : (
                      liveActivities.map(
                        (
                          activity
                        ) => (
                          <div
                            key={
                              activity.id
                            }
                            className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                  activity.status ===
                                  "answered"
                                    ? "bg-green-50 text-green-600"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                {activity.status ===
                                "answered" ? (
                                  <PhoneIncoming
                                    size={
                                      16
                                    }
                                  />
                                ) : (
                                  <PhoneOff
                                    size={
                                      16
                                    }
                                  />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {
                                    activity.name
                                  }
                                </div>

                                <div className="max-w-[180px] truncate text-xs text-gray-500 sm:max-w-[260px]">
                                  Ext.{" "}
                                  {
                                    activity.extension
                                  }
                                  {" • "}
                                  {
                                    activity.phone
                                  }
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div
                                className={`text-xs font-semibold ${
                                  activity.status ===
                                  "answered"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {activity.status ===
                                "answered"
                                  ? "Answered"
                                  : "Missed"}
                              </div>

                              <div className="mt-1 text-[11px] text-gray-500">
                                {formatDuration(
                                  activity.duration
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* LIVE STATUS */}

              <div className="mt-6 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />

                      <p className="text-sm font-semibold text-gray-700">
                        Live Call Monitor
                      </p>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      Today's calls update
                      automatically every
                      60 seconds.
                    </p>
                  </div>

                  <div className="text-xs text-gray-500 sm:text-right">
                    <div>
                      California time:{" "}
                      <span className="font-semibold text-gray-700">
                        {
                          currentCaliforniaTime
                        }
                      </span>
                    </div>

                    <div className="mt-1">
                      Last live check:{" "}
                      <span className="font-semibold text-gray-700">
                        {liveRefreshing
                          ? "Updating..."
                          : "Ready"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* API DEBUG */}

              <div className="mt-6 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-700">
                      API Debug
                    </p>

                    <p className="text-xs text-gray-500">
                      Role:{" "}
                      <span className="font-semibold text-gray-700">
                        {isAdmin
                          ? "Admin"
                          : "User"}
                      </span>
                    </p>

                    {!isAdmin &&
                      currentUserExtension && (
                        <p className="text-xs text-gray-500">
                          My Extension:{" "}
                          <span className="font-semibold text-gray-700">
                            {
                              currentUserExtension
                            }
                          </span>
                        </p>
                      )}

                    <p className="mt-1 text-xs text-gray-500">
                      Calls loaded from
                      API:{" "}
                      <span className="font-semibold text-gray-700">
                        {
                          calls.length
                        }
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Dashboard records:{" "}
                      <span className="font-semibold text-[#790214]">
                        {
                          filteredCalls.length
                        }
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      API reported total:{" "}
                      <span className="font-semibold text-gray-700">
                        {Number.isFinite(
                          apiReportedTotal
                        )
                          ? apiReportedTotal
                          : "-"}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      API filtered total:{" "}
                      <span className="font-semibold text-gray-700">
                        {Number.isFinite(
                          apiReportedFilteredTotal
                        )
                          ? apiReportedFilteredTotal
                          : "-"}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      API raw total:{" "}
                      <span className="font-semibold text-gray-700">
                        {Number.isFinite(
                          apiReportedRawTotal
                        )
                          ? apiReportedRawTotal
                          : "-"}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      API duplicate records:{" "}
                      <span className="font-semibold text-[#790214]">
                        {Number.isFinite(
                          apiReportedDuplicateTotal
                        )
                          ? apiReportedDuplicateTotal
                          : "0"}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Available extensions:{" "}
                      <span className="font-semibold text-gray-700">
                        {availableExtensions.length >
                        0
                          ? availableExtensions.join(
                              ", "
                            )
                          : "None"}
                      </span>
                    </p>
                  </div>

                  <div className="break-words text-xs text-gray-500 sm:text-right">
                    <div>
                      Range:{" "}
                      {startDate ||
                        "-"}{" "}
                      →{" "}
                      {endDate ||
                        "-"}
                    </div>

                    <div className="mt-1">
                      Answered:{" "}
                      {
                        answeredCount
                      }
                      {" • "}
                      Missed:{" "}
                      {missedCount}
                    </div>

                    <div className="mt-1">
                      California:{" "}
                      {
                        currentCaliforniaDate
                      }{" "}
                      {
                        currentCaliforniaTime
                      }
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* LOGOUT */}

      {showLogoutModal && (
        <LogoutModal
          show={
            showLogoutModal
          }
          loggingOut={
            loggingOut
          }
          onCancel={() =>
            setShowLogoutModal(
              false
            )
          }
          onConfirm={
            handleLogout
          }
        />
      )}
    </div>
  );
}