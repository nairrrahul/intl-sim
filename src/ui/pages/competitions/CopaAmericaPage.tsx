import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function CopaAmericaPage() {
  const editions = useGame().world.international.copaAmerica.editions;
  return (
    <InternationalCupPage
      title="Copa América"
      subtitle=""
      editions={editions}
    />
  );
}
