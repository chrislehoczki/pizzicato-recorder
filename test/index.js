import PizzicatoRecorder from '../index'
import Pizzicato from 'pizzicato'

PizzicatoRecorder(Pizzicato)

let bird = require('./bell.wav');

document.addEventListener('click', () => {
  Pizzicato.Recorder.start({ mute: false })
  var sound = new Pizzicato.Sound(bird, function(err) {
    if (err) return console.error(err);

    sound.play();

    sound.on('end', function() {
      Pizzicato.Recorder.stop('wav', handleAudio)
    })
  });
})

function handleAudio(file, fileType) {
  let url = URL.createObjectURL(file);
  let hf = document.createElement('a');
  hf.href = url;
  hf.download = 'pizzicato-recorder-rocks.' + fileType;
  hf.innerHTML = hf.download;
  hf.click();
}