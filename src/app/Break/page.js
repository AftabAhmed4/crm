"use client";

import {
  CalendarDays,
  Coffee,
  Users,
  Search,
  Filter,
  ChevronDown,
  Timer,
  RefreshCw,
  X,
  Activity,
  ShieldCheck,
  Clock3,
  Utensils,
  Moon,
  Bath,
} from "lucide-react";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// =============================================================
// CONFIG
// =============================================================

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

const BREAK_TYPES = [
  "Namaz",
  "Lunch",
  "Short Break",
  "Washroom",
  "Other",
];

// =============================================================
// CALIFORNIA DATE STRING
// =============================================================

function getCaliforniaDateString(dateValue = new Date()) {
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALIFORNIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// =============================================================
// GET CALIFORNIA OFFSET
// =============================================================

function getCaliforniaOffsetMinutes(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CALIFORNIA_TIMEZONE,
    timeZoneName: "longOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const timezonePart = parts.find(
    (part) => part.type === "timeZoneName"
  );

  if (!timezonePart?.value) {
    return -480;
  }

  const match = timezonePart.value.match(
    /GMT([+-])(\d{2}):?(\d{2})/
  );

  if (!match) {
    return -480;
  }

  const sign =
    match[1] === "+"
      ? 1
      : -1;

  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  return sign * (hours * 60 + minutes);
}

// =============================================================
// PARSE MYSQL DATETIME AS CALIFORNIA TIME
//
// VERY IMPORTANT:
//
// MySQL DATETIME has NO timezone.
//
// Example:
// 2026-09-27 13:21:34
//
// This means:
// Sep 27, 2026
// 01:21:34 PM
//
// in California.
//
// It must NOT be interpreted using browser timezone.
//
// =============================================================

function parseCaliforniaMySQLDateTime(value) {
  if (!value) return null;

  const raw = String(value).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);

  // -----------------------------------------------------------
  // Treat database value as California wall-clock time.
  // First make a UTC guess.
  // -----------------------------------------------------------

  const wallClockUTC = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  // Get California offset for the guessed instant.
  let offsetMinutes =
    getCaliforniaOffsetMinutes(
      new Date(wallClockUTC)
    );

  // Convert California wall-clock -> UTC instant.
  let utcTimestamp =
    wallClockUTC -
    offsetMinutes * 60 * 1000;

  let result =
    new Date(utcTimestamp);

  // -----------------------------------------------------------
  // Re-check DST.
  // California changes between PST (-08:00)
  // and PDT (-07:00).
  // -----------------------------------------------------------

  const correctedOffset =
    getCaliforniaOffsetMinutes(result);

  if (
    correctedOffset !== offsetMinutes
  ) {
    utcTimestamp =
      wallClockUTC -
      correctedOffset * 60 * 1000;

    result =
      new Date(utcTimestamp);
  }

  return Number.isNaN(
    result.getTime()
  )
    ? null
    : result;
}

// =============================================================
// PARSE DATE TIME
// =============================================================

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  // -----------------------------------------------------------
  // ISO / UTC / OFFSET DATETIME
  //
  // Examples:
  // 2026-09-27T20:21:34.000Z
  // 2026-09-27T13:21:34-07:00
  // -----------------------------------------------------------

  if (
    raw.includes("T") &&
    (
      raw.endsWith("Z") ||
      /[+-]\d{2}:\d{2}$/.test(raw)
    )
  ) {
    const date =
      new Date(raw);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  // -----------------------------------------------------------
  // MYSQL DATETIME
  // -----------------------------------------------------------

  const mysqlDate =
    parseCaliforniaMySQLDateTime(
      raw
    );

  if (mysqlDate) {
    return mysqlDate;
  }

  // -----------------------------------------------------------
  // FALLBACK
  // -----------------------------------------------------------

  const date =
    new Date(raw);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

// =============================================================
// FORMAT CALIFORNIA DATE + TIME
// =============================================================

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const raw =
    String(value).trim();

  // ===========================================================
  // IMPORTANT:
  //
  // If API gives MySQL DATETIME, parse it as California.
  // Then display the instant in California.
  // ===========================================================

  const date =
    parseDateTime(raw);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        CALIFORNIA_TIMEZONE,

      month: "short",
      day: "2-digit",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hour12: true,
    }
  ).format(date);
}

// =============================================================
// FORMAT CALIFORNIA DATE ONLY
// =============================================================

function formatDateOnly(value) {
  if (!value) {
    return "—";
  }

  const raw =
    String(value).trim();

  // -----------------------------------------------------------
  // DATE ONLY
  // -----------------------------------------------------------

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
  ) {
    const [
      year,
      month,
      day,
    ] = raw.split("-");

    const date =
      new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          12,
          0,
          0
        )
      );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "UTC",
        month: "short",
        day: "2-digit",
        year: "numeric",
      }
    ).format(date);
  }

  const date =
    parseDateTime(raw);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        CALIFORNIA_TIMEZONE,
      month: "short",
      day: "2-digit",
      year: "numeric",
    }
  ).format(date);
}

// =============================================================
// FORMAT DURATION
// =============================================================

function formatDuration(seconds) {
  const totalSeconds =
    Number(seconds || 0);

  if (
    !Number.isFinite(
      totalSeconds
    ) ||
    totalSeconds <= 0
  ) {
    return "0m";
  }

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60
    );

  const secs =
    Math.floor(
      totalSeconds % 60
    );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

// =============================================================
// BREAK TYPE NORMALIZER
// =============================================================

function normalizeBreakType(item) {
  const value =
    String(
      item?.break_type ||
        item?.type ||
        item?.status ||
        "Other"
    ).trim();

  const lower =
    value.toLowerCase();

  if (
    lower.includes("namaz") ||
    lower.includes("prayer")
  ) {
    return "Namaz";
  }

  if (
    lower.includes("lunch") ||
    lower.includes("meal")
  ) {
    return "Lunch";
  }

  if (
    lower.includes("short break") ||
    lower.includes("shortbreak")
  ) {
    return "Short Break";
  }

  if (
    lower.includes("washroom") ||
    lower.includes("bathroom")
  ) {
    return "Washroom";
  }

  return "Other";
}

// =============================================================
// ACTIVE BREAK
// =============================================================

function isActiveBreak(item) {
  if (item?.is_active === true) {
    return true;
  }

  if (
    String(
      item?.status || ""
    ).toLowerCase() === "active" &&
    !item?.ended_at
  ) {
    return true;
  }

  return !item?.ended_at;
}

// =============================================================
// LIVE DURATION
// =============================================================

function getLiveDuration(item) {
  const maxLimits = {
    Namaz: 15 * 60,
    Lunch: 30 * 60,
    "Short Break": 10 * 60,
    Washroom: 10 * 60,
    Other: 60 * 60,
  };

  const breakType = normalizeBreakType(item);

  const maxSeconds =
    maxLimits[breakType] || maxLimits.Other;

  if (!isActiveBreak(item)) {
    const stored = Number(
      item?.duration_seconds || 0
    );

    return Math.min(
      Math.max(0, Math.floor(stored)),
      maxSeconds
    );
  }

  const started = parseDateTime(
    item?.started_at
  );

  if (!started) {
    return 0;
  }

  const elapsed = Math.floor(
    (Date.now() - started.getTime()) / 1000
  );

  return Math.min(
    Math.max(0, elapsed),
    maxSeconds
  );
}

// =============================================================
// PAGE
// =============================================================

export default function BreaksPage() {
  const router =
    useRouter();

  // ===========================================================
  // STATE
  // ===========================================================

  const [
    currentUser,
    setCurrentUser,
  ] = useState(null);

  const [
    breakHistory,
    setBreakHistory,
  ] = useState([]);

  const [
    breakStats,
    setBreakStats,
  ] = useState({
    total: 0,
    namaz: 0,
    lunch: 0,
    shortBreak: 0,
    washroom: 0,
    other: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("All");

  const [
    startDate,
    setStartDate,
  ] = useState("");

  const [
    endDate,
    setEndDate,
  ] = useState("");

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const [
    now,
    setNow,
  ] = useState(new Date());

  // ===========================================================
  // CURRENT CALIFORNIA DATE
  // ===========================================================

  const todayCalifornia =
    useMemo(
      () =>
        getCaliforniaDateString(
          now
        ),
      [now]
    );

  // ===========================================================
  // FETCH CURRENT USER
  // ===========================================================

  const fetchCurrentUser =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/auth/me",
              {
                cache:
                  "no-store",
                headers: {
                  "Cache-Control":
                    "no-cache",
                },
              }
            );

          if (
            response.status ===
            401
          ) {
            router.push(
              "/login"
            );
            return;
          }

          const data =
            await response.json();

          if (
            data?.success &&
            data?.user
          ) {
            setCurrentUser(
              data.user
            );
          } else if (
            data?.user
          ) {
            setCurrentUser(
              data.user
            );
          }
        } catch (error) {
          console.error(
            "Current user fetch error:",
            error
          );
        } finally {
          setLoading(false);
        }
      },
      [router]
    );

  // ===========================================================
  // FETCH BREAK HISTORY
  // ===========================================================

  const fetchBreakHistory =
    useCallback(
      async (
        isRefresh = false
      ) => {
        try {
          if (isRefresh) {
            setRefreshing(
              true
            );
          } else {
            setHistoryLoading(
              true
            );
          }

          const response =
            await fetch(
              `/api/admin/break-history?_live=${Date.now()}`,
              {
                cache:
                  "no-store",
                headers: {
                  "Cache-Control":
                    "no-cache, no-store, must-revalidate",
                  Pragma:
                    "no-cache",
                  Expires:
                    "0",
                },
              }
            );

          if (
            response.status ===
            401
          ) {
            router.push(
              "/login"
            );
            return;
          }

          if (
            response.status ===
            403
          ) {
            setBreakHistory(
              []
            );
            return;
          }

          const data =
            await response.json();

          if (
            data?.success
          ) {
            setBreakHistory(
              Array.isArray(
                data.breaks
              )
                ? data.breaks
                : []
            );

            setBreakStats({
              total: Number(
                data?.stats
                  ?.total || 0
              ),

              namaz: Number(
                data?.stats
                  ?.namaz || 0
              ),

              lunch: Number(
                data?.stats
                  ?.lunch || 0
              ),

              shortBreak:
                Number(
                  data?.stats
                    ?.shortBreak ||
                    0
                ),

              washroom:
                Number(
                  data?.stats
                    ?.washroom ||
                    0
                ),

              other: Number(
                data?.stats
                  ?.other || 0
              ),
            });
          } else {
            setBreakHistory(
              []
            );
          }
        } catch (error) {
          console.error(
            "Break history fetch error:",
            error
          );
        } finally {
          setHistoryLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      [router]
    );

  // ===========================================================
  // INITIAL LOAD
  // ===========================================================

  useEffect(() => {
    fetchCurrentUser();
    fetchBreakHistory();
  }, [
    fetchCurrentUser,
    fetchBreakHistory,
  ]);

  // ===========================================================
  // AUTO REFRESH
  // ===========================================================

  useEffect(() => {
    const interval =
      setInterval(() => {
        fetchBreakHistory(
          true
        );
      }, 5000);

    return () =>
      clearInterval(
        interval
      );
  }, [
    fetchBreakHistory,
  ]);

  // ===========================================================
  // LIVE CLOCK
  // ===========================================================

  useEffect(() => {
    const interval =
      setInterval(() => {
        setNow(
          new Date()
        );
      }, 1000);

    return () =>
      clearInterval(
        interval
      );
  }, []);

  // ===========================================================
  // FILTERED HISTORY
  // ===========================================================

  const filteredBreakHistory =
    useMemo(() => {
      let result = [
        ...breakHistory,
      ];

      // SEARCH
      if (search.trim()) {
        const searchValue =
          search
            .trim()
            .toLowerCase();

        result =
          result.filter(
            (item) => {
              const employeeName =
                String(
                  item.employee_name ||
                    item.user_name ||
                    item.name ||
                    ""
                ).toLowerCase();

              const email =
                String(
                  item.employee_email ||
                    item.user_email ||
                    item.email ||
                    ""
                ).toLowerCase();

              const team =
                String(
                  item.team ||
                    item.department ||
                    item.team_name ||
                    ""
                ).toLowerCase();

              const type =
                normalizeBreakType(
                  item
                ).toLowerCase();

              return (
                employeeName.includes(
                  searchValue
                ) ||
                email.includes(
                  searchValue
                ) ||
                team.includes(
                  searchValue
                ) ||
                type.includes(
                  searchValue
                )
              );
            }
          );
      }

      // BREAK TYPE
      if (
        typeFilter !== "All"
      ) {
        result =
          result.filter(
            (item) =>
              normalizeBreakType(
                item
              ) ===
              typeFilter
          );
      }

      // DATE RANGE
      if (
        startDate ||
        endDate
      ) {
        result =
          result.filter(
            (item) => {
              const parsed =
                parseDateTime(
                  item.started_at
                );

              if (!parsed) {
                return false;
              }

              const itemDate =
                getCaliforniaDateString(
                  parsed
                );

              if (!itemDate) {
                return false;
              }

              if (
                startDate &&
                itemDate <
                  startDate
              ) {
                return false;
              }

              if (
                endDate &&
                itemDate >
                  endDate
              ) {
                return false;
              }

              return true;
            }
          );
      }

      return result;
    }, [
      breakHistory,
      search,
      typeFilter,
      startDate,
      endDate,
    ]);

  // ===========================================================
  // TOTAL FILTERED SECONDS
  // ===========================================================

  const totalFilteredSeconds =
    useMemo(() => {
      return filteredBreakHistory.reduce(
        (
          total,
          item
        ) => {
          return (
            total +
            getLiveDuration(
              item
            )
          );
        },
        0
      );
    }, [
      filteredBreakHistory,
      now,
    ]);

  // ===========================================================
  // TOTAL FILTERED HOURS
  // ===========================================================

  const totalFilteredHours =
    useMemo(
      () =>
        formatDuration(
          totalFilteredSeconds
        ),
      [totalFilteredSeconds]
    );

  // ===========================================================
  // CLEAR FILTERS
  // ===========================================================

  const clearFilters =
    () => {
      setSearch("");
      setTypeFilter("All");
      setStartDate("");
      setEndDate("");
    };

  const hasFilters =
    Boolean(
      search.trim() ||
        typeFilter !==
          "All" ||
        startDate ||
        endDate
    );

  // ===========================================================
  // DATE RANGE TEXT
  // ===========================================================

  const dateRangeText =
    useMemo(() => {
      if (
        startDate &&
        endDate
      ) {
        return `${formatDateOnly(
          startDate
        )} → ${formatDateOnly(
          endDate
        )}`;
      }

      if (startDate) {
        return `From ${formatDateOnly(
          startDate
        )}`;
      }

      if (endDate) {
        return `Until ${formatDateOnly(
          endDate
        )}`;
      }

      return "All dates";
    }, [
      startDate,
      endDate,
    ]);

  // ===========================================================
  // RENDER
  // ===========================================================

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      <Sidebar />

      <main className="min-h-screen w-full lg:pl-[270px]">
        <div className="p-4 sm:p-6 lg:p-8">

          {/* HEADER */}

          <div className="mb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">

                  <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5">
                    <CalendarDays className="h-4 w-4 text-[#741C29]" />

                    <span className="text-xs font-semibold text-[#741C29]">
                      Attendance
                    </span>
                  </div>

                  {currentUser?.role ===
                    "admin" && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" />

                      <span className="text-xs font-semibold text-indigo-700">
                        Admin View
                      </span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                    <Clock3 className="h-4 w-4 text-slate-500" />

                    <span className="text-xs font-semibold text-slate-600">
                      California Time
                    </span>
                  </div>

                </div>

                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Break History
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  View and monitor employee break activity
                </p>

                <p className="mt-2 text-xs font-medium text-slate-400">
                  Today:{" "}
                  {formatDateOnly(
                    todayCalifornia
                  )}
                  {" • "}
                  Namaz 1 • Lunch 1 • Short 3 • Total 5
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  fetchBreakHistory(
                    true
                  )
                }
                disabled={
                  refreshing
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
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

          {/* POLICY */}

          <div className="mb-6 overflow-hidden rounded-2xl border border-[#741C29]/10 bg-white shadow-sm">

            <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                  <Timer className="h-5 w-5 text-[#741C29]" />
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Daily Break Policy
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Limits reset according to the California calendar day.
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">

                    <PolicyBadge
                      icon={Moon}
                      text="Namaz: 1"
                      className="border-indigo-100 bg-indigo-50 text-indigo-700"
                    />

                    <PolicyBadge
                      icon={Utensils}
                      text="Lunch: 1"
                      className="border-orange-100 bg-orange-50 text-orange-700"
                    />

                    <PolicyBadge
                      icon={Clock3}
                      text="Short Break: 3"
                      className="border-teal-100 bg-teal-50 text-teal-700"
                    />

                    <PolicyBadge
                      icon={Activity}
                      text="Total: 5"
                      className="border-slate-200 bg-slate-50 text-slate-700"
                    />

                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">

                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      California Date
                    </p>

                    <p className="text-xs font-bold text-slate-700">
                      {formatDateOnly(
                        todayCalifornia
                      )}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
                  <Clock3 className="h-4 w-4 text-emerald-600" />

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Timezone
                    </p>

                    <p className="text-xs font-bold text-emerald-700">
                      America/Los_Angeles
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* STATS */}

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

            <StatCard
              title="Total Breaks"
              value={
                breakStats.total
              }
              icon={Activity}
              description="All break records"
              iconClass="bg-rose-50 text-rose-600"
            />

            <StatCard
              title="Namaz"
              value={
                breakStats.namaz
              }
              icon={Moon}
              description="Prayer breaks"
              iconClass="bg-indigo-50 text-indigo-600"
            />

            <StatCard
              title="Lunch"
              value={
                breakStats.lunch
              }
              icon={Utensils}
              description="Lunch breaks"
              iconClass="bg-orange-50 text-orange-600"
            />

            <StatCard
              title="Short Break"
              value={
                breakStats.shortBreak
              }
              icon={Clock3}
              description="Short breaks"
              iconClass="bg-teal-50 text-teal-600"
            />

            <StatCard
              title="Washroom"
              value={
                breakStats.washroom
              }
              icon={Bath}
              description="Washroom breaks"
              iconClass="bg-cyan-50 text-cyan-600"
            />

            <StatCard
              title="Other"
              value={
                breakStats.other
              }
              icon={Coffee}
              description="Other breaks"
              iconClass="bg-amber-50 text-amber-600"
            />

          </div>

          {/* FILTER */}

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="p-4">

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={
                      search
                    }
                    onChange={(e) =>
                      setSearch(
                        e.target
                          .value
                      )
                    }
                    placeholder="Search employee, team or break type..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#741C29] focus:bg-white focus:ring-2 focus:ring-[#741C29]/10"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowFilters(
                      (
                        prev
                      ) =>
                        !prev
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 xl:hidden"
                >
                  <Filter className="h-4 w-4" />

                  Filters

                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showFilters
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                <div
                  className={`${
                    showFilters
                      ? "flex"
                      : "hidden"
                  } flex-col gap-3 xl:flex xl:flex-row xl:items-center`}
                >

                  <div className="relative">
                    <select
                      value={
                        typeFilter
                      }
                      onChange={(e) =>
                        setTypeFilter(
                          e.target
                            .value
                        )
                      }
                      className="w-full min-w-[160px] appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-[#741C29] focus:bg-white focus:ring-2 focus:ring-[#741C29]/10"
                    >
                      <option value="All">
                        All Break Types
                      </option>

                      {BREAK_TYPES.map(
                        (
                          type
                        ) => (
                          <option
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="date"
                      value={
                        startDate
                      }
                      onChange={(e) =>
                        setStartDate(
                          e.target
                            .value
                        )
                      }
                      className="w-full min-w-[165px] rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#741C29] focus:bg-white focus:ring-2 focus:ring-[#741C29]/10"
                    />
                  </div>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

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
                        setEndDate(
                          e.target
                            .value
                        )
                      }
                      className="w-full min-w-[165px] rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#741C29] focus:bg-white focus:ring-2 focus:ring-[#741C29]/10"
                    />
                  </div>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={
                        clearFilters
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                      Clear
                    </button>
                  )}

                </div>
              </div>

              {(startDate ||
                endDate) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">

                  <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CalendarDays className="h-3.5 w-3.5" />

                    <span>
                      Date Range:{" "}
                      {
                        dateRangeText
                      }
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <Clock3 className="h-3.5 w-3.5" />

                    <span>
                      Total Time:{" "}
                      {
                        totalFilteredHours
                      }
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    {
                      filteredBreakHistory.length
                    }{" "}
                    record
                    {filteredBreakHistory.length !==
                    1
                      ? "s"
                      : ""}{" "}
                    found
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Break Records
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {
                    filteredBreakHistory.length
                  }{" "}
                  record
                  {filteredBreakHistory.length !==
                  1
                    ? "s"
                    : ""}
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:flex">
                <Users className="h-4 w-4 text-slate-400" />

                <span className="text-xs font-semibold text-slate-600">
                  {
                    filteredBreakHistory.length
                  }{" "}
                  Records
                </span>
              </div>

            </div>

            {historyLoading &&
            !breakHistory.length ? (
              <div className="flex h-[420px] items-center justify-center">

                <div className="flex flex-col items-center gap-3">

                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[#741C29]" />

                  <p className="text-sm text-slate-500">
                    Loading break history...
                  </p>

                </div>

              </div>
            ) : filteredBreakHistory.length ===
              0 ? (
              <div className="flex h-[420px] flex-col items-center justify-center px-6 text-center">

                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Coffee className="h-7 w-7 text-slate-400" />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  No break records found
                </h3>

                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {hasFilters
                    ? "Try changing your filters or search criteria."
                    : "There are no break records available yet."}
                </p>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#741C29] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5f1722]"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </button>
                )}

              </div>
            ) : (
              <>

                {/* DESKTOP */}

                <div className="max-h-[520px] overflow-auto">

                  <table className="w-full min-w-[950px]">

                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-100 bg-slate-50">

                        <TableHeading>
                          Employee
                        </TableHeading>

                        <TableHeading>
                          Team
                        </TableHeading>

                        <TableHeading>
                          Break Type
                        </TableHeading>

                        <TableHeading>
                          Started
                        </TableHeading>

                        <TableHeading>
                          Ended
                        </TableHeading>

                        <TableHeading align="right">
                          Duration
                        </TableHeading>

                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {filteredBreakHistory.map(
                        (
                          item,
                          index
                        ) => (
                          <BreakTableRow
                            key={
                              item.id ||
                              item.break_id ||
                              `${item.started_at}-${index}`
                            }
                            item={
                              item
                            }
                            formatDateTime={
                              formatDateTime
                            }
                            formatDuration={
                              formatDuration
                            }
                            getTypeIcon={
                              getTypeIcon
                            }
                            getTypeStyles={
                              getTypeStyles
                            }
                            isActiveBreak={
                              isActiveBreak
                            }
                            getLiveDuration={
                              getLiveDuration
                            }
                          />
                        )
                      )}

                    </tbody>
                  </table>

                </div>

                {/* MOBILE */}

                <div className="max-h-[520px] overflow-y-auto md:hidden">

                  <div className="divide-y divide-slate-100">

                    {filteredBreakHistory.map(
                      (
                        item,
                        index
                      ) => (
                        <BreakMobileCard
                          key={
                            item.id ||
                            item.break_id ||
                            `${item.started_at}-${index}`
                          }
                          item={
                            item
                          }
                          formatDateTime={
                            formatDateTime
                          }
                          formatDateOnly={
                            formatDateOnly
                          }
                          formatDuration={
                            formatDuration
                          }
                          getTypeIcon={
                            getTypeIcon
                          }
                          getTypeStyles={
                            getTypeStyles
                          }
                          isActiveBreak={
                            isActiveBreak
                          }
                          getLiveDuration={
                            getLiveDuration
                          }
                        />
                      )
                    )}

                  </div>

                </div>

              </>
            )}

          </div>

          {/* FOOTER */}

          <div className="mt-4 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">

            <span>
              Data automatically refreshes every 5 seconds.
            </span>

            <span>
              Showing{" "}
              {
                filteredBreakHistory.length
              }{" "}
              of{" "}
              {
                breakHistory.length
              }{" "}
              records
            </span>

          </div>

        </div>
      </main>
    </div>
  );
}

// =============================================================
// POLICY BADGE
// =============================================================

function PolicyBadge({
  icon: Icon,
  text,
  className,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}

// =============================================================
// STAT CARD
// =============================================================

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  iconClass,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {title}
          </p>

          <p className="mt-2 truncate text-xl font-bold text-slate-900 sm:text-2xl">
            {value}
          </p>

          <p className="mt-1 truncate text-[11px] text-slate-400">
            {description}
          </p>

        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>

      </div>
    </div>
  );
}

// =============================================================
// TABLE HEADING
// =============================================================

function TableHeading({
  children,
  align = "left",
}) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

// =============================================================
// TYPE ICON
// =============================================================

function getTypeIcon(type) {
  const value =
    String(
      type || ""
    ).toLowerCase();

  if (
    value.includes("namaz") ||
    value.includes("prayer")
  ) {
    return Moon;
  }

  if (
    value.includes("lunch") ||
    value.includes("meal")
  ) {
    return Utensils;
  }

  if (
    value.includes("short break") ||
    value.includes("shortbreak")
  ) {
    return Clock3;
  }

  if (
    value.includes("washroom") ||
    value.includes("bathroom")
  ) {
    return Bath;
  }

  return Coffee;
}

// =============================================================
// TYPE STYLES
// =============================================================

function getTypeStyles(type) {
  const value =
    String(
      type || ""
    ).toLowerCase();

  if (
    value.includes("namaz") ||
    value.includes("prayer")
  ) {
    return {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border:
        "border-indigo-100",
    };
  }

  if (
    value.includes("lunch") ||
    value.includes("meal")
  ) {
    return {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border:
        "border-orange-100",
    };
  }

  if (
    value.includes("short break") ||
    value.includes("shortbreak")
  ) {
    return {
      bg: "bg-teal-50",
      text: "text-teal-700",
      border:
        "border-teal-100",
    };
  }

  if (
    value.includes("washroom") ||
    value.includes("bathroom")
  ) {
    return {
      bg: "bg-cyan-50",
      text: "text-cyan-700",
      border:
        "border-cyan-100",
    };
  }

  return {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border:
      "border-amber-100",
  };
}

// =============================================================
// DESKTOP ROW
// =============================================================

function BreakTableRow({
  item,
  formatDateTime,
  formatDuration,
  getTypeIcon,
  getTypeStyles,
  isActiveBreak,
  getLiveDuration,
}) {
  const employeeName =
    item.employee_name ||
    item.user_name ||
    item.name ||
    "Unknown Employee";

  const employeeEmail =
    item.employee_email ||
    item.user_email ||
    item.email ||
    "";

  const team =
    item.team ||
    item.department ||
    item.team_name ||
    "—";

  const breakType =
    normalizeBreakType(
      item
    );

  const TypeIcon =
    getTypeIcon(
      breakType
    );

  const styles =
    getTypeStyles(
      breakType
    );

  const active =
    isActiveBreak(
      item
    );

  const duration =
    getLiveDuration(
      item
    );

  return (
    <tr className="group transition hover:bg-slate-50/70">

      {/* EMPLOYEE */}

      <td className="px-5 py-4">
        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-600">
            {employeeName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="min-w-0">

            <p className="truncate text-sm font-bold text-slate-800">
              {employeeName}
            </p>

            {employeeEmail && (
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {employeeEmail}
              </p>
            )}

          </div>

        </div>
      </td>

      {/* TEAM */}

      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          {team}
        </span>
      </td>

      {/* TYPE */}

      <td className="px-5 py-4">
        <span
          className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${styles.bg} ${styles.text} ${styles.border}`}
        >
          <TypeIcon className="h-3.5 w-3.5" />
          {breakType}
        </span>
      </td>

      {/* STARTED */}

      <td className="whitespace-nowrap px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">

          <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />

          {formatDateTime(
            item.started_at
          )}

        </div>
      </td>

      {/* ENDED */}

      <td className="whitespace-nowrap px-5 py-4">

        {active ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />

            Active

          </span>
        ) : (
          <span className="text-sm text-slate-600">
            {formatDateTime(
              item.ended_at
            )}
          </span>
        )}

      </td>

      {/* DURATION */}

      <td className="whitespace-nowrap px-5 py-4 text-right">

        <span
          className={`text-sm font-bold ${
            active
              ? "text-emerald-600"
              : "text-slate-800"
          }`}
        >
          {formatDuration(
            duration
          )}
        </span>

      </td>

    </tr>
  );
}

// =============================================================
// MOBILE CARD
// =============================================================

function BreakMobileCard({
  item,
  formatDateTime,
  formatDateOnly,
  formatDuration,
  getTypeIcon,
  getTypeStyles,
  isActiveBreak,
  getLiveDuration,
}) {
  const employeeName =
    item.employee_name ||
    item.user_name ||
    item.name ||
    "Unknown Employee";

  const employeeEmail =
    item.employee_email ||
    item.user_email ||
    item.email ||
    "";

  const team =
    item.team ||
    item.department ||
    item.team_name ||
    "—";

  const breakType =
    normalizeBreakType(
      item
    );

  const TypeIcon =
    getTypeIcon(
      breakType
    );

  const styles =
    getTypeStyles(
      breakType
    );

  const active =
    isActiveBreak(
      item
    );

  const duration =
    getLiveDuration(
      item
    );

  return (
    <div className="p-4">

      {/* TOP */}

      <div className="flex items-start justify-between gap-3">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-600">
            {employeeName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="min-w-0">

            <p className="truncate text-sm font-bold text-slate-800">
              {employeeName}
            </p>

            {employeeEmail && (
              <p className="truncate text-xs text-slate-400">
                {employeeEmail}
              </p>
            )}

          </div>

        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold ${styles.bg} ${styles.text} ${styles.border}`}
        >
          <TypeIcon className="h-3 w-3" />
          {breakType}
        </span>

      </div>

      {/* TEAM */}

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">

        <Users className="h-3.5 w-3.5 text-slate-400" />

        <span>
          {team}
        </span>

      </div>

      {/* DATE */}

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">

        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />

        <span>
          {formatDateOnly(
            item.started_at
          )}
        </span>

      </div>

      {/* TIME */}

      <div className="mt-4 grid grid-cols-2 gap-3">

        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Started
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-700">
            {formatDateTime(
              item.started_at
            )}
          </p>

        </div>

        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Ended
          </p>

          {active ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">

              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />

              Active

            </p>
          ) : (
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {formatDateTime(
                item.ended_at
              )}
            </p>
          )}

        </div>

      </div>

      {/* DURATION */}

      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-3">

        <div className="flex items-center gap-2">

          <Timer className="h-4 w-4 text-slate-400" />

          <span className="text-xs font-semibold text-slate-500">
            Duration
          </span>

        </div>

        <span
          className={`text-sm font-bold ${
            active
              ? "text-emerald-600"
              : "text-slate-800"
          }`}
        >
          {formatDuration(
            duration
          )}
        </span>

      </div>

    </div>
  );
}