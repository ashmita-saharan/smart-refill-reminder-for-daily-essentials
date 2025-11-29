// -------------------------------
// HARD-CODED CONFIG
// -------------------------------
const CHANNEL_ID = 3179656;
const READ_API_KEY = "5CVMLSG7B21I4HRO";

// Chart instance
let chart = null;
let chart2 = null;
let alertShown = false; // prevents repeating

function showFullAlert(msg) {
    document.getElementById("full-alert-msg").innerText = msg;
    document.getElementById("full-alert").style.display = "flex";
}

function closeFullAlert() {
    document.getElementById("full-alert").style.display = "none";
	showInlineAlert("Low weight Alert: Please Refill!!");
}

// -------------------------------
// FETCH DATA FROM THINGSPEAK
// -------------------------------
async function loadData() {
    console.log("Fetching ThingSpeak data...");

    const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/fields/1.json?api_key=${READ_API_KEY}&results=200`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.feeds) {
            console.error("No feeds found!");
            return;
        }

        console.log("Raw ThingSpeak Feeds:", data.feeds);

        // Parse valid points
        const points = data.feeds
            .map(f => {
                const weight = parseFloat(f.field1);
                if (isNaN(weight) || weight === 0) return null; // remove zero/invalid values
                return {
                    time: new Date(f.created_at),
                    weight: weight
                };
            })
            .filter(x => x !== null);

        console.log("Filtered Points:", points);

        if (points.length < 2) {
            console.warn("Not enough valid points for chart.");
            return;
        }

        updateMetrics(points);
        drawChart(points);

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}
function showInlineAlert(msg) {
    const box = document.getElementById("inline-alert");
    document.getElementById("inline-alert-msg").innerText = msg;
    box.style.display = "block";
}

function hideInlineAlert() {
    document.getElementById("inline-alert").style.display = "none";
}
// -------------------------------
// CALCULATE AVG CONSUMPTION + DAYS REMAINING
// -------------------------------
function updateMetrics(points) {
    console.log("Updating metrics...");

    // Sort by time
    points.sort((a, b) => a.time - b.time);

    const labels = points.map(p => p.time.toLocaleString());
    const weights = points.map(p => p.weight);

    // Consumption calculation using slope
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        const x = i;            // treat index as time for simplicity
        const y = weights[i];

        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = (n * sumX2) - (sumX * sumX);

    let slope = numerator / denominator;
    slope = Math.abs(slope); // weight decreases → negative slope

    const avgConsumption = slope;
    console.log("Average Consumption:", avgConsumption);

    const latestWeight = weights[weights.length - 1];
    const daysLeft = latestWeight / avgConsumption;

    // Update UI
    document.getElementById("current-weight").innerText = latestWeight.toFixed(2) + " g";
    document.getElementById("avg-consumption").innerText = avgConsumption.toFixed(2) + " g/day";
    document.getElementById("days-remaining").innerText = daysLeft.toFixed(2) + " days";
    document.getElementById("last-update").innerText = points[points.length - 1].time.toLocaleString();

    // -------------------------------
    // 🔥 ADDED FOR LOW STOCK ALERT
    // -------------------------------
    const TOTAL_CAPACITY = 500;  // adjust for your container
	const percent = (latestWeight / TOTAL_CAPACITY) * 100;

	if (percent < 20) {
		showInlineAlert(`Warning: Only ${percent.toFixed(1)}% remaining!`);
		if (!alertShown) { // shows only once
			showFullAlert(`Only ${percent.toFixed(1)}% weight remaining! Refill soon.`);
			alertShown = true;
		}
	} else {
		hideInlineAlert();
		alertShown = false; // reset if weight goes above 20%
	}
    // -------------------------------
	let percentPerDay = [];
	
	for (let i =1; i<weights.length; i++) {
		const percent = ((weights[i-1] - weights[i]) / TOTAL_CAPACITY) * 100;
		percentPerDay.push(percent.toFixed(2));
	}
	const percentLabels = points.slice(1).map(p => p.time.toLocaleTimeString());
	drawPercentChart(percentLabels, percentPerDay);
	
	drawChart(points);
}

// -------------------------------
// DRAW CHART WITH CLEAN DATA
// -------------------------------
function drawChart(points) {
    const labels = points.map(p => p.time.toLocaleTimeString());
    const weights = points.map(p => p.weight);

    console.log("Chart labels:", labels);
    console.log("Chart data:", weights);

    const ctx = document.getElementById("weightChart").getContext("2d");

    if (chart !== null) chart.destroy();

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Weight (g)",
                data: weights,
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
			maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false },
                x: { display: true }
            }
        }
    });
}

function drawPercentChart(labels, data) {
    const ctx = document.getElementById("percentChart").getContext("2d");

    if (chart2 !== null) chart2.destroy();

    chart2 = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Percentage Used Per Day (%)",
                data: data,
                borderWidth: 2,
                tension: 0.3,
                borderDash: [5, 5]
            }]
        },
        options: {
            responsive: true,
			maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 10 },
                x: { display: true }
            }
        }
    });
}

// -------------------------------
// LOAD DATA WHEN PAGE OPENS
// -------------------------------
window.addEventListener("load", () => {
    console.log("Page loaded → Fetching data...");
    loadData();
});

document.getElementById("updateButton").addEventListener("click", () => {
    console.log("Update button clicked → refreshing data...");
    loadData();  // Reloads ThingSpeak + updates graph
});

function reloadPageAfterDelay() {
	setTimeout(function(){
		location.reload();
	}, 15000);
}
reloadPageAfterDelay();
