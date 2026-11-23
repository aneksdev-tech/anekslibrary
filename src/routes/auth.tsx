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

const GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY =
  "aneks-google-login-blocked-message";

const GOOGLE_LOGIN_BLOCKED_STATE_KEY =
  "aneks-google-login-blocked-state";

const GOOGLE_POPUP_ERROR_KEY =
  "aneks-google-popup-error";

const SUPABASE_AUTH_STORAGE_KEY =
  "sb-riiwtxfigbwsjixwdlcq-auth-token";

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
        googleRegistrationHandled.current =
          true;

        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        toast.error(
          "Google registration could not be verified. Please start registration again.",
        );

        void supabase.auth.signOut();

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

          sessionStorage.removeItem(
            GOOGLE_REGISTRATION_NONCE_KEY,
          );

          localStorage.removeItem(
            GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
          );

          toast.error(
            "Google registration could not be completed. Please try again.",
          );

          await supabase.auth.signOut();

          googleRegistrationProcessingNonce.current =
            null;

          googleRegistrationHandled.current =
            false;

          setGoogleRegistrationBusy(false);

          void navigate({
            to: "/auth",
            search: {
              mode: "register",
            },
            replace: true,
          });

          return;
        }

        const {
          data: completionData,
          error,
        } = await supabase.rpc(
          "complete_google_registration",
          {
            _nonce: nonce,
          },
        );

        if (error) {
  const isAlreadyRegistered =
    error.code === "P0001" &&
    (
      error.message ===
        "This Google account is not eligible for this registration request" ||
      error.message ===
        "This registration flow is only available for Google accounts"
    );

  if (!isAlreadyRegistered) {
    console.error(
      "Google registration completion error:",
      error,
    );
  }

  sessionStorage.removeItem(
    GOOGLE_REGISTRATION_NONCE_KEY,
  );

  localStorage.removeItem(
    GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
  );

  if (isAlreadyRegistered) {
    toast.error(
      "This account is already registered. Please proceed to the Login page and sign in using Google or your Email and password.",
    );
  } else {
    toast.error(
      "Google registration could not be completed. Please try again.",
    );
  }

  await supabase.auth.signOut();

  googleRegistrationProcessingNonce.current =
    null;

  googleRegistrationHandled.current =
    false;

  setGoogleRegistrationBusy(false);

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

        void navigate({
          to:
            next || "/dashboard",
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
   * Some browsers may successfully establish the
   * Supabase session inside the OAuth popup but fail
   * to deliver window.opener.postMessage() back to
   * the main registration window.
   *
   * The main window already owns the registration nonce
   * in sessionStorage. Once an authenticated Google
   * session becomes available, dispatch the same
   * completion event locally so the existing registration
   * completion handler above performs the RPC.
   *
   * This does not create a second completion path.
   * It reuses the exact same handler and safeguards.
   */
  useEffect(() => {
    if (
      loading ||
      !session ||
      googleRegistrationProcessingNonce.current
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

    /*
     * Only Google sessions can complete a Google
     * registration flow.
     */
    const provider =
      session.user.app_metadata
        ?.provider;

    if (provider !== "google") {
      return;
    }

    /*
     * The existing message handler already prevents
     * duplicate completion attempts.
     *
     * If it has already consumed this registration,
     * there is nothing for the fallback to do.
     */
    if (
      googleRegistrationHandled.current
    ) {
      return;
    }

    /*
     * Reuse the exact same event consumed by the
     * existing popup completion handler.
     *
     * This is the important iOS fallback: if the popup
     * could not deliver postMessage(), the main window
     * completes the same flow itself.
     */
    window.dispatchEvent(
      new MessageEvent("message", {
        origin:
          window.location.origin,
        data: {
          type:
            "aneks-google-registration-complete",
          nonce:
            activeRegistrationNonce,
        },
      }),
    );
  }, [
    loading,
    session,
  ]);

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
     * Ordinary Google login popup.
     *
     * Registration popups have a registration nonce
     * and use their own dedicated postMessage flow below.
     *
     * Notify the opener before closing so the main tab
     * can synchronize its AuthProvider session state.
     */
    if (
      !google_registration_nonce &&
      window.opener
    ) {
      window.opener.postMessage(
        {
          type:
            "aneks-google-login-complete",
        },
        window.location.origin,
      );
    }

        /*
     * The completion message has been dispatched to
     * the opener. Close the OAuth popup immediately.
     *
     * Do not delay this with setTimeout because the
     * popup may navigate to an account-status page
     * before the timer fires. That navigation would
     * unmount this effect and cancel the close timer.
     */
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
    if (isGoogleOAuthPopup) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search,
      );

    const errorCode =
      params.get("error_code");

    if (
      errorCode !== "bad_oauth_state" ||
      googleOAuthErrorHandled.current
    ) {
      return;
    }

    googleOAuthErrorHandled.current =
      true;

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
        storedNonce !==
          google_registration_nonce
      ) {
        googleRegistrationHandled.current =
          true;

        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        toast.error(
          "Google registration could not be verified. Please start registration again.",
        );

        void supabase.auth.signOut();

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
        const {
          data: completionData,
          error,
        } = await supabase.rpc(
          "complete_google_registration",
          {
            _nonce:
              google_registration_nonce,
          },
        );

        if (error) {
  const isAlreadyRegistered =
    error.code === "P0001" &&
    (
      error.message ===
        "This Google account is not eligible for this registration request" ||
      error.message ===
        "This registration flow is only available for Google accounts"
    );

  if (!isAlreadyRegistered) {
    console.error(
      "Google registration completion error:",
      error,
    );
  }

  sessionStorage.removeItem(
    GOOGLE_REGISTRATION_NONCE_KEY,
  );

  localStorage.removeItem(
    GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
  );

  if (isAlreadyRegistered) {
    toast.error(
      "This account is already registered. Please proceed to the Login page and sign in using Google or your Email and password.",
    );
  } else {
    toast.error(
      "Google registration could not be completed. Please try again.",
    );
  }

          await supabase.auth.signOut();

          googleRegistrationProcessingNonce.current =
            null;

          googleRegistrationHandled.current =
            false;

          setGoogleRegistrationBusy(false);

          void navigate({
            to: "/auth",
            search: {
              mode: "register",
            },
            replace: true,
          });

          return;
        }

        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        await refresh();

        googleRegistrationProcessingNonce.current =
          null;

        setGoogleRegistrationBusy(false);

        void navigate({
          to:
            next || "/dashboard",
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
     * Otherwise the normal Google-login guard could
     * call cancel_unregistered_google_login() and
     * delete auth.users before complete_google_registration()
     * finishes.
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
        const {
          data,
          error,
        } = await supabase.rpc(
          "is_google_registration_completed",
        );

        if (error) {
          console.error(
            "Google registration verification error:",
            error,
          );

          googleLoginGuardHandled.current =
            false;

          await supabase.auth.signOut();

          toast.error(
            "We could not verify your Google account. Please try again.",
          );

          void navigate({
            to: "/auth",
            search: {
              mode: "login",
            },
            replace: true,
          });

          return;
        }

        /*
         * Existing/completed Google account.
         */
        if (data === true) {
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

          void navigate({
            to:
              next || "/dashboard",
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
         * Always use the same user-facing message.
         * The cleanup RPC result should not change
         * what the user sees.
         */
        sessionStorage.setItem(
          GOOGLE_LOGIN_BLOCKED_MESSAGE_KEY,
          "This account does not exist. Please create your account.",
        );

        /*
         * Remove the incomplete Google account.
         */
        const {
          error: cancelError,
        } = await supabase.rpc(
          "cancel_unregistered_google_login",
        );

        if (cancelError) {
          console.error(
            "Unregistered Google account cleanup error:",
            cancelError,
          );
        }

        /*
         * The cleanup RPC is responsible for
         * removing the incomplete Auth account.
         *
         * Do not call signOut() here because the
         * Auth user may already have been deleted.
         */
        clearLocalSupabaseSession();

        /*
         * Push Register onto the existing Login
         * history entry rather than replacing it.
         *
         * Therefore:
         *
         * Login
         *   ↓
         * Register + blocked message
         *   ↓ browser Back
         * Login
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
    void navigate({
      to:
        next || "/dashboard",
      replace: true,
    });
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

      void supabase.auth.signOut();

      window.close();

      return;
    }

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

          {mode === "register" && <RegisterForm />}

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

function RegisterForm() {
  const [showPass, setShowPass] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

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

      setBusy(true);

      const nonce =
        crypto.randomUUID();

      /*
       * Open the registration popup
       * synchronously from the button click.
       */
      const popup =
        window.open(
          "",
          "aneks-google-registration",
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
        sessionStorage.setItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
          nonce,
        );

        localStorage.setItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
          nonce,
        );

        const {
          error: intentError,
        } =
          await supabase.rpc(
            "create_google_registration_intent",
            {
              _nonce: nonce,
              _role: role,
              _college:
                needsCollege
                  ? form.college ||
                    undefined
                  : undefined,
              _department:
                needsCollege
                  ? form.department ||
                    undefined
                  : undefined,
              _level:
                needsLevel
                  ? form.level ||
                    undefined
                  : undefined,
            },
          );

        if (intentError) {
          popup.close();

          sessionStorage.removeItem(
            GOOGLE_REGISTRATION_NONCE_KEY,
          );

          localStorage.removeItem(
            GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
          );

          toast.error(
            intentError.message,
          );

          return;
        }

        const redirectUrl =
          `${window.location.origin}/auth` +
          `?google_registration_nonce=${encodeURIComponent(
            nonce,
          )}` +
          `&google_oauth_popup=1`;

        const {
          data,
          error,
        } =
          await supabase.auth.signInWithOAuth(
            {
              provider: "google",
              options: {
                redirectTo:
                  redirectUrl,
                skipBrowserRedirect: true,
              },
            },
          );

        if (error) {
          popup.close();

          sessionStorage.removeItem(
            GOOGLE_REGISTRATION_NONCE_KEY,
          );

          localStorage.removeItem(
            GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
          );

          toast.error(
            error.message,
          );

          return;
        }

        if (!data.url) {
          popup.close();

          sessionStorage.removeItem(
            GOOGLE_REGISTRATION_NONCE_KEY,
          );

          localStorage.removeItem(
            GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
          );

          toast.error(
            "Unable to start Google registration.",
          );

          return;
        }

        popup.location.href =
          data.url;

        popup.focus();
      } catch (error) {
        popup.close();

        sessionStorage.removeItem(
          GOOGLE_REGISTRATION_NONCE_KEY,
        );

        localStorage.removeItem(
          GOOGLE_REGISTRATION_POPUP_NONCE_KEY,
        );

        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to start Google registration.",
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
  disabled={busy}
  onClick={handleGoogle}
>
  {busy ? (
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
          className={`overflow-hidden transition-all duration-300 ${
            needsCollege
              ? "max-h-96 opacity-100 mt-4"
              : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-3">
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
