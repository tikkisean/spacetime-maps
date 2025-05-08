import { useEffect } from "react";
import { Map } from "maplibre-gl";
import Pbf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";

interface Props {
	map: Map;
	simPoints: [number, number][];
	overlayCanvas: HTMLCanvasElement;
	shouldWarp: boolean;
	pointsData: [number, number][];
	showPoints: boolean;
}

const tiles = [
	{ z: 12, x: 783, y: 1659 },
	{ z: 12, x: 783, y: 1660 },
	{ z: 12, x: 783, y: 1661 },
	{ z: 12, x: 784, y: 1659 },
	{ z: 12, x: 784, y: 1660 },
	{ z: 12, x: 784, y: 1661 },
	{ z: 12, x: 785, y: 1659 },
	{ z: 12, x: 785, y: 1660 },
	{ z: 12, x: 785, y: 1661 },
	{ z: 12, x: 786, y: 1659 },
	{ z: 12, x: 786, y: 1660 },
	{ z: 12, x: 786, y: 1661 },
	{ z: 12, x: 787, y: 1659 },
	{ z: 12, x: 787, y: 1660 },
	{ z: 12, x: 787, y: 1661 },
	{ z: 12, x: 788, y: 1659 },
	{ z: 12, x: 788, y: 1660 },
	{ z: 12, x: 788, y: 1661 },
];

export default function DistortedTileRoads({
	map,
	simPoints,
	overlayCanvas,
	shouldWarp,
	pointsData,
	showPoints,
}: Props) {
	useEffect(() => {
		if (!map || !simPoints || !overlayCanvas) return;
		const ctx = overlayCanvas.getContext("2d");
		if (!ctx) return;

		const fetchAndRenderTile = async (z: number, x: number, y: number) => {
			const url = `https://tiles.maps.seaneddy.com/arizona/tiles/${z}/${x}/${y}.pbf`;

			const res = await fetch(url);
			const buffer = await res.arrayBuffer();
			const tile = new VectorTile(new Pbf(buffer));
			const layer = tile.layers["roads"];
			if (!layer) {
				return;
			}

			const propertyStyles = {
				service: { lineWidth: 0.5, strokeStyle: "rgba(0,0,0,0.1)" },
				residential: { lineWidth: 1, strokeStyle: "rgba(0,0,0,0.2)" },
				tertiary: { lineWidth: 2, strokeStyle: "rgba(0,0,0,0.4)" },
				secondary: { lineWidth: 3, strokeStyle: "rgba(0,0,0,0.6)" },
				primary: { lineWidth: 4, strokeStyle: "rgba(0,0,0,0.8)" },
				trunk: { lineWidth: 5, strokeStyle: "rgba(0,0,0,0.8)" },
				motorway: { lineWidth: 6, strokeStyle: "yellow" },
			};
			const propertyTypes = [
				"primary",
				"secondary",
				"tertiary",
				"trunk",
				"motorway",
			];
			for (let i = 0; i < layer.length; i++) {
				const feature = layer.feature(i);
				if (
					feature.type !== 2 ||
					!propertyTypes.includes(feature.properties.type)
				) {
					continue;
				}

				const coords = feature.loadGeometry()[0];
				if (coords.length < 2) continue;

				ctx.beginPath();
				for (let j = 0; j < coords.length; j++) {
					const { x: px, y: py } = coords[j];
					const [lon, lat] = tileCoordToLonLat(px, py, z, x, y);
					const warped = shouldWarp
						? warpPointMLS([lat, lon], pointsData, simPoints)
						: [lat, lon];
					const projected = map.project([warped[1], warped[0]]);
					if (j === 0) ctx.moveTo(projected.x, projected.y);
					else ctx.lineTo(projected.x, projected.y);
				}
				ctx.lineWidth = propertyStyles[feature.properties.type].lineWidth;
				ctx.strokeStyle = propertyStyles[feature.properties.type].strokeStyle;
				ctx.stroke();
			}
		};

		const renderAllTiles = async () => {
			ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
			ctx.save();

			for (const { z, x, y } of tiles) {
				await fetchAndRenderTile(z, x, y);
			}

			if (showPoints) {
				for (let i = 0; i < pointsData.length; i++) {
					const [lat, lon] = pointsData[i];
					const warped = shouldWarp
						? warpPointMLS([lat, lon], pointsData, simPoints)
						: [lat, lon];
					const projected = map.project([warped[1], warped[0]]);

					ctx.beginPath();
					ctx.arc(projected.x, projected.y, 4, 0, 2 * Math.PI);
					ctx.fillStyle = "red";
					ctx.fill();
				}
			}

			ctx.restore();
		};

		renderAllTiles();

		map.on("move", renderAllTiles);
		return () => map.off("move", renderAllTiles);
	}, [map, simPoints, overlayCanvas, shouldWarp, pointsData, showPoints]);

	return null;
}

function warpPointMLS(
	x: [number, number],
	p: [number, number][],
	q: [number, number][]
): [number, number] {
	const weight = (d: number) => 1 / (d * d + 1e-6); // Avoid division by zero

	let wSum = 0;
	const weights = [];
	const pCentroid = [0, 0];
	const qCentroid = [0, 0];

	for (let i = 0; i < p.length; i++) {
		const d = Math.hypot(x[0] - p[i][0], x[1] - p[i][1]);
		const w = weight(d);
		weights.push(w);
		wSum += w;
		pCentroid[0] += w * p[i][0];
		pCentroid[1] += w * p[i][1];
		qCentroid[0] += w * q[i][0];
		qCentroid[1] += w * q[i][1];
	}
	pCentroid[0] /= wSum;
	pCentroid[1] /= wSum;
	qCentroid[0] /= wSum;
	qCentroid[1] /= wSum;

	let mu = 0;
	const M = [
		[0, 0],
		[0, 0],
	];
	for (let i = 0; i < p.length; i++) {
		const pi = [p[i][0] - pCentroid[0], p[i][1] - pCentroid[1]];
		const qi = [q[i][0] - qCentroid[0], q[i][1] - qCentroid[1]];
		const w = weights[i];

		mu += w * (pi[0] * pi[0] + pi[1] * pi[1]);
		M[0][0] += w * pi[0] * qi[0];
		M[0][1] += w * pi[0] * qi[1];
		M[1][0] += w * pi[1] * qi[0];
		M[1][1] += w * pi[1] * qi[1];
	}

	const px = [x[0] - pCentroid[0], x[1] - pCentroid[1]];
	const y: [number, number] = [
		qCentroid[0] + (M[0][0] * px[0] + M[1][0] * px[1]) / mu,
		qCentroid[1] + (M[0][1] * px[0] + M[1][1] * px[1]) / mu,
	];
	return y;
}

function tileCoordToLonLat(
	x: number,
	y: number,
	z: number,
	tileX: number,
	tileY: number
) {
	const extent = 4096;
	const n = Math.pow(2, z);
	const lon = ((tileX + x / extent) / n) * 360 - 180;
	const latRad = Math.atan(
		Math.sinh(Math.PI * (1 - (2 * (tileY + y / extent)) / n))
	);
	const lat = (latRad * 180) / Math.PI;
	return [lon, lat];
}
