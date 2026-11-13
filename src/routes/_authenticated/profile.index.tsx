import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

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

function ProfilePage() {
  const { profile, user, refresh } = useAuth();

  useEffect(() => {
    return () => {};
  }, []);

  const isResearcher = profile?.primary_role === "researcher";
  const isLecturer = profile?.primary_role === "lecturer";
  const isStudent = profile?.primary_role === "student";
  const isStaff = profile?.primary_role === "staff";

  const hasAcademicInformation =
    isStudent ||
    isLecturer ||
    isStaff ||
    isResearcher;

  const needsLevel = isStudent;

  const roleLabel =
    profile?.primary_role
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

  const planLabel =
    profile?.subscription_plan === "premium"
      ? "⭐ Premium"
      : "🟢 Free";

  const avatarUrl = profile?.avatar_url || null;

  const fileInputRef =
    useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!profile) return;

    const initialForm = {
      full_name: profile.full_name ?? "",
      bio: profile.bio ?? "",
      phone_number: profile.phone_number ?? "",
      college: profile.college ?? "",
      department: profile.department ?? "",
      level: profile.level ?? "",
    };

    setForm(initialForm);
    setSavedForm(initialForm);
  }, [profile]);

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
   * Full name validation
   */
  const fullNameValid =
    /^[A-Za-z\s'-]{3,}$/.test(
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
  const phoneDigits = form.phone_number.replace(
    /\D/g,
    "",
  );

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
  const savedPhoneDigits =
    savedForm.phone_number.replace(/\D/g, "");

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

  /*
   * Save button validation.
   *
   * Phone is optional, but if supplied it must contain
   * exactly 13–15 digits.
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

  const save = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    if (!user) {
      toast.error(
        "Unable to identify your account.",
      );
      return;
    }

    if (!fullNameValid) {
      toast.error(
        "Full name must be at least 3 letters and contain only letters, spaces, apostrophes, or hyphens.",
      );
      return;
    }

    if (!phoneValid) {
      toast.error(
        "Phone number must contain 13–15 digits.",
      );
      return;
    }

    if (!academicValid) {
      toast.error(
        isStudent
          ? "Please select your college, department, and level."
          : "Please select your college and department.",
      );
      return;
    }

    if (!isDirty) {
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

      const { error } =
        await supabase.rpc(
          "update_my_profile",
          {
            _full_name: updateData.full_name,
            _bio: updateData.bio,
            _phone_number:
              updateData.phone_number,
            _college: updateData.college,
            _department:
              updateData.department,
            _level: updateData.level,
          },
        );

      if (error) {
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

      toast.success(
        "Profile updated successfully.",
      );

      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (
    file: File,
  ) => {
    if (!user) return;

    /*
     * Basic image validation.
     */
    if (!file.type.startsWith("image/")) {
      toast.error(
        "Please select a valid image file.",
      );
      return;
    }

    /*
     * Prevent unnecessarily large uploads.
     */
    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        "Profile photo must be 5MB or smaller.",
      );
      return;
    }

    try {
      setBusy(true);

      /*
       * Delete previous avatar if it exists.
       */
      if (profile?.avatar_url) {
        try {
          const url = new URL(
            profile.avatar_url,
          );

          const marker =
            "/storage/v1/object/public/avatars/";

          const index =
            url.pathname.indexOf(marker);

          if (index !== -1) {
            const oldPath =
              decodeURIComponent(
                url.pathname.substring(
                  index + marker.length,
                ),
              );

            await supabase.storage
              .from("avatars")
              .remove([oldPath]);
          }
        } catch {
          /*
           * Ignore URL parsing/deletion errors.
           * The new avatar can still be uploaded.
           */
        }
      }

      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "png";

      const fileName =
        `${user.id}/avatar.${ext}`;

      const { error: uploadError } =
        await supabase.storage
          .from("avatars")
          .upload(
            fileName,
            file,
            {
              upsert: true,
              contentType: file.type,
            },
          );

      if (uploadError) {
        throw uploadError;
      }

      const { data } =
        supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

      /*
       * Update only the avatar URL through the
       * SECURITY DEFINER profile-update function.
       *
       * The current saved profile values are supplied
       * unchanged so uploading an avatar does not
       * modify unsaved form values.
       */
      const { error: updateError } =
        await supabase.rpc(
          "update_my_profile",
          {
            _full_name:
              profile?.full_name ?? "",
            _bio:
              profile?.bio ?? "",
            _phone_number:
              profile?.phone_number ?? "",
            _college:
              profile?.college ?? "",
            _department:
              profile?.department ?? "",
            _level:
              profile?.level ?? "",
            _avatar_url:
              data.publicUrl,
          },
        );

      if (updateError) {
        throw updateError;
      }

      toast.success(
        "Profile photo updated.",
      );

      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
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

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main profile card */}
        <div className="overflow-hidden rounded-sm border border-border bg-card shadow-soft">
          {/* Profile identity */}
          <div className="border-b border-border bg-muted/20 p-3.5 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:gap-6">
              <div className="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-start sm:gap-6">
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={
                        profile?.full_name ||
                        "Profile avatar"
                      }
                      className="h-32 w-24 rounded-sm border-2 border-primary/30 object-cover shadow-xl sm:h-40 sm:w-32"
                    />
                  ) : (
                    <div className="flex h-32 w-24 items-center justify-center rounded-sm border-2 border-primary/30 bg-muted text-4xl font-bold shadow-lg sm:h-40 sm:w-32 sm:text-5xl">
                      {(
                        profile?.full_name ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-card text-foreground shadow-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:bottom-2 sm:right-2 sm:h-10 sm:w-10"
                    aria-label="Change profile photo"
                    title="Change profile photo"
                  >
                    <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center justify-start gap-1.5 sm:gap-2">
                    <span className="shrink-0 rounded-sm border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-[10px] font-medium !text-gold sm:px-3 sm:py-1 sm:text-xs">
                      {roleLabel}
                    </span>

                   <span className="shrink-0 rounded-sm border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-[10px] font-medium !text-gold sm:px-3 sm:py-1 sm:text-xs">
                     {contributor.emoji}{" "}
                     {contributor.name}
                    </span>
                  </div>

                  <h2 className="mt-2.5 truncate font-display text-xl font-semibold sm:mt-3 sm:text-2xl">
                    {profile?.full_name ||
                      "Unnamed User"}
                  </h2>

                  <div className="mt-1.5 flex items-center justify-start gap-1.5 text-xs text-muted-foreground sm:mt-2 sm:gap-2 sm:text-sm">
                    <Mail className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />

                    <span className="truncate">
                      {user?.email ||
                        "No email available"}
                    </span>
                  </div>

                  {profile?.bio ? (
                    <p className="mt-3 max-w-xl text-xs leading-5 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-6">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs italic text-muted-foreground sm:mt-4 sm:text-sm">
                      No bio yet.
                    </p>
                  )}
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
                    {profile?.avatar_url
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Full name
                  </span>

                  <span>
                    {savedForm.full_name.trim()
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Phone number
                  </span>

                  <span>
                    {phoneComplete
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Bio
                  </span>

                  <span>
                    {savedForm.bio.trim()
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                {hasAcademicInformation && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      Academic information
                    </span>

                    <span>
                      {academicComplete
                        ? "✅"
                        : "⬜"}
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
                    value={
                      user?.email ?? ""
                    }
                    disabled
                    className="mt-1.5 h-9 bg-muted/50 text-xs sm:h-10 sm:text-sm"
                  />

                  <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                    Your email address is
                    managed by your account
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
                      setField(
                        "full_name",
                        e.target.value,
                      )
                    }
                    className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                    placeholder="Enter your full name"
                  />

                  {form.full_name &&
                    !fullNameValid && (
                      <p className="mt-1.5 text-[10px] text-destructive sm:text-xs">
                        Full name must be at least
                        3 letters and contain only
                        letters, spaces, apostrophes,
                        or hyphens.
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
                    value={
                      form.phone_number
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value;

                      /*
                       * Allow only:
                       * digits
                       * spaces
                       * +
                       * parentheses
                       * periods
                       * hyphens
                       */
                      if (
                        !/^[+]?[0-9\s().-]*$/.test(
                          value,
                        )
                      ) {
                        return;
                      }

                      setField(
                        "phone_number",
                        value,
                      );
                    }}
                    placeholder="+234 800 000 0000"
                    className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                  />

                  {form.phone_number &&
                  !phoneValid ? (
                    <p className="mt-1.5 text-[10px] text-destructive sm:text-xs">
                      Enter a valid phone number
                      containing 13–15 digits.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-xs">
                      Only you and authorized administrators can access your phone number.
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
                      setField(
                        "bio",
                        e.target.value,
                      )
                    }
                    className="mt-1.5 resize-none text-xs sm:text-sm"
                    placeholder="Tell the Aneks Library community a little about yourself..."
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
                    Select the information that
                    matches your current academic
                    role.
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
                      {isResearcher
                        ? "Institution"
                        : "College"}
                    </Label>

                    {isResearcher ? (
                      <Input
                        id="college"
                        value={form.college}
                        onChange={(e) =>
                          setField(
                            "college",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. OpenAI"
                        className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                      />
                    ) : (
                      <Select
                        value={
                          form.college
                        }
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
                    )}
                  </div>

                  {/* Department / Research Area */}
                  <div>
                    <Label
                      htmlFor="department"
                      className="text-xs sm:text-sm"
                    >
                      {isResearcher
                        ? "Research Area"
                        : "Department"}
                    </Label>

                    {isResearcher ? (
                      <Input
                        id="department"
                        value={
                          form.department
                        }
                        onChange={(e) =>
                          setField(
                            "department",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Artificial Intelligence"
                        className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
                      />
                    ) : (
                      <Select
                        value={
                          form.department
                        }
                        onValueChange={(value) => {
                          if (!value) return;

                          setField("department", value);
                        }}
                        disabled={
                          !form.college
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
                              Select College
                              first
                            </div>
                          ) : departments.length ===
                            0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground sm:text-sm">
                              No departments
                              available
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
                disabled={!canSave}
                className="h-9 w-full bg-gradient-emerald text-xs text-primary-foreground shadow-soft sm:h-10 sm:w-auto sm:text-sm"
              >
                {busy && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                )}

                {busy
                  ? "Saving..."
                  : "Save changes"}
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

                <h3 className="mt-0.5 text-sm font-semibold sm:mt-1 sm:text-base">
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
                <p className="text-sm font-medium sm:text-base text-gold">
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

              <h3 className="text-sm font-semibold sm:text-base">
                Account
              </h3>
            </div>

            <div className="mt-4 divide-y divide-border sm:mt-5">
              <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 sm:py-3">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Plan
                </span>

                <span className="text-xs font-medium sm:text-sm">
                  {planLabel}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-2.5 sm:py-3">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Status
                </span>

                <span className="text-xs font-medium capitalize sm:text-sm">
                  {profile?.status ===
                  "active"
                    ? "🟢 Active"
                    : profile?.status ||
                      "-"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0 sm:py-3">
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Member since
                </span>

                <span className="text-right text-xs font-medium sm:text-sm">
                  {profile?.created_at
                    ? new Date(
                        profile.created_at,
                      ).toLocaleDateString(
                        undefined,
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden avatar input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file =
            e.target.files?.[0];

          if (file) {
            uploadAvatar(file);
          }

          e.target.value = "";
        }}
      />
    </div>
  );
}