/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        // Casino/poker table theme colors - NO BLUE
        'casino': {
          'dark': '#1a1510',
          'brown': '#2d2318',
          'green': '#1a3328',
          'gold': '#c9a227',
          'gold-dark': '#8b7019',
          'red': '#8b2635',
          'red-dark': '#5c1a23',
          'felt': '#1e4d3a',
          'felt-dark': '#153326',
        },
        'card': {
          'red': '#dc2626',
          'black': '#1f2937',
        },
      },
      backgroundImage: {
        // Dark casino gradients - NO BLUE
        'casino-gradient': 'linear-gradient(135deg, #1a1510 0%, #2d2318 50%, #1a3328 100%)',
        'felt-gradient': 'radial-gradient(ellipse at center, #1e4d3a 0%, #153326 70%, #0d1f17 100%)',
        'gold-gradient': 'linear-gradient(135deg, #c9a227 0%, #8b7019 100%)',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'gold': '0 0 20px rgba(201, 162, 39, 0.3)',
      },
    },
  },
  plugins: [],
}
