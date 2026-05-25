/* ══════════════════════════════════════════════════════════════════
   Filmová Databáza — app.js
   Depends on: data.js (buildMovies), JSZip, PDF.js, Fuse.js, Chart.js
   ══════════════════════════════════════════════════════════════════ */

(function(){
"use strict";
if(typeof pdfjsLib!=="undefined")
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
