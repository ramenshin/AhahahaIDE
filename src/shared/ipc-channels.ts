export const IpcChannel = {
  ScanFolders: 'folders:scan',
  GetConfig: 'config:get',
  SetConfig: 'config:set',
  PtyCreate: 'pty:create',
  PtyWrite: 'pty:write',
  PtyResize: 'pty:resize',
  PtyClose: 'pty:close',
  PtyData: 'pty:data',
  PtyExit: 'pty:exit'
} as const

export type IpcChannelValue = typeof IpcChannel[keyof typeof IpcChannel]
