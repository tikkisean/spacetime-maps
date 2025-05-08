import MapComponent from "./components/Map";
import { ModeToggle } from "./components/ModeToggle";
import { ThemeProvider } from "./components/ThemeProvider";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Github } from "lucide-react";
import { useState } from "react";

export default function App() {
	const [showPoints, setShowPoints] = useState(true);
	const [shouldWarp, setShouldWarp] = useState(true);
	const [mode, setMode] = useState("auto");

	return (
		<ThemeProvider>
			<div className="flex flex-col h-screen w-full">
				<header className="flex items-center justify-between p-4">
					<h1>Spacetime Maps</h1>
					<div className="flex gap-4 items-center">
						<div className="flex items-center gap-2">
							<Checkbox
								checked={showPoints}
								onCheckedChange={(v) => setShowPoints(Boolean(v))}
							/>
							<span>Points</span>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								checked={shouldWarp}
								onCheckedChange={(v) => setShouldWarp(Boolean(v))}
							/>
							<span>Warp</span>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">
									{mode === "auto" ? "Automobile" : "Bicycle"}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-56">
								<DropdownMenuItem onClick={() => setMode("auto")}>
									Automobile
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setMode("bicycle")}>
									Bicycle
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Button asChild variant="outline" size="icon">
							<a
								href="https://github.com/tikkisean/spacetime-maps"
								rel="noopener noreferrer"
								target="_blank"
							>
								<Github />
							</a>
						</Button>
						<ModeToggle />
					</div>
				</header>
				<MapComponent
					showPoints={showPoints}
					shouldWarp={shouldWarp}
					mode={mode}
				/>
			</div>
		</ThemeProvider>
	);
}
