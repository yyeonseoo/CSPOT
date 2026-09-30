import { getDateRange, minutesToTime, timeToMinutes } from "@/lib/format";
import { archiveYears } from "@/lib/local-data";
import type { AppData, ArchiveSong, ClubUser, Performance, PracticeCandidate, Schedule, ScheduleSurvey, Team } from "@/types/domain";

export const defaultBlue = "#7BC7F2";

export const fixedTeamColors: Record<string, string> = {
  "춤": "#7BC7F2",
  "랩": "#B8C8F8",
  "기획": "#8BDDD6",
};

export const palette = ["#7BC7F2", "#B8C8F8", "#8BDDD6", "#A8DADC", "#F8DFA8", "#C9E4CA", "#D7C0F7"];

export function archiveSourceLabel(item: ArchiveSong) {
  const years = archiveYears(item);
  if (years.length > 0) return years.map((year) => String(year).slice(2)).join(" · ");
  const source = item.source;
  return source ?? "이력";
}

export function getVisibleSchedules(data: AppData, currentUser: ClubUser, adminMode: boolean) {
  return data.schedules.filter((schedule) => {
    if (schedule.status !== "CONFIRMED") return false;
    if (adminMode) return true;
    if (schedule.visibility === "ADMINS_ONLY") return false;
    if (schedule.visibility === "PRIVATE") return schedule.ownerUserId === currentUser.id;
    if (schedule.visibility === "PUBLIC") return true;
    if (schedule.visibility === "MEMBERS_ONLY" && schedule.songId) return data.songMembers.some((member) => member.songId === schedule.songId && member.userId === currentUser.id);
    return false;
  });
}

export function performanceColor(performance: Performance, user: ClubUser) {
  return user.performanceColors?.[performance.id] ?? defaultBlue;
}

export function teamColor(team?: Team) {
  if (!team) return defaultBlue;
  return fixedTeamColors[team.name] ?? team.color ?? defaultBlue;
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
    Array.isArray(data.ambiguousTimes) &&
    Array.isArray(data.practiceCandidates) &&
    Array.isArray(data.notices) &&
    Array.isArray(data.auditLogs)
  );
}

export function eventColor(schedule: Schedule, data: AppData, currentUser: ClubUser) {
  if (schedule.type === "PERSONAL") return "#AAB2BD";
  if (schedule.performanceId) {
    const performance = data.performances.find((item) => item.id === schedule.performanceId);
    if (performance) return performanceColor(performance, currentUser);
  }
  return schedule.color ?? defaultBlue;
}

export function findPracticeConflicts(candidates: PracticeCandidate[], data: AppData) {
  const conflicts: Array<{
    first: PracticeCandidate & { performanceTitle: string; songTitle: string; teamName: string };
    second: PracticeCandidate & { performanceTitle: string; songTitle: string; teamName: string };
    startsAt: string;
    endsAt: string;
    sharedMemberCount: number;
  }> = [];

  candidates.forEach((first, firstIndex) => {
    candidates.slice(firstIndex + 1).forEach((second) => {
      if (first.songId === second.songId) return;
      if (!(first.startsAt < second.endsAt && second.startsAt < first.endsAt)) return;
      const firstSong = data.songs.find((song) => song.id === first.songId);
      const secondSong = data.songs.find((song) => song.id === second.songId);
      if (!firstSong || !secondSong) return;
      if (firstSong.teamId === secondSong.teamId) return;
      const firstPerformance = data.performances.find((performance) => performance.id === firstSong.performanceId);
      const secondPerformance = data.performances.find((performance) => performance.id === secondSong.performanceId);
      const firstTeam = data.teams.find((team) => team.id === firstSong.teamId);
      const secondTeam = data.teams.find((team) => team.id === secondSong.teamId);
      conflicts.push({
        first: { ...first, performanceTitle: firstPerformance?.title ?? "공연 없음", songTitle: firstSong.title, teamName: firstTeam?.name ?? "팀 없음" },
        second: { ...second, performanceTitle: secondPerformance?.title ?? "공연 없음", songTitle: secondSong.title, teamName: secondTeam?.name ?? "팀 없음" },
        startsAt: first.startsAt > second.startsAt ? first.startsAt : second.startsAt,
        endsAt: first.endsAt < second.endsAt ? first.endsAt : second.endsAt,
        sharedMemberCount: getSharedMemberCount(first.songId, second.songId, data),
      });
    });
  });

  return conflicts.sort((a, b) => b.sharedMemberCount - a.sharedMemberCount || a.startsAt.localeCompare(b.startsAt));
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

export function getSurveyHeatmap(survey: ScheduleSurvey, data: AppData) {
  const responses = data.availabilityResponses.filter((response) => response.surveyId === survey.id);
  const counts = new Map<string, number>();
  responses.forEach((response) => {
    response.slots.forEach((slot) => {
      if (!slot.available) return;
      counts.set(slotKey(slot.date, slot.time), (counts.get(slotKey(slot.date, slot.time)) ?? 0) + 1);
    });
  });
  return { counts, totalResponses: responses.length };
}

export function getSurveyRecommendations(survey: ScheduleSurvey, data: AppData, durationMinutes = 60) {
  const dates = getDateRange(survey.startDate, survey.endDate);
  const times = getSurveyTimes(survey);
  const { counts, totalResponses } = getSurveyHeatmap(survey, data);
  const slotCount = Math.max(1, Math.ceil(durationMinutes / survey.slotMinutes));
  const recommendations: Array<{ date: string; start: string; end: string; count: number; total: number }> = [];

  dates.forEach((date) => {
    for (let index = 0; index <= times.length - slotCount; index += 1) {
      const window = times.slice(index, index + slotCount);
      const count = Math.min(...window.map((time) => counts.get(slotKey(date, time)) ?? 0));
      if (count > 0) {
        recommendations.push({
          date,
          start: window[0],
          end: minutesToTime(timeToMinutes(window[0]) + durationMinutes),
          count,
          total: totalResponses,
        });
      }
    }
  });

  return recommendations.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export function getRequestAvailability(survey: ScheduleSurvey, data: AppData, date: string, start: string, end: string) {
  const requestedTimes = getSurveyTimes(survey).filter((time) => time >= start && time < end);
  const responses = data.availabilityResponses.filter((response) => response.surveyId === survey.id);
  const availableCount = responses.filter((response) => requestedTimes.length > 0 && requestedTimes.every((time) => response.slots.some((slot) => slot.date === date && slot.time === time && slot.available))).length;
  return { count: availableCount, total: responses.length };
}

function getSongUserIds(songId: string, data: AppData) {
  return data.songMembers.filter((member) => member.songId === songId).map((member) => member.userId);
}

function getSharedMemberCount(firstSongId: string, secondSongId: string, data: AppData) {
  const first = new Set(getSongUserIds(firstSongId, data));
  return getSongUserIds(secondSongId, data).filter((userId) => first.has(userId)).length;
}
