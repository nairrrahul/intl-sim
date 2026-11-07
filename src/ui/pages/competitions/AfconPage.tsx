import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function AfconPage() {
  const editions = useGame().world.international.afcon.editions;
  return (
    <InternationalCupPage
      competition="afcon"
      title="AFCON"
      subtitle="Africa Cup of Nations"
      editions={editions}
      afconHighlights
      nthPlaceAdvancement={{ place: 3, advancingCount: 4 }}
    />
  );
}
