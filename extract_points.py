from scipy.spatial import KDTree
import geopy.distance
import json
import os
import osmium


class IntersectionHandler(osmium.SimpleHandler):
    def __init__(self, minlat, minlon, maxlat, maxlon):
        super().__init__()
        self.nodes = []
        self.minlat = minlat
        self.minlon = minlon
        self.maxlat = maxlat
        self.maxlon = maxlon

    def node(self, n):
        if not n.location.valid():
            return
        if not (self.minlat <= n.location.lat <= self.maxlat and self.minlon <= n.location.lon <= self.maxlon):
            return
        if "highway" in n.tags and n.tags["highway"] in {"traffic_signals", "crossing"}:
            self.nodes.append((n.location.lat, n.location.lon))


def extract_intersections(pbf_path):
    minlat = 32.0
    maxlat = 32.35
    minlon = -111.05
    maxlon = -110.7

    handler = IntersectionHandler(minlat, minlon, maxlat, maxlon)
    handler.apply_file(pbf_path)
    return handler.nodes


def filter_points_in_radius(points, center, radius_km):
    filtered = []
    for lat, lon in points:
        distance = geopy.distance.distance(center, (lat, lon)).km
        if distance <= radius_km:
            filtered.append((lat, lon))
    return filtered


def filter_by_minimum_distance(points, min_distance_m=200):
    if not points:
        return []

    tree = KDTree([(lat, lon) for lat, lon in points])
    filtered = []
    used = set()

    for i, pt in enumerate(points):
        if i in used:
            continue
        filtered.append(pt)
        idxs = tree.query_ball_point(
            pt, min_distance_m / 111_000)
        for idx in idxs:
            used.add(idx)

    return filtered


def save_points(points, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "points.json"), "w") as f:
        json.dump(points, f, indent=2)


def save_dummy_weights(points, output_dir):
    weights = []
    for i, (lat1, lon1) in enumerate(points):
        for j, (lat2, lon2) in enumerate(points):
            if i != j:
                distance = geopy.distance.distance(
                    (lat1, lon1), (lat2, lon2)).m
                if distance < 3000:
                    weights.append({"source": i, "target": j})
    with open(os.path.join(output_dir, "weights.json"), "w") as f:
        json.dump(weights, f, indent=2)


class CityConfig:
    def __init__(self, name, center_lat, center_lon, radius_km):
        self.name = name
        self.center = (center_lat, center_lon)
        self.radius_km = radius_km


if __name__ == "__main__":
    CITY = CityConfig(
        name="tucson",
        center_lat=32.2217,
        center_lon=-110.9265,
        radius_km=20,
    )

    pbf_path = "/home/tikki/arizona-tiles/tucson.osm.pbf"
    output_dir = f"cities/{CITY.name}/"

    print(f"Extracting points for {CITY.name}...")

    points = extract_intersections(pbf_path)
    print(f"Found {len(points)} raw intersections.")

    points = filter_points_in_radius(points, CITY.center, CITY.radius_km)
    print(f"{len(points)} points within {CITY.radius_km} km radius.")

    points = filter_by_minimum_distance(points, min_distance_m=1000)
    print(f"{len(points)} points after minimum distance filtering.")

    save_points(points, output_dir)
    save_dummy_weights(points, output_dir)

    print(f"Saved data to {output_dir}")
