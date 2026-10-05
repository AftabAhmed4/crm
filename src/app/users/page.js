"use client";

import {
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Clock3,
  Search,
  Filter,
  CalendarDays,
  Phone,
  Mail,
  Edit3,
  Trash2,
  Menu,
  X,
  Coffee,
  LogOut,
  RefreshCw,
  ChevronDown,
  UserRound,
  Building2,
  Activity,
  PhoneCall,
} from "lucide-react";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import Sidebar from "@/components/Sidebar";
import Link from "next/link";

const RED = "#ec3737";
const RED_DARK = "#d92f2f";

export default function UsersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [teamFilter, setTeamFilter] = useState("All Teams");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  const [adminBreakModalOpen, setAdminBreakModalOpen] =
    useState(false);

  const [adminBreakStart, setAdminBreakStart] = useState("");
  const [adminBreakEnd, setAdminBreakEnd] = useState("");

  const [savingBreak, setSavingBreak] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* LIVE ZOOM                                                                  */
  /* -------------------------------------------------------------------------- */

  const [zoomActiveCalls, setZoomActiveCalls] = useState([]);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomError, setZoomError] = useState("");

  /* -------------------------------------------------------------------------- */
  /* DATE HELPERS                                                               */
  /* -------------------------------------------------------------------------- */

  const formatDisplayDateTime = useCallback((value) => {
    if (!value) return "Never";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Never";
    }

    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const toDateTimeLocalValue = useCallback((value) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const pad = (num) => String(num).padStart(2, "0");

    return `${date.getFullYear()}-${pad(
      date.getMonth() + 1
    )}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }, []);

  const normalizeDateTimeForDb = useCallback((value) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const pad = (num) => String(num).padStart(2, "0");

    return `${date.getFullYear()}-${pad(
      date.getMonth() + 1
    )}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:00`;
  }, []);

  /* -------------------------------------------------------------------------- */
  /* LOGIN STATUS                                                               */
  /* -------------------------------------------------------------------------- */

  const isUserLoggedIn = useCallback((user) => {
    if (!user) return false;

    const loginTime = user?.login_time
      ? new Date(user.login_time)
      : null;

    const logoutTime = user?.logout_time
      ? new Date(user.logout_time)
      : null;

    const hasValidLogin =
      loginTime &&
      !Number.isNaN(loginTime.getTime());

    const hasValidLogout =
      logoutTime &&
      !Number.isNaN(logoutTime.getTime());

    if (!hasValidLogin) return false;

    if (!hasValidLogout) return true;

    return (
      loginTime.getTime() >
      logoutTime.getTime()
    );
  }, []);

  /* -------------------------------------------------------------------------- */
  /* ZOOM EXTENSION NORMALIZER                                                  */
  /* -------------------------------------------------------------------------- */

  const normalizeExtension = useCallback((value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .trim()
      .replace(/[^\d+]/g, "");
  }, []);

  /* -------------------------------------------------------------------------- */
  /* EXTRACT ZOOM EXTENSIONS                                                     */
  /* -------------------------------------------------------------------------- */

  const getCallExtensions = useCallback(
    (call) => {
      const values = [
        call?.extension,
        call?.zoom_extension,

        call?.caller_extension,
        call?.callee_extension,

        call?.caller?.extension,
        call?.callee?.extension,

        call?.caller?.extension_number,
        call?.callee?.extension_number,

        call?.caller?.phone_number,
        call?.callee?.phone_number,
      ];

      return values
        .map(normalizeExtension)
        .filter(Boolean);
    },
    [normalizeExtension]
  );

  /* -------------------------------------------------------------------------- */
  /* FETCH USERS                                                                */
  /* -------------------------------------------------------------------------- */

  const fetchUsers = useCallback(async () => {
    try {
      setError("");

      const usersResponse = await fetch(
        "/api/new-users",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!usersResponse.ok) {
        throw new Error(
          "Failed to fetch users"
        );
      }

      const usersData =
        await usersResponse.json();

      const users = Array.isArray(usersData)
        ? usersData
        : Array.isArray(usersData?.users)
        ? usersData.users
        : Array.isArray(usersData?.data)
        ? usersData.data
        : [];

      setUsersList(users);

      try {
        const historyResponse =
          await fetch(
            "/api/login-history",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        if (historyResponse.ok) {
          const historyData =
            await historyResponse.json();

          const history =
            Array.isArray(historyData)
              ? historyData
              : Array.isArray(
                  historyData?.history
                )
              ? historyData.history
              : Array.isArray(
                  historyData?.data
                )
              ? historyData.data
              : [];

          setLoginHistory(history);
        } else {
          setLoginHistory([]);
        }
      } catch {
        setLoginHistory([]);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load users"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* -------------------------------------------------------------------------- */
  /* USERS POLLING                                                              */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      if (!mounted) return;

      await fetchUsers();
    };

    loadUsers();

    const interval = setInterval(() => {
      loadUsers();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchUsers]);

  /* -------------------------------------------------------------------------- */
  /* FETCH LIVE ZOOM CALLS                                                      */
  /* -------------------------------------------------------------------------- */

  const fetchZoomActiveCalls =
    useCallback(async () => {
      try {
        setZoomLoading(true);
        setZoomError("");

        const response = await fetch(
          `/api/zoom/active-calls?_live=${Date.now()}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Cache-Control":
                "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to fetch live Zoom calls"
          );
        }

        const data =
          await response.json();

        const calls = Array.isArray(data)
          ? data
          : Array.isArray(data?.calls)
          ? data.calls
          : Array.isArray(
              data?.activeCalls
            )
          ? data.activeCalls
          : Array.isArray(data?.data)
          ? data.data
          : [];

        setZoomActiveCalls(calls);
      } catch (err) {
        console.error(
          "Zoom active calls error:",
          err
        );

        setZoomError(
          err?.message ||
            "Unable to load Zoom call status"
        );

        setZoomActiveCalls([]);
      } finally {
        setZoomLoading(false);
      }
    }, []);

  /* -------------------------------------------------------------------------- */
  /* LIVE ZOOM POLLING                                                          */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!mounted) return;

      await fetchZoomActiveCalls();
    };

    load();

    const interval = setInterval(() => {
      load();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchZoomActiveCalls]);

  /* -------------------------------------------------------------------------- */
  /* BUILD LIVE ON CALL USER SET                                                */
  /* -------------------------------------------------------------------------- */

  const onCallUserIds = useMemo(() => {
    const activeIds = new Set();

    if (
      !Array.isArray(
        zoomActiveCalls
      )
    ) {
      return activeIds;
    }

    usersList.forEach((user) => {
      const userExtension =
        normalizeExtension(
          user?.zoom_extension
        );

      if (!userExtension) return;

      const isOnCall =
        zoomActiveCalls.some(
          (call) => {
            const extensions =
              getCallExtensions(call);

            return extensions.includes(
              userExtension
            );
          }
        );

      if (isOnCall) {
        activeIds.add(
          String(user.id)
        );
      }
    });

    return activeIds;
  }, [
    usersList,
    zoomActiveCalls,
    normalizeExtension,
    getCallExtensions,
  ]);

  /* -------------------------------------------------------------------------- */
  /* ON CALL USERS - NAMES                                                      */
  /* -------------------------------------------------------------------------- */

  const onCallUsers = useMemo(() => {
    return usersList.filter((user) =>
      onCallUserIds.has(
        String(user.id)
      )
    );
  }, [
    usersList,
    onCallUserIds,
  ]);

  /* -------------------------------------------------------------------------- */
  /* CHECK USER ON CALL                                                         */
  /* -------------------------------------------------------------------------- */

  const isUserOnCall = useCallback(
    (user) => {
      if (!user?.id) return false;

      return onCallUserIds.has(
        String(user.id)
      );
    },
    [onCallUserIds]
  );

  /* -------------------------------------------------------------------------- */
  /* USER STATUS                                                                */
  /* -------------------------------------------------------------------------- */

  const getUserStatus = useCallback(
    (user) => {
      if (!user) {
        return "Inactive";
      }

      /*
       * IMPORTANT:
       * Zoom On Call has highest priority.
       * Even if database availability_status says
       * Active / Lunch Break / Short Break,
       * live Zoom call will show On Call.
       */
      if (
        user?.id &&
        onCallUserIds.has(
          String(user.id)
        )
      ) {
        return "On Call";
      }

      if (isUserLoggedIn(user)) {
        return (
          user?.availability_status ||
          user?.status ||
          "Active"
        );
      }

      return "Inactive";
    },
    [
      isUserLoggedIn,
      onCallUserIds,
    ]
  );

  /* -------------------------------------------------------------------------- */
  /* SYNC                                                                       */
  /* -------------------------------------------------------------------------- */

  const handleSync = async () => {
    setSyncing(true);

    try {
      await Promise.all([
        fetchUsers(),
        fetchZoomActiveCalls(),
      ]);
    } finally {
      setSyncing(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* TEAMS                                                                      */
  /* -------------------------------------------------------------------------- */

  const teams = useMemo(() => {
    const values = usersList
      .map((user) => user?.team)
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [usersList]);

  /* -------------------------------------------------------------------------- */
  /* FILTER USERS                                                               */
  /* -------------------------------------------------------------------------- */

  const filteredUsers = useMemo(() => {
    const search =
      searchTerm
        .trim()
        .toLowerCase();

    return usersList.filter(
      (user) => {
        const name = String(
          user?.name || ""
        ).toLowerCase();

        const email = String(
          user?.email || ""
        ).toLowerCase();

        const phone = String(
          user?.phone || ""
        ).toLowerCase();

        const role = String(
          user?.role || ""
        ).toLowerCase();

        const team = String(
          user?.team || ""
        ).toLowerCase();

        const displayStatus =
          getUserStatus(user);

        const status = String(
          displayStatus || ""
        ).toLowerCase();

        const matchesSearch =
          !search ||
          name.includes(search) ||
          email.includes(search) ||
          phone.includes(search);

        const matchesRole =
          roleFilter ===
            "All Roles" ||
          role ===
            roleFilter.toLowerCase();

        const matchesStatus =
          statusFilter ===
            "All Status" ||
          status ===
            statusFilter.toLowerCase();

        const matchesTeam =
          teamFilter ===
            "All Teams" ||
          team ===
            teamFilter.toLowerCase();

        const dateValue =
          user?.created_at ||
          user?.last_login ||
          user?.login_time;

        let matchesStartDate = true;
        let matchesEndDate = true;

        if (
          startDate &&
          dateValue
        ) {
          const currentDate =
            new Date(dateValue);

          const fromDate =
            new Date(
              `${startDate}T00:00:00`
            );

          matchesStartDate =
            !Number.isNaN(
              currentDate.getTime()
            ) &&
            currentDate.getTime() >=
              fromDate.getTime();
        }

        if (
          endDate &&
          dateValue
        ) {
          const currentDate =
            new Date(dateValue);

          const toDate =
            new Date(
              `${endDate}T23:59:59.999`
            );

          matchesEndDate =
            !Number.isNaN(
              currentDate.getTime()
            ) &&
            currentDate.getTime() <=
              toDate.getTime();
        }

        return (
          matchesSearch &&
          matchesRole &&
          matchesStatus &&
          matchesTeam &&
          matchesStartDate &&
          matchesEndDate
        );
      }
    );
  }, [
    usersList,
    searchTerm,
    roleFilter,
    statusFilter,
    teamFilter,
    startDate,
    endDate,
    getUserStatus,
  ]);

  /* -------------------------------------------------------------------------- */
  /* STATS                                                                      */
  /* -------------------------------------------------------------------------- */

  const totalUsers =
    usersList.length;

  const activeUsers =
    usersList.filter((user) =>
      isUserLoggedIn(user)
    ).length;

  const inactiveUsers =
    usersList.filter(
      (user) =>
        !isUserLoggedIn(user)
    ).length;

  const loggedInNow =
    usersList.filter((user) =>
      isUserLoggedIn(user)
    ).length;

  const totalAdmins =
    usersList.filter(
      (user) =>
        String(
          user?.role || ""
        ).toLowerCase() ===
        "admin"
    ).length;

  const breaksCount =
    usersList.filter((user) => {
      /*
       * On Call should not be counted as break.
       */
      if (
        isUserOnCall(user)
      ) {
        return false;
      }

      const status =
        String(
          user?.availability_status ||
            user?.status ||
            ""
        )
          .trim()
          .toLowerCase();

      return [
        "namaz break",
        "lunch break",
        "short break",
        "other",
      ].includes(status);
    }).length;

  const onCallCount =
    onCallUserIds.size;

  /* -------------------------------------------------------------------------- */
  /* TABLE ROWS                                                                 */
  /* -------------------------------------------------------------------------- */

  const tableRows =
    filteredUsers.map(
      (user) => ({
        ...user,
        displayStatus:
          getUserStatus(user),
        isOnCall:
          isUserOnCall(user),
      })
    );

  /* -------------------------------------------------------------------------- */
  /* STYLES                                                                     */
  /* -------------------------------------------------------------------------- */

  const getStatusStyle = (
    status
  ) => {
    const normalized =
      String(status || "")
        .toLowerCase();

    if (
      normalized ===
      "active"
    ) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (
      normalized.includes(
        "break"
      )
    ) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }

    if (
      normalized ===
      "meeting"
    ) {
      return "bg-violet-50 text-violet-700 border-violet-200";
    }

    if (
      normalized ===
      "on call"
    ) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }

    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  const getRoleStyle = (
    role
  ) => {
    const normalized =
      String(role || "")
        .toLowerCase();

    if (
      normalized ===
      "admin"
    ) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }

    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  /* -------------------------------------------------------------------------- */
  /* BREAK MODAL                                                                */
  /* -------------------------------------------------------------------------- */

  const openBreakModal = (
    user
  ) => {
    setSelectedUser(user);

    setBreakStart(
      toDateTimeLocalValue(
        user?.break_start
      )
    );

    setBreakEnd(
      toDateTimeLocalValue(
        user?.break_end
      )
    );

    setBreakModalOpen(true);
  };

  const handleSaveBreakTime =
    async () => {
      if (!selectedUser?.id)
        return;

      setSavingBreak(true);

      try {
        const response =
          await fetch(
            "/api/new-users",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials:
                "include",
              body: JSON.stringify(
                {
                  userId:
                    selectedUser.id,
                  applyAll:
                    false,
                  break_start:
                    normalizeDateTimeForDb(
                      breakStart
                    ),
                  break_end:
                    normalizeDateTimeForDb(
                      breakEnd
                    ),
                }
              ),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to update break time"
          );
        }

        setBreakModalOpen(
          false
        );

        setSelectedUser(
          null
        );

        await fetchUsers();
      } catch (err) {
        alert(
          err?.message ||
            "Failed to save break time"
        );
      } finally {
        setSavingBreak(false);
      }
    };

  /* -------------------------------------------------------------------------- */
  /* ADMIN BREAK                                                                */
  /* -------------------------------------------------------------------------- */

  const handleSaveAdminBreakTime =
    async () => {
      setSavingBreak(true);

      try {
        const response =
          await fetch(
            "/api/new-users",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials:
                "include",
              body: JSON.stringify(
                {
                  applyAll:
                    true,
                  break_start:
                    normalizeDateTimeForDb(
                      adminBreakStart
                    ),
                  break_end:
                    normalizeDateTimeForDb(
                      adminBreakEnd
                    ),
                }
              ),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to update break time"
          );
        }

        setAdminBreakModalOpen(
          false
        );

        await fetchUsers();
      } catch (err) {
        alert(
          err?.message ||
            "Failed to save admin break time"
        );
      } finally {
        setSavingBreak(false);
      }
    };

  /* -------------------------------------------------------------------------- */
  /* DELETE USER                                                                */
  /* -------------------------------------------------------------------------- */

  const handleDeleteUser =
    async (user) => {
      if (!user?.id) return;

      const confirmed =
        window.confirm(
          `Are you sure you want to delete ${
            user?.name ||
            "this user"
          }?`
        );

      if (!confirmed) return;

      setDeletingUserId(
        user.id
      );

      try {
        const response =
          await fetch(
            "/api/new-users",
            {
              method: "DELETE",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials:
                "include",
              body: JSON.stringify(
                {
                  userId:
                    user.id,
                }
              ),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to delete user"
          );
        }

        setUsersList(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !==
                user.id
            )
        );
      } catch (err) {
        alert(
          err?.message ||
            "Failed to delete user"
        );
      } finally {
        setDeletingUserId(
          null
        );
      }
    };

  /* -------------------------------------------------------------------------- */
  /* CLEAR FILTERS                                                              */
  /* -------------------------------------------------------------------------- */

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter(
      "All Roles"
    );
    setStatusFilter(
      "All Status"
    );
    setTeamFilter(
      "All Teams"
    );
    setStartDate("");
    setEndDate("");
  };

  /* -------------------------------------------------------------------------- */
  /* LOADING                                                                    */
  /* -------------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F3]">
        <Sidebar
          open={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
        />

        <main className="lg:ml-64 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw
              className="w-8 h-8 animate-spin"
              style={{
                color: RED,
              }}
            />

            <p className="text-sm font-medium text-gray-500">
              Loading users...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* UI                                                                         */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <Sidebar
        open={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <main className="lg:ml-64 min-h-screen">
        {/* MOBILE TOP BAR */}
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#E4DEDA] px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            className="w-10 h-10 rounded-xl border border-[#E4DEDA] bg-white flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>

          <div className="font-bold text-gray-900">
            EMP ID
          </div>

          <div className="w-10" />
        </div>

        {/* PAGE CONTENT */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* HEADER */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-7">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                  EMP ID
                </h1>

                <span className="inline-flex items-center rounded-full bg-white border border-[#E4DEDA] px-3 py-1 text-xs font-bold text-gray-600">
                  {totalUsers}{" "}
                  Users
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Manage users, roles and availability
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={
                  handleSync
                }
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-xl border border-[#DDD6D2] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    syncing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Sync
              </button>

              <button
                type="button"
                onClick={async () => {
                  await Promise.all(
                    [
                      fetchUsers(),
                      fetchZoomActiveCalls(),
                    ]
                  );
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#DDD6D2] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <RefreshCw className="w-4 h-4" />

                Refresh
              </button>

              <Link
                href="add-new-users"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition"
                style={{
                  backgroundColor:
                    RED,
                }}
              >
                <UserRound className="w-4 h-4" />

                Add User
              </Link>
            </div>
          </div>

          {/* TEAM OVERVIEW */}
          <div className="mb-7">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `${RED}10`,
                    }}
                  >
                    <Users
                      className="w-4 h-4"
                      style={{
                        color: RED,
                      }}
                    />
                  </div>

                  <h2 className="text-base font-extrabold text-gray-900">
                    Team Overview
                  </h2>
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  Real-time overview of your team availability
                </p>
              </div>

              <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />

                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>

                <span className="text-[11px] font-bold text-emerald-700">
                  Live
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
              {/* TOTAL */}
              <div className="group relative overflow-hidden rounded-2xl border border-[#E4DEDA] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute left-0 top-0 h-1 w-full bg-gray-400" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-gray-400">
                      Total
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {totalUsers}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      All users
                    </p>
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>

              {/* ACTIVE */}
              <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute left-0 top-0 h-1 w-full bg-emerald-500" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-600">
                      Active
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {activeUsers}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      Currently online
                    </p>
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </div>

              {/* INACTIVE */}
              <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute left-0 top-0 h-1 w-full bg-gray-400" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-gray-500">
                      Inactive
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {inactiveUsers}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      Currently offline
                    </p>
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                    <UserX className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>

              {/* ADMINS */}
              <div className="group relative overflow-hidden rounded-2xl border border-purple-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute left-0 top-0 h-1 w-full bg-purple-500" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-purple-600">
                      Admins
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {totalAdmins}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      Admin accounts
                    </p>
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* BREAKS */}
              <div className="group relative overflow-hidden rounded-2xl border border-amber-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute left-0 top-0 h-1 w-full bg-amber-500" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-amber-600">
                      On Break
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {breaksCount}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      Currently away
                    </p>
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Coffee className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
              </div>

              {/* ON CALL */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute left-0 top-0 h-1 w-full bg-blue-500" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-blue-600">
                        On Call
                      </p>

                      {zoomLoading && (
                        <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                      )}
                    </div>

                    {/* COUNT */}
                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {onCallCount}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      Live Zoom calls
                    </p>

                    {/* ON CALL USER NAMES */}
                    {onCallUsers.length >
                    0 ? (
                      <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                        {onCallUsers.map(
                          (user) => (
                            <div
                              key={
                                user.id
                              }
                              className="flex items-center gap-1.5 min-w-0"
                              title={
                                user?.name ||
                                "Unknown User"
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />

                              <span className="text-[10px] font-bold text-blue-700 truncate">
                                {user?.name ||
                                  `User #${user?.id}`}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] font-medium text-gray-400">
                        No active calls
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                  </div>
                </div>

                {onCallCount >
                  0 && (
                  <div className="absolute right-3 bottom-3">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />

                      <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                    </span>
                  </div>
                )}
              </div>

              {/* LOGGED IN */}
              <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div
                  className="absolute left-0 top-0 h-1 w-full"
                  style={{
                    backgroundColor:
                      RED,
                  }}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-extrabold uppercase tracking-[0.08em]"
                      style={{
                        color: RED,
                      }}
                    >
                      Logged In
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                      {loggedInNow}
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      Active sessions
                    </p>
                  </div>

                  <div
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: `${RED}10`,
                    }}
                  >
                    <Activity
                      className="w-4 h-4"
                      style={{
                        color: RED,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ZOOM LIVE STATUS */}
          <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#E4DEDA] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  zoomError
                    ? "bg-red-500"
                    : "bg-emerald-500 animate-pulse"
                }`}
              />

              <span className="text-xs font-semibold text-gray-600">
                {zoomError
                  ? "Zoom live status unavailable"
                  : "Zoom live status connected"}
              </span>
            </div>

            <span className="text-[11px] font-bold text-gray-400">
              Auto refresh: 5 sec
            </span>
          </div>

          {/* FILTERS */}
          <div className="bg-white border border-[#E4DEDA] rounded-2xl shadow-sm p-4 sm:p-5 mb-7">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Filter
                    className="w-4 h-4"
                    style={{
                      color: RED,
                    }}
                  />

                  <h2 className="text-sm font-extrabold text-gray-900">
                    Filters
                  </h2>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  Find users quickly
                </p>
              </div>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="text-xs font-bold text-gray-500 hover:text-gray-900 transition"
              >
                Clear Filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* SEARCH */}
              <div className="relative xl:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                <input
                  type="text"
                  value={
                    searchTerm
                  }
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  placeholder="Search users..."
                  className="w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] pl-10 pr-3 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                />
              </div>

              {/* ROLE */}
              <div className="relative">
                <select
                  value={
                    roleFilter
                  }
                  onChange={(e) =>
                    setRoleFilter(
                      e.target.value
                    )
                  }
                  className="appearance-none w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] px-3 pr-9 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                >
                  <option>
                    All Roles
                  </option>

                  <option>
                    Admin
                  </option>

                  <option>
                    Agent
                  </option>

                  <option>
                    Manager
                  </option>
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
                  className="appearance-none w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] px-3 pr-9 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                >
                  <option>
                    All Status
                  </option>

                  <option>
                    Active
                  </option>

                  <option>
                    Inactive
                  </option>

                  <option>
                    Namaz Break
                  </option>

                  <option>
                    Lunch Break
                  </option>

                  <option>
                    Short Break
                  </option>

                  <option>
                    Meeting
                  </option>

                  <option>
                    On Call
                  </option>

                  <option>
                    Other
                  </option>
                </select>

                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

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
                  className="appearance-none w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] px-3 pr-9 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                >
                  <option>
                    All Teams
                  </option>

                  {teams.map(
                    (team) => (
                      <option
                        key={team}
                        value={
                          team
                        }
                      >
                        {team}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* FROM DATE */}
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                <input
                  type="date"
                  value={
                    startDate
                  }
                  onChange={(e) =>
                    setStartDate(
                      e.target.value
                    )
                  }
                  aria-label="From Date"
                  title="From Date"
                  className="w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] pl-10 pr-2 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                />

                {!startDate && (
                  <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                    From Date
                  </span>
                )}
              </div>

              {/* TO DATE */}
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                <input
                  type="date"
                  value={
                    endDate
                  }
                  onChange={(e) =>
                    setEndDate(
                      e.target.value
                    )
                  }
                  aria-label="To Date"
                  title="To Date"
                  className="w-full h-11 rounded-xl border border-[#DDD6D2] bg-[#FCFBFA] pl-10 pr-2 text-sm text-gray-700 outline-none focus:bg-white focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                />

                {!endDate && (
                  <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                    To Date
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* DIRECTORY HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">
                User Directory
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                Showing{" "}
                {
                  tableRows.length
                }{" "}
                of{" "}
                {
                  totalUsers
                }{" "}
                users
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live availability
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Zoom On Call:{" "}
                {onCallCount}
              </div>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* TABLE */}
          <div className="bg-white border border-[#E4DEDA] rounded-2xl shadow-sm overflow-hidden">
            {tableRows.length ===
            0 ? (
              <div className="py-16 px-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-gray-400" />
                </div>

                <h3 className="mt-4 text-sm font-extrabold text-gray-900">
                  No users found
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Try changing your filters or search.
                </p>
              </div>
            ) : (
              <>
                {/* DESKTOP TABLE */}
                <div className="hidden lg:block overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-[#FAF9F8] border-b border-[#E8E2DE]">
                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          User
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Contact
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Role
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Team
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Status
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          On Call
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Last Login
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Break
                        </th>

                        <th className="px-5 py-4 text-right text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#EEE9E6]">
                      {tableRows.map(
                        (user) => {
                          const status =
                            user.displayStatus;

                          return (
                            <tr
                              key={
                                user.id
                              }
                              className="hover:bg-[#FCFBFA] transition"
                            >
                              {/* USER */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-extrabold text-sm shrink-0"
                                    style={{
                                      backgroundColor: `${RED}12`,
                                      color:
                                        RED,
                                    }}
                                  >
                                    {user?.avatar ? (
                                      <img
                                        src={
                                          user.avatar
                                        }
                                        alt={
                                          user?.name ||
                                          "User"
                                        }
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      String(
                                        user?.name ||
                                          "U"
                                      )
                                        .charAt(
                                          0
                                        )
                                        .toUpperCase()
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="font-bold text-sm text-gray-900 truncate max-w-[180px]">
                                      {user?.name ||
                                        "Unknown User"}
                                    </div>

                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                      ID #
                                      {
                                        user?.id
                                      }
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* CONTACT */}
                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  {user?.email && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <Mail className="w-3.5 h-3.5 text-gray-400" />

                                      <span className="truncate max-w-[190px]">
                                        {
                                          user.email
                                        }
                                      </span>
                                    </div>
                                  )}

                                  {user?.phone && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <Phone className="w-3.5 h-3.5 text-gray-400" />

                                      <span>
                                        {
                                          user.phone
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* ROLE */}
                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold capitalize ${getRoleStyle(
                                    user?.role
                                  )}`}
                                >
                                  {user?.role ||
                                    "Agent"}
                                </span>
                              </td>

                              {/* TEAM */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Building2 className="w-4 h-4 text-gray-400" />

                                  <span>
                                    {user?.team ||
                                      "—"}
                                  </span>
                                </div>
                              </td>

                              {/* STATUS */}
                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${getStatusStyle(
                                    status
                                  )}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />

                                  {status}
                                </span>
                              </td>

                              {/* ON CALL */}
                              <td className="px-5 py-4">
                                {user.isOnCall ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />

                                    On Call
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />

                                    —
                                  </span>
                                )}
                              </td>

                              {/* LAST LOGIN */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <Clock3 className="w-4 h-4 text-gray-400" />

                                  <span>
                                    {formatDisplayDateTime(
                                      user?.last_login ||
                                        user?.login_time
                                    )}
                                  </span>
                                </div>
                              </td>

                              {/* BREAK */}
                              <td className="px-5 py-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openBreakModal(
                                      user
                                    )
                                  }
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#DED7D3] bg-white hover:bg-[#FFF5F5] hover:border-[#ec3737]/30 transition text-xs font-semibold text-gray-700"
                                  title="Break time"
                                >
                                  <Coffee
                                    className="w-4 h-4"
                                    style={{
                                      color:
                                        RED,
                                    }}
                                  />

                                  Break
                                </button>
                              </td>

                              {/* ACTIONS */}
                              <td className="px-5 py-4">
                                <div className="flex justify-end items-center gap-2">
                                  <Link
                                    href={`/users/edit/${user.id}`}
                                    className="w-9 h-9 rounded-xl border border-[#DED7D3] bg-white flex items-center justify-center hover:bg-gray-50 transition"
                                    title="Edit user"
                                  >
                                    <Edit3 className="w-4 h-4 text-gray-600" />
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteUser(
                                        user
                                      )
                                    }
                                    disabled={
                                      deletingUserId ===
                                      user.id
                                    }
                                    className="w-9 h-9 rounded-xl border border-red-100 bg-red-50 flex items-center justify-center hover:bg-red-100 transition disabled:opacity-50"
                                    title="Delete user"
                                  >
                                    {deletingUserId ===
                                    user.id ? (
                                      <RefreshCw className="w-4 h-4 text-red-500 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARDS */}
                <div className="lg:hidden p-3 space-y-3">
                  {tableRows.map(
                    (user) => {
                      const status =
                        user.displayStatus;

                      return (
                        <div
                          key={
                            user.id
                          }
                          className="border border-[#E8E2DE] rounded-2xl p-4 bg-[#FCFBFA]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center font-extrabold text-sm shrink-0"
                                style={{
                                  backgroundColor: `${RED}12`,
                                  color:
                                    RED,
                                }}
                              >
                                {user?.avatar ? (
                                  <img
                                    src={
                                      user.avatar
                                    }
                                    alt={
                                      user?.name ||
                                      "User"
                                    }
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  String(
                                    user?.name ||
                                      "U"
                                  )
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="font-bold text-sm text-gray-900 truncate">
                                  {user?.name ||
                                    "Unknown User"}
                                </div>

                                <div className="text-[11px] text-gray-400">
                                  ID #
                                  {
                                    user?.id
                                  }
                                </div>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-bold ${getStatusStyle(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                          </div>

                          {/* MOBILE ON CALL */}
                          <div className="mt-3">
                            {user.isOnCall ? (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />

                                On Call
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />

                                Not on call
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2">
                            {user?.email && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Mail className="w-4 h-4 text-gray-400" />

                                <span className="truncate">
                                  {
                                    user.email
                                  }
                                </span>
                              </div>
                            )}

                            {user?.phone && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Phone className="w-4 h-4 text-gray-400" />

                                <span>
                                  {
                                    user.phone
                                  }
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Building2 className="w-4 h-4 text-gray-400" />

                              <span>
                                {user?.team ||
                                  "No Team"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Clock3 className="w-4 h-4 text-gray-400" />

                              <span>
                                {formatDisplayDateTime(
                                  user?.last_login ||
                                    user?.login_time
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openBreakModal(
                                  user
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-xl border border-[#DED7D3] bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                            >
                              <Coffee
                                className="w-4 h-4"
                                style={{
                                  color:
                                    RED,
                                }}
                              />

                              Break
                            </button>

                            <Link
                              href={`/users/edit/${user.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#DED7D3] bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                            >
                              <Edit3 className="w-4 h-4" />

                              Edit
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteUser(
                                  user
                                )
                              }
                              disabled={
                                deletingUserId ===
                                user.id
                              }
                              className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                            >
                              {deletingUserId ===
                              user.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}

                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* USER BREAK MODAL */}
      {breakModalOpen &&
        selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={() =>
                !savingBreak &&
                setBreakModalOpen(
                  false
                )
              }
            />

            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E4DEDA] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: `${RED}10`,
                      }}
                    >
                      <Coffee
                        className="w-5 h-5"
                        style={{
                          color: RED,
                        }}
                      />
                    </div>

                    <h3 className="text-lg font-extrabold text-gray-900">
                      Break Time
                    </h3>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    {selectedUser?.name ||
                      "Selected User"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    !savingBreak &&
                    setBreakModalOpen(
                      false
                    )
                  }
                  className="w-9 h-9 rounded-xl border border-[#E4DEDA] flex items-center justify-center hover:bg-gray-50"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">
                    Break Start
                  </label>

                  <input
                    type="datetime-local"
                    value={
                      breakStart
                    }
                    onChange={(e) =>
                      setBreakStart(
                        e.target.value
                      )
                    }
                    className="w-full h-11 rounded-xl border border-[#DDD6D2] px-3 text-sm outline-none focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">
                    Break End
                  </label>

                  <input
                    type="datetime-local"
                    value={
                      breakEnd
                    }
                    onChange={(e) =>
                      setBreakEnd(
                        e.target.value
                      )
                    }
                    className="w-full h-11 rounded-xl border border-[#DDD6D2] px-3 text-sm outline-none focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={
                    savingBreak
                  }
                  onClick={() =>
                    setBreakModalOpen(
                      false
                    )
                  }
                  className="px-4 py-2.5 rounded-xl border border-[#DDD6D2] bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    savingBreak
                  }
                  onClick={
                    handleSaveBreakTime
                  }
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:opacity-95"
                  style={{
                    backgroundColor:
                      RED,
                  }}
                >
                  {savingBreak
                    ? "Saving..."
                    : "Save Break"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ADMIN BREAK MODAL */}
      {adminBreakModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() =>
              !savingBreak &&
              setAdminBreakModalOpen(
                false
              )
            }
          />

          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E4DEDA] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: `${RED}10`,
                    }}
                  >
                    <ShieldCheck
                      className="w-5 h-5"
                      style={{
                        color: RED,
                      }}
                    />
                  </div>

                  <h3 className="text-lg font-extrabold text-gray-900">
                    Apply Break Time
                  </h3>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Apply break schedule to all users
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  !savingBreak &&
                  setAdminBreakModalOpen(
                    false
                  )
                }
                className="w-9 h-9 rounded-xl border border-[#E4DEDA] flex items-center justify-center hover:bg-gray-50"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Break Start
                </label>

                <input
                  type="datetime-local"
                  value={
                    adminBreakStart
                  }
                  onChange={(e) =>
                    setAdminBreakStart(
                      e.target.value
                    )
                  }
                  className="w-full h-11 rounded-xl border border-[#DDD6D2] px-3 text-sm outline-none focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Break End
                </label>

                <input
                  type="datetime-local"
                  value={
                    adminBreakEnd
                  }
                  onChange={(e) =>
                    setAdminBreakEnd(
                      e.target.value
                    )
                  }
                  className="w-full h-11 rounded-xl border border-[#DDD6D2] px-3 text-sm outline-none focus:border-[#ec3737] focus:ring-4 focus:ring-[#ec3737]/10"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={
                  savingBreak
                }
                onClick={() =>
                  setAdminBreakModalOpen(
                    false
                  )
                }
                className="px-4 py-2.5 rounded-xl border border-[#DDD6D2] bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  savingBreak
                }
                onClick={
                  handleSaveAdminBreakTime
                }
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:opacity-95"
                style={{
                  backgroundColor:
                    RED,
                }}
              >
                {savingBreak
                  ? "Saving..."
                  : "Apply to All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() =>
              setLogoutModalOpen(
                false
              )
            }
          />

          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#E4DEDA] p-6">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5 text-red-500" />
            </div>

            <h3 className="text-lg font-extrabold text-gray-900">
              Logout
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to logout?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setLogoutModalOpen(
                    false
                  )
                }
                className="px-4 py-2.5 rounded-xl border border-[#DDD6D2] bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}