# pizzicato-recorder
A recording module for PizzicatoJS

## Description

Recording system plugin to extend PizzicatoJS. It uses a script processor node and inline web worker to collect audio data, and write out to WAV. 

## Initialization

You must import `pizzicato` and `pizzicato-recorder`, and then call `PizzicatoRecorder` with the `Pizzicato` instance.

```
import PizzicatoRecorder from 'pizzicato-recorder'
import Pizzicato from 'pizzicato'

// extend Pizzicato
PizzicatoRecorder(Pizzicato)
```

## Methods

### Start Recording
`Pizzicato.Recorder.start(options)`

Passing an options object to the start method is optional

Example options object:
```
{
  mute: Boolean /* Allows the muting of the output whilst recording */
}
```

### Stop Recording
`Pizzicato.Recorder.stop('wav', callback)`

## Simple Usage In Browser

```
import PizzicatoRecorder from 'pizzicato-recorder'
import Pizzicato from 'pizzicato'

PizzicatoRecorder(Pizzicato)

document.addEventListener('click', () => {
  Pizzicato.Recorder.start({ mute: false })
  var sound = new Pizzicato.Sound('bird.wav', function(err) {
    if (err) return console.error(err);
	  sound.play()
	  sound.on('end', function() {
	    Pizzicato.Recorder.stop('wav', handleAudio)
	  })
  })
})

function handleAudio(file, fileType) {
  let url = URL.createObjectURL(file)
  let hf = document.createElement('a')
  hf.href = url
  hf.download = 'pizzicato-recorder-rocks.' + fileType
  hf.innerHTML = hf.download
  hf.click()
}
```