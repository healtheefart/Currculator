/** 초 → 분 단위 반올림 표시. 5100 → "1시간 25분", 2700 → "45분", 3600 → "1시간", 0 → "0분" */
export function formatDuration(sec: number): string {
  const totalMinutes = Math.round(sec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
