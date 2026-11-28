import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import heroImg from "@/assets/hero7.jpeg";
import logo from "@/assets/Logo__Circle.png";
import { colleges, levels, getDepartments } from "@/lib/academicData";

const searchSchema = z.object({
  mode: z.enum(["login", "register", "forgot"]).catch("login"),
  next: z.string().optional(),
  google_registration_nonce: z.string().optional(),
  google_oauth_popup: z.coerce.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign In | Aneks Library" },
      {
        name: "description",
        content: "Sign In or create an Aneks Library account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const ROLES = [
  { value: "student", label: "Student" },
  { value: "lecturer", label: "Lecturer" },
  { value: "staff", label: "Staff" },
  { value: "researcher", label: "Researcher" },
  { value: "guest", label: "Guest" },
] as const;

type RegistrationRole = typeof ROLES[number]["value"];

const GOOGLE_REGISTRATION_NONCE_KEY =
  "aneks-google-registration-nonce";

const GOOGLE_REGISTRATION_POPUP_NONCE_KEY =
  "aneks-google-registration-popup-nonce";

const GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY =
  "aneks-google-registration-success-nonce";

const GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY =
  "aneks-google-login-blocked-message";

const GOOGLE_LOGIN_BLOCKED_STATE_KEY =
  "aneks-google-login-blocked-state";

const GOOGLE_POPUP_ERROR_KEY =
  "aneks-google-popup-error";

const SUPABASE_AUTH_STORAGE_KEY =
  "sb-riiwtxfigbwsjixwdlcq-auth-token";

function getGoogleRegistrationErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "";

  const normalizedMessage = message.toLowerCase();

  if (
    /failed to fetch|networkerror|network request failed|err_internet_disconnected|load failed|fetch failed/.test(
      normalizedMessage,
    )
  ) {
    return "No internet connection. Please check your internet connection and try again.";
  }

  if (
    normalizedMessage.includes(
      "this account is not awaiting google registration completion",
    )
  ) {
    return "This Google account is already registered. Please log in instead.";
  }

  return message || fallback;
}

function clearLocalSupabaseSession() {
  localStorage.removeItem(
    SUPABASE_AUTH_STORAGE_KEY,
  );
}

function AuthPage() {
  const {
    mode,
    next,
    google_registration_nonce,
    google_oauth_popup,
  } = Route.useSearch();

  const navigate = useNavigate();

  const {
    session,
    loading,
    refresh,
  } = useAuth();

  const getPostAuthDestination = async (): Promise<string> => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return "/auth";
    }

    const {
      data: profile,
      error,
    } = await supabase
      .from("private_profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      return "/pending";
    }

    switch (profile.status) {
      case "active":
        return next || "/dashboard";

      case "pending":
        return "/pending";

      case "suspended":
        return "/suspended";

      case "rejected":
        return "/rejected";

      case "inactive":
        return "/inactive";

      default:
        return "/pending";
    }
  };

  const [
    googleRegistrationBusy,
    setGoogleRegistrationBusy,
  ] = useState(false);

  /*
   * Prevents more than one Google registration
   * completion from being processed at a time.
   *
   * This ref is intentionally independent from
   * React state so a rerender cannot reopen the
   * completion path while the RPC is still running.
   */
  const googleRegistrationHandled =
    useRef(false);

  const googleRegistrationProcessingNonce =
    useRef<string | null>(null);

  const googleLoginGuardHandled =
    useRef(false);
  
  const existingSessionRedirectHandled =
  useRef(false);

  const googleOAuthErrorHandled =
    useRef(false);

  const resetGoogleLoginGuard =
    () => {
      googleLoginGuardHandled.current =
        false;
    };

  /*
   * A URL containing google_oauth_popup=1 is
   * considered a popup callback.
   */
  const isGoogleOAuthPopup =
    google_oauth_popup === "1";

  /*
   * Messages produced by the main window after
   * an unregistered Google login are shown when
   * the registration view becomes active.
   *
   * This effect intentionally depends on mode.
   * TanStack Router can change the search parameters
   * without remounting AuthPage, so [] would not reliably
   * run when Login changes to Register.
   *
   * Any stale blocked-login message is also cleared
   * whenever the user is on another authentication mode.
   */
  useEffect(() => {
    const message =
      sessionStorage.getItem(
        GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
      );

    if (mode !== "register") {
      if (message) {
        sessionStorage.removeItem(
          GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
        );
      }

      return;
    }

    if (!message) {
      return;
    }

    sessionStorage.removeItem(
      GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
    );

    toast.error(message);
  }, [mode]);

  /*
   * Synchronize the main authentication window when
   * an ordinary Google OAuth popup completes.
   *
   * The popup and the main window share Supabase's
   * browser storage, but the popup's auth event does
   * not reliably update the React session state held
   * by AuthProvider in the main window.
   *
   * The popup therefore sends an explicit message to
   * its opener. The opener then calls refresh(), which
   * retrieves the authoritative session from Supabase
   * and updates AuthProvider's React state.
   */
  useEffect(() => {
    const handleGoogleLoginComplete = (
      event: MessageEvent,
    ) => {
      if (
        event.origin !==
        window.location.origin
      ) {
        return;
      }

      if (
        event.data?.type !==
        "aneks-google-login-complete"
      ) {
        return;
      }

      void refresh();
    };

    window.addEventListener(
      "message",
      handleGoogleLoginComplete,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleGoogleLoginComplete,
      );
    };
  }, [refresh]);

  /*
   * Receive OAuth failures from a popup so the main
   * authentication page can release the active flow.
   */
  useEffect(() => {
    const handleGoogleOAuthError = (
      event: MessageEvent,
    ) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "aneks-google-oauth-error"
      ) {
        return;
      }

      sessionStorage.removeItem(
        GOOGLE_REGISTRATION_NONCE_KEY,
      );

      localStorage.removeItem(
        GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
      );

      localStorage.removeItem(
        GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
      );

      toast.error(
        "Google sign-in could not be completed. Please try again.",
      );
    };

    window.addEventListener(
      "message",
      handleGoogleOAuthError,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleGoogleOAuthError,
      );
    };
  }, []);

  /*
   * Handle successful Google registration
   * authentication completed inside the popup.
   *
   * The popup sends the registration nonce to the
   * opener before closing. The opener owns the real
   * registration intent in sessionStorage and therefore
   * performs the final completion RPC here.
   *
   * Completion is single-flight: once a nonce starts
   * processing, no second message can start another
   * completion request.
   */
  useEffect(() => {
    const handleGoogleRegistrationComplete = (
      event: MessageEvent,
    ) => {
      if (
        event.origin !==
        window.location.origin
      ) {
        return;
      }

      if (
        event.data?.type !==
        "aneks-google-registration-complete"
      ) {
        return;
      }

      const nonce =
        event.data?.nonce;

      if (
        typeof nonce !== "string" ||
        !nonce
      ) {
        return;
      }

      /*
       * If a completion is already being processed,
       * ignore every additional completion message.
       *
       * This is deliberately based on a ref rather
       * than googleRegistrationBusy state.
       */
      if (
        googleRegistrationProcessingNonce.current
      ) {
        return;
      }

      /*
       * Ignore a completion that this AuthPage has
       * already consumed.
       */
      if (
        googleRegistrationHandled.current
      ) {
        return;
      }

      /*
       * The main registration page must have the
       * same nonce that was generated when the
       * registration flow started.
       */
      const storedNonce =
        sessionStorage.getItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

      if (
        !storedNonce ||
        storedNonce !== nonce
      ) {
        /*
         * Ignore stale popup messages. A delayed message
         * from an earlier attempt must never clear the
         * current nonce or sign out the active session.
         */
        console.warn(
          "Ignoring a stale Google registration completion message.",
        );

        return;
      }

      /*
 * Require confirmation that the popup actually
 * completed the Google OAuth callback for this nonce.
 */
const successfulPopupNonce =
  localStorage.getItem(
    GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
  );

if (successfulPopupNonce !== nonce) {
  console.warn(
    "Ignoring a Google registration completion message without a matching OAuth success marker.",
  );

  return;
}

      /*
       * Lock this exact registration flow before
       * starting any asynchronous work.
       *
       * This lock survives rerenders and effect
       * re-registration.
       */
      googleRegistrationHandled.current =
        true;

      googleRegistrationProcessingNonce.current =
        nonce;

      setGoogleRegistrationBusy(true);

      void (async () => {
        /*
         * The popup established the Supabase session,
         * but the AuthProvider in the main window may
         * still contain its previous React state.
         *
         * Read the authoritative session directly
         * before calling the completion RPC.
         */
        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !sessionData.session
        ) {
          console.error(
            "Google registration session error:",
            sessionError,
          );

          toast.error(
            getGoogleRegistrationErrorMessage(
              sessionError,
              "Google sign-in is not ready yet. Refresh this page to retry registration.",
            ),
          );

          googleRegistrationProcessingNonce.current =
            null;

          googleRegistrationHandled.current =
            false;

          setGoogleRegistrationBusy(false);

          return;
        }

        let completionError: string | null = null;

        try {
          const { error } = await supabase.rpc(
            "complete_google_registration",
            {
              _nonce: nonce,
            },
          );

          if (error) {
            completionError = error.message;
          }
        } catch (error) {
          completionError =
            error instanceof Error
              ? error.message
              : "Unexpected registration error";
        }

        if (completionError) {
          console.error(
            "Google registration completion error:",
            completionError,
          );

          /*
           * Keep the authenticated session and nonce.
           * Refreshing retries the same completion request
           * without creating another Auth user.
           */
          toast.error(
            getGoogleRegistrationErrorMessage(
              completionError,
              "Google registration could not be completed. Your Google session has been kept. Refresh this page to retry.",
            ),
          );

          googleRegistrationProcessingNonce.current =
            null;

          googleRegistrationHandled.current =
            false;

          setGoogleRegistrationBusy(false);

          return;
        }

        /*
         * The registration intent has now been
         * successfully consumed and the user's
         * Google registration is complete.
         */
        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
        );

        /*
         * Refresh AuthProvider so that its profile,
         * role and status reflect the values finalized
         * by complete_google_registration().
         */
        await refresh();

        /*
         * Release the processing lock only after
         * the successful completion and AuthProvider
         * refresh have finished.
         */
        googleRegistrationProcessingNonce.current =
          null;

        setGoogleRegistrationBusy(false);

        const destination = await getPostAuthDestination();

void navigate({
  to: destination,
  replace: true,
});
      })();
    };

    window.addEventListener(
      "message",
      handleGoogleRegistrationComplete,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleGoogleRegistrationComplete,
      );
    };
  }, [
    navigate,
    next,
    refresh,
  ]);

/*
 * iOS/Safari fallback for Google registration.
 *
 * The fallback only runs after the popup has written
 * an explicit success marker for the active nonce.
 *
 * It verifies the session directly through Supabase,
 * rather than depending on AuthProvider's React state.
 */
useEffect(() => {
  let checkingSession = false;

  const tryCompleteGoogleRegistration = async () => {
    if (
      loading ||
      checkingSession ||
      googleRegistrationProcessingNonce.current ||
      googleRegistrationHandled.current
    ) {
      return;
    }

    const activeRegistrationNonce =
      sessionStorage.getItem(
        GOOGLE_REGISTRATION_NONCE_KEY,
      );

    if (!activeRegistrationNonce) {
      return;
    }

    const successfulPopupNonce =
      localStorage.getItem(
        GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
      );

    if (
      !successfulPopupNonce ||
      successfulPopupNonce !== activeRegistrationNonce
    ) {
      return;
    }

    checkingSession = true;

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionData.session ||
        sessionData.session.user.app_metadata?.provider !== "google"
      ) {
        return;
      }

      /*
       * Reuse the existing completion message handler.
       * It remains responsible for the completion RPC
       * and redirect handling.
       */
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: {
            type: "aneks-google-registration-complete",
            nonce: activeRegistrationNonce,
          },
        }),
      );
    } finally {
      checkingSession = false;
    }
  };

  void tryCompleteGoogleRegistration();

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY
    ) {
      void tryCompleteGoogleRegistration();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}, [loading]);

  /*
   * A Google OAuth popup should never render the
   * normal authentication page.
   *
   * The popup exists only to complete the OAuth
   * transaction. Once Supabase has established
   * the session, the popup closes.
   */
  useEffect(() => {
    if (!isGoogleOAuthPopup || loading) {
      return;
    }

    if (!session) {
      return;
    }

    /*
     * Registration popups use their own dedicated
     * postMessage handler below. Do not close them here:
     * doing so would cancel that handler before it can
     * notify the opener.
     */
    if (google_registration_nonce) {
      return;
    }

    /*
     * Ordinary Google login popup. Notify the opener
     * before closing so the main tab can synchronize
     * its AuthProvider session state.
     */
    if (window.opener) {
      window.opener.postMessage(
        {
          type: "aneks-google-login-complete",
        },
        window.location.origin,
      );
    }

    window.close();

  }, [
    isGoogleOAuthPopup,
    loading,
    session,
    google_registration_nonce,
  ]);

  /*
   * Handle a raw bad_oauth_state response.
   *
   * This is retained as a safety net for any stale
   * OAuth URL that may still exist in browser history
   * from before the popup flow was introduced.
   */
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );

    const errorCode =
      params.get("error_code") ||
      params.get("error");

    const isGoogleOAuthFailure = isGoogleOAuthPopup
      ? Boolean(errorCode)
      : errorCode === "bad_oauth_state";

    if (
      !isGoogleOAuthFailure ||
      googleOAuthErrorHandled.current
    ) {
      return;
    }

    googleOAuthErrorHandled.current = true;

    if (isGoogleOAuthPopup) {
      /*
       * OAuth errors return to the popup URL. Notify the
       * opener and close this window instead of leaving
       * the popup on the "Completing Google sign-in" screen.
       */
      localStorage.removeItem(
        GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
      );

      localStorage.removeItem(
        GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
      );

      if (window.opener) {
        window.opener.postMessage(
          {
            type: "aneks-google-oauth-error",
          },
          window.location.origin,
        );
      }

      window.close();
      return;
    }

    sessionStorage.removeItem(
      GOOGLE_REGISTRATION_NONCE_KEY,
    );

    localStorage.removeItem(
      GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
    );

    clearLocalSupabaseSession();

    toast.error(
      "Google sign-in expired. Please try again.",
    );

    void navigate({
      to: "/auth",
      search: {
        mode: "login",
      },
      replace: true,
    });
  }, [
    isGoogleOAuthPopup,
    navigate,
  ]);

  /*
   * Authorized Google registration callback.
   *
   * This remains available for an existing direct
   * callback URL. Normal registration continues to
   * use the existing registration flow.
   */
  useEffect(() => {
    if (isGoogleOAuthPopup) {
      return;
    }

    if (loading) {
      return;
    }

    /*
     * Authorized Google registration callback.
     *
     * The nonce proves that the Google OAuth flow
     * was started from the Create Account flow.
     */
    if (google_registration_nonce) {
      if (!session) {
        return;
      }

      /*
       * The popup completion flow owns this
       * registration when it is already processing.
       *
       * This also prevents the direct callback path
       * from competing with another completion path.
       */
      if (
        googleRegistrationProcessingNonce.current
      ) {
        return;
      }

      if (
        googleRegistrationHandled.current
      ) {
        return;
      }

      const storedNonce =
        sessionStorage.getItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

      if (
        !storedNonce ||
        storedNonce !== google_registration_nonce
      ) {
        /*
         * Reject this callback without destroying the
         * current session or overwriting another active
         * registration attempt.
         */
        toast.error(
          "Google registration could not be verified. Please start registration again.",
        );

        void navigate({
          to: "/auth",
          search: {
            mode: "register",
          },
          replace: true,
        });

        return;
      }

      /*
       * Lock the nonce before the RPC begins.
       */
      googleRegistrationHandled.current =
        true;

      googleRegistrationProcessingNonce.current =
        google_registration_nonce;

      setGoogleRegistrationBusy(true);

      void (async () => {
        let completionError: string | null = null;

        try {
          const { error } = await supabase.rpc(
            "complete_google_registration",
            {
              _nonce: google_registration_nonce,
            },
          );

          if (error) {
            completionError = error.message;
          }
        } catch (error) {
          completionError =
            error instanceof Error
              ? error.message
              : "Unexpected registration error";
        }

        if (completionError) {
          console.error(
            "Google registration completion error:",
            completionError,
          );

          /*
           * Preserve the URL nonce, stored nonce and
           * authenticated session. Refreshing this page
           * retries completion with the same registration
           * intent instead of creating another Auth user.
           */
          toast.error(
            "Google registration could not be completed. Your Google session has been kept. Refresh this page to retry.",
          );

          googleRegistrationProcessingNonce.current =
            null;

          googleRegistrationHandled.current =
            false;

          setGoogleRegistrationBusy(false);

          return;
        }

        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
        );

        await refresh();

        googleRegistrationProcessingNonce.current =
          null;

        setGoogleRegistrationBusy(false);

        const destination = await getPostAuthDestination();

void navigate({
  to: destination,
  replace: true,
});
      })();

      return;
    }


        /*
     * The main registration window does not have
     * google_registration_nonce in its URL because
     * that nonce belongs to the popup callback URL.
     *
     * However, the main window keeps the active
     * registration nonce in sessionStorage.
     *
     * While that nonce exists, the Google session
     * belongs to the registration flow and must not
     * be treated as an ordinary Google login.
     *
     * The normal Google-login guard must not treat
     * this active registration as an ordinary login.
     */
    const activeRegistrationNonce =
      sessionStorage.getItem(
        GOOGLE_REGISTRATION_NONCE_KEY,
      );

    if (activeRegistrationNonce) {
      return;
    }

    /*
     * No active session means there is
     * nothing else to process.
     */
    if (!session) {
      googleLoginGuardHandled.current =
        false;

      return;
    }

    /*
     * Ordinary Google login needs an
     * additional registration check.
     */
    const provider =
      session.user.app_metadata
        ?.provider;

    if (provider === "google") {

      /*
       * If this Google login has already been
       * blocked during the current browser flow,
       * do not run the registration check again.
       *
       * This prevents the cleanup RPC from being
       * called a second time when the user navigates
       * between Home, Login, and Register.
       */
      const blockedState =
        sessionStorage.getItem(
          GOOGLE_LOGIN_BLOCKED_STATE_KEY,
        );

      if (blockedState === "1") {
        return;
      }

      if (
        googleLoginGuardHandled.current
      ) {
        return;
      }

      googleLoginGuardHandled.current =
        true;

      void (async () => {
        let registrationCompleted = false;
        let verificationError: string | null = null;

        try {
          const { data, error } = await supabase.rpc(
            "is_google_registration_completed",
          );

          if (error) {
            verificationError = error.message;
          } else {
            registrationCompleted = data === true;
          }
        } catch (error) {
          verificationError =
            error instanceof Error
              ? error.message
              : "Unexpected verification error";
        }

        if (verificationError) {
          console.error(
            "Google registration verification error:",
            verificationError,
          );

          /*
           * Keep the Auth session intact. This check is
           * required before granting access, so leave the
           * user on the authentication page and let them
           * retry by refreshing if the RPC was temporarily
           * unavailable.
           */
          toast.error(
            "We could not verify your Google account. Refresh this page and try again.",
          );

          return;
        }

        /*
         * Existing/completed Google account.
         */
        if (registrationCompleted) {
          /*
           * Clear any stale blocked-login state
           * before continuing with a valid login.
           */
          sessionStorage.removeItem(
            GOOGLE_LOGIN_BLOCKED_STATE_KEY,
          );

          sessionStorage.removeItem(
            GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
          );

          toast.success(
            "Welcome back.",
          );

          const destination = await getPostAuthDestination();

void navigate({
  to: destination,
  replace: true,
});

          return;
        }

        /*
         * A Google Auth user exists, but the
         * registration flow was never completed.
         *
         * Mark this login as blocked BEFORE
         * navigating so the same Google session
         * cannot be processed again.
         */
        sessionStorage.setItem(
          GOOGLE_LOGIN_BLOCKED_STATE_KEY,
          "1",
        );

        /*
         * An incomplete Google account must not be
         * deleted automatically. Keep its Auth user
         * and session so registration can finish it.
         */
        sessionStorage.setItem(
          GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
          "This Google account is not registered with Aneks Library. Please continue creating your account.",
        );

        /*
         * Keep the authenticated Google session and
         * send the user to the registration choices.
         * The incomplete Auth user is not deleted.
         */
        void navigate({
          to: "/auth",
          search: {
            mode: "register",
          },
        });
      })();

      return;
    }

/*
 * Existing email/password session.
 */
if (!existingSessionRedirectHandled.current) {
  existingSessionRedirectHandled.current = true;

  const redirectToPostAuthDestination = async () => {
    const destination =
      await getPostAuthDestination();

    void navigate({
      to: destination,
      replace: true,
    });
  };

  void redirectToPostAuthDestination();
}
  }, [
    loading,
    session,
    google_registration_nonce,
    navigate,
    next,
    isGoogleOAuthPopup,
    refresh,
  ]);

  /*
   * A registration popup needs the nonce from
   * shared localStorage rather than sessionStorage.
   *
   * The popup itself completes the OAuth handshake,
   * while the main window remains responsible for
   * the normal registration authorization flow.
   */
  useEffect(() => {
    if (
      !isGoogleOAuthPopup ||
      !google_registration_nonce ||
      loading ||
      !session
    ) {
      return;
    }

    const popupNonce =
      localStorage.getItem(
        GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
      );

    if (
      !popupNonce ||
      popupNonce !==
        google_registration_nonce
    ) {
      localStorage.removeItem(
        GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
      );

      if (window.opener) {
        window.opener.postMessage(
          {
            type: "aneks-google-oauth-error",
          },
          window.location.origin,
        );
      }

      window.close();

      return;
    }

    /*
 * Record explicit OAuth callback success before
 * notifying the opener. The main window can use
 * this marker if postMessage delivery fails.
 */
localStorage.setItem(
  GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
  google_registration_nonce,
);

localStorage.removeItem(
  GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
);

     /*
     * Notify the opener that the Google
     * registration authentication succeeded.
     *
     * The opener already has the real registration
     * nonce in its own sessionStorage and will run
     * complete_google_registration().
     */
    if (window.opener) {
      window.opener.postMessage(
        {
          type:
            "aneks-google-registration-complete",
          nonce:
            google_registration_nonce,
        },
        window.location.origin,
      );
    }

    window.setTimeout(() => {
      window.close();
    }, 300);
  }, [
    isGoogleOAuthPopup,
    google_registration_nonce,
    loading,
    session,
  ]);

  if (isGoogleOAuthPopup) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Completing Google sign-in...
        </div>
      </div>
    );
  }

  if (
    google_registration_nonce &&
    googleRegistrationBusy
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Completing Google registration...
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left — form */}
      <div className="relative flex flex-col p-6 sm:p-10">

        {/* <Link to="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt="Aneks Library"
            className="h-12 w-12 object-contain"
          />

          <span className="hidden md:block font-display text-lg font-semibold tracking-tight">
            <span className="text-gold">Aneks</span>Library
          </span>
        </Link> */}

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          {mode === "login" && (
            <LoginForm
              resetGoogleLoginGuard={
                resetGoogleLoginGuard
              }
            />
          )}

          {mode === "register" && (
              <RegisterForm googleRegistrationBusy={googleRegistrationBusy} />
            )}

          {mode === "forgot" && <ForgotForm />}

          <p className="mt-8 text-left text-xs text-muted-foreground">
            By continuing you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>

      {/* Right — visual */}
      <div className="relative hidden lg:block">
        <img
          src={heroImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            EMBRACE KNOWLEDGE AND EMPOWER MINDS
          </p>

          <h2 className="mt-3 max-w-md font-display text-4xl font-semibold leading-tight">
            Develop a passion for learning. You'll never cease to grow.
          </h2>

          <p className="mt-3 max-w-md text-sm text-primary-foreground/80">
            Access verified academic resources, contribute valuable materials,
            and learn with a growing community of students and lecturers, all
            in one trusted library.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  resetGoogleLoginGuard,
}: {
  resetGoogleLoginGuard: () => void;
}) {
  const [showPass, setShowPass] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [remember, setRemember] =
    useState(true);

  const navigate =
    useNavigate();

  const handleGoogle =
    async () => {
      /*
       * A new explicit Google-login attempt starts
       * a completely new authentication flow.
       */
      resetGoogleLoginGuard();

sessionStorage.removeItem(
  GOOGLE_LOGIN_BLOCKED_STATE_KEY,
);

sessionStorage.removeItem(
  GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
);

/*
 * A new explicit Google-login attempt abandons
 * any incomplete registration attempt from an
 * earlier popup.
 *
 * This prevents a stale registration nonce from
 * suppressing the ordinary Google-login guard.
 */
      sessionStorage.removeItem(
        GOOGLE_REGISTRATION_NONCE_KEY,
      );

      localStorage.removeItem(
        GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
      );

      localStorage.removeItem(
        GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
      );

      setBusy(true);

      /*
       * Open the popup synchronously from the
       * button click before awaiting Supabase.
       *
       * This prevents Chrome from treating the
       * popup as a delayed/non-user-initiated
       * window.
       */
      const popup =
        window.open(
          "",
          "aneks-google-oauth",
          "width=500,height=650,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes",
        );

      if (!popup) {
        setBusy(false);

        toast.error(
          "Please allow popups for Aneks Library to continue with Google.",
        );

        return;
      }

      try {
        /*
         * Supabase must NOT redirect the current
         * browser tab automatically.
         *
         * We obtain the OAuth URL and send it to
         * the popup ourselves.
         */
        const { data, error } =
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo:
                `${window.location.origin}/auth?google_oauth_popup=1`,
              skipBrowserRedirect: true,
            },
          });

        if (error) {
          popup.close();

          toast.error(
            error.message,
          );

          return;
        }

        if (!data.url) {
          popup.close();

          toast.error(
            "Unable to start Google sign-in.",
          );

          return;
        }

        popup.location.href =
          data.url;

        popup.focus();
      } catch (error) {
        popup.close();

        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to start Google sign-in.",
        );
      } finally {
        setBusy(false);
      }
    };

  const handleSubmit =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      const normalizedEmail =
        email.trim().toLowerCase();

      setBusy(true);

      const {
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: normalizedEmail,
            password,
          },
        );

      setBusy(false);

      if (error) {
        toast.error(
          error.message,
        );

        return;
      }

      if (!remember) {
        sessionStorage.setItem(
          "aneks-remember",
          "0",
        );
      }

      toast.success(
        "Welcome back.",
      );

      navigate({
        to: "/dashboard",
      });
    };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">
        Welcome back
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Login to your Aneks Library account.
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full"
        onClick={handleGoogle}
        disabled={busy}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="email">
            Email
          </Label>

          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value,
              )
            }
            className="mt-1.5"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Password
            </Label>

            <Link
              to="/auth"
              search={{
                mode: "forgot",
              }}
              className="text-xs text-primary hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="relative mt-1.5">
            <Input
              id="password"
              type={
                showPass
                  ? "text"
                  : "password"
              }
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value,
                )
              }
            />

            <button
              type="button"
              onClick={() =>
                setShowPass(
                  (v) => !v,
                )
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={
                showPass
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) =>
              setRemember(
                e.target.checked,
              )
            }
            className="rounded border-border"
          />
          Remember me on this device
        </label>

       <Button
  type="submit"
  disabled={busy}
  className="group w-full bg-gradient-emerald text-primary-foreground shadow-soft transition-all hover:bg-none hover:bg-accent hover:shadow-md"
>
  {busy && (
    <Loader2 className="mr-2 h-4 w-4 animate-spin transition-colors group-hover:text-primary" />
  )}

  <span className="transition-colors group-hover:text-primary">
    Log In
  </span>
</Button>
      </form>

      <p className="mt-6 text-left text-sm text-muted-foreground">
        Don't have an account? &nbsp;{" "}
        <Link
          to="/auth"
          search={{
            mode: "register",
          }}
          className="font-medium text-primary hover:underline"
        >
          Create &nbsp;
        </Link>{" "}
        | &nbsp;

        <Link
          to="/"
          className="font-medium text-primary hover:underline"
        >
          Home
        </Link>
      </p>
    </div>
  );
}

function RegisterForm({
  googleRegistrationBusy,
}: {
  googleRegistrationBusy: boolean;
}) {
  const [showPass, setShowPass] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const googleRegistrationStarting =
    useRef(false);

  const [showValidationErrors, setShowValidationErrors] =
    useState(false);

  const [registrationMethod, setRegistrationMethod] =
  useState<"choose" | "google" | "email">("choose");

  const [role, setRole] =
    useState<RegistrationRole | "">(
      "",
    );

  const [form, setForm] =
    useState({
      full_name: "",
      email: "",
      password: "",
      confirm: "",
      college: "",
      department: "",
      level: "",
    });

  const navigate =
    useNavigate();

  const needsCollege =
    role === "student" ||
    role === "lecturer" ||
    role === "staff";

  const needsLevel =
    role === "student";

  const departments =
    getDepartments(
      form.college,
    );

  const setField = (
    k: keyof typeof form,
    v: string,
  ) =>
    setForm((f) => ({
      ...f,
      [k]: v,
    }));

  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      form.email.trim(),
    );

  const nameValid =
    /^[A-Za-z\s'-]{3,}$/.test(
      form.full_name.trim(),
    );

  /*
   * These values are used only for the
   * visual validation state.
   *
   * The Create account button itself remains
   * clickable so that all missing fields can
   * be highlighted together.
   */
  const fullNameMissing =
    showValidationErrors &&
    form.full_name.trim() === "";

  const fullNameInvalid =
    showValidationErrors &&
    form.full_name.trim() !== "" &&
    !nameValid;

  const emailMissing =
    showValidationErrors &&
    form.email.trim() === "";

  const emailInvalid =
    showValidationErrors &&
    form.email.trim() !== "" &&
    !emailValid;

  const passwordMissing =
    showValidationErrors &&
    form.password.trim() === "";

  const confirmMissing =
    showValidationErrors &&
    form.confirm.trim() === "";

  const roleMissing =
    showValidationErrors &&
    role === "";

  const collegeMissing =
    showValidationErrors &&
    needsCollege &&
    form.college === "";

  const departmentMissing =
    showValidationErrors &&
    needsCollege &&
    form.department === "";

  const levelMissing =
    showValidationErrors &&
    needsLevel &&
    form.level === "";

  const passwordTooShort =
    showValidationErrors &&
    form.password.trim() !== "" &&
    form.password.length < 8;

  const passwordsDoNotMatch =
    showValidationErrors &&
    form.confirm.trim() !== "" &&
    form.password !== form.confirm;

  const canSubmit =
    nameValid &&
    emailValid &&
    form.password.trim() !== "" &&
    form.confirm.trim() !== "" &&
    role !== "" &&
    (
      !needsCollege ||
      (
        form.college !== "" &&
        form.department !== "" &&
        (
          !needsLevel ||
          form.level !== ""
        )
      )
    );
  
  const googleCanSubmit =
  role !== "" &&
  (
    !needsCollege ||
    (
      form.college !== "" &&
      form.department !== "" &&
      (
        !needsLevel ||
        form.level !== ""
      )
    )
  );

  const handleGoogle =
    async () => {
      if (
        googleRegistrationStarting.current ||
        busy ||
        googleRegistrationBusy
      ) {
        return;
      }

      if (!role) {
        toast.error("Please select your role first.");
        return;
      }

      if (!googleCanSubmit) {
        toast.error(
          needsLevel && !form.level
            ? "Please select your level."
            : !form.college
              ? "Please select your college."
              : "Please select your department.",
        );

        return;
      }

      /*
       * Acquire the lock only after validation succeeds.
       * Keep it while the OAuth popup is open so a second
       * click cannot overwrite the active registration nonce.
       */
      googleRegistrationStarting.current = true;
      setBusy(true);

      const nonce = crypto.randomUUID();

      /*
       * Open the registration popup synchronously from
       * the click handler, before any asynchronous work.
       */
      const popup = window.open(
        "",
        "aneks-google-registration",
        "width=500,height=650,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes",
      );

      if (!popup) {
        googleRegistrationStarting.current = false;
        setBusy(false);

        toast.error(
          "Please allow popups for Aneks Library to continue with Google.",
        );

        return;
      }

      let oauthStarted = false;

      try {
        localStorage.removeItem(
          GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
      );
        sessionStorage.setItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
          nonce,
        );

        localStorage.setItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
          nonce,
        );

        const { error: intentError } = await supabase.rpc(
          "create_google_registration_intent",
          {
            _nonce: nonce,
            _role: role,
            _college: needsCollege
              ? form.college || undefined
              : undefined,
            _department: needsCollege
              ? form.department || undefined
              : undefined,
            _level: needsLevel
              ? form.level || undefined
              : undefined,
          },
        );

        if (intentError) {
          throw new Error(intentError.message);
        }

        const redirectUrl =
          `${window.location.origin}/auth` +
          `?google_registration_nonce=${encodeURIComponent(nonce)}` +
          `&google_oauth_popup=1`;

        const { data, error } =
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: redirectUrl,
              skipBrowserRedirect: true,
            },
          });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.url) {
          throw new Error(
            "Unable to start Google registration.",
          );
        }

        popup.location.href = data.url;
        popup.focus();

        oauthStarted = true;

        /*
         * Release the form lock when the popup closes.
         * Keep the nonce: the popup sends it to the opener
         * immediately before closing after successful OAuth.
         */
        const popupMonitor = window.setInterval(() => {
          if (popup.closed) {
            window.clearInterval(popupMonitor);
            googleRegistrationStarting.current = false;
            setBusy(false);
          }
        }, 500);
      } catch (error) {
        popup.close();

        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_SUCCESS_NONCE_KEY,
        );

        toast.error(
            getGoogleRegistrationErrorMessage(
              error,
            "Unable to start Google registration.",
          ),
        );
      } finally {
        if (!oauthStarted) {
          googleRegistrationStarting.current = false;
          setBusy(false);
        }
      }
    };

    const handleSubmit =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      /*
       * Always activate visual validation first.
       *
       * This allows the user to see every missing
       * required field at once instead of discovering
       * them one by one.
       */
      setShowValidationErrors(true);

      const normalizedEmail =
        form.email.trim().toLowerCase();

      /*
       * Required-field validation.
       *
       * Do not submit anything until all required
       * fields are present.
       */
      if (!canSubmit) {
        return;
      }

      if (
        form.password.length < 8
      ) {
        toast.error(
          "Password must be at least 8 characters.",
        );

        return;
      }

      if (
        form.password !==
        form.confirm
      ) {
        toast.error(
          "Passwords don't match.",
        );

        return;
      }

      if (
        form.full_name.trim()
          .length < 3
      ) {
        toast.error(
          "Full name must be at least 3 characters.",
        );

        return;
      }

      if (!nameValid) {
        toast.error(
          "Full name must be at least 3 letters and contain only letters.",
        );

        return;
      }

      setBusy(true);

      try {
        const {
          data,
          error,
        } =
          await supabase.auth.signUp(
            {
              email:
                normalizedEmail,
              password:
                form.password,
              options: {
                emailRedirectTo:
                  `${window.location.origin}/auth`,
                data: {
                  full_name:
                    form.full_name,
                  role,
                  college:
                    needsCollege
                      ? form.college
                      : null,
                  department:
                    needsCollege
                      ? form.department
                      : null,
                  level:
                    needsLevel
                      ? form.level
                      : null,
                },
              },
            },
          );

        if (error) {
          const message =
            error.message.toLowerCase();

          if (
            message.includes(
              "already",
            ) ||
            message.includes(
              "registered",
            ) ||
            message.includes(
              "exists",
            )
          ) {
            toast.error(
              "This account is already registered. Please proceed to the Login page and sign in using Google or your Email and password.",
            );
          } else {
            toast.error(
              error.message,
            );
          }

          return;
        }

        /*
         * Supabase may return an obfuscated user
         * with no error when the email already belongs
         * to an existing account. An empty identities
         * array means no new account was created.
         */
        if (
          data.user &&
          data.user.identities &&
          data.user.identities.length === 0
        ) {
          toast.error(
            "This account is already registered. Please proceed to the Login page and sign in using Google or your Email and password.",
          );

          return;
        }

        toast.success(
          "Check your email to verify your account.",
        );

        navigate({
          to: "/verify-email",
          search: {
            email:
              normalizedEmail,
          },
        });
      } finally {
        setBusy(false);
      }
    };

    if (registrationMethod === "choose") {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">
        Create your account
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Choose how you'd like to join Aneks Library.
        You only need to use one registration method.
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 h-auto w-full justify-start py-4"
        onClick={() => setRegistrationMethod("google")}
      >
        <GoogleIcon />
        <span className="flex flex-col items-start">
          <span className="font-semibold">
            Continue with Google
          </span>
          <span className="mt-1 text-xs font-normal text-muted-foreground">
            Use Google for your name and email.
          </span>
        </span>
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-auto w-full justify-start py-4"
        onClick={() => setRegistrationMethod("email")}
      >
        <Mail className="mr-2 h-4 w-4 transition-colors group-hover:text-primary" />

  <span className="flex flex-col items-start">
    <span className="font-semibold transition-colors group-hover:text-primary">
      Create account with email
    </span>

    <span className="mt-1 text-xs font-normal text-muted-foreground">
      Enter your details and create a password.
    </span>
  </span>
</Button>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/auth"
          search={{ mode: "login" }}
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>
        {" | "}
        <Link
          to="/"
          className="font-medium text-primary hover:underline"
        >
          Home
        </Link>
      </p>
    </div>
  );
}

if (registrationMethod === "google") {
  return (
    <div>
      <button
        type="button"
        onClick={() => setRegistrationMethod("choose")}
        className="mb-10 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 inline h-4 w-4" />
        Back
      </button>

      <h1 className="font-display text-2xl font-semibold">
        Register with Google
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Select your role and complete the required academic
        details.
      </p>

      <div className="mt-10 space-y-4">
        <div>
          <Label className="mb-4 block">Account role</Label>

          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v as RegistrationRole);

              setForm((prev) => ({
                ...prev,
                college:
                  v === "student" ||
                  v === "lecturer" ||
                  v === "staff"
                    ? prev.college
                    : "",
                department:
                  v === "student" ||
                  v === "lecturer" ||
                  v === "staff"
                    ? prev.department
                    : "",
                level:
                  v === "student"
                    ? prev.level
                    : "",
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>

            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {role !== "" && role !== "student" && (
          <p className="text-xs font-medium leading-relaxed text-destructive">
            {ROLES.find((r) => r.value === role)?.label}{" "}
            accounts require admin approval before dashboard access.
          </p>
        )}

        {needsCollege && (
          <>
            <div>
              <Label>College</Label>

              <Select
                value={form.college}
                onValueChange={(value) => {
                  setForm((prev) => ({
                    ...prev,
                    college: value,
                    department: "",
                  }));
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select College" />
                </SelectTrigger>

                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college.id} value={college.id}>
                      <span className="sm:hidden">
                        {college.id}
                      </span>
                      <span className="hidden sm:inline">
                        {college.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Department</Label>

              <Select
                value={form.department}
                onValueChange={(value) =>
                  setField("department", value)
                }
                disabled={!form.college}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>

                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {needsLevel && (
          <div>
            <Label>Level</Label>

            <Select
              value={form.level}
              onValueChange={(value) =>
                setField("level", value)
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select Level" />
              </SelectTrigger>

              <SelectContent>
                {levels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

<Button
  type="button"
  className="group w-full bg-gradient-emerald text-primary-foreground shadow-soft transition-all hover:bg-none hover:bg-accent hover:shadow-md"
  disabled={busy || googleRegistrationBusy}
  onClick={handleGoogle}
>
  {busy || googleRegistrationBusy ? (
    <Loader2 className="h-4 w-4 animate-spin transition-colors group-hover:text-primary"/>
  ) : (
    <span className="transition-colors group-hover:text-primary">
      <GoogleIcon />
    </span>
  )}

  <span className="transition-colors group-hover:text-primary">
    Continue with Google
  </span>
</Button>
      </div>

      <p className="mt-6 text-left text-sm text-muted-foreground">
        Already have an account? &nbsp;{" "}
        <Link
          to="/auth"
          search={{
            mode: "login",
          }}
          className="font-medium text-primary hover:underline"
        >
          Login&nbsp;
        </Link>{" "}
        | &nbsp;

        <Link
          to="/"
          className="font-medium text-primary hover:underline"
        >
          Home
        </Link>
      </p>
    </div>
  );
}

  return (
    <div>
      <button
  type="button"
  onClick={() => setRegistrationMethod("choose")}
  className="mb-10 text-sm text-muted-foreground hover:text-foreground"
>
  <ArrowLeft className="mr-1 inline h-4 w-4" />
  Back
</button>

<h1 className="font-display text-2xl font-semibold">
  Create account with email
</h1>

<p className="mt-2 mb-8 text-sm text-muted-foreground">
  Enter your details below, choose your role, and create
  a password to register with your email address.
</p>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        <div>
          <Label htmlFor="name">
            Full name
          </Label>

          <Input
            id="name"
            required
            value={
              form.full_name
            }
            onChange={(e) =>
              setField(
                "full_name",
                e.target.value,
              )
            }
            className={`mt-1.5 ${
              fullNameMissing ||
              fullNameInvalid
                ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                : ""
            }`}
            aria-invalid={
              fullNameMissing ||
              fullNameInvalid
            }
          />

          {fullNameMissing && (
            <p className="mt-1 text-xs text-destructive">
              Full name is required.
            </p>
          )}

          {fullNameInvalid && (
            <p className="mt-1 text-xs text-destructive">
              Full name must be at least 3
              letters and contain only
              letters.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email">
            Email
          </Label>

          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) =>
              setField(
                "email",
                e.target.value,
              )
            }
            className={`mt-1.5 ${
              emailMissing ||
              emailInvalid
                ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                : ""
            }`}
            aria-invalid={
              emailMissing ||
              emailInvalid
            }
          />

          {emailMissing && (
            <p className="mt-1 text-xs text-destructive">
              Email is required.
            </p>
          )}

          {emailInvalid && (
            <p className="mt-1 text-xs text-destructive">
              Please enter a valid email address.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="password">
              Password
            </Label>

            <div className="relative mt-1.5">
              <Input
                id="password"
                type={
                  showPass
                    ? "text"
                    : "password"
                }
                required
                autoComplete="new-password"
                value={
                  form.password
                }
                onChange={(e) =>
                  setField(
                    "password",
                    e.target.value,
                  )
                }
                className={
                  passwordMissing ||
                  passwordTooShort
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : ""
                }
                aria-invalid={
                  passwordMissing ||
                  passwordTooShort
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPass(
                    (v) => !v,
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {passwordMissing && (
              <p className="mt-1 text-xs text-destructive">
                Password is required.
              </p>
            )}

            {passwordTooShort && (
              <p className="mt-1 text-xs text-destructive">
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirm">
              Confirm Password
            </Label>

            <div className="relative">
              <Input
                id="confirm"
                type={
                  showPass
                    ? "text"
                    : "password"
                }
                required
                value={
                  form.confirm
                }
                onChange={(e) =>
                  setField(
                    "confirm",
                    e.target.value,
                  )
                }
                className={`mt-1.5 ${
                  confirmMissing ||
                  passwordsDoNotMatch
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : ""
                }`}
                aria-invalid={
                  confirmMissing ||
                  passwordsDoNotMatch
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPass(
                    (v) => !v,
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {confirmMissing && (
              <p className="mt-1 text-xs text-destructive">
                Please confirm your password.
              </p>
            )}

            {passwordsDoNotMatch && (
              <p className="mt-1 text-xs text-destructive">
                Passwords don't match.
              </p>
            )}
          </div>
        </div>

        <div>
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(
                v as RegistrationRole,
              );

              setForm((prev) => ({
                ...prev,
                college:
                  v === "student" ||
                  v === "lecturer" ||
                  v === "staff"
                    ? prev.college
                    : "",
                department:
                  v === "student" ||
                  v === "lecturer" ||
                  v === "staff"
                    ? prev.department
                    : "",
                level:
                  v === "student"
                    ? prev.level
                    : "",
              }));
            }}
          >
            <SelectTrigger
              className={`mt-1.5 ${
                roleMissing
                  ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                  : ""
              }`}
              aria-invalid={
                roleMissing
              }
            >
              <SelectValue placeholder="Select Role" />
            </SelectTrigger>

            <SelectContent>
              {ROLES.map(
                (r) => (
                  <SelectItem
                    key={r.value}
                    value={r.value}
                  >
                    {r.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>

          {roleMissing && (
            <p className="mt-1 text-xs text-destructive">
              Please select your role.
            </p>
          )}

          {role !== "" &&
            role !== "student" && (
              <p className="mt-2 text-xs font-medium leading-relaxed text-destructive">
                {
                  ROLES.find(
                    (r) =>
                      r.value ===
                      role,
                  )?.label
                }{" "}
                accounts require admin
                approval before dashboard
                access.
              </p>
            )}
        </div>

        <div
          className={`-mx-1 overflow-hidden px-1 transition-all duration-300 ${
            needsCollege
              ? "max-h-96 opacity-100 mt-4"
              : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-3 pb-2">
            <div className="w-full">
              <Label>
                College
              </Label>

              <Select
                value={
                  form.college
                }
                onValueChange={(
                  value,
                ) => {
                  setForm(
                    (prev) => ({
                      ...prev,
                      college:
                        value,
                      department:
                        "",
                    }),
                  );
                }}
              >
                <SelectTrigger
                  className={`mt-1.5 ${
                    collegeMissing
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : ""
                  }`}
                  aria-invalid={
                    collegeMissing
                  }
                >
                  <SelectValue placeholder="Select College" />
                </SelectTrigger>

                <SelectContent>
                  {colleges.map(
                    (college) => (
                      <SelectItem
                        key={
                          college.id
                        }
                        value={
                          college.id
                        }
                      >
                        <span className="sm:hidden">
                          {
                            college.id
                          }
                        </span>

                        <span className="hidden sm:inline">
                          {
                            college.name
                          }
                        </span>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              {collegeMissing && (
                <p className="mt-1 text-xs text-destructive">
                  Please select your college.
                </p>
              )}
            </div>

            <div className="w-full">
              <Label>
                Department
              </Label>

              <Select
                value={
                  form.department
                }
                onValueChange={(
                  value,
                ) =>
                  setField(
                    "department",
                    value,
                  )
                }
              >
                <SelectTrigger
                  className={`mt-1.5 ${
                    departmentMissing
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : ""
                  }`}
                  aria-invalid={
                    departmentMissing
                  }
                >
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>

                <SelectContent>
                  {!form.college ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Select College first
                    </div>
                  ) : (
                    departments.map(
                      (
                        department,
                      ) => (
                        <SelectItem
                          key={
                            department
                          }
                          value={
                            department
                          }
                        >
                          {
                            department
                          }
                        </SelectItem>
                      ),
                    )
                  )}
                </SelectContent>
              </Select>

              {departmentMissing && (
                <p className="mt-1 text-xs text-destructive">
                  Please select your department.
                </p>
              )}
            </div>

            {needsLevel && (
              <div className="w-full">
                <Label>
                  Level
                </Label>

                <Select
                  value={
                    form.level
                  }
                  onValueChange={(
                    value,
                  ) =>
                    setField(
                      "level",
                      value,
                    )
                  }
                >
                  <SelectTrigger
                    className={`mt-1.5 ${
                      levelMissing
                        ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                        : ""
                    }`}
                    aria-invalid={
                      levelMissing
                    }
                  >
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>

                  <SelectContent>
                    {levels.map(
                      (level) => (
                        <SelectItem
                          key={level}
                          value={level}
                        >
                          {level}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                
                {levelMissing && (
                  <p className="mt-1 text-xs text-destructive">
                    Please select your level.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <Button
  type="submit"
  disabled={busy}
  className="group w-full bg-gradient-emerald text-primary-foreground shadow-soft transition-all hover:bg-none hover:bg-accent hover:shadow-md"
>
  {busy && (
    <Loader2 className="mr-2 h-4 w-4 animate-spin transition-colors group-hover:text-primary" />
  )}

  <Mail className="mr-2 h-4 w-4 transition-colors group-hover:text-primary" />

  <span className="transition-colors group-hover:text-primary">
    Create account
  </span>
</Button>
      </form>

      <p className="mt-6 text-left text-sm text-muted-foreground">
        Already have an account? &nbsp;{" "}
        <Link
          to="/auth"
          search={{
            mode: "login",
          }}
          className="font-medium text-primary hover:underline"
        >
          Login&nbsp;
        </Link>{" "}
        | &nbsp;

        <Link
          to="/"
          className="font-medium text-primary hover:underline"
        >
          Home
        </Link>
      </p>
    </div>
  );
}

function ForgotForm() {
  const [busy, setBusy] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [sent, setSent] =
    useState(false);

  const normalizedEmail =
    email.trim().toLowerCase();

  const handleSubmit =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      setBusy(true);

      const {
        error,
      } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo:
              `${window.location.origin}/reset-password`,
          },
        );

      setBusy(false);

      if (error) {
        return toast.error(
          error.message,
        );
      }

      setSent(true);

      toast.success(
        "Reset link sent — check your email.",
      );
    };

  return (
    <div>
      <Link
        to="/auth"
        search={{
          mode: "login",
        }}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to sign in
      </Link>

      <h1 className="font-display text-3xl font-semibold">
        Reset your password
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Enter your email and we'll send you a reset link.
      </p>

      {sent ? (
        <div className="mt-8 rounded-sm border border-primary/30 bg-primary/5 p-6 text-center">
          <Mail className="mx-auto h-8 w-8 text-primary" />

          <p className="mt-3 font-medium">
            Check your inbox
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            We sent a reset link to{" "}
            <span className="text-foreground">
              {normalizedEmail}
            </span>
            .
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <div>
            <Label htmlFor="email">
              Email
            </Label>

            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value,
                )
              }
              className="mt-1.5"
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-emerald text-primary-foreground shadow-soft"
          >
            {busy && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}

            Send reset link
          </Button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />

      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99 0-2.26 1.06-3.71 1.06-2.85 0-5.27-1.92-6.13-4.5H2.18v2.83A11 11 0 0 0 12 23Z"
      />

      <path
        fill="#FBBC05"
        d="M5.87 14.14a6.6 6.6 0 0 1 0-4.28V7.03H2.18a11 11 0 0 0 0 9.94l3.69-2.83 3.69-2.83Z"
      />

      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.69 2.83C6.73 7.3 9.15 5.38 9.15 5.38Z"
      />
    </svg>
  );
}