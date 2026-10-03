import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query, zoomConfig } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  console.log("====================================");
  console.log("       ZOOM CALLBACK HIT");
  console.log("====================================");

  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const errorParam = url.searchParams.get("error");

    console.log(
      "CALLBACK URL:",
      request.url.replace(code || "", "[CODE]")
    );

    console.log("CODE RECEIVED:", !!code);
    console.log("CODE LENGTH:", code ? code.length : 0);
    console.log("ZOOM ERROR:", errorParam);

    // =====================================================
    // ZOOM AUTHORIZATION ERROR
    // =====================================================

    if (errorParam) {
      console.error(
        "ZOOM AUTHORIZATION ERROR:",
        errorParam
      );

      return NextResponse.json(
        {
          success: false,
          error: `Zoom authorization rejected: ${errorParam}`,
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // AUTHORIZATION CODE
    // =====================================================

    if (!code) {
      console.error(
        "ERROR: ZOOM CODE MISSING"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom authorization code missing",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "ZOOM AUTHORIZATION CODE RECEIVED"
    );

    // =====================================================
    // CRM JWT
    // =====================================================

    const token =
      request.cookies.get("token")?.value;

    console.log(
      "CRM TOKEN EXISTS:",
      !!token
    );

    if (!token) {
      console.error(
        "ERROR: CRM TOKEN COOKIE NOT FOUND"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "CRM login required before connecting Zoom",
        },
        {
          status: 401,
        }
      );
    }

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error(
        "ERROR: JWT_SECRET MISSING"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "JWT_SECRET is missing",
        },
        {
          status: 500,
        }
      );
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        jwtSecret
      );

      console.log(
        "JWT VERIFIED:",
        true
      );
    } catch (jwtError) {
      console.error(
        "JWT VERIFY ERROR:",
        jwtError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired CRM login session",
        },
        {
          status: 401,
        }
      );
    }

    const crmUserId =
      decoded?.id ||
      decoded?.userId ||
      decoded?.user_id;

    console.log(
      "CRM USER ID:",
      crmUserId
    );

    if (!crmUserId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CRM user ID not found in login session",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // CRM USER
    // =====================================================

    const users = await query(
      `
      SELECT
        id,
        name,
        email,
        role
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [crmUserId]
    );

    console.log(
      "CRM USER FOUND:",
      users.length > 0
    );

    if (
      !users ||
      users.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CRM user not found",
        },
        {
          status: 404,
        }
      );
    }

    const crmUser =
      users[0];

    console.log(
      "CRM USER:",
      crmUser.id,
      crmUser.name,
      crmUser.email,
      crmUser.role
    );

    // =====================================================
    // ZOOM CONFIG
    // =====================================================

    const {
      clientId,
      clientSecret,
      redirectUri,
    } = zoomConfig;

    console.log(
      "========== ZOOM CONFIG =========="
    );

    console.log(
      "CLIENT ID EXISTS:",
      !!clientId
    );

    console.log(
      "CLIENT SECRET EXISTS:",
      !!clientSecret
    );

    console.log(
      "REDIRECT URI:",
      redirectUri
    );

    console.log(
      "================================="
    );

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      console.error(
        "ERROR: ZOOM CONFIGURATION INCOMPLETE"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom configuration is incomplete",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // EXCHANGE CODE FOR TOKEN
    // =====================================================

    console.log(
      "========== TOKEN EXCHANGE =========="
    );

    const credentials =
      Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64");

    const tokenResponse =
      await fetch(
        "https://zoom.us/oauth/token",
        {
          method: "POST",

          headers: {
            Authorization:
              `Basic ${credentials}`,

            "Content-Type":
              "application/x-www-form-urlencoded",

            Accept:
              "application/json",
          },

          body:
            new URLSearchParams({
              grant_type:
                "authorization_code",

              code,

              redirect_uri:
                redirectUri,
            }).toString(),

          cache: "no-store",
        }
      );

    let tokenData;

    try {
      tokenData =
        await tokenResponse.json();
    } catch {
      tokenData = {};
    }

    console.log(
      "ZOOM TOKEN STATUS:",
      tokenResponse.status
    );

    console.log(
      "ZOOM TOKEN OK:",
      tokenResponse.ok
    );

    if (!tokenResponse.ok) {
      console.error(
        "ZOOM TOKEN ERROR:",
        tokenData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to exchange Zoom authorization code",
          details:
            tokenData,
        },
        {
          status:
            tokenResponse.status,
        }
      );
    }

    console.log(
      "ZOOM TOKEN SUCCESS"
    );

    console.log(
      "ACCESS TOKEN EXISTS:",
      !!tokenData.access_token
    );

    console.log(
      "REFRESH TOKEN EXISTS:",
      !!tokenData.refresh_token
    );

    const accessToken =
      tokenData.access_token;

    const refreshToken =
      tokenData.refresh_token ||
      null;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom access token was not returned",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // GET ZOOM USER
    // =====================================================

    console.log(
      "========== GET ZOOM USER =========="
    );

    const zoomUserResponse =
      await fetch(
        "https://api.zoom.us/v2/users/me",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            Accept:
              "application/json",
          },

          cache: "no-store",
        }
      );

    let zoomUser;

    try {
      zoomUser =
        await zoomUserResponse.json();
    } catch {
      zoomUser = {};
    }

    console.log(
      "ZOOM USER STATUS:",
      zoomUserResponse.status
    );

    console.log(
      "ZOOM USER OK:",
      zoomUserResponse.ok
    );

    if (!zoomUserResponse.ok) {
      console.error(
        "ZOOM USER API ERROR:",
        zoomUser
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Could not retrieve Zoom account information",
          details:
            zoomUser,
        },
        {
          status:
            zoomUserResponse.status,
        }
      );
    }

    console.log(
      "ZOOM USER ID:",
      zoomUser.id
    );

    console.log(
      "ZOOM USER EMAIL:",
      zoomUser.email
    );

    console.log(
      "ZOOM ACCOUNT ID:",
      zoomUser.account_id
    );

    // =====================================================
    // TOKEN EXPIRY
    // =====================================================

    let expiresAt = null;

    if (
      tokenData.expires_in
    ) {
      expiresAt =
        new Date(
          Date.now() +
            Number(
              tokenData.expires_in
            ) *
              1000
        );
    }

    console.log(
      "TOKEN EXPIRES:",
      expiresAt
    );

    // =====================================================
    // SAVE ZOOM CONNECTION
    // =====================================================

    console.log(
      "========== SAVING ZOOM CONNECTION =========="
    );

    const saveResult =
      await query(
        `
        INSERT INTO zoom_connections
        (
          user_id,
          zoom_account_id,
          zoom_user_id,
          zoom_email,
          access_token,
          refresh_token,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
          zoom_account_id =
            VALUES(zoom_account_id),

          zoom_user_id =
            VALUES(zoom_user_id),

          zoom_email =
            VALUES(zoom_email),

          access_token =
            VALUES(access_token),

          refresh_token =
            VALUES(refresh_token),

          expires_at =
            VALUES(expires_at)
        `,
        [
          crmUserId,

          zoomUser.account_id ||
            null,

          zoomUser.id ||
            null,

          zoomUser.email ||
            null,

          accessToken,

          refreshToken,

          expiresAt,
        ]
      );

    console.log(
      "DATABASE SAVE RESULT:",
      saveResult
    );

    console.log(
      "ZOOM CONNECTION SAVED"
    );

    // =====================================================
    // VERIFY DATABASE ROW
    // =====================================================

    const verifyRows =
      await query(
        `
        SELECT
          id,
          user_id,
          zoom_account_id,
          zoom_user_id,
          zoom_email,
          expires_at
        FROM zoom_connections
        WHERE user_id = ?
        LIMIT 1
        `,
        [crmUserId]
      );

    console.log(
      "DATABASE ROW EXISTS:",
      verifyRows.length > 0
    );

    console.log(
      "DATABASE ROW:",
      verifyRows[0] || null
    );

    if (
      verifyRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom connection could not be saved",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // SUCCESS
    // =====================================================

    console.log(
      "===================================="
    );

    console.log(
      `ZOOM CONNECTED SUCCESSFULLY FOR CRM USER ${crmUserId}`
    );

    console.log(
      "===================================="
    );

    // =====================================================
    // REDIRECT
    // =====================================================

    /*
     * LOCAL:
     * http://localhost:3000/calls?zoom=connected
     *
     * PRODUCTION:
     * https://jadescorp.com/calls?zoom=connected
     *
     * Use NEXT_PUBLIC_APP_URL in .env
     */

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const callsUrl =
      new URL(
        "/calls",
        appUrl
      );

    callsUrl.searchParams.set(
      "zoom",
      "connected"
    );

    console.log(
      "REDIRECTING TO:",
      callsUrl.toString()
    );

    return NextResponse.redirect(
      callsUrl
    );

  } catch (error) {
    console.error(
      "===================================="
    );

    console.error(
      "ZOOM CALLBACK SERVER ERROR"
    );

    console.error(
      "ERROR:",
      error
    );

    console.error(
      "MESSAGE:",
      error?.message
    );

    console.error(
      "STACK:",
      error?.stack
    );

    console.error(
      "===================================="
    );

    // =====================================================
    // 429
    // =====================================================

    if (
      Number(error?.status) ===
      429
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom API rate limit reached.",
          details:
            error?.message ||
            "Too many requests",
        },
        {
          status: 429,
        }
      );
    }

    // =====================================================
    // AUTH
    // =====================================================

    if (
      Number(error?.status) ===
        401 ||
      Number(error?.zoomCode) ===
        124
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom authorization has expired. Please reconnect Zoom.",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // GENERAL
    // =====================================================

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Zoom callback server error",
      },
      {
        status: 500,
      }
    );
  }
}