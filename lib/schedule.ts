import { minutesToTime, timeToMinutes, toDatetimeLocal } from "@/lib/format";
import { archiveYears } from "@/lib/local-data";
import type { AppData, ArchiveSong, ClubUser, Performance, PracticeCandidate, Schedule, ScheduleSurvey, Song, Team } from "@/types/domain";

export const defaultAccent = "#6FE3F2";

export const fixedTeamColors: Record<string, string> = {
  "춤": "#6FE3F2",
  "랩": "#C9A0FF",
  "기획": "#8EF07A",
};

export const palette = ["#6FE3F2", "#F7EE6A", "#8EF07A", "#F58AD9", "#C9A0FF", "#FFB061", "#6FF0C5"];

// 예전에 저장된 쨍한 네온 색을 지금 색으로 바꿔 보여준다.
const olderColors: Record<string, string> = {
  "#00E5FF": "#6FE3F2",
  "#FFF200": "#F7EE6A",
  "#39FF14": "#8EF07A",
  "#FF4FD8": "#F58AD9",
  "#C77DFF": "#C9A0FF",
  "#FF8A00": "#FFB061",
  "#00FFB3": "#6FF0C5",
};

export function currentColor(color: string) {
  return olderColors[color.toUpperCase()] ?? color;
}

// 사람이 직접 고르는 색. 자동으로 정하는 색은 네온만 쓴다.
export const pickColors = [...palette, "#A1A1AA", "#000000", "#FFFFFF"];
export const personalColor = "#A1A1AA";

// 색 바탕 위 글자색. 검정 바탕일 때만 흰 글씨.
export function inkOn(color: string) {
  return color.toUpperCase() === "#000000" ? "#FFFFFF" : "#171717";
}

export function archiveSourceLabel(item: ArchiveSong) {
  const years = archiveYears(item);
  if (years.length > 0) return years.map((year) => String(year).slice(2)).join(", ");
  const source = item.source;
  return source ?? "이력";
}

export function getVisibleSchedules(data: AppData, currentUser: ClubUser, adminMode: boolean) {
  return data.schedules.filter((schedule) => {
    if (schedule.status !== "CONFIRMED") return false;
    if (schedule.visibility === "PRIVATE") return schedule.ownerUserId === currentUser.id;
    if (adminMode) return true;
    if (schedule.visibility === "ADMINS_ONLY") return false;
    if (schedule.visibility === "PUBLIC") return true;
    if (schedule.visibility === "MEMBERS_ONLY" && schedule.songId) {
      return data.songs.some((song) => song.id === schedule.songId && song.leaderUserId === currentUser.id)
        || data.songMembers.some((member) => member.songId === schedule.songId && member.userId === currentUser.id);
    }
    return false;
  });
}

// 공연 카드와 캘린더 공연 일정 색. 공연 id로 네온 색 하나를 고정해서 고른다.
export function performanceAccent(performance: Performance) {
  const hash = [...performance.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export function performanceColor(performance: Performance, user: ClubUser) {
  const picked = user.performanceColors?.[performance.id];
  return picked ? currentColor(picked) : performanceAccent(performance);
}

export function teamColor(team?: Team, viewer?: ClubUser) {
  if (!team) return defaultAccent;
  const color = currentColor(viewer?.teamColors?.[team.id] ?? team.color ?? "");
  return pickColors.includes(color) ? color : fixedTeamColors[team.name] ?? defaultAccent;
}

// 곡 카드 색. 내가 고른 곡 색이 있으면 그 색, 없으면 소속 팀 색.
export function songColor(song: Song, data: AppData, viewer?: ClubUser) {
  return viewer?.songColors?.[song.id] ?? teamColor(data.teams.find((team) => team.id === song.teamId), viewer);
}

export function alpha(hex: string, opacity = "33") {
  return `${hex}${opacity}`;
}

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Record<keyof AppData, unknown>>;
  return (
    Array.isArray(data.teams) &&
    Array.isArray(data.users) &&
    Array.isArray(data.performances) &&
    Array.isArray(data.songs) &&
    Array.isArray(data.songMembers) &&
    (data.archiveSongs === undefined || Array.isArray(data.archiveSongs)) &&
    Array.isArray(data.schedules) &&
    Array.isArray(data.surveys) &&
    Array.isArray(data.availabilityResponses) &&
    Array.isArray(data.practiceCandidates) &&
    Array.isArray(data.notices)
  );
}

export function eventColor(schedule: Schedule, data: AppData, currentUser: ClubUser) {
  if (schedule.type === "PERSONAL") return schedule.color && pickColors.includes(currentColor(schedule.color)) ? currentColor(schedule.color) : personalColor;
  // 연습은 곡마다 다른 색
  if (schedule.songId) {
    const mine = currentUser.songColors?.[schedule.songId];
    if (mine) return mine;
    const index = data.songs.findIndex((song) => song.id === schedule.songId);
    if (index >= 0) return palette[index % palette.length];
  }
  if (schedule.performanceId) {
    const performance = data.performances.find((item) => item.id === schedule.performanceId);
    if (performance) return performanceColor(performance, currentUser);
  }
  return currentColor(schedule.color ?? defaultAccent);
}

export function getSurveyTimes(survey: ScheduleSurvey) {
  const times: string[] = [];
  for (let minute = timeToMinutes(survey.timeStart); minute < timeToMinutes(survey.timeEnd); minute += survey.slotMinutes) {
    times.push(minutesToTime(minute));
  }
  return times;
}

export function slotKey(date: string, time: string) {
  return `${date}_${time}`;
}

// 조사 대상 곡: 선택한 공연의 곡들 (공연 지정이 없으면 전체)
export function surveySongIds(survey: ScheduleSurvey, data: AppData) {
  return data.songs.filter((song) => survey.performanceIds.length === 0 || survey.performanceIds.includes(song.performanceId)).map((song) => song.id);
}

// 조사 대상 인원: 선택한 공연 카드의 참여 인원 + 그 공연 곡들의 팀원·곡팀장
export function surveyUserIds(survey: Pick<ScheduleSurvey, "performanceIds">, data: AppData) {
  if (survey.performanceIds.length === 0) return data.users.map((user) => user.id);
  const songIds = new Set(data.songs.filter((song) => survey.performanceIds.includes(song.performanceId)).map((song) => song.id));
  return Array.from(new Set([
    ...data.performances.filter((performance) => survey.performanceIds.includes(performance.id)).flatMap((performance) => performance.memberIds),
    ...data.songMembers.filter((member) => songIds.has(member.songId)).map((member) => member.userId),
    ...data.songs.filter((song) => songIds.has(song.id)).map((song) => song.leaderUserId),
  ]));
}

export function surveyLabel(survey: ScheduleSurvey) {
  const range = `${survey.startDate.slice(5).replace("-", ".")}~${survey.endDate.slice(5).replace("-", ".")}`;
  return `${survey.title} (${range})${survey.status === "OPEN" ? "" : " (마감)"}`;
}

// 끝난 공연: 종료 시각이 지났거나 완료/취소 처리된 공연
export function isPastPerformance(performance: Performance, now = new Date().toISOString()) {
  return performance.endsAt < now || performance.status === "COMPLETED" || performance.status === "CANCELED";
}

// 곡팀장 권한은 끝나지 않은 공연의 곡에만 준다. 공연이 끝나면 그 곡의 곡팀장 탭도 사라진다.
export function activeLeaderSongs(userId: string, data: AppData, now = new Date().toISOString()) {
  return data.songs.filter((song) => {
    if (song.leaderUserId !== userId) return false;
    const performance = data.performances.find((item) => item.id === song.performanceId);
    return Boolean(performance) && !isPastPerformance(performance!, now);
  });
}

export function getSongUserIds(songId: string, data: AppData) {
  return data.songMembers.filter((member) => member.songId === songId).map((member) => member.userId);
}

export function timesBetween(start: string, end: string, slotMinutes: number) {
  const times: string[] = [];
  for (let minute = timeToMinutes(start); minute < timeToMinutes(end); minute += slotMinutes) times.push(minutesToTime(minute));
  return times;
}

// 관리자가 10분 단위로 조정한 시간도 조사 칸(30분)에 맞춰 본다: [start, end)와 조금이라도 겹치는 칸
export function slotsCovering(survey: ScheduleSurvey, start: string, end: string) {
  return getSurveyTimes(survey).filter((time) => time < end && minutesToTime(timeToMinutes(time) + survey.slotMinutes) > start);
}

export function getSurveyHeatmap(survey: ScheduleSurvey, data: AppData, userIds: string[]) {
  const responses = data.availabilityResponses.filter((response) => response.surveyId === survey.id && userIds.includes(response.userId));
  const counts = new Map<string, number>();
  responses.forEach((response) => {
    response.slots.forEach((slot) => {
      if (!slot.available) return;
      counts.set(slotKey(slot.date, slot.time), (counts.get(slotKey(slot.date, slot.time)) ?? 0) + 1);
    });
  });
  return { counts, respondedCount: responses.length };
}

// userIds 중 해당 날짜의 모든 시간 칸에 가능하다고 응답한 사람
export function getAvailableUserIds(survey: ScheduleSurvey, data: AppData, userIds: string[], date: string, times: string[]) {
  if (times.length === 0) return [];
  return data.availabilityResponses
    .filter((response) => response.surveyId === survey.id && userIds.includes(response.userId))
    .filter((response) => times.every((time) => response.slots.some((slot) => slot.date === date && slot.time === time && slot.available)))
    .map((response) => response.userId);
}

// 연습 시간 안에서 가능한 인원이 같은 구간끼리 묶는다. 예: 18-19시 ABC, 19-20시 BCD
export function availabilitySegments(survey: ScheduleSurvey, data: AppData, userIds: string[], date: string, times: string[]) {
  const segments: Array<{ start: string; end: string; userIds: string[] }> = [];
  for (const time of times) {
    const ids = getAvailableUserIds(survey, data, userIds, date, [time]);
    const end = minutesToTime(timeToMinutes(time) + survey.slotMinutes);
    const last = segments[segments.length - 1];
    if (last && last.userIds.join() === ids.join()) last.end = end;
    else segments.push({ start: time, end, userIds: ids });
  }
  return segments;
}

// 시간이 겹치는 다른 곡 요청 중 같은 장소를 쓰거나(외부 대관은 장소가 제각각이라 제외) 겹치는 팀원이 있는 것.
// 장소도 다르고 겹치는 사람도 없으면 동시에 연습할 수 있으므로 충돌이 아니다.
export function findPracticeConflicts(target: PracticeCandidate, candidates: PracticeCandidate[], data: AppData) {
  const members = getSongUserIds(target.songId, data);
  return candidates.flatMap((other) => {
    if (other.id === target.id || other.songId === target.songId || other.status === "REJECTED") return [];
    if (!(target.startsAt < other.endsAt && other.startsAt < target.endsAt)) return [];
    const sameLocation = target.location === other.location && target.location !== "외부 대관";
    const sharedUserIds = getSongUserIds(other.songId, data).filter((userId) => members.includes(userId));
    return sameLocation || sharedUserIds.length > 0 ? [{ other, sameLocation, sharedUserIds }] : [];
  });
}

// 같은 날짜에서 끊기지 않고 이어진 칸을 연습 1회로 묶는다.
export function slotsToBlocks(selected: Set<string>, dates: string[], times: string[], slotMinutes: number) {
  const blocks: Array<{ date: string; start: string; end: string; times: string[] }> = [];
  for (const date of dates) {
    let run: string[] = [];
    const flush = () => {
      if (run.length) blocks.push({ date, start: run[0], end: minutesToTime(timeToMinutes(run[run.length - 1]) + slotMinutes), times: run });
      run = [];
    };
    for (const time of times) {
      if (selected.has(slotKey(date, time))) run.push(time);
      else flush();
    }
    flush();
  }
  return blocks;
}

export function candidateBlock(candidate: PracticeCandidate) {
  const [date, start] = toDatetimeLocal(candidate.startsAt).split("T");
  const end = toDatetimeLocal(candidate.endsAt).split("T")[1];
  return { date, start, end: end === "00:00" ? "24:00" : end };
}
