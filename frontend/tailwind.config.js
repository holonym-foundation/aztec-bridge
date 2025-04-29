function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`
    }

    return `rgb(var(${variableName}))`
  }
}

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',

    // Or if using `src` directory:
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    fontSize: {
      36: '36px',
      32: '32px',
      30: '30px',
      26: '26px',
      24: '24px',
      20: '20px',
      18: '18px',
      16: '16px',
      14: '14px',
      12: '12px',
      10: '10px',
      '9xl': '128px',
      '8xl': '96px',
      '7xl': '72px',
      '6xl': '60px',
      '5xl': '48px',
      '4xl': '36px',
      '3xl': '30px',
      '2xl': '24px',
      xl: '20px',
      lg: '18px',
      md: '16px',
      sm: '14px',
      xs: '12px'
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    colors: {
      blue: '#183882',
      purple: '#7e5bef',
      'light-blue': '#0087D8',
      red: '#D92D20',
      pink: '#DF3A86',
      orange: '#F75C03',
      green: '#13ce66',
      greenLight: '#12B76A',
      'green-200': '#BBF7D0',
      'green-50': '#F0FDF4',
      yellow: '#ffc82c',
      'dark-yellow': '#C3811D',
      'light-yellow': '#FAEFE3',
      'gray-dark': '#273444',
      gray: '#737373',
      grayTwo: '#838383',
      'gray-light': '#A7A7A7',
      'gray-hover': '#E5E5E5',
      'gray-200': '#E5E7EB',
      brown: '#422A05',
      'gray-border': '#8080802e',
      black: '#000000',
      white: '#FFFFFF',
      'trans-text': '#16A34A',
      'transparent-gray': '#03030354',
      base: {
        100: '#FFFFFF',
        200: '#000000',
        300: '#fff',
        400: '#EFF6FF',
        500: '#efefef',
        600: '#FFFFFF33',
        700: '#0A0A0A66',
      },
      'light-brand':{
        100:'#FFAA70',
      },
      latest:{
        grey:{
          100:'#737373',
          200:'#F5F5F5',
          300:'#e5e5e5',
          400:'#B7B7B7',
          500:'#747474',
          600:'#989898',
          700:'#929292',
          800:'#f0f0f0',
          900:'#94969a',
          1000:'#00000063'
        },
        black:{
          100:'#1E1E1E',
          200:'#111111',
          300:'#0A0A0A',
          400:'#404040',
        },
       red:{
        100:'#FFF3E9',
        200:'#831816',
        300:'#FFEBEB',
       },
       blue:{
        100:'#17235E',
        200:'#E5EFFF',
       
       },
       green:{
        100:'#2F5214',
        200:'#DBFAAE',
       },

      },
      blue: {
        100: '#2563EB',
        200: '#3B82F6',
        300: '#DBEAFE',
      },
      grey: {
        100: '#333333',
        200: '#333',
      },
      error: {
        100: '#FFFBFA',
        200: '#FEF3F2',
        300: '#FEE4E2',
        400: '#FECDCA',
        500: '#FDA29B',
        600: '#F97066',
        700: '#F04438',
        800: '#D92D20',
        900: '#B42318',
        light: '#EF4444',
        main: '#912018',
        dark: '#7A271A'
      },
      warn: {
        100: '#FFFCF5',
        200: '#FFFAEB',
        300: '#FEF0C7',
        400: '#FEDF89',
        500: '#FEC84B',
        600: '#FDB022',
        700: '#F79009',
        800: '#DC6803',
        900: '#B54708',
        main: '#93370D',
        dark: '#7A2E0E'
      },
      green: {
        100: '#DCFCE7',
        200:'#08B108',
      },
      success: {
        100: '#F6FEF9',
        200: '#ECFDF3',
        300: '#D1FADF',
        400: '#A6F4C5',
        500: '#6CE9A6',
        600: '#32D583',
        700: '#12B76A',
        800: '#039855',
        900: '#027A48',
        1000: '#22C55E',
        main: '#05603A',
        dark: '#054F31'
      },
      neutral: {
        100: '#FAFAFA',
        200: '#F5F5F5',
        300: '#E5E5E5',
        400: '#D4D4D4',
        500: '#9D9D9D',
        600: '#737373',
        700: '#525252',
        800: '#404040',
        900: '#262626',
        main: '#171717'
      },
      silk: {
        100: '#F8F4F133',
        200: '#F1EBE626',
        300: '#F5EDE1',
        400: '#EED4AD',
        500: '#C3811D',
        600: '#422A05',
        700: '#BD9171',
        800: '#FDC094',
        900: '#7E6033',
        main: '#00000033',
      }
    },
    fontFamily: {
      inter: ['Inter', 'sans-serif'],
      sans: ['Cormorant Garamond', 'sans-serif']
    },
    fontWeight: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    spacing: {
      px: '1px',
      0: '0',
      0.5: '0.125rem',
      1: '0.25rem',
      1.5: '0.375rem',
      2: '0.5rem',
      2.5: '0.625rem',
      3: '0.75rem',
      3.5: '0.875rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      7: '1.75rem',
      8: '2rem',
      9: '2.25rem',
      10: '2.5rem',
      11: '2.75rem',
      12: '3rem',
      14: '3.5rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
      28: '7rem',
      32: '8rem',
      36: '9rem',
      40: '10rem',
      44: '11rem',
      48: '12rem',
      52: '13rem',
      56: '14rem',
      60: '15rem',
      64: '16rem',
      72: '18rem',
      80: '20rem',
      96: '24rem'
    },
    borderRadius: {
      none: '0',
      sm: '.125rem',
      DEFAULT: '.25rem',
      md:'12px',
      lg: '1rem',
      xl: '1.5rem',
      full: '9999px'
    },
    opacity: {
      '0': '0',
      '20': '0.2',
      '40': '0.4',
      '60': '0.6',
      '80': '0.8',
      '100': '1'
    },
    extend: {
      animation: {
        shake: 'shake 0.5s',
        'rotate-90': 'rotateAnimation 1s ease-in-out forwards',
      },
      keyframes: {
        rotateAnimation: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(90deg)' },
        },
        shake: {
          '10%, 90%': {
            transform: 'translate3d(-1px, 0, 0)'
          },
          '20%, 80%': {
            transform: 'translate3d(2px, 0, 0)'
          },
          '30%, 50%, 70%': {
            transform: 'translate3d(-4px, 0, 0)'
          },
          '40%, 60%': {
            transform: 'translate3d(4px, 0, 0)'
          }
        }
      },
      backgroundImage: {
        'gradient-radial':
          'radial-gradient(50% 50% at 50% 50%, #F2E7D4 0%, #F2F2F2 100%)',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'size-100': '100% 100%',
      },
      textColor: {
        skin: {
          primary: withOpacity('--color-primary'),
          a11y: withOpacity('--color-a11y')
        }
      },
      backgroundColor: {
        skin: {
          primary: withOpacity('--color-primary'),
          a11y: withOpacity('--color-a11y')
        }
      },
      ringColor: {
        skin: {
          primary: withOpacity('--color-primary')
        }
      },
      borderColor: {
        skin: {
          primary: withOpacity('--color-primary'),
          a11y: withOpacity('--color-a11y')
        }
      },
      backgroundImage: {
        // eslint-disable-next-line quotes
        'edit-dots': "url('/images/bg-dots.svg')"
      }
    }
  },
  plugins: [
    // require('@tailwindcss/forms')
    require('tailwind-scrollbar')({
      nocompatible: true
    })
  ]
}
