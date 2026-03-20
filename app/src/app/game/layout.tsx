import { GameProvider } from "@/lib/store/game-context";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}
