import { useState } from "react";
import { useGame } from "../../../store/gameStore";
import { seasonDisplay } from "../../../engine/config";
import { getU20QualifyingStandings } from "../../../engine/international/competitions/u20Qualifying";
import type {
  U20QualifyingConfederation, U20QualifyingEdition, U20QualifyingTie
} from "../../../engine/international/competitions/u20Qualifying";
import type { InternationalMatch } from "../../../engine/international/types";
import { Empty, NationLink, PageHeader, Panel, SeasonSelect, Tabs } from "../../components/common";
import { CupBracketTree, EuroTieCard } from "../../components/brackets";
import { InternationalGroupMatchdays } from "../../components/InternationalGroupMatchdays";
import { InternationalGroupTable, InternationalNthPlacedTeamsTable } from "../../components/tables";
import { ROW_HIGHLIGHT } from "../../styles";
import type { RowHighlights } from "../../styles";
import type { CupMatchSnap, CupSnap, EuroRoundSnap, EuroTieSnap, ScoreSnap, TeamRef } from "../../bracketTypes";

type Tab = "CONCACAF" | "CONMEBOL" | "OFC" | "AFC" | "UEFA" | "CAF" | "ICPO" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "CONCACAF", label: "CONCACAF" },
  { id: "CONMEBOL", label: "CONMEBOL" },
  { id: "OFC", label: "OFC" },
  { id: "AFC", label: "AFC" },
  { id: "UEFA", label: "UEFA" },
  { id: "CAF", label: "CAF" },
  { id: "ICPO", label: "Intercontinental Playoff" },
  { id: "history", label: "History" }
];

const teamRef = (code: string, id: number): TeamRef => ({ id, name: code, countrycode: code });
const isPlayed = (match: InternationalMatch) => match.homeGoals !== null && match.awayGoals !== null;
const scored = (kicks?: string[]) => (kicks ?? []).filter(kick => kick === "O").length;

function toTieSnap(tie: U20QualifyingTie): EuroTieSnap {
  const team1 = teamRef(tie.team1, 1);
  const team2 = teamRef(tie.team2, 2);
  const { firstLeg, secondLeg } = tie;
  const bothPlayed = isPlayed(firstLeg) && isPlayed(secondLeg);
  const shootout = secondLeg.homePenalties && secondLeg.awayPenalties;
  return {
    id: tie.id,
    fixtures: [firstLeg, secondLeg],
    home: team1,
    away: team2,
    bye: false,
    // The second leg is shown from team 1's side (it is the away team there).
    legs: [
      ...(isPlayed(firstLeg) ? [{ matchday: 1, score: { h: firstLeg.homeGoals!, a: firstLeg.awayGoals! } }] : []),
      ...(isPlayed(secondLeg) ? [{ matchday: 2, score: { h: secondLeg.awayGoals!, a: secondLeg.homeGoals! } }] : [])
    ],
    aggregate: bothPlayed
      ? { h: firstLeg.homeGoals! + secondLeg.awayGoals!, a: firstLeg.awayGoals! + secondLeg.homeGoals! }
      : null,
    tiebreak: shootout ? { h: 0, a: 0, ph: scored(secondLeg.awayPenalties), pa: scored(secondLeg.homePenalties) } : null,
    winner: tie.winner ? (tie.winner === tie.team1 ? team1 : team2) : null
  };
}

function TiesPanel(props: { title: string; ties: U20QualifyingTie[] }) {
  const round: EuroRoundSnap = { key: "ties", label: props.title, matchdays: [1, 2], ties: props.ties.map(toTieSnap) };
  return (
    <Panel title={props.title}>
      <div className="flex flex-wrap justify-center gap-6 p-3">
        {round.ties.map(tie => <EuroTieCard key={tie.id} tie={tie} round={round} />)}
      </div>
    </Panel>
  );
}

function ConmebolKnockoutView(props: { confederation: U20QualifyingConfederation }) {
  const { confederation } = props;
  const refs = new Map<string, TeamRef>();

  const ref = (code: string): TeamRef => {
    if (!refs.has(code)) {
      refs.set(code, teamRef(code, refs.size + 1));
    }
    return refs.get(code)!;
  };

  const score = (match: InternationalMatch): ScoreSnap | null => {
    if (!isPlayed(match)) return null;

    return {
      h: match.homeGoals!,
      a: match.awayGoals!,
      ...(match.homePenalties && match.awayPenalties
        ? {
            ph: scored(match.homePenalties),
            pa: scored(match.awayPenalties)
          }
        : {})
    };
  };

  const final = confederation.knockout.find(round => round.label === "Final")?.matches[0];
  const winner = final?.winner ?? null;
  const runnerUp = winner
    ? winner === final!.home ? final!.away : final!.home
    : null;

  const cup: CupSnap = {
    complete: Boolean(winner),
    winner: winner ? ref(winner) : null,
    runnerUp: runnerUp ? ref(runnerUp) : null,
    rounds: confederation.knockout.map((round, index) => ({
      round: index + 1,
      label: round.label,
      matchday: index + 1,
      matches: round.matches.map((match): CupMatchSnap => ({
        id: match.id,
        home: ref(match.home),
        away: ref(match.away),
        score: score(match.fixture),
        winner: match.winner ? ref(match.winner) : null,
        bye: false,
        fixture: match.fixture
      }))
    }))
  };

  return (
    <Panel title="CONMEBOL knockout">
      <div className="p-3">
        <CupBracketTree cup={cup} />
      </div>
    </Panel>
  );
}

function ConfederationView(props: { confederation: U20QualifyingConfederation }) {
  const { confederation } = props;
  const tables = confederation.groups.map(group => ({ group, rows: getU20QualifyingStandings(group) }));
  const sendsRunnerUp = ["CONCACAF", "AFC", "CAF"].includes(confederation.confederation);
  // Winners qualify (green); where the best runner-up goes to the playoff, runners-up are yellow.
  const groupHighlights: RowHighlights = { 1: ROW_HIGHLIGHT.GREEN };
  if (sendsRunnerUp) groupHighlights[2] = ROW_HIGHLIGHT.YELLOW;

  return (
    <div className="space-y-5">
      {confederation.autoQualified.length > 0 && (
        <Panel title="Automatically qualified">
          <div className="flex flex-wrap gap-x-4 gap-y-2 p-3">
            {confederation.autoQualified.map(code => <NationLink key={code} code={code} />)}
          </div>
        </Panel>
      )}
      {confederation.confederation === "CONMEBOL" && (
        <ConmebolKnockoutView confederation={confederation} />
      )}
      {tables.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {tables.map(({ group, rows }) => (
            <Panel key={group.name} title={`Group ${group.name}`}>
              <InternationalGroupTable rows={rows} highlights={groupHighlights} />
              <InternationalGroupMatchdays rounds={group.matches} />
            </Panel>
          ))}
        </div>
      )}
      {sendsRunnerUp && tables.length > 0 && (
        <InternationalNthPlacedTeamsTable
          place={2}
          advancingCount={1}
          seedRanks={{}}
          tieBreakers={["goalsFor", "goalDifference"]}
          rows={tables.map(({ group, rows }) => ({ ...rows[1], group: group.name }))}
        />
      )}
      {confederation.ties.length > 0 && (
        <TiesPanel title={confederation.confederation === "OFC" ? "Home-and-away series" : "4th v 5th play-off"} ties={confederation.ties} />
      )}
      <Panel title={`Qualified for the U20 World Cup · ${confederation.qualified.length}`}>
        {confederation.qualified.length === 0 ? <Empty>No team has qualified yet.</Empty> : (
          <div className="flex flex-wrap gap-x-4 gap-y-2 p-3">
            {confederation.qualified.map(code => <NationLink key={code} code={code} />)}
          </div>
        )}
        {confederation.playoffTeam && (
          <p className="px-3 pb-3 text-sm text-navy-300">
            Goes to the intercontinental playoff: <NationLink code={confederation.playoffTeam} />
          </p>
        )}
      </Panel>
    </div>
  );
}

function PlayoffView(props: { edition: U20QualifyingEdition }) {
  const { edition } = props;
  if (!edition.playoff) {
    return <Panel><Empty>The playoff is drawn once every confederation has finished its qualifiers (November window).</Empty></Panel>;
  }
  const refs = new Map<string, TeamRef>();
  const ref = (code: string) => refs.get(code) ?? refs.set(code, teamRef(code, refs.size + 1)).get(code) as TeamRef;
  const score = (match: InternationalMatch): ScoreSnap | null => isPlayed(match)
    ? { h: match.homeGoals!, a: match.awayGoals!, ...(match.homePenalties && match.awayPenalties ? { ph: scored(match.homePenalties), pa: scored(match.awayPenalties) } : {}) }
    : null;
  const cup: CupSnap = {
    complete: edition.completed,
    winner: edition.completed ? ref(edition.qualified[edition.qualified.length - 1]) : null,
    runnerUp: null,
    rounds: edition.playoff.map((round, index) => ({
      round: index + 1,
      label: round.label,
      matchday: index + 1,
      matches: round.matches.map((match): CupMatchSnap => ({
        id: match.id, home: ref(match.home), away: ref(match.away), score: score(match.fixture),
        winner: match.winner ? ref(match.winner) : null, bye: false, fixture: match.fixture
      }))
    }))
  };
  return (
    <Panel title="Intercontinental playoff">
      <div className="p-3"><CupBracketTree cup={cup} /></div>
    </Panel>
  );
}

function HistoryView(props: { editions: U20QualifyingEdition[]; onSelect: (year: number) => void }) {
  if (props.editions.length === 0) return <Panel><Empty>No U20 World Cup qualifying has been played yet.</Empty></Panel>;
  return (
    <Panel title="U20 World Cup qualifying history">
      <table className="tbl">
        <thead><tr><th>Season</th><th>Status</th><th className="num">Qualified</th><th></th></tr></thead>
        <tbody>
          {[...props.editions].sort((a, b) => b.year - a.year).map(edition => (
            <tr key={edition.id}>
              <td className="font-semibold">{seasonDisplay(edition.year)}</td>
              <td>{edition.completed ? "Complete" : "In progress"}</td>
              <td className="num">{edition.completed ? edition.qualified.length : "–"}</td>
              <td className="text-right"><button className="btn-ghost btn-sm" onClick={() => props.onSelect(edition.year)}>View edition</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export default function U20WorldCupQualifiersPage() {
  const editions = useGame().world.international.u20Qualifying.editions;
  const [tab, setTab] = useState<Tab>("UEFA");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const latest = editions[editions.length - 1] ?? null;
  const selected = editions.find(edition => edition.year === selectedYear) ?? latest;
  const years = editions.map(edition => edition.year);

  return (
    <div>
      <PageHeader
        title="U20 World Cup Qualifiers"
        subtitle={selected ? `${seasonDisplay(selected.year)} · ${selected.completed ? "24 teams qualified" : "September to November windows"}` : "Played in the three windows before the tournament"}
        right={years.length > 1 ? <SeasonSelect years={years.map(year => ({ year, label: seasonDisplay(year) }))} value={selected?.year ?? years[0]} onChange={setSelectedYear} /> : undefined}
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "history" && <HistoryView editions={editions} onSelect={year => { setSelectedYear(year); setTab("UEFA"); }} />}
      {tab !== "history" && (!selected
        ? <Panel><Empty>U20 World Cup qualifying has not started yet. It begins in the September window of a tournament season.</Empty></Panel>
        : tab === "ICPO"
          ? <PlayoffView edition={selected} />
          : <ConfederationView key={`${selected.id}-${tab}`} confederation={selected.confederations[tab]} />
      )}
    </div>
  );
}