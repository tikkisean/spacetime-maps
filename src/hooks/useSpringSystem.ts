import { useEffect, useRef } from "react";

interface Point {
	lon: number;
	lat: number;
}

interface Edge {
	source: number;
	target: number;
	spring_force: number;
}

interface Options {
	points: Point[];
	edges: Edge[];
	onUpdate: (points: Point[]) => void;
	enabled: boolean;
}

interface SimPoint {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export function useSpringSystem({ points, edges, onUpdate, enabled }: Options) {
	const simPoints = useRef<SimPoint[]>([]);
	const loopCount = useRef(0);

	useEffect(() => {
		if (!enabled) return;

		const initialPoints: SimPoint[] = points.map((p) => ({
			x: lonToX(p.lon),
			y: latToY(p.lat),
			vx: 0,
			vy: 0,
		}));

		simPoints.current = initialPoints;

		let rafId: number;
		const endNum = 1;
		const simulate = () => {
			if (!enabled || loopCount.current > endNum) return;

			const dt = 0.05;
			stepSimulation(simPoints.current, edges, dt);

			if (loopCount.current < endNum) {
				loopCount.current++;
				rafId = requestAnimationFrame(simulate);
			} else {
				loopCount.current++;
				const updatedPoints = simPoints.current.map((p) => ({
					lon: xToLon(p.x),
					lat: yToLat(p.y),
				}));
				onUpdate(updatedPoints);
			}
		};

		rafId = requestAnimationFrame(simulate);

		return () => cancelAnimationFrame(rafId);
	}, [points, edges, enabled, onUpdate]);
}

const REF_LAT = 32.221667;

function stepSimulation(points: SimPoint[], edges: Edge[], dt: number) {
	const damping = 0.6;
	const forces = points.map(() => ({ fx: 0, fy: 0 }));

	for (const edge of edges) {
		const i = edge.source;
		const j = edge.target;
		const p1 = points[i];
		const p2 = points[j];

		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;

		let dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 1e-6) dist = 1e-6; // prevent division by zero

		const springForce = edge.spring_force;

		const forceMagnitude = springForce * dist;
		const fx = (forceMagnitude * dx) / dist;
		const fy = (forceMagnitude * dy) / dist;

		forces[i].fx += fx;
		forces[i].fy += fy;
		forces[j].fx -= fx;
		forces[j].fy -= fy;
	}

	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const f = forces[i];

		p.vx = (p.vx + f.fx * dt) * damping;
		p.vy = (p.vy + f.fy * dt) * damping;

		p.x += p.vx * dt;
		p.y += p.vy * dt;
	}
}

function lonToX(lon: number) {
	return lon * Math.cos((REF_LAT * Math.PI) / 180);
}

function latToY(lat: number) {
	return lat;
}

function xToLon(x: number) {
	return x / Math.cos((REF_LAT * Math.PI) / 180);
}

function yToLat(y: number) {
	return y;
}
