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
