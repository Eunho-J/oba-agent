const COMPLETION_CLAIMS = [
  /\b(i'?ve|i have|we'?ve|we have)\s+(read|written|edited|run|executed|completed)\b/i,
  /\b(wrote|written|edited|ran|executed|completed)\b/i,
  /읽었/,
  /확인했/,
  /썼/,
  /작성했/,
  /수정했/,
  /실행했/,
  /완료했/,
  /처리했/,
  /끝냈/,
  /저장했/,
  /생성했/
];

export function checkFinalClaims(answer, toolEvents) {
  const hasClaim = COMPLETION_CLAIMS.some((pattern) => pattern.test(answer || ""));
  if (!hasClaim) return { passed: true, downgraded: false, answer };

  const hasSuccessfulTool = toolEvents.some((event) => event.status === "success");
  if (hasSuccessfulTool) return { passed: true, downgraded: false, answer };

  return {
    passed: false,
    downgraded: true,
    answer: "완료했다고 확인할 수 있는 도구 실행 기록이 없습니다. 다시 확인이 필요합니다."
  };
}
