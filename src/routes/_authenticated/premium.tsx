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
    <div className="mx-auto max-w-8xl space-y-5 pb-8 sm:space-y-6">
      {/* Page Introduction */}

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          PLANS & PRICING
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Choose Your Plan
        </h1>

        <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
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
            <Feature text="Preview and read standard academic materials" />
            <Feature text="Bookmark resources" />
            <Feature text="Upload resources" />
            <Feature text="Basic and limited text-based AI Study Assistant" />

            <div className="my-4 border-t" />

            <UnavailableFeature text="Full previews of Premium materials" />
            <UnavailableFeature text="Monthly Download Credits" />
            <UnavailableFeature text="Marketplace Access" />
            <UnavailableFeature text="Ad-free experience" />
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

        <div className="relative flex flex-col rounded-sm border-2 border bg-card p-4 sm:p-6">
          <div className="absolute right-4 top-4 rounded-sm bg-gold px-2.5 py-1 text-[10px] font-semibold text-primary-foreground sm:text-xs">
            PREMIUM
          </div>

          <div className="pr-20 sm:pr-24">
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
            <Feature premium text="Full access to exclusive Premium materials" />
            <Feature premium text="10 Download Credits every billing month" />
            <Feature premium text="Option to purchase additional Download Credits" />
            <Feature premium text="Marketplace Access" />
            <Feature premium text="Ad-free experience" />
            <Feature premium text="Enhanced AI Study Assistant" />
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
              className="bg-gold mt-7 h-9 w-full text-xs sm:h-10 sm:text-sm"
            >
              Upgrade to Premium
            </Button>
          )}
        </div>
      </div>

      {/* Download Credits */}
      <section>
        <div className="mb-6 text-left">
          <p className="mt-12 text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            DOWNLOAD CREDITS
          </p>

          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
            Understanding Download Credits
          </h2>

          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Download Credits provide a flexible way to access eligible academic
            resources on Aneks Library. Premium members receive monthly credits
            and can purchase additional credits whenever they need them.
          </p>
        </div>

        <div className="rounded-sm border bg-card p-4 sm:p-6">
          {/* Download Credits */}
           <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                Download Credits
              </h3>
            </div>

            <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm">
              Premium includes 10 Download Credits per billing month.
              Use these credits to download eligible academic resources.
              Monthly credits are automatically used before any purchased
              credits.
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-6">
              <div className="border-b pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
                <h4 className="text-sm font-semibold">
                  Monthly Credits
                </h4>

                <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm">
                  Your 10 monthly credits reset with each billing period.
                  Any unused monthly credits expire when the billing period
                  resets and do not carry over.
                </p>
              </div>

              <div className="sm:pl-0">
                <h4 className="text-sm font-semibold">
                  Purchased Credits
                </h4>

                <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm">
                  Premium members can purchase additional Download Credits
                  whenever they need more. Purchased credits are maintained
                  separately and are not affected by the monthly credit reset.
                </p>
              </div>
          </div>
        </div>
      </section>

      {/* AI Study Assistant */}
<section>
  <div className="mb-6 text-left">
    <p className="mt-12 text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
      AI STUDY ASSISTANT
    </p>

    <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
      Understanding AI Study Assistant
    </h2>

    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
      Enhance your learning experience with AI-powered academic assistance.
      Get explanations, explore academic topics, and clarify difficult
      concepts through text-based interactions, with advanced AI capabilities
      available to Premium members.
    </p>
  </div>

  <div className="rounded-sm border bg-card p-4 sm:p-6">
    <div>
      <h3 className="text-lg font-semibold">
        AI Study Assistant
      </h3>

      <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm">
        Access intelligent academic assistance for your studies.
        Free members can interact with the AI using text-based questions,
        while Premium members enjoy enhanced capabilities, including
        academic document uploads and analysis, image-based questions,
        voice interactions, and a higher AI usage allowance.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="border-b pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
          <h4 className="text-sm font-semibold">
            Text-Based Study Assistance
          </h4>

          <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm">
            Ask questions, get explanations, clarify difficult concepts,
            explore academic topics, and receive step-by-step assistance
            with your studies through text-based interactions.
          </p>
        </div>

        <div className="sm:pl-0">
          <h4 className="text-sm font-semibold">
            Enhanced AI Study Assistant
          </h4>

          <p className="mt-2 text-xs leading-6 text-muted-foreground sm:text-sm">
            Upload academic documents and images for analysis, ask
            questions about their contents, and interact with the AI
            through voice. Premium also provides a higher AI usage
            allowance for more extensive academic assistance.
          </p>
        </div>
      </div>
    </div>

    <p className="mt-5 border-t border-border/60 pt-4 text-xs leading-6 text-muted-foreground sm:text-sm">
      Basic text-based AI assistance is available to Free members,
      while Premium unlocks enhanced document, image, and voice
      interactions with a higher AI usage allowance.
    </p>
  </div>
</section>

    {/* Marketplace */}
     <section>
        <div className="mb-6 text-left">
          <p className="mt-12 text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            MARKETPLACE
          </p>

          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
            Marketplace Purchases
          </h2>

          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Explore exclusive academic resources available to Premium members.
            Purchase individual materials with direct monetary payments, separately
            from your subscription and Download Credits.
          </p>
        </div>

        <div className="rounded-sm border bg-card p-4">
          <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
            The Marketplace gives Premium members access to individually
            purchasable academic resources. Each resource has its own price and
            must be purchased separately through direct monetary payment before
            access is granted. Marketplace purchases are independent of your
            Premium subscription, and neither your subscription fee nor your
            Download Credits can be used to pay for them. Download Credits remain
            exclusively for downloading eligible resources outside the Marketplace.
          </p>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section>
        <div className="mb-10 text-left md:mb-8 lg:mb-10">
          <p className="mt-12 text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            FAQ
          </p>

          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:mt-3 md:text-[1.7rem] lg:mt-3 lg:text-4xl">
            Frequently Asked Questions
          </h2>

          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Find answers to common questions about subscription plans,
            Premium benefits, Download Credits, Marketplace purchases,
            and the AI Study Assistant.
          </p>
        </div>

        <Accordion
          type="single"
          collapsible
          className="rounded-sm border border-border/60 bg-card px-4 shadow-soft md:rounded-sm md:px-4 lg:rounded-sm lg:px-4"
        >
          <AccordionItem value="item-0" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              How many Download Credits do Premium members receive?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              Premium members receive 10 Download Credits every billing month.
              Additional credits can also be purchased.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-1" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              Do unused monthly credits carry over?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              No. Monthly credits expire when the billing period resets.
              Purchased credits are maintained separately.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              Which credits are used first?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              Monthly Download Credits are consumed before purchased Download
              Credits.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              Can I use Download Credits to buy Marketplace resources?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              No. Marketplace resources require separate money purchases and
              cannot be purchased with Download Credits.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              What happens when my Premium subscription expires?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              Your account returns to the Free Plan. Premium-only benefits and
              access to exclusive Premium materials are no longer available.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              Does Premium include unlimited downloads?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              No. Premium includes 10 monthly Download Credits. Additional
              Download Credits can be purchased separately.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6" className="border-border/60">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              What can I access with the Free Plan?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              Free members can browse, bookmark, preview, and read standard resources, upload resources, and use the basic text-based AI
              Study Assistant.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-7" className="border-border/60 last:border-b-0">
            <AccordionTrigger className="text-left text-muted-foreground text-sm">
              What is the AI Study Assistant?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-primary">
              The AI Study Assistant provides academic assistance through
              text-based questions, explanations, and concept clarification.
              Free members have access to basic text-based interactions.
              Premium members additionally get academic document uploads,
              document analysis, image-based questions, voice interactions,
              and a higher AI usage allowance.
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
        <p className="text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-6">
          {answer}
        </p>
      </div>
    </details>
  );
}