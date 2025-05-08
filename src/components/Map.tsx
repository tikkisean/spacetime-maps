import { useEffect, useRef, useState } from "react";
import { Map, StyleSpecification } from "maplibre-gl";
import { useSpringSystem } from "@/hooks/useSpringSystem";
import DistortedTileRoads from "./DistortedTileRoads";

interface Props {
	showPoints: boolean;
	shouldWarp: boolean;
}

function makeBaseStyle(): StyleSpecification {
	return {
		version: 8,
		sources: {
			osm: {
				type: "vector",
				tiles: [
					"https://tiles.maps.seaneddy.com/arizona/tiles/{z}/{x}/{y}.pbf",
				],
			},
			points: {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: [],
				},
			},
			springs: {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: [],
				},
			},
		},
		layers: [
			{
				id: "roads",
				type: "line",
				source: "osm",
				"source-layer": "roads",
				paint: {
					"line-color": "#555",
					"line-width": 0.75,
				},
			},
			{
				id: "points",
				type: "circle",
				source: "points",
				paint: {
					"circle-radius": 4,
					"circle-color": "#FF0000",
					"circle-stroke-width": 1,
					"circle-stroke-color": "#fff",
				},
			},
			{
				id: "springs",
				type: "line",
				source: "springs",
				paint: {
					"line-color": [
						"interpolate",
						["linear"],
						["get", "avg_speed_mph"],
						0,
						"#440154",
						10,
						"#3b528b",
						20,
						"#21918c",
						40,
						"#5dc963",
						60,
						"#fde725",
					],
					"line-width": [
						"interpolate",
						["linear"],
						["abs", ["get", "spring_force"]],
						0,
						0.5,
						0.5,
						2.5,
					],
					"line-opacity": 0.8,
				},
			},
		],
	};
}

export default function MapComponent({ showPoints, shouldWarp }: Props) {
	const mapDivRef = useRef<HTMLDivElement>(null);
	const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
	const mapRef = useRef<Map | null>(null);

	const [simPoints, setSimPoints] = useState<[number, number][] | null>(null);

	useEffect(() => {
		if (!mapDivRef.current) return;

		const map = new Map({
			container: mapDivRef.current,
			center: [-110.926389, 32.201667],
			zoom: 12,
			pitch: 0,
			attributionControl: false,
			style: makeBaseStyle(),
		});

		mapRef.current = map;

		map.on("load", () => {
			const resizeCanvas = () => {
				if (overlayCanvasRef.current) {
					overlayCanvasRef.current.width = map.getCanvas().width;
					overlayCanvasRef.current.height = map.getCanvas().height;
				}
			};
			resizeCanvas();
			map.on("resize", resizeCanvas);
		});

		return () => {
			map.remove();
		};
	}, []);

	const [pointsData, setPointsData] =
		useState<GeoJSON.FeatureCollection | null>(null);

	useEffect(() => {
		const loadPoints = async () => {
			try {
				const res = await fetch("/tucson/points.json");
				const pointsArray: [number, number][] = await res.json();
				const features = pointsArray.map(([lat, lon]) => ({
					type: "Feature",
					properties: {},
					geometry: {
						type: "Point",
						coordinates: [lon, lat],
					},
				}));
				setPointsData({
					type: "FeatureCollection",
					features,
				});
			} catch (err) {
				console.error("Failed to load points.json:", err);
			}
		};

		loadPoints();
	}, []);

	const [springsData, setSpringsData] =
		useState<GeoJSON.FeatureCollection | null>(null);

	useEffect(() => {
		const loadSprings = async () => {
			try {
				const res = await fetch("/tucson/weights_bicycle.json");
				const weights = await res.json();

				const pointsRes = await fetch("/tucson/points.json");
				const pointsArray: [number, number][] = await pointsRes.json();

				const features = weights.map((w: any) => ({
					type: "Feature",
					properties: {
						avg_speed_mph: w.avg_speed_mph,
						spring_force: w.spring_force,
						source: w.source,
						target: w.target,
					},
					geometry: {
						type: "LineString",
						coordinates: [
							[pointsArray[w.source][1], pointsArray[w.source][0]],
							[pointsArray[w.target][1], pointsArray[w.target][0]],
						],
					},
				}));

				setSpringsData({
					type: "FeatureCollection",
					features,
				});
			} catch (err) {
				console.error("Failed to load weights_auto.json:", err);
			}
		};

		loadSprings();
	}, []);

	const threshold = 1.5;

	useSpringSystem({
		points:
			pointsData?.features.map((f) => ({
				lon: f.geometry.coordinates[0],
				lat: f.geometry.coordinates[1],
			})) || [],
		edges:
			springsData?.features.map((f) => ({
				source: (f.properties as any).source,
				target: (f.properties as any).target,
				spring_force:
					(f.properties as any).spring_force > threshold
						? threshold
						: (f.properties as any).spring_force < -threshold
						? -threshold
						: (f.properties as any).spring_force,
			})) || [],
		onUpdate: (updatedPoints) => {
			setSimPoints(updatedPoints.map((p) => [p.lat, p.lon]));
		},
		enabled: pointsData !== null && springsData !== null,
	});

	return (
		<div className="relative w-full h-full">
			<div ref={mapDivRef} className="absolute inset-0" />
			<canvas
				ref={overlayCanvasRef}
				className="absolute inset-0 pointer-events-none"
			/>
			{pointsData &&
				springsData &&
				mapRef.current &&
				overlayCanvasRef.current &&
				simPoints && (
					<DistortedTileRoads
						map={mapRef.current}
						simPoints={simPoints}
						overlayCanvas={overlayCanvasRef.current}
						shouldWarp={shouldWarp}
						pointsData={pointsData.features.map((p) => [
							p.geometry.coordinates[1],
							p.geometry.coordinates[0],
						])}
						springsData={springsData}
						showPoints={showPoints}
					/>
				)}
		</div>
	);
}
