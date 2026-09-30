
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogoutModal from "@/components/LogoutModal";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Phone,
  UserPlus,
  MessageSquare,
  BarChart3,
  Settings,
  Link2,
  CreditCard,
  LogOut,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  setShowLogoutModal,
}) {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState(null);
  const [currentRole, setCurrentRole] = useState("user");
  const [internalLogoutOpen, setInternalLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch Role Securely from API Endpoint
  useEffect(() => {
    async function fetchUserRole() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.role) {
          // Normalize role to lowercase (e.g., 'ADMIN' -> 'admin')
          setCurrentRole(data.role.toLowerCase());
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
      }
    }

    fetchUserRole();
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const openLogoutModal = () => {
    if (setSidebarOpen) setSidebarOpen(false);

    if (setShowLogoutModal) {
      setShowLogoutModal(true);
      return;
    }

    setInternalLogoutOpen(true);
  };

  const confirmInternalLogout = async () => {
    setLoggingOut(true);

    try {
      localStorage.removeItem("crm_login_time");
      const response = await fetch("/api/logout", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        alert(data?.message || "Logout failed");
        setLoggingOut(false);
        setInternalLogoutOpen(false);
        return;
      }

      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Something went wrong during logout.");
      setLoggingOut(false);
      setInternalLogoutOpen(false);
    }
  };

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      roles: ["admin", "user","staff", "agent"],
    },
    {
      name: "Users",
      icon: UserCheck,
      href: "/users",
      hasDropdown: true,
      roles: ["admin"],
      subItems: [
        { name: "All Users", href: "/users" },
        { name: "Add New User", href: "/add-new-users" },
      ],
    },

    {
      name: "Calls",
      icon: Phone,
      href: "/calls",
      hasDropdown: true,
      roles: ["admin", "user", "agent","staff"],
      subItems: [
        { name: "Call ", href: "/calls" },
        { name: "Recordings", href: "/calls/recordings" },
      ],
    },
        {
      name: "Daily task",
      icon: Users,
      href: "/staff/task",
      roles: [ "staff",  "agent"],
    },
       {
      name: " daily leads",
      icon: Users,
      href: "/staff/task",
      roles: [ "staff", "agent"],
    },
    {
      name: "Attendance",
      icon: UserPlus,
      href: "/Attendance",
      hasDropdown: false,
      roles: ["admin","staff",  "agent"],
    
    },
    {
      name: "Daily Tasks assign",
      icon: Link2,
      href: "/daily-tasks",
      roles: ["admin", ],
    },
    {
      name: "Break",
      icon: Users,
      href: "/Break",
      roles: ["admin", "user","staff",  "agent"],
    },
    {
      name: "Messages",
      icon: MessageSquare,
      href: "/messages",
      roles: ["admin", "user","staff", "agent"],
    },
      {
      name: "Admin Edit",
      icon: MessageSquare,
      href: "/admin-edits",
      roles: ["admin"],
    },
       {
      name: "Domain Email",
      icon: MessageSquare,
      href: "/messages",
      roles: ["admin", "user","staff", "agent"],
    },
           {
      name: "QA",
      icon: MessageSquare,
      href: "/messages",
      roles: ["admin", "user","staff", "agent"],
    },

    {
      name: "Reports",
      icon: BarChart3,
      href: "/reports",
      roles: ["admin", "user","staff", "agent"],
    },
    {
      name: "Settings",
      icon: Settings,
      href: "/settings",
      roles: ["admin", ],
    },

    // {
    //   name: "Agents",
    //   icon: Link2,
    //   href: "/agents",
    //   roles: ["admin", "user", "staff", "agent"],
    // },

  ];

  // Role match check using array includes
  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(currentRole)
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen w-64 bg-black text-slate-200 flex flex-col justify-between py-4 px-3 transition-transform duration-300 lg:translate-x-0 border-r border-slate-800/50 select-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Header */}
          <div className="flex items-center gap-3 px-3 mb-4 shrink-0">
            <img
    src="/uploads/CRM-LOGO-removebg-preview.png"
    alt="CallCRM Logo"
    className="w-12 h-12 object-contain "
  />
            <span className="font-extrabold text-md tracking-tight text-[#ec3737]">
                DIGITAL ORBIT
            </span>
          </div>
{/* Logo Header */}
{/* <div className="flex items-center justify-center px-3 mb-5 shrink-0">
  <img
    src="/Digital_Orbit_logo_in_white-removebg-preview-removebg-preview.webp"
    alt="CallCRM Logo"
    className="w-12 h-12 object-contain"
  />
</div> */}
          {/* Navigation Menu */}
          <nav className="flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isDropdownOpen = openDropdown === item.name;

              return (
                <div key={item.name}>
                  {item.hasDropdown ? (
                    <button
                      type="button"
                      onClick={() => toggleDropdown(item.name)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className="shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      {isDropdownOpen ? (
                        <ChevronUp size={14} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen && setSidebarOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all duration-200"
                    >
                      <Icon size={16} className="shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  )}

                  {/* Submenu Options */}
                  {item.hasDropdown && isDropdownOpen && (
                    <div className="pl-8 mt-1 space-y-0.5">
                      {item.subItems.map((sub) => (
                        <Link
                          key={sub.name}
                          href={sub.href}
                          onClick={() => setSidebarOpen && setSidebarOpen(false)}
                          className="block py-1 px-2 text-[11px] text-slate-400 hover:text-white transition rounded-lg hover:bg-white/5"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logout Button */}
        <div className="pt-2 mt-2 border-t border-slate-800/60 px-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              openLogoutModal();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition duration-200 cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full border border-rose-500/40 flex items-center justify-center shrink-0">
              <LogOut size={11} className="text-rose-500 ml-0.5" />
            </div>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-[#050B1E]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl px-2 py-2 flex justify-around items-center">
        <Link
          href="/dashboard"
          className="flex flex-col items-center gap-1 py-1 px-3 text-blue-500 transition-all duration-200"
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-semibold">Dashboard</span>
        </Link>

        <Link
          href="/messages"
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-400 hover:text-slate-200 transition-all duration-200"
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-medium">Messages</span>
        </Link>

        <Link
          href="/calls"
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-400 hover:text-slate-200 transition-all duration-200"
        >
          <Phone size={20} />
          <span className="text-[10px] font-medium">Calls</span>
        </Link>

        <Link
          href="/settings"
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-400 hover:text-slate-200 transition-all duration-200"
        >
          <User size={20} />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>

        <button
          type="button"
          onClick={openLogoutModal}
          aria-label="Logout"
          className="flex flex-col items-center gap-1 py-1 px-3 text-rose-500 hover:text-rose-400 transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>

      {!setShowLogoutModal && (
        <LogoutModal
          show={internalLogoutOpen}
          loggingOut={loggingOut}
          onCancel={() => setInternalLogoutOpen(false)}
          onConfirm={confirmInternalLogout}
        />
      )}
    </>
  );
}