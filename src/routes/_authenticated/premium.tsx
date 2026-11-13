import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Crown,
  CheckCircle2,
  XCircle,
  Download,
  ShieldCheck,
  ShoppingBag,
  RefreshCw,
  Sparkles,
  ChevronDown,
} from "lucide-react";

import { useAccess } from "@/hooks/useAccess";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({
    meta: [
      { title: "Premium | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { loading, isAdmin, isPremium } = useAccess();

  if (loading) {
    return (
      <div className="p-4 text-sm sm:p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8 sm:space-y-6">
      {/* Page Introduction */}

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          PLANS & PRICING
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Choose Your Plan
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Explore the Free and Premium plans and find the right fit for your academic needs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
        {/* Free Plan */}

        <div className="flex flex-col rounded-sm border bg-card p-4 sm:p-6">
          <div>
            <h3 className="text-lg font-semibold sm:text-xl">
              Free Plan
            </h3>

            <p className="mt-2 text-3xl font-bold sm:text-4xl">
              ₦0
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                /forever
              </span>
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Essential academic resources for everyone.
            </p>
          </div>

          <div className="my-5 border-t" />

          <div className="flex-1 space-y-3">
            <Feature text="Browse academic resources" />
            <Feature text="Preview available resources" />
            <Feature text="Read resource previews" />
            <Feature text="Bookmark resources" />
            <Feature text="Upload resources" />
            <Feature text="Purchase Marketplace resources separately" />

            <div className="my-4 border-t" />

            <UnavailableFeature text="Monthly Download Credits" />
            <UnavailableFeature text="Exclusive Premium materials" />
            <UnavailableFeature text="Ad-free experience" />
            <UnavailableFeature text="AI Study Assistant" />
          </div>

          <Button
            disabled
            variant="outline"
            className="mt-7 h-9 w-full bg-muted text-xs sm:h-10 sm:text-sm"
          >
            {isPremium
              ? "Previously on Free"
              : isAdmin
                ? "Administrator"
                : "Current Plan"}
          </Button>
        </div>

        {/* Premium Plan */}

        <div className="relative flex flex-col rounded-sm border-2 border-primary bg-primary/[0.035] p-4 sm:p-6">
          <div className="absolute right-4 top-4 rounded-sm bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground sm:text-xs">
            PREMIUM
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />

              <h3 className="text-lg font-semibold sm:text-xl">
                Premium
              </h3>
            </div>

            <p className="mt-2 text-3xl font-bold sm:text-4xl">
              ₦3,000
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                /month
              </span>
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              A more complete academic experience.
            </p>
          </div>

          <div className="my-5 border-t border-primary/20" />

          <div className="flex-1 space-y-3">
            <Feature premium text="Everything in the Free Plan" />
            <Feature premium text="10 Download Credits every billing month" />
            <Feature premium text="Access to exclusive Premium materials" />
            <Feature premium text="Ad-free experience" />
            <Feature premium text="Option to purchase additional Download Credits" />

            <div className="my-4 border-t border-gold/20" />

            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-gold sm:h-5 sm:w-5" />

              <span className="text-xs sm:text-sm">
                AI Study Assistant
                <span className="ml-2 rounded-sm bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold sm:text-xs">
                  Coming Soon
                </span>
              </span>
            </div>
          </div>

          {isAdmin ? (
            <Button
              disabled
              className="mt-7 h-9 w-full text-xs sm:h-10 sm:text-sm"
            >
              Administrator
            </Button>
          ) : isPremium ? (
            <Button
              disabled
              className="mt-7 h-9 w-full text-xs sm:h-10 sm:text-sm"
            >
              Current Plan
            </Button>
          ) : (
            <Button
              disabled
              className="mt-7 h-9 w-full text-xs sm:h-10 sm:text-sm"
            >
              Upgrade to Premium
            </Button>
          )}
        </div>
      </div>

{/* Download Credits */}
<section>
  <div className="mb-6 text-left">
    <p className="mt-12 text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
      PREMIUM BENEFITS
    </p>

    <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
      Understanding Download Credits
    </h2>

    <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
      Premium includes 10 Download Credits per billing month.
      Credits are used when downloading eligible resources.
      Monthly credits are consumed before purchased credits.
    </p>
  </div>

  <div className="rounded-sm border bg-card p-4 sm:p-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-sm border p-4">
        <h3 className="text-sm font-semibold">
          Monthly Credits
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
          Your 10 monthly credits reset with each billing period.
          Unused monthly credits expire at the reset.
        </p>
      </div>

      <div className="rounded-sm border p-4">
        <h3 className="text-sm font-semibold">
          Purchased Credits
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
          Premium members can purchase additional Download Credits.
          Purchased credits are kept separately from monthly credits.
        </p>
      </div>
    </div>
  </div>
</section>

{/* Marketplace */}
      <section className="rounded-sm border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">
              Marketplace Purchases
            </h2>

            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              Marketplace resources are purchased directly with money.
              Download Credits cannot be used to purchase Marketplace
              resources. Premium membership does not replace individual
              Marketplace purchases.
            </p>
          </div>
        </div>
      </section>

{/* Frequently Asked Questions */}
<section>
  <div className="mb-10 text-left md:mb-8 lg:mb-10">
    <p className="mt-12 text-sm uppercase tracking-[0.2em] text-gold md:text-[11px] lg:text-sm">
      FAQ
    </p>

    <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
      Frequently Asked Questions
    </h2>
    <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
      Find answers to common questions about subscription plans,
      Premium benefits, Download Credits, and Marketplace purchases.
    </p>
  </div>

  <Accordion
    type="single"
    collapsible
    className="rounded-sm border border-border/60 bg-card px-4 shadow-soft md:rounded-sm md:px-4 lg:rounded-sm lg:px-4"
  >
    <AccordionItem value="item-0" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        How many Download Credits do Premium members receive?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        Premium members receive 10 Download Credits every billing month.
        Additional credits can also be purchased.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-1" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        Do unused monthly credits carry over?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        No. Monthly credits expire when the billing period resets.
        Purchased credits are maintained separately.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-2" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        Which credits are used first?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        Monthly Download Credits are consumed before purchased Download
        Credits.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-3" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        Can I use Download Credits to buy Marketplace resources?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        No. Marketplace resources require separate money purchases and
        cannot be purchased with Download Credits.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-4" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        What happens when my Premium subscription expires?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        Your account returns to the Free Plan. Premium-only benefits and
        access to exclusive Premium materials are no longer available.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-5" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        Does Premium include unlimited downloads?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        No. Premium includes 10 monthly Download Credits. Additional
        Download Credits can be purchased separately.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-6" className="border-border/60">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        What can I access with the Free Plan?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        Free members can browse, preview, read and bookmark available
        resources, and upload resources.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="item-7" className="border-border/60 last:border-b-0">
      <AccordionTrigger className="text-left font-display text-base md:text-sm lg:text-base">
        What is the AI Study Assistant?
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground">
        The AI Study Assistant is a planned Premium feature designed to
        help members ask questions about academic documents and images,
        including through voice interactions. It is coming soon and is
        not yet available.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</section>
    </div>
  );
}

function Feature({
  text,
  premium = false,
}: {
  text: string;
  premium?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2
        className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${
          premium ? "text-gold" : "text-green-600"
        }`}
      />

      <span className="text-xs sm:text-sm">
        {text}
      </span>
    </div>
  );
}

function UnavailableFeature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />

      <span className="text-xs text-muted-foreground sm:text-sm">
        {text}
      </span>
    </div>
  );
}

function FAQ({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group rounded-sm border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-medium sm:text-sm">
          {question}
        </span>

        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-t px-4 py-3">
        <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
          {answer}
        </p>
      </div>
    </details>
  );
}