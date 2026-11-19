// Background sounds that go with the weather (maps without their own `ambient`).
import { defineAmbient } from '@/core/define'

export default defineAmbient({
  weather: { rain: 'ambient/rain', snow: null },
})
