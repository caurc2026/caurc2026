const API_URL = "https://script.google.com/macros/s/AKfycbzJHiXl4mReuXnMw7tlq0tFjWEohLyliHHJiwqOSBhqJI_FMdznFofkxAbvHjqq6vKqfg/exec";
let masterData = null;
let currentCategory = "";
let currentLevel = null;

async function loadData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        masterData = data["MasterList"] || [];
        $('#last-updated-tag').text(`Sync: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
        if (currentCategory) renderScoreboard();
    } catch (e) { console.error("Sync Error"); }
}

function changeView(category, level) {
    currentCategory = category;
    currentLevel = parseInt(level); // Ensure it is an integer for comparison
    
    const levelNames = { 
        1: "Beginner", 
        2: "Intermediate", 
        3: "Finals" 
    };

    $('#current-category').text(category);
    // Fixed: Now correctly pulls from the levelNames mapping
    $('#current-level').text(`${levelNames[currentLevel]} (LEVEL ${currentLevel})`);
    renderScoreboard();
}

function renderScoreboard() {
    const container = $('#scoreboard-output');
    if (!masterData) return;
    container.empty();

    let filtered = masterData.filter(row => 
        row.Category === currentCategory && parseInt(row.Level) === currentLevel
    );

    if (currentCategory === "Sumo") {
        // Sort by total wins (Counting 1s in the "1;0;1;0" string)
        filtered.sort((a, b) => {
            let winA = (a["Score/Time"] || "").split(";").filter(x => x.trim() === "1").length;
            let winB = (b["Score/Time"] || "").split(";").filter(x => x.trim() === "1").length;
            return winB - winA; // Highest wins first
        });
    } else {
        // Line Following Sort (Lowest Average Time first)
        filtered.sort((a, b) => {
            let avgA = parseFloat((a["Score/Time"] || "").split(";")[2]) || 999.9;
            let avgB = parseFloat((b["Score/Time"] || "").split(";")[2]) || 999.9;
            return avgA - avgB;
        });
    }

    if (currentLevel === 3) renderChampionView(container, filtered);
    else renderStandardView(container, filtered);
}

function renderStandardView(container, teams) {
    const allPublished = teams.length > 0 && teams.every(t => String(t.Status).toUpperCase() === "TRUE");
    container.empty();

    if (currentCategory === "Sumo") {
        // Logic to determine if we group by "Group" (Level 1) or "Round" (Level 2)
        const groupingType = (currentLevel === 2) ? "Round" : "Group";
        
        // Identify all unique groups/rounds present in the Rank column
        const groups = [...new Set(teams.map(t => String(t.Rank).trim()))].sort();
        
        groups.forEach(groupName => {
            const groupTeams = teams.filter(t => String(t.Rank).trim() === groupName);
            if (groupTeams.length > 0) {
                // Dynamic Header based on Level (Group vs Round)
                container.append(`
                    <div class="flex items-center gap-4 mt-10 mb-4">
                        <div class="h-8 w-1 ${currentLevel === 2 ? 'bg-cyan-500' : 'bg-red-600'}"></div>
                        <h3 class="text-3xl font-black text-white tracking-widest uppercase italic">
                            ${groupingType} ${groupName} 
                            <span class="text-slate-600 text-sm ml-4 font-normal not-italic">Category: Sumo Level ${currentLevel}</span>
                        </h3>
                    </div>
                `);
                renderSumoTable(container, groupTeams, allPublished);
            }
        });
    } else {
        // --- LINE FOLLOWING VIEW ---
        renderSumoTable(container, teams, allPublished);
    }
}

function renderSumoTable(container, teams, allPublished) {
    let tableHeaders = "";
    if (currentCategory === "Sumo") {
        tableHeaders = `
            <th class="p-6 text-center w-20">Rank</th>
            <th class="p-6">Team Name</th>
            <th class="p-6 text-center">Set Standing</th>
            <th class="p-6 text-center text-green-400">W</th>
            <th class="p-6 text-center text-red-400">L</th>
        `;
    } else {
        tableHeaders = `
            <th class="p-6 text-center w-24">Rank</th>
            <th class="p-6">Team Name</th>
            <th class="p-6 text-center border-x border-white/5">1st Run</th>
            <th class="p-6 text-center border-r border-white/5">2nd Run</th>
            <th class="p-6 text-right text-cyan-400">Average</th>
        `;
    }

    let html = `<div class="glass-table-container shadow-2xl mb-8"><table class="w-full text-left">
        <thead><tr class="bg-white/5 uppercase text-[10px] tracking-[0.3em] text-slate-500 font-black">${tableHeaders}</tr></thead>
        <tbody class="divide-y divide-white/5">`;

    teams.forEach((team, index) => {
        let isPublished = String(team.Status).toUpperCase() === "TRUE";
        let displayRank = index + 1;
        let icon = "";
        let highlight = "";
        let rankClass = "text-slate-500";

        if (currentCategory === "Sumo") {
            // Automatically handles 4 sets (Level 1) or 3 sets (Level 2)
            let rawScore = team["Score/Time"] || "0;0;0";
            let sets = rawScore.split(";");
            let winCount = sets.filter(x => x.trim() === "1").length;
            let lossCount = sets.filter(x => x.trim() === "0").length;

            if (allPublished && index === 0 && winCount > 0) {
                icon = '<span class="animate-flicker mr-2">⭐</span>';
                highlight = "qualifier-glow-gold";
                rankClass = "rank-text-1 font-black";
            }

            let setIconsHtml = `<div class="flex justify-center gap-2">`;
            sets.forEach(val => {
                if (val.trim() === "1") setIconsHtml += `<span class="text-green-500">✅</span>`;
                else if (val.trim() === "0") setIconsHtml += `<span class="text-red-500 text-[10px]">❌</span>`;
            });
            setIconsHtml += `</div>`;

            html += `<tr class="${highlight} ${!isPublished ? 'opacity-40' : ''} hover:bg-white/5 transition-colors">
                <td class="p-6 text-2xl font-black text-center ${rankClass}">${icon}${displayRank}</td>
                <td class="p-6 text-xl font-bold text-slate-100">${isPublished ? team["Team Name"] : "PENDING..."}</td>
                <td class="p-6 text-center">${isPublished ? setIconsHtml : "---"}</td>
                <td class="p-6 text-3xl font-black text-green-400 text-center">${isPublished ? winCount : "-"}</td>
                <td class="p-6 text-3xl font-black text-red-400 text-center">${isPublished ? lossCount : "-"}</td>
            </tr>`;
        } else {
            // Line Following Logic...
            let parts = (team["Score/Time"] || "--;--;--").split(";");
            let run1 = isPublished && parts[0] ? parts[0] + "s" : "--";
            let run2 = isPublished && parts[1] ? parts[1] + "s" : "--";
            let avg = isPublished && parts[2] ? parts[2] + "s" : "--.--";
            
            if (allPublished) {
                if (index === 0) { icon = "⭐ "; rankClass = "rank-text-1"; }
                else if (index === 1) { icon = "🥈 "; rankClass = "rank-text-2"; }
                else if (index === 2) { icon = "🥉 "; rankClass = "rank-text-3"; }
            }

            html += `<tr class="${highlight} ${!isPublished ? 'opacity-40' : ''} hover:bg-white/5 transition-colors">
                <td class="p-6 text-2xl font-black text-center ${rankClass}">${icon}${displayRank}</td>
                <td class="p-6 text-xl font-bold">${isPublished ? team["Team Name"] : "PENDING..."}</td>
                <td class="p-6 text-2xl text-center border-x border-white/5">${run1}</td>
                <td class="p-6 text-2xl text-center border-r border-white/5">${run2}</td>
                <td class="p-6 text-4xl font-mono text-cyan-400 text-right">${avg}</td>
            </tr>`;
        }
    });

    html += `</tbody></table></div>`;
    container.append(html);
}

function renderChampionView(container, teams) {
    const allPublished = teams.length > 0 && teams.every(t => String(t.Status).toUpperCase() === "TRUE");
    let html = `<div class="flex flex-col gap-6 max-w-4xl mx-auto mt-10">`;

    const lineIcon = `<svg class="w-4 h-4 mr-2 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"></path></svg>`;
    const sumoIcon = `<svg class="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`;

    teams.forEach((team, index) => {
        if (index >= 3) return; 
        
        let isPublished = String(team.Status).toUpperCase() === "TRUE";
        let teamName = (allPublished && isPublished) ? team["Team Name"] : "VERIFYING...";
        let iconEmoji = index === 0 ? "⭐" : index === 1 ? "🥈" : "🥉";
        let iconHtml = allPublished ? `<span class="champion-icon mr-4">${iconEmoji}</span>` : "";
        
        let rankLabel = "";
        let categorySvg = (currentCategory === "Sumo") ? sumoIcon : lineIcon;
        
        if (currentCategory === "Sumo") {
            rankLabel = index === 0 ? "Grand Sumo Champion" : index === 1 ? "Sumo Runner Up" : "Third Place Finalist";
        } else {
            rankLabel = index === 0 ? "Tournament Champion" : index === 1 ? "1st Runner Up" : "2nd Runner Up";
        }

        let cardStyle = allPublished ? "champion-card-reveal border-yellow-500/50 shadow-2xl" : "opacity-30 border-slate-800";
        
        // Celebration Logic for Rank 1
        let celebrationHtml = (allPublished && index === 0) ? '<div class="sparkle-overlay"></div>' : '';
        let nameClass = (allPublished && index === 0) ? 'winner-text-pop text-yellow-400' : 'text-white';

        html += `
            <div class="rounded-3xl border p-10 transition-all duration-1000 flex justify-between items-center ${cardStyle}">
                ${celebrationHtml}
                <div class="relative z-10">
                    <div class="flex items-center mb-2">
                        ${categorySvg}
                        <p class="text-[10px] uppercase tracking-[0.5em] text-slate-400 font-bold">${rankLabel}</p>
                    </div>
                    <h3 class="text-5xl font-black italic uppercase flex items-center ${nameClass}">
                        ${iconHtml}${teamName}
                    </h3>
                </div>
                <div class="text-7xl font-black italic opacity-10 select-none">#${index+1}</div>
            </div>`;
    });

    html += `</div>`;
    container.append(html);
}

$(document).ready(() => { 
    // Initial load when the page opens
    loadData(); 
    
    // Refresh every 5 seconds (15000ms)
    setInterval(loadData, 15000); 
});