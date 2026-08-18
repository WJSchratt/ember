import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = 'claude-opus-5';

export async function generateIcebreaker({ title, interestNames, memberNames }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: `You're Tether, the bot that kicks off small-group chat rooms for people matched by shared interests. A room just formed:

Event: "${title}"
Shared interest tags: ${interestNames.join(', ')}
People in the room: ${memberNames.join(', ')}

Write ONE short, casual icebreaker message (1-2 sentences, no emoji spam, max one emoji) to post as the first message in this group chat. Reference the shared interest naturally. Don't greet everyone by listing all their names. Sound like a person, not a corporate bot. Output only the message text, nothing else.`,
      },
    ],
  });
  const text = response.content.find((b) => b.type === 'text')?.text?.trim();
  return text || `Welcome to ${title}! Say hi and let's get this started.`;
}

export async function suggestEvents({ interestCounts, existingTitles }) {
  const tagSummary = interestCounts
    .map((i) => `${i.name} (${i.count} interested ${i.count === 1 ? 'user' : 'users'})`)
    .join(', ');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  reason: { type: 'string' },
                },
                required: ['title', 'tags', 'reason'],
                additionalProperties: false,
              },
            },
          },
          required: ['suggestions'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: `Tether matches small groups of people into temporary chat rooms for shared-interest hangouts (e.g. "Halo 3 night", "Watching the match"). Here's what the current user base is interested in, by tag and how many people have that tag: ${tagSummary}.

Events already scheduled (avoid near-duplicates of these): ${existingTitles.length ? existingTitles.join(', ') : 'none yet'}.

Suggest 3 creative, specific hangout event ideas that would appeal to this user base — favor tags with more interested users so matching succeeds. Each suggestion needs: a short punchy title (like "Halo 3 night", not generic), a list of 1-2 tags from the interests above that must match EXACTLY as given, and a one-sentence reason it'd be a good match.`,
      },
    ],
  });
  const text = response.content.find((b) => b.type === 'text')?.text;
  const parsed = JSON.parse(text);
  return parsed.suggestions;
}
