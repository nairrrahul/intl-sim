import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function AfcCupPage() {
  const editions = useGame().world.international.afcCup.editions;
  return (
    <InternationalCupPage
      competition="afcCup"
      title="Asian Cup"
      subtitle="Asian Cup"
      editions={editions}
      afconHighlights
      nthPlaceAdvancement={{ place: 3, advancingCount: 4 }}
    />
  );
}
