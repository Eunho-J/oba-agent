const COMPLETION_CLAIMS = [
  /read/i,
  /wrote/i,
  /written/i,
  /edited/i,
  /ran/i,
  /executed/i,
  /completed/i,
  /읽었/,
  /썼/,
  /작성/,
  /수정/,
  /실행/,
  /완료/
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
