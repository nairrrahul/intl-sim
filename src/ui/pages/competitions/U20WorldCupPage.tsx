import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function U20WorldCupPage() {
  const editions = useGame().world.international.u20WorldCup.editions;
  return <InternationalCupPage title="U20 World Cup" subtitle="" editions={editions} />;
}
