// Squad + formations + position compatibility
// Kept compatible with the original csm2 localStorage shape.

// Default squad — Brighton 2025/26 sample roster. New users open the app to
// a pre-populated "BHA Test" squad they can edit, replace via CSV import, or
// duplicate as a starting point.
window.SQUAD = [
    { id:1,  n:1,  name:"Bart Verbruggen",        positions:["GK"] },
    { id:2,  n:2,  name:"Tariq Lamptey",          positions:["RB","RWB"] },
    { id:3,  n:3,  name:"Igor Julio",             positions:["CB"] },
    { id:4,  n:4,  name:"Adam Webster",           positions:["CB"] },
    { id:5,  n:5,  name:"Lewis Dunk",             positions:["CB"] },
    { id:6,  n:6,  name:"Jan Paul van Hecke",     positions:["CB"] },
    { id:7,  n:7,  name:"Solly March",            positions:["RW","LW"] },
    { id:8,  n:8,  name:"Brajan Gruda",           positions:["CAM","RW","LW"] },
    { id:9,  n:9,  name:"Stefanos Tzimas",        positions:["ST","CF"] },
    { id:10, n:10, name:"Georginio Rutter",       positions:["CF","CAM","ST"] },
    { id:11, n:11, name:"Yankuba Minteh",         positions:["RW","LW"] },
    { id:12, n:13, name:"Jack Hinshelwood",       positions:["CM","RB","RW"] },
    { id:13, n:14, name:"Tommy Watson",           positions:["LW","RW"] },
    { id:14, n:17, name:"Carlos Baleba",          positions:["CDM","CM"] },
    { id:15, n:18, name:"Danny Welbeck",          positions:["ST","CF"] },
    { id:16, n:19, name:"Charalampos Kostoulas",  positions:["ST","CF"] },
    { id:17, n:20, name:"James Milner",           positions:["CM","CDM"] },
    { id:18, n:21, name:"Olivier Boscagli",       positions:["CB","LB"] },
    { id:19, n:22, name:"Kaoru Mitoma",           positions:["LW"] },
    { id:20, n:23, name:"Jason Steele",           positions:["GK"] },
    { id:21, n:24, name:"Ferdi Kadıoğlu",         positions:["LB","RB"] },
    { id:22, n:25, name:"Diego Gomez",            positions:["CM","CDM"] },
    { id:23, n:26, name:"Yasin Ayari",            positions:["CM","CDM"] },
    { id:24, n:27, name:"Matts Wieffer",          positions:["CDM","CM"] },
    { id:25, n:29, name:"Maxim De Cuyper",        positions:["LB","LWB"] },
    { id:26, n:31, name:"Julio Enciso",           positions:["CAM","RW","LW"] },
    { id:27, n:32, name:"Jeremy Sarmiento",       positions:["LW","RW"] },
    { id:28, n:33, name:"Matt O'Riley",           positions:["CAM","CM"] },
    { id:29, n:34, name:"Joel Veltman",           positions:["RB","CB"] },
    { id:30, n:35, name:"Andy Moran",             positions:["CAM","CM"] },
    { id:31, n:36, name:"Malick Yalcouye",        positions:["CM","CDM"] },
    { id:32, n:37, name:"Abdallah Sima",          positions:["RW","LW","ST"] },
    { id:33, n:38, name:"Tom McGill",             positions:["GK"] },
    { id:34, n:40, name:"Facundo Buonanotte",     positions:["CAM","RW","LW"] },
    { id:35, n:42, name:"Diego Coppola",          positions:["CB"] },
];

// Kept as an alias for the "Load sample" button that appears when a squad
// has been emptied.
window.SAMPLE_SQUAD = window.SQUAD.map(p => ({ ...p, positions: [...p.positions] }));

window.FORMATIONS = {
    "4-4-2": {
        rows: [
            [{pos:"ST",label:"ST"}, {pos:"ST",label:"ST"}],
            [{pos:"LM",label:"LM"}, {pos:"CM",label:"CM"}, {pos:"CM",label:"CM"}, {pos:"RM",label:"RM"}],
            [{pos:"LB",label:"LB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
    "4-3-3": {
        rows: [
            [{pos:"LW",label:"LW"}, {pos:"ST",label:"ST"}, {pos:"RW",label:"RW"}],
            [{pos:"CM",label:"CM"}, {pos:"CDM",label:"CDM"}, {pos:"CM",label:"CM"}],
            [{pos:"LB",label:"LB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
    "3-5-2": {
        rows: [
            [{pos:"ST",label:"ST"}, {pos:"ST",label:"ST"}],
            [{pos:"LWB",label:"LWB"}, {pos:"CM",label:"CM"}, {pos:"CDM",label:"CDM"}, {pos:"CM",label:"CM"}, {pos:"RWB",label:"RWB"}],
            [{pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
    "4-2-3-1": {
        rows: [
            [{pos:"ST",label:"ST"}],
            [{pos:"LW",label:"LW"}, {pos:"CAM",label:"CAM"}, {pos:"RW",label:"RW"}],
            [{pos:"CDM",label:"CDM"}, {pos:"CDM",label:"CDM"}],
            [{pos:"LB",label:"LB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
    "3-4-3": {
        rows: [
            [{pos:"LW",label:"LW"}, {pos:"ST",label:"ST"}, {pos:"RW",label:"RW"}],
            [{pos:"LM",label:"LM"}, {pos:"CM",label:"CM"}, {pos:"CM",label:"CM"}, {pos:"RM",label:"RM"}],
            [{pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
    "4-5-1": {
        rows: [
            [{pos:"ST",label:"ST"}],
            [{pos:"LM",label:"LM"}, {pos:"CM",label:"CM"}, {pos:"CDM",label:"CDM"}, {pos:"CM",label:"CM"}, {pos:"RM",label:"RM"}],
            [{pos:"LB",label:"LB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
    "5-3-2": {
        rows: [
            [{pos:"ST",label:"ST"}, {pos:"ST",label:"ST"}],
            [{pos:"CM",label:"CM"}, {pos:"CDM",label:"CDM"}, {pos:"CM",label:"CM"}],
            [{pos:"LWB",label:"LWB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"CB",label:"CB"}, {pos:"RWB",label:"RWB"}],
            [{pos:"GK",label:"GK"}],
        ],
    },
};

window.POS_COMPAT = {
    "GK":  ["GK"],
    "CB":  ["CB","CDM","CM","CAM"],
    "LB":  ["LB","LWB","LM","LW","CB"],
    "RB":  ["RB","RWB","RM","RW","CB"],
    "LWB": ["LWB","LB","LM","LW"],
    "RWB": ["RWB","RB","RM","RW"],
    "CDM": ["CDM","CM","CB","CAM"],
    "CM":  ["CM","CDM","CAM","LM","RM"],
    "CAM": ["CAM","CM","CDM","ST","CF","LW","RW"],
    "LM":  ["LM","CM","LW","LWB","LB"],
    "RM":  ["RM","CM","RW","RWB","RB"],
    "LW":  ["LW","LM","CAM","ST","CF"],
    "RW":  ["RW","RM","CAM","ST","CF"],
    "ST":  ["ST","CF","CAM","LW","RW"],
    "CF":  ["CF","ST","CAM","LW","RW"],
};

window.DEF_MID = ["CB","LB","RB","LWB","RWB","CDM","CM","CAM","LM","RM","LW","RW"];

window.posClass = function(pos) {
    if (pos === 'GK') return 'pc-gk';
    if (['CB','LB','RB','LWB','RWB'].includes(pos)) return 'pc-def';
    if (['CDM','CM','CAM','LM','RM'].includes(pos)) return 'pc-mid';
    return 'pc-att';
};

window.canPlay = function(player, slotPos) {
    if (!player) return false;
    if (player.positions.includes("ALL")) return window.DEF_MID.includes(slotPos);
    return player.positions.some(p => (window.POS_COMPAT[p] || []).includes(slotPos));
};

window.fmt = function(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
};

window.shortName = function(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0][0] + '. ' + parts[parts.length-1];
};
