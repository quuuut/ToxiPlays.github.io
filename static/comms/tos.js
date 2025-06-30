const today = new Date();
const price = 6; // INTEGER REPRESENTING CURRENT PRICE OF COMMISSIONS IN USD.

document.querySelector(".date").innerHTML = document.querySelector(".date").innerHTML.replace("%DATE%",new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(today));

const bonusWords = [
  "Crispy",
  "Barrel",
  "Keyboard",
  "Tri-tone",
  "Surfer",
  "Waveform",
  "Oblivious",
  "Dreamy",
  "Telephone",
  "Avant-garde",
  "Please",
  "Magic"
];
document.querySelector("body").innerHTML = document.querySelector("body").innerHTML.replace("%WORD4MONTH%",bonusWords[today.getMonth()])
.replace("%PRICE-A%",price.toString())
.replace("%PRICE-B%",`${price * 3}`.toString());
document.querySelector("body").style = "display:block;margin:8%;";
