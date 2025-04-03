import MapComponent from "./components/Map";
import { ModeToggle } from "./components/ModeToggle";
import { ThemeProvider } from "./components/ThemeProvider";
import { Button } from "./components/ui/button";
import { Github } from "lucide-react";

export default function App() {
	return (
		<ThemeProvider>
			<div className="flex flex-col h-screen w-full">
				<header className="flex items-center justify-between p-4">
					<h1>Spacetime Maps</h1>
					<div className="flex gap-4 items-center">
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
				<MapComponent />
			</div>
		</ThemeProvider>
	);
}
