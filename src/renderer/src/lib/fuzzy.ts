// 간단한 VS Code 스타일 퍼지 매칭.
// - 모든 query 문자가 대상 문자열에 순서대로 존재해야 매칭
// - 연속 매칭·단어 경계·앞부분 매칭에 가산점
// - 매칭된 인덱스 배열을 반환해 UI에서 하이라이트에 사용

export interface FuzzyResult {
  score: number
  // target 내에서 매칭된 문자들의 인덱스 배열 (오름차순). 길이 === query.length
  matches: number[]
}

function isWordBoundary(ch: string): boolean {
  return /[\s_\-./\\]/.test(ch)
}

function isUpper(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z'
}

// 반환 null = 매칭 실패. 대소문자 무시.
export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  if (!query) return { score: 0, matches: [] }
  if (!target) return null

  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const matches: number[] = []
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      matches.push(ti)
      qi++
    }
  }
  if (qi < q.length) return null

  // 점수: 단순 greedy 매칭이라 최적은 아니지만 충분.
  let score = 0
  for (let i = 0; i < matches.length; i++) {
    const idx = matches[i]
    // 기본 +1
    score += 1
    // 맨 앞 매칭 보너스
    if (idx === 0) score += 6
    // 단어 경계 뒤 매칭 (camelCase 대문자 포함) 보너스
    if (idx > 0) {
      const prev = target[idx - 1]
      if (isWordBoundary(prev)) score += 4
      else if (isUpper(target[idx]) && !isUpper(prev)) score += 3
    }
    // 연속 매칭 보너스 (바로 전 매칭과 이웃)
    if (i > 0 && idx === matches[i - 1] + 1) score += 5
  }
  // 짧은 타깃 선호 (동일 점수 시 더 짧은 쪽 우선)
  score -= target.length * 0.01
  return { score, matches }
}
