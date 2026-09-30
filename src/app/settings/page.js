
"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="ml-0 lg:ml-64 min-h-screen">
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            {/* HEADER */}
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100">
              <h1 className="text-xl font-semibold text-slate-900">
                Change Password
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Update your account password.
              </p>
            </div>

            {/* FORM */}
            <div className="p-5 sm:p-6 space-y-5">

              {/* CURRENT PASSWORD */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Current Password
                </label>

                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter current password"
                    className="w-full h-11 px-4 pr-16 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none transition focus:border-[#ec3737] focus:ring-2 focus:ring-[#ec3737]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    {showCurrent ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* NEW PASSWORD */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Password
                </label>

                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="Enter new password"
                    className="w-full h-11 px-4 pr-16 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none transition focus:border-[#ec3737] focus:ring-2 focus:ring-[#ec3737]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    {showNew ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm New Password
                </label>

                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm new password"
                    className="w-full h-11 px-4 pr-16 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none transition focus:border-[#ec3737] focus:ring-2 focus:ring-[#ec3737]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    {showConfirm ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* BUTTON */}
              <button
                type="button"
                className="w-full h-11 rounded-xl bg-[#ec3737] text-white font-semibold hover:bg-[#d92f2f] transition"
              >
                Change Password
              </button>

            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

