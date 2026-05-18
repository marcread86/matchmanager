/* global React, ReactDOM, SQUAD, FORMATIONS, POS_COMPAT, DEF_MID, fmt, canPlay, shortName, posClass, useCloudSync, SyncBadge, SessionExpiredBanner, Welcome */
/* Football Squad Manager — main app */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────
//  STORAGE  (migrates the original csm2 shape)
// ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'csm3';
const LEGACY_KEY  = 'csm2';

function emptyTimes()  { const t = {}; SQUAD.forEach(p => t[p.id] = { total: 0, onSince: null }); return t; }
function emptyStatus() { const s = {}; SQUAD.forEach(p => s[p.id] = { injured: false, yellow: 0, red: false }); return s; }

function buildSlots(formation) {
    const f = FORMATIONS[formation];
    const out = [];
    f.rows.forEach(row => row.forEach(cell =>
        out.push({ slotPos: cell.pos, label: cell.label, playerId: null })));
    return out;
}

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function loadInitial() {
    const defaultPlayers = window.SQUAD.map(p => ({ ...p, positions: [...p.positions] }));
    const defaultSquadId = uid();
    const def = {
        formation: '4-4-2',
        matchSec: 0,
        clockStartedAt: null,                   // wall-clock timestamp (Date.now()) when current 1H/2H run began; null when paused
        matchSecBase: 0,                        // matchSec snapshot at the moment clockStartedAt was set
        slots: buildSlots('4-4-2'),
        playerTimes: emptyTimes(),
        playerStatus: emptyStatus(),
        score: { us: 0, them: 0 },
        teamName: { us: '', them: '' },        // start blank — placeholder in UI
        crest:    { us: '', them: '' },        // start blank — initial drawn from name
        phase: 'pre',
        htAt: null,
        ftAt: null,
        goals: [],
        history: [],
        squad: defaultPlayers,                  // mirror of active library entry
        squads: [{ id: defaultSquadId, name: 'BHA Test', players: defaultPlayers }],
        activeSquadId: defaultSquadId,
        lineups: [],                            // saved formation + slot presets
        updatedAt: 0,                           // sync clock — bumped on every change
    };
    try {
        const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (cur) {
            // Migrate single-squad shape → squads[] library
            let squads = Array.isArray(cur.squads) && cur.squads.length ? cur.squads : null;
            let activeSquadId = cur.activeSquadId;
            if (!squads) {
                const id = defaultSquadId;
                squads = [{ id, name: 'BHA Test', players: cur.squad || defaultPlayers }];
                activeSquadId = id;
            }
            const active = squads.find(s => s.id === activeSquadId) || squads[0];
            if (active?.players) window.SQUAD = active.players;
            // If the clock was running when the app was last open, catch it
            // up to wall-clock time. Cap absurd gaps (> 3h) so reopening the
            // app the next day doesn't show a 14-hour match.
            const merged = Object.assign(def, cur, {
                squads,
                activeSquadId: active?.id || squads[0].id,
                squad: active?.players || cur.squad || def.squad,
                lineups: Array.isArray(cur.lineups) ? cur.lineups : def.lineups,
                playerTimes:  Object.assign(emptyTimes(),  cur.playerTimes  || {}),
                playerStatus: Object.assign(emptyStatus(), cur.playerStatus || {}),
                score: cur.score || def.score,
                teamName: cur.teamName || def.teamName,
                crest: cur.crest || def.crest,
                phase: cur.phase || (cur.half === 2 ? '2h' : cur.half === 3 ? 'ft' : 'pre'),
                goals: cur.goals || [],
                history: cur.history || [],
                updatedAt: cur.updatedAt || 0,
                clockStartedAt: cur.clockStartedAt || null,
                matchSecBase: cur.matchSecBase ?? cur.matchSec ?? 0,
            });
            if (merged.clockStartedAt) {
                const gap = Date.now() - merged.clockStartedAt;
                if (gap > 3 * 60 * 60 * 1000 || gap < 0) {
                    // Stale anchor — assume the match was forgotten. Keep the
                    // last known matchSec but stop running.
                    merged.clockStartedAt = null;
                }
            }
            return merged;
        }
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (legacy) {
            return Object.assign(def, {
                formation: legacy.formation || def.formation,
                matchSec: legacy.matchSec || 0,
                slots: legacy.slots || buildSlots(legacy.formation || '4-4-2'),
                playerTimes:  Object.assign(emptyTimes(),  legacy.playerTimes  || {}),
                playerStatus: Object.assign(emptyStatus(), legacy.playerStatus || {}),
            });
        }
    } catch (e) { console.warn('load failed', e); }
    return def;
}

// Helper: when active squad's player roster changes, mirror it back into squads[].
// Keep window.SQUAD in sync too (referenced by Pitch/Bench/Pool/etc).
function withActiveSquadPlayers(s, newPlayers) {
    window.SQUAD = newPlayers;
    return {
        ...s,
        squad: newPlayers,
        squads: s.squads.map(sq => sq.id === s.activeSquadId ? { ...sq, players: newPlayers } : sq),
    };
}

// ─────────────────────────────────────────────────────────────
//  ICONS  (inline SVG, no emoji)
// ─────────────────────────────────────────────────────────────
const Ic = {
    play:  (<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 2.5v11l11-5.5z"/></svg>),
    pause: (<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="3" y="2.5" width="3.5" height="11" rx="0.5"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="0.5"/></svg>),
    reset: (<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8a5 5 0 1 0 1.5-3.5L3 6"/><path d="M3 3v3h3"/></svg>),
    swap:  (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4 4 7l3 3M4 7h13M17 14l3 3-3 3M20 17H7"/></svg>),
    minus: (<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="2.5" y="7" width="11" height="2"/></svg>),
    plus:  (<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="2.5" y="7" width="11" height="2"/><rect x="7" y="2.5" width="2" height="11"/></svg>),
};

// ─────────────────────────────────────────────────────────────
//  TOP BAR  — score / phase / clock / controls
// ─────────────────────────────────────────────────────────────
const PHASE_INFO = {
    pre: { label: 'PRE',  primary: 'Kick Off',         next: '1h', live: false, tone: 'go'    },
    '1h':{ label: '1H',   primary: 'Half Time',        next: 'ht', live: true,  tone: 'pause' },
    ht:  { label: 'HT',   primary: 'Start 2nd Half',   next: '2h', live: false, tone: 'go'    },
    '2h':{ label: '2H',   primary: 'Full Time',        next: 'ft', live: true,  tone: 'stop'  },
    ft:  { label: 'FT',   primary: null,               next: null, live: false, tone: null    },
};

function Crest({ team, src, letter, onSet }) {
    const fileRef = useRef(null);
    function pick(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => onSet(team, reader.result);
        reader.readAsDataURL(f);
    }
    return (
        <button className={"crest crest-img " + team} onClick={() => fileRef.current?.click()} title="Tap to upload team symbol">
            {src ? <img src={src} alt="" /> : <span>{letter || '+'}</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={pick} />
        </button>
    );
}

function TopBar({ state, dispatch, onAdvancePhase, onReset, onTapScore, onSetCrest, onTapClock, resetArmed, sync, onShowWelcome, onShowHelp }) {
    const { score, teamName, crest, phase, matchSec } = state;
    const info = PHASE_INFO[phase];
    const usLetter   = teamName.us.trim().charAt(0).toUpperCase()   || '+';
    const themLetter = teamName.them.trim().charAt(0).toUpperCase() || '+';

    return (
        <div className="topbar">
            <div className="tb-row">
                <div className={"tb-half " + phase + (info.live ? ' live' : '')}>
                    <span className="dot"></span>{info.label}
                </div>
                {sync && <SyncBadge sync={sync} onShowWelcome={onShowWelcome} />}
                <button
                    className="tb-help"
                    onClick={onShowHelp}
                    aria-label="Help"
                    title="Help & guide"
                >
                    ?
                </button>
                <button className="tb-clock" onClick={onTapClock} title="Tap to edit">
                    {fmt(matchSec)}
                </button>
            </div>

            <div className="score-row">
                <div className="team us">
                    <Crest team="us" src={crest.us} letter={usLetter} onSet={onSetCrest} />
                    <div
                        className={"team-name" + (teamName.us ? '' : ' placeholder')}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Home team"
                        onBlur={e => dispatch({type:'TEAM_NAME', team:'us', name: e.target.textContent.trim()})}
                    >{teamName.us}</div>
                </div>
                <div className="score-box">
                    <button className="score-num" onClick={() => onTapScore('us')}>{score.us}</button>
                    <div className="score-sep">:</div>
                    <button className="score-num" onClick={() => onTapScore('them')}>{score.them}</button>
                </div>
                <div className="team them">
                    <Crest team="them" src={crest.them} letter={themLetter} onSet={onSetCrest} />
                    <div
                        className={"team-name" + (teamName.them ? '' : ' placeholder')}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Away team"
                        onBlur={e => dispatch({type:'TEAM_NAME', team:'them', name: e.target.textContent.trim()})}
                    >{teamName.them}</div>
                </div>
            </div>

            <div className="tb-controls">
                <button className={"tb-btn" + (resetArmed ? ' armed' : '')} onClick={onReset} aria-label="Reset match">
                    <span className="ic">{Ic.reset}</span>
                    {resetArmed ? 'Tap again to reset' : 'Reset'}
                </button>
                {info.primary && (
                    <button
                        className={"tb-btn primary tone-" + info.tone}
                        onClick={onAdvancePhase}
                    >
                        <span className="ic">{phase === '1h' || phase === '2h' ? Ic.pause : Ic.play}</span>
                        {info.primary}
                    </button>
                )}
                {phase === 'ft' && (
                    <div className="tb-btn ft-badge">FULL TIME</div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
//  STATS RAIL
// ─────────────────────────────────────────────────────────────
function StatsRail({ state, getTime }) {
    const onIds = new Set(state.slots.filter(s => s.playerId).map(s => s.playerId));
    const totalT = SQUAD.reduce((s, p) => s + getTime(p.id), 0);
    const avg = SQUAD.length ? Math.floor(totalT / SQUAD.length) : 0;
    const least = [...SQUAD]
        .filter(p => !state.playerStatus[p.id]?.injured && !state.playerStatus[p.id]?.red)
        .sort((a, b) => getTime(a.id) - getTime(b.id))[0];
    const inj = SQUAD.filter(p => state.playerStatus[p.id]?.injured).length;
    const cards = SQUAD.filter(p => state.playerStatus[p.id]?.yellow || state.playerStatus[p.id]?.red).length;

    return (
        <div className="stats">
            <div className="stat"><div className="v accent">{onIds.size}</div><div className="l">On</div></div>
            <div className="stat"><div className="v">{SQUAD.length - onIds.size}</div><div className="l">Bench</div></div>
            <div className="stat"><div className="v">{fmt(avg)}</div><div className="l">Avg</div></div>
            <div className="stat"><div className="v">{least ? '#' + least.n : '–'}</div><div className="l">Least</div></div>
            <div className="stat"><div className="v">{inj}</div><div className="l">Inj</div></div>
            <div className="stat"><div className="v">{cards}</div><div className="l">Cards</div></div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
//  PITCH
// ─────────────────────────────────────────────────────────────
function Pitch({ state, getTime, onSlotTap, justSubbed, goalsByPlayer }) {
    const f = FORMATIONS[state.formation];
    let slotIdx = 0;
    return (
        <div className="pitch">
            <div className="pitch-box-top"></div>
            <div className="pitch-box-bot"></div>
            {f.rows.map((row, ri) => (
                <div className="pitch-row" key={ri}>
                    {row.map((cell, ci) => {
                        const s = state.slots[slotIdx];
                        const si = slotIdx;
                        slotIdx++;
                        const player = s?.playerId ? SQUAD.find(p => p.id === s.playerId) : null;
                        const time = player ? getTime(player.id) : 0;
                        const status = player ? state.playerStatus[player.id] : null;
                        const tc = time > 1200 ? 'danger' : time > 900 ? 'warn' : '';
                        const flash = justSubbed === si;
                        return (
                            <div className="slot" key={si}>
                                <button
                                    className={"slot-tap"
                                        + (player ? '' : ' empty')
                                        + (s?.locked ? ' locked' : '')
                                        + (flash ? ' subbed-flash' : '')}
                                    onClick={() => onSlotTap(si)}
                                >
                                    <div className="slot-pos">{cell.label}</div>
                                    {player ? (
                                        <>
                                            <div className="slot-num">#{player.n}</div>
                                            <div className="slot-name">
                                                {shortName(player.name)}
                                            </div>
                                            <div className={"slot-time " + tc}>{fmt(time)}</div>
                                            {(status?.yellow || status?.red || status?.injured || goalsByPlayer[player.id]) && (
                                                <div className="slot-flags">
                                                    {goalsByPlayer[player.id] > 0 && (
                                                        <span className="flag goal" title={`${goalsByPlayer[player.id]} goal${goalsByPlayer[player.id]>1?'s':''}`}>
                                                            ⚽{goalsByPlayer[player.id] > 1 ? goalsByPlayer[player.id] : ''}
                                                        </span>
                                                    )}
                                                    {status.yellow >= 1 && <span className="flag yc">Y</span>}
                                                    {status.yellow >= 2 && <span className="flag yc">Y</span>}
                                                    {status.red && <span className="flag rc">R</span>}
                                                    {status.injured && <span className="flag inj">I</span>}
                                                </div>
                                            )}
                                        </>
                                    ) : s?.locked ? (
                                        <>
                                            <div className="slot-name muted">Sent off</div>
                                            <div className="slot-flags"><span className="flag rc">R</span></div>
                                        </>
                                    ) : (
                                        <div className="slot-name muted" style={{marginTop:4}}>Empty</div>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
//  BENCH
// ─────────────────────────────────────────────────────────────
function Bench({ state, getTime, onCardTap, onSubInTap, sortMode, setSortMode, goalsByPlayer }) {
    const onIds = new Set(state.slots.filter(s => s.playerId).map(s => s.playerId));
    let bench = SQUAD.filter(p => !onIds.has(p.id));
    if (sortMode === 'least') {
        bench = bench.sort((a, b) => getTime(a.id) - getTime(b.id));
    } else if (sortMode === 'number') {
        bench = bench.sort((a, b) => a.n - b.n);
    } else if (sortMode === 'position') {
        const order = ['GK','LB','CB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF','ALL'];
        bench = bench.sort((a, b) => {
            const ap = order.indexOf(a.positions[0]);
            const bp = order.indexOf(b.positions[0]);
            return ap - bp;
        });
    }

    const leastTime = bench.length ? getTime(bench.reduce((m,p) => getTime(p.id) < getTime(m.id) ? p : m).id) : 0;

    return (
        <>
            <div className="bench-filters">
                {['least','number','position'].map(m => (
                    <button key={m} className={"filter-chip" + (sortMode === m ? ' active' : '')} onClick={() => setSortMode(m)}>
                        {m === 'least' ? 'Least played' : m === 'number' ? 'By number' : 'By position'}
                    </button>
                ))}
            </div>
            <div className="bench-list">
                {bench.length === 0 && <div className="empty">Everyone is on the pitch.</div>}
                {bench.map(p => {
                    const st = state.playerStatus[p.id] || {};
                    const t = getTime(p.id);
                    const cls = st.injured ? 'injured' : st.red ? 'red-out' : st.yellow ? 'yellow' : (t === leastTime && t < 600 ? 'least' : '');
                    const unavailable = st.injured || st.red;
                    const posTag = p.positions.includes('ALL') ? 'ALL' : p.positions.join('/');
                    return (
                        <div className={"bench-card " + cls} key={p.id} onClick={() => onCardTap(p.id)}>
                            <div className="bench-num">{p.n}</div>
                            <div className="bench-info">
                                <div className="bench-name">
                                    {p.name}
                                    {goalsByPlayer[p.id] > 0 && (
                                        <span className="goal-badge"> ⚽{goalsByPlayer[p.id] > 1 ? goalsByPlayer[p.id] : ''}</span>
                                    )}
                                </div>
                                <div className="bench-meta">
                                    <span className="pos-tag">{posTag}</span>
                                    {st.yellow >= 1 && <span className="flag yc">Y</span>}
                                    {st.yellow >= 2 && <span className="flag yc">Y</span>}
                                    {st.red && <span className="flag rc">R</span>}
                                    {st.injured && <span className="flag inj">INJ</span>}
                                </div>
                            </div>
                            <div className={"bench-time" + (t === 0 ? ' zero' : t === leastTime ? ' low' : '')}>{fmt(t)}</div>
                            <button
                                className="bench-sub-btn"
                                disabled={unavailable}
                                onClick={e => { e.stopPropagation(); if (!unavailable) onSubInTap(p.id); }}
                            >Sub in</button>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────
//  POOL  (position-coverage view, compact)
// ─────────────────────────────────────────────────────────────
function PositionPool({ state }) {
    const f = FORMATIONS[state.formation];
    const onIds = new Set(state.slots.filter(s => s.playerId).map(s => s.playerId));
    return (
        <div className="pool">
            {f.rows.map((row, ri) => (
                <div className="pool-row" key={ri}>
                    {row.map((cell, ci) => {
                        const compat = POS_COMPAT[cell.pos] || [cell.pos];
                        const matching = SQUAD.filter(p => {
                            if (p.positions.includes('ALL')) return DEF_MID.includes(cell.pos);
                            return p.positions.some(pp => compat.includes(pp));
                        }).sort((a, b) => {
                            const ae = a.positions.includes(cell.pos) ? 0 : 1;
                            const be = b.positions.includes(cell.pos) ? 0 : 1;
                            if (ae !== be) return ae - be;
                            return a.n - b.n;
                        });
                        return (
                            <div className="pool-col" key={ci}>
                                <div className="pool-pos">{cell.label}</div>
                                {matching.map(p => {
                                    const st = state.playerStatus[p.id] || {};
                                    const cls = onIds.has(p.id) ? 'on' : st.injured ? 'injured' : st.red ? 'out' : '';
                                    return <div key={p.id} className={"pool-name " + cls}>{p.n}. {p.name.split(' ')[0]}</div>;
                                })}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
//  SUB HISTORY
// ─────────────────────────────────────────────────────────────
function History({ state }) {
    if (!state.history?.length) {
        return <div className="history-empty">No subs yet. They'll appear here in real time.</div>;
    }
    return (
        <div className="history">
            {state.history.slice().reverse().map((h, i) => (
                <div className="hist-item" key={i}>
                    <div className="hist-time">{fmt(h.at)}</div>
                    <div className="hist-text">
                        {h.kind === 'sub' && (
                            <>
                                <span className="hist-arrow off">↓</span> <b>{h.off}</b>{' '}
                                <span className="hist-arrow on">↑</span> <b>{h.on}</b>{' '}
                                <span className="muted">({h.pos})</span>
                            </>
                        )}
                        {h.kind === 'on'  && (<><span className="hist-arrow on">↑</span> <b>{h.on}</b> at {h.pos}</>)}
                        {h.kind === 'off' && (<><span className="hist-arrow off">↓</span> <b>{h.off}</b> from {h.pos}</>)}
                        {h.kind === 'goal' && (<><b>{h.text}</b></>)}
                        {h.kind === 'phase' && (<b className="muted">{h.text}</b>)}
                        {h.kind === 'card' && (<><b>{h.text}</b></>)}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
//  SHEETS  (sub picker / player actions)
// ─────────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, sub, children }) {
    return (
        <>
            <div className={"sheet-back" + (open ? ' open' : '')} onClick={onClose}></div>
            <div className={"sheet" + (open ? ' open' : '')} onClick={e => e.stopPropagation()}>
                <div className="sheet-grip"></div>
                <div className="sheet-head">
                    <div>
                        <div className="sheet-title">{title}</div>
                        {sub && <div className="sheet-sub">{sub}</div>}
                    </div>
                    <button className="sheet-close" onClick={onClose}>Done</button>
                </div>
                <div className="sheet-body">{children}</div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────
//  LINEUPS  (saved formation + slot presets)
// ─────────────────────────────────────────────────────────────
function Lineups({ state, setState, onManage }) {
    const [naming, setNaming] = React.useState(false);
    const [draft, setDraft] = React.useState('');
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        if (naming) setTimeout(() => inputRef.current?.focus(), 10);
    }, [naming]);

    const lineups = state.lineups || [];
    const onPitch = state.slots.filter(s => s.playerId).length;

    function saveCurrent(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        setState(s => {
            const lineup = {
                id: uid(),
                name: trimmed,
                formation: s.formation,
                slots: s.slots.map(sl => ({ slotPos: sl.slotPos, label: sl.label, playerId: sl.playerId || null })),
                savedAt: Date.now(),
            };
            return { ...s, lineups: [...(s.lineups || []), lineup] };
        });
        setNaming(false);
        setDraft('');
    }

    function loadLineup(lineup) {
        setState(s => {
            // Commit timing on outgoing players before swapping the pitch
            const playerTimes = { ...s.playerTimes };
            const running = s.phase === '1h' || s.phase === '2h';
            s.slots.forEach(sl => {
                if (sl.playerId) {
                    const pt = playerTimes[sl.playerId];
                    if (pt && pt.onSince !== null) {
                        playerTimes[sl.playerId] = { total: pt.total + (s.matchSec - pt.onSince), onSince: null };
                    }
                }
            });

            // Build new slots from the saved lineup. Drop any players not on
            // the current active squad (e.g. CSV-imported a different roster).
            const activeIds = new Set(s.squad.map(p => p.id));
            const newSlots = lineup.slots.map(sl => ({
                slotPos: sl.slotPos,
                label: sl.label,
                playerId: (sl.playerId && activeIds.has(sl.playerId)) ? sl.playerId : null,
            }));

            // Re-anchor on-pitch onSince for fresh players if match is running
            if (running) {
                newSlots.forEach(sl => {
                    if (sl.playerId) {
                        const pt = playerTimes[sl.playerId] || { total: 0, onSince: null };
                        playerTimes[sl.playerId] = { ...pt, onSince: s.matchSec };
                    }
                });
            }

            return {
                ...s,
                formation: lineup.formation,
                slots: newSlots,
                playerTimes,
                history: [...(s.history || []), { at: s.matchSec, kind: 'card', text: `— Lineup: ${lineup.name} —` }],
            };
        });
    }

    return (
        <div className="lineups">
            <div className="lineups-row">
                <span className="lineups-label">Lineups</span>
                <div className="lineups-scroll">
                    {lineups.length === 0 && !naming && (
                        <span className="lineups-empty">No saved lineups yet — tap “Save” when you’ve picked your XI.</span>
                    )}
                    {lineups.map(l => (
                        <button
                            key={l.id}
                            className="lineup-chip"
                            onClick={() => loadLineup(l)}
                            title={`Load lineup: ${l.name} (${l.formation})`}
                        >
                            <span className="lineup-chip-name">{l.name}</span>
                            <span className="lineup-chip-form">{l.formation}</span>
                        </button>
                    ))}
                </div>
                {!naming ? (
                    <button
                        className="lineup-save-btn"
                        onClick={() => { setDraft(`XI ${(lineups.length + 1)}`); setNaming(true); }}
                        disabled={onPitch === 0}
                        title={onPitch === 0 ? "Put players on the pitch first" : "Save current lineup"}
                    >
                        + Save
                    </button>
                ) : (
                    <div className="lineup-save-form">
                        <input
                            ref={inputRef}
                            type="text"
                            className="lineup-save-input"
                            value={draft}
                            placeholder="Name this lineup"
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') saveCurrent(draft);
                                if (e.key === 'Escape') { setNaming(false); setDraft(''); }
                            }}
                            maxLength={30}
                        />
                        <button className="lineup-save-confirm" onClick={() => saveCurrent(draft)}>Save</button>
                        <button className="lineup-save-cancel" onClick={() => { setNaming(false); setDraft(''); }}>×</button>
                    </div>
                )}
                {lineups.length > 0 && !naming && (
                    <button className="lineup-manage-btn" onClick={onManage} title="Rename or delete lineups">
                        ⋯
                    </button>
                )}
                <button
                    className="lineup-share-btn"
                    onClick={() => window.exportLineupImage?.(state)}
                    disabled={onPitch === 0}
                    title={onPitch === 0 ? "Put players on the pitch first" : "Export lineup as an image"}
                    aria-label="Share lineup as image"
                >
                    ↗
                </button>
            </div>
        </div>
    );
}

function LineupManageSheet({ open, onClose, state, setState }) {
    const lineups = state.lineups || [];
    const [armedDelete, setArmedDelete] = React.useState(null);

    function rename(id, name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        setState(s => ({
            ...s,
            lineups: (s.lineups || []).map(l => l.id === id ? { ...l, name: trimmed } : l),
        }));
    }
    function remove(id) {
        if (armedDelete !== id) {
            setArmedDelete(id);
            setTimeout(() => setArmedDelete(curr => curr === id ? null : curr), 3000);
            return;
        }
        setArmedDelete(null);
        setState(s => ({ ...s, lineups: (s.lineups || []).filter(l => l.id !== id) }));
    }

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Manage lineups"
            sub={lineups.length ? `${lineups.length} saved` : 'Save a lineup from the Match tab to manage it here.'}
        >
            {lineups.length === 0 && (
                <div className="empty">No saved lineups yet.</div>
            )}
            {lineups.map(l => {
                const filledCount = l.slots.filter(s => s.playerId).length;
                return (
                    <div key={l.id} className="lineup-manage-row">
                        <input
                            className="lineup-manage-name"
                            type="text"
                            defaultValue={l.name}
                            maxLength={30}
                            onBlur={e => rename(l.id, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                        />
                        <span className="lineup-manage-meta">
                            {l.formation} · {filledCount}/{l.slots.length}
                        </span>
                        <button
                            className={"lineup-manage-del" + (armedDelete === l.id ? ' armed' : '')}
                            onClick={() => remove(l.id)}
                            aria-label={`Delete ${l.name}`}
                        >
                            {armedDelete === l.id ? '✓' : '×'}
                        </button>
                    </div>
                );
            })}
        </Sheet>
    );
}

function ResetAction({ label, sub, icon, tone, onConfirm }) {
    const [armed, setArmed] = React.useState(false);
    function tap() {
        if (!armed) {
            setArmed(true);
            setTimeout(() => setArmed(false), 3000);
            return;
        }
        setArmed(false);
        onConfirm();
    }
    return (
        <button
            className={"reset-action" + (armed ? ' armed' : '') + (tone === 'danger' ? ' danger' : '')}
            onClick={tap}
        >
            <span className="reset-action-icon">{icon}</span>
            <span className="reset-action-text">
                <span className="reset-action-label">{armed ? 'Tap again to confirm' : label}</span>
                <span className="reset-action-sub">{sub}</span>
            </span>
        </button>
    );
}

function HelpSheet({ open, onClose }) {
    const [openSection, setOpenSection] = React.useState('start');
    const sections = [
        {
            id: 'start',
            icon: '👋',
            title: 'Quick start',
            body: (
                <>
                    <p>Three taps and you're playing:</p>
                    <ol>
                        <li>Tap <b>Squad</b> → add players, or use <b>Import CSV</b> / <b>Load sample</b>.</li>
                        <li>Back on <b>Match</b>, tap each empty pitch slot and pick a player.</li>
                        <li>Tap <b>Kick Off</b>. The clock starts; player times tick up.</li>
                    </ol>
                </>
            ),
        },
        {
            id: 'match',
            icon: '⚽',
            title: 'During the match',
            body: (
                <>
                    <ul>
                        <li><b>Tap a pitch player</b> to sub them, give a card, or mark them injured.</li>
                        <li><b>Tap a bench player's “Sub In”</b> to bring them on — pick any slot, including off-position.</li>
                        <li><b>Move a player to a different position</b> — tap them on the pitch, then choose from <i>“Move … to”</i> in the sheet. If the target slot has someone, they swap places.</li>
                        <li><b>Score a goal</b> — tap either team's score number. For your team you can pick the scorer.</li>
                        <li><b>Edit the clock</b> — tap the big time at the top.</li>
                    </ul>
                </>
            ),
        },
        {
            id: 'lineups',
            icon: '📋',
            title: 'Saved lineups & sharing',
            body: (
                <>
                    <p>Set up your XI on the pitch, then tap <b>+ Save</b> in the Lineups row. Give it a name (e.g. <i>“Starting XI”</i>, <i>“Defensive”</i>) — it's saved.</p>
                    <p>Tap any saved chip to instantly reload that formation and lineup. The match clock and scores aren't affected.</p>
                    <p>The <b>⋯</b> button lets you rename or delete lineups (two-tap to delete).</p>
                    <p>The <b>↗</b> button exports the current pitch as an image — share it to WhatsApp / Notes / a group chat. Includes team names, score, formation and clock.</p>
                </>
            ),
        },
        {
            id: 'squad',
            icon: '👥',
            title: 'Squad library & CSV import',
            body: (
                <>
                    <p>You can keep multiple squads (e.g. <i>Saturday team</i>, <i>Sunday team</i>, <i>Opponents</i>) and switch between them. Look in the <b>Squad</b> tab's library card at the top.</p>
                    <p><b>CSV format</b> — one row per player. Columns: Number, Name, Positions (join multiples with <code>|</code>):</p>
                    <pre>{`Number,Name,Positions
1,Matt Barker,RB|RW
2,Garee Hilsdon,CB|CDM
9,Phil Smith,ALL`}</pre>
                    <p>Tap <b>Import CSV</b> in the squad library to bring a roster in. Choose <i>“Save as new squad”</i> or <i>“Replace active”</i>.</p>
                </>
            ),
        },
        {
            id: 'sub',
            icon: '🔁',
            title: 'Position fit & off-position subs',
            body: (
                <>
                    <p>When picking a player for a slot you'll see tags:</p>
                    <ul>
                        <li><b>EXACT</b> — their natural position.</li>
                        <li><b>FIT</b> — compatible (e.g. a CB can fill CDM).</li>
                        <li><b>ALL</b> — utility players marked “ALL”.</li>
                        <li><b>OFF-POS</b> — out of position (still selectable — the row is dimmed with a dashed border).</li>
                    </ul>
                    <p>Sorted top-to-bottom by fit, then by least time played.</p>
                </>
            ),
        },
        {
            id: 'auth',
            icon: '🔐',
            title: 'Sign in & sync',
            body: (
                <>
                    <p>The badge in the top bar shows your status:</p>
                    <ul>
                        <li><b>Sign in</b> (green tint) — you're using the app locally; data saves on this device only. Tap to sign in.</li>
                        <li><b>Synced &lt;name&gt;</b> — your data is saved to the cloud and follows you across devices.</li>
                        <li><b>Syncing…</b> — change being pushed to the cloud.</li>
                    </ul>
                    <p>Signing in uses Cloudflare's secure one-time-code email. No password to remember. Sessions last a month, after which you'll see a banner asking you to sign in again — your data is safe and waits for you.</p>
                </>
            ),
        },
        {
            id: 'reset',
            icon: '⚙️',
            title: 'Reset & clock edit',
            body: (
                <>
                    <p>Tap <b>Reset</b> in the top bar. Three options:</p>
                    <ul>
                        <li><b>New match</b> — clears clock, score, cards, history & player times. Keeps the current lineup ready to kick off again.</li>
                        <li><b>Clear the pitch</b> — takes everyone off. Clock and score stay running.</li>
                        <li><b>Reset everything</b> — full wipe.</li>
                    </ul>
                    <p>Each reset asks for a second tap to confirm.</p>
                    <p>To <b>edit the clock</b> — tap the big time at the top. Useful after a crash or to correct a mis-press.</p>
                </>
            ),
        },
        {
            id: 'background',
            icon: '📱',
            title: 'Mobile — clock keeps running',
            body: (
                <>
                    <p>When the phone locks or you switch to another app, the browser pauses JavaScript timers. Match Manager handles this — the clock is anchored to <b>real wall-clock time</b>, so the moment you return to the app it instantly catches up.</p>
                    <p>No manual sync needed.</p>
                    <p>(Safety: if the app was left running for more than 3 hours, on reopen it won't add the gap — it keeps the last known time so you can edit it yourself if needed.)</p>
                </>
            ),
        },
        {
            id: 'tweaks',
            icon: '🛠️',
            title: 'Settings (theme, colours, layout)',
            body: (
                <>
                    <p>Switch theme (dark / contrast / light), pick an accent colour, change density (standard / big-tap), and hide/show the Pool and Log tabs.</p>
                    <button
                        className="help-tweaks-btn"
                        onClick={() => {
                            onClose && onClose();
                            window.postMessage({ type: '__activate_edit_mode' }, '*');
                        }}
                    >
                        Open settings
                    </button>
                </>
            ),
        },
    ];

    return (
        <Sheet open={open} onClose={onClose} title="Help & guide" sub="Tap a section to expand.">
            <div className="help-sections">
                {sections.map(s => (
                    <div key={s.id} className={"help-section" + (openSection === s.id ? ' open' : '')}>
                        <button
                            className="help-section-head"
                            onClick={() => setOpenSection(openSection === s.id ? null : s.id)}
                        >
                            <span className="help-section-icon">{s.icon}</span>
                            <span className="help-section-title">{s.title}</span>
                            <span className="help-section-chev">{openSection === s.id ? '−' : '+'}</span>
                        </button>
                        {openSection === s.id && <div className="help-section-body">{s.body}</div>}
                    </div>
                ))}
            </div>
        </Sheet>
    );
}

function CandidateRow({ p, slotPos, time, onPick }) {
    const exact = p.positions.includes(slotPos);
    const isAll = p.positions.includes('ALL');
    const compat = !exact && !isAll && window.canPlay?.(p, slotPos);
    const offPos = !exact && !isAll && !compat;
    let tagText, tagCls;
    if (exact)       { tagText = 'EXACT';   tagCls = 'exact'; }
    else if (isAll)  { tagText = 'ALL';     tagCls = 'all'; }
    else if (compat) { tagText = 'FIT';     tagCls = 'compat'; }
    else             { tagText = 'OFF-POS'; tagCls = 'offpos'; }
    const posTag = isAll ? 'ALL' : p.positions.join('/');
    return (
        <button
            className={"cand" + (exact ? ' exact' : '') + (offPos ? ' offpos' : '')}
            onClick={() => onPick(p.id)}
        >
            <div className="cand-num">{p.n}</div>
            <div className="cand-info">
                <div className="cand-name">{p.name}</div>
                <div className="cand-meta">
                    <span className={"cand-tag " + tagCls}>{tagText}</span>
                    {posTag}
                </div>
            </div>
            <div className="cand-time">{fmt(time)}</div>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
//  SQUAD EDITOR  (player profiles — name, number, positions)
// ─────────────────────────────────────────────────────────────
const ALL_POSITIONS = ['GK','LB','CB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF','ALL'];

// ─── CSV import/export ───────────────────────────────────────
// Documented format (header row required; positions joined by `|`):
//
//     Number,Name,Positions
//     1,Matt Barker,RB|RW
//     2,Garee Hilsdon,CB|CDM
//     9,Phil Smith,ALL
//
// Accepted column synonyms (case-insensitive): #/num/number, name/player,
// positions/position/pos. Position values are normalised to uppercase and
// filtered against the known set. Empty positions default to ["CM"].
function splitCsvLine(line) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out.map(c => c.trim());
}
function parseSquadCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) throw new Error('CSV is empty');
    const rows = lines.map(splitCsvLine);
    const hdr = rows[0].map(c => c.toLowerCase());
    const looksHeader = hdr.some(c => /^(name|player|number|num|#|positions?|pos)$/.test(c));
    let nCol = 0, nameCol = 1, posCol = 2;
    let dataRows = rows;
    if (looksHeader) {
        nCol    = hdr.findIndex(c => /^(#|num|number)$/.test(c));
        nameCol = hdr.findIndex(c => /^(name|player)$/.test(c));
        posCol  = hdr.findIndex(c => /^(positions?|pos)$/.test(c));
        if (nameCol < 0) throw new Error("CSV needs a 'Name' column");
        if (nCol < 0)    nCol = 0;
        if (posCol < 0)  posCol = nameCol + 1;
        dataRows = rows.slice(1);
    }
    return dataRows.map((row, i) => {
        const numStr = (row[nCol] || '').trim();
        const name = (row[nameCol] || '').trim();
        const posStr = (row[posCol] || '').trim();
        let positions = posStr.split(/[|;\/]/).map(p => p.trim().toUpperCase()).filter(Boolean);
        positions = positions.filter(p => ALL_POSITIONS.includes(p));
        if (!positions.length) positions = ['CM'];
        return {
            id: i + 1,
            n:  parseInt(numStr, 10) || (i + 1),
            name: name || `Player ${i + 1}`,
            positions,
        };
    }).filter(p => p.name);
}
function squadToCsv(players) {
    const out = ['Number,Name,Positions'];
    players.forEach(p => {
        const safeName = /[,"\n]/.test(p.name) ? `"${p.name.replace(/"/g,'""')}"` : p.name;
        out.push(`${p.n},${safeName},${p.positions.join('|')}`);
    });
    return out.join('\n');
}

function PlayerEditor({ p, onUpdate, onTogglePos, onRemove }) {
    const [armed, setArmed] = useState(false);
    function doRemove() {
        if (!armed) {
            setArmed(true);
            setTimeout(() => setArmed(false), 3000);
            return;
        }
        setArmed(false);
        onRemove();
    }
    return (
        <div className="player-edit">
            <div className="pe-row">
                <input
                    className="pe-num"
                    type="number"
                    inputMode="numeric"
                    value={p.n}
                    min="1"
                    max="99"
                    onChange={e => onUpdate({ n: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) })}
                    aria-label="Jersey number"
                />
                <input
                    className="pe-name"
                    type="text"
                    value={p.name}
                    onChange={e => onUpdate({ name: e.target.value })}
                    aria-label="Player name"
                    placeholder="Player name"
                />
                <button className={"pe-del" + (armed ? ' armed' : '')} onClick={doRemove} aria-label="Remove player">
                    {armed ? '✓' : '×'}
                </button>
            </div>
            <div className="pe-positions">
                {ALL_POSITIONS.map(pos => (
                    <button key={pos}
                        data-pos={pos}
                        className={"pos-chip" + (p.positions.includes(pos) ? ' active' : '')}
                        onClick={() => onTogglePos(pos)}>{pos}</button>
                ))}
            </div>
        </div>
    );
}

// ─── Squad library (multiple named squads) ───────────────────
function SquadLibrary({ state, setState, onImportCsv }) {
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [armedDelete, setArmedDelete] = useState(false);
    const active = state.squads.find(s => s.id === state.activeSquadId) || state.squads[0];

    function loadSample() {
        const sample = (window.SAMPLE_SQUAD || []).map(p => ({ ...p, positions: [...p.positions] }));
        if (!sample.length) return;
        const id = uid();
        setState(s => ({
            ...s,
            squads: [...s.squads, { id, name: 'Sample squad', players: sample }],
        }));
        setTimeout(() => switchTo(id), 0);
    }

    function switchTo(id) {
        if (id === state.activeSquadId) return;
        setState(s => {
            const target = s.squads.find(sq => sq.id === id);
            if (!target) return s;
            window.SQUAD = target.players;
            const ptDef = {}; target.players.forEach(p => ptDef[p.id] = { total: 0, onSince: null });
            const psDef = {}; target.players.forEach(p => psDef[p.id] = { injured: false, yellow: 0, red: false });
            return {
                ...s,
                activeSquadId: id,
                squad: target.players,
                slots: buildSlots(s.formation),
                playerTimes: ptDef,
                playerStatus: psDef,
                history: [...(s.history || []), { at: s.matchSec, kind: 'card', text: `— Squad: ${target.name} —` }],
            };
        });
    }
    function addBlank() {
        const id = uid();
        setState(s => ({
            ...s,
            squads: [...s.squads, { id, name: `Squad ${s.squads.length + 1}`, players: [] }],
        }));
        setTimeout(() => switchTo(id), 0);
    }
    function duplicate() {
        const id = uid();
        setState(s => {
            const cur = s.squads.find(sq => sq.id === s.activeSquadId);
            if (!cur) return s;
            const players = cur.players.map(p => ({ ...p, positions: [...p.positions] }));
            return { ...s, squads: [...s.squads, { id, name: cur.name + ' (copy)', players }] };
        });
        setTimeout(() => switchTo(id), 0);
    }
    function rename(newName) {
        setState(s => ({
            ...s,
            squads: s.squads.map(sq => sq.id === s.activeSquadId ? { ...sq, name: newName || 'Untitled' } : sq),
        }));
    }
    function deleteActive() {
        if (state.squads.length <= 1) return;
        if (!armedDelete) {
            setArmedDelete(true);
            setTimeout(() => setArmedDelete(false), 3000);
            return;
        }
        setArmedDelete(false);
        setState(s => {
            if (s.squads.length <= 1) return s;
            const remaining = s.squads.filter(sq => sq.id !== s.activeSquadId);
            const next = remaining[0];
            window.SQUAD = next.players;
            const ptDef = {}; next.players.forEach(p => ptDef[p.id] = { total: 0, onSince: null });
            const psDef = {}; next.players.forEach(p => psDef[p.id] = { injured: false, yellow: 0, red: false });
            return {
                ...s,
                squads: remaining,
                activeSquadId: next.id,
                squad: next.players,
                slots: buildSlots(s.formation),
                playerTimes: ptDef,
                playerStatus: psDef,
            };
        });
    }

    return (
        <div className="squad-lib">
            <div className="squad-lib-row">
                {editingName ? (
                    <input
                        className="squad-lib-name-input"
                        autoFocus
                        value={nameDraft}
                        onChange={e => setNameDraft(e.target.value)}
                        onBlur={() => { rename(nameDraft.trim()); setEditingName(false); }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { rename(nameDraft.trim()); setEditingName(false); }
                            if (e.key === 'Escape') setEditingName(false);
                        }}
                    />
                ) : (
                    <button
                        className="squad-lib-name"
                        onClick={() => { setNameDraft(active.name); setEditingName(true); }}
                        title="Tap to rename squad"
                    >
                        <span className="squad-lib-name-text">{active.name}</span>
                        <span className="squad-lib-name-pencil">✎</span>
                    </button>
                )}
                <select
                    className="squad-lib-select"
                    value={state.activeSquadId}
                    onChange={e => switchTo(e.target.value)}
                    aria-label="Switch squad"
                >
                    {state.squads.map(sq => (
                        <option key={sq.id} value={sq.id}>{sq.name} ({sq.players.length})</option>
                    ))}
                </select>
            </div>
            <div className="squad-lib-actions">
                <button className="filter-chip" onClick={addBlank}>+ New</button>
                <button className="filter-chip" onClick={duplicate}>⎘ Duplicate</button>
                <button className="filter-chip" onClick={onImportCsv}>⤓ Import CSV</button>
                {(window.SAMPLE_SQUAD || []).length > 0 && state.squad.length === 0 && (
                    <button className="filter-chip" onClick={loadSample}>★ Load sample</button>
                )}
                <button
                    className={"filter-chip danger-chip" + (armedDelete ? ' armed' : '')}
                    onClick={deleteActive}
                    disabled={state.squads.length <= 1}
                >
                    {armedDelete ? 'Confirm delete' : '✕ Delete'}
                </button>
            </div>
        </div>
    );
}

function SquadEditor({ state, setState }) {
    const [backupSheet, setBackupSheet] = useState(false);
    const [importText, setImportText] = useState('');
    const [importMsg, setImportMsg] = useState('');
    const [csvSheet, setCsvSheet] = useState(false);
    const [csvText, setCsvText] = useState('');
    const [csvMsg, setCsvMsg] = useState('');
    const [csvAsNew, setCsvAsNew] = useState(true);

    function pickCsvFile() {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.csv,text/csv,text/plain';
        inp.onchange = e => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => setCsvText(reader.result || '');
            reader.readAsText(f);
        };
        inp.click();
    }

    function applyCsv() {
        try {
            const players = parseSquadCsv(csvText);
            if (!players.length) throw new Error('No player rows found');
            const ptDef = {}; players.forEach(p => ptDef[p.id] = { total: 0, onSince: null });
            const psDef = {}; players.forEach(p => psDef[p.id] = { injured: false, yellow: 0, red: false });
            setState(s => {
                if (csvAsNew) {
                    const id = uid();
                    const name = `Imported (${players.length})`;
                    window.SQUAD = players;
                    return {
                        ...s,
                        squads: [...s.squads, { id, name, players }],
                        activeSquadId: id,
                        squad: players,
                        slots: buildSlots(s.formation),
                        playerTimes: ptDef,
                        playerStatus: psDef,
                        history: [...(s.history || []), { at: s.matchSec, kind: 'card', text: `— Imported squad: ${name} —` }],
                    };
                } else {
                    // Replace active squad players
                    window.SQUAD = players;
                    const newSquads = s.squads.map(sq => sq.id === s.activeSquadId ? { ...sq, players } : sq);
                    return {
                        ...s,
                        squads: newSquads,
                        squad: players,
                        slots: buildSlots(s.formation),
                        playerTimes: ptDef,
                        playerStatus: psDef,
                    };
                }
            });
            setCsvMsg(`Imported ${players.length} players ✓`);
            setTimeout(() => { setCsvSheet(false); setCsvText(''); setCsvMsg(''); }, 700);
        } catch (e) {
            setCsvMsg('Import failed: ' + e.message);
        }
    }

    function exportCsv() {
        const csv = squadToCsv(state.squad);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0,10);
        const slug = (state.squads.find(s => s.id === state.activeSquadId)?.name || 'squad').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
        a.download = `${slug}-${date}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    }

    function updatePlayer(id, patch) {
        setState(s => withActiveSquadPlayers(s, s.squad.map(p => p.id === id ? { ...p, ...patch } : p)));
    }
    function togglePosition(id, pos) {
        setState(s => {
            const newPlayers = s.squad.map(p => {
                if (p.id !== id) return p;
                let positions;
                if (pos === 'ALL') {
                    positions = p.positions.includes('ALL') ? ['CM'] : ['ALL'];
                } else if (p.positions.includes('ALL')) {
                    positions = [pos];
                } else {
                    positions = p.positions.includes(pos)
                        ? p.positions.filter(x => x !== pos)
                        : [...p.positions, pos];
                    if (!positions.length) positions = [pos];
                }
                return { ...p, positions };
            });
            return withActiveSquadPlayers(s, newPlayers);
        });
    }
    function addPlayer() {
        setState(s => {
            const maxId = Math.max(0, ...s.squad.map(p => p.id));
            const maxN = Math.max(0, ...s.squad.map(p => p.n));
            const newP = { id: maxId + 1, n: maxN + 1, name: 'New Player', positions: ['CM'] };
            const base = withActiveSquadPlayers(s, [...s.squad, newP]);
            return {
                ...base,
                playerTimes:  { ...s.playerTimes,  [newP.id]: { total: 0, onSince: null } },
                playerStatus: { ...s.playerStatus, [newP.id]: { injured: false, yellow: 0, red: false } },
            };
        });
    }
    function removePlayer(id) {
        setState(s => {
            const slots = s.slots.map(sl => sl.playerId === id ? { ...sl, playerId: null } : sl);
            const base = withActiveSquadPlayers(s, s.squad.filter(p => p.id !== id));
            return { ...base, slots };
        });
    }
    function sortByNumber() {
        setState(s => withActiveSquadPlayers(s, [...s.squad].sort((a, b) => a.n - b.n)));
    }

    function exportJson() {
        const payload = {
            __format: 'matchmanager/v1',
            exportedAt: new Date().toISOString(),
            squad: state.squad,
            score: state.score,
            teamName: state.teamName,
            crest: state.crest,
            formation: state.formation,
            slots: state.slots,
            phase: state.phase,
            matchSec: state.matchSec,
            playerTimes: state.playerTimes,
            playerStatus: state.playerStatus,
            goals: state.goals,
            history: state.history,
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0,10);
        a.download = `mpb-squad-${date}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    }

    function exportToClipboard() {
        const payload = {
            __format: 'matchmanager/v1',
            squad: state.squad,
            score: state.score, teamName: state.teamName, crest: state.crest,
            formation: state.formation, slots: state.slots, phase: state.phase,
            matchSec: state.matchSec, playerTimes: state.playerTimes,
            playerStatus: state.playerStatus, goals: state.goals, history: state.history,
        };
        const json = JSON.stringify(payload);
        setImportText(json);
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(json).then(
                () => setImportMsg('Copied to clipboard ✓'),
                () => setImportMsg('Copy failed — select all & copy from the box below.')
            );
        } else {
            setImportMsg('Select all and copy from the box below.');
        }
    }

    function importJsonFromFile() {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.json,application/json,text/plain';
        inp.onchange = e => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => applyImport(reader.result);
            reader.readAsText(f);
        };
        inp.click();
    }

    function applyImport(text) {
        try {
            const data = JSON.parse(text);
            if (!data || (!data.squad && !data.teamName)) throw new Error('No squad data found in file');
            setState(s => ({
                ...s,
                squad: data.squad || s.squad,
                score: data.score || s.score,
                teamName: data.teamName || s.teamName,
                crest: data.crest || s.crest,
                formation: data.formation || s.formation,
                slots: data.slots || s.slots,
                phase: data.phase || s.phase,
                matchSec: data.matchSec ?? s.matchSec,
                playerTimes:  Object.assign({}, s.playerTimes,  data.playerTimes  || {}),
                playerStatus: Object.assign({}, s.playerStatus, data.playerStatus || {}),
                goals: data.goals || s.goals,
                history: data.history || s.history,
            }));
            setImportMsg('Imported ✓ ' + (data.squad?.length || 0) + ' players');
            setTimeout(() => { setBackupSheet(false); setImportMsg(''); setImportText(''); }, 800);
        } catch (e) {
            setImportMsg('Import failed: ' + e.message);
        }
    }

    return (
        <div className="squad-editor">
            <SquadLibrary state={state} setState={setState} onImportCsv={() => setCsvSheet(true)} />
            <div className="squad-edit-tools">
                <button className="filter-chip" onClick={sortByNumber}>Sort by #</button>
                <button className="filter-chip" onClick={addPlayer}>+ Add player</button>
                <button className="filter-chip" onClick={exportCsv}>⤴ Export CSV</button>
                <button className="filter-chip" onClick={() => setBackupSheet(true)}>⤓ Backup</button>
            </div>
            <div className="squad-edit-list">
                {state.squad.length === 0 && (
                    <div className="squad-empty">
                        <div className="squad-empty-title">No players yet</div>
                        <div className="squad-empty-sub">Tap <b>+ Add player</b> above, or <b>Import CSV</b> from the squad card to populate this squad.</div>
                    </div>
                )}
                {state.squad.map(p => (
                    <PlayerEditor key={p.id} p={p}
                        onUpdate={(patch) => updatePlayer(p.id, patch)}
                        onTogglePos={(pos) => togglePosition(p.id, pos)}
                        onRemove={() => removePlayer(p.id)} />
                ))}
            </div>

            <Sheet
                open={backupSheet}
                onClose={() => { setBackupSheet(false); setImportText(''); setImportMsg(''); }}
                title="Backup & restore"
                sub="Save a JSON file of your squad and match — restore it anytime, on any device."
            >
                <div className="backup-grid">
                    <button className="sheet-action" onClick={exportJson}>
                        <span className="ic">↓</span>
                        <div style={{flex:1, textAlign:'left'}}>
                            <div style={{fontWeight:700}}>Download backup</div>
                            <div style={{fontSize:11, color:'var(--text-3)'}}>Saves a .json file to your phone</div>
                        </div>
                    </button>
                    <button className="sheet-action" onClick={exportToClipboard}>
                        <span className="ic">⧉</span>
                        <div style={{flex:1, textAlign:'left'}}>
                            <div style={{fontWeight:700}}>Copy JSON</div>
                            <div style={{fontSize:11, color:'var(--text-3)'}}>Paste anywhere — Notes, email, etc.</div>
                        </div>
                    </button>
                    <button className="sheet-action" onClick={importJsonFromFile}>
                        <span className="ic">↑</span>
                        <div style={{flex:1, textAlign:'left'}}>
                            <div style={{fontWeight:700}}>Restore from file</div>
                            <div style={{fontSize:11, color:'var(--text-3)'}}>Open a previously-saved .json</div>
                        </div>
                    </button>
                </div>
                <div className="sheet-section-label">Paste JSON to restore</div>
                <textarea
                    className="backup-paste"
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder='{"__format":"matchmanager/v1", "squad": [...] ...}'
                    rows={6}
                />
                <div className="backup-actions">
                    <button className="filter-chip" onClick={() => { setImportText(''); setImportMsg(''); }}>Clear</button>
                    <button
                        className="sheet-action"
                        style={{background:'var(--accent)', color:'var(--accent-ink)', border:'none', justifyContent:'center', fontWeight:700, margin:0, flex:1}}
                        onClick={() => applyImport(importText)}
                        disabled={!importText.trim()}
                    >
                        Restore from pasted JSON
                    </button>
                </div>
                {importMsg && <div className="backup-msg">{importMsg}</div>}
            </Sheet>

            <Sheet
                open={csvSheet}
                onClose={() => { setCsvSheet(false); setCsvText(''); setCsvMsg(''); }}
                title="Import squad from CSV"
                sub="One row per player. Columns: Number, Name, Positions."
            >
                <button className="sheet-action" onClick={pickCsvFile}>
                    <span className="ic">↑</span>
                    <div style={{flex:1, textAlign:'left'}}>
                        <div style={{fontWeight:700}}>Pick a .csv file</div>
                        <div style={{fontSize:11, color:'var(--text-3)'}}>From your phone, email, or cloud storage</div>
                    </div>
                </button>
                <div className="sheet-section-label">Or paste CSV</div>
                <textarea
                    className="backup-paste"
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                    placeholder={'Number,Name,Positions\n1,Matt Barker,RB|RW\n2,Garee Hilsdon,CB|CDM\n9,Phil Smith,ALL'}
                    rows={7}
                />
                <div className="csv-mode">
                    <label className={"csv-mode-opt" + (csvAsNew ? ' active' : '')}>
                        <input type="radio" name="csvmode" checked={csvAsNew} onChange={() => setCsvAsNew(true)} />
                        <div>
                            <div className="csv-mode-title">Save as new squad</div>
                            <div className="csv-mode-sub">Keeps your current squads, switches to the imported one</div>
                        </div>
                    </label>
                    <label className={"csv-mode-opt" + (!csvAsNew ? ' active' : '')}>
                        <input type="radio" name="csvmode" checked={!csvAsNew} onChange={() => setCsvAsNew(false)} />
                        <div>
                            <div className="csv-mode-title">Replace active squad</div>
                            <div className="csv-mode-sub">Overwrites the players in “{state.squads.find(s => s.id === state.activeSquadId)?.name}”</div>
                        </div>
                    </label>
                </div>
                <div className="backup-actions">
                    <button className="filter-chip" onClick={() => { setCsvText(''); setCsvMsg(''); }}>Clear</button>
                    <button
                        className="sheet-action"
                        style={{background:'var(--accent)', color:'var(--accent-ink)', border:'none', justifyContent:'center', fontWeight:700, margin:0, flex:1}}
                        onClick={applyCsv}
                        disabled={!csvText.trim()}
                    >
                        Import {csvAsNew ? 'as new squad' : 'and replace'}
                    </button>
                </div>
                {csvMsg && <div className="backup-msg">{csvMsg}</div>}
                <div className="csv-help">
                    <div className="csv-help-title">CSV format</div>
                    <pre className="csv-help-pre">{`Number,Name,Positions
1,Matt Barker,RB|RW
2,Garee Hilsdon,CB|CDM
9,Phil Smith,ALL`}</pre>
                    <div className="csv-help-note">
                        Positions: <code>GK LB CB RB LWB RWB CDM CM CAM LM RM LW RW ST CF ALL</code> — separate multiples with <code>|</code>.
                    </div>
                </div>
            </Sheet>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
//  APP ROOT
// ─────────────────────────────────────────────────────────────
function App({ tweaks, onShowWelcome }) {
    const [state, setState] = useState(loadInitial);
    const [tickN, setTickN] = useState(0); // forces re-render once per second while running
    const [activeSlot, setActiveSlot] = useState(null); // slot index or null
    const [activePlayer, setActivePlayer] = useState(null); // bench player id we're trying to sub on
    const [goalSheet, setGoalSheet] = useState(null); // {team:'us'|'them'} | null
    const [resetSheet, setResetSheet] = useState(false);
    const [clockEdit, setClockEdit] = useState(null); // {mins, secs} | null
    const [view, setView] = useState('match'); // 'match' | 'history' | 'pool' | 'squad'
    const [sortMode, setSortMode] = useState('least');
    const [justSubbed, setJustSubbed] = useState(null);
    const [lineupSheet, setLineupSheet] = useState(false);
    const [helpSheet, setHelpSheet] = useState(false);

    const running = state.phase === '1h' || state.phase === '2h';

    // expose for direct DOM tweaks if needed
    useEffect(() => {
        document.documentElement.dataset.theme = tweaks.theme;
        document.documentElement.dataset.density = tweaks.density;
    }, [tweaks.theme, tweaks.density]);

    // Keep window.SQUAD in sync with editable state.squad so existing
    // components (Pitch, Bench, Pool, etc.) that reference the global all
    // resolve to the same data.
    useEffect(() => {
        if (state.squad) window.SQUAD = state.squad;
    }, [state.squad]);

    // persist (locally) — bumps updatedAt on every change so cloud sync can compare clocks
    useEffect(() => {
        const toSave = { ...state, updatedAt: Date.now() };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch (e) {}
    }, [state]);

    // Cloud sync (Cloudflare Access + Pages Functions + D1). No-op when not signed in.
    const sync = useCloudSync(state, setState);

    // clock tick — drives both the running clock AND a re-render so that
    // the wall-clock-derived display stays current. When the device
    // backgrounds the tab the interval is paused/throttled; on resume the
    // visibilitychange listener (below) triggers an immediate catch-up.
    useEffect(() => {
        if (!running) return;
        function tick() {
            setState(s => {
                if (!s.clockStartedAt) return s;
                const live = s.matchSecBase + Math.floor((Date.now() - s.clockStartedAt) / 1000);
                if (live === s.matchSec) return s;
                return { ...s, matchSec: live };
            });
            setTickN(n => n + 1);
        }
        tick(); // immediate catch-up on mount / resume
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [running]);

    // When the tab becomes visible again on mobile, force an immediate
    // re-sync rather than waiting for the next 1s interval to fire.
    useEffect(() => {
        function onVis() {
            if (document.visibilityState !== 'visible') return;
            setState(s => {
                if (!s.clockStartedAt) return s;
                const live = s.matchSecBase + Math.floor((Date.now() - s.clockStartedAt) / 1000);
                if (live === s.matchSec) return s;
                return { ...s, matchSec: live };
            });
            setTickN(n => n + 1);
        }
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('focus', onVis);
        window.addEventListener('pageshow', onVis);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('focus', onVis);
            window.removeEventListener('pageshow', onVis);
        };
    }, []);

    // getTime, recomputed each tick
    const getTime = useCallback((id) => {
        const pt = state.playerTimes[id];
        if (!pt) return 0;
        let t = pt.total;
        if (pt.onSince !== null && running) t += state.matchSec - pt.onSince;
        return t;
    }, [state.playerTimes, state.matchSec, running, tickN]);

    // Dispatch
    function dispatch(action) {
        setState(prev => reduce(prev, action, { matchSec: prev.matchSec, running }));
    }

    function advancePhase() {
        setState(s => {
            const next = PHASE_INFO[s.phase].next;
            if (!next) return s;
            const slots = s.slots;
            const playerTimes = { ...s.playerTimes };
            const history = [...(s.history || [])];

            // Going from a non-running phase → running ('1h' or '2h'): anchor onSince
            // Going from a running phase → paused: commit accumulated time
            const wasRunning = s.phase === '1h' || s.phase === '2h';
            const willRun    = next === '1h' || next === '2h';

            // Compute the matchSec value at the moment of transition. If the
            // clock was running, the truth is the wall-clock-derived value.
            const transitionSec = wasRunning && s.clockStartedAt
                ? s.matchSecBase + Math.floor((Date.now() - s.clockStartedAt) / 1000)
                : s.matchSec;

            if (wasRunning && !willRun) {
                // commit player times against the transition moment
                slots.forEach(sl => {
                    if (sl.playerId) {
                        const pt = playerTimes[sl.playerId];
                        if (pt.onSince !== null) {
                            playerTimes[sl.playerId] = { total: pt.total + (transitionSec - pt.onSince), onSince: null };
                        }
                    }
                });
            } else if (!wasRunning && willRun) {
                // anchor on-pitch players to the transition moment
                slots.forEach(sl => {
                    if (sl.playerId) playerTimes[sl.playerId] = { ...playerTimes[sl.playerId], onSince: transitionSec };
                });
            }

            const labels = {
                '1h': '— Kick Off —',
                ht:   '— Half Time —',
                '2h': '— Second Half —',
                ft:   '— Full Time —',
            };
            history.push({ at: transitionSec, kind: 'phase', text: labels[next] });

            const out = {
                ...s,
                phase: next,
                playerTimes,
                history,
                matchSec: transitionSec,
                // Wall-clock anchors: set when entering a running phase, cleared when leaving one
                clockStartedAt: willRun ? Date.now() : null,
                matchSecBase: willRun ? transitionSec : s.matchSecBase,
            };
            if (next === 'ht') out.htAt = transitionSec;
            if (next === 'ft') out.ftAt = transitionSec;
            return out;
        });
    }

    function resetTimeOnly() {
        // Reset only the clock — leaves score, lineup, player times, cards
        // and history alone. Useful to restart timing without losing context.
        setState(s => ({
            ...s,
            matchSec: 0,
            matchSecBase: 0,
            clockStartedAt: null,
            phase: 'pre',
            htAt: null,
            ftAt: null,
            // Re-anchor on-pitch onSince to 0 so when they kick off again,
            // accumulated player time keeps adding from the new 0:00.
            playerTimes: Object.fromEntries(Object.entries(s.playerTimes || {}).map(([id, pt]) => [
                id,
                pt && pt.onSince !== null ? { ...pt, onSince: 0 } : pt,
            ])),
        }));
        setResetSheet(false);
    }

    function resetClockAndMatch() {
        // Reset the match itself — clock, phase, score, cards, goals, history,
        // player times. Keep the chosen pitch lineup so you can start a new
        // match with the same XI.
        setState(s => ({
            ...s,
            matchSec: 0,
            matchSecBase: 0,
            clockStartedAt: null,
            score: { us: 0, them: 0 },
            phase: 'pre',
            htAt: null,
            ftAt: null,
            goals: [],
            history: [],
            playerTimes: emptyTimes(),
            playerStatus: emptyStatus(),
            slots: s.slots,
        }));
        setResetSheet(false);
    }
    function clearPitch() {
        // Take everyone off but leave clock/score/phase running.
        setState(s => {
            const playerTimes = { ...s.playerTimes };
            const running = s.phase === '1h' || s.phase === '2h';
            s.slots.forEach(sl => {
                if (sl.playerId) {
                    const pt = playerTimes[sl.playerId];
                    if (pt && pt.onSince !== null) {
                        playerTimes[sl.playerId] = { total: pt.total + (running ? (s.matchSec - pt.onSince) : 0), onSince: null };
                    }
                }
            });
            return {
                ...s,
                slots: s.slots.map(sl => ({ ...sl, playerId: null, locked: null })),
                playerTimes,
                history: [...(s.history || []), { at: s.matchSec, kind: 'card', text: '— Pitch cleared —' }],
            };
        });
        setResetSheet(false);
    }
    function resetEverything() {
        setState(s => ({
            ...s,
            matchSec: 0,
            matchSecBase: 0,
            clockStartedAt: null,
            score: { us: 0, them: 0 },
            phase: 'pre',
            htAt: null,
            ftAt: null,
            goals: [],
            history: [],
            playerTimes: emptyTimes(),
            playerStatus: emptyStatus(),
            slots: s.slots.map(sl => ({ ...sl, playerId: null, locked: null })),
        }));
        setResetSheet(false);
    }

    // Goals
    function recordGoal(team, scorerId) {
        setState(s => {
            const goals = [...(s.goals || []), { at: s.matchSec, team, scorerId: scorerId || null }];
            const score = { ...s.score, [team]: s.score[team] + 1 };
            const name = scorerId ? SQUAD.find(p => p.id === scorerId)?.name : null;
            const teamLabel = s.teamName[team];
            const text = scorerId
                ? `⚽ ${name} (${teamLabel})`
                : team === 'us'
                    ? `⚽ Goal for ${teamLabel}`
                    : `Conceded — ${teamLabel} scored`;
            return { ...s, goals, score, history: [...(s.history || []), { at: s.matchSec, kind: 'goal', text }] };
        });
    }
    function undoLastGoal(team) {
        setState(s => {
            const goals = [...(s.goals || [])];
            for (let i = goals.length - 1; i >= 0; i--) {
                if (goals[i].team === team) {
                    goals.splice(i, 1);
                    const score = { ...s.score, [team]: Math.max(0, s.score[team] - 1) };
                    return { ...s, goals, score };
                }
            }
            return s;
        });
    }
    function setCrest(team, dataUrl) {
        setState(s => ({ ...s, crest: { ...s.crest, [team]: dataUrl } }));
    }
    function onTapScore(team) {
        setGoalSheet({ team });
    }
    function onTapClock() {
        setClockEdit({ mins: Math.floor(state.matchSec / 60), secs: state.matchSec % 60 });
    }
    function applyClockEdit() {
        if (!clockEdit) return;
        const newSec = Math.max(0, (parseInt(clockEdit.mins) || 0) * 60 + (parseInt(clockEdit.secs) || 0));
        setState(s => {
            const playerTimes = { ...s.playerTimes };
            // Re-anchor on-pitch onSince for the new clock so player timers continue cleanly
            s.slots.forEach(sl => {
                if (sl.playerId && playerTimes[sl.playerId]?.onSince !== null && playerTimes[sl.playerId]?.onSince !== undefined) {
                    playerTimes[sl.playerId] = { ...playerTimes[sl.playerId], onSince: newSec };
                }
            });
            const running = s.phase === '1h' || s.phase === '2h';
            return {
                ...s,
                matchSec: newSec,
                matchSecBase: newSec,
                // If running, re-anchor wall clock to "now" so elapsed counts from the new value
                clockStartedAt: running ? Date.now() : null,
                playerTimes,
            };
        });
        setClockEdit(null);
    }

    // Goals scored map
    const goalsByPlayer = useMemo(() => {
        const m = {};
        (state.goals || []).forEach(g => { if (g.scorerId) m[g.scorerId] = (m[g.scorerId] || 0) + 1; });
        return m;
    }, [state.goals]);

    // Player actions
    function assignToSlot(slotIdx, playerId) {
        setState(s => {
            const slots = s.slots.map(x => ({ ...x }));
            const playerTimes = { ...s.playerTimes };
            const history = [...(s.history || [])];
            const slot = slots[slotIdx];
            if (slot.locked && playerId) return s; // locked due to red card — no replacement
            const offId = slot.playerId;
            // commit time of outgoing
            if (offId) {
                const pt = playerTimes[offId];
                if (pt.onSince !== null) {
                    playerTimes[offId] = { total: pt.total + (s.matchSec - pt.onSince), onSince: null };
                } else {
                    playerTimes[offId] = { ...pt, onSince: null };
                }
            }
            // if incoming was on another slot, vacate it
            if (playerId) {
                slots.forEach((sl, i) => {
                    if (i !== slotIdx && sl.playerId === playerId) {
                        const pt2 = playerTimes[playerId];
                        if (pt2.onSince !== null) playerTimes[playerId] = { total: pt2.total + (s.matchSec - pt2.onSince), onSince: null };
                        sl.playerId = null;
                    }
                });
            }
            slot.playerId = playerId || null;
            if (playerId && running) playerTimes[playerId] = { ...playerTimes[playerId], onSince: s.matchSec };

            // history entry
            const onP = playerId ? SQUAD.find(p => p.id === playerId) : null;
            const offP = offId ? SQUAD.find(p => p.id === offId) : null;
            if (onP && offP) history.push({ at: s.matchSec, kind: 'sub', on: onP.name, off: offP.name, pos: slot.label });
            else if (onP) history.push({ at: s.matchSec, kind: 'on', on: onP.name, pos: slot.label });
            else if (offP) history.push({ at: s.matchSec, kind: 'off', off: offP.name, pos: slot.label });
            return { ...s, slots, playerTimes, history };
        });
        setJustSubbed(slotIdx);
        setTimeout(() => setJustSubbed(null), 1100);
    }

    function removeFromPitch(playerId) {
        const slotIdx = state.slots.findIndex(s => s.playerId === playerId);
        if (slotIdx >= 0) assignToSlot(slotIdx, null);
    }

    // Move an on-pitch player to a different slot. If the destination is
    // occupied, the players swap. Both stay on the pitch — clocks are not
    // committed (they're still playing, just in a new role).
    function movePlayerToSlot(fromIdx, toIdx) {
        if (fromIdx === toIdx) return;
        setState(s => {
            const slots = s.slots.map(x => ({ ...x }));
            const fromSlot = slots[fromIdx];
            const toSlot   = slots[toIdx];
            if (!fromSlot || !toSlot) return s;
            if (toSlot.locked) return s; // can't move into a red-card-locked slot
            const movingId = fromSlot.playerId;
            const displacedId = toSlot.playerId || null;
            slots[toIdx]   = { ...toSlot,   playerId: movingId };
            slots[fromIdx] = { ...fromSlot, playerId: displacedId };

            const movingP    = movingId    ? SQUAD.find(p => p.id === movingId)    : null;
            const displacedP = displacedId ? SQUAD.find(p => p.id === displacedId) : null;
            const history = [...(s.history || [])];
            if (movingP && displacedP) {
                history.push({ at: s.matchSec, kind: 'sub', on: movingP.name, off: displacedP.name, pos: `${fromSlot.label} ↔ ${toSlot.label}` });
            } else if (movingP) {
                history.push({ at: s.matchSec, kind: 'on', on: movingP.name, pos: `${fromSlot.label} → ${toSlot.label}` });
            }
            return { ...s, slots, history };
        });
        setJustSubbed(toIdx);
        setTimeout(() => setJustSubbed(null), 1100);
    }

    function changeFormation(name) {
        setState(s => {
            const prevAssign = s.slots.filter(x => x.playerId).map(x => ({ id: x.playerId, pos: x.slotPos }));
            const slots = buildSlots(name);
            prevAssign.forEach(p => {
                let slot = slots.find(sl => !sl.playerId && sl.slotPos === p.pos);
                if (!slot) slot = slots.find(sl => !sl.playerId && canPlay(SQUAD.find(x => x.id === p.id), sl.slotPos));
                if (slot) slot.playerId = p.id;
            });
            return { ...s, formation: name, slots };
        });
    }

    function toggleStatus(playerId, which) {
        setState(s => {
            const ps = { ...s.playerStatus, [playerId]: { ...(s.playerStatus[playerId] || { injured:false, yellow:0, red:false }) } };
            const player = ps[playerId];
            const name = SQUAD.find(p => p.id === playerId)?.name || 'Player';
            const history = [...(s.history || [])];
            const playerTimes = { ...s.playerTimes };
            const slots = s.slots.map(x => ({ ...x }));

            if (which === 'yellow') {
                if (player.yellow === 0) { player.yellow = 1; history.push({ at: s.matchSec, kind: 'card', text: `Yellow: ${name}` }); }
                else if (player.yellow === 1) { player.yellow = 2; player.red = true; history.push({ at: s.matchSec, kind: 'card', text: `2nd Yellow → Red: ${name}` }); }
                else { player.yellow = 0; player.red = false; }
            } else if (which === 'red') {
                player.red = !player.red;
                if (player.red) history.push({ at: s.matchSec, kind: 'card', text: `Red: ${name}` });
            } else if (which === 'injured') {
                player.injured = !player.injured;
                if (player.injured) history.push({ at: s.matchSec, kind: 'card', text: `Injured: ${name}` });
            }

            // If now unavailable and on pitch — remove. RED card additionally
            // locks the slot so no replacement can be brought on (team plays a
            // player down). Injured players free the slot for a substitute.
            if (player.red || player.injured) {
                slots.forEach(sl => {
                    if (sl.playerId === playerId) {
                        const pt = playerTimes[playerId];
                        if (pt.onSince !== null) playerTimes[playerId] = { total: pt.total + (s.matchSec - pt.onSince), onSince: null };
                        sl.playerId = null;
                        if (player.red) sl.locked = { reason: 'red', playerId };
                    }
                });
            }
            // If red was UN-set (correction), unlock any slot we locked for them.
            if (which === 'red' && !player.red) {
                slots.forEach(sl => {
                    if (sl.locked?.playerId === playerId) sl.locked = null;
                });
            }
            return { ...s, playerStatus: ps, history, playerTimes, slots };
        });
    }

    // Sub flow: from bench tap "Sub in"
    function onBenchSubIn(playerId) {
        const p = SQUAD.find(x => x.id === playerId);
        setActivePlayer({ player: p });
    }

    // From a pitch slot tap
    const slotSheet = activeSlot != null ? state.slots[activeSlot] : null;
    const slotPlayer = slotSheet?.playerId ? SQUAD.find(p => p.id === slotSheet.playerId) : null;

    // Candidates for empty-slot picker. Returns ALL available players so the
    // manager can pick someone out-of-position if no fits exist. Sorted:
    //   exact match → fits (canPlay) → ALL-rounder → off-position
    // Within each tier, by least time played.
    function candidatesFor(slotPos) {
        const onIds = new Set(state.slots.filter(s => s.playerId).map(s => s.playerId));
        const list = SQUAD.filter(p => {
            if (onIds.has(p.id)) return false;
            const st = state.playerStatus[p.id];
            if (st && (st.injured || st.red)) return false;
            return true;
        });
        const tier = (p) => {
            if (p.positions.includes(slotPos)) return 0;     // EXACT
            if (canPlay(p, slotPos) && !p.positions.includes('ALL')) return 1;  // FIT
            if (p.positions.includes('ALL')) return 2;       // ALL-rounder
            return 3;                                         // OFF-POSITION
        };
        list.sort((a, b) => {
            const ta = tier(a), tb = tier(b);
            if (ta !== tb) return ta - tb;
            return getTime(a.id) - getTime(b.id);
        });
        return list;
    }

    // Slots a given player can fill (for "sub in" from bench). Returns
    // every non-locked slot — fitting slots first, then off-position slots
    // so the manager can override when needed.
    function slotsForPlayer(player) {
        const out = [];
        state.slots.forEach((s, i) => {
            if (s.locked) return; // can't replace a sent-off player's slot
            const fits = canPlay(player, s.slotPos);
            out.push({ idx: i, slot: s, current: s.playerId ? SQUAD.find(p => p.id === s.playerId) : null, fits });
        });
        // Sort: fitting slots first, then empty inside each group, then by current player's most time
        out.sort((a, b) => {
            if (a.fits !== b.fits) return a.fits ? -1 : 1;
            if (!a.current && b.current) return -1;
            if (a.current && !b.current) return 1;
            if (a.current && b.current) return getTime(b.current.id) - getTime(a.current.id);
            return 0;
        });
        return out;
    }

    const formations = Object.keys(FORMATIONS);
    const showPool = tweaks.show_pool;
    const showHistory = tweaks.show_history;

    return (
        <div className="app">
            <SessionExpiredBanner sync={sync} />
            <TopBar
                state={state}
                dispatch={(a) => setState(s => reduce(s, a))}
                onAdvancePhase={advancePhase}
                onReset={() => setResetSheet(true)}
                onTapScore={onTapScore}
                onSetCrest={setCrest}
                onTapClock={onTapClock}
                resetArmed={false}
                sync={sync}
                onShowWelcome={onShowWelcome}
                onShowHelp={() => setHelpSheet(true)}
            />

            <StatsRail state={state} getTime={getTime} />

            <div className="view-tabs">
                <button className={"view-tab" + (view === 'match' ? ' active' : '')} onClick={() => setView('match')}>Match</button>
                {showPool && <button className={"view-tab" + (view === 'pool' ? ' active' : '')} onClick={() => setView('pool')}>Pool</button>}
                {showHistory && <button className={"view-tab" + (view === 'history' ? ' active' : '')} onClick={() => setView('history')}>Log</button>}
                <button className={"view-tab" + (view === 'squad' ? ' active' : '')} onClick={() => setView('squad')}>Squad</button>
            </div>

            {view === 'match' && (
                <>
                    <div className="section">
                        <div className="formation-strip">
                            {formations.map(name => (
                                <button key={name}
                                    className={"form-chip" + (state.formation === name ? ' active' : '')}
                                    onClick={() => changeFormation(name)}>{name}</button>
                            ))}
                        </div>
                        <Lineups state={state} setState={setState} onManage={() => setLineupSheet(true)} />
                        <Pitch state={state} getTime={getTime}
                               onSlotTap={si => setActiveSlot(si)}
                               goalsByPlayer={goalsByPlayer}
                               justSubbed={justSubbed} />
                    </div>

                    <div className="section">
                        <div className="section-head">
                            <div className="section-title">Bench</div>
                            <div className="section-meta">{SQUAD.length - state.slots.filter(s => s.playerId).length} available</div>
                        </div>
                        <Bench state={state} getTime={getTime}
                               onCardTap={(id) => {
                                   const p = SQUAD.find(x => x.id === id);
                                   setActivePlayer({ player: p, mode: 'manage' });
                               }}
                               onSubInTap={onBenchSubIn}
                               goalsByPlayer={goalsByPlayer}
                               sortMode={sortMode} setSortMode={setSortMode} />
                    </div>
                </>
            )}

            {view === 'pool' && (
                <div className="section">
                    <div className="section-head">
                        <div className="section-title">Position Pool</div>
                        <div className="section-meta">Who can play where</div>
                    </div>
                    <PositionPool state={state} />
                </div>
            )}

            {view === 'history' && (
                <div className="section">
                    <div className="section-head">
                        <div className="section-title">Match Log</div>
                        <div className="section-meta">{state.history?.length || 0} events</div>
                    </div>
                    <History state={state} />
                </div>
            )}

            {view === 'squad' && (
                <div className="section">
                    <div className="section-head">
                        <div className="section-title">Squad Editor</div>
                        <div className="section-meta">{state.squad.length} players</div>
                    </div>
                    <SquadEditor state={state} setState={setState} />
                </div>
            )}

            {/* Section tabs moved to inline strip near top (above) — keeps them
                accessible inside host apps that overlay the viewport bottom. */}

            {/* Empty-slot picker */}
            <Sheet
                open={activeSlot != null && !slotPlayer}
                onClose={() => setActiveSlot(null)}
                title={slotSheet ? (slotSheet.locked ? `${slotSheet.label} — Sent off` : `Pick a player for ${slotSheet.label}`) : ''}
                sub={slotSheet ? (slotSheet.locked
                    ? `${SQUAD.find(p => p.id === slotSheet.locked.playerId)?.name || 'Player'} was sent off — no replacement allowed.`
                    : 'Sorted by best fit & least played') : ''}
            >
                {slotSheet && slotSheet.locked && (
                    <button className="sheet-action danger" onClick={() => {
                        // Manager override: clear the lock (also undoes the red card on that player)
                        const lockedPid = slotSheet.locked.playerId;
                        setState(s => {
                            const slots = s.slots.map(sl => sl.locked?.playerId === lockedPid ? { ...sl, locked: null } : sl);
                            const ps = { ...s.playerStatus };
                            if (ps[lockedPid]) ps[lockedPid] = { ...ps[lockedPid], red: false, yellow: ps[lockedPid].yellow === 2 ? 1 : ps[lockedPid].yellow };
                            return { ...s, slots, playerStatus: ps };
                        });
                        setActiveSlot(null);
                    }}>
                        <span className="ic">↺</span> Unlock slot (overrule red card)
                    </button>
                )}
                {slotSheet && !slotSheet.locked && candidatesFor(slotSheet.slotPos).map(p => (
                    <CandidateRow key={p.id} p={p} slotPos={slotSheet.slotPos} time={getTime(p.id)}
                                  onPick={(id) => { assignToSlot(activeSlot, id); setActiveSlot(null); }} />
                ))}
                {slotSheet && !slotSheet.locked && candidatesFor(slotSheet.slotPos).length === 0 && (
                    <div className="empty">No available players — everyone fit is already on the pitch.</div>
                )}
            </Sheet>

            {/* On-pitch player actions */}
            <Sheet
                open={activeSlot != null && !!slotPlayer}
                onClose={() => setActiveSlot(null)}
                title={slotPlayer?.name}
                sub={slotPlayer ? `#${slotPlayer.n} · ${slotSheet.label} · played ${fmt(getTime(slotPlayer.id))}` : ''}
            >
                {slotPlayer && (
                    <>
                        <div className="sheet-status">
                            {(() => {
                                const st = state.playerStatus[slotPlayer.id] || {};
                                return (
                                    <>
                                        <button className={"status-tile" + (st.yellow ? ' on yellow' : '')} onClick={() => toggleStatus(slotPlayer.id, 'yellow')}>
                                            <span className="badge">{st.yellow === 2 ? 'YY' : 'Y'}</span>
                                            {st.yellow === 2 ? '2nd Yellow' : st.yellow === 1 ? 'Yellow' : 'Yellow'}
                                        </button>
                                        <button className={"status-tile" + (st.red ? ' on red' : '')} onClick={() => toggleStatus(slotPlayer.id, 'red')}>
                                            <span className="badge">R</span>Red
                                        </button>
                                        <button className={"status-tile" + (st.injured ? ' on inj' : '')} onClick={() => toggleStatus(slotPlayer.id, 'injured')}>
                                            <span className="badge">I</span>Injured
                                        </button>
                                    </>
                                );
                            })()}
                        </div>

                        <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',margin:'6px 4px'}}>Substitute with</div>
                        {candidatesFor(slotSheet.slotPos).slice(0, 12).map(p => (
                            <CandidateRow key={p.id} p={p} slotPos={slotSheet.slotPos} time={getTime(p.id)}
                                          onPick={(id) => { assignToSlot(activeSlot, id); setActiveSlot(null); }} />
                        ))}

                        {(() => {
                            const moveTargets = state.slots
                                .map((sl, i) => ({ sl, i }))
                                .filter(({ sl, i }) => i !== activeSlot && !sl.locked);
                            if (moveTargets.length === 0) return null;
                            // sort: fitting empty, fitting occupied, off-pos empty, off-pos occupied
                            moveTargets.sort((a, b) => {
                                const aFit = canPlay(slotPlayer, a.sl.slotPos);
                                const bFit = canPlay(slotPlayer, b.sl.slotPos);
                                if (aFit !== bFit) return aFit ? -1 : 1;
                                if (!a.sl.playerId && b.sl.playerId) return -1;
                                if (a.sl.playerId && !b.sl.playerId) return 1;
                                return 0;
                            });
                            return (
                                <>
                                    <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',margin:'14px 4px 6px'}}>
                                        Move {slotPlayer.name.split(' ')[0]} to…
                                    </div>
                                    {moveTargets.slice(0, 12).map(({ sl, i }) => {
                                        const fits = canPlay(slotPlayer, sl.slotPos);
                                        const occupant = sl.playerId ? SQUAD.find(p => p.id === sl.playerId) : null;
                                        return (
                                            <button
                                                key={i}
                                                className={"cand" + (fits ? '' : ' offpos')}
                                                onClick={() => { movePlayerToSlot(activeSlot, i); setActiveSlot(null); }}
                                            >
                                                <div className="cand-num">{sl.label}</div>
                                                <div className="cand-info">
                                                    <div className="cand-name">
                                                        {occupant ? `Swap with ${occupant.name}` : 'Move to empty slot'}
                                                    </div>
                                                    <div className="cand-meta">
                                                        <span className={"cand-tag " + (fits ? 'compat' : 'offpos')}>{fits ? 'FIT' : 'OFF-POS'}</span>
                                                        {sl.label}{occupant ? ` · #${occupant.n}` : ' · open'}
                                                    </div>
                                                </div>
                                                <div className="cand-time">
                                                    {occupant ? fmt(getTime(occupant.id)) : '—'}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            );
                        })()}

                        <button className="sheet-action danger" onClick={() => { assignToSlot(activeSlot, null); setActiveSlot(null); }}>
                            <span className="ic">↓</span> Take off (no replacement)
                        </button>
                    </>
                )}
            </Sheet>

            {/* From bench: pick a slot for this player */}
            <Sheet
                open={!!activePlayer}
                onClose={() => setActivePlayer(null)}
                title={activePlayer ? `Sub in ${activePlayer.player.name}` : ''}
                sub={activePlayer ? `#${activePlayer.player.n} · played ${fmt(getTime(activePlayer.player.id))}` : ''}
            >
                {activePlayer && (() => {
                    const slots = slotsForPlayer(activePlayer.player);
                    if (slots.length === 0) return <div className="empty">No available slots — every position is locked.</div>;
                    return slots.map(({ idx, slot, current, fits }) => (
                        <button
                            key={idx}
                            className={"cand" + (fits ? '' : ' offpos')}
                            onClick={() => { assignToSlot(idx, activePlayer.player.id); setActivePlayer(null); }}
                        >
                            <div className="cand-num">{slot.label}</div>
                            <div className="cand-info">
                                <div className="cand-name">{current ? 'Replace ' + current.name : 'Fill empty slot'}</div>
                                <div className="cand-meta">
                                    <span className={"cand-tag " + (fits ? 'compat' : 'offpos')}>{fits ? 'FIT' : 'OFF-POS'}</span>
                                    {slot.label} · {current ? '#' + current.n : 'open'}
                                </div>
                            </div>
                            <div className="cand-time">{current ? fmt(getTime(current.id)) : '—'}</div>
                        </button>
                    ));
                })()}

                {activePlayer && (
                    <>
                        <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',margin:'12px 4px 6px'}}>Status</div>
                        <div className="sheet-status">
                            {(() => {
                                const st = state.playerStatus[activePlayer.player.id] || {};
                                const pid = activePlayer.player.id;
                                return (
                                    <>
                                        <button className={"status-tile" + (st.yellow ? ' on yellow' : '')} onClick={() => toggleStatus(pid, 'yellow')}>
                                            <span className="badge">{st.yellow === 2 ? 'YY' : 'Y'}</span>
                                            Yellow
                                        </button>
                                        <button className={"status-tile" + (st.red ? ' on red' : '')} onClick={() => toggleStatus(pid, 'red')}>
                                            <span className="badge">R</span>Red
                                        </button>
                                        <button className={"status-tile" + (st.injured ? ' on inj' : '')} onClick={() => toggleStatus(pid, 'injured')}>
                                            <span className="badge">I</span>Injured
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                    </>
                )}
            </Sheet>

            {/* Goal scorer sheet */}
            <Sheet
                open={!!goalSheet}
                onClose={() => setGoalSheet(null)}
                title={goalSheet ? (goalSheet.team === 'us' ? `Goal — ${state.teamName.us}` : `Goal — ${state.teamName.them}`) : ''}
                sub={goalSheet ? (goalSheet.team === 'us' ? 'Who scored?' : `Concede a goal at ${fmt(state.matchSec)}`) : ''}
            >
                {goalSheet && goalSheet.team === 'us' && (() => {
                    const onSlots = state.slots.filter(s => s.playerId);
                    if (onSlots.length === 0) {
                        return <>
                            <div className="empty">No players on the pitch yet.</div>
                            <button className="sheet-action" onClick={() => { recordGoal('us', null); setGoalSheet(null); }}>
                                <span className="ic">⚽</span> Log goal with unknown scorer
                            </button>
                        </>;
                    }
                    // Show on-pitch players first
                    return <>
                        <div className="sheet-section-label">On the pitch</div>
                        {onSlots.map(sl => {
                            const p = SQUAD.find(x => x.id === sl.playerId);
                            const goals = goalsByPlayer[p.id] || 0;
                            return (
                                <button key={sl.playerId} className="cand" onClick={() => { recordGoal('us', p.id); setGoalSheet(null); }}>
                                    <div className="cand-num">{p.n}</div>
                                    <div className="cand-info">
                                        <div className="cand-name">{p.name}</div>
                                        <div className="cand-meta">{sl.label}{goals > 0 ? ` · ⚽ ${goals}` : ''}</div>
                                    </div>
                                    <div className="cand-time" style={{color:'var(--accent)'}}>+1</div>
                                </button>
                            );
                        })}
                        <button className="sheet-action" onClick={() => { recordGoal('us', null); setGoalSheet(null); }}>
                            <span className="ic">⚽</span> Unknown scorer
                        </button>
                        <button className="sheet-action danger" onClick={() => { undoLastGoal('us'); setGoalSheet(null); }}>
                            <span className="ic">↶</span> Undo last goal
                        </button>
                    </>;
                })()}
                {goalSheet && goalSheet.team === 'them' && (
                    <>
                        <button className="sheet-action" onClick={() => { recordGoal('them', null); setGoalSheet(null); }}>
                            <span className="ic">+1</span> Concede a goal
                        </button>
                        <button className="sheet-action danger" onClick={() => { undoLastGoal('them'); setGoalSheet(null); }}>
                            <span className="ic">↶</span> Undo last goal
                        </button>
                    </>
                )}
            </Sheet>
            {/* Reset menu — choose what to reset */}
            <Sheet
                open={resetSheet}
                onClose={() => setResetSheet(false)}
                title="Reset"
                sub="Pick what you want to clear."
            >
                <ResetAction
                    label="Reset time only"
                    sub="Set the clock back to 0:00 and the phase to PRE. Score, lineup, cards and player times all stay where they are."
                    icon="◷"
                    onConfirm={resetTimeOnly}
                />
                <ResetAction
                    label="New match"
                    sub="Clear clock, score, cards, goals, history & player times. Keeps the current pitch lineup so you can kick off straight away."
                    icon="↻"
                    onConfirm={resetClockAndMatch}
                />
                <ResetAction
                    label="Clear the pitch"
                    sub="Take every player off. Clock, score and match state stay where they are."
                    icon="⬇"
                    onConfirm={clearPitch}
                />
                <ResetAction
                    label="Reset everything"
                    sub="Wipe clock, score, lineup, history and player times. Same as starting from scratch."
                    icon="⌫"
                    tone="danger"
                    onConfirm={resetEverything}
                />
            </Sheet>

            {/* Lineup manage sheet — rename / delete saved lineups */}
            <LineupManageSheet
                open={lineupSheet}
                onClose={() => setLineupSheet(false)}
                state={state}
                setState={setState}
            />

            {/* Help & guide */}
            <HelpSheet open={helpSheet} onClose={() => setHelpSheet(false)} />

            {/* Clock editor */}
            <Sheet
                open={!!clockEdit}
                onClose={() => setClockEdit(null)}
                title="Edit clock"
                sub="Useful after a crash or to correct a mis-press. Player timers continue from the new clock."
            >
                {clockEdit && (
                    <div className="clock-edit">
                        <div className="ce-fields">
                            <label className="ce-field">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    max="120"
                                    value={clockEdit.mins}
                                    onChange={e => setClockEdit({ ...clockEdit, mins: e.target.value.replace(/\D/g,'').slice(0,3) })}
                                />
                                <span className="ce-unit">min</span>
                            </label>
                            <div className="ce-colon">:</div>
                            <label className="ce-field">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    max="59"
                                    value={clockEdit.secs}
                                    onChange={e => setClockEdit({ ...clockEdit, secs: e.target.value.replace(/\D/g,'').slice(0,2) })}
                                />
                                <span className="ce-unit">sec</span>
                            </label>
                        </div>
                        <div className="ce-quick">
                            {[0, 45*60, 60*60, 90*60].map(s => (
                                <button key={s} className="filter-chip" onClick={() => setClockEdit({ mins: Math.floor(s/60), secs: s%60 })}>
                                    {s === 0 ? '00:00' : fmt(s)}
                                </button>
                            ))}
                        </div>
                        <button className="sheet-action" style={{background:'var(--accent)', color:'var(--accent-ink)', border:'none', justifyContent:'center', fontWeight:700}} onClick={applyClockEdit}>
                            Save clock
                        </button>
                    </div>
                )}
            </Sheet>
        </div>
    );
}

function reduce(s, action) {
    switch (action.type) {
        case 'TEAM_NAME': {
            return { ...s, teamName: { ...s.teamName, [action.team]: action.name } };
        }
        case 'LOG': {
            return { ...s, history: [...(s.history || []), { at: s.matchSec, kind: action.kind || 'card', text: action.text }] };
        }
    }
    return s;
}

// ─────────────────────────────────────────────────────────────
//  TWEAKS WRAPPER
// ─────────────────────────────────────────────────────────────
const DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "dark",
    "accent": "#04a777",
    "density": "default",
    "show_pool": true,
    "show_history": true
}/*EDITMODE-END*/;

// Map accent hex → ink color
function inkFor(hex) {
    // simple: dark ink for bright accents, light ink for dark
    const h = hex.replace('#','');
    const x = h.length === 3 ? h.replace(/./g, c => c + c) : h;
    const n = parseInt(x, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = r*299 + g*587 + b*114;
    return lum > 148000 ? '#111' : '#fff';
}

function Root() {
    const [t, setTweak] = useTweaks(DEFAULTS);
    const [showWelcome, setShowWelcome] = React.useState(() => !window.welcomeDismissed?.());

    React.useEffect(() => {
        document.documentElement.style.setProperty('--accent', t.accent);
        document.documentElement.style.setProperty('--accent-ink', inkFor(t.accent));
    }, [t.accent]);

    return (
        <>
            <App tweaks={t} onShowWelcome={() => setShowWelcome(true)} />
            {showWelcome && <Welcome onDismiss={() => setShowWelcome(false)} />}
            <TweaksPanel title="Tweaks">
                <TweakSection label="Look & feel">
                    <TweakRadio
                        label="Theme"
                        value={t.theme} options={[
                            {value:'dark', label:'Dark'},
                            {value:'contrast', label:'Contrast'},
                            {value:'light', label:'Light'},
                        ]}
                        onChange={v => setTweak('theme', v)}
                    />
                    <TweakColor
                        label="Accent"
                        value={t.accent}
                        options={['#04a777', '#ff18bd', '#ff6a00', '#ffe419']}
                        onChange={v => setTweak('accent', v)}
                    />
                    <TweakRadio
                        label="Density"
                        value={t.density} options={[
                            {value:'default', label:'Standard'},
                            {value:'cozy',    label:'Big tap'},
                        ]}
                        onChange={v => setTweak('density', v)}
                    />
                </TweakSection>
                <TweakSection label="Sections">
                    <TweakToggle label="Position pool tab" value={t.show_pool}    onChange={v => setTweak('show_pool', v)} />
                    <TweakToggle label="Match log tab"     value={t.show_history} onChange={v => setTweak('show_history', v)} />
                </TweakSection>
                <TweakSection label="Account">
                    <TweakButton
                        label="Show welcome screen"
                        onClick={() => { window.resetWelcome?.(); setShowWelcome(true); }}
                    />
                </TweakSection>
            </TweaksPanel>
        </>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
