export const IpcChannel = {
  ScanFolders: 'folders:scan',
  GetConfig: 'config:get',
  SetConfig: 'config:set',
  PtyCreate: 'pty:create',
  PtyWrite: 'pty:write',
  PtyResize: 'pty:resize',
  PtyClose: 'pty:close',
  PtyData: 'pty:data',
  PtyExit: 'pty:exit',
  FsWatch: 'fs:watch',
  FsUnwatch: 'fs:unwatch',
  FsChange: 'fs:change',
  FsRootRemoved: 'fs:root-removed',
  DialogPickFolder: 'dialog:pick-folder',
  MemoLoad: 'memo:load',
  MemoSave: 'memo:save'
} as const

export type IpcChannelValue = typeof IpcChannel[keyof typeof IpcChannel]
