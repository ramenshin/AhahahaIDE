import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { loader } from '@monaco-editor/react'

// Monaco는 구문 강조 등을 위해 별도 worker를 사용. CDN 대신 번들된 worker 주입.
self.MonacoEnvironment = {
  getWorker: () => new editorWorker()
}

// @monaco-editor/react가 CDN fetch 대신 번들된 monaco 인스턴스를 쓰도록 설정.
loader.config({ monaco })

export { monaco }
