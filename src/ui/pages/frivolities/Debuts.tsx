import { useGameStore } from "../../../store/gameStore";
import historicalDebutsRaw from "../../../engine/international/data/debuts.json";
import { NationTag, PageHeader, Panel, Empty } from "../../components/common";

type HistoricalDebuts = Record<string, Record<string, number>>;

interface DebutRow {
  year: string;
  nations: string[];
  none: boolean;
}

interface CompetitionDefinition {
  id: string;
  title: string;
  historicalKey?: string;
  historical?: Record<string, number>;
  editions: {
    year: number;
    teams: string[];
  }[];
}

const historicalDebuts = historicalDebutsRaw as HistoricalDebuts;

function buildHistoricalRows(
  debutData: Record<string, number> | undefined
): DebutRow[] {
  if (!debutData) return [];

  const years = new Map<number, string[]>();

  for (const [code, year] of Object.entries(debutData)) {
    const nations = years.get(year) ?? [];
    nations.push(code);
    years.set(year, nations);
  }

  return [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, nations]) => ({
      year: String(year),
      nations: nations.sort(),
      none: false
    }));
}

/**
 * Finds the nations appearing in a simulated edition for the first time.
 * Historical debut years are used to prevent existing nations from being
 * incorrectly classified as new simulated debutants.
 */
function buildSimulatedRows(
  editions: CompetitionDefinition["editions"],
  historical: Record<string, number> | undefined
): DebutRow[] {
  const ordered = [...editions].sort((a, b) => a.year - b.year);

  const previouslySeen = new Set<string>();

  // Historical debutants have already appeared in this competition.
  for (const code of Object.keys(historical ?? {})) {
    previouslySeen.add(code);
  }

  const rows: DebutRow[] = [];

  for (const edition of ordered) {
    const debutants = edition.teams
      .filter(code => !previouslySeen.has(code))
      .sort();

    // Record every participant, including debutants, before the next edition.
    for (const code of edition.teams) {
      previouslySeen.add(code);
    }

    rows.push({
      year: String(edition.year),
      nations: debutants,
      none: debutants.length === 0
    });
  }

  // Merge consecutive editions without debutants into a single row.
  const merged: DebutRow[] = [];

  for (const row of rows) {
    const previous = merged.at(-1);

    if (row.none && previous?.none) {
      previous.year = `${previous.year.split("-")[0]}-${row.year}`;
    } else {
      merged.push({ ...row });
    }
  }

  return merged;
}

function DebutTable(props: {
  competition: CompetitionDefinition;
}) {
  const historical = buildHistoricalRows(props.competition.historical);

  const simulated = buildSimulatedRows(
    props.competition.editions,
    props.competition.historical
  );

  const rows = [...historical, ...simulated];

  return (
    <Panel title={props.competition.title}>
      {rows.length === 0 ? (
        <Empty>No debut records available.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-28">Year</th>
                <th>Debutants</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.year}-${index}`}>
                  <td className="font-semibold tabular-nums">
                    {row.year}
                  </td>
                  <td>
                    {row.none ? (
                      <span className="italic text-navy-300">
                        None
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {row.nations.map(code => (
                          <NationTag
                            key={code}
                            code={code}
                            label="name"
                          />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function Debuts() {
  const game = useGameStore(state => state.game);
  useGameStore(state => state.tick);

  if (!game) return null;

  const intl = game.world.international;

  const competitions: CompetitionDefinition[] = [
    {
      id: "worldCup",
      title: "World Cup",
      historical: historicalDebuts.WC,
      editions: intl.worldCup.editions.flatMap(edition =>
        edition.tournament
          ? [{
              year: edition.tournament.year,
              teams: edition.tournament.teams
            }]
          : []
      )
    },
    {
      id: "euro",
      title: "EURO",
      historical: historicalDebuts.EURO,
      editions: intl.euro.editions
    },
    {
      id: "copaAmerica",
      title: "Copa América",
      historical: historicalDebuts.COPA,
      editions: intl.copaAmerica.editions
    },
    {
      id: "goldCup",
      title: "Gold Cup",
      historical: historicalDebuts.GC,
      editions: intl.goldCup.editions
    },
    {
      id: "afcon",
      title: "AFCON",
      historical: historicalDebuts.AFCON,
      editions: intl.afcon.editions
    },
    {
      id: "afcCup",
      title: "Asian Cup",
      historical: historicalDebuts.AFCCUP,
      editions: intl.afcCup.editions
    },
    {
      id: "ofcCup",
      title: "OFC Nations Cup",
      historical: historicalDebuts.OFCCUP,
      editions: intl.ofcCup.editions
    },
    {
      id: "confedCup",
      title: "Confederations Cup",
      editions: intl.confedCup.editions
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tournament Debuts"
        subtitle="Nations making their first appearance in each tournament."
      />

      {competitions.map(competition => (
        <DebutTable
          key={competition.id}
          competition={competition}
        />
      ))}
    </div>
  );
}
