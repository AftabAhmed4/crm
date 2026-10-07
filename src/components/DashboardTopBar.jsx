"use client";

import {
  Bell,
  MessageCircle,
  Calendar,
  ChevronDown,
  Clock3,
  CircleOff,
  LogOut,
  Menu,
  Moon,
  Phone,
  Utensils,
  User,
  Users,
  Check,
  MoreHorizontal,
  BriefcaseBusiness,
  Coffee,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// ============================================================
// CONFIG
// ============================================================

const CALIFORNIA_TIMEZONE = "America/Los_Angeles";

const MAX_BREAKS = 5;

// ============================================================
// BREAK LIMITS
// IMPORTANT:
// These must match /api/users/status
// ============================================================

const BREAK_LIMITS = {
  "Short Break": {
    minutes: 10,
    maxUses: 3,
  },

  "Lunch Break": {
    minutes: 30,
    maxUses: 1,
  },

  "Namaz Break": {
    minutes: 15,
    maxUses: 1,
  },
};

const BREAK_STATUSES = Object.keys(BREAK_LIMITS);

const EMPTY_BREAK_USAGE = {
  "Short Break": 0,
  "Lunch Break": 0,
  "Namaz Break": 0,
};

// ============================================================
// COMPONENT
// ============================================================

export default function DashboardTopBar({
  onMenuClick,
  onLogout,
}) {
  // ============================================================
  // USER
  // ============================================================

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // ============================================================
  // STATUS
  // ============================================================

  const [status, setStatus] = useState("Active");
  const [statusStartedAt, setStatusStartedAt] = useState(null);
  const [statusDropdownOpen, setStatusDropdownOpen] =
    useState(false);

  // ============================================================
  // BREAK USAGE
  // BACKEND IS SOURCE OF TRUTH
  // ============================================================

  const [breakUsage, setBreakUsage] =
    useState(EMPTY_BREAK_USAGE);

  // ============================================================
  // TIMER
  // ============================================================

  const [timerOpen, setTimerOpen] = useState(false);
  const [timerStatus, setTimerStatus] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // true = newly started break
  // false = restored from backend
  const [isNewTimer, setIsNewTimer] = useState(false);

  // Exact browser timestamp for a newly started break.
  // Used only for immediate UI timer accuracy.
  const newBreakStartedAtRef = useRef(null);

  // Prevent duplicate auto-end requests.
  const autoEndingBreakRef = useRef(false);

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  const [notifications, setNotifications] = useState([]);
  const [notificationOpen, setNotificationOpen] =
    useState(false);

  const notificationRef = useRef(null);
  const previousUnreadCountRef = useRef(null);
  const notificationSoundRef = useRef(null);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioCtor =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioCtor) {
        return;
      }

      if (!notificationSoundRef.current) {
        notificationSoundRef.current =
          new AudioCtor();
      }

      const audioContext =
        notificationSoundRef.current;

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const startTime =
        audioContext.currentTime + 0.02;
      const tones = [640, 860, 1180];

      tones.forEach((frequency, index) => {
        const oscillator =
          audioContext.createOscillator();
        const gainNode =
          audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          frequency,
          startTime + index * 0.12
        );

        gainNode.gain.setValueAtTime(
          0.0001,
          startTime + index * 0.12
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.12,
          startTime + index * 0.12 + 0.03
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          startTime + index * 0.12 + 0.22
        );

        oscillator.connect(gainNode);
        gainNode.connect(
          audioContext.destination
        );

        oscillator.start(
          startTime + index * 0.12
        );
        oscillator.stop(
          startTime + index * 0.12 + 0.24
        );
      });
    } catch (error) {
      console.error(
        "Notification sound error:",
        error
      );
    }
  }, []);

  // ============================================================
  // OFFICE CLOSING
  // ============================================================

  const [officeClosingWarning, setOfficeClosingWarning] =
    useState(false);

  const [officeClosed, setOfficeClosed] = useState(false);

  const officeClosingNotificationSent =
    useRef({});

  // ============================================================
  // LOGIN DETAILS
  // ============================================================

  const [loginDetails, setLoginDetails] = useState({
    day: "",
    date: "",
    time: "",
  });

  // ============================================================
  // STATUS OPTIONS
  // ============================================================

  const statusOptions = useMemo(
    () => [
      {
        value: "Active",
        label: "Active",
        icon: Check,
        color: "text-green-600",
        bg: "bg-green-50",
      },

      {
        value: "Namaz Break",
        label: "Namaz Break",
        icon: Moon,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
      },

      {
        value: "Lunch Break",
        label: "Lunch Break",
        icon: Utensils,
        color: "text-orange-600",
        bg: "bg-orange-50",
      },

      {
        value: "Short Break",
        label: "Short Break",
        icon: Clock3,
        color: "text-teal-600",
        bg: "bg-teal-50",
      },

      {
        value: "Inactive",
        label: "Inactive",
        icon: CircleOff,
        color: "text-red-600",
        bg: "bg-red-50",
        adminOnly: true,
      },

      {
        value: "On Call",
        label: "On Call",
        icon: Phone,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },

      {
        value: "Meeting",
        label: "Meeting",
        icon: Users,
        color: "text-purple-600",
        bg: "bg-purple-50",
      },

      {
        value: "Washroom Break",
        label: "Washroom Break",
        icon: Coffee,
        color: "text-cyan-600",
        bg: "bg-cyan-50",
      },

      {
        value: "Other",
        label: "Other",
        icon: MoreHorizontal,
        color: "text-gray-600",
        bg: "bg-gray-50",
      },
    ],
    []
  );

  const isAdmin =
    String(currentUser?.role || "").toLowerCase() ===
    "admin";

  const visibleStatusOptions = useMemo(() => {
    if (isAdmin) {
      return statusOptions;
    }

    return statusOptions.filter((item) =>
      [
        "Active",
        "Namaz Break",
        "Lunch Break",
        "Short Break",
      ].includes(item.value)
    );
  }, [statusOptions, isAdmin]);

  // ============================================================
  // LOGIN CLOCK
  // ============================================================

  useEffect(() => {
    const updateLoginDetails = () => {
      const now = new Date();

      setLoginDetails({
        day: now.toLocaleDateString("en-US", {
          weekday: "long",
          timeZone: CALIFORNIA_TIMEZONE,
        }),

        date: now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: CALIFORNIA_TIMEZONE,
        }),

        time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: CALIFORNIA_TIMEZONE,
        }),
      });
    };

    updateLoginDetails();

    const interval = setInterval(
      updateLoginDetails,
      1000
    );

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // FORMAT TIMER
  // ============================================================

  const formatTimer = (totalSeconds) => {
    const seconds = Math.max(
      0,
      Math.floor(Number(totalSeconds) || 0)
    );

    const hours = Math.floor(seconds / 3600);

    const minutes = Math.floor(
      (seconds % 3600) / 60
    );

    const secs = seconds % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(secs).padStart(2, "0"),
    ].join(":");
  };

  // ============================================================
  // CALIFORNIA ELAPSED TIME
  // ============================================================

  const calculateElapsedTime = (startedAt) => {
    if (!startedAt) {
      return 0;
    }

    try {
      const value = String(startedAt).trim();

      let startDate;

      // ========================================================
      // ISO / TIMEZONE AWARE
      // ========================================================

      if (
        value.includes("T") ||
        value.includes("Z") ||
        /[+-]\d{2}:\d{2}$/.test(value)
      ) {
        startDate = new Date(value);
      } else {
        // ======================================================
        // MYSQL DATETIME
        // ======================================================

        const match = value.match(
          /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
        );

        if (!match) {
          startDate = new Date(value);
        } else {
          const [
            ,
            year,
            month,
            day,
            hour,
            minute,
            second,
          ] = match;

          const utcMs = Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second)
          );

          const getOffsetMinutes = (date) => {
            try {
              const formatter =
                new Intl.DateTimeFormat(
                  "en-US",
                  {
                    timeZone:
                      CALIFORNIA_TIMEZONE,

                    timeZoneName:
                      "longOffset",

                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hourCycle: "h23",
                  }
                );

              const parts =
                formatter.formatToParts(date);

              const zonePart =
                parts.find(
                  (part) =>
                    part.type ===
                    "timeZoneName"
                );

              const offsetMatch =
                zonePart?.value?.match(
                  /GMT([+-])(\d{2}):(\d{2})/
                );

              if (!offsetMatch) {
                return 0;
              }

              const sign =
                offsetMatch[1] === "-"
                  ? -1
                  : 1;

              return (
                sign *
                (
                  Number(
                    offsetMatch[2]
                  ) *
                    60 +
                  Number(
                    offsetMatch[3]
                  )
                )
              );
            } catch {
              return 0;
            }
          };

          const offsetMinutes =
            getOffsetMinutes(
              new Date(utcMs)
            );

          const correctedUtcMs =
            utcMs -
            offsetMinutes *
              60 *
              1000;

          startDate =
            new Date(
              correctedUtcMs
            );
        }
      }

      if (
        !startDate ||
        Number.isNaN(
          startDate.getTime()
        )
      ) {
        return 0;
      }

      const elapsed = Math.floor(
        (
          Date.now() -
          startDate.getTime()
        ) / 1000
      );

      return Math.max(
        0,
        elapsed
      );
    } catch (error) {
      console.error(
        "Timer calculation error:",
        error
      );

      return 0;
    }
  };

  // ============================================================
  // CALIFORNIA DATE
  // ============================================================

  const getCaliforniaDate = () => {
    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          CALIFORNIA_TIMEZONE,

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date());
  };

  // ============================================================
  // CALIFORNIA TIME
  // ============================================================

  const getCaliforniaTimeParts = () => {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            CALIFORNIA_TIMEZONE,

          weekday: "short",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }
      ).formatToParts(
        new Date()
      );

    const getPart = (type) =>
      parts.find(
        (part) =>
          part.type === type
      )?.value;

    return {
      weekday: getPart("weekday"),
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
      hour: Number(
        getPart("hour") || 0
      ),
      minute: Number(
        getPart("minute") || 0
      ),
      second: Number(
        getPart("second") || 0
      ),
    };
  };

  // ============================================================
  // BREAK WINDOW
  //
  // 12:00 AM - 7:59 AM = ALLOWED
  // 8:00 AM - 8:59 AM = BLOCKED
  // 9:00 AM onward      = ALLOWED
  //
  // Backend remains final authority.
  // ============================================================

  const isBreakStartBlockedByTime = () => {
    const {
      hour,
    } = getCaliforniaTimeParts();

    return hour === 8;
  };

  // ============================================================
  // FETCH CURRENT USER
  // ============================================================

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(
          "/api/auth/me",
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

        setCurrentUser(
          data?.user ||
            data ||
            null
        );
      } catch (error) {
        console.error(
          "Current user error:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // ============================================================
  // RESTORE STATUS + BREAK USAGE FROM BACKEND
  //
  // IMPORTANT:
  // NO LOCAL STORAGE IS USED FOR BREAK COUNTS.
  // Backend rolling 24h calculation is source of truth.
  // ============================================================

  useEffect(() => {
    const restoreStatus = async () => {
      try {
        const response = await fetch(
          "/api/users/status",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Cache-Control":
                "no-cache",
            },
          }
        );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        const currentStatus =
          data?.status ||
          "Active";

        // ======================================================
        // BACKEND BREAK USAGE
        // ======================================================

        const backendUsage =
          data?.break_usage ||
          data?.breakUsage ||
          data?.usage ||
          null;

        if (
          backendUsage &&
          typeof backendUsage ===
            "object"
        ) {
          setBreakUsage({
            "Short Break": Math.min(
              Math.max(
                0,
                Number(
                  backendUsage[
                    "Short Break"
                  ] ??
                    backendUsage.short_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Short Break"
              ].maxUses
            ),

            "Lunch Break": Math.min(
              Math.max(
                0,
                Number(
                  backendUsage[
                    "Lunch Break"
                  ] ??
                    backendUsage.lunch_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Lunch Break"
              ].maxUses
            ),

            "Namaz Break": Math.min(
              Math.max(
                0,
                Number(
                  backendUsage[
                    "Namaz Break"
                  ] ??
                    backendUsage.namaz_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Namaz Break"
              ].maxUses
            ),
          });
        } else {
          setBreakUsage({
            ...EMPTY_BREAK_USAGE,
          });
        }

        setStatus(
          currentStatus
        );

        // ======================================================
        // ACTIVE
        // ======================================================

        if (
          currentStatus ===
          "Active"
        ) {
          setTimerOpen(false);
          setTimerStatus(null);
          setStatusStartedAt(null);
          setTimerSeconds(0);
          setIsNewTimer(false);

          newBreakStartedAtRef.current =
            null;

          autoEndingBreakRef.current =
            false;

          return;
        }

        // ======================================================
        // NON-BREAK STATUS
        // ======================================================

        if (
          !BREAK_LIMITS[
            currentStatus
          ]
        ) {
          setTimerOpen(false);
          setTimerStatus(null);
          setStatusStartedAt(null);
          setTimerSeconds(0);
          setIsNewTimer(false);

          newBreakStartedAtRef.current =
            null;

          autoEndingBreakRef.current =
            false;

          return;
        }

        // ======================================================
        // EXISTING BREAK
        // ======================================================

        const startedAt =
          data?.status_started_at ||
          data?.statusStartedAt ||
          null;

        const apiDurationSeconds =
          Number(
            data?.timer
              ?.durationLimitSeconds ??
              data?.timer
                ?.duration_limit_seconds ??
              data?.durationLimitSeconds ??
              0
          );

        const configuredMaxSeconds =
          BREAK_LIMITS[
            currentStatus
          ].minutes * 60;

        const maxSeconds =
          apiDurationSeconds > 0
            ? Math.min(
                apiDurationSeconds,
                configuredMaxSeconds
              )
            : configuredMaxSeconds;

        setTimerStatus(
          currentStatus
        );

        setStatusStartedAt(
          startedAt
        );

        setIsNewTimer(false);

        newBreakStartedAtRef.current =
          null;

        const apiElapsedSeconds =
          Number(
            data?.timer
              ?.elapsedSeconds ??
              data?.timer
                ?.elapsed_seconds ??
              data?.elapsedSeconds ??
              NaN
          );

        const calculatedElapsed =
          Number.isFinite(
            apiElapsedSeconds
          )
            ? apiElapsedSeconds
            : calculateElapsedTime(
                startedAt
              );

        setTimerSeconds(
          Math.min(
            Math.max(
              0,
              Math.floor(
                calculatedElapsed
              )
            ),
            maxSeconds
          )
        );

        setTimerOpen(true);
      } catch (error) {
        console.error(
          "Restore status error:",
          error
        );
      }
    };

    restoreStatus();
  }, []);

  // ============================================================
  // MAIN TIMER EFFECT
  //
  // Timer can NEVER display above configured/API maximum.
  // ============================================================

  useEffect(() => {
    if (
      !timerOpen ||
      !timerStatus
    ) {
      return;
    }

    const breakLimit =
      BREAK_LIMITS[
        timerStatus
      ];

    if (!breakLimit) {
      return;
    }

    const maxSeconds =
      breakLimit.minutes * 60;

    const updateTimer = () => {
      let elapsed = 0;

      // ========================================================
      // NEW BREAK
      // ========================================================

      if (
        isNewTimer &&
        newBreakStartedAtRef.current
      ) {
        elapsed = Math.floor(
          (
            Date.now() -
            newBreakStartedAtRef.current
          ) / 1000
        );
      }

      // ========================================================
      // RESTORED BREAK
      // ========================================================

      else if (
        !isNewTimer &&
        statusStartedAt
      ) {
        elapsed =
          calculateElapsedTime(
            statusStartedAt
          );
      }

      // ========================================================
      // HARD SAFETY
      // ========================================================

      const safeElapsed =
        Math.min(
          Math.max(
            0,
            elapsed
          ),
          maxSeconds
        );

      setTimerSeconds(
        safeElapsed
      );
    };

    updateTimer();

    const interval =
      setInterval(
        updateTimer,
        250
      );

    return () =>
      clearInterval(
        interval
      );
  }, [
    timerOpen,
    timerStatus,
    statusStartedAt,
    isNewTimer,
  ]);

  // ============================================================
  // AUTO END BREAK
  // ============================================================

  useEffect(() => {
    if (
      !timerOpen ||
      !timerStatus
    ) {
      return;
    }

    const breakLimit =
      BREAK_LIMITS[
        timerStatus
      ];

    if (!breakLimit) {
      return;
    }

    const maxSeconds =
      breakLimit.minutes * 60;

    if (
      timerSeconds <
      maxSeconds
    ) {
      return;
    }

    if (
      autoEndingBreakRef.current
    ) {
      return;
    }

    autoEndingBreakRef.current =
      true;

    const autoEndBreak =
      async () => {
        try {
          const response =
            await fetch(
              "/api/users/status",
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials:
                  "include",

                body:
                  JSON.stringify({
                    status:
                      "Active",
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
            console.error(
              "Auto end break failed:",
              data
            );

            autoEndingBreakRef.current =
              false;

            return;
          }

          // ====================================================
          // RESET
          // ====================================================

          setStatus(
            "Active"
          );

          setTimerOpen(
            false
          );

          setTimerStatus(
            null
          );

          setStatusStartedAt(
            null
          );

          setTimerSeconds(
            0
          );

          setIsNewTimer(
            false
          );

          newBreakStartedAtRef.current =
            null;

          autoEndingBreakRef.current =
            false;

          // ====================================================
          // REFRESH BACKEND USAGE
          // ====================================================

          if (
            data?.break_usage ||
            data?.breakUsage ||
            data?.usage
          ) {
            const usage =
              data?.break_usage ||
              data?.breakUsage ||
              data?.usage;

            setBreakUsage({
              "Short Break": Math.min(
                Math.max(
                  0,
                  Number(
                    usage[
                      "Short Break"
                    ] ??
                      usage.short_break ??
                      0
                  )
                ),
                BREAK_LIMITS[
                  "Short Break"
                ].maxUses
              ),

              "Lunch Break": Math.min(
                Math.max(
                  0,
                  Number(
                    usage[
                      "Lunch Break"
                    ] ??
                      usage.lunch_break ??
                      0
                  )
                ),
                BREAK_LIMITS[
                  "Lunch Break"
                ].maxUses
              ),

              "Namaz Break": Math.min(
                Math.max(
                  0,
                  Number(
                    usage[
                      "Namaz Break"
                    ] ??
                      usage.namaz_break ??
                      0
                  )
                ),
                BREAK_LIMITS[
                  "Namaz Break"
                ].maxUses
              ),
            });
          }
        } catch (error) {
          console.error(
            "Auto end break error:",
            error
          );

          autoEndingBreakRef.current =
            false;
        }
      };

    autoEndBreak();
  }, [
    timerSeconds,
    timerOpen,
    timerStatus,
  ]);

  // ============================================================
  // CHANGE STATUS
  // ============================================================

  const handleStatusChange =
    async (newStatus) => {
      if (loading) {
        return;
      }

      if (
        newStatus ===
        status
      ) {
        setStatusDropdownOpen(
          false
        );

        return;
      }

      // ========================================================
      // BREAK
      // ========================================================

      const breakLimit =
        BREAK_LIMITS[
          newStatus
        ];

      if (breakLimit) {
        // ======================================================
        // 8:00 AM - 8:59 AM CALIFORNIA BLOCK
        // ======================================================

        if (
          isBreakStartBlockedByTime()
        ) {
          alert(
            "Breaks cannot be started between 8:00 AM and 9:00 AM California time."
          );

          setStatusDropdownOpen(
            false
          );

          return;
        }

        // ======================================================
        // FRONTEND CHECK
        // Backend remains final authority.
        // ======================================================

        const used =
          Number(
            breakUsage[
              newStatus
            ] || 0
          );

        if (
          used >=
          breakLimit.maxUses
        ) {
          alert(
            `${newStatus} limit reached. You can use this break ${breakLimit.maxUses} time${
              breakLimit.maxUses ===
              1
                ? ""
                : "s"
            } within the rolling 24 hours.`
          );

          setStatusDropdownOpen(
            false
          );

          return;
        }
      }

      const previousStatus =
        status;

      const previousTimerStatus =
        timerStatus;

      const previousStartedAt =
        statusStartedAt;

      const previousTimerSeconds =
        timerSeconds;

      const previousIsNewTimer =
        isNewTimer;

      try {
        setLoading(true);

        // ======================================================
        // API
        // ======================================================

        const response =
          await fetch(
            "/api/users/status",
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body:
                JSON.stringify({
                  status:
                    newStatus,
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

        // ======================================================
        // ERROR
        // ======================================================

        if (!response.ok) {
          if (
            response.status ===
            429
          ) {
            alert(
              data?.message ||
                "Maximum break limit reached."
            );
          } else {
            alert(
              data?.message ||
                "Failed to update status."
            );
          }

          return;
        }

        // ======================================================
        // ACTIVE
        // ======================================================

        if (
          newStatus ===
          "Active"
        ) {
          setStatus(
            "Active"
          );

          setTimerOpen(
            false
          );

          setTimerStatus(
            null
          );

          setStatusStartedAt(
            null
          );

          setTimerSeconds(
            0
          );

          setIsNewTimer(
            false
          );

          newBreakStartedAtRef.current =
            null;

          autoEndingBreakRef.current =
            false;

          setStatusDropdownOpen(
            false
          );

          // ====================================================
          // USE BACKEND USAGE IF RETURNED
          // ====================================================

          const returnedUsage =
            data?.break_usage ||
            data?.breakUsage ||
            data?.usage;

          if (
            returnedUsage &&
            typeof returnedUsage ===
              "object"
          ) {
            setBreakUsage({
              "Short Break": Math.min(
                Math.max(
                  0,
                  Number(
                    returnedUsage[
                      "Short Break"
                    ] ??
                      returnedUsage.short_break ??
                      0
                  )
                ),
                BREAK_LIMITS[
                  "Short Break"
                ].maxUses
              ),

              "Lunch Break": Math.min(
                Math.max(
                  0,
                  Number(
                    returnedUsage[
                      "Lunch Break"
                    ] ??
                      returnedUsage.lunch_break ??
                      0
                  )
                ),
                BREAK_LIMITS[
                  "Lunch Break"
                ].maxUses
              ),

              "Namaz Break": Math.min(
                Math.max(
                  0,
                  Number(
                    returnedUsage[
                      "Namaz Break"
                    ] ??
                      returnedUsage.namaz_break ??
                      0
                  )
                ),
                BREAK_LIMITS[
                  "Namaz Break"
                ].maxUses
              ),
            });
          }

          return;
        }

        // ======================================================
        // NON-BREAK STATUS
        // ======================================================

        if (
          !BREAK_LIMITS[
            newStatus
          ]
        ) {
          setStatus(
            newStatus
          );

          setTimerOpen(
            false
          );

          setTimerStatus(
            null
          );

          setStatusStartedAt(
            data?.status_started_at ||
              data?.statusStartedAt ||
              null
          );

          setTimerSeconds(
            0
          );

          setIsNewTimer(
            false
          );

          newBreakStartedAtRef.current =
            null;

          autoEndingBreakRef.current =
            false;

          setStatusDropdownOpen(
            false
          );

          return;
        }

        // ======================================================
        // NEW BREAK
        // ======================================================

        const clientBreakStartedAt =
          Date.now();

        newBreakStartedAtRef.current =
          clientBreakStartedAt;

        setStatus(
          newStatus
        );

        setTimerStatus(
          newStatus
        );

        // ALWAYS START FROM ZERO
        setTimerSeconds(
          0
        );

        setIsNewTimer(
          true
        );

        // Backend timestamp retained
        // for restoration.
        setStatusStartedAt(
          data?.status_started_at ||
            data?.statusStartedAt ||
            null
        );

        // ======================================================
        // BACKEND USAGE
        // ======================================================

        const returnedUsage =
          data?.break_usage ||
          data?.breakUsage ||
          data?.usage;

        if (
          returnedUsage &&
          typeof returnedUsage ===
            "object"
        ) {
          setBreakUsage({
            "Short Break": Math.min(
              Math.max(
                0,
                Number(
                  returnedUsage[
                    "Short Break"
                  ] ??
                    returnedUsage.short_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Short Break"
              ].maxUses
            ),

            "Lunch Break": Math.min(
              Math.max(
                0,
                Number(
                  returnedUsage[
                    "Lunch Break"
                  ] ??
                    returnedUsage.lunch_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Lunch Break"
              ].maxUses
            ),

            "Namaz Break": Math.min(
              Math.max(
                0,
                Number(
                  returnedUsage[
                    "Namaz Break"
                  ] ??
                    returnedUsage.namaz_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Namaz Break"
              ].maxUses
            ),
          });
        } else {
          // ====================================================
          // FALLBACK ONLY
          // If API doesn't return usage, increment local
          // successful usage for immediate UI.
          // ====================================================

          setBreakUsage(
            (previous) => ({
              ...previous,

              [newStatus]:
                Math.min(
                  Number(
                    previous[
                      newStatus
                    ] || 0
                  ) + 1,
                  breakLimit.maxUses
                ),
            })
          );
        }

        autoEndingBreakRef.current =
          false;

        setTimerOpen(
          true
        );

        setStatusDropdownOpen(
          false
        );
      } catch (error) {
        console.error(
          "Status change error:",
          error
        );

        // ======================================================
        // RESTORE PREVIOUS STATE
        // ======================================================

        setStatus(
          previousStatus
        );

        setTimerStatus(
          previousTimerStatus
        );

        setStatusStartedAt(
          previousStartedAt
        );

        setTimerSeconds(
          previousTimerSeconds
        );

        setIsNewTimer(
          previousIsNewTimer
        );

        if (
          !previousIsNewTimer
        ) {
          newBreakStartedAtRef.current =
            null;
        }

        alert(
          "Something went wrong while changing status."
        );
      } finally {
        setLoading(false);
      }
    };

  // ============================================================
  // END TIMER / ACTIVE
  // ============================================================

  const endStatusTimer =
    async () => {
      if (loading) {
        return;
      }

      try {
        setLoading(true);

        const response =
          await fetch(
            "/api/users/status",
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body:
                JSON.stringify({
                  status:
                    "Active",
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
          alert(
            data?.message ||
              "Unable to end break."
          );

          return;
        }

        setStatus(
          "Active"
        );

        setTimerOpen(
          false
        );

        setTimerStatus(
          null
        );

        setStatusStartedAt(
          null
        );

        setTimerSeconds(
          0
        );

        setIsNewTimer(
          false
        );

        newBreakStartedAtRef.current =
          null;

        autoEndingBreakRef.current =
          false;

        // ======================================================
        // REFRESH BACKEND BREAK USAGE
        // ======================================================

        const returnedUsage =
          data?.break_usage ||
          data?.breakUsage ||
          data?.usage;

        if (
          returnedUsage &&
          typeof returnedUsage ===
            "object"
        ) {
          setBreakUsage({
            "Short Break": Math.min(
              Math.max(
                0,
                Number(
                  returnedUsage[
                    "Short Break"
                  ] ??
                    returnedUsage.short_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Short Break"
              ].maxUses
            ),

            "Lunch Break": Math.min(
              Math.max(
                0,
                Number(
                  returnedUsage[
                    "Lunch Break"
                  ] ??
                    returnedUsage.lunch_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Lunch Break"
              ].maxUses
            ),

            "Namaz Break": Math.min(
              Math.max(
                0,
                Number(
                  returnedUsage[
                    "Namaz Break"
                  ] ??
                    returnedUsage.namaz_break ??
                    0
                )
              ),
              BREAK_LIMITS[
                "Namaz Break"
              ].maxUses
            ),
          });
        }
      } catch (error) {
        console.error(
          "End timer error:",
          error
        );

        alert(
          "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    };

  // ============================================================
  // NOTIFICATION TIME
  // ============================================================

  const formatNotificationTime =
    (dateValue) => {
      if (!dateValue) {
        return "";
      }

      const date =
        new Date(dateValue);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "";
      }

      return date.toLocaleString(
        "en-US",
        {
          timeZone:
            CALIFORNIA_TIMEZONE,

          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
      );
    };

  // ============================================================
  // NOTIFICATION ICON
  // ============================================================

  const getNotificationIcon =
    (notification) => {
      const type =
        String(
          notification?.type ||
            ""
        ).toLowerCase();

      if (
        type ===
        "message"
      ) {
        return (
          <MessageCircle className="h-4 w-4" />
        );
      }

      if (
        type === "call"
      ) {
        return (
          <Phone className="h-4 w-4" />
        );
      }

      if (
        type === "task"
      ) {
        return (
          <BriefcaseBusiness className="h-4 w-4" />
        );
      }

      if (
        type === "break"
      ) {
        return (
          <Coffee className="h-4 w-4" />
        );
      }

      return (
        <Bell className="h-4 w-4" />
      );
    };

  // ============================================================
  // NORMALIZE NOTIFICATION
  // ============================================================

  const normalizeNotification =
    (item) => {
      return {
        ...item,

        id: item?.id,

        is_read: Number(
          item?.is_read || 0
        ),

        read:
          Number(
            item?.is_read || 0
          ) === 1,
      };
    };

  // ============================================================
  // MARK ONE NOTIFICATION READ
  // ============================================================

  const markNotificationRead =
    async (
      notificationId
    ) => {
      if (!notificationId) {
        return;
      }

      try {
        const response =
          await fetch(
            "/api/notifications",
            {
              method: "PATCH",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  id:
                    notificationId,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.success
        ) {
          console.error(
            "Mark notification read failed:",
            data
          );

          return;
        }

        setNotifications(
          (previous) =>
            previous.map(
              (item) =>
                Number(
                  item.id
                ) ===
                Number(
                  notificationId
                )
                  ? {
                      ...item,
                      is_read: 1,
                      read: true,
                    }
                  : item
            )
        );
      } catch (error) {
        console.error(
          "Mark notification read error:",
          error
        );
      }
    };

  // ============================================================
  // MARK ALL READ
  // ============================================================

  const markAllNotificationsRead =
    async () => {
      try {
        const response =
          await fetch(
            "/api/notifications",
            {
              method: "PATCH",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  all: true,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.success
        ) {
          console.error(
            "Mark all notifications read failed:",
            data
          );

          return;
        }

        setNotifications(
          (previous) =>
            previous.map(
              (item) => ({
                ...item,
                is_read: 1,
                read: true,
              })
            )
        );
      } catch (error) {
        console.error(
          "Mark all notifications read error:",
          error
        );
      }
    };

  // ============================================================
  // FETCH NOTIFICATIONS
  // ============================================================

  const fetchNotifications =
    async () => {
      try {
        const response =
          await fetch(
            "/api/notifications?unread=true&limit=100",
            {
              method: "GET",

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

        if (!response.ok) {
          console.error(
            "Notifications API failed:",
            response.status
          );

          return;
        }

        const data =
          await response.json();

        if (!data?.success) {
          console.error(
            "Notifications API error:",
            data
          );

          return;
        }

        const notificationList =
          Array.isArray(
            data?.notifications
          )
            ? data.notifications
            : [];

        setNotifications(
          notificationList.map(
            normalizeNotification
          )
        );
      } catch (error) {
        console.error(
          "Fetch notifications error:",
          error
        );
      }
    };

  // ============================================================
  // NOTIFICATION POLLING
  // ============================================================

  useEffect(() => {
    fetchNotifications();

    const interval =
      setInterval(
        fetchNotifications,
        5000
      );

    return () =>
      clearInterval(
        interval
      );
  }, []);

  useEffect(() => {
    const unreadCountNow =
      notifications.filter(
        (item) =>
          Number(item?.is_read || 0) === 0
      ).length;

    if (
      previousUnreadCountRef.current !== null &&
      unreadCountNow >
        previousUnreadCountRef.current
    ) {
      playNotificationSound();
    }

    previousUnreadCountRef.current =
      unreadCountNow;
  }, [notifications, playNotificationSound]);

  // ============================================================
  // CLICK OUTSIDE NOTIFICATION
  // ============================================================

  useEffect(() => {
    const handleClickOutside =
      (event) => {
        if (
          notificationRef.current &&
          !notificationRef.current.contains(
            event.target
          )
        ) {
          setNotificationOpen(
            false
          );
        }
      };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // ============================================================
  // OFFICE CLOSING
  // ============================================================

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const checkOfficeClosing =
      async () => {
        try {
          const now =
            new Date();

          const parts =
            new Intl.DateTimeFormat(
              "en-US",
              {
                timeZone:
                  CALIFORNIA_TIMEZONE,

                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }
            ).formatToParts(
              now
            );

          const getPart =
            (type) =>
              parts.find(
                (part) =>
                  part.type ===
                  type
              )?.value;

          const weekday =
            getPart(
              "weekday"
            );

          const year =
            getPart("year");

          const month =
            getPart("month");

          const day =
            getPart("day");

          const hour =
            Number(
              getPart("hour")
            );

          const minute =
            Number(
              getPart("minute")
            );

          // Weekend OFF
          if (
            weekday === "Sat" ||
            weekday === "Sun"
          ) {
            setOfficeClosingWarning(
              false
            );

            setOfficeClosed(
              false
            );

            return;
          }

          const californiaDate =
            `${year}-${month}-${day}`;

          const currentMinutes =
            hour * 60 +
            minute;

          const OFFICE_CLOSE_MINUTES =
            17 * 60;

          const WARNING_MINUTES =
            16 * 60 + 55;

          // 4:55 PM - 4:59 PM
          if (
            currentMinutes >=
              WARNING_MINUTES &&
            currentMinutes <
              OFFICE_CLOSE_MINUTES
          ) {
            setOfficeClosingWarning(
              true
            );

            setOfficeClosed(
              false
            );

            const notificationKey =
              `office-closing-${currentUser.id}-${californiaDate}`;

            if (
              officeClosingNotificationSent
                .current[
                notificationKey
              ]
            ) {
              return;
            }

            const storageKey =
              "crm_office_closing_notifications";

            let sentNotifications =
              {};

            try {
              sentNotifications =
                JSON.parse(
                  localStorage.getItem(
                    storageKey
                  )
                ) || {};
            } catch {
              sentNotifications =
                {};
            }

            if (
              sentNotifications[
                notificationKey
              ]
            ) {
              officeClosingNotificationSent
                .current[
                notificationKey
              ] = true;

              return;
            }

            const response =
              await fetch(
                "/api/notifications",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body:
                    JSON.stringify({
                      user_id:
                        Number(
                          currentUser.id
                        ),

                      title:
                        "Office Closing Soon",

                      message:
                        "Office closing time is in 5 minutes. Please complete and save your pending work.",

                      type:
                        "general",
                    }),
                }
              );

            const data =
              await response.json();

            if (
              response.ok &&
              data?.success
            ) {
              officeClosingNotificationSent
                .current[
                notificationKey
              ] = true;

              sentNotifications[
                notificationKey
              ] = true;

              localStorage.setItem(
                storageKey,
                JSON.stringify(
                  sentNotifications
                )
              );

              await fetchNotifications();
            }
          } else if (
            currentMinutes >=
            OFFICE_CLOSE_MINUTES
          ) {
            setOfficeClosingWarning(
              false
            );

            setOfficeClosed(
              true
            );
          } else {
            setOfficeClosingWarning(
              false
            );

            setOfficeClosed(
              false
            );
          }
        } catch (error) {
          console.error(
            "Office closing check error:",
            error
          );
        }
      };

    checkOfficeClosing();

    const interval =
      setInterval(
        checkOfficeClosing,
        10000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [currentUser?.id]);

  // ============================================================
  // UNREAD COUNT
  // ============================================================

  const unreadCount =
    notifications.filter(
      (item) =>
        Number(
          item?.is_read || 0
        ) === 0
    ).length;

  // ============================================================
  // PROFILE IMAGE
  // ============================================================

  const profileImage =
    currentUser?.avatar ||
    currentUser?.image ||
    currentUser?.profilePic ||
    currentUser?.avatarUrl ||
    currentUser?.profile_picture ||
    null;

  // ============================================================
  // USER
  // ============================================================

  const userId =
    currentUser?.id ||
    null;

  const userName =
    currentUser?.name ||
    currentUser?.full_name ||
    currentUser?.username ||
    "User";

  const userRole =
    currentUser?.role ||
    "Agent";

  // ============================================================
  // CURRENT STATUS INFO
  // ============================================================

  const currentStatusInfo =
    statusOptions.find(
      (item) =>
        item.value ===
        status
    ) ||
    statusOptions[0];

  const CurrentStatusIcon =
    currentStatusInfo?.icon ||
    Check;

  // ============================================================
  // CURRENT BREAK INFO
  // ============================================================

  const currentBreakLimit =
    timerStatus
      ? BREAK_LIMITS[
          timerStatus
        ]
      : null;

  const currentBreakUsed =
    timerStatus
      ? Number(
          breakUsage[
            timerStatus
          ] || 0
        )
      : 0;

  // ============================================================
  // TOTAL BREAK USAGE
  // ============================================================

  const totalBreakUsage =
    Object.values(
      breakUsage
    ).reduce(
      (
        total,
        value
      ) =>
        total +
        Number(
          value || 0
        ),
      0
    );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

          {/* LEFT */}

          <div className="flex min-w-0 items-center gap-3">

            {onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 lg:hidden"
              >
                <Menu size={20} />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
                Dashboard
              </h1>

              <p className="hidden truncate text-sm text-gray-500 sm:block">
                Call Activity & Performance Analytics
              </p>
            </div>
          </div>

          {/* RIGHT */}

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">

            {/* LOGIN DATE/TIME */}

            <div className="hidden items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 lg:flex">

              <Calendar
                size={17}
                className="text-gray-500"
              />

              <div className="leading-tight">
                <div className="text-xs font-semibold text-gray-700">
                  {loginDetails.day}
                </div>

                <div className="text-[11px] text-gray-500">
                  {loginDetails.date}
                </div>
              </div>

              <div className="border-l border-gray-300 pl-3 text-xs font-semibold text-gray-700">
                {loginDetails.time}
              </div>
            </div>

            {/* NOTIFICATIONS */}

            <div
              ref={notificationRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() =>
                  setNotificationOpen(
                    (previous) =>
                      !previous
                  )
                }
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
              >
                <Bell size={19} />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ec3737] px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-12 z-50 w-[350px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        Notifications
                      </h3>

                      <p className="text-xs text-gray-500">
                        {unreadCount} unread
                      </p>
                    </div>

                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={
                          markAllNotificationsRead
                        }
                        className="text-xs font-semibold text-[#ec3737] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-[380px] overflow-y-auto">
                    {notifications.length ===
                    0 ? (
                      <div className="px-5 py-10 text-center">
                        <Bell
                          size={28}
                          className="mx-auto mb-2 text-gray-300"
                        />

                        <p className="text-sm text-gray-500">
                          No notifications
                        </p>
                      </div>
                    ) : (
                      notifications.map(
                        (notification) => {
                          const isUnread =
                            Number(
                              notification?.is_read ||
                                0
                            ) === 0;

                          return (
                            <button
                              type="button"
                              key={
                                notification.id
                              }
                              onClick={() => {
                                if (
                                  isUnread
                                ) {
                                  markNotificationRead(
                                    notification.id
                                  );
                                }
                              }}
                              className={`flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${
                                isUnread
                                  ? "bg-red-50/40"
                                  : "bg-white"
                              }`}
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                                {getNotificationIcon(
                                  notification
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-800">
                                  {notification.title ||
                                    "Notification"}
                                </p>

                                <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                                  {notification.message ||
                                    ""}
                                </p>

                                <p className="mt-1 text-[10px] text-gray-400">
                                  {formatNotificationTime(
                                    notification.created_at ||
                                      notification.createdAt
                                  )}
                                </p>
                              </div>

                              {isUnread && (
                                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ec3737]" />
                              )}
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PROFILE / STATUS */}

            <div className="relative">

              <button
                type="button"
                onClick={() =>
                  setStatusDropdownOpen(
                    (previous) =>
                      !previous
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 transition hover:bg-gray-50 sm:px-3"
              >

                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">

                  {profileImage &&
                  !imageError ? (
                    <img
                      src={profileImage}
                      alt={userName}
                      className="h-full w-full object-cover"
                      onError={() =>
                        setImageError(
                          true
                        )
                      }
                    />
                  ) : (
                    <User
                      size={18}
                      className="text-gray-500"
                    />
                  )}

                </div>

                <div className="hidden min-w-0 text-left sm:block">

                  <div className="max-w-[120px] truncate text-xs font-bold text-gray-800">
                    {userName}
                  </div>

                  <div className="text-[10px] capitalize text-gray-500">
                    {userRole}
                  </div>

                  <div className="text-[9px] text-gray-400">
                    ID: {userId || "—"}
                  </div>

                </div>

                <ChevronDown
                  size={16}
                  className={`hidden text-gray-400 transition sm:block ${
                    statusDropdownOpen
                      ? "rotate-180"
                      : ""
                  }`}
                />

              </button>

              {/* STATUS DROPDOWN */}

              {statusDropdownOpen && (
                <div className="absolute right-0 top-12 z-50 w-[290px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

                  <div className="border-b border-gray-100 px-4 py-3">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100">

                        {profileImage &&
                        !imageError ? (
                          <img
                            src={
                              profileImage
                            }
                            alt={
                              userName
                            }
                            className="h-full w-full object-cover"
                            onError={() =>
                              setImageError(
                                true
                              )
                            }
                          />
                        ) : (
                          <User
                            size={19}
                            className="text-gray-500"
                          />
                        )}

                      </div>

                      <div className="min-w-0">

                        <p className="truncate text-sm font-bold text-gray-900">
                          {userName}
                        </p>

                        <p className="text-xs capitalize text-gray-500">
                          {userRole}
                        </p>

                      </div>

                    </div>

                  </div>

                  <div className="px-4 pb-2 pt-3">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Availability Status
                    </p>

                  </div>

                  <div className="max-h-[350px] overflow-y-auto px-2 pb-2">

                    {visibleStatusOptions.map(
                      (item) => {
                        const Icon =
                          item.icon;

                        const selected =
                          status ===
                          item.value;

                        const isBreak =
                          Boolean(
                            BREAK_LIMITS[
                              item.value
                            ]
                          );

                        const usage =
                          isBreak
                            ? Number(
                                breakUsage[
                                  item.value
                                ] || 0
                              )
                            : 0;

                        const limit =
                          isBreak
                            ? BREAK_LIMITS[
                                item.value
                              ]
                            : null;

                        const limitReached =
                          Boolean(
                            isBreak &&
                              limit &&
                              usage >=
                                limit.maxUses
                          );

                        const timeBlocked =
                          Boolean(
                            isBreak &&
                              isBreakStartBlockedByTime()
                          );

                        return (
                          <button
                            type="button"
                            key={
                              item.value
                            }
                            disabled={
                              loading ||
                              limitReached ||
                              timeBlocked
                            }
                            onClick={() =>
                              handleStatusChange(
                                item.value
                              )
                            }
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                              selected
                                ? "bg-gray-100"
                                : "hover:bg-gray-50"
                            } ${
                              loading ||
                              limitReached ||
                              timeBlocked
                                ? "cursor-not-allowed opacity-50"
                                : ""
                            }`}
                          >

                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}
                            >
                              <Icon
                                size={
                                  16
                                }
                              />
                            </div>

                            <div className="min-w-0 flex-1">

                              <span className="block text-sm font-medium text-gray-700">
                                {item.label}
                              </span>

                              {isBreak &&
                                limit && (
                                  <span className="block text-[10px] text-gray-400">
                                    {
                                      limit.minutes
                                    }{" "}
                                    min •{" "}
                                    {usage}
                                    /
                                    {
                                      limit.maxUses
                                    }{" "}
                                    used
                                  </span>
                                )}

                              {isBreak &&
                                timeBlocked && (
                                  <span className="block text-[10px] font-medium text-red-500">
                                    Unavailable 8:00–9:00 AM CA
                                  </span>
                                )}

                            </div>

                            {selected && (
                              <Check
                                size={
                                  16
                                }
                                className="text-green-600"
                              />
                            )}

                          </button>
                        );
                      }
                    )}

                  </div>

                  {!isAdmin && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">

                      <div className="mb-2 flex items-center justify-between">

                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Breaks — Rolling 24h
                        </span>

                        <span className="text-[10px] font-semibold text-gray-500">
                          {
                            totalBreakUsage
                          }
                          /
                          {
                            MAX_BREAKS
                          }
                        </span>

                      </div>

                      <div className="space-y-1.5">

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500">
                            Short
                          </span>

                          <span className="font-semibold text-gray-600">
                            {
                              breakUsage[
                                "Short Break"
                              ]
                            }
                            /3
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500">
                            Lunch
                          </span>

                          <span className="font-semibold text-gray-600">
                            {
                              breakUsage[
                                "Lunch Break"
                              ]
                            }
                            /1
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500">
                            Namaz
                          </span>

                          <span className="font-semibold text-gray-600">
                            {
                              breakUsage[
                                "Namaz Break"
                              ]
                            }
                            /1
                          </span>
                        </div>

                      </div>

                    </div>
                  )}

                  {onLogout && (
                    <div className="border-t border-gray-100 p-2">

                      <button
                        type="button"
                        onClick={() => {
                          setStatusDropdownOpen(
                            false
                          );

                          onLogout();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-red-600 transition hover:bg-red-50"
                      >

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">

                          <LogOut
                            size={
                              16
                            }
                          />

                        </div>

                        <span className="text-sm font-semibold">
                          Logout
                        </span>

                      </button>

                    </div>
                  )}

                </div>
              )}

            </div>

          </div>
        </div>
      </header>

      {/* ========================================================
          TIMER MODAL
      ======================================================== */}

      {timerOpen &&
        typeof document !==
          "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">

            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">

              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">

                <div>

                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Current Status
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-gray-900">
                    {timerStatus}
                  </h2>

                </div>

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    currentStatusInfo?.bg ||
                    "bg-gray-100"
                  } ${
                    currentStatusInfo?.color ||
                    "text-gray-600"
                  }`}
                >
                  <CurrentStatusIcon
                    size={21}
                  />
                </div>

              </div>

              {/* TIMER */}

              <div className="px-6 py-10 text-center">

                <p className="text-sm font-medium text-gray-500">
                  Time Elapsed
                </p>

                <div className="mt-3 font-mono text-5xl font-bold tracking-wider text-gray-900 sm:text-6xl">
                  {formatTimer(
                    timerSeconds
                  )}
                </div>

                {currentBreakLimit && (
                  <>
                    <p className="mt-3 text-xs font-medium text-gray-500">
                      Limit:{" "}
                      {
                        currentBreakLimit.minutes
                      }{" "}
                      minutes
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Used in rolling 24h:{" "}
                      {
                        currentBreakUsed
                      }
                      /
                      {
                        currentBreakLimit.maxUses
                      }
                    </p>
                  </>
                )}

                {isNewTimer && (
                  <p className="mt-3 text-xs font-medium text-green-600">
                    Break started
                  </p>
                )}

                {!isNewTimer &&
                  statusStartedAt && (
                    <p className="mt-3 text-xs text-gray-400">
                      Break in progress
                    </p>
                  )}

              </div>

              {/* FOOTER */}

              <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">

                <button
                  type="button"
                  disabled={loading}
                  onClick={
                    endStatusTimer
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ec3737] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#d92f2f] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  <Check size={17} />

                  {loading
                    ? "Updating..."
                    : "End Break"}

                </button>

                <p className="mt-3 text-center text-xs text-gray-400">
                  Your break timer will continue
                  while this status is active.
                </p>

              </div>

            </div>

          </div>,
          document.body
        )}
    </>
  );
}