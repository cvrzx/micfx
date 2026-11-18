(() => {
  'use strict';
  const {metro} = vendetta;
  const RN=metro.common.ReactNative, React=metro.common.React;
  let live=false, report='', busy=false, generation=0;
  const relevant=/voice|audio|microphone|mic(?:input|gain|volume|level|muted|mode)|mediaengine|webrtc|opus|pcm|sample(?:rate|buffer|data)|capture|recording|pitch|formant|equaliz|\beq\b|noise(?:suppression|cancellation)|echoCancellation|automaticGain|inputVolume|inputGain|vad(?:Threshold|Mode)|transportOptions|loopback|dsp|voiceFilter|audioUnit/i;
  const secret=/token|password|credential|authorization|secret|sessionid|cookie|email|phone|userid|channelid|guildid/i;
  const good=k=>typeof k==='string'&&/^[A-Za-z_$][A-Za-z0-9_$.:-]{0,79}$/.test(k)&&!secret.test(k);
  const obj=x=>x!==null&&(typeof x==='object'||typeof x==='function');
  function keys(x){try{return obj(x)?Object.getOwnPropertyNames(x).filter(good):[];}catch(_){return [];}}
  function descriptor(x,k){try{return Object.getOwnPropertyDescriptor(x,k);}catch(_){return undefined;}}
  function value(x,k){const d=descriptor(x,k);return d&&'value'in d?d.value:undefined;}
  function methods(x){const out=new Set();let cur=x;
    for(let i=0;obj(cur)&&cur!==Object.prototype&&cur!==Function.prototype&&i<3;i++){
      for(const k of keys(cur)){const d=descriptor(cur,k);if(d&&typeof d.value==='function'&&k!=='constructor')out.add(k);else if(d&&(d.get||d.set)&&relevant.test(k))out.add(k+' [accessor]');}
      try{cur=Object.getPrototypeOf(cur);}catch(_){break;}
    }return [...out].sort();
  }
  function scanObject(label,x,found,force=false){if(!obj(x))return;const m=methods(x), hits=m.filter(k=>relevant.test(k));
    if((force||hits.length)&&m.length){const selection=force?m:hits;found.add(label+' ['+selection.join(', ')+']');}}
  const names=['DCDVoice','DCDVoiceModule','DCDVoiceEngine','DCDMediaEngine','DCDMediaEngineModule','DCDMedia','DCDAudio','DCDAudioModule','DCDAudioManager','DCDAudioSession','DCDWebRTC','DiscordVoice','DiscordMediaEngine','VoiceModule','VoiceEngine','MediaEngine','AudioModule','AudioManager','AudioSession','WebRTCModule','RNWebRTC','RTCAudioSession','AudioRecorder','AudioProcessing','VoiceProcessing','AudioEngine','NativeAudioModule'];
  const probes=[['setInputVolume'],['getInputVolume'],['setNoiseSuppression'],['setNoiseCancellation'],['setEchoCancellation'],['setAutomaticGainControl'],['getMediaEngine'],['getVoiceEngine'],['setTransportOptions'],['setVoiceFilter'],['getVoiceFilters'],['setVoiceEffect'],['setPitch'],['setAudioPitch'],['setEqualizer'],['setAudioEffect'],['setAudioProcessing'],['setInputGain'],['setAudioInputCallback'],['setAudioCaptureCallback'],['setAudioFrameCallback'],['setAudioPreprocessor'],['processAudioFrame'],['onAudioFrame'],['onAudioData'],['setPcmCallback'],['setMicrophoneVolume'],['setLocalVolume'],['setSelfMute']];
  // Inspect only names and function arity, never audio buffers or property values.
  const candidateMethods=['getMediaEngine','getVoiceEngine','getAudioEngine','getAudioMixerSettings','setAudioMixerSettings','setInputVolume','setInputGain','setInputVolumeScale','setAudioInputInitializationCallback','setOnVoiceCallback','setTransportOptions','connectionInstanceSetTransportOptions','applyMediaFilterSettingsWithCallback','setSidechainCompression','setVoiceProcessingErrorCallback','setVoiceFilter','setVoiceFilters','getVoiceFilters','setVoiceEffect','setPitch','setPitchShift','setAudioPitch','setFormant','setEqualizer','setAudioEffect','setAudioEffects','setAudioProcessing','setAudioInputCallback','setAudioCaptureCallback','setAudioFrameCallback','setAudioPreprocessor','processAudioFrame','onAudioFrame','onAudioData','setPcmCallback','setAudioSamplesCallback','setLocalAudioCallback','setAudioSink','setAudioSource','setAudioProcessor','setAudioProcessingCallback','setAudioTransform','setMicGain','setNoiseSuppression','setNoiseCancellation','setAutomaticGainControl','setEchoCancellation','getAudioSubsystem','getInputDevices'];
  function describe(label,x){
    if(!obj(x))return label+' -> '+(x===null?'null':typeof x);
    const names=new Set(), properties=new Set();let cur=x;
    for(let i=0;obj(cur)&&cur!==Object.prototype&&cur!==Function.prototype&&i<5;i++){
      for(const k of keys(cur)){const d=descriptor(cur,k);if(!d||k==='constructor')continue;
        if(typeof d.value==='function')names.add(k+'('+d.value.length+')');
        else if(relevant.test(k))properties.add(k+(d.get||d.set?' [accessor]':' [property]'));
      }
      try{cur=Object.getPrototypeOf(cur);}catch(_){break;}
    }
    // Lazy native bridge proxies may not enumerate their methods.
    for(const k of candidateMethods){try{const f=x[k];if(typeof f==='function'&&![...names].some(n=>n.startsWith(k+'(')))names.add(k+'('+f.length+')');}catch(_){}}
    return label+'\nMethods: '+([...names].sort().join(', ')||'none visible')+'\nAudio-related property names: '+([...properties].sort().join(', ')||'none visible');
  }
  const wait=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function scan(){
    if(busy||!live)return;busy=true;const id=++generation;const native=new Set(),modules=new Set(),foundQueries=new Set(),info=[];
    const alive=()=>live&&id===generation;
    try{
      const n=RN.NativeModules;
      let listed=keys(n).filter(k=>relevant.test(k));info.push('NativeModules matching names: '+(listed.join(', ')||'none enumerable'));
      // Explicit module lookups may initialize a lazy bridge wrapper. Never call audio methods.
      for(const k of [...new Set([...listed,...names])]){if(!alive())return;try{const x=n?.[k];if(obj(x)){native.add(k+' (NativeModules)');scanObject(k,x,native,true);}}catch(_){} }
      const turbo=RN.TurboModuleRegistry;
      info.push('TurboModuleRegistry.get: '+(typeof turbo?.get==='function'?'available':'not exposed'));
      // Try names suggested by native modules and the known audio-related candidates only.
      if(typeof turbo?.get==='function')for(const k of [...new Set([...listed,...names])]){if(!alive())return;try{const x=turbo.get(k);if(obj(x)){native.add(k+' (TurboModuleRegistry)');scanObject(k,x,native,true);}}catch(_){} }
      await wait(); if(!alive())return;
      let r;try{r=typeof globalThis!=='undefined'?globalThis.__r:undefined;}catch(_){}
      let registry;try{if(typeof r?.getModules==='function')registry=r.getModules();}catch(_){}
      let entries=[];try{if(registry instanceof Map)entries=Array.from(registry.entries());else if(obj(registry))entries=Object.keys(registry).map(k=>[k,registry[k]]);}catch(_){}
      info.push('Metro registry entries: '+entries.length);
      let examined=0;
      for(let i=0;i<entries.length;i++){
        if(!alive())return;
        const [mid,mod]=entries[i];if(value(mod,'isInitialized')===true){
          const exp=value(value(mod,'publicModule'),'exports');
          if(obj(exp)){
            examined++; const label='Metro '+(typeof mid==='number'||/^\d+$/.test(String(mid))?mid:'?');
            scanObject(label,exp,modules);
            // Inspect existing exports only, not arbitrary nested application state.
            for(const k of keys(exp).slice(0,90)){
              const v=value(exp,k);
              if((k==='default'||relevant.test(k))&&obj(v))scanObject(label+'.'+k,v,modules,relevant.test(k));
              if(modules.size>=160)break;
            }
          }
        }
        if(modules.size>=160){info.push('Metro results capped at 160');break;}
        if(i%150===149)await wait();
      }
      info.push('Initialized modules examined: '+examined);
      // Targeted public Vendetta lookups supplement non-enumerable Metro registries.
      // Each lookup can initialize lazy JS modules; only method names are retained.
      for(const props of probes){if(!alive())return;try{
        const x=metro.findByProps?.(...props);if(obj(x)){
          const m=methods(x);foundQueries.add(props.join('+')+' -> '+(m.filter(k=>relevant.test(k)).join(', ')||'module returned; methods not enumerable'));
        }
      }catch(_){}await wait();}
      const detailed=[];
      // Known JS getters only. Never call setters, capture, recording or callback-registration methods.
      for(const [label,props] of [['Media engine store',['getMediaEngine','getInputVolume']],['Voice engine wrapper',['getVoiceEngine']],['Media settings actions',['setInputVolume','setNoiseSuppression','setEchoCancellation']],['Mixer settings store',['getAudioMixerSettings']]]){
        if(!alive())return;
        try{const x=metro.findByProps?.(...props);if(!obj(x)){detailed.push(label+' -> not found');continue;}
          detailed.push(describe(label,x));
          for(const k of ['getMediaEngine','getVoiceEngine','getAudioMixerSettings']){
            try{const f=x[k];if(typeof f!=='function')continue;const y=f.call(x);
              if(y&&typeof y.then==='function'){Promise.resolve(y).catch(()=>{});detailed.push(label+'.'+k+'() -> asynchronous result (not inspected)');continue;}
              detailed.push(describe(label+'.'+k+'()',y));
            }catch(_){detailed.push(label+'.'+k+'() -> unavailable or threw');}
          }
        }catch(_){detailed.push(label+' -> lookup failed');}await wait();
      }
      for(const k of ['DCDVoiceEngine','VoiceEngine']){if(!alive())return;try{const x=RN.NativeModules?.[k];if(obj(x))detailed.push(describe('Native '+k,x));}catch(_){}}
      const deeperQueries=['setPitchShift','setFormant','setVoiceFilters','setAudioEffects','setAudioMixerSettings','getAudioMixerSettings','setAudioSamplesCallback','setLocalAudioCallback','setAudioSink','setAudioSource','setAudioProcessor','setAudioProcessingCallback','setAudioTransform','setAudioInputInitializationCallback','setOnVoiceCallback','setSidechainCompression','applyMediaFilterSettingsWithCallback'];
      for(const k of deeperQueries){if(!alive())return;try{const x=metro.findByProps?.(k);if(obj(x))detailed.push(describe('Lookup '+k,x));}catch(_){}await wait();}
      if(alive())report=['MicFX Probe 2','Read-only capability discovery; calls named JS getters, does not record or modify microphone audio. Function arity is indicative only.',...info,'\nNative modules:\n'+([...native].join('\n')||'none found'),'\nTargeted Metro lookups:\n'+([...foundQueries].join('\n')||'none found'),'\nInitialized Metro modules (function names only):\n'+([...modules].join('\n')||'none found'),'\nDetailed engine and getter inspection:\n'+(detailed.join('\n\n')||'none found')].join('\n');
    }catch(_){if(alive())report='MicFX Probe 2\nScan failed before completion. No audio was recorded or modified.';}
    finally{if(id===generation)busy=false;}
  }
  function Settings(){const [text,setText]=React.useState(report),[running,setRunning]=React.useState(busy),[notice,setNotice]=React.useState('');
    const h=React.createElement;
    const txt=(s,style={})=>h(RN.Text,{style:{color:'#e5e7eb',fontSize:15,...style}},s);
    const button=(name,callback,disabled=false)=>h(RN.TouchableOpacity,{accessibilityRole:'button',disabled,onPress:callback,style:{backgroundColor:'#404249',padding:14,borderRadius:10,marginTop:10,opacity:disabled?.5:1}},txt(name,{fontWeight:'600',textAlign:'center'}));
    return h(RN.ScrollView,{style:{flex:1},contentContainerStyle:{padding:16,paddingBottom:48}},
      txt('MicFX Probe 2',{fontSize:22,fontWeight:'bold'}),txt('Join a voice call before scanning. This scan lists audio-related methods and inspects the objects returned by known engine getters. It does not record audio or change voice settings.',{marginTop:8,color:'#b5bac1'}),
      button(running?'Scanning…':'Scan audio capabilities',async()=>{setRunning(true);setNotice('');await scan();setText(report);setRunning(false);},running),
      button('Copy report',()=>{try{const c=RN.Clipboard??metro.common.clipboard??metro.findByProps('setString','getString');if(typeof c?.setString!=='function')throw 0;c.setString(report);setNotice('Copied.');}catch(_){setNotice('Clipboard unavailable. Select the report text to copy.');}},!text||running),
      button('Clear report',()=>{report='';setText('');setNotice('');},running),
      notice?txt(notice,{marginTop:8}):null,
      h(RN.Text,{selectable:true,style:{color:'#dbdee1',backgroundColor:'#202124',borderRadius:8,padding:12,marginTop:18,fontSize:12,fontFamily:'Menlo'}},text||'No scan yet. Join a call, then scan.'));
  }
  // Controls are session-scoped; no automatic setting changes on plugin load.
  const cfg={gain:0,bypass:false,stereo:false,pitch:0,detune:0,blend:100,width:0};
  const pairs=[['getNoiseCancellation','setNoiseCancellation'],['getNoiseSuppression','setNoiseSuppression'],['getAutomaticGainControl','setAutomaticGainControl'],['getEchoCancellation','setEchoCancellation']];
  let stereoActive=false;
  let baseline=null, filtered=null, status='No audio changes applied.', stereoSeen=0, stereoChanged=0, stereoHooks=0, gainTarget=null, restoring=null;
  const offs=[], hooked=new WeakMap();
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function lookup(...p){try{return metro.findByProps?.(...p);}catch(_){return null;}}
  function endpoints(){const store=lookup('getInputVolume','getMediaEngine');const actions=lookup('setInputVolume','setNoiseSuppression','setEchoCancellation');return {store,actions};}
  function getSetting(store,key){try{return store?.[key]?.call(store);}catch(_){return undefined;}}
  function available(x,k){try{return typeof x?.[k]==='function';}catch(_){return false;}}
  async function setSetting(actions,key,val){if(!available(actions,key))throw Error('unavailable');await actions[key].call(actions,val);}
  async function restoreGain(){if(!baseline)return;const b=baseline;await setSetting(b.actions,'setInputVolume',b.value);baseline=null;gainTarget=null;}
  async function restoreFilters(){if(!filtered)return;const f=filtered;let failed=0;for(const [key,value] of [...f.saved].reverse()){try{await setSetting(f.actions,key,value);f.saved.delete(key);}catch(_){failed++;}}if(!f.saved.size)filtered=null;if(failed)throw Error('Some original filters could not be restored');}
  function plain(o){if(!o||typeof o!=='object'||Array.isArray(o))return false;try{const p=Object.getPrototypeOf(o);return p===Object.prototype||p===null;}catch(_){return false;}}
  function stereoArgs(args){if(!live||!stereoActive||!Array.isArray(args))return args;try{
    return args.map(o=>{if(!plain(o)||!plain(o.audioEncoder))return o;const e=o.audioEncoder,p=plain(e.params)?e.params:null;
      stereoSeen++;const top=typeof e.channels==='number'&&(e.channels===1||e.channels===2),nested=p&&typeof p.channels==='number'&&(p.channels===1||p.channels===2);
      // Only change fields actually present, no invented parameters, no encryption or bitrate changes.
      if(!top&&!nested)return o;const copy={...e};if(top)copy.channels=2;if(nested)copy.params={...p,channels:2};stereoChanged++;return {...o,audioEncoder:copy};});
  }catch(_){return args;}}
  function installStereoHooks(){const before=vendetta.patcher?.before;if(typeof before!=='function')return;
    const {store}=endpoints(), wrap=lookup('getVoiceEngine'), direct=lookup('setTransportOptions','createVoiceConnectionWithOptions');
    const targets=[direct,wrap,getSetting(wrap,'getVoiceEngine'),getSetting(store,'getMediaEngine')];
    for(const k of ['DCDVoiceEngine','VoiceEngine']){try{targets.push(RN.NativeModules?.[k]);}catch(_){}try{targets.push(RN.TurboModuleRegistry?.get?.(k));}catch(_){}}
    for(const t of targets){if(!obj(t))continue;let set=hooked.get(t);if(!set){set=new Set();hooked.set(t,set);}for(const k of ['setTransportOptions','connectionInstanceSetTransportOptions']){if(set.has(k)||!available(t,k))continue;try{const off=before(k,t,stereoArgs);if(typeof off==='function'){offs.push(off);set.add(k);stereoHooks++;}}catch(_){}}}
  }
  let writing=false;
  async function applyControls(){if(writing||!live)return;writing=true;const messages=[];try{
    const {store,actions}=endpoints();
    if(cfg.gain===0){try{await restoreGain();messages.push('Gain: 0 dB (original volume).');}catch(_){messages.push('Gain restore failed; use Discord voice settings.');}}
    else {try{if(!baseline){const v=getSetting(store,'getInputVolume');if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100||!available(actions,'setInputVolume'))throw Error('Getter/setter unavailable');baseline={value:v,actions};}
      const ideal=baseline.value*Math.pow(10,cfg.gain/20);const value=Math.round(clamp(ideal,0,100)*100)/100;await setSetting(baseline.actions,'setInputVolume',value);gainTarget=value;
      messages.push('Gain: requested '+cfg.gain+' dB; input volume '+value+'%'+(ideal>100?' (capped at 100%; boost not achieved)':' (dB conversion is approximate)')+'.');}catch(_){messages.push('Gain unavailable or rejected on this build.');}}
    if(cfg.bypass){try{if(!filtered){const saved=new Map();for(const [g,s] of pairs){const v=getSetting(store,g);if(typeof v==='boolean'&&available(actions,s))saved.set(s,v);}filtered={actions,saved};}let count=0;for(const [,s] of pairs){try{if(!filtered.saved.has(s))continue;await setSetting(filtered.actions,s,false);count++;}catch(_){}}messages.push('Filters: '+count+'/4 disable requests accepted. Verify in Discord settings; native processing may remain.');}catch(_){messages.push('Filter bypass unavailable.');}}
    else {try{await restoreFilters();messages.push('Filters: original settings retained/restored.');}catch(_){messages.push('Filter restoration incomplete; restore in Discord settings.');}}
    stereoActive=live&&cfg.stereo; if(stereoActive){installStereoHooks();messages.push('Stereo: '+stereoHooks+' transport hooks installed; '+stereoChanged+' encoder requests changed. Rejoin call to test; true stereo not confirmed.');}else messages.push('Stereo request off; rejoin call to restore negotiated format.');
    messages.push('Pitch, detune, blend and widening are previews only; no writable PCM interface identified.');status=messages.join('\n');
  }finally{writing=false;}}
  function Controls(){const h=React.createElement;const [rev,refresh]=React.useState(0),[busyUI,setBusyUI]=React.useState(false),[showProbe,setShowProbe]=React.useState(false);const update=()=>refresh(v=>v+1);
    const txt=(t,s={})=>h(RN.Text,{style:{color:'#e5e7eb',fontSize:15,...s}},t);
    const sub=t=>txt(t,{color:'#aeb4bf',fontSize:12,lineHeight:18,marginTop:5});
    const button=(t,fn,disabled=false)=>h(RN.TouchableOpacity,{accessibilityRole:'button',disabled,onPress:fn,style:{padding:12,borderRadius:9,backgroundColor:'#404249',opacity:disabled?.4:1,alignItems:'center'}},txt(t,{fontWeight:'600'}));
    const card=(title,children)=>h(RN.View,{style:{padding:14,backgroundColor:'#24262d',borderRadius:14,marginTop:12}},txt(title,{fontSize:17,fontWeight:'700',marginBottom:8}),...children);
    const step=(label,key,min,max,unit,signed,preview=false)=>{const value=cfg[key],fmt=(n)=>`${signed&&n>0?'+':''}${n}${unit}`,change=n=>{cfg[key]=clamp(n,min,max);update();};return h(RN.View,{style:{marginBottom:15}},h(RN.View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}},txt(label),txt(fmt(value),{fontWeight:'bold',color:preview?'#b9bbc4':'#a3aaff'})),h(RN.View,{style:{height:5,backgroundColor:'#454850',borderRadius:5,marginVertical:12}},h(RN.View,{style:{width:((value-min)/(max-min)*100)+'%',height:5,backgroundColor:preview?'#777b89':'#818cf8',borderRadius:5}})),h(RN.View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}},button('−',()=>change(value-1),busyUI||value<=min),button('Reset',()=>change(key==='blend'?100:0),busyUI),button('+',()=>change(value+1),busyUI||value>=max)),sub(fmt(min)+' to '+fmt(max)+(preview?' · Preview only':'')));};
    const toggle=(label,key,desc)=>h(RN.View,{style:{marginBottom:12}},h(RN.View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}},txt(label,{fontWeight:'600'}),h(RN.Switch,{value:cfg[key],disabled:busyUI,onValueChange:v=>{cfg[key]=v;update();}})),sub(desc));
    const run=async(reset=false)=>{if(busyUI||writing)return;setBusyUI(true);if(reset)Object.assign(cfg,{gain:0,bypass:false,stereo:false,pitch:0,detune:0,blend:100,width:0});try{await applyControls();}finally{setBusyUI(false);update();}};
    return h(RN.ScrollView,{style:{flex:1},contentContainerStyle:{padding:16,paddingBottom:50}},txt('MicFX',{fontSize:26,fontWeight:'bold'}),sub('Voice controls · Experimental alpha. Nothing is applied until you press Apply.'),card('Input gain',[step('Microphone gain','gain',-12,12,' dB',true),sub('Uses Discord input volume, not calibrated PCM gain. Positive gain can be capped at 100%.')]),card('Pitchproof-style processor',[sub('Preview only — no outgoing audio hook yet.'),step('Pitch','pitch',-12,12,' st',true,true),step('Detune','detune',-100,100,' cents',true,true),step('Blend','blend',0,100,'%',false,true)]),card('Stereo & width',[toggle('Request stereo encoding','stereo','Experimental: changes existing encoder channel fields only. Rejoin call and verify with another listener.'),step('Stereo widening','width',0,100,'%',false,true),sub('True widening requires PCM processing; mono capture may remain mono.')]),card('Original Discord processing',[toggle('Disable Discord filters','bypass','Requests noise suppression, noise cancellation, AGC and echo cancellation off. Prefer headphones to avoid echo.'),sub('iOS system voice processing may remain active.')]),h(RN.View,{style:{marginTop:14}},button(busyUI?'Applying…':'Apply audio controls',()=>run(),busyUI)),h(RN.View,{style:{marginTop:8}},button('Reset / restore original settings',()=>run(true),busyUI)),card('Status',[txt(status,{fontSize:13,lineHeight:19}),sub('Transport hooks: '+stereoHooks+' · Encoder options observed: '+stereoSeen+' · Requests changed: '+stereoChanged),button('Refresh status',update,busyUI)]),h(RN.View,{style:{marginTop:12}},button(showProbe?'Hide diagnostics':'Show diagnostics',()=>setShowProbe(!showProbe))),showProbe?h(RN.View,{style:{height:650,marginTop:12}},h(Settings)):null);
  }
  return {settings:Controls,onLoad(){live=true;},onUnload(){live=false;stereoActive=false;cfg.stereo=false;generation++;busy=false;report='';for(const off of offs.splice(0)){try{off();}catch(_){}};restoring=Promise.resolve().then(async()=>{while(writing)await new Promise(r=>setTimeout(r,20));try{await restoreGain();}catch(_){}try{await restoreFilters();}catch(_){}});}};
})()
