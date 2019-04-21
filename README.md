# pizzicato-recorder
A recording module for PizzicatoJS

## Description

I developed a recording system for a project and thought it would be nice to give back to the web audio community by publishing this module to extend PizzicatoJS. It uses a script processor node and inline web worker to collect audio data, and write out to WAV. 

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
`Pizzicato.Recorder.start()`

### Stop Recording
`Pizzicato.Recorder.stop('wav', callback)`

## Simple Usage In Browser
```
import PizzicatoRecorder from 'pizzicato-recorder'
import Pizzicato from 'pizzicato'

PizzicatoRecorder(Pizzicato)

document.addEventListener('click', () => {
  Pizzicato.Recorder.start()
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