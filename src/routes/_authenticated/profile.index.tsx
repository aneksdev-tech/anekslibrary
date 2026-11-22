import {
  createFileRoute,
  useBlocker,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
  CalendarDays,
  Crown,
  GraduationCap,
  CircleCheck,
  Activity,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import {
  getContributorLevel,
  getLevelProgress,
  getNextContributorLevel,
} from "@/lib/reputation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  colleges,
  levels,
  getDepartments,
} from "@/lib/academicData";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({
    meta: [
      { title: "Profile | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

/*
 * Format profile dates consistently.
 */
function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/*
 * Format database labels for display.
 */
function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .split(/[_-]/)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/*
 * Subscription plan icon badge.
 */
function SubscriptionPlanBadge({
  plan,
}: {
  plan: "free" | "premium" | null | undefined;
}) {
  const isPremium = plan === "premium";

  return (
    <span
      title={isPremium ? "Premium Plan" : "Free Plan"}
      aria-label={isPremium ? "Premium Plan" : "Free Plan"}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        isPremium
          ? "border-gold/30 bg-gold/10 text-gold"
          : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
      }`}
    >
      {isPremium ? (
        <Crown className="h-3.5 w-3.5" />
      ) : (
        <GraduationCap className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

function ProfilePage() {
  const { profile, user, refresh } = useAuth();

  const isResearcher = profile?.primary_role === "researcher";
  const isLecturer = profile?.primary_role === "lecturer";
  const isStudent = profile?.primary_role === "student";
  const isStaff = profile?.primary_role === "staff";

  const collegeLocked = Boolean(profile?.college?.trim());
  const departmentLocked = Boolean(profile?.department?.trim());

  const hasAcademicInformation =
    isStudent ||
    isLecturer ||
    isStaff ||
    isResearcher;

  const needsLevel = isStudent;

  const roleLabel = profile?.primary_role
    ? profile.primary_role
        .split("-")
        .map(
          (word) =>
            word.charAt(0).toUpperCase() + word.slice(1),
        )
        .join(" ")
    : "User";

  const contributor = getContributorLevel(
    profile?.reputation ?? 0,
  );

  const progress = getLevelProgress(
    profile?.reputation ?? 0,
  );

  const nextLevel = getNextContributorLevel(
    profile?.reputation ?? 0,
  );

  const isPremium = profile?.subscription_plan === "premium";

  const subscriptionActive =
    profile?.subscription_status === "active";

  const avatarUrl = profile?.avatar_url || null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowNavigationRef = useRef(false);

  const [exitAction, setExitAction] = useState<
    "none" | "save"
  >("none");

  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    phone_number: "",
    college: "",
    department: "",
    level: "",
  });

  /*
   * This represents the last SAVED state.
   * It is intentionally separate from `form` so the completion
   * percentage never changes merely because the user is typing.
   */
  const [savedForm, setSavedForm] = useState({
    full_name: "",
    bio: "",
    phone_number: "",
    college: "",
    department: "",
    level: "",
  });

  const profileFormValues = useMemo(() => {
    if (!profile) return null;

    return {
      full_name: profile.full_name ?? "",
      bio: profile.bio ?? "",
      phone_number: profile.phone_number ?? "",
      college: profile.college ?? "",
      department: profile.department ?? "",
      level: profile.level ?? "",
    };
  }, [
    profile?.full_name,
    profile?.bio,
    profile?.phone_number,
    profile?.college,
    profile?.department,
    profile?.level,
  ]);

  useEffect(() => {
    if (!profileFormValues) return;

    setForm(profileFormValues);
    setSavedForm(profileFormValues);
  }, [profileFormValues]);

  const setField = (
    field: keyof typeof form,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const departments = useMemo(
    () => getDepartments(form.college),
    [form.college],
  );

  /*
   * Full name validation.
   */
  const fullNameValid = /^[A-Za-z\s'-]{3,}$/.test(
    form.full_name.trim(),
  );

  /*
   * Phone number:
   *
   * Formatting characters are allowed while typing:
   * + ( ) . - and spaces.
   *
   * The actual number of digits, ignoring formatting,
   * must be between 13 and 15 digits.
   *
   * Empty phone number is allowed because the field is optional.
   */
  const phoneDigits = form.phone_number.replace(/\D/g, "");

  const phoneValid =
    form.phone_number.trim() === "" ||
    (phoneDigits.length >= 13 &&
      phoneDigits.length <= 15);

  /*
   * Academic information completion is role-specific
   * and based ONLY on saved values.
   *
   * Student:
   *   College + Department + Level
   *
   * Lecturer / Staff / Researcher:
   *   College/Institution + Department/Research Area
   *
   * Users without academic information:
   *   No academic requirement.
   */
  const academicComplete = hasAcademicInformation
    ? isStudent
      ? Boolean(
          savedForm.college.trim() &&
            savedForm.department.trim() &&
            savedForm.level.trim(),
        )
      : Boolean(
          savedForm.college.trim() &&
            savedForm.department.trim(),
        )
    : true;

  /*
   * Phone completion:
   * The phone number is considered complete only when
   * it contains 13–15 actual digits, ignoring formatting
   * characters such as spaces, +, (), . and -.
   */
  const savedPhoneDigits = savedForm.phone_number.replace(
    /\D/g,
    "",
  );

  const phoneComplete =
    savedPhoneDigits.length >= 13 &&
    savedPhoneDigits.length <= 15;

  /*
   * Completion is based ONLY on saved profile information.
   *
   * Without academic information:
   *   4 items × 25% = 100%
   *
   * With academic information:
   *   5 items × 20% = 100%
   *
   * Academic requirements themselves remain role-specific.
   */
  const completionItems = [
    Boolean(profile?.avatar_url),
    Boolean(savedForm.full_name.trim()),
    phoneComplete,
    Boolean(savedForm.bio.trim()),
    ...(hasAcademicInformation
      ? [academicComplete]
      : []),
  ];

  const completion = Math.round(
    (completionItems.filter(Boolean).length /
      completionItems.length) *
      100,
  );

  /*
   * Determine whether anything has changed since the
   * last successful save.
   */
  const isDirty =
    form.full_name !== savedForm.full_name ||
    form.bio !== savedForm.bio ||
    form.phone_number !== savedForm.phone_number ||
    form.college !== savedForm.college ||
    form.department !== savedForm.department ||
    form.level !== savedForm.level;

  const blocker = useBlocker({
    shouldBlockFn: () =>
      isDirty && !allowNavigationRef.current,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  /*
   * Reset the exit action when the blocker opens.
   * Reset the navigation bypass after the blocker
   * returns to idle.
   */
  useEffect(() => {
    if (blocker.status === "blocked") {
      setExitAction("none");
    }

    if (blocker.status === "idle") {
      allowNavigationRef.current = false;
    }
  }, [blocker.status]);

  /*
   * Save button validation.
   *
   * Phone is optional, but if supplied it must contain
   * 13–15 digits.
   */
  const academicValid = hasAcademicInformation
    ? isStudent
      ? Boolean(
          form.college &&
            form.department &&
            form.level,
        )
      : Boolean(
          form.college &&
            form.department,
        )
    : true;

  const canSave =
    !busy &&
    isDirty &&
    fullNameValid &&
    phoneValid &&
    academicValid;

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!user) {
      setExitAction("none");
      toast.error("Unable to identify your account.");
      return;
    }

    if (!fullNameValid) {
      setExitAction("none");
      toast.error(
        "Full name must be at least 3 letters and contain only letters, spaces, apostrophes, or hyphens.",
      );
      return;
    }

    if (!phoneValid) {
      setExitAction("none");
      toast.error(
        "Phone number must contain 13–15 digits.",
      );
      return;
    }

    if (!academicValid) {
      setExitAction("none");
      toast.error(
        isStudent
          ? "Please select your college, department, and level."
          : "Please select your college and department.",
      );
      return;
    }

    if (!isDirty) {
      setExitAction("none");
      return;
    }

    setBusy(true);

    try {
      const updateData = {
        full_name: form.full_name.trim(),
        bio: form.bio.trim(),
        phone_number: form.phone_number.trim(),
        college: form.college,
        department: form.department,
        level: isStudent ? form.level : "",
      };

      const { error } = await supabase.rpc(
        "update_my_profile",
        {
          _full_name: updateData.full_name,
          _bio: updateData.bio,
          _phone_number: updateData.phone_number,
          _college: updateData.college,
          _department: updateData.department,
          _level: updateData.level,
        },
      );

      if (error) {
        setExitAction("none");
        toast.error(error.message);
        return;
      }

      /*
       * Immediately update the saved snapshot.
       * This makes the Save button disabled again and
       * prevents completion from reacting to unsaved data.
       */
      setForm(updateData);
      setSavedForm(updateData);

      toast.success("Profile updated successfully.");

      try {
        await refresh();
      } catch {
        toast.warning(
          "Profile saved, but your profile display could not be refreshed. Reload the page to see the latest information.",
        );
      }

      setExitAction("none");

      /*
       * Only bypass the blocker when a navigation
       * is actually pending.
       */
      if (blocker.status === "blocked") {
        allowNavigationRef.current = true;
        blocker.proceed();
      }
    } catch (error) {
      setExitAction("none");

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    if (blocker.status === "blocked") {
      allowNavigationRef.current = true;
      blocker.proceed();
    }
  };

  const handleExitSave = () => {
    setExitAction("save");
    void save();
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    if (!allowedTypes.includes(file.type)) {
      toast.error(
        "Only JPEG, PNG, and WebP images are allowed.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        "Profile photo must be 5MB or smaller.",
      );
      return;
    }

    let uploadedPath: string | null = null;
    let profileUpdated = false;

    // Extract the previous avatar's Storage path.
    let oldPath: string | null = null;

    if (profile?.avatar_url) {
      try {
        const url = new URL(profile.avatar_url);

        const marker =
          "/storage/v1/object/public/avatars/";

        const index = url.pathname.indexOf(marker);

        if (index !== -1) {
          oldPath = decodeURIComponent(
            url.pathname.substring(index + marker.length),
          );
        }
      } catch {
        // Preserve the old image if its path cannot be identified.
      }
    }

    try {
      setBusy(true);

      const ext = extensions[file.type];

      const fileName =
        `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploadedPath = fileName;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const newAvatarUrl = data.publicUrl;

      // Save only the new avatar URL.
      const { error: updateError } = await supabase.rpc(
        "update_my_avatar",
        {
          _avatar_url: newAvatarUrl,
        },
      );

      if (updateError) {
        throw updateError;
      }

      profileUpdated = true;

      // Verify that the new URL was actually saved.
      const { data: savedProfile, error: verifyError } =
        await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .single();

      if (verifyError) {
        throw verifyError;
      }

      if (savedProfile.avatar_url !== newAvatarUrl) {
        throw new Error(
          "Profile photo could not be verified after saving.",
        );
      }

      // Refresh the authenticated profile.
      await refresh();

      // Delete the previous avatar only after verification
      // and profile refresh have succeeded.
      if (oldPath && oldPath !== uploadedPath) {
        const { error: deleteError } = await supabase.storage
          .from("avatars")
          .remove([oldPath]);

        if (deleteError) {
          toast.warning(
            "Profile photo updated, but the previous image could not be removed.",
          );
          return;
        }
      }

      toast.success("Profile photo updated.");
    } catch (error) {
      // Remove the new upload if the database update failed.
      // Never remove it if the database update already succeeded.
      if (uploadedPath && !profileUpdated) {
        await supabase.storage
          .from("avatars")
          .remove([uploadedPath]);
      }

      toast.error(
        profileUpdated
          ? "The profile photo may have been saved, but verification or refresh failed. Please reload your profile."
          : error instanceof Error
            ? error.message
            : "Unable to update profile photo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-8xl">
      <div className="mb-5 sm:mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          Profile
        </p>

        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
          Your account
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Manage your personal information,
          academic details, and account profile.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 min-[820px]:grid-cols-[minmax(0,1fr)_220px]">
        {/* Main profile card */}
        <div className="overflow-hidden rounded-sm border border-border bg-card shadow-soft">
          {/* Profile identity */}
          <div className="border-b border-border bg-muted/20 p-4 sm:p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
              {/* Mobile badges */}
              <div className="flex w-full items-center gap-1.5 sm:hidden">
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                  {roleLabel}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                  {contributor.emoji}
                  {contributor.name}
                </span>

                <div className="ml-auto">
                  <SubscriptionPlanBadge
                    plan={profile?.subscription_plan}
                  />
                </div>
              </div>

              {/* Profile picture */}
              <div className="relative w-fit shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.full_name || "Profile avatar"}
                    className="h-36 w-32 rounded-md border-2 border-primary/30 object-cover shadow-xl sm:h-48 sm:w-40"
                  />
                ) : (
                  <div className="flex h-36 w-32 items-center justify-center rounded-md border-2 border-primary/30 bg-muted text-3xl font-semibold shadow-lg sm:h-48 sm:w-40 sm:text-4xl">
                    {(profile?.full_name || "User")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:bottom-2 sm:right-2 sm:h-10 sm:w-10"
                  aria-label="Change profile photo"
                  title="Change profile photo"
                >
                  <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>

              {/* Profile details */}
              <div className="min-w-0 flex-1">
                {/* Desktop badges */}
                <div className="hidden flex-wrap items-center gap-1.5 sm:flex sm:gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
                    {roleLabel}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
                    {contributor.emoji}
                    {contributor.name}
                  </span>

                  <SubscriptionPlanBadge
                    plan={profile?.subscription_plan}
                  />
                </div>

                <h2 className="mt-3 break-words font-display text-xl font-semibold sm:mt-4 sm:text-3xl">
                  {profile?.full_name || "Unnamed User"}
                </h2>

                <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />

                  <span className="break-all">
                    {user?.email || "No email available"}
                  </span>
                </div>

                {profile?.bio ? (
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-relaxed">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-2 text-xs italic text-muted-foreground sm:mt-3 sm:text-sm">
                    No bio yet.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground sm:mt-5 sm:gap-x-5 sm:gap-y-2 sm:text-sm">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Joined{" "}
                    {profile?.created_at
                      ? formatDate(profile.created_at)
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Completion — intentionally before editable information */}
          <div className="border-b border-border p-2">
            <div className="rounded-sm border border-none bg-muted/20 p-3.5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                    Profile
                  </p>

                  <h3 className="mt-0.5 text-sm font-semibold sm:mt-1 sm:text-base">
                    Completion
                  </h3>
                </div>

                <span className="text-xl font-semibold sm:text-2xl">
                  {completion}%
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-muted sm:mt-4 sm:h-2">
                <div
                  className="h-full rounded-sm bg-gradient-emerald transition-all duration-500"
                  style={{
                    width: `${completion}%`,
                  }}
                />
              </div>

              <div className="mt-4 space-y-2 text-[10px] sm:mt-5 sm:space-y-2.5 sm:text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Profile photo
                  </span>

                  <span>
                    {profile?.avatar_url ? "✅" : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Full name
                  </span>

                  <span>
                    {savedForm.full_name.trim() ? "✅" : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Phone number
                  </span>

                  <span>
                    {phoneComplete ? "✅" : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Bio
                  </span>

                  <span>
                    {savedForm.bio.trim() ? "✅" : "⬜"}
                  </span>
                </div>

                {hasAcademicInformation && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      Academic information
                    </span>

                    <span>
                      {academicComplete ? "✅" : "⬜"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editable information */}
          <form
            onSubmit={save}
            className="space-y-6 p-3.5 sm:space-y-7 sm:p-8"
          >
            <div>
              <div className="mb-3 sm:mb-4">
                <h3 className="text-sm font-semibold sm:text-base">
                  Personal information
                </h3>

                <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                  Keep your account information
                  accurate and up to date.
                </p>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div>
                  <Label
                    htmlFor="email"
                    className="text-xs sm:text-sm"
                  >
                    Email address
                  </Label>

                  <Input
                    id="email"
                    value={user?.email ?? ""}
                    disabled
                    className="mt-1.5 h-9 bg-muted/50 text-xs sm:h-10 sm:text-sm"
                  />

                  <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                    Your email address is managed by your account
                    authentication.
                  </p>
                </div>

                <div>
                  <Label
                    htmlFor="full-name"
                    className="text-xs sm:text-sm"
                  >
                    Full name
                  </Label>

                  <Input
                    id="full-name"
                    value={form.full_name}
                    onChange={(e) =>
                      setField("full_name", e.target.value)
                    }
                    className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                    placeholder="Enter your full name"
                  />

                  {form.full_name && !fullNameValid && (
                    <p className="mt-1.5 text-[10px] text-destructive sm:text-xs">
                      Full name must be at least 3 letters and contain
                      only letters, spaces, apostrophes, or hyphens.
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="phone"
                    className="text-xs sm:text-sm"
                  >
                    Phone number
                  </Label>

                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    value={form.phone_number}
                    onChange={(e) => {
                      const value = e.target.value;

                      /*
                       * Allow only:
                       * digits
                       * spaces
                       * +
                       * parentheses
                       * periods
                       * hyphens
                       */
                      if (!/^[+]?[0-9\s().-]*$/.test(value)) {
                        return;
                      }

                      setField("phone_number", value);
                    }}
                    placeholder="+234 800 000 0000"
                    className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                  />

                  {form.phone_number && !phoneValid ? (
                    <p className="mt-1.5 text-[10px] text-destructive sm:text-xs">
                      Enter a valid phone number containing 13–15 digits.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                      Only you and authorized administrators can access
                      your phone number.
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="bio"
                    className="text-xs sm:text-sm"
                  >
                    Bio
                  </Label>

                  <Textarea
                    id="bio"
                    rows={4}
                    maxLength={500}
                    value={form.bio}
                    onChange={(e) =>
                      setField("bio", e.target.value)
                    }
                    className="mt-1.5 resize-none text-xs sm:text-sm"
                    placeholder="Tell Aneks Library community a little about yourself..."
                  />

                  <p className="mt-1.5 text-right text-[10px] text-muted-foreground sm:text-xs">
                    {form.bio.length}/500
                  </p>
                </div>
              </div>
            </div>

            {/* Academic information */}
            {hasAcademicInformation && (
              <div className="border-t border-border pt-6 sm:pt-7">
                <div className="mb-3 sm:mb-4">
                  <h3 className="text-sm font-semibold sm:text-base">
                    Academic information
                  </h3>

                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                    Select the information that matches your current
                    academic role.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  {/* College / Institution */}
                  <div
                    className={
                      isStudent
                        ? "sm:col-span-2"
                        : "sm:col-span-1"
                    }
                  >
                    <Label
                      htmlFor="college"
                      className="text-xs sm:text-sm"
                    >
                      {isResearcher ? "Institution" : "College"}
                    </Label>

                    {isResearcher ? (
                      <Input
                        id="college"
                        value={form.college}
                        disabled={collegeLocked}
                        onChange={(e) =>
                          setField("college", e.target.value)
                        }
                        placeholder="e.g. OpenAI"
                        className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                      />
                    ) : (
                      <Select
                        value={form.college}
                        disabled={collegeLocked}
                        onValueChange={(value) => {
                          if (!value) return;

                          setForm((current) => ({
                            ...current,
                            college: value,
                            department: "",
                          }));
                        }}
                      >
                        <SelectTrigger
                          id="college"
                          className="mt-1.5 h-9 w-full text-xs sm:h-10 sm:text-sm"
                        >
                          <SelectValue placeholder="Select College" />
                        </SelectTrigger>

                        <SelectContent>
                          {colleges.map((college) => (
                            <SelectItem
                              key={college.id}
                              value={college.id}
                            >
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
                    )}

                    {collegeLocked && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                        Your registered institution cannot be changed
                        here. Contact an administrator if a correction
                        is needed.
                      </p>
                    )}
                  </div>

                  {/* Department / Research Area */}
                  <div>
                    <Label
                      htmlFor="department"
                      className="text-xs sm:text-sm"
                    >
                      {isResearcher ? "Research Area" : "Department"}
                    </Label>

                    {isResearcher ? (
                      <Input
                        id="department"
                        value={form.department}
                        disabled={departmentLocked}
                        onChange={(e) =>
                          setField("department", e.target.value)
                        }
                        placeholder="e.g. Artificial Intelligence"
                        className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                      />
                    ) : (
                      <Select
                        value={form.department}
                        onValueChange={(value) => {
                          if (!value) return;

                          setField("department", value);
                        }}
                        disabled={
                          !form.college || departmentLocked
                        }
                      >
                        <SelectTrigger
                          id="department"
                          className="mt-1.5 h-9 w-full text-xs sm:h-10 sm:text-sm"
                        >
                          <SelectValue
                            placeholder={
                              form.college
                                ? "Select Department"
                                : "Select College first"
                            }
                          />
                        </SelectTrigger>

                        <SelectContent>
                          {!form.college ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground sm:text-sm">
                              Select College first
                            </div>
                          ) : departments.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground sm:text-sm">
                              No departments available
                            </div>
                          ) : (
                            departments.map((department) => (
                              <SelectItem
                                key={department}
                                value={department}
                              >
                                {department}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}

                    {departmentLocked && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                        Your registered department cannot be changed
                        here. Contact an administrator if a correction
                        is needed.
                      </p>
                    )}
                  </div>

                  {/* Level — Student only */}
                  {needsLevel && (
                    <div>
                      <Label
                        htmlFor="level"
                        className="text-xs sm:text-sm"
                      >
                        Level
                      </Label>

                      <Select
                        value={form.level}
                        onValueChange={(value) => {
                          if (!value) return;

                          setField("level", value);
                        }}
                      >
                        <SelectTrigger
                          id="level"
                          className="mt-1.5 h-9 w-full text-xs sm:h-10 sm:text-sm"
                        >
                          <SelectValue placeholder="Select Level" />
                        </SelectTrigger>

                        <SelectContent>
                          {levels.map((level) => (
                            <SelectItem
                              key={level}
                              value={level}
                            >
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save area */}
            <div className="flex flex-col gap-2.5 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-6">
              <div className="text-[10px] text-muted-foreground sm:text-xs">
                {isDirty ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    You have unsaved changes.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-500 sm:h-3.5 sm:w-3.5" />
                    All changes are saved.
                  </span>
                )}
              </div>

              <Button
                type="submit"
                variant="ghost"
                disabled={!canSave}
                className="h-9 w-full bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:w-auto sm:text-sm"
              >
                {busy && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                )}

                {busy ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Reputation */}
          <div className="rounded-sm border border-border bg-card p-3.5 shadow-soft sm:p-6">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Contribution
                </p>

                <h3 className="mt-0.5 text-xs font-semibold sm:mt-1 sm:text-base">
                  Reputation
                </h3>
              </div>

              <span className="text-base font-semibold sm:text-lg">
                {profile?.reputation ?? 0}

                <span className="ml-1 text-[10px] font-normal text-muted-foreground sm:text-xs">
                  pts
                </span>
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2.5 sm:mt-5 sm:gap-3">
              <div>
                <p className="text-sm font-medium text-gold sm:text-base">
                  {contributor.name}
                </p>

                <p className="text-[10px] text-muted-foreground sm:text-xs">
                  Contributor level
                </p>
              </div>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-sm bg-muted sm:mt-5 sm:h-2">
              <div
                className="h-full rounded-sm bg-gradient-emerald transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p className="mt-1.5 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
              {nextLevel
                ? `${nextLevel.pointsNeeded} pts until ${nextLevel.emoji} ${nextLevel.name}`
                : "Highest contributor level reached 👑"}
            </p>
          </div>

          {/* Account */}
          <div className="rounded-sm border border-border bg-card p-3.5 shadow-soft sm:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />

              <h3 className="text-xs font-semibold sm:text-base">
                Account
              </h3>
            </div>

            <div className="mt-4 divide-y divide-border sm:mt-5">
              <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 sm:py-3">
                <span className="text-xs text-muted-foreground sm:text-xs">
                  Status
                </span>

                <span className="text-xs font-medium capitalize sm:text-xs">
                  {profile?.status === "active"
                    ? "🟢 Active"
                    : profile?.status || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0 sm:py-3">
                <span className="text-xs text-muted-foreground sm:text-xs">
                  Member since
                </span>

                <span className="text-right text-xs font-medium sm:text-xs">
                  {profile?.created_at
                    ? formatDate(profile.created_at)
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <section className="rounded-sm border border-border bg-card p-3.5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold sm:text-xs">
                  Subscription
                </p>

                <p className="mt-1 text-xs text-muted-foreground sm:text-xs">
                  Current plan and subscription record.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:mt-5 sm:grid-cols-2 lg:grid-cols-1">
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Subscription status
                </div>

                <p className="mt-1.5 text-xs font-semibold sm:text-xs">
                  {formatLabel(profile?.subscription_status)}
                </p>
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Plan
                </div>

                <p
                  className={`mt-1.5 text-xs font-semibold sm:text-xs ${
                    isPremium
                      ? "text-gold"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {formatLabel(profile?.subscription_plan)}
                </p>
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Subscription started
                </div>

                <p className="mt-1.5 text-xs font-semibold sm:text-xs">
                  {profile?.subscription_started_at
                    ? formatDate(profile.subscription_started_at)
                    : "-"}
                </p>
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Subscription expires
                </div>

                <p className="mt-1.5 text-xs font-semibold sm:text-xs">
                  {profile?.subscription_expires_at
                    ? formatDate(profile.subscription_expires_at)
                    : "-"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Hidden avatar input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (file) {
            uploadAvatar(file);
          }

          e.target.value = "";
        }}
      />

      {/* Unsaved changes dialog */}
      {blocker.status === "blocked" && (
        <AlertDialog open>
          <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-sm sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">
                Save your changes?
              </AlertDialogTitle>

              <AlertDialogDescription className="text-xs leading-relaxed sm:text-sm">
                You have unsaved profile changes. Would you like to save
                them before leaving this page?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={blocker.reset}
                className="h-9 text-xs sm:h-10 sm:text-sm"
              >
                Continue editing
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDiscard}
                className="h-9 bg-destructive text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
              >
                Discard
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleExitSave}
                disabled={busy}
                className="h-9 bg-gradient-emerald text-xs text-white shadow-soft !transition-none hover:bg-none hover:bg-accent hover:text-foreground sm:h-10 sm:text-sm"
              >
                {busy && exitAction === "save" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                ) : null}

                Save changes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
