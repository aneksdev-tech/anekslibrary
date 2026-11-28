import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "co-admin"
  | "staff"
  | "student"
  | "lecturer"
  | "researcher"
  | "guest";

export type AccountStatus =
  | "active"
  | "pending"
  | "rejected"
  | "suspended"
  | "inactive";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  college: string | null;
  department: string | null;
  level: string | null;

  status: AccountStatus;
  primary_role: AppRole;
  reputation: number;
  created_at: string;

  subscription_plan: "free" | "premium";
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;

  roles: AppRole[];

  isAdmin: boolean;
  isCoAdmin: boolean;
  isStaff: boolean;

  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  roles: [],

  isAdmin: false,
  isCoAdmin: false,
  isStaff: false,

  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] =
    useState(true);

  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [roles, setRoles] =
    useState<AppRole[]>([]);

  const loadProfile = async (
    uid: string,
  ) => {
    const {
      data: prof,
      error,
    } = await supabase
      .from("private_profiles")
      .select(
        [
          "id",
          "full_name",
          "email",
          "avatar_url",
          "bio",
          "phone_number",
          "college",
          "department",
          "level",
          "status",
          "primary_role",
          "reputation",
          "created_at",
          "subscription_plan",
          "subscription_status",
          "subscription_started_at",
          "subscription_expires_at",
        ].join(", "),
      )
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      return false;
    }

    const nextProfile =
      (prof as unknown as Profile) ?? null;

    setProfile(nextProfile);

    setRoles(
      nextProfile?.primary_role
        ? [nextProfile.primary_role]
        : [],
    );

    return true;
  };

  const bootstrap = async () => {
    const { data } =
      await supabase.auth.getSession();

    setSession(data.session);

    if (data.session?.user) {
      await loadProfile(
        data.session.user.id,
      );
    }

    setLoading(false);
  };

  /*
   * Synchronize the authentication provider with
   * the current Supabase session.
   *
   * This is especially important after a Google OAuth
   * popup completes, because the popup can update the
   * shared Supabase auth storage without causing the
   * main tab's React state to update immediately.
   */
  const refresh = useCallback(
    async () => {
      const { data } =
        await supabase.auth.getSession();

      setSession(data.session);

      if (data.session?.user) {
        await loadProfile(
          data.session.user.id,
        );
      } else {
        setProfile(null);
        setRoles([]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    let profileChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    const setupProfileRealtime = (
      uid: string,
    ) => {
      profileChannel?.unsubscribe();

      profileChannel = supabase
        .channel(`profile:${uid}`, {
          config: {
            private: true,
          },
        })
        .on(
          "broadcast",
          {
            event: "profile_access_changed",
          },
          (payload) => {
            const updatedProfile =
              payload.payload as {
                id?: string;
                status?: AccountStatus;
                primary_role?: AppRole;
              };

            if (
              updatedProfile?.id !== uid
            ) {
              return;
            }

            setProfile(
              (currentProfile) =>
                currentProfile
                  ? {
                      ...currentProfile,
                      status:
                        updatedProfile.status ??
                        currentProfile.status,
                      primary_role:
                        updatedProfile.primary_role ??
                        currentProfile.primary_role,
                    }
                  : currentProfile,
            );

            if (
              updatedProfile.primary_role
            ) {
              setRoles([
                updatedProfile.primary_role,
              ]);
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            profileChannel?.unsubscribe();
            profileChannel = null;
          }
        });
    };

    void bootstrap();

    const {
      data: sub,
    } = supabase.auth.onAuthStateChange(
      (event, s) => {
        setSession(s);

        if (s?.user) {
          setupProfileRealtime(
            s.user.id,
          );

          /*
           * bootstrap() handles the initial session and
           * profile load. Reload for subsequent auth
           * events, including Google OAuth sign-in.
           */
          if (event !== "INITIAL_SESSION") {
            setTimeout(() => {
              void loadProfile(s.user.id);
            }, 0);
          }
        } else {
          profileChannel?.unsubscribe();
          profileChannel = null;

          setProfile(null);
          setRoles([]);
        }

        if (
          event === "SIGNED_OUT"
        ) {
          profileChannel?.unsubscribe();
          profileChannel = null;

          setProfile(null);
          setRoles([]);
        }
      },
    );

    return () => {
      sub.subscription.unsubscribe();

      profileChannel?.unsubscribe();
      profileChannel = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Publish this user's online heartbeat.
   *
   * The server derives the user ID from auth.uid().
   * Heartbeats expire after 90 seconds, so a crashed
   * browser eventually becomes offline.
   */
  useEffect(() => {
    const uid = session?.user?.id;

    if (
      !uid ||
      profile?.status !== "active"
    ) {
      return;
    }

    let cancelled = false;
    let heartbeatInFlight = false;

    const sendHeartbeat = async () => {
      if (cancelled || heartbeatInFlight) {
        return;
      }

      heartbeatInFlight = true;

      try {
        const { error } = await supabase.rpc(
          "heartbeat_user_presence",
        );

        if (error && !cancelled) {
          console.error(
            "Unable to update online presence:",
            error.message,
          );
        }
      } finally {
        heartbeatInFlight = false;
      }
    };

// Publish immediately, then refresh every 15 seconds.
void sendHeartbeat();

const intervalId = window.setInterval(
  () => {
    void sendHeartbeat();
  },
  15_000,
);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    session?.user?.id,
    profile?.status,
  ]);

  /*
   * Enforce account-status and admin-area access
   * directly from the authentication provider.
   *
   * IMPORTANT:
   *
   * Google authentication has a separate verification
   * lifecycle handled by routes/auth.tsx.
   *
   * A Google session arriving on /auth must therefore
   * be allowed to remain on /auth until auth.tsx has
   * determined whether:
   *
   * 1. it is an authorized Google registration,
   * 2. it is a completed Google account logging in, or
   * 3. it is an unregistered Google login that must
   *    be rejected and cleaned up.
   *
   * Without this exception, a pending Google profile
   * can be redirected to /pending before auth.tsx gets
   * the opportunity to complete that verification.
   */
  useEffect(() => {
    if (
  loading ||
  !session?.user ||
  !profile ||
  profile.id !== session.user.id
) {
  return;
}

    const currentPath =
      window.location.pathname;

    const isGoogleSession =
      session?.user.app_metadata?.provider ===
      "google";

    /*
     * Keep Google sessions on /auth while the Google
     * registration/login verification flow is running.
     *
     * routes/auth.tsx owns this process.
     */
    if (
      isGoogleSession &&
      currentPath === "/auth"
    ) {
      return;
    }

    /*
     * Users with roles that do not have admin-area
     * access must be removed from /admin immediately
     * when their role changes.
     */
    const canAccessAdminArea =
      profile.primary_role === "admin" ||
      profile.primary_role === "co-admin" ||
      profile.primary_role === "staff";

    const canAccessAcademicArea =
      profile.primary_role === "lecturer";

    if (
      currentPath.startsWith("/admin") &&
      !canAccessAdminArea
    ) {
      window.location.replace(
        "/dashboard",
      );

      return;
    }

    if (
      currentPath.startsWith("/academic") &&
      !canAccessAcademicArea
    ) {
      window.location.replace(
        "/dashboard",
      );

      return;
    }

    /*
     * Active accounts should not remain on
     * account-status restriction pages.
     */
    if (
      profile.status === "active"
    ) {
      if (
        currentPath === "/pending" ||
        currentPath === "/suspended" ||
        currentPath === "/rejected" ||
        currentPath === "/inactive"
      ) {
        window.location.replace(
          "/dashboard",
        );
      }

      return;
    }

    const targetPath =
      profile.status === "pending"
        ? "/pending"
        : profile.status === "suspended"
          ? "/suspended"
          : profile.status === "rejected"
            ? "/rejected"
            : profile.status === "inactive"
              ? "/inactive"
              : "/pending";

    if (
      currentPath !== targetPath
    ) {
      window.location.replace(
        targetPath,
      );
    }
  }, [
    profile?.status,
    profile?.primary_role,
    loading,
    session,
  ]);

  return (
    <AuthCtx.Provider
      value={{
        loading,
        session,
        user:
          session?.user ?? null,
        profile,
        roles,

        isAdmin:
          roles.includes("admin"),

        isCoAdmin:
          roles.includes("co-admin"),

        isStaff:
          roles.includes("staff") ||
          roles.includes("lecturer") ||
          roles.includes("co-admin") ||
          roles.includes("admin"),

        refresh,

        signOut: async () => {
  // Clear online presence before signing out.
  const { error: presenceError } =
    await supabase.rpc("clear_user_presence");

  if (presenceError) {
    console.error(
      "Unable to clear online presence:",
      presenceError.message,
    );
  }

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    console.error(
      "Unable to sign out:",
      error.message,
    );

    return;
  }

  window.location.href = "/auth?mode=login";
},
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () =>
  useContext(AuthCtx);