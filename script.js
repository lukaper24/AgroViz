const width = 1100;
const height = 520;
const margin = 55;

const svg = d3.select("#lineChart").attr("viewBox", `0 0 ${width} ${height}`);
const barSvg = d3.select("#barChart").attr("viewBox", `0 0 ${width} ${height}`);
const scatterSvg = d3.select("#scatterPlot").attr("viewBox", `0 0 ${width} ${height}`);
const pieSvg = d3.select("#pieChart").attr("viewBox", `0 0 ${width} ${height}`);
const mapSvg = d3.select("#worldMap").attr("viewBox", `0 0 ${width} ${height}`);
const largeMapSvg = d3.select("#largeWorldMap").attr("viewBox", `0 0 ${width} ${height}`);
const largePieSvg = d3.select("#largePieChart").attr("viewBox", `0 0 ${width} ${height}`);
const yearAnimationSvg = d3.select("#yearAnimationChart").attr("viewBox", `0 0 ${width} ${height}`);
const comparisonSvg = d3.select("#comparisonChart").attr("viewBox", `0 0 ${width} ${height}`);
const tooltip = d3.select("#tooltip");

const cropTranslations = {
    "Maize": "Kukuruz",
    "Potatoes": "Krumpir",
    "Rice, paddy": "Riža",
    "Sorghum": "Sirak",
    "Soybeans": "Soja",
    "Wheat": "Pšenica",
    "Cassava": "Manioka",
    "Sweet potatoes": "Slatki krumpir",
    "Plantains and others": "Trputac",
    "Yams": "Jam"
};

let allCleanData = [];
let currentFilteredData = [];
let animationTimer = null;

function translateCrop(crop) {
    return cropTranslations[crop] || crop;
}

d3.csv("data/yield_df.csv").then(data => {
    data.forEach(d => {
        d.yield = +d["hg/ha_yield"];
        d.rain = +d["average_rain_fall_mm_per_year"];
        d.temp = +d["avg_temp"];
        d.year = +d["Year"];
        d.pesticides = +d["pesticides_tonnes"];
        d.country = d["Area"];
        d.crop = d["Item"];
    });

    const cleanData = data.filter(d =>
        !isNaN(d.yield) &&
        !isNaN(d.rain) &&
        !isNaN(d.temp) &&
        !isNaN(d.year) &&
        d.country &&
        d.crop
    );

    allCleanData = cleanData;

    updateFilterOptions(cleanData);
    updateDashboard(cleanData);
    setupPieModal();
    setupAdvancedFeatures(cleanData);
    d3.select("#countryFilter").on("change", () => updateFilterOptions(cleanData));
    d3.select("#cropFilter").on("change", () => updateFilterOptions(cleanData));
    d3.select("#yearFilter").on("change", () => updateFilterOptions(cleanData));

    d3.select("#applyBtn").on("click", () => updateDashboard(cleanData));

    d3.select("#resetBtn").on("click", () => {
        d3.select("#countryFilter").property("value", "All");
        d3.select("#cropFilter").property("value", "All");
        d3.select("#yearFilter").property("value", "All");

        updateFilterOptions(cleanData);
        updateDashboard(cleanData);
    });

    d3.select("#loader")
        .transition()
        .duration(500)
        .style("opacity", 0)
        .on("end", function() {
            d3.select(this).style("display", "none");
        });
}).catch(error => {
    console.log("Greška pri učitavanju CSV datoteke:", error);

    d3.select("#loader").style("display", "none");
    d3.select("#noDataMessage")
        .style("display", "block")
        .text("Greška pri učitavanju podataka. Pokreni projekt preko Live Servera.");
});

function updateFilterOptions(data) {
    const selectedCountry = d3.select("#countryFilter").property("value") || "All";
    const selectedCrop = d3.select("#cropFilter").property("value") || "All";
    const selectedYear = d3.select("#yearFilter").property("value") || "All";

    const countryData = data.filter(d => {
        const cropMatch = selectedCrop === "All" || d.crop === selectedCrop;
        const yearMatch = selectedYear === "All" || d.year == selectedYear;
        return cropMatch && yearMatch;
    });

    const cropData = data.filter(d => {
        const countryMatch = selectedCountry === "All" || d.country === selectedCountry;
        const yearMatch = selectedYear === "All" || d.year == selectedYear;
        return countryMatch && yearMatch;
    });

    const yearData = data.filter(d => {
        const countryMatch = selectedCountry === "All" || d.country === selectedCountry;
        const cropMatch = selectedCrop === "All" || d.crop === selectedCrop;
        return countryMatch && cropMatch;
    });

    const countries = Array.from(new Set(countryData.map(d => d.country))).sort();
    const crops = Array.from(new Set(cropData.map(d => d.crop))).sort();
    const years = Array.from(new Set(yearData.map(d => d.year))).sort((a, b) => a - b);

    updateSelect("#countryFilter", countries, selectedCountry, "Sve države", d => d);
    updateSelect("#cropFilter", crops, selectedCrop, "Svi usjevi", d => translateCrop(d));
    updateSelect("#yearFilter", years, selectedYear, "Sve godine", d => d);
}

function updateSelect(selector, values, selectedValue, defaultText, labelFunction) {
    const select = d3.select(selector);

    select.selectAll("option").remove();

    select.append("option")
        .attr("value", "All")
        .text(defaultText);

    select.selectAll(".dynamic-option")
        .data(values)
        .enter()
        .append("option")
        .attr("class", "dynamic-option")
        .attr("value", d => d)
        .text(d => labelFunction(d));

    const fixedSelectedValue = isNaN(selectedValue) ? selectedValue : +selectedValue;
    const stillExists = selectedValue === "All" || values.includes(fixedSelectedValue);

    select.property("value", stillExists ? selectedValue : "All");
}

function getFilteredData(data) {
    const selectedCountry = d3.select("#countryFilter").property("value");
    const selectedCrop = d3.select("#cropFilter").property("value");
    const selectedYear = d3.select("#yearFilter").property("value");

    return data.filter(d => {
        const countryMatch = selectedCountry === "All" || d.country === selectedCountry;
        const cropMatch = selectedCrop === "All" || d.crop === selectedCrop;
        const yearMatch = selectedYear === "All" || d.year == selectedYear;
        return countryMatch && cropMatch && yearMatch;
    });
}

function updateDashboard(data) {
    const filteredData = getFilteredData(data);
    currentFilteredData = filteredData;

    if (filteredData.length === 0) {
        d3.select("#noDataMessage").style("display", "block");
        clearCharts();
        updateKpis([]);
        updateAnalytics([]);
        return;
    }

    d3.select("#noDataMessage").style("display", "none");

    updateKpis(filteredData);
    updateAnalytics(filteredData);
    drawLineChart(filteredData);
    drawBarChart(filteredData);
    drawScatterPlot(filteredData);
    drawPieChart(filteredData);
    drawWorldMap(filteredData);
    setupLargeMap(filteredData);
}

function updateKpis(data) {
    if (data.length === 0) {
        document.getElementById("avgYield").innerText = "-";
        document.getElementById("avgTemp").innerText = "-";
        document.getElementById("avgRain").innerText = "-";
        document.getElementById("recordCount").innerText = "0";
        return;
    }

    document.getElementById("avgYield").innerText = d3.mean(data, d => d.yield).toFixed(2);
    document.getElementById("avgTemp").innerText = d3.mean(data, d => d.temp).toFixed(2);
    document.getElementById("avgRain").innerText = d3.mean(data, d => d.rain).toFixed(2);
    document.getElementById("recordCount").innerText = data.length;
}

function updateAnalytics(data) {
    if (data.length === 0) {
        d3.select("#bestGrowth").text("-");
        d3.select("#topCountry").text("-");
        d3.select("#hottestYear").text("-");
        return;
    }

    const topCountryData = d3.rollups(
        data,
        v => d3.mean(v, d => d.yield),
        d => d.country
    ).sort((a, b) => b[1] - a[1]);

    d3.select("#topCountry").text(topCountryData.length ? topCountryData[0][0] : "-");

    const hottestYearData = d3.rollups(
        data,
        v => d3.mean(v, d => d.temp),
        d => d.year
    ).sort((a, b) => b[1] - a[1]);

    d3.select("#hottestYear").text(hottestYearData.length ? hottestYearData[0][0] : "-");

    const yearlyYield = d3.rollups(
        data,
        v => d3.mean(v, d => d.yield),
        d => d.year
    ).sort((a, b) => a[0] - b[0]);

    if (yearlyYield.length >= 2 && yearlyYield[0][1] !== 0) {
        const growth = (((yearlyYield[yearlyYield.length - 1][1] - yearlyYield[0][1]) / yearlyYield[0][1]) * 100).toFixed(2);
        d3.select("#bestGrowth").text(`${growth}%`);
    } else {
        d3.select("#bestGrowth").text("-");
    }
}

function clearCharts() {
    svg.selectAll("*").remove();
    barSvg.selectAll("*").remove();
    scatterSvg.selectAll("*").remove();
    pieSvg.selectAll("*").remove();
    mapSvg.selectAll("*").remove();
    largeMapSvg.selectAll("*").remove();
    largePieSvg.selectAll("*").remove();
    yearAnimationSvg.selectAll("*").remove();
    comparisonSvg.selectAll("*").remove();
}

function drawLineChart(data) {
    svg.selectAll("*").remove();

    const yearlyData = d3.rollups(
        data,
        v => d3.mean(v, d => d.yield),
        d => d.year
    ).sort((a, b) => a[0] - b[0]);

    if (yearlyData.length === 0) return;

    const x = d3.scaleLinear()
        .domain(d3.extent(yearlyData, d => d[0]))
        .range([margin, width - margin]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(yearlyData, d => d[1])])
        .nice()
        .range([height - margin, margin]);

    svg.append("g")
        .attr("transform", `translate(0,${height - margin})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
        .attr("transform", `translate(${margin},0)`)
        .call(d3.axisLeft(y));

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    const path = svg.append("path")
        .datum(yearlyData)
        .attr("fill", "none")
        .attr("stroke", "#2e7d32")
        .attr("stroke-width", 4)
        .attr("d", line);

    const totalLength = path.node().getTotalLength();

    path
        .attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1200)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    svg.selectAll("circle")
        .data(yearlyData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d[0]))
        .attr("cy", d => y(d[1]))
        .attr("r", 5)
        .attr("fill", "#2e7d32")
        .on("mouseover", (event, d) => {
            tooltip
                .style("opacity", 1)
                .html(`<strong>Godina:</strong> ${d[0]}<br><strong>Prinos:</strong> ${d[1].toFixed(2)}`)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
}

function drawBarChart(data) {
    barSvg.selectAll("*").remove();

    const selectedCountry = d3.select("#countryFilter").property("value");

    let chartData;
    let chartTitle;

    if (selectedCountry === "All") {
        chartData = d3.rollups(
            data,
            v => d3.mean(v, d => d.yield),
            d => d.country
        )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

        chartTitle = "Top 10 država po prinosu";
    } else {
        chartData = d3.rollups(
            data,
            v => d3.mean(v, d => d.yield),
            d => translateCrop(d.crop)
        )
        .sort((a, b) => b[1] - a[1]);

        chartTitle = `Prinos usjeva u državi ${selectedCountry}`;
    }

    d3.select(".bar-chart-title").text(chartTitle);

    if (chartData.length === 0) return;

    const x = d3.scaleBand()
        .domain(chartData.map(d => d[0]))
        .range([margin, width - margin])
        .padding(0.25);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[1])])
        .nice()
        .range([height - margin, margin]);

    barSvg.append("g")
        .attr("transform", `translate(0,${height - margin})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end");

    barSvg.append("g")
        .attr("transform", `translate(${margin},0)`)
        .call(d3.axisLeft(y));

    const bars = barSvg.selectAll("rect")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("x", d => x(d[0]))
        .attr("y", height - margin)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "#2196f3")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "#1565c0");

            tooltip
                .style("opacity", 1)
                .html(`<strong>${d[0]}</strong><br>Prosječni prinos: ${d[1].toFixed(2)}`)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#2196f3");
            tooltip.style("opacity", 0);
        });

    bars.transition()
        .duration(1000)
        .attr("y", d => y(d[1]))
        .attr("height", d => height - margin - y(d[1]));
}

function drawScatterPlot(data) {
    scatterSvg.selectAll("*").remove();

    const scatterData = data.filter(d => !isNaN(d.pesticides));
    if (scatterData.length === 0) return;

    const x = d3.scaleLinear()
        .domain([0, d3.max(scatterData, d => d.pesticides)])
        .nice()
        .range([margin, width - margin]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(scatterData, d => d.yield)])
        .nice()
        .range([height - margin, margin]);

    scatterSvg.append("g")
        .attr("transform", `translate(0,${height - margin})`)
        .call(d3.axisBottom(x));

    scatterSvg.append("g")
        .attr("transform", `translate(${margin},0)`)
        .call(d3.axisLeft(y));

    scatterSvg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 15)
        .attr("text-anchor", "middle")
        .text("Količina pesticida");

    scatterSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .text("Prinos usjeva");

    scatterSvg.selectAll("circle")
        .data(scatterData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.pesticides))
        .attr("cy", d => y(d.yield))
        .attr("r", 3)
        .attr("fill", "#f44336")
        .attr("opacity", 0.45)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 6).attr("opacity", 1);

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.country}</strong><br>
                    Usjev: ${translateCrop(d.crop)}<br>
                    Godina: ${d.year}<br>
                    Pesticidi: ${d.pesticides}<br>
                    Prinos: ${d.yield}
                `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 3).attr("opacity", 0.45);
            tooltip.style("opacity", 0);
        });
}

function getCropDistribution(data) {
    return d3.rollups(
        data,
        v => v.length,
        d => translateCrop(d.crop)
    ).sort((a, b) => b[1] - a[1]);
}

function drawPieChart(data) {
    pieSvg.selectAll("*").remove();

    const cropData = getCropDistribution(data);
    if (cropData.length === 0) return;

    const radius = Math.min(width, height) / 2.8;
    const g = pieSvg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    drawPie(g, pieSvg, cropData, radius, 12, 0.35, 18);
}

function drawLargePieChart(data) {
    largePieSvg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    largePieSvg.selectAll("*").remove();
    yearAnimationSvg.selectAll("*").remove();
    comparisonSvg.selectAll("*").remove();

    const cropData = getCropDistribution(data);
    if (cropData.length === 0) return;

    const radius = Math.min(width, height) / 2.6;
    const g = largePieSvg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    drawPie(g, largePieSvg, cropData, radius, 14, 0.25, 22);
}

function drawPie(g, targetSvg, cropData, radius, labelSize, minLabelAngle, centerTextSize) {
    const color = d3.scaleOrdinal()
        .domain(cropData.map(d => d[0]))
        .range(d3.schemeTableau10);

    const pie = d3.pie()
        .value(d => d[1])
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.45)
        .outerRadius(radius);

    const labelArc = d3.arc()
        .innerRadius(radius * 0.72)
        .outerRadius(radius * 0.72);

    const arcs = g.selectAll(".pie-arc")
        .data(pie(cropData))
        .enter()
        .append("g")
        .attr("class", "pie-arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data[0]))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            const total = d3.sum(cropData, item => item[1]);
            const percent = ((d.data[1] / total) * 100).toFixed(1);

            d3.select(this).attr("opacity", 0.75);

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.data[0]}</strong><br>
                    Broj zapisa: ${d.data[1]}<br>
                    Udio: ${percent}%
                `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 0);
        });

    arcs.append("text")
        .attr("transform", d => `translate(${labelArc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", `${labelSize}px`)
        .style("font-weight", "bold")
        .style("fill", "#111")
        .text(d => {
            const angle = d.endAngle - d.startAngle;
            return angle > minLabelAngle ? d.data[0] : "";
        });

    targetSvg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", `${centerTextSize}px`)
        .style("font-weight", "bold")
        .style("fill", "#2d6a4f")
        .text("Usjevi");
}

function applyCountryFromMap(countryName) {
    const existsInData = allCleanData.some(d => d.country === countryName);
    if (!existsInData) return;

    d3.select("#countryFilter").property("value", countryName);
    d3.select("#cropFilter").property("value", "All");
    d3.select("#yearFilter").property("value", "All");

    updateFilterOptions(allCleanData);
    d3.select("#countryFilter").property("value", countryName);

    updateDashboard(allCleanData);
}

function drawWorldMap(data) {
    mapSvg.selectAll("*").remove();

    const countryYield = d3.rollups(
        data,
        v => d3.mean(v, d => d.yield),
        d => d.country
    );

    const yieldMap = new Map(countryYield);

    const color = d3.scaleSequential()
        .domain([0, d3.max(countryYield, d => d[1])])
        .interpolator(d3.interpolateGreens);

    const projection = d3.geoNaturalEarth1()
        .scale(180)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(world => {
        const countries = topojson.feature(world, world.objects.countries).features;

        mapSvg.selectAll("path")
            .data(countries)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", d => {
                const value = yieldMap.get(d.properties.name);
                return value ? color(value) : "#e0e0e0";
            })
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 0.5)
            .on("mouseover", function(event, d) {
                const value = yieldMap.get(d.properties.name);

                d3.select(this).attr("stroke", "#000").attr("stroke-width", 2.5);

                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.properties.name}</strong><br>
                        Prosječni prinos: ${value ? value.toFixed(2) : "Nema podataka"}
                    `)
                    .style("left", event.pageX + 12 + "px")
                    .style("top", event.pageY - 28 + "px");
            })
            .on("click", function(event, d) {
                applyCountryFromMap(d.properties.name);
                event.stopPropagation();
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 0.5);
                tooltip.style("opacity", 0);
            });
    }).catch(error => {
        console.log("Greška pri učitavanju karte:", error);
    });
}

function setupLargeMap(data) {
    d3.select("#worldMap").on("click", () => {
        d3.select("#mapModal").style("display", "block");
        drawLargeWorldMap(data);
    });

    d3.select("#closeMapModal").on("click", () => {
        d3.select("#mapModal").style("display", "none");
        tooltip.style("opacity", 0);
    });

    d3.select("#mapModal").on("click", function(event) {
        if (event.target.id === "mapModal") {
            d3.select("#mapModal").style("display", "none");
            tooltip.style("opacity", 0);
        }
    });
}

function drawLargeWorldMap(data) {
    largeMapSvg.selectAll("*").remove();

    const countryYield = d3.rollups(
        data,
        v => d3.mean(v, d => d.yield),
        d => d.country
    );

    const yieldMap = new Map(countryYield);

    const color = d3.scaleSequential()
        .domain([0, d3.max(countryYield, d => d[1])])
        .interpolator(d3.interpolateGreens);

    const projection = d3.geoNaturalEarth1()
        .scale(210)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(world => {
        const countries = topojson.feature(world, world.objects.countries).features;

        largeMapSvg.selectAll("path")
            .data(countries)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", d => {
                const value = yieldMap.get(d.properties.name);
                return value ? color(value) : "#e0e0e0";
            })
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 0.5)
            .on("click", function(event, d) {
                d3.select("#mapModal").style("display", "none");
                applyCountryFromMap(d.properties.name);
                event.stopPropagation();
            })
            .on("mouseover", function(event, d) {
                const value = yieldMap.get(d.properties.name);

                d3.select(this).attr("stroke", "#000").attr("stroke-width", 2.5);

                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.properties.name}</strong><br>
                        Prosječni prinos: ${value ? value.toFixed(2) : "Nema podataka"}
                    `)
                    .style("left", event.pageX + 12 + "px")
                    .style("top", event.pageY - 28 + "px");
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", event.pageX + 12 + "px")
                    .style("top", event.pageY - 28 + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 0.5);
                tooltip.style("opacity", 0);
            });
    }).catch(error => {
        console.log("Greška pri učitavanju velike karte:", error);
    });
}

function setupPieModal() {
    const pieCard = document.getElementById("openPieModal");
    const pieModal = document.getElementById("pieModal");
    const closePieModal = document.getElementById("closePieModal");

    if (!pieCard || !pieModal || !closePieModal) return;

    const openModal = () => {
        const data = currentFilteredData.length ? currentFilteredData : getFilteredData(allCleanData);

        pieModal.style.display = "block";

        requestAnimationFrame(() => {
            drawLargePieChart(data);
        });
    };

    const closeModal = () => {
        pieModal.style.display = "none";
        largePieSvg.selectAll("*").remove();
    yearAnimationSvg.selectAll("*").remove();
    comparisonSvg.selectAll("*").remove();
        tooltip.style("opacity", 0);
    };

    pieCard.addEventListener("click", openModal);

    pieCard.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openModal();
        }
    });

    closePieModal.addEventListener("click", closeModal);

    pieModal.addEventListener("click", event => {
        if (event.target.id === "pieModal") {
            closeModal();
        }
    });
}

d3.select("#themeToggle").on("click", function() {
    const isDark = document.body.classList.toggle("dark-mode");
    d3.select(this).text(isDark ? "☀️ Svijetli način" : "🌙 Tamni način");
});


function setupAdvancedFeatures(data) {
    populateComparisonFilters(data);

    d3.select("#playAnimationBtn").on("click", () => {
        drawYearAnimation(data);
    });

    d3.select("#compareBtn").on("click", () => {
        drawComparisonChart(data);
    });
}

function populateComparisonFilters(data) {
    const countries = Array.from(new Set(data.map(d => d.country))).sort();

    fillSimpleSelect("#compareCountryA", countries, null, d => d);
    fillSimpleSelect("#compareCountryB", countries, null, d => d);

    d3.select("#compareCountryA").property("value", countries.includes("Croatia") ? "Croatia" : countries[0]);
    d3.select("#compareCountryB").property("value", countries.includes("United Kingdom") ? "United Kingdom" : countries[1]);

    updateComparisonCropsAndYears(data);
    drawComparisonChart(data);

    d3.select("#compareCountryA").on("change", () => {
        updateComparisonCropsAndYears(data);
        drawComparisonChart(data);
    });

    d3.select("#compareCountryB").on("change", () => {
        updateComparisonCropsAndYears(data);
        drawComparisonChart(data);
    });

    d3.select("#compareCrop").on("change", () => {
        updateComparisonYears(data);
        drawComparisonChart(data);
    });

    d3.select("#compareYear").on("change", () => {
        drawComparisonChart(data);
    });
}

function updateComparisonCropsAndYears(data) {
    const countryA = d3.select("#compareCountryA").property("value");
    const countryB = d3.select("#compareCountryB").property("value");

    const cropSelect = d3.select("#compareCrop");
    const yearSelect = d3.select("#compareYear");

    cropSelect.selectAll("option").remove();
    yearSelect.selectAll("option").remove();

    if (!countryA || !countryB || countryA === countryB) {
        cropSelect.append("option").attr("value", "").text("Odaberi dvije različite države");
        yearSelect.append("option").attr("value", "").text("Nema godina");
        return;
    }

    const dataA = data.filter(d => d.country === countryA);
    const dataB = data.filter(d => d.country === countryB);

    const cropsA = new Set(dataA.map(d => d.crop));
    const cropsB = new Set(dataB.map(d => d.crop));

    const commonCrops = [...cropsA].filter(crop => cropsB.has(crop)).sort();

    if (commonCrops.length === 0) {
        cropSelect.append("option").attr("value", "").text("Nema zajedničkih usjeva");
        yearSelect.append("option").attr("value", "").text("Nema godina");
        return;
    }

    fillSimpleSelect("#compareCrop", commonCrops, null, d => translateCrop(d));
    cropSelect.property("value", commonCrops[0]);

    updateComparisonYears(data);
}

function updateComparisonYears(data) {
    const countryA = d3.select("#compareCountryA").property("value");
    const countryB = d3.select("#compareCountryB").property("value");
    const crop = d3.select("#compareCrop").property("value");

    const yearSelect = d3.select("#compareYear");
    yearSelect.selectAll("option").remove();

    if (!countryA || !countryB || !crop || countryA === countryB) {
        yearSelect.append("option").attr("value", "").text("Nema godina");
        return;
    }

    const yearsA = new Set(
        data.filter(d => d.country === countryA && d.crop === crop).map(d => d.year)
    );

    const yearsB = new Set(
        data.filter(d => d.country === countryB && d.crop === crop).map(d => d.year)
    );

    const commonYears = [...yearsA].filter(year => yearsB.has(year)).sort((a, b) => a - b);

    if (commonYears.length === 0) {
        yearSelect.append("option").attr("value", "").text("Nema zajedničkih godina");
        return;
    }

    fillSimpleSelect("#compareYear", commonYears, null, d => d);
    yearSelect.property("value", commonYears[0]);
}

function fillSimpleSelect(selector, values, defaultText, labelFunction) {
    const select = d3.select(selector);
    select.selectAll("option").remove();

    if (defaultText) {
        select.append("option")
            .attr("value", "All")
            .text(defaultText);
    }

    select.selectAll("option.dynamic")
        .data(values)
        .enter()
        .append("option")
        .attr("class", "dynamic")
        .attr("value", d => d)
        .text(d => labelFunction(d));
}
function updateComparisonOptions(data) {

    const countryA = d3.select("#compareCountryA").property("value");
    const countryB = d3.select("#compareCountryB").property("value");

    if (!countryA || !countryB) return;

    const dataA = data.filter(d => d.country === countryA);
    const dataB = data.filter(d => d.country === countryB);

    const cropsA = new Set(dataA.map(d => d.crop));
    const cropsB = new Set(dataB.map(d => d.crop));

    const commonCrops = [...cropsA]
        .filter(crop => cropsB.has(crop))
        .sort();

    fillSimpleSelect(
        "#compareCrop",
        commonCrops,
        null,
        d => translateCrop(d)
    );

    if (commonCrops.length > 0) {
    d3.select("#compareCrop")
        .property("value", commonCrops[0]);
}

    const selectedCrop = d3.select("#compareCrop").property("value");

    const filteredA = selectedCrop === "All"
        ? dataA
        : dataA.filter(d => d.crop === selectedCrop);

    const filteredB = selectedCrop === "All"
        ? dataB
        : dataB.filter(d => d.crop === selectedCrop);

    const yearsA = new Set(filteredA.map(d => d.year));
    const yearsB = new Set(filteredB.map(d => d.year));

    const commonYears = [...yearsA]
        .filter(year => yearsB.has(year))
        .sort((a, b) => a - b);

    fillSimpleSelect(
        "#compareYear",
        commonYears,
        null,
        d => d
    );
}

function fillSimpleSelect(selector, values, defaultText, labelFunction) {
    const select = d3.select(selector);
    select.selectAll("option").remove();

    if (defaultText) {
        select.append("option")
            .attr("value", "All")
            .text(defaultText);
    }

    select.selectAll(".option")
        .data(values)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => labelFunction(d));
}

function drawYearAnimation(data) {
    yearAnimationSvg.interrupt();

    yearAnimationSvg.selectAll("*").remove();

    const selectedCountry = d3.select("#countryFilter").property("value");
    const selectedCrop = d3.select("#cropFilter").property("value");

    if (selectedCountry === "All" || selectedCrop === "All") {
        d3.select("#animationStatus")
            .text("Za animaciju prvo odaberi jednu državu i jedan usjev u glavnim filterima.");

        yearAnimationSvg.append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", 24)
            .attr("fill", "#2d6a4f")
            .text("Odaberi državu i usjev za animaciju kroz godine.");
        return;
    }

    const animationData = d3.rollups(
        data.filter(d => d.country === selectedCountry && d.crop === selectedCrop),
        v => d3.mean(v, d => d.yield),
        d => d.year
    ).sort((a, b) => a[0] - b[0]);

    if (animationData.length < 2) {
        d3.select("#animationStatus")
            .text("Nema dovoljno podataka za animaciju odabrane kombinacije.");
        return;
    }

    d3.select("#animationStatus")
        .text(`Animacija: ${selectedCountry} — ${translateCrop(selectedCrop)}`);

    const x = d3.scaleLinear()
        .domain(d3.extent(animationData, d => d[0]))
        .range([margin, width - margin]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(animationData, d => d[1])])
        .nice()
        .range([height - margin, margin]);

    yearAnimationSvg.append("g")
        .attr("transform", `translate(0,${height - margin})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    yearAnimationSvg.append("g")
        .attr("transform", `translate(${margin},0)`)
        .call(d3.axisLeft(y));

    yearAnimationSvg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 12)
        .attr("text-anchor", "middle")
        .text("Godina");

    yearAnimationSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .text("Prosječni prinos");

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    const animatedPath = yearAnimationSvg.append("path")
        .datum([animationData[0]])
        .attr("fill", "none")
        .attr("stroke", "#1b4332")
        .attr("stroke-width", 5)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", line);

    const movingCircle = yearAnimationSvg.append("circle")
        .attr("r", 9)
        .attr("fill", "#f59e0b")
        .attr("stroke", "#1b4332")
        .attr("stroke-width", 3)
        .attr("cx", x(animationData[0][0]))
        .attr("cy", y(animationData[0][1]));

    const yearLabel = yearAnimationSvg.append("text")
        .attr("x", width - 190)
        .attr("y", 85)
        .attr("font-size", 34)
        .attr("font-weight", "bold")
        .attr("fill", "#1b4332")
        .text(animationData[0][0]);

    const valueLabel = yearAnimationSvg.append("text")
        .attr("x", width - 190)
        .attr("y", 125)
        .attr("font-size", 18)
        .attr("fill", "#2d6a4f")
        .text(`Prinos: ${animationData[0][1].toFixed(2)}`);

    const duration = 12000;

let interpolatedData = [];

const yearInterpolator = d3.scaleLinear()
    .domain([0, animationData.length - 1])
    .range([0, animationData.length - 1]);

d3.transition()
    .duration(duration)
        .ease(d3.easeLinear)    
        .tween("smooth-animation", function() {
        return function(t) {
            const position = yearInterpolator(t * (animationData.length - 1));
            const index = Math.floor(position);
            const nextIndex = Math.min(index + 1, animationData.length - 1);
            const localT = position - index;

            const currentYear = d3.interpolateNumber(
                animationData[index][0],
                animationData[nextIndex][0]
            )(localT);

            const currentYield = d3.interpolateNumber(
                animationData[index][1],
                animationData[nextIndex][1]
            )(localT);

            interpolatedData = animationData.slice(0, index + 1);
            interpolatedData.push([currentYear, currentYield]);

            animatedPath
                .datum(interpolatedData)
                .attr("d", line);

            movingCircle
                .attr("cx", x(currentYear))
                .attr("cy", y(currentYield));

            yearLabel.text(Math.round(currentYear));
            valueLabel.text(`Prinos: ${currentYield.toFixed(2)}`);

            d3.select("#animationStatus")
                .text(`${selectedCountry} — ${translateCrop(selectedCrop)} | Godina: ${Math.round(currentYear)} | Prinos: ${currentYield.toFixed(2)}`);
        };
    })
    .on("end", function() {
        d3.select("#animationStatus").text("Animacija je završena.");
    });
}
function drawComparisonChart(data) {
    comparisonSvg.selectAll("*").remove();

    const countryA = d3.select("#compareCountryA").property("value");
    const countryB = d3.select("#compareCountryB").property("value");
    const crop = d3.select("#compareCrop").property("value");
    const year = d3.select("#compareYear").property("value");

    if (!countryA || !countryB || countryA === countryB) {
        showComparisonMessage("Odaberi dvije različite države za usporedbu.");
        return;
    }

    if (!crop) {
        showComparisonMessage("Odabrane države nemaju zajednički usjev.");
        return;
    }

    if (!year) {
        showComparisonMessage("Za odabrani usjev nema zajedničke godine.");
        return;
    }

    const filtered = data.filter(d =>
        (d.country === countryA || d.country === countryB) &&
        d.crop === crop &&
        d.year == year
    );

    const dataA = filtered.filter(d => d.country === countryA);
    const dataB = filtered.filter(d => d.country === countryB);

    if (dataA.length === 0 || dataB.length === 0) {
        showComparisonMessage("Za ovu kombinaciju nema podataka za obje države.");
        return;
    }

    const metrics = [
        { key: "yield", label: "Prinos" },
        { key: "temp", label: "Temperatura" },
        { key: "rain", label: "Oborine" }
    ];

    const chartData = metrics.flatMap(metric => [
        {
            metric: metric.label,
            country: countryA,
            value: d3.mean(dataA, d => d[metric.key])
        },
        {
            metric: metric.label,
            country: countryB,
            value: d3.mean(dataB, d => d[metric.key])
        }
    ]);

    const innerMargin = { top: 60, right: 40, bottom: 75, left: 85 };
    const chartWidth = width - innerMargin.left - innerMargin.right;
    const chartHeight = height - innerMargin.top - innerMargin.bottom;

    const g = comparisonSvg.append("g")
        .attr("transform", `translate(${innerMargin.left},${innerMargin.top})`);

    const x0 = d3.scaleBand()
        .domain(metrics.map(d => d.label))
        .range([0, chartWidth])
        .padding(0.35);

    const x1 = d3.scaleBand()
        .domain([countryA, countryB])
        .range([0, x0.bandwidth()])
        .padding(0.12);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value)])
        .nice()
        .range([chartHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain([countryA, countryB])
        .range(["#2d6a4f", "#f59e0b"]);

    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x0));

    g.append("g")
        .call(d3.axisLeft(y));

    const groups = g.selectAll(".metric-group")
        .data(metrics)
        .enter()
        .append("g")
        .attr("transform", d => `translate(${x0(d.label)},0)`);

    groups.selectAll("rect")
        .data(metric => chartData.filter(d => d.metric === metric.label))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.country))
        .attr("y", chartHeight)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("rx", 8)
        .attr("fill", d => color(d.country))
        .on("mouseover", function(event, d) {
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.country}</strong><br>
                    ${d.metric}: ${d.value.toFixed(2)}
                `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .transition()
        .duration(900)
        .attr("y", d => y(d.value))
        .attr("height", d => chartHeight - y(d.value));

    comparisonSvg.append("text")
        .attr("x", width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("font-size", 20)
        .attr("font-weight", "bold")
        .attr("fill", "#1b4332")
        .text(`${countryA} vs ${countryB} — ${translateCrop(crop)} — ${year}`);

    const yieldA = chartData.find(
    d => d.country === countryA && d.metric === "Prinos"
).value;

const yieldB = chartData.find(
    d => d.country === countryB && d.metric === "Prinos"
).value;

let summary = "";

if (yieldA > yieldB) {

    const diff = ((yieldA - yieldB) / yieldB * 100);

    summary =
        `${countryA} ima ${diff.toFixed(1)}% veći prinos od države ${countryB} za usjev ${translateCrop(crop)} u godini ${year}.`;

}
else if (yieldB > yieldA) {

    const diff = ((yieldB - yieldA) / yieldA * 100);

    summary =
        `${countryB} ima ${diff.toFixed(1)}% veći prinos od države ${countryA} za usjev ${translateCrop(crop)} u godini ${year}.`;

}
else {

    summary =
        `Obje države imaju jednak prosječni prinos za usjev ${translateCrop(crop)} u godini ${year}.`;

}

d3.select("#comparisonSummary").text(summary);
}

function showComparisonMessage(message) {
    comparisonSvg.selectAll("*").remove();

    comparisonSvg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 24)
        .attr("font-weight", "bold")
        .attr("fill", "#b00020")
        .text(message);

    d3.select("#comparisonSummary").text("");
}