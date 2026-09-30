"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserPlus,
  Upload,
  CheckCircle2,
  Loader2,
  X,
  Menu,
  Phone,
  Mail,
  ShieldCheck,
  Users,
  KeyRound,
  Video,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";

export default function AddUserPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Avatar states
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    zoom_extension: "",
    role: "agent",
    team: "Sales",
    status: "Active",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Avatar upload
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // 2MB validation
    if (file.size > 2 * 1024 * 1024) {
      alert("Profile photo must be less than 2MB.");
      e.target.value = "";
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      const data = new FormData();

      data.append("fullName", formData.fullName.trim());
      data.append("email", formData.email.trim());
      data.append("phone", formData.phone.trim());
      data.append("zoom_extension", formData.zoom_extension.trim());
      data.append("role", formData.role);
      data.append("team", formData.team);
      data.append("status", formData.status);
      data.append("password", formData.password);

      // Avatar
      if (avatarFile) {
        data.append("avatar", avatarFile);
      }

      const response = await fetch("/api/new-users", {
        method: "POST",
        body: data,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create user");
      }

      alert("User added successfully!");

      router.push("/users");
      router.refresh();
    } catch (error) {
      console.error("CREATE USER ERROR:", error);

      alert(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 relative">

      {/* ================= MOBILE HEADER ================= */}
      <header className="lg:hidden h-16 bg-[#050B1E] border-b border-slate-800 flex items-center justify-between px-4 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 p-[2px] flex items-center justify-center">
            <div className="w-full h-full bg-[#050B1E] rounded-full flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 flex items-center justify-center" />
            </div>
          </div>

          <span className="font-extrabold text-xl text-white">
            CallCRM
          </span>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-slate-300 hover:bg-white/10 transition"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ================= SIDEBAR ================= */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setShowLogoutModal={setShowLogoutModal}
      />

      {/* ================= MAIN ================= */}
      <main className="lg:ml-64 min-h-screen p-4 sm:p-6 lg:p-8 max-w-5xl">

        {/* ================= PAGE HEADER ================= */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">

            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition shadow-sm flex items-center justify-center"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Add New User
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                Dashboard &gt; Users &gt;{" "}
                <span className="text-slate-600">
                  Add New User
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* ================= FORM CONTAINER ================= */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

          {/* ================= FORM HEADER ================= */}
          <div className="relative overflow-hidden p-6 sm:p-7 bg-[#050B1E] text-white">

            <div className="absolute -right-10 -top-16 w-44 h-44 rounded-full bg-blue-600/10 blur-2xl" />
            <div className="absolute -left-10 -bottom-20 w-40 h-40 rounded-full bg-indigo-600/10 blur-2xl" />

            <div className="relative flex items-center gap-4">

              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-400/20 flex items-center justify-center text-blue-400">
                <UserPlus size={22} />
              </div>

              <div>
                <h2 className="font-bold text-lg">
                  User Information
                </h2>

                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Create a new team member account and assign their CRM access.
                </p>
              </div>

            </div>
          </div>

          {/* ================= FORM ================= */}
          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-6 lg:p-8 space-y-8"
          >

            {/* ================= PROFILE PHOTO ================= */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Profile Photo
                  </h3>

                  <p className="text-[11px] text-slate-400">
                    Upload an optional profile image
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">

                {/* Preview */}
                <div className="relative w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">

                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserPlus
                      size={28}
                      className="text-slate-300"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="avatar-file"
                    className="inline-flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-blue-400 hover:text-blue-600 transition shadow-sm"
                  >
                    <Upload size={15} />
                    Upload Profile Photo
                  </label>

                  <p className="text-[11px] text-slate-400 mt-2">
                    PNG, JPG or JPEG • Maximum 2MB
                  </p>

                  <input
                    id="avatar-file"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>

              </div>
            </section>

            {/* ================= BASIC INFORMATION ================= */}
            <section>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Basic Information
                  </h3>

                  <p className="text-[11px] text-slate-400">
                    Enter the employee's personal details
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* FULL NAME */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <UserPlus
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="text"
                      name="fullName"
                      required
                      placeholder="e.g. Ahmed Khan"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-medium text-sm transition"
                    />
                  </div>
                </div>

                {/* EMAIL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="ahmed@callcrm.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-medium text-sm transition"
                    />
                  </div>
                </div>

                {/* PHONE */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Phone Number
                  </label>

                  <div className="relative">
                    <Phone
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="tel"
                      name="phone"
                      placeholder="+92 300 1234567"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-medium text-sm transition"
                    />
                  </div>
                </div>

                {/* ZOOM EXTENSION */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Zoom Extension
                  </label>

                  <div className="relative">
                    <Video
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="text"
                      name="zoom_extension"
                      placeholder="e.g. 800"
                      value={formData.zoom_extension}
                      onChange={handleChange}
                      maxLength={50}
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-medium text-sm transition"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Used to match Zoom calls with this user.
                  </p>
                </div>

              </div>
            </section>

            {/* ================= ACCESS & ROLE ================= */}
            <section>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck size={16} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Access & Assignment
                  </h3>

                  <p className="text-[11px] text-slate-400">
                    Configure the user's CRM role and team
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* ROLE */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Role <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <ShieldCheck
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />

                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-semibold text-sm text-slate-700 transition"
                    >
                      <option value="agent">Agent</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* TEAM */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Team <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <Users
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />

                    <select
                      name="team"
                      value={formData.team}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-semibold text-sm text-slate-700 transition"
                    >
                      <option value="Sales">Sales</option>
                      <option value="Support">Support</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Design">Design</option>
                      <option value="Developer">Developer</option>
                      <option value="SMM">SMM</option>
                      <option value="HR">HR</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Management">Management</option>
                      <option value="Team Lead">Team Lead</option>
                    </select>
                  </div>
                </div>

              </div>
            </section>

            {/* ================= SECURITY ================= */}
            <section>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <KeyRound size={16} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Account Security
                  </h3>

                  <p className="text-[11px] text-slate-400">
                    Set the initial password for this account
                  </p>
                </div>
              </div>

              <div className="max-w-xl">

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Password <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <KeyRound
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      placeholder="Enter a secure password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-medium text-sm transition"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Minimum 6 characters recommended.
                  </p>
                </div>

              </div>
            </section>

            {/* ================= STATUS INFO ================= */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">

              <div className="w-8 h-8 rounded-lg bg-white text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 size={16} />
              </div>

              <div>
                <p className="text-xs font-bold text-blue-900">
                  Account will be created as Active
                </p>

                <p className="text-[11px] text-blue-700/70 mt-1">
                  The user can log in immediately after the account is created.
                </p>
              </div>

            </div>

            {/* ================= ACTION BUTTONS ================= */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-slate-100">

              <button
                type="button"
                onClick={() => router.push("/users")}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-7 py-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    <span>Creating User...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Create User</span>
                  </>
                )}
              </button>

            </div>

          </form>
        </div>
      </main>
    </div>
  );
}