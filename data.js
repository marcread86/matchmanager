// Squad + formations + position compatibility
// Kept compatible with the original csm2 localStorage shape.

window.SQUAD = [
    { id:1,  n:1,  name:"Matt Barker",           positions:["RB","RW"] },
    { id:2,  n:2,  name:"Garee Hilsdon",         positions:["CB","CDM"] },
    { id:3,  n:3,  name:"Asal Malekinia",        positions:["CM","RM"] },
    { id:4,  n:4,  name:"Paul Hickman",          positions:["CB"] },
    { id:5,  n:5,  name:"Andre Goncalves",       positions:["RB","CDM","RW"] },
    { id:6,  n:6,  name:"Max Smith",             positions:["CM","CAM"] },
    { id:7,  n:7,  name:"Jon Quayle",            positions:["CAM","LW","RW","ST"] },
    { id:8,  n:8,  name:"Hannah Lewis",          positions:["RM","RW"] },
    { id:9,  n:9,  name:"Phil Smith",            positions:["ALL"] },
    { id:10, n:10, name:"James Luckin",          positions:["ALL"] },
    { id:11, n:11, name:"Abdulsalam Abdulsalami",positions:["ALL"] },
    { id:12, n:12, name:"James Finlayson",       positions:["ALL"] },
    { id:13, n:13, name:"James Lambert",         positions:["GK"] },
    { id:14, n:14, name:"Edward Leggatt",        positions:["ST","CAM","GK"] },
    { id:15, n:15, name:"Marc Read",             positions:["LB","CB"] },
    { id:16, n:16, name:"Harry Adams",           positions:["CM","LW","RW"] },
    { id:17, n:17, name:"Lewis Titterrell",      positions:["ALL"] },
    { id:18, n:18, name:"Ariana Fleischman",     positions:["CM","CF"] },
    { id:19, n:19, name:"Mark Douglas",          positions:["LW","LB","RW","RB","CDM"] },
    { id:20, n:20, name:"Sam Renton",            positions:["RB","CM","ST"] },
    { id:21, n:21, name:"Adam Makkai",           positions:["ALL"] },
    { id:22, n:22, name:"Paddy Williamson",      positions:["CDM"] },
    { id:23, n:23, name:"Connor Redmond",        positions:["ALL"] },
    { id:24, n:24, name:"Tom Illsley",           positions:["CB","LB"] }
];

window.FORMATIONS = {
    "4-4-2": {
        rows: [
            [{pos:"ST",label:"ST"},{pos:"ST",label:"ST"}],
            [{pos:"LW",label:"LM"},{pos:"CM",label:"CM"},{pos:"CM",label:"CM"},{pos:"RW",label:"RM"}],
            [{pos:"LB",label:"LB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "4-3-3": {
        rows: [
            [{pos:"LW",label:"LW"},{pos:"ST",label:"ST"},{pos:"RW",label:"RW"}],
            [{pos:"CM",label:"CM"},{pos:"CM",label:"CM"},{pos:"CM",label:"CM"}],
            [{pos:"LB",label:"LB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "3-5-2": {
        rows: [
            [{pos:"ST",label:"ST"},{pos:"ST",label:"ST"}],
            [{pos:"LW",label:"LM"},{pos:"CM",label:"CM"},{pos:"CAM",label:"CAM"},{pos:"CM",label:"CM"},{pos:"RW",label:"RM"}],
            [{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "4-2-3-1": {
        rows: [
            [{pos:"ST",label:"ST"}],
            [{pos:"LW",label:"LW"},{pos:"CAM",label:"CAM"},{pos:"RW",label:"RW"}],
            [{pos:"CDM",label:"CDM"},{pos:"CDM",label:"CDM"}],
            [{pos:"LB",label:"LB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "3-4-3": {
        rows: [
            [{pos:"LW",label:"LW"},{pos:"ST",label:"ST"},{pos:"RW",label:"RW"}],
            [{pos:"LW",label:"LM"},{pos:"CM",label:"CM"},{pos:"CM",label:"CM"},{pos:"RW",label:"RM"}],
            [{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "4-5-1": {
        rows: [
            [{pos:"ST",label:"ST"}],
            [{pos:"LW",label:"LM"},{pos:"CM",label:"CM"},{pos:"CAM",label:"CAM"},{pos:"CM",label:"CM"},{pos:"RW",label:"RM"}],
            [{pos:"LB",label:"LB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "5-3-2": {
        rows: [
            [{pos:"ST",label:"ST"},{pos:"ST",label:"ST"}],
            [{pos:"CM",label:"CM"},{pos:"CM",label:"CM"},{pos:"CM",label:"CM"}],
            [{pos:"LB",label:"LWB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"RB",label:"RWB"}],
            [{pos:"GK",label:"GK"}]
        ]
    },
    "4-1-4-1": {
        rows: [
            [{pos:"ST",label:"ST"}],
            [{pos:"LW",label:"LM"},{pos:"CM",label:"CM"},{pos:"CM",label:"CM"},{pos:"RW",label:"RM"}],
            [{pos:"CDM",label:"CDM"}],
            [{pos:"LB",label:"LB"},{pos:"CB",label:"CB"},{pos:"CB",label:"CB"},{pos:"RB",label:"RB"}],
            [{pos:"GK",label:"GK"}]
        ]
    }
};

window.POS_COMPAT = {
    "GK":  ["GK"],
    "CB":  ["CB","CDM","CM","CAM"],
    "LB":  ["LB"],
    "RB":  ["RB"],
    "CDM": ["CDM","CM","CAM","CB"],
    "CM":  ["CM","CDM","CAM","CB"],
    "CAM": ["CAM","CM","CDM","CB"],
    "LW":  ["LW","LM"],
    "RW":  ["RW","RM"],
    "LM":  ["LM","LW"],
    "RM":  ["RM","RW"],
    "ST":  ["ST","CF"],
    "CF":  ["CF","ST"],
    "LWB": ["LB","LW"],
    "RWB": ["RB","RW"]
};

window.DEF_MID = ["CB","LB","RB","LWB","RWB","CDM","CM","CAM","LM","RM","LW","RW"];

window.posClass = function(pos) {
    if (pos === 'GK') return 'pc-gk';
    if (['CB','LB','RB','LWB','RWB'].includes(pos)) return 'pc-def';
    if (['CDM','CM','CAM','LM','RM'].includes(pos)) return 'pc-mid';
    return 'pc-fwd';
};

window.canPlay = function(player, slotPos) {
    if (!player) return false;
    if (player.positions.includes("ALL")) return window.DEF_MID.includes(slotPos);
    const compat = window.POS_COMPAT[slotPos] || [slotPos];
    return player.positions.some(pp => compat.includes(pp));
};

window.fmt = function(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
};

window.shortName = function(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0][0] + '. ' + parts.slice(1).join(' ');
};
