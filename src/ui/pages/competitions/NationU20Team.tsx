import { useState } from "react";
import { NationMatches } from "./NationMatches";
import NationSquad from "./NationSquad";
import { Tabs } from "../../components/common";

type U20Tab = "squad" | "schedule";

/** A nation's U20 team: its starting XI and substitutes, and its own schedule (kept apart from the senior match history). */
export default function NationU20Team(props: { code: string }) {
  const [tab, setTab] = useState<U20Tab>("squad");
  return (
    <div>
      <Tabs
        tabs={[
          { id: "squad", label: "Starting XI" },
          { id: "schedule", label: "Schedule" }
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "squad" ? <NationSquad code={props.code} team="u20" /> : <NationMatches code={props.code} team="u20" />}
    </div>
  );
}
