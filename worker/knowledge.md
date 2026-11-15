# SAR COSMOS KNOWLEDGE

## The project
SAR Cosmos is a 3D, interactive website by Shivam, Aarambh and Saurav (Bhaktapur local event, NASA Space Apps Challenge 2026, challenge "Dancing with the SARs"). It tracks six dangerous Himalayan glacial lakes: Imja Tsho, Tsho Rolpa, Thulagi (Dona), Lower Barun, Lumding Tsho, Hongu (Chamlang South). It shows how big each lake has been, how fast it is growing, and why NISAR radar can keep measuring lakes through the monsoon when optical satellites cannot. Visitors can fly through a generated 3D Himalayan range, switch between an optical view and a radar view, scrub through time, open radar scene images with the extracted water outline (once the NISAR pipeline has run), ask questions, and print fact sheets.

## The challenge ("Dancing with the SARs")
Build an interactive application that uses radar remote sensing data from the NASA-ISRO NISAR mission to track and visualize one or more types of surface change at locations around the world. Glacier movement is named as an example. Desired outcome: an open-source, user-friendly solution that turns complex radar observations into insight, for example interactive change-detection maps, time-series animations or dashboards. Optional considerations: different polarizations, time series from several dates, ancillary datasets, human drivers, storytelling, interactivity. Challenge resources are released on 13 November 2026; the hackathon runs 14 to 15 November 2026. Global judging criteria: Impact, Creativity, Validity, Relevance, Presentation.

## NISAR and radar facts
- NISAR is a joint NASA and ISRO satellite with an L-band radar (wavelength about 24 cm). It repeats its observations about every 12 days and works day and night.
- Calibrated NISAR L-band data became public on 20 July 2026, for observations from 17 June 2026 onward. Data is distributed by ASF DAAC; GCOV is a geocoded backscatter product. Access works through the asf_search and earthaccess Python packages.
- A search by the team found 28 to 36 calibrated GCOV scenes over each of the six lakes, from about 20-22 June to 10-15 October 2026.
- Cloud droplets are micrometres across and radar wavelengths are centimetres, so cloud is nearly transparent to radar. Calm water bounces the radar pulse away from the sensor, so lakes look dark. Radar shadow behind steep slopes is dark too, which is why the method only accepts the dark patch that contains the lake's own coordinates.
- Optical satellites (Landsat, Sentinel-2) need clear sky. The monsoon (about June to September) covers the Himalaya in cloud.

## The problem
- A 2011 ICIMOD study counted 21 critically dangerous glacial lakes in Nepal and found proper mitigation at only two (cited again in ICIMOD's 2019 Tsho Rolpa reassessment).
- A 2020 ICIMOD and UNDP Nepal report counted 26 glacial lake outburst floods (GLOFs) in Nepal since 1977, 14 of them starting inside Nepal.
- About 6,000 households live downstream of Tsho Rolpa (ICIMOD).

## The six lakes (published data to 2015)
### Imja Tsho  (id: imja_tsho)
- Location: Solukhumbu district, Dudh Koshi (Everest region), about 5,010 m.
- Published areas (Rounce et al. 2016): 0.835 km2 in 2000 to 1.265 km2 in 2015 (+51% overall; +14.9% from 2010 to 2015).
- Context: Formed at the foot of the Imja and Lhotse Shar glaciers from the 1950s, and described in a 2009 study as one of the fastest-growing glacial lakes in the Himalaya. A 2016 outlet project drained over 4 million cubic metres.
- Key figure: About 0.84 km² in 2000 to 1.27 km² in 2015 (Rounce et al. 2016).
- Mitigation record: In 2016 outlet works drained over 4 million cubic metres from the lake (UNDP and Government of Nepal).
- Places downstream: Dingboche, Pangboche, Namche Bazaar, Lukla.
### Tsho Rolpa  (id: tsho_rolpa)
- Location: Dolakha district, Rolwaling / Tama Koshi, about 4,545 m.
- Published areas (Rounce et al. 2016): 1.520 km2 in 2000 to 1.588 km2 in 2015 (+4% overall; +2.8% from 2010 to 2015).
- Context: One of the largest glacial lakes in Nepal, fed by the Trakarding Glacier. Its level was lowered 3 m by 2000. About 6,000 households lie downstream.
- Key figure: Close to steady at 1.5 to 1.6 km² since 2000 (Rounce et al. 2016; ICIMOD 2019).
- Mitigation record: The lake level was lowered 3 m by 2000 with an outlet channel (ICIMOD).
- Places downstream: Na, Beding, Simigaon, Gongar.
- Infrastructure on the same river system: Upper Tamakoshi Hydropower (456 MW), on the Tama Koshi river system the Rolwaling valley drains into.
- People: About 6,000 households downstream (ICIMOD).
### Thulagi (Dona)  (id: thulagi)
- Location: Manang district, Marsyangdi (Gandaki), about 4,044 m.
- Published areas (Rounce et al. 2016): 0.860 km2 in 2000 to 0.948 km2 in 2015 (+10% overall; -0.4% from 2010 to 2015).
- Context: Dona Tal sits southwest of Manaslu at about 4,044 m. Two hydropower projects, Marsyangdi and Middle Marsyangdi, are downstream. ICIMOD surveyed it in the field in 2011.
- Key figure: 0.76 km² in 1995 to 0.94 km² in 2009, about 0.95 km² since (ICIMOD 2011; Rounce et al. 2016).
- Mitigation record: No mitigation work recorded in the sources we used.
- Places downstream: Marsyangdi valley, Manang and Lamjung districts.
- Infrastructure on the same river system: Marsyangdi Hydropower (69 MW); Middle Marsyangdi Hydropower (70 MW).
### Lower Barun  (id: lower_barun)
- Location: Sankhuwasabha district, Barun / Arun (Koshi), about 4,500 m.
- Published areas (Rounce et al. 2016): 0.949 km2 in 2000 to 1.670 km2 in 2015 (+76% overall; +20.2% from 2010 to 2015).
- Context: Formed by the retreating West Barun Glacier in Makalu Barun National Park, near the Makalu base camp trail. It grew by about three quarters between 2000 and 2015.
- Key figure: 0.95 km² in 2000 to 1.67 km² in 2015, about +76% (Rounce et al. 2016). The fastest-growing lake in this set.
- Mitigation record: No mitigation work recorded in the sources we used.
- Places downstream: Barun and Arun valleys, Sankhuwasabha district.
### Lumding Tsho  (id: lumding)
- Location: Solukhumbu district, Hongu (Koshi), about 4,700 m (coordinates and altitude UNVERIFIED).
- Published areas (Rounce et al. 2016): 0.773 km2 in 2000 to 1.115 km2 in 2015 (+44% overall; +12.7% from 2010 to 2015).
- Context: A moraine-dammed lake in eastern Nepal whose glacier reaches the water. Rounce et al. (2016) rate its hazard High.
- Key figure: 0.77 km² in 2000 to 1.12 km² in 2015, about +44% (Rounce et al. 2016).
- Mitigation record: No mitigation work recorded in the sources we used.
### Hongu (Chamlang South)  (id: hongu)
- Location: Solukhumbu district, Hongu (Koshi), about 4,900 m (coordinates and altitude UNVERIFIED).
- Published areas (Rounce et al. 2016): 0.815 km2 in 2000 to 0.818 km2 in 2015 (+0% overall; +0.1% from 2010 to 2015).
- Context: Chamlang South Tsho, below the south face of Chamlang. Stable in size, but Rounce et al. (2016) rate its hazard Very High because of steep glacier and moraine conditions.
- Key figure: About 0.82 km² and steady from 2000 to 2015 (Rounce et al. 2016).
- Mitigation record: No mitigation work recorded in the sources we used.

The reference table holds 83 Rounce et al. (2016) measurements (Landsat and ASTER, average error about 10%, range 4 to 14%), plus single points from Watanabe et al. (2009) for Imja Tsho and ICIMOD for Thulagi (2009) and Tsho Rolpa (2019). Not one of the 83 published measurements was made between January and August; 21 were in September, 43 in October, 17 in November, 2 in December. That gap is the monsoon.

## Method
- Optical: NDWI = (green - NIR) / (green + NIR) from Landsat 5, 7, 8 and 9 (via Google Earth Engine) in a small window around the lake. One clear post-monsoon image per year (15 Sep to 15 Dec), threshold chosen per image with Otsu's method, keep only the water patch containing the lake coordinates, count pixels into km2.
- Radar: NISAR GCOV backscatter in dB (HH preferred), 3x3 median despeckle, Otsu threshold, same single-patch rule. A dark patch that is not at the lake's coordinates is logged and excluded. On synthetic test scenes with known truth the area error was under 1%.
- Risk tier: growth in area over the last five years of the record. Under 10% Low, under 25% Moderate, under 40% High, 40% or more Critical. This is the team's own plain rule; it describes growth, not the probability of a flood. From the published data to 2015: Imja Tsho +14.9% (Moderate), Lower Barun +20.2% (Moderate), Lumding Tsho +12.7% (Moderate), Tsho Rolpa +2.8% (Low), Thulagi -0.4% (Low), Hongu (Chamlang South) +0.1% (Low).
- Validation is a chain: optical areas are compared with published areas for the same lakes and dates; radar areas are compared with optical areas from within 14 days. The validation script refuses to run on placeholder data.

## Honest limits
- The site only shows data from a real source. Until the team's Landsat and NISAR pipelines have been run, it shows published measurements to 2015; the live data status is in PAGE DATA.
- Published areas carry about 10% error of their own.
- NISAR calibrated public data starts June 2026, so radar covers one season so far. The long history is optical.
- Lumding and Hongu coordinates and altitudes are unverified. "Hongu" is matched to Chamlang South Tsho from Rounce et al. (2016); that identity should be confirmed.
- The terrain on the site is generated for illustration; lake order is real, lake spacing is not.
- The project does not forecast outbursts, flood arrival times, flood depths or evacuation needs. That requires flood modelling (terrain data, breach scenarios) run with the responsible authorities, in Nepal the Department of Hydrology and Meteorology.

## Sources
Rounce et al. (2016), Hydrology and Earth System Sciences 20, 3455-3475 (doc id rounce-paper; supplement PDF rounce-supplement). ICIMOD (2019) Reassessing Tsho Rolpa (icimod-rolpa). ICIMOD and UNDP Nepal (2020) (undp-icimod-2020). Watanabe et al. (2009), Norsk Geografisk Tidsskrift 63(4). ASF NISAR availability notice (asf-nisar) and documentation (nisar-docs). Challenge page (challenge).

## Built with
Three.js for the 3D scene, plain JavaScript, Python pipelines (earthaccess, h5py, scipy, pyproj, Earth Engine), tested with pytest and Node tests. Built with substantial AI coding assistance, directed and reviewed by the team; numbers that could not be sourced were removed.
