"""This algorithm transforms an input CSV file (hygdata_v41.csv) 
containing real star data to a simplified JSON file that the particles.js 
file can use to generate the Three.js star sky."""

import csv
import struct
import math

STAR_LIMIT = 100000
SKY_RADIUS = 100
MAX_BRIGHTNESS = 1.0

stars = []

with open('hygdata_v41.csv', encoding='utf-8') as csv_file:
    # 1. Re-order stars by brightness & limit to STAR_LIMIT
    all_stars = list(csv.DictReader(csv_file))  # [{ ... }, ... ]
    all_stars.sort(key=lambda row: float(row['mag']))
    visible_stars = all_stars[:STAR_LIMIT]

    for i, row in enumerate(visible_stars):
        # print(row)

        if i == 0:
            continue  # Skip the Sun entry

        # 2. Get Ascention and Declination (in radians)
        right_ascention = float(row['rarad'])
        declination = float(row['decrad'])

        # 3. Calculate 3D coordinates in a 100 unit radius sphere
        x = SKY_RADIUS * math.cos(right_ascention) * math.cos(declination)
        y = SKY_RADIUS * math.sin(right_ascention) * math.cos(declination)
        z = SKY_RADIUS * math.sin(declination)

        # 4. Extract magnitude
        magnitude = float(row['mag'])

        # 5. Get kelvin color from color index (B-V)
        ci = float(row['ci']) if row['ci'].strip() else 0.65  # Default
        kelvin = 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62))

        # 6. Append star data to list
        stars.append((x, y, z, magnitude, kelvin))

# 7. Write star data to Float32Array binary file
with open('stars.bin', 'wb') as stars_bin:
    for star in stars:
        stars_bin.write(struct.pack('5f', *star))

print(
    f"Wrote {len(stars)} stars ({len(stars) * 5 * 4 / 1024:.2f} KB) to stars.bin")
