import { ROW_HIGHLIGHT } from "../../styles";
import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function EuroPage() {
  const editions = useGame().world.international.euro.editions;
  return (
    <InternationalCupPage
      competition="euro"
      title="UEFA EURO"
      subtitle="UEFA European Championship"
      editions={editions}
      groupHighlights={{ 1: ROW_HIGHLIGHT.GREEN, 2: ROW_HIGHLIGHT.GREEN, 3: ROW_HIGHLIGHT.YELLOW }}
      nthPlaceAdvancement={{ place: 3, advancingCount: 4 }}
    />
  );
}
