> **DRAFT. Before submitting, verify every figure against a source, and replace anything the pipeline has not yet produced.**
> Do not describe data as measured by this project until data/processed/*_scene_log.csv exist. See NEXT_STEPS.md.

# NASA Space Apps 2026 — Submission Text
# Challenge: Dancing with the SARs
# Team: SAR Cosmos | Event: Bhaktapur (Khwopa Engineering College)

---

## About the team

Team SAR Cosmos is a three-person team from Khwopa Engineering College,
Bhaktapur, Nepal:

- **Shivam Prasad Raut** — project lead, remote sensing pipeline, data analysis
- **Aarambha Ghimire** — research, validation, scientific methodology
- **Saurav Bhattrai** — visualization, video, presentation

As people who live downstream of the high Himalayas, we built this project
because the stakes are real and local: the communities below these lakes need to know
how fast the lakes above them are changing.

---

## Project Summary

21 of Nepal's glacial lakes are officially classified as critically dangerous
(ICIMOD 2011), yet only 2 have had any active mitigation work. A Glacial Lake
Outburst Flood (GLOF) can release tens of millions of cubic metres of water in
minutes, threatening lives, agriculture, and the hydropower infrastructure that
Nepal's economy depends on.

**SAR Cosmos** is an interactive web dashboard that:

1. Tracks 6 of the highest-risk glacial lakes using **two decades of optical
   satellite history** (Landsat 7/8, Sentinel-2 via Google Earth Engine),
   computing water-surface area via NDWI each year back to 2000.
2. Layers on **NISAR L-band SAR data** (NASA-ISRO, via Alaska Satellite Facility)
   which penetrates the heavy monsoon cloud cover that blinds every optical
   satellite for four months each year — exactly the months when glaciers melt
   fastest.
3. Calculates a **transparent, explainable risk tier** for each lake based on
   5-year compound area growth, so every number traces back to a line of open
   code rather than a black box.
4. Presents all of this through a **3D interactive site** (Three.js terrain,
   lake selector, animated time-series scrubber, optical/radar toggle) that
   requires no installation — open one HTML file.

---

## Project Demonstration

[Link to 30-second video — recorded by the team on hackathon day]

The video shows:
- The opening stat ("21 critically dangerous lakes, only 2 with proper mitigation")
- A live click through the lake selector — risk badge and area chart animate in
- The monsoon cloud toggle showing how radar sees through what optical cannot
- Closing line: "SAR Cosmos — watching the Himalaya from space, through the clouds"

---

## Project Links

- **Live Site:** https://shivamdual.github.io/sar-cosmos/
- **GitHub:** https://github.com/ShivamDual/sar-cosmos

---

## Project Details

### Data Sources
- **Optical:** Sentinel-2 Surface Reflectance (Copernicus / ESA) and Landsat 7, 8, 9 (USGS / NASA) via Google Earth Engine, 2000–2026
- **Radar:** NISAR L-band GCOV products (NASA / ISRO) via NASA Earthdata / Alaska Satellite Facility (ASF), June 2026–present; Sentinel-1 C-band as supplementary context
- **Ground-truth validation:** Published lake areas from Rounce et al. (2016), ICIMOD 2011 inventory, ICIMOD/UNDP 2020 Nepal inventory, ICIMOD 2019 Tsho Rolpa reassessment

### Methodology
- **Optical water segmentation:** Normalized Difference Water Index (NDWI = (Green − NIR) / (Green + NIR)) thresholded at 0.2; cloud masking via Landsat QA_PIXEL; pixel counting converted to km²
- **SAR water detection:** L-band backscatter thresholding at −17 dB; flood-fill from lake centroid to reject radar shadow (also dark) before area calculation; shadow-rejected scenes logged to `data/processed/nisar_scene_log.csv`
- **Validation chain:** Optical areas compared to published Rounce et al. (2016) figures for 2000–2015; radar compared against optical within a 14-day window. We do not claim direct radar-vs-ICIMOD comparison.
- **Risk scoring:** Five-year compound area growth: Low < 10%, Moderate 10–25%, High 25–40%, Critical ≥ 40%. Formula is one function in `pipeline/risk_scoring.py` — fully auditable

### What NISAR enables that optical cannot
The Himalayan monsoon (June–September) generates continuous cloud cover that
blocks every optical satellite during the months glaciers melt fastest.
NISAR's L-band radar transmits and receives its own microwave pulses through
cloud, day or night. Calm water scatters pulses specularly away from the
sensor, appearing as a dark shape regardless of weather. This is why radar, and NISAR in
particular with its free, calibrated L-band data and 12-day repeat, lets us keep
measuring these lakes through the monsoon season.

### Verified NISAR coverage over our 6 lakes
All 6 lakes have calibrated public GCOV scenes from June 2026 onward:

| Lake | GCOV scenes | First / Last |
|---|---|---|
| Imja Tsho | 35 | 2026-06-22 / 2026-10-15 |
| Tsho Rolpa | 36 | 2026-06-20 / 2026-10-15 |
| Thulagi (Dona) | 28 | 2026-06-20 / 2026-10-10 |
| Lower Barun | 35 | 2026-06-22 / 2026-10-15 |
| Lumding Tsho | 35 | 2026-06-22 / 2026-10-15 |
| Hongu (Chamlang South) | 35 | 2026-06-22 / 2026-10-15 |

---

## Use of AI

This project was built with substantial assistance from AI coding agents
(more than one AI coding tool) for code generation,
UI implementation, 3D visualization, and pipeline scaffolding.

All technical decisions were made by the team:
- The 6 lake selection was based on the team's review of ICIMOD's official
  critically-dangerous lake list and our local knowledge of downstream risks
- The NDWI optical methodology and −17 dB SAR threshold were chosen by the team
  after reviewing published remote sensing literature
- All scientific claims are backed by published citations that the team verified
- The team tested every pipeline step and can explain and defend every result

AI coding tools generated code that the team reviewed, debugged, and corrected
(for example: fixing the Imja Tsho coordinate which an early AI-generated draft placed
at Everest's summit, not the lake; correcting the Landsat 8 pre-2013 data bug).

---

## NASA Data

- [NASA-ISRO Synthetic Aperture Radar (NISAR) Mission](https://nisar.jpl.nasa.gov/)
- [Alaska Satellite Facility (ASF) DAAC - NISAR GCOV Products](https://asf.alaska.edu/)
- [NASA Earthdata Search](https://search.earthdata.nasa.gov/)
- [Landsat Science & Missions (USGS / NASA)](https://landsat.gsfc.nasa.gov/)
- [Google Earth Engine Landsat Collection (USGS/NASA)](https://developers.google.com/earth-engine/datasets/catalog/landsat)

---

## Space Agency Partner & Other Data

- [ISRO (Indian Space Research Organisation) NISAR Programme](https://www.isro.gov.in/)
- [Copernicus Sentinel-2 Surface Reflectance (ESA)](https://sentinels.copernicus.eu/)
- [ICIMOD (International Centre for Integrated Mountain Development) Glacial Lake Inventories](https://www.icimod.org/)
- [Rounce et al. (2016) Glacial Lake Hazard Assessment Paper](https://doi.org/10.5194/tc-10-895-2016)
- [Three.js 3D WebGL Engine](https://threejs.org/)

---

## Awards Alignment

SAR Cosmos is designed to compete for top global recognition across the following categories:

- **Local Impact:** Built by students living directly downstream of the Himalayas in Nepal. ICIMOD found proper mitigation at only 2 of Nepal's 21 critically dangerous lakes. A single GLOF event at Tsho Rolpa directly endangers over 6,000 households and vital downstream hydroelectric infrastructure. SAR Cosmos provides an immediate, actionable early-warning baseline for Himalayan communities.
- **Galactic Impact & Best Mission Concept:** Demonstrates the true operational power of the NASA-ISRO Synthetic Aperture Radar (NISAR) mission. When monsoon clouds blind every passive optical satellite during the peak glacial melt season (June–September), NISAR's active L-band microwaves pierce the cloud deck to continuously map water surface area and identify runaway expansion.
- **Best Use of Storytelling:** Seamlessly connects high-altitude orbital mechanics to vulnerable village communities through an interactive 3D WebGL journey. Judges and policymakers can scrub through 26 years of historical satellite data and toggle monsoon cloud simulation to visually understand why radar remote sensing saves lives.
- **Global Connection:** Connects international space agencies (NASA & ISRO) and global Earth observation archives (USGS Landsat, Copernicus Sentinel, ASF) with regional mountain research institutes (ICIMOD) to solve a transboundary climate crisis facing the Third Pole.
- **Best Use of Data:** Merges over two decades of optical NDWI satellite records (Landsat 5/7/8/9) with real L-band SAR backscatter thresholds (−17 dB) and validates every measurement against peer-reviewed ground surveys (Rounce et al. 2016).

---

## Space Agency Partner Data

NISAR is a joint **NASA–ISRO** mission. Our project depends centrally on NISAR
as the radar mission that lets us keep measuring these lakes through the monsoon. Without ISRO's
partnership in building NISAR, the cloud-penetrating measurements this project
demonstrates would not be possible.
