import { useState } from "react";
import { getDateRange, makeLocalIso, nowIso } from "@/lib/format";
import { candidateBlock, findPracticeConflicts, getSongUserIds, getSurveyHeatmap, getSurveyTimes, slotKey, slotsToBlocks, surveyLabel, surveySongIds, surveyUserIds, timesBetween } from "@/lib/schedule";
import { uid } from "@/lib/utils";
import type { AppData, AvailabilityResponse, ClubUser, PracticeCandidate, ScheduleSurvey, Song } from "@/types/domain";
import { DayTimeline, describeConflict, RequestGrid, songTitleOf, surveyRequests } from "@/components/practice-overview";
import { AvailabilityBreakdown, AvailabilityGrid, formatSlotDate, LocationField } from "@/components/slot-grid";
import { Panel, PrimaryButton, Select } from "@/components/ui";

type PanelProps = { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void };

const statusLabels = { PENDING: "확정 대기", APPROVED: "확정", REJECTED: "반려" };

function useSurveyChoice(surveys: ScheduleSurvey[]) {
  const [surveyId, setSurveyId] = useState(() => surveys[0]?.id ?? "");
  return [surveys.find((item) => item.id === surveyId) ?? surveys[0], setSurveyId] as const;
}

function SurveyPicker({ surveys, survey, onChange }: { surveys: ScheduleSurvey[]; survey: ScheduleSurvey; onChange: (id: string) => void }) {
  if (surveys.length < 2) return null;
  return (
    <Panel title="조사 선택">
      <Select label="조사" value={survey.id} onChange={onChange} options={surveys.map((item) => [item.id, surveyLabel(item)])} />
    </Panel>
  );
}

// 팀원 탭: 나를 대상으로 한 조사에 가능 시간 응답
export function SurveyPanel({ data, currentUser, persist }: PanelProps) {
  // 팀원에게는 진행 중인 조사만 보인다. 마감된 조사는 관리자 화면에서만 본다.
  const mySurveys = data.surveys.filter((item) => item.status === "OPEN" && surveyUserIds(item, data).includes(currentUser.id)).reverse();
  const [survey, setSurveyId] = useSurveyChoice(mySurveys);

  if (!survey) return <Panel title="연습 일정 조사"><p className="text-sm text-muted-foreground">진행 중인 조사가 없습니다.</p></Panel>;

  return (
    <section className="space-y-4">
      <SurveyPicker surveys={mySurveys} survey={survey} onChange={setSurveyId} />
      <MyAvailabilityPanel key={survey.id} survey={survey} data={data} currentUser={currentUser} persist={persist} />
    </section>
  );
}

// 곡팀장 탭: 내가 팀장인 곡이 들어 있는 조사에서 희망 시간 전송, 겹침 현황 확인
export function LeaderPanel({ data, currentUser, persist }: PanelProps) {
  const myLeaderSongIds = data.songs.filter((item) => item.leaderUserId === currentUser.id).map((item) => item.id);
  const leaderSurveys = data.surveys.filter((item) => item.status === "OPEN" && surveySongIds(item, data).some((songId) => myLeaderSongIds.includes(songId))).reverse();
  const [survey, setSurveyId] = useSurveyChoice(leaderSurveys);
  const [songId, setSongId] = useState("");

  if (!survey) return <Panel title="곡팀장"><p className="text-sm text-muted-foreground">내 곡이 포함된 진행 중인 조사가 없습니다.</p></Panel>;

  const songIds = surveySongIds(survey, data);
  const leaderSongs = data.songs.filter((item) => myLeaderSongIds.includes(item.id) && songIds.includes(item.id));
  const song = leaderSongs.find((item) => item.id === songId) ?? leaderSongs[0];

  return (
    <section className="space-y-4">
      <SurveyPicker surveys={leaderSurveys} survey={survey} onChange={setSurveyId} />
      {song && (
        <Panel title="희망 연습 시간 보내기">
          <div className="space-y-4">
            {leaderSongs.length > 1 && <Select label="팀장인 곡" value={song.id} onChange={setSongId} options={leaderSongs.map((item) => [item.id, item.title])} />}
            <LeaderRequestForm key={`${survey.id}-${song.id}`} survey={survey} song={song} data={data} currentUser={currentUser} persist={persist} />
          </div>
        </Panel>
      )}
      <OverlapOverview key={`overlap-${survey.id}`} survey={survey} data={data} leaderSongIds={leaderSongs.map((item) => item.id)} />
    </section>
  );
}

// 곡팀장용 겹침 현황: 관리자가 보는 표를 보기 전용으로 보여주고, 내 곡 요청이 무엇과 겹치는지 적는다. 확정은 관리자만 한다.
function OverlapOverview({ survey, data, leaderSongIds }: { survey: ScheduleSurvey; data: AppData; leaderSongIds: string[] }) {
  const requests = surveyRequests(survey, data);
  const mine = requests.filter((request) => leaderSongIds.includes(request.songId));
  if (requests.length === 0) return null;
  return (
    <Panel title="겹침 현황">
      <div className="space-y-4">
        {mine.map((request) => {
          const conflicts = findPracticeConflicts(request, requests, data);
          if (conflicts.length === 0) return null;
          const block = candidateBlock(request);
          return (
            <div key={request.id} className="rounded-xl bg-orange-50 p-3 text-sm dark:bg-orange-500/10">
              <p className="font-semibold">{songTitleOf(data, request.songId)} <span className="ml-1 font-medium text-muted-foreground">{formatSlotDate(block.date)} {block.start}~{block.end}</span></p>
              {conflicts.map((conflict) => <p key={conflict.other.id} className="text-orange-700 dark:text-orange-300">{describeConflict(data, request, conflict)}</p>)}
            </div>
          );
        })}
        <RequestGrid survey={survey} data={data} requests={requests} />
        <DayTimeline survey={survey} data={data} requests={requests} highlightSongIds={leaderSongIds} />
      </div>
    </Panel>
  );
}

function MyAvailabilityPanel({ survey, data, currentUser, persist }: PanelProps & { survey: ScheduleSurvey }) {
  const dates = getDateRange(survey.startDate, survey.endDate);
  const times = getSurveyTimes(survey);
  const saved = data.availabilityResponses.find((response) => response.surveyId === survey.id && response.userId === currentUser.id);
  const [selected, setSelected] = useState(() => new Set(saved?.slots.filter((slot) => slot.available).map((slot) => slotKey(slot.date, slot.time))));
  const [message, setMessage] = useState("");
  const open = survey.status === "OPEN";

  function save() {
    const submittedAt = nowIso();
    const slots = dates.flatMap((date) => times.map((time) => ({ date, time, available: selected.has(slotKey(date, time)) })));
    const response: AvailabilityResponse = { id: saved?.id ?? uid("availability"), surveyId: survey.id, userId: currentUser.id, slots, submittedAt: saved?.submittedAt ?? submittedAt, updatedAt: submittedAt };
    persist({ ...data, availabilityResponses: [...data.availabilityResponses.filter((item) => item !== saved), response] });
    setMessage("저장했습니다.");
  }

  return (
    <Panel title="내 가능 시간">
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{survey.startDate.slice(5).replace("-", ".")} ~ {survey.endDate.slice(5).replace("-", ".")}{!open && " (마감)"}</p>
        <AvailabilityGrid dates={dates} times={times} selected={selected} disabled={!open} onChange={(update) => { setSelected(update); setMessage(""); }} />
        {open && <PrimaryButton onClick={save}>{saved ? "응답 수정" : "응답 저장"}</PrimaryButton>}
        {message && <p className="text-sm font-semibold text-primary">{message}</p>}
      </div>
    </Panel>
  );
}

function LeaderRequestForm({ survey, song, data, currentUser, persist }: PanelProps & { survey: ScheduleSurvey; song: Song }) {
  const dates = getDateRange(survey.startDate, survey.endDate);
  const times = getSurveyTimes(survey);
  const memberIds = getSongUserIds(song.id, data);
  const { counts, respondedCount } = getSurveyHeatmap(survey, data, memberIds);
  const requests = data.practiceCandidates.filter((candidate) => candidate.songId === song.id && candidate.surveyId === survey.id);
  const pending = requests.filter((candidate) => candidate.status === "PENDING");
  const reviewed = requests.filter((candidate) => candidate.status !== "PENDING");
  // 이미 보낸 대기 중 요청을 그대로 불러와서 고쳐 보낼 수 있게 한다.
  const [selected, setSelected] = useState(() => new Set(pending.flatMap((candidate) => {
    const block = candidateBlock(candidate);
    return timesBetween(block.start, block.end, survey.slotMinutes).map((time) => slotKey(block.date, time));
  })));
  const [locations, setLocations] = useState<Record<string, string>>(() => Object.fromEntries(pending.flatMap((candidate) => {
    const block = candidateBlock(candidate);
    return timesBetween(block.start, block.end, survey.slotMinutes).map((time) => [slotKey(block.date, time), candidate.location]);
  })));
  const [message, setMessage] = useState("");
  const blocks = slotsToBlocks(selected, dates, times, survey.slotMinutes);
  // 장소는 블록의 모든 칸에 저장해서, 블록 앞에 칸을 더하거나 두 블록이 이어져도 고른 장소가 남는다.
  const locationOf = (block: { date: string; times: string[] }) => block.times.map((time) => locations[slotKey(block.date, time)]).find((value) => value !== undefined) ?? "수련관";
  const open = survey.status === "OPEN";

  function send() {
    const createdAt = nowIso();
    const next: PracticeCandidate[] = blocks.map((block) => ({
      id: uid("candidate"),
      performanceId: song.performanceId,
      songId: song.id,
      surveyId: survey.id,
      proposedBy: currentUser.id,
      startsAt: makeLocalIso(block.date, block.start),
      endsAt: makeLocalIso(block.date, block.end),
      location: locationOf(block).trim() || "기타",
      status: "PENDING",
      createdAt,
      updatedAt: createdAt,
    }));
    persist({ ...data, practiceCandidates: [...data.practiceCandidates.filter((candidate) => !pending.includes(candidate)), ...next] });
    setMessage(next.length ? `${next.length}건 전송했습니다.` : "전송한 요청을 취소했습니다.");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">{song.title}, 응답 {respondedCount}/{memberIds.length}명</p>
      <AvailabilityGrid dates={dates} times={times} selected={selected} counts={counts} total={memberIds.length} disabled={!open} onChange={(update) => { setSelected(update); setMessage(""); }} />
      {blocks.map((block) => {
        const key = slotKey(block.date, block.start);
        return (
          <div key={key} className="space-y-3 rounded-2xl bg-muted p-4">
            <p className="font-semibold">{formatSlotDate(block.date)} {block.start}~{block.end}</p>
            <AvailabilityBreakdown survey={survey} data={data} memberIds={memberIds} date={block.date} times={block.times} />
            <LocationField value={locationOf(block)} onChange={(value) => setLocations({ ...locations, ...Object.fromEntries(block.times.map((time) => [slotKey(block.date, time), value])) })} />
          </div>
        );
      })}
      {open && <PrimaryButton onClick={send} disabled={blocks.length === 0 && pending.length === 0}>연습 일정 전송{blocks.length > 0 && ` (${blocks.length}건)`}</PrimaryButton>}
      {message && <p className="text-sm font-semibold text-primary">{message}</p>}
      {reviewed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">처리 결과</p>
          {reviewed.map((candidate) => {
            const block = candidateBlock(candidate);
            return <p key={candidate.id} className="rounded-xl bg-muted px-3 py-2 text-sm font-medium">{statusLabels[candidate.status]}: {formatSlotDate(block.date)} {block.start}~{block.end}, {candidate.location}</p>;
          })}
        </div>
      )}
    </div>
  );
}
