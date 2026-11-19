// The short code of a dialogue line (read tracking), and the names of voice clips. No imports: scripts/story.ts (Node) uses it too.

export function lineHash(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

/** Who a voice file is named after when no character speaks. */
export const NARRATOR = 'narrator'

/**
 * The speaker part of a voice file name: the character id; for a line without a character, the
 * name it shows (`as`: "Student A" -> student_a), else "narrator".
 */
export function voiceSpeaker(speaker: string | null, as?: string): string {
  if (speaker) return speaker
  const slug = (as ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(slug) ? slug : NARRATOR
}

/** A voice number as it is written in file names: 12 with 4 digits = "0012". */
export function voiceNumber(id: number, digits: number): string {
  return String(Math.trunc(id)).padStart(digits, '0')
}

/**
 * A line's voice clip, without its language: "<event id>/<speaker>_<number>". Its file is
 * src/content/audio/voice/<language>/<event id>/<speaker>_<number>.ogg (any sound format).
 */
export function voiceClip(eventId: string, speaker: string, id: number, digits: number): string {
  return `${eventId}/${speaker}_${voiceNumber(id, digits)}`
}

/** Takes a clip apart: 'town/arrival/anna_0012' -> event, speaker and number (null = not a clip). */
export function parseVoiceClip(
  clip: string,
): { event: string; speaker: string; id: number } | null {
  const m = /^(.+)\/([a-z][a-z0-9_]*)_(\d+)$/.exec(clip)
  return m ? { event: m[1] as string, speaker: m[2] as string, id: Number(m[3]) } : null
}
