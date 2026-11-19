// The language the game is written in. Translations live in the folders next to this file.
import { defineSourceLanguage } from '@/core/lang/define'

export default defineSourceLanguage({
  name: 'English',
  locale: 'en',
  // First start: the device's language when the game has it, else English. false = always English.
  followSystem: true,
  // Your own wording for any text, the engine's included ("Quest complete: {title}" in a toast):
  // the text exactly as written -> what to show. Translations still use the original text.
  // Texts with a {count} can give a form for one thing and one for more.
  strings: {
    // 'Quest complete: {title}': 'Mission done: {title}',
    'I have {count} apples.': { one: 'I have {count} apple.', other: 'I have {count} apples.' },
  },
})
