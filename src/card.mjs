// Purpose: Shared geometry for the browser's dependency-free verdict-card canvas renderer.
export function barGeometry(count, { top = 150, height = 24, gap = 14 } = {}) {
  return Array.from({ length: count }, (_, index) => ({ x: 52, y: top + index * (height + gap), width: 920, height }));
}

export function normalizedAnswer(answer, question) {
  if (answer.type === 'noul') return answer.noul;
  if (answer.type === 'score') return question.criteria.length === 1 ? 0 : answer.score / (question.criteria.length - 1);
  return answer.probabilities[answer.choice] ?? 0;
}
