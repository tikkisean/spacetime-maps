import { Map, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

function getStyle(theme: string): StyleSpecification {
	return {
		layers: [
			{
				id: "roads",
				paint: {
					"line-color": (
						theme !== "system"
							? theme === "dark"
							: window.matchMedia("(prefers-color-scheme: dark)").matches
					)
						? "#AAA"
						: "#555",
					"line-width": 0.75,
				},
				source: "osm",
				"source-layer": "roads",
				type: "line",
			},
		],
		sources: {
			osm: {
				tiles: [
					"https://tiles.maps.seaneddy.com/arizona/tiles/{z}/{x}/{y}.pbf",
				],
				type: "vector",
			},
		},
		version: 8,
	};
}

export default function MapComponent() {
	const mapContainer = useRef<HTMLDivElement>(null);
	const mapRef = useRef<Map | null>(null);
	const { theme } = useTheme();

	useEffect(() => {
		if (!mapContainer.current) return;

		const map = new Map({
			attributionControl: false,
			center: [-110.926389, 32.221667],
			container: mapContainer.current,
			maxZoom: 12,
			minZoom: 12,
			pitch: 30,
			style: getStyle(theme),
			zoom: 12,
		});
		mapRef.current = map;

		return () => {
			map.remove();
		};
	}, []);

	useEffect(() => {
		if (mapRef.current) {
			mapRef.current.setStyle(getStyle(theme));
		}
	}, [theme]);

	return <div className="flex-1" ref={mapContainer} />;
}
