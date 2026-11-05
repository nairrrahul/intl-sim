import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function OfcCupPage() {
  const editions = useGame().world.international.ofcCup.editions;
  return <InternationalCupPage title="OFC Cup" subtitle="OFC Cup" editions={editions} />;
}
