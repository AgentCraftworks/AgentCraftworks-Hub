import type { BrandVariants, Theme } from '@fluentui/react-components'
import { createLightTheme, createDarkTheme, createHighContrastTheme } from '@fluentui/react-components'

export const agentCraftworksBrand: BrandVariants = {
  10: '#020305',
  20: '#111724',
  30: '#172540',
  40: '#1A3157',
  50: '#1C3E6F',
  60: '#1C4A89',
  70: '#1A57A3',
  80: '#1465BD',
  90: '#2273D3',
  100: '#4980D8',
  110: '#648EDD',
  120: '#7C9CE2',
  130: '#91AAE6',
  140: '#A6B9EB',
  150: '#BAC8F0',
  160: '#CDD7F4',
}

const baseDark: Theme = {
  ...createDarkTheme(agentCraftworksBrand),
  colorBrandForeground1: agentCraftworksBrand[110],
  colorBrandForeground2: agentCraftworksBrand[120],
}

export const darkTheme: Theme = {
  ...baseDark,
  colorNeutralBackground1: '#090c14',
  colorNeutralForeground1: '#d6dbe4',
  colorBrandBackground: '#1a80e0',
}

export const lightTheme: Theme = {
  ...createLightTheme(agentCraftworksBrand),
  colorNeutralBackground1: '#fafbfc',
  colorNeutralForeground1: '#102f5e',
  colorBrandBackground: '#0c6fd1',
}

export const highContrastTheme: Theme = createHighContrastTheme()
