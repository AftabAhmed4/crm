"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";

export default function WorkingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="ml-0 lg:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Working
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Working management page
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}