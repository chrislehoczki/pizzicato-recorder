// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"../index.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = PizzicatoRecorder;

function PizzicatoRecorder(Pizzicato) {
  Pizzicato.Recorder = {
    instance: null,
    worker: null,
    start: function start(options) {
      this.options = options;

      if (!this.worker) {
        // create our worker
        this.worker = this.createWorker(); // listen for events

        this.worker.onmessage = function (e) {
          switch (e.data.type) {
            case 'audioBlob':
              Pizzicato.Events.trigger('audioFile', e.data.audioBlob);
              break;

            case 'progress':
              Pizzicato.Events.trigger('conversionProgress', e.data.progress);
              break;
          }
        };
      } // attach our nodes


      var source = this.processNodes(); // create a new recorder controller with our connected source

      if (!this.instance) {
        this.instance = new this.controller(source, null, this.worker);
      } // clear out any old worker data


      this.comms.clear.call(this); // start recording

      this.instance.record();
    },
    stop: function stop(fileType, callback, progress) {
      // stop recording
      this.instance.stop(); // stop our worker from taking data

      this.comms.stop.call(this); // choose export according to filetype

      if (fileType === 'mp3') {
        this.comms.exportMP3.call(this);
      } else {
        this.comms.exportWAV.call(this);
      }

      if (this.options.mute) {
        // reconnect our speakers  with timeout to avoid click
        setTimeout(function () {
          return Pizzicato.masterGainNode.connect(Pizzicato.context.destination);
        }, 50);
      }

      function endCallback(file) {
        callback(file, fileType);
        Pizzicato.Events.off('audioFile', endCallback);
      }

      function progressCallback() {
        progress();
        Pizzicato.Events.off('conversionProgress', progressCallback);
      } // attach event listeners


      Pizzicato.Events.on('conversionProgress', progressCallback);
      Pizzicato.Events.on('audioFile', endCallback); // remove options

      this.options = null;
    },
    processNodes: function processNodes() {
      // connect our master gain node to a media stream destination for processing audio
      var source = Pizzicato.masterGainNode;
      var dest = Pizzicato.context.createMediaStreamDestination();
      var speaker = Pizzicato.context.destination;

      if (this.options.mute) {
        source.disconnect(speaker);
      }

      source.connect(dest);
      return source;
    },
    comms: {
      clear: function clear() {
        this.worker.postMessage({
          command: 'clear'
        });
      },
      stop: function stop() {
        this.worker.postMessage({
          command: 'stopRecord'
        });
      },
      exportWAV: function exportWAV() {
        this.worker.postMessage({
          command: 'exportWAV',
          type: 'audio/wav'
        });
      },
      exportMP3: function exportMP3() {
        this.worker.postMessage({
          command: 'exportStereoMP3',
          type: 'audio/wav'
        });
      }
    },
    controller: function controller(source, cfg, worker) {
      var recording = false;
      var config = cfg || {};
      var bufferLen = config.bufferLen || 4096;
      this.context = source.context;

      if (!this.context.createScriptProcessor) {
        this.node = this.context.createJavaScriptNode(bufferLen, 2, 2);
      } else {
        this.node = this.context.createScriptProcessor(bufferLen, 2, 2);
      }

      worker.postMessage({
        command: 'init',
        config: {
          sampleRate: this.context.sampleRate
        }
      });

      this.node.onaudioprocess = function (e) {
        if (!recording) return;
        worker.postMessage({
          command: 'record',
          buffer: [e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(1)]
        });
      };

      this.record = function () {
        recording = true;
      };

      this.stop = function () {
        recording = false;
      };

      source.connect(this.node);
      this.node.connect(this.context.destination);
    },
    createWorker: function createWorker() {
      var blob = new Blob([this.workerString], {
        type: "text/javascript"
      }); // Note: window.webkitURL.createObjectURL() in Chrome 10+.

      return new Worker(window.URL.createObjectURL(blob));
    },
    workerString: "\n      function createLog(action) {\n        console.info('Recorder: ' + action);\n      }\n\n      // some params \n      var recLength = 0;\n      var sampleRate;\n\n      // original recorded buffers\n      var recBuffersL = [];\n      var recBuffersR = [];\n\n      // comms\n      this.onmessage = function (e) {\n        switch (e.data.command) {\n          case 'init':\n            init(e.data.config);\n            break;\n          case 'record':\n            record(e.data.buffer);\n            break;\n          case 'stopRecord':\n            createSamples();\n            break;\n          case 'exportWAV':\n            exportWAV(e.data.type);\n            break;\n          case 'clear':\n            clear();\n            break;\n        }\n      };\n\n      function init (config) {\n        sampleRate = config.sampleRate;\n      }\n\n      function record (inputBuffer) {\n        // push to our original buffers\n        recBuffersL.push(inputBuffer[0]);\n        recBuffersR.push(inputBuffer[1]);\n\n        // store the recording length\n        recLength += inputBuffer[0].length;\n      }\n\n      function exportWAV (type) {\n        // merge all our buffers\n        recBuffersL = mergeBuffers(recBuffersL, recLength);\n        recBuffersR = mergeBuffers(recBuffersR, recLength);\n        // create our samples from our buffer for wav\n        var samples = createSamples();\n        // make the wav\n        var dataview = encodeWAV(samples);\n        var audioBlob = new Blob([dataview], { type: 'audio/wav' });\n        // post it back\n        this.postMessage({ type: 'audioBlob', audioBlob: audioBlob });\n      }\n\n      function createSamples() {\n        return interleave(recBuffersL, recBuffersR)\n      }\n\n      function clear () {\n        recLength = 0;\n        recBuffersL = [];\n        recBuffersR = [];\n      }\n\n      function mergeBuffers (recBuffers, recLength) {\n        var result = new Float32Array(recLength);\n        var offset = 0;\n        for (var i = 0; i < recBuffers.length; i++) {\n          result.set(recBuffers[i], offset);\n          offset += recBuffers[i].length;\n        }\n        return result;\n      }\n\n      function interleave (inputL, inputR) {\n        var length = inputL.length + inputR.length;\n        var result = new Float32Array(length);\n\n        var index = 0,\n          inputIndex = 0;\n\n        while (index < length) {\n          result[index++] = inputL[inputIndex];\n          result[index++] = inputR[inputIndex];\n          inputIndex++;\n        }\n        return result;\n      }\n\n      function floatTo16BitPCM (output, offset, input) {\n        for (var i = 0; i < input.length; i++, offset += 2) {\n          var s = Math.max(-1, Math.min(1, input[i]));\n          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);\n        }\n      }\n\n      function writeString (view, offset, string) {\n        for (var i = 0; i < string.length; i++) {\n          view.setUint8(offset + i, string.charCodeAt(i));\n        }\n      }\n\n      function encodeWAV (samples, mono) {\n        var buffer = new ArrayBuffer(44 + samples.length * 2);\n        var view = new DataView(buffer);\n\n        /* RIFF identifier */\n        writeString(view, 0, 'RIFF');\n        /* file length */\n        view.setUint32(4, 32 + samples.length * 2, true);\n        /* RIFF type */\n        writeString(view, 8, 'WAVE');\n        /* format chunk identifier */\n        writeString(view, 12, 'fmt ');\n        /* format chunk length */\n        view.setUint32(16, 16, true);\n        /* sample format (raw) */\n        view.setUint16(20, 1, true);\n        /* channel count */\n        view.setUint16(22, mono ? 1 : 2, true);\n        /* sample rate */\n        view.setUint32(24, sampleRate, true);\n        /* byte rate (sample rate * block align) */\n        view.setUint32(28, sampleRate * 4, true);\n        /* block align (channel count * bytes per sample) */\n        view.setUint16(32, 4, true);\n        /* bits per sample */\n        view.setUint16(34, 16, true);\n        /* data chunk identifier */\n        writeString(view, 36, 'data');\n        /* data chunk length */\n        view.setUint32(40, samples.length * 2, true);\n\n        floatTo16BitPCM(view, 44, samples);\n\n        return view;\n      }\n\n      function convertBuffer (buffers) {\n        var lo = buffers[0];\n        var ro = buffers[1];\n\n        // if we are not a float32array already, lets merge standard array of float32s to one float32\n        if (buffers[0].constructor !== Float32Array) {\n            lo = mergeBuffers(buffers[0], recLength);\n            ro = mergeBuffers(buffers[1], recLength);\n        }\n\n        var l = new Float32Array(lo.length); // The transformed data, this is what you will pass to lame instead\n        var r = new Float32Array(ro.length);\n\n        // Convert to required format\n        for (var i = 0; i < lo.length; i++) {\n          l[i] = lo[i] * 32767.5;\n          r[i] = ro[i] * 32767.5;\n        }\n\n        return { l: l, r: r };\n      }\n    "
  };
}
},{}],"../node_modules/pizzicato/distr/Pizzicato.min.js":[function(require,module,exports) {
var define;
var global = arguments[3];
!function(e){"use strict";function t(e,t){this.options={},e=e||this.options;var i={frequency:350,peak:1};this.inputNode=this.filterNode=s.context.createBiquadFilter(),this.filterNode.type=t,this.outputNode=o.context.createGain(),this.filterNode.connect(this.outputNode);for(var n in i)this[n]=e[n],this[n]=void 0===this[n]||null===this[n]?i[n]:this[n]}function i(){var e,t,i=s.context.sampleRate*this.time,n=o.context.createBuffer(2,i,s.context.sampleRate),a=n.getChannelData(0),r=n.getChannelData(1);for(t=0;i>t;t++)e=this.reverse?i-t:t,a[t]=(2*Math.random()-1)*Math.pow(1-e/i,this.decay),r[t]=(2*Math.random()-1)*Math.pow(1-e/i,this.decay);this.reverbNode.buffer&&(this.inputNode.disconnect(this.reverbNode),this.reverbNode.disconnect(this.wetGainNode),this.reverbNode=o.context.createConvolver(),this.inputNode.connect(this.reverbNode),this.reverbNode.connect(this.wetGainNode)),this.reverbNode.buffer=n}function n(e){for(var t=s.context.sampleRate,i=new Float32Array(t),n=Math.PI/180,o=0;t>o;o++){var a=2*o/t-1;i[o]=(3+e)*a*20*n/(Math.PI+e*Math.abs(a))}return i}var o={},s=o,a="object"==typeof module&&module.exports,r="function"==typeof define&&define.amd;a?module.exports=o:r?define([],o):e.Pizzicato=e.Pz=o;var c=e.AudioContext||e.webkitAudioContext;if(!c)return void console.error("No AudioContext found in this environment. Please ensure your window or global object contains a working AudioContext constructor function.");o.context=new c;var h=o.context.createGain();h.connect(o.context.destination),o.Util={isString:function(e){return"[object String]"===toString.call(e)},isObject:function(e){return"[object Object]"===toString.call(e)},isFunction:function(e){return"[object Function]"===toString.call(e)},isNumber:function(e){return"[object Number]"===toString.call(e)&&e===+e},isArray:function(e){return"[object Array]"===toString.call(e)},isInRange:function(e,t,i){return s.Util.isNumber(e)&&s.Util.isNumber(t)&&s.Util.isNumber(i)?e>=t&&i>=e:!1},isBool:function(e){return"boolean"==typeof e},isOscillator:function(e){return e&&"[object OscillatorNode]"===e.toString()},isAudioBufferSourceNode:function(e){return e&&"[object AudioBufferSourceNode]"===e.toString()},isSound:function(e){return e instanceof s.Sound},isEffect:function(e){for(var t in o.Effects)if(e instanceof o.Effects[t])return!0;return!1},normalize:function(e,t,i){return s.Util.isNumber(e)&&s.Util.isNumber(t)&&s.Util.isNumber(i)?(i-t)*e/1+t:void 0},getDryLevel:function(e){return!s.Util.isNumber(e)||e>1||0>e?0:.5>=e?1:1-2*(e-.5)},getWetLevel:function(e){return!s.Util.isNumber(e)||e>1||0>e?0:e>=.5?1:1-2*(.5-e)}};var u=o.context.createGain(),d=Object.getPrototypeOf(Object.getPrototypeOf(u)),l=d.connect;d.connect=function(e){var t=s.Util.isEffect(e)?e.inputNode:e;return l.call(this,t),e},Object.defineProperty(o,"volume",{enumerable:!0,get:function(){return h.gain.value},set:function(e){s.Util.isInRange(e,0,1)&&h&&(h.gain.value=e)}}),Object.defineProperty(o,"masterGainNode",{enumerable:!1,get:function(){return h},set:function(e){console.error("Can't set the master gain node")}}),o.Events={on:function(e,t,i){if(e&&t){this._events=this._events||{};var n=this._events[e]||(this._events[e]=[]);n.push({callback:t,context:i||this,handler:this})}},trigger:function(e){if(e){var t,i,n,o;if(this._events=this._events||{},t=this._events[e]||(this._events[e]=[])){for(i=Math.max(0,arguments.length-1),n=[],o=0;i>o;o++)n[o]=arguments[o+1];for(o=0;o<t.length;o++)t[o].callback.apply(t[o].context,n)}}},off:function(e){e?this._events[e]=void 0:this._events={}}},o.Sound=function(e,t){function i(e){var t=["wave","file","input","script","sound"];if(e&&!d.isFunction(e)&&!d.isString(e)&&!d.isObject(e))return"Description type not supported. Initialize a sound using an object, a function or a string.";if(d.isObject(e)){if(!d.isString(e.source)||-1===t.indexOf(e.source))return"Specified source not supported. Sources can be wave, file, input or script";if(!("file"!==e.source||e.options&&e.options.path))return"A path is needed for sounds with a file source";if(!("script"!==e.source||e.options&&e.options.audioFunction))return"An audio function is needed for sounds with a script source"}}function n(e,t){e=e||{},this.getRawSourceNode=function(){var t=this.sourceNode?this.sourceNode.frequency.value:e.frequency,i=o.context.createOscillator();return i.type=e.type||"sine",i.frequency.value=t||440,i},this.sourceNode=this.getRawSourceNode(),this.sourceNode.gainSuccessor=s.context.createGain(),this.sourceNode.connect(this.sourceNode.gainSuccessor),d.isFunction(t)&&t()}function a(e,t){e=d.isArray(e)?e:[e];var i=new XMLHttpRequest;i.open("GET",e[0],!0),i.responseType="arraybuffer",i.onload=function(i){o.context.decodeAudioData(i.target.response,function(e){u.getRawSourceNode=function(){var t=o.context.createBufferSource();return t.loop=this.loop,t.buffer=e,t},d.isFunction(t)&&t()}.bind(u),function(i){return console.error("Error decoding audio file "+e[0]),e.length>1?(e.shift(),void a(e,t)):(i=i||new Error("Error decoding audio file "+e[0]),void(d.isFunction(t)&&t(i)))}.bind(u))},i.onreadystatechange=function(t){4===i.readyState&&200!==i.status&&console.error("Error while fetching "+e[0]+". "+i.statusText)},i.send()}function r(e,t){if(navigator.getUserMedia=navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia,!navigator.getUserMedia&&!navigator.mediaDevices.getUserMedia)return void console.error("Your browser does not support getUserMedia");var i=function(e){u.getRawSourceNode=function(){return o.context.createMediaStreamSource(e)},d.isFunction(t)&&t()}.bind(u),n=function(e){d.isFunction(t)&&t(e)};navigator.mediaDevices.getUserMedia?navigator.mediaDevices.getUserMedia({audio:!0}).then(i)["catch"](n):navigator.getUserMedia({audio:!0},i,n)}function c(e,t){var i=d.isFunction(e)?e:e.audioFunction,n=d.isObject(e)&&e.bufferSize?e.bufferSize:null;if(!n)try{o.context.createScriptProcessor()}catch(s){n=2048}this.getRawSourceNode=function(){var e=o.context.createScriptProcessor(n,1,1);return e.onaudioprocess=i,e}}function h(e,t){this.getRawSourceNode=e.sound.getRawSourceNode,e.sound.sourceNode&&s.Util.isOscillator(e.sound.sourceNode)&&(this.sourceNode=this.getRawSourceNode(),this.frequency=e.sound.frequency)}var u=this,d=o.Util,l=i(e),f=d.isObject(e)&&d.isObject(e.options),p=.04,v=.04;if(l)throw console.error(l),new Error("Error initializing Pizzicato Sound: "+l);this.detached=f&&e.options.detached,this.masterVolume=o.context.createGain(),this.fadeNode=o.context.createGain(),this.fadeNode.gain.value=0,this.detached||this.masterVolume.connect(o.masterGainNode),this.lastTimePlayed=0,this.effects=[],this.effectConnectors=[],this.playing=this.paused=!1,this.loop=f&&e.options.loop,this.attack=f&&d.isNumber(e.options.attack)?e.options.attack:p,this.volume=f&&d.isNumber(e.options.volume)?e.options.volume:1,f&&d.isNumber(e.options.release)?this.release=e.options.release:f&&d.isNumber(e.options.sustain)?(console.warn("'sustain' is deprecated. Use 'release' instead."),this.release=e.options.sustain):this.release=v,e?d.isString(e)?a.bind(this)(e,t):d.isFunction(e)?c.bind(this)(e,t):"file"===e.source?a.bind(this)(e.options.path,t):"wave"===e.source?n.bind(this)(e.options,t):"input"===e.source?r.bind(this)(e,t):"script"===e.source?c.bind(this)(e.options,t):"sound"===e.source&&h.bind(this)(e.options,t):n.bind(this)({},t)},o.Sound.prototype=Object.create(o.Events,{play:{enumerable:!0,value:function(e,t){this.playing||(s.Util.isNumber(t)||(t=this.offsetTime||0),s.Util.isNumber(e)||(e=0),this.playing=!0,this.paused=!1,this.sourceNode=this.getSourceNode(),this.applyAttack(),s.Util.isFunction(this.sourceNode.start)&&(this.lastTimePlayed=o.context.currentTime-t,this.sourceNode.start(s.context.currentTime+e,t)),this.trigger("play"))}},stop:{enumerable:!0,value:function(){(this.paused||this.playing)&&(this.paused=this.playing=!1,this.stopWithRelease(),this.offsetTime=0,this.trigger("stop"))}},pause:{enumerable:!0,value:function(){if(!this.paused&&this.playing){this.paused=!0,this.playing=!1,this.stopWithRelease();var e=s.context.currentTime-this.lastTimePlayed;this.sourceNode.buffer?this.offsetTime=e%(this.sourceNode.buffer.length/s.context.sampleRate):this.offsetTime=e,this.trigger("pause")}}},clone:{enumerable:!0,value:function(){for(var e=new o.Sound({source:"sound",options:{loop:this.loop,attack:this.attack,release:this.release,volume:this.volume,sound:this}}),t=0;t<this.effects.length;t++)e.addEffect(this.effects[t]);return e}},onEnded:{enumerable:!0,value:function(e){return function(){this.sourceNode&&this.sourceNode!==e||(this.playing&&this.stop(),this.paused||this.trigger("end"))}}},addEffect:{enumerable:!0,value:function(e){if(!s.Util.isEffect(e))return console.error("The object provided is not a Pizzicato effect."),this;this.effects.push(e);var t=this.effectConnectors.length>0?this.effectConnectors[this.effectConnectors.length-1]:this.fadeNode;t.disconnect(),t.connect(e);var i=s.context.createGain();return this.effectConnectors.push(i),e.connect(i),i.connect(this.masterVolume),this}},removeEffect:{enumerable:!0,value:function(e){var t=this.effects.indexOf(e);if(-1===t)return console.warn("Cannot remove effect that is not applied to this sound."),this;var i=this.playing;i&&this.pause();var n=0===t?this.fadeNode:this.effectConnectors[t-1];n.disconnect();var o=this.effectConnectors[t];o.disconnect(),e.disconnect(o),this.effectConnectors.splice(t,1),this.effects.splice(t,1);var s;return s=t>this.effects.length-1||0===this.effects.length?this.masterVolume:this.effects[t],n.connect(s),i&&this.play(),this}},connect:{enumerable:!0,value:function(e){return this.masterVolume.connect(e),this}},disconnect:{enumerable:!0,value:function(e){return this.masterVolume.disconnect(e),this}},connectEffects:{enumerable:!0,value:function(){for(var e=[],t=0;t<this.effects.length;t++){var i=t===this.effects.length-1,n=i?this.masterVolume:this.effects[t+1].inputNode;e[t]=s.context.createGain(),this.effects[t].outputNode.disconnect(this.effectConnectors[t]),this.effects[t].outputNode.connect(n)}}},volume:{enumerable:!0,get:function(){return this.masterVolume?this.masterVolume.gain.value:void 0},set:function(e){s.Util.isInRange(e,0,1)&&this.masterVolume&&(this.masterVolume.gain.value=e)}},frequency:{enumerable:!0,get:function(){return this.sourceNode&&s.Util.isOscillator(this.sourceNode)?this.sourceNode.frequency.value:null},set:function(e){this.sourceNode&&s.Util.isOscillator(this.sourceNode)&&(this.sourceNode.frequency.value=e)}},sustain:{enumerable:!0,get:function(){return console.warn("'sustain' is deprecated. Use 'release' instead."),this.release},set:function(e){console.warn("'sustain' is deprecated. Use 'release' instead."),s.Util.isInRange(e,0,10)&&(this.release=e)}},getSourceNode:{enumerable:!0,value:function(){if(this.sourceNode){var e=this.sourceNode;e.gainSuccessor.gain.setValueAtTime(e.gainSuccessor.gain.value,s.context.currentTime),e.gainSuccessor.gain.linearRampToValueAtTime(1e-4,s.context.currentTime+.2),setTimeout(function(){e.disconnect(),e.gainSuccessor.disconnect()},200)}var t=this.getRawSourceNode();return t.gainSuccessor=s.context.createGain(),t.connect(t.gainSuccessor),t.gainSuccessor.connect(this.fadeNode),this.fadeNode.connect(this.getInputNode()),s.Util.isAudioBufferSourceNode(t)&&(t.onended=this.onEnded(t).bind(this)),t}},getInputNode:{enumerable:!0,value:function(){return this.effects.length>0?this.effects[0].inputNode:this.masterVolume}},applyAttack:{enumerable:!1,value:function(){this.fadeNode.gain.value;if(this.fadeNode.gain.cancelScheduledValues(s.context.currentTime),!this.attack)return void this.fadeNode.gain.setTargetAtTime(1,s.context.currentTime,.001);var e=navigator.userAgent.toLowerCase().indexOf("firefox")>-1,t=this.attack;e||(t=(1-this.fadeNode.gain.value)*this.attack),this.fadeNode.gain.setTargetAtTime(1,s.context.currentTime,2*t)}},stopWithRelease:{enumerable:!1,value:function(e){var t=this.sourceNode,i=function(){return s.Util.isFunction(t.stop)?t.stop(0):t.disconnect()};this.fadeNode.gain.value;if(this.fadeNode.gain.cancelScheduledValues(s.context.currentTime),!this.release)return this.fadeNode.gain.setTargetAtTime(0,s.context.currentTime,.001),void i();var n=navigator.userAgent.toLowerCase().indexOf("firefox")>-1,o=this.release;n||(o=this.fadeNode.gain.value*this.release),this.fadeNode.gain.setTargetAtTime(1e-5,s.context.currentTime,o/5),window.setTimeout(function(){i()},1e3*o)}}}),o.Group=function(e){e=e||[],this.mergeGainNode=s.context.createGain(),this.masterVolume=s.context.createGain(),this.sounds=[],this.effects=[],this.effectConnectors=[],this.mergeGainNode.connect(this.masterVolume),this.masterVolume.connect(s.masterGainNode);for(var t=0;t<e.length;t++)this.addSound(e[t])},o.Group.prototype=Object.create(s.Events,{connect:{enumerable:!0,value:function(e){return this.masterVolume.connect(e),this}},disconnect:{enumerable:!0,value:function(e){return this.masterVolume.disconnect(e),this}},addSound:{enumerable:!0,value:function(e){return s.Util.isSound(e)?this.sounds.indexOf(e)>-1?void console.warn("The Pizzicato.Sound object was already added to this group"):e.detached?void console.warn("Groups do not support detached sounds. You can manually create an audio graph to group detached sounds together."):(e.disconnect(s.masterGainNode),e.connect(this.mergeGainNode),void this.sounds.push(e)):void console.error("You can only add Pizzicato.Sound objects")}},removeSound:{enumerable:!0,value:function(e){var t=this.sounds.indexOf(e);return-1===t?void console.warn("Cannot remove a sound that is not part of this group."):(e.disconnect(this.mergeGainNode),e.connect(s.masterGainNode),void this.sounds.splice(t,1))}},volume:{enumerable:!0,get:function(){return this.masterVolume?this.masterVolume.gain.value:void 0},set:function(e){s.Util.isInRange(e,0,1)&&(this.masterVolume.gain.value=e)}},play:{enumerable:!0,value:function(){for(var e=0;e<this.sounds.length;e++)this.sounds[e].play();this.trigger("play")}},stop:{enumerable:!0,value:function(){for(var e=0;e<this.sounds.length;e++)this.sounds[e].stop();this.trigger("stop")}},pause:{enumerable:!0,value:function(){for(var e=0;e<this.sounds.length;e++)this.sounds[e].pause();this.trigger("pause")}},addEffect:{enumerable:!0,value:function(e){if(!s.Util.isEffect(e))return console.error("The object provided is not a Pizzicato effect."),this;this.effects.push(e);var t=this.effectConnectors.length>0?this.effectConnectors[this.effectConnectors.length-1]:this.mergeGainNode;t.disconnect(),t.connect(e);var i=s.context.createGain();return this.effectConnectors.push(i),e.connect(i),i.connect(this.masterVolume),this}},removeEffect:{enumerable:!0,value:function(e){var t=this.effects.indexOf(e);if(-1===t)return console.warn("Cannot remove effect that is not applied to this group."),this;var i=0===t?this.mergeGainNode:this.effectConnectors[t-1];i.disconnect();var n=this.effectConnectors[t];n.disconnect(),e.disconnect(n),this.effectConnectors.splice(t,1),this.effects.splice(t,1);var o;return o=t>this.effects.length-1||0===this.effects.length?this.masterVolume:this.effects[t],i.connect(o),this}}}),o.Effects={};var f=Object.create(null,{connect:{enumerable:!0,value:function(e){return this.outputNode.connect(e),this}},disconnect:{enumerable:!0,value:function(e){return this.outputNode.disconnect(e),this}}});o.Effects.Delay=function(e){this.options={},e=e||this.options;var t={feedback:.5,time:.3,mix:.5};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.feedbackGainNode=o.context.createGain(),this.delayNode=o.context.createDelay(),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.delayNode.connect(this.feedbackGainNode),this.feedbackGainNode.connect(this.delayNode),this.inputNode.connect(this.delayNode),this.delayNode.connect(this.wetGainNode),this.wetGainNode.connect(this.outputNode);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.Delay.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}},time:{enumerable:!0,get:function(){return this.options.time},set:function(e){s.Util.isInRange(e,0,180)&&(this.options.time=e,this.delayNode.delayTime.value=e)}},feedback:{enumerable:!0,get:function(){return this.options.feedback},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.feedback=parseFloat(e,10),this.feedbackGainNode.gain.value=this.feedback)}}}),o.Effects.Compressor=function(e){this.options={},e=e||this.options;var t={threshold:-24,knee:30,attack:.003,release:.25,ratio:12};this.inputNode=this.compressorNode=o.context.createDynamicsCompressor(),this.outputNode=o.context.createGain(),this.compressorNode.connect(this.outputNode);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.Compressor.prototype=Object.create(f,{threshold:{enumerable:!0,get:function(){return this.compressorNode.threshold.value},set:function(e){o.Util.isInRange(e,-100,0)&&(this.compressorNode.threshold.value=e)}},knee:{enumerable:!0,get:function(){return this.compressorNode.knee.value},set:function(e){o.Util.isInRange(e,0,40)&&(this.compressorNode.knee.value=e)}},attack:{enumerable:!0,get:function(){return this.compressorNode.attack.value},set:function(e){o.Util.isInRange(e,0,1)&&(this.compressorNode.attack.value=e)}},release:{enumerable:!0,get:function(){return this.compressorNode.release.value},set:function(e){o.Util.isInRange(e,0,1)&&(this.compressorNode.release.value=e)}},ratio:{enumerable:!0,get:function(){return this.compressorNode.ratio.value},set:function(e){o.Util.isInRange(e,1,20)&&(this.compressorNode.ratio.value=e)}},getCurrentGainReduction:function(){return this.compressorNode.reduction}}),o.Effects.LowPassFilter=function(e){t.call(this,e,"lowpass")},o.Effects.HighPassFilter=function(e){t.call(this,e,"highpass")};var p=Object.create(f,{frequency:{enumerable:!0,get:function(){return this.filterNode.frequency.value},set:function(e){o.Util.isInRange(e,10,22050)&&(this.filterNode.frequency.value=e)}},peak:{enumerable:!0,get:function(){return this.filterNode.Q.value},set:function(e){o.Util.isInRange(e,1e-4,1e3)&&(this.filterNode.Q.value=e)}}});o.Effects.LowPassFilter.prototype=p,o.Effects.HighPassFilter.prototype=p,o.Effects.Distortion=function(e){this.options={},e=e||this.options;var t={gain:.5};this.waveShaperNode=o.context.createWaveShaper(),this.inputNode=this.outputNode=this.waveShaperNode;for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.Distortion.prototype=Object.create(f,{gain:{enumerable:!0,get:function(){return this.options.gain},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.gain=e,this.adjustGain())}},adjustGain:{writable:!1,configurable:!1,enumerable:!1,value:function(){for(var e,t=s.Util.isNumber(this.options.gain)?parseInt(100*this.options.gain,10):50,i=44100,n=new Float32Array(i),o=Math.PI/180,a=0;i>a;++a)e=2*a/i-1,n[a]=(3+t)*e*20*o/(Math.PI+t*Math.abs(e));this.waveShaperNode.curve=n}}}),o.Effects.Flanger=function(e){this.options={},e=e||this.options;var t={time:.45,speed:.2,depth:.1,feedback:.1,mix:.5};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),this.inputFeedbackNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.delayNode=o.context.createDelay(),this.oscillatorNode=o.context.createOscillator(),this.gainNode=o.context.createGain(),this.feedbackNode=o.context.createGain(),this.oscillatorNode.type="sine",this.inputNode.connect(this.inputFeedbackNode),this.inputNode.connect(this.dryGainNode),this.inputFeedbackNode.connect(this.delayNode),this.inputFeedbackNode.connect(this.wetGainNode),this.delayNode.connect(this.wetGainNode),this.delayNode.connect(this.feedbackNode),this.feedbackNode.connect(this.inputFeedbackNode),this.oscillatorNode.connect(this.gainNode),this.gainNode.connect(this.delayNode.delayTime),this.dryGainNode.connect(this.outputNode),this.wetGainNode.connect(this.outputNode),this.oscillatorNode.start(0);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.Flanger.prototype=Object.create(f,{time:{enumberable:!0,get:function(){return this.options.time},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.time=e,this.delayNode.delayTime.value=s.Util.normalize(e,.001,.02))}},speed:{enumberable:!0,get:function(){return this.options.speed},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.speed=e,this.oscillatorNode.frequency.value=s.Util.normalize(e,.5,5))}},depth:{enumberable:!0,get:function(){return this.options.depth},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.depth=e,this.gainNode.gain.value=s.Util.normalize(e,5e-4,.005))}},feedback:{enumberable:!0,get:function(){return this.options.feedback},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.feedback=e,this.feedbackNode.gain.value=s.Util.normalize(e,0,.8))}},mix:{enumberable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}}}),o.Effects.StereoPanner=function(e){this.options={},e=e||this.options;var t={pan:0};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),o.context.createStereoPanner?(this.pannerNode=o.context.createStereoPanner(),this.inputNode.connect(this.pannerNode),this.pannerNode.connect(this.outputNode)):o.context.createPanner?(console.warn("Your browser does not support the StereoPannerNode. Will use PannerNode instead."),this.pannerNode=o.context.createPanner(),this.pannerNode.type="equalpower",this.inputNode.connect(this.pannerNode),this.pannerNode.connect(this.outputNode)):(console.warn("Your browser does not support the Panner effect."),this.inputNode.connect(this.outputNode));for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.StereoPanner.prototype=Object.create(f,{pan:{enumerable:!0,get:function(){return this.options.pan},set:function(e){if(s.Util.isInRange(e,-1,1)&&(this.options.pan=e,this.pannerNode)){var t=this.pannerNode.toString().indexOf("StereoPannerNode")>-1;t?this.pannerNode.pan.value=e:this.pannerNode.setPosition(e,0,1-Math.abs(e))}}}}),o.Effects.Convolver=function(e,t){this.options={},e=e||this.options;var i=this,n=new XMLHttpRequest,a={mix:.5};this.callback=t,this.inputNode=o.context.createGain(),this.convolverNode=o.context.createConvolver(),this.outputNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.inputNode.connect(this.convolverNode),this.convolverNode.connect(this.wetGainNode),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.wetGainNode.connect(this.outputNode);for(var r in a)this[r]=e[r],this[r]=void 0===this[r]||null===this[r]?a[r]:this[r];return e.impulse?(n.open("GET",e.impulse,!0),n.responseType="arraybuffer",n.onload=function(e){var t=e.target.response;o.context.decodeAudioData(t,function(e){i.convolverNode.buffer=e,i.callback&&s.Util.isFunction(i.callback)&&i.callback()},function(e){e=e||new Error("Error decoding impulse file"),i.callback&&s.Util.isFunction(i.callback)&&i.callback(e)})},n.onreadystatechange=function(t){4===n.readyState&&200!==n.status&&console.error("Error while fetching "+e.impulse+". "+n.statusText)},void n.send()):void console.error("No impulse file specified.")},o.Effects.Convolver.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}}}),o.Effects.PingPongDelay=function(e){this.options={},e=e||this.options;var t={feedback:.5,time:.3,mix:.5};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),this.delayNodeLeft=o.context.createDelay(),this.delayNodeRight=o.context.createDelay(),this.dryGainNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.feedbackGainNode=o.context.createGain(),this.channelMerger=o.context.createChannelMerger(2),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.delayNodeLeft.connect(this.channelMerger,0,0),this.delayNodeRight.connect(this.channelMerger,0,1),this.delayNodeLeft.connect(this.delayNodeRight),this.feedbackGainNode.connect(this.delayNodeLeft),this.delayNodeRight.connect(this.feedbackGainNode),this.inputNode.connect(this.feedbackGainNode),this.channelMerger.connect(this.wetGainNode),this.wetGainNode.connect(this.outputNode);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.PingPongDelay.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}},time:{enumerable:!0,get:function(){return this.options.time},set:function(e){s.Util.isInRange(e,0,180)&&(this.options.time=e,this.delayNodeLeft.delayTime.value=e,this.delayNodeRight.delayTime.value=e)}},feedback:{enumerable:!0,get:function(){return this.options.feedback},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.feedback=parseFloat(e,10),this.feedbackGainNode.gain.value=this.feedback)}}}),o.Effects.Reverb=function(e){this.options={},e=e||this.options;var t={mix:.5,time:.01,decay:.01,reverse:!1};this.inputNode=o.context.createGain(),this.reverbNode=o.context.createConvolver(),this.outputNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.inputNode.connect(this.reverbNode),this.reverbNode.connect(this.wetGainNode),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.wetGainNode.connect(this.outputNode);for(var n in t)this[n]=e[n],this[n]=void 0===this[n]||null===this[n]?t[n]:this[n];i.bind(this)()},o.Effects.Reverb.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}},time:{enumerable:!0,get:function(){return this.options.time},set:function(e){s.Util.isInRange(e,1e-4,10)&&(this.options.time=e,i.bind(this)())}},decay:{enumerable:!0,get:function(){return this.options.decay},set:function(e){s.Util.isInRange(e,1e-4,10)&&(this.options.decay=e,i.bind(this)())}},reverse:{enumerable:!0,get:function(){return this.options.reverse},set:function(e){s.Util.isBool(e)&&(this.options.reverse=e,i.bind(this)())}}}),o.Effects.Tremolo=function(e){this.options={},e=e||this.options;var t={speed:4,depth:1,mix:.8};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.tremoloGainNode=o.context.createGain(),this.tremoloGainNode.gain.value=0,this.lfoNode=o.context.createOscillator(),this.shaperNode=o.context.createWaveShaper(),this.shaperNode.curve=new Float32Array([0,1]),this.shaperNode.connect(this.tremoloGainNode.gain),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.lfoNode.connect(this.shaperNode),this.lfoNode.type="sine",this.lfoNode.start(0),this.inputNode.connect(this.tremoloGainNode),this.tremoloGainNode.connect(this.wetGainNode),this.wetGainNode.connect(this.outputNode);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.Tremolo.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}},speed:{enumerable:!0,get:function(){return this.options.speed},set:function(e){s.Util.isInRange(e,0,20)&&(this.options.speed=e,this.lfoNode.frequency.value=e)}},depth:{enumerable:!0,get:function(){return this.options.depth},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.depth=e,this.shaperNode.curve=new Float32Array([1-e,1]))}}}),o.Effects.DubDelay=function(e){this.options={},e=e||this.options;var t={feedback:.6,time:.7,mix:.5,cutoff:700};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.feedbackGainNode=o.context.createGain(),this.delayNode=o.context.createDelay(),this.bqFilterNode=o.context.createBiquadFilter(),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.inputNode.connect(this.wetGainNode),this.inputNode.connect(this.feedbackGainNode),this.feedbackGainNode.connect(this.bqFilterNode),this.bqFilterNode.connect(this.delayNode),this.delayNode.connect(this.feedbackGainNode),this.delayNode.connect(this.wetGainNode),this.wetGainNode.connect(this.outputNode);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]},o.Effects.DubDelay.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}},time:{enumerable:!0,get:function(){return this.options.time},set:function(e){s.Util.isInRange(e,0,180)&&(this.options.time=e,this.delayNode.delayTime.value=e)}},feedback:{enumerable:!0,get:function(){return this.options.feedback},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.feedback=parseFloat(e,10),this.feedbackGainNode.gain.value=this.feedback)}},cutoff:{enumerable:!0,get:function(){return this.options.cutoff},set:function(e){s.Util.isInRange(e,0,4e3)&&(this.options.cutoff=e,this.bqFilterNode.frequency.value=this.cutoff)}}}),o.Effects.RingModulator=function(e){this.options={},e=e||this.options;var t={speed:30,distortion:1,mix:.5};this.inputNode=o.context.createGain(),this.outputNode=o.context.createGain(),this.dryGainNode=o.context.createGain(),this.wetGainNode=o.context.createGain(),this.vIn=o.context.createOscillator(),this.vIn.start(0),this.vInGain=o.context.createGain(),this.vInGain.gain.value=.5,this.vInInverter1=o.context.createGain(),this.vInInverter1.gain.value=-1,this.vInInverter2=o.context.createGain(),this.vInInverter2.gain.value=-1,this.vInDiode1=new v(o.context),this.vInDiode2=new v(o.context),this.vInInverter3=o.context.createGain(),this.vInInverter3.gain.value=-1,this.vcInverter1=o.context.createGain(),this.vcInverter1.gain.value=-1,this.vcDiode3=new v(o.context),this.vcDiode4=new v(o.context),this.outGain=o.context.createGain(),this.outGain.gain.value=3,this.compressor=o.context.createDynamicsCompressor(),this.compressor.threshold.value=-24,this.compressor.ratio.value=16,this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode),this.inputNode.connect(this.vcInverter1),this.inputNode.connect(this.vcDiode4.node),this.vcInverter1.connect(this.vcDiode3.node),this.vIn.connect(this.vInGain),this.vInGain.connect(this.vInInverter1),this.vInGain.connect(this.vcInverter1),this.vInGain.connect(this.vcDiode4.node),this.vInInverter1.connect(this.vInInverter2),this.vInInverter1.connect(this.vInDiode2.node),this.vInInverter2.connect(this.vInDiode1.node),this.vInDiode1.connect(this.vInInverter3),this.vInDiode2.connect(this.vInInverter3),this.vInInverter3.connect(this.compressor),this.vcDiode3.connect(this.compressor),this.vcDiode4.connect(this.compressor),this.compressor.connect(this.outGain),
this.outGain.connect(this.wetGainNode),this.wetGainNode.connect(this.outputNode);for(var i in t)this[i]=e[i],this[i]=void 0===this[i]||null===this[i]?t[i]:this[i]};var v=function(e){this.context=e,this.node=this.context.createWaveShaper(),this.vb=.2,this.vl=.4,this.h=1,this.setCurve()};return v.prototype.setDistortion=function(e){return this.h=e,this.setCurve()},v.prototype.setCurve=function(){var e,t,i,n,o,s,a,r;for(t=1024,o=new Float32Array(t),e=s=0,a=o.length;a>=0?a>s:s>a;e=a>=0?++s:--s)i=(e-t/2)/(t/2),i=Math.abs(i),n=i<=this.vb?0:this.vb<i&&i<=this.vl?this.h*(Math.pow(i-this.vb,2)/(2*this.vl-2*this.vb)):this.h*i-this.h*this.vl+this.h*(Math.pow(this.vl-this.vb,2)/(2*this.vl-2*this.vb)),o[e]=n;return r=this.node.curve=o},v.prototype.connect=function(e){return this.node.connect(e)},o.Effects.RingModulator.prototype=Object.create(f,{mix:{enumerable:!0,get:function(){return this.options.mix},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.mix=e,this.dryGainNode.gain.value=o.Util.getDryLevel(this.mix),this.wetGainNode.gain.value=o.Util.getWetLevel(this.mix))}},speed:{enumerable:!0,get:function(){return this.options.speed},set:function(e){s.Util.isInRange(e,0,2e3)&&(this.options.speed=e,this.vIn.frequency.value=e)}},distortion:{enumerable:!0,get:function(){return this.options.distortion},set:function(e){if(s.Util.isInRange(e,.2,50)){this.options.distortion=parseFloat(e,10);for(var t=[this.vInDiode1,this.vInDiode2,this.vcDiode3,this.vcDiode4],i=0,n=t.length;n>i;i++)t[i].setDistortion(e)}}}}),o.Effects.Quadrafuzz=function(e){this.options={},e=e||this.options;var t={lowGain:.6,midLowGain:.8,midHighGain:.5,highGain:.6};this.inputNode=s.context.createGain(),this.outputNode=s.context.createGain(),this.dryGainNode=s.context.createGain(),this.wetGainNode=s.context.createGain(),this.lowpassLeft=s.context.createBiquadFilter(),this.lowpassLeft.type="lowpass",this.lowpassLeft.frequency.value=147,this.lowpassLeft.Q.value=.7071,this.bandpass1Left=s.context.createBiquadFilter(),this.bandpass1Left.type="bandpass",this.bandpass1Left.frequency.value=587,this.bandpass1Left.Q.value=.7071,this.bandpass2Left=s.context.createBiquadFilter(),this.bandpass2Left.type="bandpass",this.bandpass2Left.frequency.value=2490,this.bandpass2Left.Q.value=.7071,this.highpassLeft=s.context.createBiquadFilter(),this.highpassLeft.type="highpass",this.highpassLeft.frequency.value=4980,this.highpassLeft.Q.value=.7071,this.overdrives=[];for(var i=0;4>i;i++)this.overdrives[i]=s.context.createWaveShaper(),this.overdrives[i].curve=n();this.inputNode.connect(this.wetGainNode),this.inputNode.connect(this.dryGainNode),this.dryGainNode.connect(this.outputNode);var o=[this.lowpassLeft,this.bandpass1Left,this.bandpass2Left,this.highpassLeft];for(i=0;i<o.length;i++)this.wetGainNode.connect(o[i]),o[i].connect(this.overdrives[i]),this.overdrives[i].connect(this.outputNode);for(var a in t)this[a]=e[a],this[a]=void 0===this[a]||null===this[a]?t[a]:this[a]},o.Effects.Quadrafuzz.prototype=Object.create(f,{lowGain:{enumerable:!0,get:function(){return this.options.lowGain},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.lowGain=e,this.overdrives[0].curve=n(s.Util.normalize(this.lowGain,0,150)))}},midLowGain:{enumerable:!0,get:function(){return this.options.midLowGain},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.midLowGain=e,this.overdrives[1].curve=n(s.Util.normalize(this.midLowGain,0,150)))}},midHighGain:{enumerable:!0,get:function(){return this.options.midHighGain},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.midHighGain=e,this.overdrives[2].curve=n(s.Util.normalize(this.midHighGain,0,150)))}},highGain:{enumerable:!0,get:function(){return this.options.highGain},set:function(e){s.Util.isInRange(e,0,1)&&(this.options.highGain=e,this.overdrives[3].curve=n(s.Util.normalize(this.highGain,0,150)))}}}),o}("undefined"!=typeof window?window:global);
},{}],"bell.wav":[function(require,module,exports) {
module.exports = "/bell.2259eb24.wav";
},{}],"index.js":[function(require,module,exports) {
"use strict";

var _index = _interopRequireDefault(require("../index"));

var _pizzicato = _interopRequireDefault(require("pizzicato"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _index.default)(_pizzicato.default);

var bird = require('./bell.wav');

document.addEventListener('click', function () {
  _pizzicato.default.Recorder.start({
    mute: false
  });

  var sound = new _pizzicato.default.Sound(bird, function (err) {
    if (err) return console.error(err);
    sound.play();
    sound.on('end', function () {
      _pizzicato.default.Recorder.stop('wav', handleAudio);
    });
  });
});

function handleAudio(file, fileType) {
  var url = URL.createObjectURL(file);
  var hf = document.createElement('a');
  hf.href = url;
  hf.download = 'pizzicato-recorder-rocks.' + fileType;
  hf.innerHTML = hf.download;
  hf.click();
}
},{"../index":"../index.js","pizzicato":"../node_modules/pizzicato/distr/Pizzicato.min.js","./bell.wav":"bell.wav"}],"../node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "50180" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else {
        window.location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["../node_modules/parcel-bundler/src/builtins/hmr-runtime.js","index.js"], null)
//# sourceMappingURL=/test.e31bb0bc.js.map