"use client";

import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import Welcome from "@/components/CrmWelcome";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  // Initial splash loading
  const [loading, setLoading] = useState(true);

  // Login button loading
  const [loginLoading, setLoginLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  // =========================================================
  // VOICE FUNCTION
  // =========================================================
  const speakMessage = (message) => {
    if (typeof window === "undefined") return;

    if (!("speechSynthesis" in window)) {
      console.log("Speech synthesis is not supported.");
      return;
    }

    // Stop any previous voice
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);

    speech.lang = "en-US";
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);
  };

  // =========================================================
  // LOGIN HANDLE SUBMIT
  // =========================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoginLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          rememberMe: formData.rememberMe,
        }),
      });

      const data = await response.json();

      // =====================================================
      // WRONG LOGIN / API ERROR
      // =====================================================
      if (!response.ok) {
        const message =
          data?.message ||
          "Invalid email or password. Please try again.";

        // Show error on screen
        setErrorMessage(message);

        // 🔊 Speak error message
        speakMessage(message);

        setLoginLoading(false);

        return;
      }

      // =====================================================
      // SUCCESSFUL LOGIN
      // =====================================================

      // Get user name from API
      const userName =
        data?.user?.name ||
        data?.user?.fullName ||
        data?.name ||
        data?.fullName ||
        formData.email.split("@")[0] ||
        "User";

      // Only first name
      const firstName =
        userName.trim().split(" ")[0] || "User";

      console.log("Logged in user:", userName);

      // =====================================================
      // 🔊 WELCOME VOICE
      // =====================================================

      speakMessage(
        `Welcome to CRM, ${firstName}.`
      );

      // =====================================================
      // REDIRECT
      // =====================================================

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1800);

    } catch (error) {
      console.error("Login error:", error);

      const message =
        "Something went wrong. Please try again.";

      setErrorMessage(message);

      // 🔊 Speak system error
      speakMessage(message);

      setLoginLoading(false);
    }
  };

  // =========================================================
  // INITIAL SPLASH SCREEN
  // =========================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // =========================================================
  // SHOW SPLASH
  // =========================================================
  if (loading) {
    return (
      <Welcome
        subtitle="messages"
        message="Loading dashboard..."
      />
    );
  }

  // =========================================================
  // LOGIN PAGE
  // =========================================================
  return (
    <div className="min-h-screen w-screen bg-white flex overflow-hidden">

      {/* Main Fullscreen Grid */}
      <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-12">

        {/* =====================================================
            LEFT SECTION
        ===================================================== */}
        <div className="hidden lg:flex lg:col-span-5 bg-black p-12 flex-col justify-between relative overflow-hidden text-white min-h-screen">

          {/* Background Image */}
          <div className="absolute inset-0 z-0">

            <img
              src="/crmxgfxfg.jpg"
              alt=""
              className="h-full w-full object-cover"
            />

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/60" />

          </div>

          {/* Decorative Pattern Top */}
          <div className="absolute top-8 right-8 opacity-20 text-[#ec3737] z-10">

            <div className="grid grid-cols-3 gap-2">

              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-current rounded-full"
                />
              ))}

            </div>

          </div>

          {/* Decorative Pattern Bottom */}
          <div className="absolute bottom-8 left-8 opacity-20 text-[#ec3737] z-10">

            <div className="grid grid-cols-3 gap-2">

              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-current rounded-full"
                />
              ))}

            </div>

          </div>

          {/* =====================================================
              LOGO
          ===================================================== */}
          <div className="flex items-center gap-3 z-10">

            <div className="flex items-center z-10">

              <img
                src="/uploads/CRM-LOGO-removebg-preview.png"
                alt="Digital Orbit Innovations"
                className="h-10 w-auto object-contain"
              />

            </div>

            <span className="font-extrabold text-2xl tracking-tight text-[#ec3737]">
              Digital Orbit Innovations
            </span>

          </div>

          {/* =====================================================
              HERO CONTENT
          ===================================================== */}
          <div className="my-auto z-10 max-w-lg">

            <h2 className="text-4xl font-extrabold mb-4 tracking-tight">
              Welcome Back
            </h2>

            <p className="text-slate-300 text-base leading-relaxed mb-8 font-normal">
              Sign in to access your workspace, collaborate with
              your team, and stay updated on everything happening
              across your projects. Keep your tasks organized,
              stay connected, and make every workday more productive.
            </p>

            {/* Dashboard Mockup */}
            <div className="relative mt-4 transform -rotate-1 hover:rotate-0 transition-transform duration-500 ease-out">

              {/* Red Glow */}
              <div className="absolute -inset-1 bg-[#ec3737] rounded-2xl blur-xl opacity-30" />

              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
                alt="CallCRM Dashboard Preview"
                className="relative rounded-2xl border bg-[#ec3737]/20 shadow-2xl w-full object-cover h-64"
              />

            </div>

          </div>

          {/* Footer */}
          <div className="z-10 text-xs text-white">
            © 2026 Digital Orbit Innovations. All rights reserved.
          </div>

        </div>

        {/* =====================================================
            RIGHT SECTION
        ===================================================== */}
        <div className="lg:col-span-7 p-6 sm:p-12 md:p-16 flex flex-col justify-center items-center bg-white min-h-screen">

          <div className="max-w-md w-full space-y-8">

            {/* =================================================
                HEADER
            ================================================= */}
            <div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Login to Your Account
              </h1>

              <p className="text-slate-500 text-sm mt-2">
                Enter your credentials to access your dashboard
              </p>

            </div>

            {/* =================================================
                ERROR MESSAGE
            ================================================= */}
            {errorMessage && (

              <div className="p-3.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl font-medium">
                {errorMessage}
              </div>

            )}

            {/* =================================================
                FORM
            ================================================= */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* =================================================
                  EMAIL
              ================================================= */}
              <div className="space-y-1.5">

                <label className="text-xs font-semibold text-slate-700">
                  Email Address
                </label>

                <div className="relative">

                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">

                    <Mail size={18} />

                  </div>

                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      });

                      setErrorMessage("");
                    }}
                    className="w-full pl-10 pr-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ec3737] focus:bg-white transition-all duration-200"
                  />

                </div>

              </div>

              {/* =================================================
                  PASSWORD
              ================================================= */}
              <div className="space-y-1.5">

                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>

                <div className="relative">

                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">

                    <Lock size={18} />

                  </div>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        password: e.target.value,
                      });

                      setErrorMessage("");
                    }}
                    className="w-full pl-10 pr-10 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ec3737] focus:bg-white transition-all duration-200"
                  />

                  {/* Show / Hide Password */}
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >

                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}

                  </button>

                </div>

              </div>

              {/* =================================================
                  SUBMIT BUTTON
              ================================================= */}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#ec3737] hover:bg-[#ec3737] disabled:bg-red-300 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer text-sm disabled:cursor-not-allowed"
              >

                {loginLoading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    <span>
                      Logging in...
                    </span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />

                    <span>
                      Login
                    </span>
                  </>
                )}

              </button>

            </form>

          </div>

        </div>

      </div>

    </div>
  );
}