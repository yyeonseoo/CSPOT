// 실행: npx tsx lib/schedule.check.ts
import assert from "node:assert/strict";
import { availabilitySegments, findPracticeConflicts, slotsCovering, getAvailableUserIds, slotsToBlocks, timesBetween } from "./schedule";
import type { AppData, PracticeCandidate, ScheduleSurvey } from "../types/domain";
import { diffData, rowsToData } from "./remote-data";

const dates = ["2026-10-05", "2026-10-06"];
const times = ["18:00", "18:30", "19:00", "19:30"];
const selected = new Set(["2026-10-05_18:00", "2026-10-05_18:30", "2026-10-05_19:30", "2026-10-06_19:00", "2026-10-06_19:30"]);

// 이어진 칸은 연습 1회, 끊기면 따로, 날짜가 바뀌면 따로
assert.deepEqual(slotsToBlocks(selected, dates, times, 30).map((block) => `${block.date} ${block.start}-${block.end}`), [
  "2026-10-05 18:00-19:00",
  "2026-10-05 19:30-20:00",
  "2026-10-06 19:00-20:00",
]);
assert.deepEqual(timesBetween("18:00", "19:30", 30), ["18:00", "18:30", "19:00"]);

// 연습 시간 전체에 가능한 곡 팀원만 참여 가능 인원으로 센다
const survey = { id: "s1", slotMinutes: 30 } as ScheduleSurvey;
const slot = (time: string, available: boolean) => ({ date: "2026-10-05", time, available });
const data = {
  availabilityResponses: [
    { surveyId: "s1", userId: "a", slots: [slot("18:00", true), slot("18:30", true)] },
    { surveyId: "s1", userId: "b", slots: [slot("18:00", true), slot("18:30", false)] },
    { surveyId: "s1", userId: "outsider", slots: [slot("18:00", true), slot("18:30", true)] },
    { surveyId: "other", userId: "c", slots: [slot("18:00", true), slot("18:30", true)] },
  ],
} as AppData;
assert.deepEqual(getAvailableUserIds(survey, data, ["a", "b", "c"], "2026-10-05", ["18:00", "18:30"]), ["a"]);
assert.deepEqual(getAvailableUserIds(survey, data, ["a", "b", "c"], "2026-10-05", []), []);

// 시간대별로 가능한 인원이 바뀌면 구간을 나눈다: 18:00-18:30 a,b / 18:30-19:00 a
assert.deepEqual(availabilitySegments(survey, data, ["a", "b"], "2026-10-05", ["18:00", "18:30"]), [
  { start: "18:00", end: "18:30", userIds: ["a", "b"] },
  { start: "18:30", end: "19:00", userIds: ["a"] },
]);

// 시간이 겹칠 때: 같은 장소(외부 대관 제외)나 겹치는 인원이 있으면 충돌, 둘 다 아니면 동시 연습 가능
const request = (id: string, songId: string, startsAt: string, endsAt: string, location: string) => ({ id, songId, startsAt, endsAt, location, status: "PENDING" }) as PracticeCandidate;
const conflictData = { songMembers: [{ songId: "x", userId: "a" }, { songId: "y", userId: "a" }, { songId: "z", userId: "b" }] } as AppData;
const x = request("1", "x", "T18", "T20", "수련관");
const others = [
  request("2", "y", "T19", "T21", "외부 대관"), // 장소 다르지만 a가 겹침 -> 충돌
  request("3", "z", "T19", "T21", "수련관"), // 같은 수련관 -> 충돌
  request("4", "z", "T19", "T21", "외부 대관"), // 장소도 사람도 안 겹침 -> 가능
  request("5", "y", "T20", "T22", "수련관"), // 시간이 맞닿기만 함 -> 가능
];
assert.deepEqual(findPracticeConflicts(x, others, conflictData).map((c) => [c.other.id, c.sameLocation, c.sharedUserIds]), [["2", false, ["a"]], ["3", true, []]]);

// 10분 단위 시간은 걸치는 30분 칸을 모두 본다: 19:10-20:20 -> 19:00, 19:30, 20:00
const slotSurvey = { timeStart: "18:00", timeEnd: "22:00", slotMinutes: 30 } as ScheduleSurvey;
assert.deepEqual(slotsCovering(slotSurvey, "19:10", "20:20"), ["19:00", "19:30", "20:00"]);
assert.deepEqual(slotsCovering(slotSurvey, "19:00", "20:00"), ["19:00", "19:30"]);

// DB 저장: 바뀐 항목만 올리고, 없어진 항목만 지운다
const before = rowsToData([
  { collection: "notices", id: "n1", data: { id: "n1", title: "a" } },
  { collection: "notices", id: "n2", data: { id: "n2", title: "b" } },
]);
const after = { ...before, notices: [{ id: "n1", title: "a" }, { id: "n3", title: "c" }] } as unknown as AppData;
const diff = diffData(before, after);
assert.deepEqual(diff.upserts.map((row) => row.id), ["n3"]);
assert.deepEqual(diff.deletes, [{ collection: "notices", id: "n2" }]);

console.log("schedule checks passed");
