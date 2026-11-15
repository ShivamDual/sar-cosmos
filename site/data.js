window.SAR_COSMOS_DATA = {
 "generatedAt": "2026-11-10 01:06",
 "demoData": true,
 "dataLabel": "Published data, 2000 to 2015",
 "dataNote": "Showing published lake-area measurements (Rounce et al. 2016, about 10% error). The Landsat and NISAR pipeline results will replace and extend them once they have been run.",
 "stats": {
  "dangerousLakes": 21,
  "mitigatedLakes": 2,
  "gloFsSince1977": 26,
  "gloFsInsideNepal": 14,
  "households": 6000
 },
 "coverage": {
  "publishedPerMonth": [
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   21,
   43,
   17,
   2
  ],
  "publishedTotal": 83
 },
 "references": [
  {
   "id": "rounce",
   "text": "Rounce, D. R. et al. (2016). Glacial lake change and hazard assessment in the Everest region and beyond. Hydrology and Earth System Sciences 20, 3455-3475, supplement Table S.7 (Landsat and ASTER areas, average error about 10%)."
  },
  {
   "id": "icimod2011",
   "text": "ICIMOD (2011). Glacial lakes and glacial lake outburst floods in Nepal. Study identifying 21 critically dangerous lakes, only two with proper mitigation."
  },
  {
   "id": "icimod-undp2020",
   "text": "ICIMOD and UNDP Nepal (2020). Report on potentially dangerous glacial lakes in the Koshi, Gandaki and Karnali basins (26 GLOF events since 1977, 14 starting in Nepal)."
  },
  {
   "id": "icimod2019",
   "text": "ICIMOD (2019). Reassessing Tsho Rolpa glacial lake."
  },
  {
   "id": "watanabe2009",
   "text": "Watanabe, T. et al. (2009). Norsk Geografisk Tidsskrift 63(4), 255-267 (Imja Tsho area, 21 Nov 2009)."
  },
  {
   "id": "nisar",
   "text": "NASA-ISRO NISAR L-band GCOV products, via ASF DAAC (calibrated public data for acquisitions from 2026-06-17)."
  },
  {
   "id": "landsat",
   "text": "Landsat 5, 7, 8 and 9 Collection 2 Level 2 surface reflectance, via Google Earth Engine."
  }
 ],
 "lakes": [
  {
   "id": "imja_tsho",
   "name": "Imja Tsho",
   "basin": "Dudh Koshi (Everest region)",
   "district": "Solukhumbu",
   "lat": 27.898,
   "lon": 86.928,
   "altitude_m": 5010,
   "monitored": true,
   "context": "Formed at the foot of the Imja and Lhotse Shar glaciers from the 1950s, and described in a 2009 study as one of the fastest-growing glacial lakes in the Himalaya. A 2016 outlet project drained over 4 million cubic metres.",
   "keyStat": "About 0.84 km² in 2000 to 1.27 km² in 2015 (Rounce et al. 2016).",
   "exposure": {
    "places": [
     "Dingboche",
     "Pangboche",
     "Namche Bazaar",
     "Lukla"
    ],
    "places_note": "Villages along the Imja Khola and Dudh Koshi trail corridor.",
    "infrastructure": [],
    "mitigation": "In 2016 outlet works drained over 4 million cubic metres from the lake (UNDP and Government of Nepal).",
    "households": null,
    "note": "Public geography and infrastructure only, from the sources listed in the fact sheet. No flood travel times, populations or discharges are modelled on this site."
   },
   "riskTier": "Moderate",
   "riskColor": "#FBBF24",
   "riskBasis": "Five-year growth to 2015, from published measurements",
   "latestAreaKm2": 1.265,
   "latestDate": "2015-09-30",
   "change3yrPct": 6.6,
   "change5yrPct": 14.9,
   "opticalIsPipeline": false,
   "sarIsReal": false,
   "optical": [
    {
     "date": "2000-10-14",
     "area": 0.835
    },
    {
     "date": "2001-09-15",
     "area": 0.853
    },
    {
     "date": "2002-10-04",
     "area": 0.863
    },
    {
     "date": "2003-11-08",
     "area": 0.871
    },
    {
     "date": "2004-11-10",
     "area": 0.893
    },
    {
     "date": "2005-10-28",
     "area": 0.898
    },
    {
     "date": "2006-11-16",
     "area": 0.943
    },
    {
     "date": "2007-10-02",
     "area": 0.947
    },
    {
     "date": "2008-10-20",
     "area": 0.992
    },
    {
     "date": "2009-10-23",
     "area": 1.041
    },
    {
     "date": "2010-10-26",
     "area": 1.101
    },
    {
     "date": "2011-10-29",
     "area": 1.139
    },
    {
     "date": "2012-09-29",
     "area": 1.187
    },
    {
     "date": "2013-10-10",
     "area": 1.206
    },
    {
     "date": "2014-09-27",
     "area": 1.22
    },
    {
     "date": "2015-09-30",
     "area": 1.265
    }
   ],
   "sar": [],
   "published": [
    {
     "date": "2000-10-14",
     "area": 0.835
    },
    {
     "date": "2001-09-15",
     "area": 0.853
    },
    {
     "date": "2002-10-04",
     "area": 0.863
    },
    {
     "date": "2003-11-08",
     "area": 0.871
    },
    {
     "date": "2004-11-10",
     "area": 0.893
    },
    {
     "date": "2005-10-28",
     "area": 0.898
    },
    {
     "date": "2006-11-16",
     "area": 0.943
    },
    {
     "date": "2007-10-02",
     "area": 0.947
    },
    {
     "date": "2008-10-20",
     "area": 0.992
    },
    {
     "date": "2009-10-23",
     "area": 1.041
    },
    {
     "date": "2010-10-26",
     "area": 1.101
    },
    {
     "date": "2011-10-29",
     "area": 1.139
    },
    {
     "date": "2012-09-29",
     "area": 1.187
    },
    {
     "date": "2013-10-10",
     "area": 1.206
    },
    {
     "date": "2014-09-27",
     "area": 1.22
    },
    {
     "date": "2015-09-30",
     "area": 1.265
    }
   ]
  },
  {
   "id": "tsho_rolpa",
   "name": "Tsho Rolpa",
   "basin": "Rolwaling / Tama Koshi",
   "district": "Dolakha",
   "lat": 27.8617,
   "lon": 86.4706,
   "altitude_m": 4545,
   "monitored": true,
   "context": "One of the largest glacial lakes in Nepal, fed by the Trakarding Glacier. Its level was lowered 3 m by 2000. About 6,000 households lie downstream.",
   "keyStat": "Close to steady at 1.5 to 1.6 km² since 2000 (Rounce et al. 2016; ICIMOD 2019).",
   "exposure": {
    "places": [
     "Na",
     "Beding",
     "Simigaon",
     "Gongar"
    ],
    "places_note": "Rolwaling valley villages, down to the Tama Koshi.",
    "infrastructure": [
     "Upper Tamakoshi Hydropower (456 MW), on the Tama Koshi river system the Rolwaling valley drains into"
    ],
    "mitigation": "The lake level was lowered 3 m by 2000 with an outlet channel (ICIMOD).",
    "households": "About 6,000 households downstream (ICIMOD).",
    "note": "Public geography and infrastructure only, from the sources listed in the fact sheet. No flood travel times, populations or discharges are modelled on this site."
   },
   "riskTier": "Low",
   "riskColor": "#4ADE80",
   "riskBasis": "Five-year growth to 2015, from published measurements",
   "latestAreaKm2": 1.588,
   "latestDate": "2015-09-30",
   "change3yrPct": 3.3,
   "change5yrPct": 2.8,
   "opticalIsPipeline": false,
   "sarIsReal": false,
   "optical": [
    {
     "date": "2000-10-14",
     "area": 1.52
    },
    {
     "date": "2001-10-07",
     "area": 1.541
    },
    {
     "date": "2002-10-04",
     "area": 1.553
    },
    {
     "date": "2004-10-17",
     "area": 1.536
    },
    {
     "date": "2005-11-05",
     "area": 1.535
    },
    {
     "date": "2006-09-05",
     "area": 1.517
    },
    {
     "date": "2007-11-19",
     "area": 1.534
    },
    {
     "date": "2008-10-12",
     "area": 1.532
    },
    {
     "date": "2009-10-15",
     "area": 1.541
    },
    {
     "date": "2010-10-26",
     "area": 1.545
    },
    {
     "date": "2011-09-03",
     "area": 1.542
    },
    {
     "date": "2012-11-16",
     "area": 1.538
    },
    {
     "date": "2013-10-10",
     "area": 1.571
    },
    {
     "date": "2014-11-14",
     "area": 1.589
    },
    {
     "date": "2015-09-30",
     "area": 1.588
    }
   ],
   "sar": [],
   "published": [
    {
     "date": "2000-10-14",
     "area": 1.52
    },
    {
     "date": "2001-10-07",
     "area": 1.541
    },
    {
     "date": "2002-10-04",
     "area": 1.553
    },
    {
     "date": "2004-10-17",
     "area": 1.536
    },
    {
     "date": "2005-11-05",
     "area": 1.535
    },
    {
     "date": "2006-09-05",
     "area": 1.517
    },
    {
     "date": "2007-11-19",
     "area": 1.534
    },
    {
     "date": "2008-10-12",
     "area": 1.532
    },
    {
     "date": "2009-10-15",
     "area": 1.541
    },
    {
     "date": "2010-10-26",
     "area": 1.545
    },
    {
     "date": "2011-09-03",
     "area": 1.542
    },
    {
     "date": "2012-11-16",
     "area": 1.538
    },
    {
     "date": "2013-10-10",
     "area": 1.571
    },
    {
     "date": "2014-11-14",
     "area": 1.589
    },
    {
     "date": "2015-09-30",
     "area": 1.588
    }
   ]
  },
  {
   "id": "thulagi",
   "name": "Thulagi (Dona)",
   "basin": "Marsyangdi (Gandaki)",
   "district": "Manang",
   "lat": 28.51,
   "lon": 84.535,
   "altitude_m": 4044,
   "monitored": false,
   "context": "Dona Tal sits southwest of Manaslu at about 4,044 m. Two hydropower projects, Marsyangdi and Middle Marsyangdi, are downstream. ICIMOD surveyed it in the field in 2011.",
   "keyStat": "0.76 km² in 1995 to 0.94 km² in 2009, about 0.95 km² since (ICIMOD 2011; Rounce et al. 2016).",
   "exposure": {
    "places": [
     "Marsyangdi valley, Manang and Lamjung districts"
    ],
    "places_note": "The lake drains into the Marsyangdi river.",
    "infrastructure": [
     "Marsyangdi Hydropower (69 MW)",
     "Middle Marsyangdi Hydropower (70 MW)"
    ],
    "mitigation": "No mitigation work recorded in the sources we used.",
    "households": null,
    "note": "Public geography and infrastructure only, from the sources listed in the fact sheet. No flood travel times, populations or discharges are modelled on this site."
   },
   "riskTier": "Low",
   "riskColor": "#4ADE80",
   "riskBasis": "Five-year growth to 2015, from published measurements",
   "latestAreaKm2": 0.948,
   "latestDate": "2015-11-15",
   "change3yrPct": 1.3,
   "change5yrPct": -0.4,
   "opticalIsPipeline": false,
   "sarIsReal": false,
   "optical": [
    {
     "date": "2000-09-26",
     "area": 0.86
    },
    {
     "date": "2001-09-29",
     "area": 0.864
    },
    {
     "date": "2002-12-05",
     "area": 0.887
    },
    {
     "date": "2003-11-14",
     "area": 0.885
    },
    {
     "date": "2004-11-16",
     "area": 0.912
    },
    {
     "date": "2005-11-03",
     "area": 0.923
    },
    {
     "date": "2006-11-22",
     "area": 0.925
    },
    {
     "date": "2007-09-22",
     "area": 0.94
    },
    {
     "date": "2008-10-26",
     "area": 0.932
    },
    {
     "date": "2009-09-27",
     "area": 0.941
    },
    {
     "date": "2010-12-03",
     "area": 0.952
    },
    {
     "date": "2011-10-19",
     "area": 0.95
    },
    {
     "date": "2012-10-13",
     "area": 0.936
    },
    {
     "date": "2013-10-08",
     "area": 0.95
    },
    {
     "date": "2014-10-11",
     "area": 0.947
    },
    {
     "date": "2015-11-15",
     "area": 0.948
    }
   ],
   "sar": [],
   "published": [
    {
     "date": "2000-09-26",
     "area": 0.86
    },
    {
     "date": "2001-09-29",
     "area": 0.864
    },
    {
     "date": "2002-12-05",
     "area": 0.887
    },
    {
     "date": "2003-11-14",
     "area": 0.885
    },
    {
     "date": "2004-11-16",
     "area": 0.912
    },
    {
     "date": "2005-11-03",
     "area": 0.923
    },
    {
     "date": "2006-11-22",
     "area": 0.925
    },
    {
     "date": "2007-09-22",
     "area": 0.94
    },
    {
     "date": "2008-10-26",
     "area": 0.932
    },
    {
     "date": "2009-09-27",
     "area": 0.941
    },
    {
     "date": "2010-12-03",
     "area": 0.952
    },
    {
     "date": "2011-10-19",
     "area": 0.95
    },
    {
     "date": "2012-10-13",
     "area": 0.936
    },
    {
     "date": "2013-10-08",
     "area": 0.95
    },
    {
     "date": "2014-10-11",
     "area": 0.947
    },
    {
     "date": "2015-11-15",
     "area": 0.948
    }
   ]
  },
  {
   "id": "lower_barun",
   "name": "Lower Barun",
   "basin": "Barun / Arun (Koshi)",
   "district": "Sankhuwasabha",
   "lat": 27.83,
   "lon": 87.13,
   "altitude_m": 4500,
   "monitored": false,
   "context": "Formed by the retreating West Barun Glacier in Makalu Barun National Park, near the Makalu base camp trail. It grew by about three quarters between 2000 and 2015.",
   "keyStat": "0.95 km² in 2000 to 1.67 km² in 2015, about +76% (Rounce et al. 2016). The fastest-growing lake in this set.",
   "exposure": {
    "places": [
     "Barun and Arun valleys, Sankhuwasabha district"
    ],
    "places_note": "Downstream settlements and infrastructure are not yet mapped by us.",
    "infrastructure": [],
    "mitigation": "No mitigation work recorded in the sources we used.",
    "households": null,
    "note": "Public geography and infrastructure only, from the sources listed in the fact sheet. No flood travel times, populations or discharges are modelled on this site."
   },
   "riskTier": "Moderate",
   "riskColor": "#FBBF24",
   "riskBasis": "Five-year growth to 2015, from published measurements",
   "latestAreaKm2": 1.67,
   "latestDate": "2015-09-30",
   "change3yrPct": 9.5,
   "change5yrPct": 20.2,
   "opticalIsPipeline": false,
   "sarIsReal": false,
   "optical": [
    {
     "date": "2000-09-28",
     "area": 0.949
    },
    {
     "date": "2001-09-15",
     "area": 0.932
    },
    {
     "date": "2002-10-04",
     "area": 0.974
    },
    {
     "date": "2003-10-23",
     "area": 1.022
    },
    {
     "date": "2004-10-09",
     "area": 1.035
    },
    {
     "date": "2005-10-10",
     "area": 1.082
    },
    {
     "date": "2006-10-15",
     "area": 1.165
    },
    {
     "date": "2007-10-18",
     "area": 1.213
    },
    {
     "date": "2008-11-05",
     "area": 1.261
    },
    {
     "date": "2009-10-15",
     "area": 1.37
    },
    {
     "date": "2010-10-26",
     "area": 1.389
    },
    {
     "date": "2011-10-13",
     "area": 1.432
    },
    {
     "date": "2012-09-29",
     "area": 1.525
    },
    {
     "date": "2013-10-10",
     "area": 1.595
    },
    {
     "date": "2014-09-27",
     "area": 1.635
    },
    {
     "date": "2015-09-30",
     "area": 1.67
    }
   ],
   "sar": [],
   "published": [
    {
     "date": "2000-09-28",
     "area": 0.949
    },
    {
     "date": "2001-09-15",
     "area": 0.932
    },
    {
     "date": "2002-10-04",
     "area": 0.974
    },
    {
     "date": "2003-10-23",
     "area": 1.022
    },
    {
     "date": "2004-10-09",
     "area": 1.035
    },
    {
     "date": "2005-10-10",
     "area": 1.082
    },
    {
     "date": "2006-10-15",
     "area": 1.165
    },
    {
     "date": "2007-10-18",
     "area": 1.213
    },
    {
     "date": "2008-11-05",
     "area": 1.261
    },
    {
     "date": "2009-10-15",
     "area": 1.37
    },
    {
     "date": "2010-10-26",
     "area": 1.389
    },
    {
     "date": "2011-10-13",
     "area": 1.432
    },
    {
     "date": "2012-09-29",
     "area": 1.525
    },
    {
     "date": "2013-10-10",
     "area": 1.595
    },
    {
     "date": "2014-09-27",
     "area": 1.635
    },
    {
     "date": "2015-09-30",
     "area": 1.67
    }
   ]
  },
  {
   "id": "lumding",
   "name": "Lumding Tsho",
   "basin": "Hongu (Koshi)",
   "district": "Solukhumbu",
   "lat": 27.802,
   "lon": 86.87,
   "altitude_m": 4700,
   "monitored": false,
   "context": "A moraine-dammed lake in eastern Nepal whose glacier reaches the water. Rounce et al. (2016) rate its hazard High.",
   "keyStat": "0.77 km² in 2000 to 1.12 km² in 2015, about +44% (Rounce et al. 2016).",
   "exposure": {
    "places": [],
    "places_note": "Downstream settlements and infrastructure are not yet mapped by us.",
    "infrastructure": [],
    "mitigation": "No mitigation work recorded in the sources we used.",
    "households": null,
    "note": "Public geography and infrastructure only, from the sources listed in the fact sheet. No flood travel times, populations or discharges are modelled on this site."
   },
   "riskTier": "Moderate",
   "riskColor": "#FBBF24",
   "riskBasis": "Five-year growth to 2015, from published measurements",
   "latestAreaKm2": 1.115,
   "latestDate": "2015-09-30",
   "change3yrPct": 4.8,
   "change5yrPct": 12.7,
   "opticalIsPipeline": false,
   "sarIsReal": false,
   "optical": [
    {
     "date": "2000-09-12",
     "area": 0.773
    },
    {
     "date": "2001-10-07",
     "area": 0.797
    },
    {
     "date": "2002-10-04",
     "area": 0.821
    },
    {
     "date": "2003-11-08",
     "area": 0.818
    },
    {
     "date": "2004-10-17",
     "area": 0.851
    },
    {
     "date": "2005-10-28",
     "area": 0.887
    },
    {
     "date": "2006-09-05",
     "area": 0.888
    },
    {
     "date": "2007-11-19",
     "area": 0.9
    },
    {
     "date": "2008-10-12",
     "area": 0.965
    },
    {
     "date": "2009-10-15",
     "area": 0.977
    },
    {
     "date": "2010-10-26",
     "area": 0.989
    },
    {
     "date": "2011-10-29",
     "area": 1.001
    },
    {
     "date": "2012-10-31",
     "area": 1.064
    },
    {
     "date": "2013-10-10",
     "area": 1.071
    },
    {
     "date": "2014-11-14",
     "area": 1.094
    },
    {
     "date": "2015-09-30",
     "area": 1.115
    }
   ],
   "sar": [],
   "published": [
    {
     "date": "2000-09-12",
     "area": 0.773
    },
    {
     "date": "2001-10-07",
     "area": 0.797
    },
    {
     "date": "2002-10-04",
     "area": 0.821
    },
    {
     "date": "2003-11-08",
     "area": 0.818
    },
    {
     "date": "2004-10-17",
     "area": 0.851
    },
    {
     "date": "2005-10-28",
     "area": 0.887
    },
    {
     "date": "2006-09-05",
     "area": 0.888
    },
    {
     "date": "2007-11-19",
     "area": 0.9
    },
    {
     "date": "2008-10-12",
     "area": 0.965
    },
    {
     "date": "2009-10-15",
     "area": 0.977
    },
    {
     "date": "2010-10-26",
     "area": 0.989
    },
    {
     "date": "2011-10-29",
     "area": 1.001
    },
    {
     "date": "2012-10-31",
     "area": 1.064
    },
    {
     "date": "2013-10-10",
     "area": 1.071
    },
    {
     "date": "2014-11-14",
     "area": 1.094
    },
    {
     "date": "2015-09-30",
     "area": 1.115
    }
   ]
  },
  {
   "id": "hongu",
   "name": "Hongu (Chamlang South)",
   "basin": "Hongu (Koshi)",
   "district": "Solukhumbu",
   "lat": 27.78,
   "lon": 86.95,
   "altitude_m": 4900,
   "monitored": false,
   "context": "Chamlang South Tsho, below the south face of Chamlang. Stable in size, but Rounce et al. (2016) rate its hazard Very High because of steep glacier and moraine conditions.",
   "keyStat": "About 0.82 km² and steady from 2000 to 2015 (Rounce et al. 2016).",
   "exposure": {
    "places": [],
    "places_note": "Downstream settlements and infrastructure are not yet mapped by us.",
    "infrastructure": [],
    "mitigation": "No mitigation work recorded in the sources we used.",
    "households": null,
    "note": "Public geography and infrastructure only, from the sources listed in the fact sheet. No flood travel times, populations or discharges are modelled on this site."
   },
   "riskTier": "Low",
   "riskColor": "#4ADE80",
   "riskBasis": "Five-year growth to 2015, from published measurements",
   "latestAreaKm2": 0.818,
   "latestDate": "2015-09-30",
   "change3yrPct": 0.1,
   "change5yrPct": 0.1,
   "opticalIsPipeline": false,
   "sarIsReal": false,
   "optical": [
    {
     "date": "2000-09-12",
     "area": 0.815
    },
    {
     "date": "2005-11-05",
     "area": 0.822
    },
    {
     "date": "2010-10-26",
     "area": 0.817
    },
    {
     "date": "2015-09-30",
     "area": 0.818
    }
   ],
   "sar": [],
   "published": [
    {
     "date": "2000-09-12",
     "area": 0.815
    },
    {
     "date": "2005-11-05",
     "area": 0.822
    },
    {
     "date": "2010-10-26",
     "area": 0.817
    },
    {
     "date": "2015-09-30",
     "area": 0.818
    }
   ]
  }
 ]
};
