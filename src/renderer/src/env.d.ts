/// <reference types="vite/client" />

import type { DevIdeToolApi } from '../../preload/index'

declare global {
  interface Window {
    api: DevIdeToolApi
  }
}

export {}
