// Media importato automaticamente dalla cartella del progetto
// Sovrascrive DATA.gallery e DATA.videos con i file reali presenti
const IMPORTED_GALLERY = [
  {
    "id": "imp-g-1",
    "cat": "screenshots",
    "titolo": "253CF847 7C3B 4EFB 85D5 6CE998413D38",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/253CF847-7C3B-4EFB-85D5-6CE998413D38.PNG"
  },
  {
    "id": "imp-g-2",
    "cat": "screenshots",
    "titolo": "287E692B F918 4EAC 9261 E8D7972CDEA5 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/287E692B-F918-4EAC-9261-E8D7972CDEA5%202.PNG"
  },
  {
    "id": "imp-g-3",
    "cat": "screenshots",
    "titolo": "47D65A58 3F15 4440 BAE8 B9B3303EF4AC",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/47D65A58-3F15-4440-BAE8-B9B3303EF4AC.PNG"
  },
  {
    "id": "imp-g-4",
    "cat": "screenshots",
    "titolo": "7A05FEF9 BACE 4F9E A959 85128DF3D480",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/7A05FEF9-BACE-4F9E-A959-85128DF3D480.PNG"
  },
  {
    "id": "imp-g-5",
    "cat": "screenshots",
    "titolo": "BA4FD509 D746 4A44 8D51 A18C3410F191",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/BA4FD509-D746-4A44-8D51-A18C3410F191.PNG"
  },
  {
    "id": "imp-g-6",
    "cat": "screenshots",
    "titolo": "IMG 7427 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7427%202.JPG"
  },
  {
    "id": "imp-g-7",
    "cat": "screenshots",
    "titolo": "IMG 7428 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7428%202.JPG"
  },
  {
    "id": "imp-g-8",
    "cat": "screenshots",
    "titolo": "IMG 7429 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7429%202.JPG"
  },
  {
    "id": "imp-g-9",
    "cat": "screenshots",
    "titolo": "IMG 7430 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7430%202.JPG"
  },
  {
    "id": "imp-g-10",
    "cat": "screenshots",
    "titolo": "IMG 7431 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7431%202.JPG"
  },
  {
    "id": "imp-g-11",
    "cat": "screenshots",
    "titolo": "IMG 7432 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7432%202.JPG"
  },
  {
    "id": "imp-g-12",
    "cat": "screenshots",
    "titolo": "IMG 7611 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7611%202.JPG"
  },
  {
    "id": "imp-g-13",
    "cat": "screenshots",
    "titolo": "IMG 7611 3",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7611%203.JPG"
  },
  {
    "id": "imp-g-14",
    "cat": "screenshots",
    "titolo": "IMG 7612 2",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7612%202.JPG"
  },
  {
    "id": "imp-g-15",
    "cat": "screenshots",
    "titolo": "IMG 7612 3",
    "autore": "Importato",
    "data": "Oggi",
    "src": "/IMG_7612%203.JPG"
  }
];

const IMPORTED_VIDEOS = [
  {
    "id": "imp-v-1",
    "cat": "raid",
    "dur": "--:--",
    "titolo": "6360533459655794123",
    "desc": "Video importato dalla cartella del progetto.",
    "fonte": {
      "url": "/-6360533459655794123.MP4"
    }
  },
  {
    "id": "imp-v-2",
    "cat": "guida",
    "dur": "--:--",
    "titolo": "590424225b594398a70affa018d4e831",
    "desc": "Video importato dalla cartella del progetto.",
    "fonte": {
      "url": "/590424225b594398a70affa018d4e831.MOV"
    }
  }
];

// Sovrascrittura di DATA (definito in data.js)
if (typeof DATA !== "undefined") {
  DATA.gallery = IMPORTED_GALLERY;
  DATA.videos = IMPORTED_VIDEOS;
}
