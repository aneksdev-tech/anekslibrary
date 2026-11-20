import { createClient } from "jsr:@supabase/supabase-js@2";
import { render } from "jsr:@nick/resvg@0.1.0-rc.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const LOGO_URL =
  "https://anekslibrary.vercel.app/aneks-library-logo.png";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(
  value: string,
  maxCharacters: number,
  maxLines: number,
) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const originalWord of words) {
    // Break unusually long words so they cannot overflow the cover.
    const wordParts: string[] = [];

    if (originalWord.length > maxCharacters) {
      for (
        let i = 0;
        i < originalWord.length;
        i += maxCharacters
      ) {
        wordParts.push(
          originalWord.slice(i, i + maxCharacters),
        );
      }
    } else {
      wordParts.push(originalWord);
    }

    for (const word of wordParts) {
      const candidate = currentLine
        ? `${currentLine} ${word}`
        : word;

      if (candidate.length > maxCharacters && currentLine) {
        lines.push(currentLine);
        currentLine = word;

        if (lines.length === maxLines) {
          break;
        }
      } else {
        currentLine = candidate;
      }
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const displayedText = lines.join(" ").replace(/…$/, "");
  const originalText = words.join(" ");

  if (
    displayedText.length < originalText.length &&
    lines.length
  ) {
    lines[lines.length - 1] =
      `${lines[lines.length - 1].replace(/[.,;:]$/, "")}…`;
  }

  return lines;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + 8192),
    );
  }

  return btoa(binary);
}

async function getLogoDataUri() {
  const response = await fetch(LOGO_URL);

  if (!response.ok) {
    throw new Error(
      `Unable to retrieve Aneks Library logo: HTTP ${response.status}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/png")) {
    throw new Error("The Aneks Library logo must be a PNG image.");
  }

  const logoBytes = new Uint8Array(await response.arrayBuffer());

  return `data:image/png;base64,${bytesToBase64(logoBytes)}`;
}

function createShareSvg(
  title: string,
  description: string,
  category: string,
  logoDataUri: string,
) {
  const titleLines = wrapText(title, 21, 6);
  const descriptionLines = description.trim()
    ? wrapText(description, 60, 4)
    : [];

  const categoryText = xmlEscape(
    category.length > 42
      ? `${category.slice(0, 39)}...`
      : category,
  );

  const titleFontSize = 66;
  const titleLineHeight = 105;
  const titleStartY = 750;

  const titleMarkup = titleLines
    .map(
      (line, index) => `
        <text
          x="100"
          y="${titleStartY + index * titleLineHeight}"
          fill="#103D2A"
          font-family="Inter, sans-serif"
          font-size="${titleFontSize}"
          font-weight="700"
        >${xmlEscape(line)}</text>
      `,
    )
    .join("");

  // Position the description after the final title line.
  const titleBottomY =
    titleStartY +
    Math.max(titleLines.length - 1, 0) * titleLineHeight;

  const descriptionStartY = titleBottomY + 95;
  const descriptionLineHeight = 46;

  const descriptionMarkup = descriptionLines
    .map(
      (line, index) => `
        <text
          x="100"
          y="${descriptionStartY + index * descriptionLineHeight}"
          fill="#557365"
          font-family="Inter, sans-serif"
          font-size="30"
          font-weight="400"
        >${xmlEscape(line)}</text>
      `,
    )
    .join("");

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1200"
      height="1800"
      viewBox="0 0 1200 1800"
    >
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#D5AD52" />
          <stop offset="100%" stop-color="#F2D58A" />
        </linearGradient>

        <linearGradient id="greenAccent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7CF03D" stop-opacity=".10" />
          <stop offset="100%" stop-color="#103D2A" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Clean ivory book-cover background -->
      <rect
        width="1200"
        height="1800"
        fill="#FAFAF7"
      />

      <!-- Subtle decorative shapes -->
      <circle
        cx="1100"
        cy="100"
        r="420"
        fill="url(#greenAccent)"
      />

      <circle
        cx="70"
        cy="1510"
        r="380"
        fill="#D5AD52"
        opacity=".035"
      />

      <path
        d="M900 0 L1200 0 L1200 1800 L1080 1800 Z"
        fill="#103D2A"
        opacity=".018"
      />

      <!-- Fine cover border -->
      <rect
        x="52"
        y="52"
        width="1096"
        height="1696"
        rx="12"
        fill="none"
        stroke="#D5AD52"
        stroke-opacity=".38"
        stroke-width="2"
      />

      <!-- Aneks Library logo symbol -->
      <image
        href="${logoDataUri}"
        x="100"
        y="115"
        width="150"
        height="150"
        preserveAspectRatio="xMidYMid meet"
      />

      <!-- Brand wordmark: neks in gold, Library in emerald -->
      <text
        x="225"
        y="205"
        font-family="Inter, sans-serif"
        font-size="46"
        font-weight="700"
      ><tspan fill="#D5AD52">neks</tspan><tspan fill="#103D2A"> Library</tspan></text>

      <line
        x1="100"
        y1="350"
        x2="1100"
        y2="350"
        stroke="#103D2A"
        stroke-opacity=".16"
        stroke-width="2"
      />

      <!-- Resource category -->
      <text
        x="100"
        y="510"
        fill="#B58A32"
        font-family="Inter, sans-serif"
        font-size="27"
        font-weight="700"
        letter-spacing="4"
      >${categoryText.toUpperCase()}</text>

      <rect
        x="100"
        y="555"
        width="110"
        height="7"
        rx="3.5"
        fill="url(#gold)"
      />

      <!-- Resource title -->
      ${titleMarkup}

      <!-- Resource description -->
      ${descriptionMarkup}

      <!-- Footer -->
      <line
        x1="100"
        y1="1510"
        x2="1100"
        y2="1510"
        stroke="#103D2A"
        stroke-opacity=".16"
        stroke-width="2"
      />

      <text
        x="100"
        y="1600"
        fill="#103D2A"
        font-family="Inter, sans-serif"
        font-size="28"
        font-weight="600"
      >Embrace Knowledge and Empower Minds</text>

      <text
        x="1100"
        y="1690"
        text-anchor="end"
        fill="#557365"
        font-family="Inter, sans-serif"
        font-size="20"
      >anekslibrary.vercel.app</text>

      <rect
        x="100"
        y="1735"
        width="1000"
        height="5"
        rx="2.5"
        fill="url(#gold)"
        opacity=".8"
      />
    </svg>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return Response.json(
      { error: "Method not allowed." },
      {
        status: 405,
        headers: corsHeaders,
      },
    );
  }

  try {
    const url = new URL(req.url);
    const resourceId = url.searchParams.get("resourceId")?.trim();

    if (
      !resourceId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        resourceId,
      )
    ) {
      return Response.json(
        { error: "Invalid resource ID." },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase environment variables are missing.");

      return Response.json(
        { error: "Image service is not configured." },
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await supabase.rpc(
      "get_public_resource_share_metadata",
      {
        p_resource_id: resourceId,
      },
    );

    if (error) {
      console.error(
        "Unable to retrieve resource share metadata:",
        error.message,
      );

      return Response.json(
        { error: "Unable to generate resource image." },
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const resource = data?.[0];

    if (!resource) {
      return Response.json(
        { error: "Resource not found." },
        {
          status: 404,
          headers: corsHeaders,
        },
      );
    }

    const logoDataUri = await getLogoDataUri();

    const svg = createShareSvg(
      resource.title || "Academic Resource",
      resource.description || "",
      resource.category_name || "Academic Resource",
      logoDataUri,
    );

    const png = render(svg);

    return new Response(png, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Resource share image generation failed:",
      error instanceof Error ? error.message : error,
    );

    return Response.json(
      { error: "Unable to generate resource image." },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});