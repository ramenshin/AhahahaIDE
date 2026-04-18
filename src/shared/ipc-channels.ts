export const IpcChannel = {
  ScanFolders: 'folders:scan',
  GetConfig: 'config:get',
  SetConfig: 'config:set'
} as const

export type IpcChannelValue = typeof IpcChannel[keyof typeof IpcChannel]
