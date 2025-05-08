import json
import os
import subprocess
import tempfile

CITY = "tucson"
COSTINGS = ["auto", "bicycle"]
VALHALLA_SERVICE_PATH = "/home/tikki/valhalla/build/valhalla_service"
VALHALLA_CONFIG_PATH = "/home/tikki/valhalla_data/valhalla.json"
POINTS_FILE = f"cities/{CITY}/points.json"
OUTPUT_DIR = f"cities/{CITY}/"

with open(POINTS_FILE, "r") as f:
    points = json.load(f)

locations = [{"lat": lat, "lon": lon} for lat, lon in points]


def run_valhalla_matrix(locations, costing):
    request = {
        "sources": [{"lat": loc["lat"], "lon": loc["lon"]} for loc in locations],
        "targets": [{"lat": loc["lat"], "lon": loc["lon"]} for loc in locations],
        "costing": costing,
        "units": "miles"
    }

    with tempfile.NamedTemporaryFile("w+", delete=False) as temp_file:
        json.dump(request, temp_file)
        temp_file_path = temp_file.name

    result = subprocess.run(
        [
            VALHALLA_SERVICE_PATH,
            VALHALLA_CONFIG_PATH,
            "sources_to_targets",
            temp_file_path
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if result.returncode != 0:
        print(
            f"Valhalla subprocess failed with return code {result.returncode}")
        print("--- STDERR ---")
        print(result.stderr.strip())
        print("--- STDOUT ---")
        print(result.stdout.strip())
        raise RuntimeError("Valhalla matrix query failed")

    return json.loads(result.stdout)


for costing in COSTINGS:
    print(f"Querying Valhalla matrix for {costing}...")

    matrix = run_valhalla_matrix(locations, costing)
    times = matrix["sources_to_targets"]

    print("Building weight list...")

    weights = []

    for i, row in enumerate(times):
        for j, cell in enumerate(row):
            if not cell:
                continue
            if "time" not in cell or "distance" not in cell:
                continue
            if cell["time"] is None or cell["distance"] is None:
                continue
            if i == j:
                continue

            distance_miles = cell["distance"]
            time_seconds = cell["time"]

            if time_seconds == 0:
                continue

            time_hours = time_seconds / 3600.0
            avg_speed_mph = distance_miles / time_hours

            weights.append({
                "source": i,
                "target": j,
                "distance_miles": distance_miles,
                "time_seconds": time_seconds,
                "avg_speed_mph": avg_speed_mph
            })

    if not weights:
        raise RuntimeError("No valid weights computed!")

    speeds = [w["avg_speed_mph"] for w in weights]
    global_avg_speed = sum(speeds) / len(speeds)
    print(f"Global average speed ({costing}): {global_avg_speed:.2f} mph")

    for w in weights:
        r = w["avg_speed_mph"] / global_avg_speed
        w["spring_force"] = r - (1 / r)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_file = os.path.join(OUTPUT_DIR, f"weights_{costing}.json")
    with open(output_file, "w") as f:
        json.dump(weights, f, indent=2)

    print(f"Saved {len(weights)} weights to {output_file}")

print("Done!")
