// Weather: what falls from the sky on maps (`weather: { kind: 'rain' }`, game.maps.weather) and in
// scenes (weather('petals')). Edit the numbers or add your own kind: its name becomes usable
// (and autocompleted) everywhere. Edit freely: this is game content, not engine.
import { defineWeather } from '@/core/weather'

export default defineWeather({
  // Used when no intensity is given (0 = nothing, 1 = everything below).
  defaultIntensity: 0.6,

  kinds: {
    rain: {
      shape: 'streak',
      perMegapixel: 260, // how many, per million screen pixels, at intensity 1
      speed: [700, 1000], // falling, pixels per second
      drift: -120, // sideways (negative = to the left)
      size: [10, 18], // streak length
      color: '#aecbfa',
      alpha: 0.55,
      width: 1.5,
    },
    snow: {
      shape: 'dot',
      perMegapixel: 170,
      speed: [30, 70],
      drift: [-10, 10],
      size: [1, 3],
      sway: 12,
      color: '#ffffff',
      alpha: 0.85,
    },
    petals: {
      shape: 'petal',
      perMegapixel: 45,
      speed: [40, 90],
      drift: [-60, -20],
      size: [3, 6],
      sway: 30,
      color: ['#ffc1d9', '#ffd7e6', '#ff9ec4'],
      alpha: 0.9,
    },
    embers: {
      shape: 'dot',
      perMegapixel: 35,
      speed: [-90, -40], // negative = rising
      drift: [-15, 15],
      size: [1, 2.5],
      sway: 18,
      color: ['#ffb347', '#ff7043'],
      alpha: 0.8,
    },
  },
})
