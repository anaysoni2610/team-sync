import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function parseICal(icalText: string): { title: string; description: string | null; deadline: string | null }[] {
  const events: { title: string; description: string | null; deadline: string | null }[] = [];
  const lines = icalText.split(/\r?\n/);

  let currentTitle = "";
  let currentDescription: string | null = null;
  let currentStart: string | null = null;
  let inEvent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentTitle = "";
      currentDescription = null;
      currentStart = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && currentTitle) {
        events.push({
          title: currentTitle,
          description: currentDescription,
          deadline: currentStart,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith("SUMMARY:")) {
      currentTitle = line.substring("SUMMARY:".length).replace(/\\n/g, " ").trim();
    } else if (line.startsWith("DESCRIPTION:")) {
      currentDescription = line.substring("DESCRIPTION:".length).replace(/\\n/g, "\n").trim() || null;
    } else if (line.startsWith("DTSTART")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const dateStr = line.substring(colonIdx + 1).trim();
        currentStart = parseICalDate(dateStr);
      }
    } else if (line.startsWith("DTEND")) {
      // Also capture DTEND as fallback for deadline
      if (!currentStart) {
        const colonIdx = line.indexOf(":");
        if (colonIdx !== -1) {
          const dateStr = line.substring(colonIdx + 1).trim();
          currentStart = parseICalDate(dateStr);
        }
      }
    }
  }

  return events;
}

function parseICalDate(dateStr: string): string | null {
  // Format: 20260115T093000Z or 20260115T093000 or with TZID
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/);
  if (!match) return null;
  const [, year, month, day, hour, min, sec, utc] = match;
  const seconds = sec || "00";
  const isoStr = `${year}-${month}-${day}T${hour}:${min}:${seconds}${utc === "Z" ? "Z" : ""}`;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { feed_url, feed_name } = body;

    if (!feed_url) {
      return new Response(JSON.stringify({ error: "Missing feed_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the iCal feed
    const feedResponse = await fetch(feed_url, {
      headers: { "User-Agent": "TeamSync/1.0 Calendar Importer" },
    });

    if (!feedResponse.ok) {
      return new Response(JSON.stringify({
        error: `Failed to fetch calendar feed (${feedResponse.status}). Please check the URL is valid and publicly accessible.`,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const icalText = await feedResponse.text();
    if (!icalText.includes("BEGIN:VCALENDAR")) {
      return new Response(JSON.stringify({
        error: "The URL did not return a valid iCal/ICS calendar feed. Make sure you copied the correct subscription URL from Outlook/Teams.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedEvents = parseICal(icalText);
    if (parsedEvents.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        imported: 0,
        message: "Calendar connected but no events with deadlines were found.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Save or update the calendar feed
    const { error: feedError } = await serviceClient
      .from("calendar_feeds")
      .upsert({
        user_id: user.id,
        name: feed_name || "My Calendar",
        feed_url,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,feed_url" });

    if (feedError) {
      console.error("Failed to save feed:", feedError.message);
    }

    // Insert parsed events as assignments
    let importedCount = 0;
    const errors: string[] = [];

    for (const event of parsedEvents) {
      const assignmentData = {
        user_id: user.id,
        title: event.title,
        subject: feed_name || "Imported",
        deadline: event.deadline,
        attachment_url: null,
        status: "pending" as const,
        source: "calendar",
      };

      const { error: insertError } = await serviceClient
        .from("assignments")
        .insert(assignmentData);

      if (insertError) {
        if (insertError.code === "23505") {
          // Duplicate — skip
          continue;
        }
        errors.push(`Failed to import "${event.title}": ${insertError.message}`);
      } else {
        importedCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      imported: importedCount,
      total_found: parsedEvents.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
