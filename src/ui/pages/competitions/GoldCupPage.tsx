import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function GoldCupPage() {
  const editions = useGame().world.international.goldCup.editions;
  return (
    <InternationalCupPage
      competition="goldCup"
      title="Gold Cup"
      subtitle=""
      editions={editions}
    />
  );
}
