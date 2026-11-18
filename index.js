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
    if((force||hits.length)&&m.length){const selection=force?m:hits;found.add(label+' ['+selection.slice(0,75).join(', ')+(selection.length>75?', ...':'')+']');}}
  const names=['DCDVoice','DCDVoiceModule','DCDVoiceEngine','DCDMediaEngine','DCDMediaEngineModule','DCDMedia','DCDAudio','DCDAudioModule','DCDAudioManager','DCDAudioSession','DCDWebRTC','DiscordVoice','DiscordMediaEngine','VoiceModule','VoiceEngine','MediaEngine','AudioModule','AudioManager','AudioSession','WebRTCModule','RNWebRTC','RTCAudioSession','AudioRecorder','AudioProcessing','VoiceProcessing','AudioEngine','NativeAudioModule'];
  const probes=[['setInputVolume'],['getInputVolume'],['setNoiseSuppression'],['setNoiseCancellation'],['setEchoCancellation'],['setAutomaticGainControl'],['getMediaEngine'],['getVoiceEngine'],['setTransportOptions'],['setVoiceFilter'],['getVoiceFilters'],['setVoiceEffect'],['setPitch'],['setAudioPitch'],['setEqualizer'],['setAudioEffect'],['setAudioProcessing'],['setInputGain'],['setAudioInputCallback'],['setAudioCaptureCallback'],['setAudioFrameCallback'],['setAudioPreprocessor'],['processAudioFrame'],['onAudioFrame'],['onAudioData'],['setPcmCallback'],['setMicrophoneVolume'],['setLocalVolume'],['setSelfMute']];
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
          const m=methods(x);foundQueries.add(props.join('+')+' -> '+(m.filter(k=>relevant.test(k)).slice(0,75).join(', ')||'module returned; methods not enumerable'));
        }
      }catch(_){}await wait();}
      if(alive())report=['MicFX Probe 1','Read-only capability discovery; no microphone recording, audio callbacks or audio setting changes.',...info,'\nNative modules:\n'+([...native].join('\n')||'none found'),'\nTargeted Metro lookups:\n'+([...foundQueries].join('\n')||'none found'),'\nInitialized Metro modules (function names only):\n'+([...modules].join('\n')||'none found')].join('\n');
    }catch(_){if(alive())report='MicFX Probe 1\nScan failed before completion. No audio was recorded or modified.';}
    finally{if(id===generation)busy=false;}
  }
  function Settings(){const [text,setText]=React.useState(report),[running,setRunning]=React.useState(busy),[notice,setNotice]=React.useState('');
    const h=React.createElement;
    const txt=(s,style={})=>h(RN.Text,{style:{color:'#e5e7eb',fontSize:15,...style}},s);
    const button=(name,callback,disabled=false)=>h(RN.TouchableOpacity,{accessibilityRole:'button',disabled,onPress:callback,style:{backgroundColor:'#404249',padding:14,borderRadius:10,marginTop:10,opacity:disabled?.5:1}},txt(name,{fontWeight:'600',textAlign:'center'}));
    return h(RN.ScrollView,{style:{flex:1},contentContainerStyle:{padding:16,paddingBottom:48}},
      txt('MicFX Probe 1',{fontSize:22,fontWeight:'bold'}),txt('Join a voice call before scanning. The probe reports module and method names only. It does not record audio or change settings.',{marginTop:8,color:'#b5bac1'}),
      button(running?'Scanning…':'Scan audio capabilities',async()=>{setRunning(true);setNotice('');await scan();setText(report);setRunning(false);},running),
      button('Copy report',()=>{try{const c=RN.Clipboard??metro.common.clipboard??metro.findByProps('setString','getString');if(typeof c?.setString!=='function')throw 0;c.setString(report);setNotice('Copied.');}catch(_){setNotice('Clipboard unavailable. Select the report text to copy.');}},!text||running),
      button('Clear report',()=>{report='';setText('');setNotice('');},running),
      notice?txt(notice,{marginTop:8}):null,
      h(RN.Text,{selectable:true,style:{color:'#dbdee1',backgroundColor:'#202124',borderRadius:8,padding:12,marginTop:18,fontSize:12,fontFamily:'Menlo'}},text||'No scan yet.'));
  }
  return {settings:Settings,onLoad(){live=true;},onUnload(){live=false;generation++;busy=false;report='';}};
})()
