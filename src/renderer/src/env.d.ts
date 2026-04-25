/// <reference types="vite/client" />

import type { AhahahaApi } from '../../preload/index'

declare global {
  interface Window {
    api: AhahahaApi
  }
}

export {}
