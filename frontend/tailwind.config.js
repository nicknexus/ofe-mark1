/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Nexus green palette based on #81b393
                primary: {
                    50: '#f0f7f3',
                    100: '#dceee3',
                    200: '#bdddc9',
                    300: '#9ecbb0',
                    400: '#81b393',  // Secondary accent
                    500: '#81b393',  // Main brand green
                    600: '#6a9b7c',
                    700: '#578266',
                    800: '#476952',
                    900: '#3b5644',
                    950: '#1f2f25',
                },
                // Dark grey text color
                secondary: {
                    50: '#f7f8f9',
                    100: '#eceef1',
                    200: '#d8dbe1',
                    300: '#b8bcc7',
                    400: '#8e94a3',
                    500: '#6b7280',
                    600: '#4a5163',  // Main text grey
                    700: '#3d4352',
                    800: '#2f3340',
                    900: '#1f222b',
                    950: '#12141a',
                },
                // Modern dashboard colors
                evidence: {
                    50: '#dff3ff',
                    100: '#bae6ff',
                    200: '#7dd3fc',
                    300: '#38bdf8',
                    400: '#3db6fd',  // Main evidence blue
                    500: '#3db6fd',
                    600: '#0284c7',
                    700: '#0369a1',
                },
                impact: {
                    50: '#e4fce9',
                    100: '#bbf7c9',
                    200: '#86efac',
                    300: '#4ade80',
                    400: '#3DBE78',  // Main impact green
                    500: '#3DBE78',
                    600: '#16a34a',
                    700: '#15803d',
                },
                // Off-white page background
                page: '#F0F1F4',
                offWhite: '#F4F5F7',
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
            },
            boxShadow: {
                // Soft floating card shadows
                'bubble': '0 4px 20px rgba(0, 0, 0, 0.06)',
                'bubble-hover': '0 8px 28px rgba(0, 0, 0, 0.08)',
                'bubble-sm': '0 2px 10px rgba(0, 0, 0, 0.05)',
                'bubble-lg': '0 10px 40px rgba(0, 0, 0, 0.08)',
                'icon-bubble': 'inset 0 1px 4px rgba(0, 0, 0, 0.05)',
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1.25rem',
            },
            animation: {
                'fade-in': 'fadeIn 0.1s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'slide-up': 'slideUpFadeIn 0.2s ease-out',
                'slide-up-fast': 'slideUpFadeInFast 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                slideUpFadeInFast: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUpFadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
    ],
} 