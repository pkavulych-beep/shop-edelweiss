import { Manrope } from 'next/font/google';

// next/font сам роздає шрифт із нашого домену й додає @font-face з display: swap,
// тому зовнішні запити до fonts.googleapis.com / fonts.gstatic.com не потрібні.
export const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export const manropeFontFamily = `${manrope.style.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
