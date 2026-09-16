import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        institucional: {
          DEFAULT: '#0B3D91',
          dark: '#082C68',
          light: '#3E63B0',
        },
        estado: {
          verde: '#1E8E3E',
          amarillo: '#E8A33D',
          rojo: '#D93025',
        },
      },
    },
  },
  plugins: [],
};
export default config;
