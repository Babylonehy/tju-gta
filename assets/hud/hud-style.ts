export default String.raw`
:host{display:block;color-scheme:dark;--ink:#f9edda;--soft:#d4c6ad;--dim:#a5ac9e;--warm:#f1b679;--accent:#ffc58a;--panel:rgba(23,37,33,.96);--line:rgba(234,224,195,.20);--sans:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;--mono:ui-monospace,SFMono-Regular,Consolas,monospace}
*{box-sizing:border-box}
[hidden]{display:none!important}
.by{position:absolute;inset:0;overflow:hidden;color:var(--ink);font:500 14px/1.45 var(--sans);outline:none;isolation:isolate}
.by:before,.by:after{content:"";position:absolute;left:0;right:0;pointer-events:none;z-index:-1}
.by:before{top:0;height:155px;background:linear-gradient(#101f208c,transparent)}
.by:after{bottom:0;height:245px;background:linear-gradient(transparent,#111d19aa)}
button,a,input,textarea{pointer-events:auto}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0;text-align:left}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
svg{width:18px;height:18px;display:inline-block;vertical-align:middle;flex:none}
kbd{font:700 9px/1 var(--mono);letter-spacing:.05em;display:inline-flex;align-items:center;justify-content:center;min-height:19px;border:1px solid #fbefd049;border-radius:4px;padding:2px 5px;color:#f0dfc5;white-space:nowrap}
.mast{position:absolute;top:25px;left:27px;right:27px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.brand{display:flex;align-items:center;gap:13px;text-shadow:0 2px 9px #122823a0}
.emblem{width:52px;height:52px;display:grid;place-items:center;color:#f6bf83;border:1px solid #efca927f;border-radius:50%;background:#273e36dc;box-shadow:0 2px 24px #0f281b38}
.emblem svg{width:27px;height:27px}
.brand-kicker,.panel-kicker,.current-english,.eyebrow{font:700 9px/1.45 var(--mono);letter-spacing:.17em}
.brand-kicker{color:#ffdeb3;white-space:nowrap}
.brand-kicker i{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--warm);margin:0 3px 2px}
h1,h2,h3,p{margin:0}
h1{font-size:32px;line-height:1.14;font-weight:850;letter-spacing:.12em;margin-top:4px}
.nav{display:flex;gap:7px;align-items:center}
.nav button,.card,.interact,.pin,.visit-notice{border:1px solid var(--line);box-shadow:0 10px 36px #0f1d1a37;background:#20362fe8}
.nav button{padding:9px 10px;border-radius:7px;display:flex;gap:7px;align-items:center;white-space:nowrap;font-size:12px;transition:background .17s}
.nav svg{color:var(--warm);width:16px;height:16px}
.nav button:hover,.map-top:hover,.map-bottom:hover,.interact:hover{background:#3c5042}
.loading,.visit-notice{position:absolute;top:95px;left:50%;transform:translateX(-50%);border-radius:5px;padding:8px 13px;white-space:nowrap;color:#ffe7bd;background:#20362fe8;font:700 12px/1.3 var(--sans);z-index:4}
.loading span{color:var(--warm)}
.district{position:absolute;bottom:25px;left:27px;text-shadow:0 2px 10px #0f241be0}
.district-top{display:flex;align-items:center;gap:7px;color:#fbe7c9;font-weight:650;font-size:11px}
.location-index{display:grid;place-items:center;width:25px;height:25px;border-radius:5px;background:var(--accent);color:#392f22;text-shadow:none;font:800 12px/1 var(--mono)}
.separator{width:15px;height:1px;background:#e9c99caa}
.mode{color:#f7cc9a}
.current-name{margin-top:8px;font-weight:850;font-size:clamp(26px,4vw,45px);line-height:1.03;letter-spacing:.07em}
.current-english{margin-top:7px;color:#f8d5a7}
.controls{display:flex;gap:10px;align-items:center;margin-top:13px;font-size:10px;color:#faecd7;white-space:nowrap}
.controls span{display:flex;gap:5px;align-items:center}
.help{width:20px;height:20px;border:1px solid #f7e8cb57;border-radius:50%;text-align:center;background:#31463d;font:700 12px/1 var(--mono)}
.minimap{position:absolute;bottom:24px;right:27px;border-radius:10px;overflow:hidden;width:237px}
.map-top,.map-bottom{padding:8px 10px;display:flex;align-items:center;justify-content:space-between;width:100%;font-size:11px;gap:7px}
.map-top{font-weight:760;letter-spacing:.04em}
.map-top .north{color:var(--warm);font:700 9px/1 var(--mono);margin-right:6px}
.visited{color:#fee1ab;font:700 10px/1 var(--mono)}
.map-face{aspect-ratio:257/190;position:relative;background:#34493e}
.mini-face{border-block:1px solid #c0c8a735}
.atlas-svg,.mini-overlay{width:100%;height:100%;position:absolute;inset:0;display:block;overflow:hidden}
.map-land{fill:#708566;fill-opacity:.35;stroke:#aabd9d;stroke-width:.5}.map-park{fill:#91ab73;fill-opacity:.6}.map-parcel{fill:#dfb17e;stroke:#f9e3c1;stroke-width:.45}.map-water{fill:#437873;stroke:#8cae9e;stroke-width:.52}
.map-road{fill:#a4a78d;opacity:.72}
.map-major{fill:#b0aea2;opacity:.9}.map-axis{fill:#e7c799;opacity:.87}
.map-building{fill:#ac775e;stroke:#e3af8c;stroke-width:.43}
.map-track{fill:#866452;stroke:#e9be9c;stroke-width:.66}
.atlas-svg text{fill:#e9dbc0;font:700 3.55px var(--sans);paint-order:stroke;stroke:#243b35;stroke-width:1px}
.you,.post-dot,.destination,.atlas-pin{position:absolute;z-index:3;transform:translate(-50%,-50%)}
.you{width:15px;height:15px;background:#fff3cf;clip-path:polygon(50% 0%,100% 100%,50% 76%,0 100%);transform:translate(-50%,-50%) rotate(var(--heading));filter:drop-shadow(0 1px 1px #0f211d);z-index:6}
.post-dot{width:5px;height:5px;border-radius:50%;background:#ff9866;border:1px solid #422919}
.destination{width:12px;height:12px;border-radius:50%;background:#ffd39255;border:2px solid #ffd392}
.map-bottom{justify-content:flex-start;color:#f6ddbe}
.map-bottom svg{width:14px;height:14px;color:var(--warm)}
.mini-cta{margin-left:auto;color:#ffcb96;white-space:nowrap}
.mini-cta svg{width:12px}
.world-labels{position:absolute;inset:0;pointer-events:none;z-index:1}
.pin{position:absolute;transform:translate(-50%,-50%);border-radius:5px;white-space:nowrap;display:flex;align-items:center;gap:6px;padding:4px 7px;font-weight:700;font-size:11px}
.pin b{color:var(--warm);font:800 9px/1 var(--mono)}
.pin.target{background:#eab478;color:#28332b;border-color:#ffe0a6}
.pin.target b{color:#3b4137}
.post-pin{padding:4px;background:#bf6c48;border:1px solid #ffc49a}
.post-pin svg{width:15px;height:15px}
.pin:hover{outline:1px solid var(--warm)}
.interact-stack{position:absolute;bottom:19%;left:50%;transform:translateX(-50%);display:grid;justify-items:center;gap:7px;z-index:3}
.interact{border-radius:6px;padding:7px 10px;white-space:nowrap;color:#ffdcad;font-size:12px;font-weight:780}
.interact kbd{margin-right:4px;background:#bc754d;color:#fff3d9;border:none}
.interact.secondary{color:#f6eee0}
.interact.secondary kbd{background:#496658}
.visit-notice{z-index:13}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,#0b1b1790,#0e201963);z-index:9;pointer-events:auto}
.panel{position:absolute;z-index:10;right:25px;top:82px;bottom:24px;width:min(475px,calc(100% - 50px));background:var(--panel);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;pointer-events:auto;box-shadow:0 24px 76px #0d1713a8}
.panel-head{display:flex;justify-content:space-between;align-items:center;padding:19px 19px 16px;gap:12px;border-bottom:1px solid var(--line)}
.panel-kicker,.eyebrow{color:var(--warm)}
.panel h2{font-size:27px;line-height:1.2;letter-spacing:.06em;margin-top:5px}
.close{width:35px;height:35px;display:grid;place-items:center;border-radius:7px;background:#e7d4ac13;border:1px solid var(--line)}
.close:hover,.secondary-button:hover,.spot:hover{background:#56715a70}
.panel-content{padding:15px 18px 22px;overflow:auto;scrollbar-color:#85947a #223a33;overscroll-behavior:contain;flex:1}
.big-face{border:1px solid var(--line);border-radius:7px;overflow:hidden}
.map-caption{display:flex;justify-content:space-between;color:var(--dim);font-size:10px;margin:5px 0 12px}
.atlas-pin{width:21px;height:21px;border-radius:50%;color:#283832;background:#edd9b5;border:1px solid #334a3d;text-align:center;font:800 9px/1 var(--mono)}
.atlas-pin.selected{background:#ffd493;box-shadow:0 0 0 2px #f7c48a69}
.spot-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:11px}
.spot{display:flex;align-items:center;gap:6px;background:#e1dac014;border:1px solid var(--line);border-radius:5px;padding:7px;font-size:11px}
.spot b{color:var(--warm);font:700 9px/1 var(--mono)}
.spot small{margin-left:auto;color:#b4ca9c}
.spot.selected{border-color:#f3bb7f;background:#bd8c5638}
.paper,.post-card{border:1px solid var(--line);border-radius:8px;padding:12px;background:#dbc8a310;margin-bottom:9px}
.paper h3,.post-card h3{font-size:17px;color:#ffe9c8;margin:2px 0 5px}
.paper p,.post-card p{color:#eee1cc;line-height:1.64;margin:6px 0 9px;white-space:pre-wrap;overflow-wrap:anywhere}
.primary,.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border-radius:6px;font-weight:750;font-size:12px;text-align:center;border:1px solid transparent;min-height:34px}
.primary{background:#f3b982;color:#342b21}
.primary:hover:not(:disabled){background:#ffd6a9}
.secondary-button{border-color:var(--line);background:#dcd5aa19}
.inline-button,.text-link{color:#ffd09b;font-size:11px;text-decoration:none;font-weight:720;white-space:nowrap}
.inline-button:hover,.text-link:hover{text-decoration:underline}
.board-actions,.feed-head{display:flex;gap:8px;align-items:center}
.feed-head{justify-content:space-between;margin-top:13px}
.tabs{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:7px;background:#101e1a9f}
.tabs button{padding:5px 11px;border-radius:4px;color:var(--soft);font-size:11px;white-space:nowrap}
.tabs button.active{background:#7a8d705c;color:#fff0d1;font-weight:760}
.compose-tabs{display:inline-flex;margin:4px 0 9px}
.status,.error,.author{font-size:11px;color:var(--dim);margin:6px 0 10px;line-height:1.55}
.error{color:#ffc794}
.status:empty,.error:empty{display:none}
.empty{padding:15px 11px;border-radius:6px;border:1px dashed var(--line);color:var(--soft);font-size:12px}
.post-meta{display:flex;justify-content:space-between;align-items:center;gap:6px;color:#ead4af;font-size:10px;margin-bottom:5px}
.post-location{color:#ffcb95;font-weight:720}
.photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:7px;margin:5px 0 8px}
.photo{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#142720;min-height:44px;color:var(--ink);text-decoration:none}
.photo img{display:block;width:100%;max-height:195px;object-fit:cover}
.full .photo img{max-height:280px;object-fit:contain}
.photo-unavailable{padding:10px;font-size:11px;display:block}
.field{display:grid;gap:5px;margin:9px 0;font-weight:700;font-size:12px}
textarea,input{width:100%;border-radius:6px;border:1px solid #cdd2b553;background:#10211c;color:#fff1dc;font:500 13px/1.55 var(--sans);padding:8px 10px}
textarea{min-height:98px;resize:vertical}
.journal-progress,.guide-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);color:var(--soft)}
.journal-progress b{font:800 13px/1 var(--mono);color:#f6c491}
.journal-heading{font-size:13px;margin:12px 0 5px;letter-spacing:.04em;color:#ffcf9c}
.journal-row{display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--line);padding:6px 0}
.stamp{flex:none;display:grid;place-items:center;width:35px;height:35px;border-radius:50%;font:850 17px/1 var(--sans);color:#b6c4b2;border:1px dashed #b6c4b260}
.stamp.inked{background:#f3b77f;color:#503823;border:2px double #5d4831}
.journal-row strong,.journal-row small{display:block;font-size:11px}
.journal-row small{color:var(--dim)}
.journal-row button{margin-left:auto}
.secret-paper{padding:16px}
.secret-paper .stamp{width:55px;height:55px;font-size:25px;margin-bottom:11px}
.secret-paper h3{font-size:23px}
blockquote{margin:8px 0 12px;border-left:2px solid var(--warm);padding:5px 9px;color:#f2ce9b;background:#c78d4619;font-size:13px}
.guide-row{font-size:12px;justify-content:flex-start;align-items:flex-start}
.guide-row:last-of-type{margin-bottom:12px}
.guide-row + button{margin-right:7px}
.touch-controls{display:none}
.modal .touch-controls,.modal .interact-stack{visibility:hidden}
.glint .panel-head{animation:glint .7s ease-out}
@keyframes glint{from{background:#b98c4e}to{background:transparent}}
@media(max-width:750px){.mast{top:12px;left:12px;right:12px;gap:5px}.emblem{width:37px;height:37px}.emblem svg{width:21px;height:21px}.brand{gap:7px}.brand-kicker{font-size:7px;letter-spacing:.08em}h1{font-size:24px}.nav{gap:4px}.nav button{padding:7px;font-size:10px;gap:4px}.nav kbd{display:none}.nav svg{width:13px;height:13px}.district{left:12px;bottom:12px}.minimap{right:12px;bottom:12px;width:159px}.panel{top:60px;right:12px;bottom:12px;width:min(430px,calc(100% - 24px))}.interact-stack{bottom:24%}.controls{gap:5px}.controls span:nth-child(3){display:none}}
@media(max-width:460px){.nav button{display:grid;justify-items:center;padding:5px;min-width:35px}.brand-kicker{font-size:6px}.map-bottom,.map-top{font-size:10px;padding:6px}.minimap{width:136px}.district .current-name{font-size:20px}.current-english{font-size:8px}.controls span:nth-child(2){display:none}.interact-stack{bottom:28%}.pin span{display:none}.pin{padding:4px}}
@media(pointer:coarse){.controls span{display:none}.touch-controls{position:absolute;bottom:106px;left:13px;display:grid;grid-template-columns:repeat(3,35px);grid-template-rows:repeat(2,35px);gap:4px;z-index:3}.touch-controls button{background:#20362fce;border:1px solid var(--line);border-radius:6px;text-align:center;touch-action:none}.touch-controls button:first-child{grid-column:2}.touch-controls button:nth-child(2){grid-column:1}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
.ride-options{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 16px}
.ride-option{display:grid;gap:5px;border:1px solid var(--line);border-radius:8px;background:#253b33;padding:12px;font-size:13px}
.ride-option.selected{background:#b0825247;border-color:#f3b77f}
.ride-option svg{color:#f3b77f;width:23px;height:23px}
.ride-option small{color:var(--dim);font-size:10px}
.scan-frame{position:relative;width:152px;height:152px;border:1px solid #8fbaa0;background:#f8f2df;border-radius:10px;margin:12px auto 6px;overflow:hidden;box-shadow:0 0 0 5px #748f6c37}
.scan-frame svg{width:100%;height:100%;display:block}
.scan-frame i{display:none;position:absolute;left:3px;right:3px;height:2px;background:#44f0a7;box-shadow:0 0 8px #3bffae}
.scan-frame.scanning i{display:block;animation:scanner .68s ease-in-out both}
.scan-id{text-align:center;font:700 10px/1.5 var(--mono);letter-spacing:.14em;color:var(--warm);margin-bottom:10px}
@keyframes scanner{from{top:3%}to{top:97%}}

.pass-message{color:#d9f2c1;background:#253e32e6;border:1px solid #acc99270;padding:6px 9px;border-radius:6px;font-weight:700;white-space:nowrap}
.gate-card,.parcel-card{padding:16px}
.gate-card .status{text-align:center}
.face-frame{position:relative;width:145px;aspect-ratio:1;margin:12px auto 8px;border-radius:9px;background:#142b25;border:1px solid #a2cead70;overflow:hidden}
.face-frame svg{width:100%;height:100%}
.face-frame i{position:absolute;display:none;height:2px;left:0;right:0;background:#84f0c2;box-shadow:0 0 9px #84f0c2}
.face-frame.scanning i{display:block;animation:scanner .72s ease-in-out both}
.parcel-card .stamp{margin-bottom:9px}

.panel[data-view="map"]{width:min(730px,calc(100% - 50px))}
.map-face{aspect-ratio:252/200}
.map-land{stroke-width:3}.map-water{fill:#4c8587;stroke:#4c8587;stroke-width:1.5}
.map-roads{fill:#adaf99;stroke:#adaf99;stroke-width:1.4}
.map-buildings{fill:#c48c76;stroke:#c48c76;stroke-width:1.35}
.map-parking{fill:#858b87}.map-field{fill:#7f9f6b}.map-track{fill:#bd8069;stroke:none}
.atlas-svg text{font-size:29px;stroke-width:2}
.map-scale{fill:none;stroke:#f6dcb2;stroke-width:3.5}
.osm-attribution{display:block;color:var(--soft);font-size:10px;text-align:center;text-decoration:none;padding:6px 4px}
.osm-attribution:hover{text-decoration:underline}
.travel-button{margin-left:7px}
.stamina{display:flex;align-items:center;gap:7px;margin:10px 0 8px;color:#ffe9c1;font-size:11px}
.stamina progress{width:112px;height:9px;accent-color:#d0ed95}
.stamina-value,.clock,.time-readout{font-family:var(--mono)}
.toolbelt{display:flex;flex-wrap:wrap;gap:5px}
.toolbelt button{border:1px solid var(--line);border-radius:5px;padding:4px 6px;background:#20362fe8;color:#f5e4ce;font-size:11px}
.toolbelt button[aria-pressed="true"]{border-color:#e8ba7f;background:#665238}
.time-dial{display:grid;place-items:center;width:150px;aspect-ratio:1;margin:8px auto 16px;border-radius:50%;border:1px solid #f0cf9c66;background:conic-gradient(from -15deg,#253553,#f2b079,#6da5ae,#6da5ae,#ed9e76,#263659,#253553);position:relative}
.time-dial:before{content:"";position:absolute;inset:8px;border-radius:50%;background:#172822}
.time-dial:after{content:"";position:absolute;inset:5px;border-radius:50%;transform:rotate(var(--time));background:linear-gradient(#fff0ca,#fff0ca) center 2px/4px 17px no-repeat}
.time-readout{font-size:27px;color:#ffe2b2;position:relative;z-index:1}
.time-presets{display:grid;grid-template-columns:1fr 1fr;gap:7px}
input[type="range"]{padding:0;accent-color:#f3b982}
.research-card{margin-top:10px}.samples{padding:0;margin:7px 0;list-style:none;display:flex;gap:5px;flex-wrap:wrap}
.samples li{font-size:10px;padding:3px 6px;border:1px solid var(--line);border-radius:4px;color:var(--dim)}
.samples .complete{color:#d5eab2;background:#a0c57832}
.research-card .research-reward{color:#f8c88f;font-size:12px}
@media(max-width:750px){.mast{gap:7px}.nav button{padding:7px}.nav button kbd{display:none}.district{max-width:68%}}
@media(max-width:750px){.panel[data-view="map"]{width:calc(100% - 24px)}}
.map-tabs{margin-bottom:8px;width:max-content}
.building-toolbar,.building-zoom{display:flex;align-items:center;gap:5px}
.building-toolbar{margin-bottom:8px}
.building-zoom .secondary-button[aria-pressed="true"]{background:#775939}
.building-map-scroll{overflow:auto;max-height:min(47vh,375px);pointer-events:auto;border:1px solid var(--line);border-radius:7px}
.buildings-face{max-width:none}
.building-pin{position:absolute;z-index:3;transform:translate(-50%,-50%);display:grid;place-items:center;width:11px;height:11px;background:#ecd5ab;border:2px solid #302f27;border-radius:50%;font-size:0;white-space:nowrap;color:#1c2823}
.buildings-face.labeled .building-pin,.building-pin.selected,.building-pin:hover,.building-pin:focus-visible{width:max-content;height:auto;border-radius:4px;border-width:1px;padding:2px 4px;font:750 10px/1.25 var(--sans)}
.building-pin.selected{z-index:7;background:#ffc57f}.building-pin:hover,.building-pin:focus-visible{z-index:8}
.building-record{color:#ffe0b3;padding:7px 2px;font-weight:750}
.building-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:4px;max-height:115px;overflow:auto;pointer-events:auto;margin-bottom:6px}
.building-result{border:1px solid var(--line);padding:5px 6px;border-radius:4px;font-size:11px}.building-result:hover{background:#c8ae8250}
.gate-sign{font-size:10px;color:#fbe7bd;background:#1d423bda;pointer-events:none}
.gate-sign.entry,.gate-sign.exit{color:#e2ead7;background:#294862e5}
.avatar-switch{display:flex;align-items:center;gap:5px;padding:4px 6px;margin-top:9px;border-radius:5px;border:1px solid var(--line);background:#20362fe8;font-size:11px}
.avatar-switch b{color:#ffce9e}.avatar-switch:hover{background:#465e4c}

.route-overlay{pointer-events:none}.route-line{fill:none;stroke:#f0c66e;stroke-width:2.3px;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.route-banner{position:absolute;top:84px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;white-space:nowrap;color:#f7ebce;background:#263d34e8;border:1px solid #ddc88380;border-radius:8px;padding:5px 7px 5px 10px;pointer-events:auto;font-size:12px}
.route-banner button{padding:3px 7px;background:#ffffff18;border-radius:4px;color:inherit}
.campus-population{color:#eee5c8;font-size:11px;margin-top:8px;font-variant-numeric:tabular-nums}
.venue-pin{font-size:11px;white-space:nowrap;color:#fcf6df;background:#293f36df;border-radius:4px;padding:4px 7px;pointer-events:none}
.survey-gate{position:absolute;transform:translate(-50%,-50%);background:#68483f;color:#fff1db;padding:2px 4px;border-radius:3px;font-size:9px;white-space:nowrap}
`;
