export default function PizzicatoRecorder(Pizzicato) {
  Pizzicato.Recorder = {
    instance: null,
    worker: null,
    start: function() {
      if (!this.worker) {
        // create our worker
        this.worker = this.createWorker();
        // listen for events
        this.worker.onmessage = function(e) {
          switch (e.data.type) {
            case 'audioBlob':
              Pizzicato.Events.trigger('audioFile', e.data.audioBlob);
              break;
            case 'progress':
              Pizzicato.Events.trigger('conversionProgress', e.data.progress);
              break;
          }
        };
      }
      // attach our nodes
      var source = this.processNodes();
      // create a new recorder controller with our connected source
      if (!this.instance) {
        this.instance = new this.controller(source, null, this.worker);
      }
      // clear out any old worker data
      this.comms.clear.call(this);
      // start recording
      this.instance.record();
    },
    stop: function(fileType, callback, progress) {
      // stop recording
      this.instance.stop();
      // stop our worker from taking data
      this.comms.stop.call(this);
      // choose export according to filetype
      if (fileType === 'mp3') {
        this.comms.exportMP3.call(this);
      } else {
        this.comms.exportWAV.call(this);
      }
      function endCallback (file) {
        callback(file, fileType);
        Pizzicato.Events.off('audioFile', endCallback)
      }
      function progressCallback () {
        progress();
        Pizzicato.Events.off('conversionProgress', progressCallback)
      }
      // attach event listeners
      Pizzicato.Events.on('conversionProgress', progressCallback);
      Pizzicato.Events.on('audioFile', endCallback);
    },
    processNodes: function() {
      // connect our master gain node to a media stream destination for processing audio
      var source = Pizzicato.masterGainNode;
      var dest = Pizzicato.context.createMediaStreamDestination();
      source.connect(dest);
      return source;
    },
    comms: {
      clear: function() {
        this.worker.postMessage({
          command: 'clear'
        });
      },
      stop: function() {
        this.worker.postMessage({
          command: 'stopRecord'
        });
      },
      exportWAV: function() {
        this.worker.postMessage({
          command: 'exportWAV',
          type: 'audio/wav'
        });
      },
      exportMP3: function() {
        this.worker.postMessage({
          command: 'exportStereoMP3',
          type: 'audio/wav'
        });
      }
    },
    controller: function (source, cfg, worker) {
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
      this.node.onaudioprocess = function(e) {
        if (!recording) return;
        worker.postMessage({
          command: 'record',
          buffer: [
            e.inputBuffer.getChannelData(0),
            e.inputBuffer.getChannelData(1)
          ]
        });
      };

      this.record = function() {
        recording = true;
      };

      this.stop = function() {
        recording = false;
      };

      source.connect(this.node);
      this.node.connect(this.context.destination);
    },
    createWorker: function() {
      const blob = new Blob([this.workerString], {
        type: "text/javascript"
      })
      // Note: window.webkitURL.createObjectURL() in Chrome 10+.
      return new Worker(window.URL.createObjectURL(blob));
    },
    workerString: `
      function createLog(action) {
        console.info('Recorder: ' + action);
      }

      // some params 
      var recLength = 0;
      var sampleRate;

      // original recorded buffers
      var recBuffersL = [];
      var recBuffersR = [];

      // comms
      this.onmessage = function (e) {
        switch (e.data.command) {
          case 'init':
            init(e.data.config);
            break;
          case 'record':
            record(e.data.buffer);
            break;
          case 'stopRecord':
            createSamples();
            break;
          case 'exportWAV':
            exportWAV(e.data.type);
            break;
          case 'clear':
            clear();
            break;
        }
      };

      function init (config) {
        sampleRate = config.sampleRate;
      }

      function record (inputBuffer) {
        // push to our original buffers
        recBuffersL.push(inputBuffer[0]);
        recBuffersR.push(inputBuffer[1]);

        // store the recording length
        recLength += inputBuffer[0].length;
      }

      function exportWAV (type) {
        // merge all our buffers
        recBuffersL = mergeBuffers(recBuffersL, recLength);
        recBuffersR = mergeBuffers(recBuffersR, recLength);
        // create our samples from our buffer for wav
        var samples = createSamples();
        // make the wav
        var dataview = encodeWAV(samples);
        var audioBlob = new Blob([dataview], { type: 'audio/wav' });
        // post it back
        this.postMessage({ type: 'audioBlob', audioBlob: audioBlob });
      }

      function createSamples() {
        return interleave(recBuffersL, recBuffersR)
      }

      function clear () {
        recLength = 0;
        recBuffersL = [];
        recBuffersR = [];
      }

      function mergeBuffers (recBuffers, recLength) {
        var result = new Float32Array(recLength);
        var offset = 0;
        for (var i = 0; i < recBuffers.length; i++) {
          result.set(recBuffers[i], offset);
          offset += recBuffers[i].length;
        }
        return result;
      }

      function interleave (inputL, inputR) {
        var length = inputL.length + inputR.length;
        var result = new Float32Array(length);

        var index = 0,
          inputIndex = 0;

        while (index < length) {
          result[index++] = inputL[inputIndex];
          result[index++] = inputR[inputIndex];
          inputIndex++;
        }
        return result;
      }

      function floatTo16BitPCM (output, offset, input) {
        for (var i = 0; i < input.length; i++, offset += 2) {
          var s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
      }

      function writeString (view, offset, string) {
        for (var i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      function encodeWAV (samples, mono) {
        var buffer = new ArrayBuffer(44 + samples.length * 2);
        var view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* file length */
        view.setUint32(4, 32 + samples.length * 2, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, mono ? 1 : 2, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * 4, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, 4, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        floatTo16BitPCM(view, 44, samples);

        return view;
      }

      function convertBuffer (buffers) {
        var lo = buffers[0];
        var ro = buffers[1];

        // if we are not a float32array already, lets merge standard array of float32s to one float32
        if (buffers[0].constructor !== Float32Array) {
            lo = mergeBuffers(buffers[0], recLength);
            ro = mergeBuffers(buffers[1], recLength);
        }

        var l = new Float32Array(lo.length); // The transformed data, this is what you will pass to lame instead
        var r = new Float32Array(ro.length);

        // Convert to required format
        for (var i = 0; i < lo.length; i++) {
          l[i] = lo[i] * 32767.5;
          r[i] = ro[i] * 32767.5;
        }

        return { l: l, r: r };
      }
    `
  };
}