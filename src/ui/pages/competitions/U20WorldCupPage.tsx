import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function U20WorldCupPage() {
  const editions = useGame().world.international.u20WorldCup.editions;
  return <InternationalCupPage
      competition="u20WorldCup" title="U20 World Cup" subtitle="" editions={editions}
      afconHighlights
      groupQualifiedByConfederation
      nthPlaceAdvancement={{ place: 3, advancingCount: 4 }}
    />;
}
