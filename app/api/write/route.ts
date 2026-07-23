import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabaseServer";

// Writing-studio endpoint. This one costs money per call, so it verifies the
// signed-in user itself rather than relying on the proxy gate alone.

const MODEL = "claude-opus-4-8";

const VOICE = `You are a collaborator for a fiction and creative writer. You help develop
stories, characters, and worlds.

How to work:
- Serve the writer's vision, not your taste. Build on what's on the page.
- Be specific and concrete. "A locksmith who's never seen the inside of the house
  he has keys to" beats "an interesting character with secrets."
- Take real swings. Surprising and strange beats safe and tidy.
- Never lecture about craft or explain your reasoning unless asked.
- If the draft is empty or barely started, work from whatever seed is there —
  a title, a fragment, a mood — and invent generously.
- Match the writer's voice, register, and tense when producing prose.
- No preamble. No "Here are some ideas:" — just deliver.`;

const ACTIONS: Record<string, string> = {
  directions: `Give exactly 3 distinct directions this could go from here. Make them genuinely
different from each other — not three flavors of the same idea. One should be the
obvious-but-good one, one should be a sharp left turn, one should be quieter and
stranger. Two or three sentences each. Number them.`,

  continue: `Continue the draft from where it stops. Match the voice, tense, and rhythm exactly.
Write 200-400 words. Don't wrap up or resolve anything — just carry it forward.
Output only the prose, nothing else.`,

  character: `Develop a character from this draft (pick the one with the most unexplored
potential, or invent one the story clearly needs). Give: who they are, what they
want, what they're hiding, and one specific concrete detail that makes them real.
Keep it under 250 words.`,

  world: `Build out the world of this story. Surface 3-4 concrete details about how this
place works — rules, textures, what's normal here that wouldn't be normal
elsewhere. Specific and sensory, not encyclopedic. Under 250 words.`,

  critique: `Read this as a sharp, generous editor. Tell me: what's genuinely working (be
specific about why), and the one or two things holding it back most. Be honest —
vague encouragement is useless. Under 250 words.`,
};

export async function POST(request: Request) {
  // 1. Only the owner may spend API credits.
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  if (!user || (allowed && user.email?.toLowerCase() !== allowed)) {
    return Response.json({ error: "not authorized" }, { status: 401 });
  }

  // No key configured yet — this is an expected state, not a failure.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Claude isn't connected yet. Everything else here works — drafts save as you type." },
      { status: 503 }
    );
  }

  try {
    const { action, title, body, question } = await request.json();

    const instruction =
      action === "ask" && question
        ? `The writer asks: ${question}`
        : ACTIONS[action as string];
    if (!instruction) {
      return Response.json({ error: "unknown action" }, { status: 400 });
    }

    const draft = (body ?? "").trim();
    const context = draft
      ? `Title: ${title || "Untitled"}\n\n--- DRAFT ---\n${draft}\n--- END DRAFT ---`
      : `Title: ${title || "Untitled"}\n\n(The draft is empty so far.)`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: VOICE,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: `${context}\n\n${instruction}` }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    return Response.json({ text });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited — try again in a moment." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The Anthropic API key looks invalid." }, { status: 502 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error: ${err.message}` }, { status: 502 });
    }
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
