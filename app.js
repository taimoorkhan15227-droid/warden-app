(function () {
  if (window.__NZES_APP_LOADED) {
    return;
  }
  window.__NZES_APP_LOADED = true;

const homeScreen = document.getElementById("homeScreen");
const captureScreen = document.getElementById("captureScreen");
const reasonScreen = document.getElementById("reasonScreen");
const reviewScreen = document.getElementById("reviewScreen");
const printScreen = document.getElementById("printScreen");
const attachScreen = document.getElementById("attachScreen");

const startNoticeBtn = document.getElementById("startNoticeBtn");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const retakeBtn = document.getElementById("retakeBtn");
const openCameraBtn = document.getElementById("openCameraBtn");
const capturePhotoBtn = document.getElementById("capturePhotoBtn");
const capturePrompt = document.getElementById("capturePrompt");
const plateConfirm = document.getElementById("plateConfirm");
const plateInput = document.getElementById("plateInput");
const plateHelper = document.getElementById("plateHelper");
const confirmPlateBtn = document.getElementById("confirmPlateBtn");
const reasonForm = document.getElementById("reasonForm");
const reasonOther = document.getElementById("reasonOther");
const reviewPhotos = document.getElementById("reviewPhotos");
const reviewDetails = document.getElementById("reviewDetails");
const confirmDetailsBtn = document.getElementById("confirmDetailsBtn");
const noticeBody = document.getElementById("noticeBody");
const printNoticeBtn = document.getElementById("printNoticeBtn");
const confirmAttachedBtn = document.getElementById("confirmAttachedBtn");
const reprintBtn = document.getElementById("reprintBtn");
const connectionStatus = document.getElementById("connectionStatus");
const plateGuide = document.getElementById("plateGuide");
const locateBtn = document.getElementById("locateBtn");
const locationStatus = document.getElementById("locationStatus");
const cameraStatus = document.getElementById("cameraStatus");
const mapStatus = document.getElementById("mapStatus");
const mapsApiKeyInput = document.getElementById("mapsApiKey");
const geminiApiKeyInput = document.getElementById("geminiApiKey");
const saveApiKeysBtn = document.getElementById("saveApiKeysBtn");
const cameraPreview = document.getElementById("cameraPreview");
const captureCanvas = document.getElementById("captureCanvas");

const payQr = document.getElementById("payQr");
const appealQr = document.getElementById("appealQr");

const steps = [homeScreen, captureScreen, reasonScreen, reviewScreen, printScreen, attachScreen];

const mockCarparks = [
  {
    id: "CP-001",
    name: "Britomart East Carpark",
    lat: -36.8441,
    lng: 174.7684,
    address: "50 Quay Street, Auckland",
    defaultAmount: 65,
  },
  {
    id: "CP-002",
    name: "Queen Street Central",
    lat: -36.8485,
    lng: 174.7633,
    address: "210 Queen Street, Auckland",
    defaultAmount: 85,
  },
  {
    id: "CP-003",
    name: "Viaduct Harbour",
    lat: -36.8415,
    lng: 174.7596,
    address: "15 Halsey Street, Auckland",
    defaultAmount: 95,
  },
];

const noticeState = {
  photos: [],
  currentPhotoIndex: 0,
  plate: "",
  reason: "",
  otherReason: "",
  carpark: null,
  amount: 0,
  noticeAttached: false,
};

function showScreen(target) {
  steps.forEach((screen) => screen.classList.toggle("hidden", screen !== target));
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  connectionStatus.textContent = online ? "Online" : "Offline";
  connectionStatus.style.background = online ? "#e5f7eb" : "#fff1f0";
  connectionStatus.style.color = online ? "#1f7a3f" : "#b42318";
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

function dataURLtoBlob(dataUrl) {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(data);
  const array = [];
  for (let i = 0; i < binary.length; i += 1) {
    array.push(binary.charCodeAt(i));
  }
  return new Blob([new Uint8Array(array)], { type: mime });
}

function distanceKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 6371 * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function getNearestCarpark(position) {
  const sorted = [...mockCarparks]
    .map((park) => ({
      park,
      distance: distanceKm(position, park),
    }))
    .sort((a, b) => a.distance - b.distance);
  return sorted[0];
}

let mapInstance = null;
let currentMarker = null;
let mapsReady = false;
let cameraStream = null;

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
}

function initGoogleMap() {
  const defaultPosition = { lat: -36.8485, lng: 174.7633 };
  mapInstance = new google.maps.Map(document.getElementById("map"), {
    center: defaultPosition,
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  mockCarparks.forEach((park) => {
    new google.maps.Marker({
      map: mapInstance,
      position: { lat: park.lat, lng: park.lng },
      title: park.name,
    });
  });

  mapsReady = true;
}

function updateCurrentLocation(coords) {
  if (!mapInstance || !mapsReady) {
    return;
  }
  mapInstance.setCenter(coords);
  mapInstance.setZoom(16);
  if (currentMarker) {
    currentMarker.setMap(null);
  }
  currentMarker = new google.maps.Marker({
    map: mapInstance,
    position: coords,
    title: "Current location",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#1c4fd7",
      fillOpacity: 0.9,
      strokeColor: "#1c4fd7",
      strokeWeight: 2,
    },
  });
}

function requestLocation() {
  if (!navigator.geolocation) {
    locationStatus.textContent = "Geolocation is not supported on this device.";
    return;
  }
  locationStatus.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateCurrentLocation(coords);
      locationStatus.textContent = "Centered on your current location.";
    },
    (error) => {
      locationStatus.textContent =
        error.code === error.PERMISSION_DENIED
          ? "Location permission denied. Enable GPS permissions to center the map."
          : "Unable to read GPS. Check location settings.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function loadMap() {
  const storedMapsKey = localStorage.getItem("nzes.mapsKey") || "";
  if (storedMapsKey) {
    mapsApiKeyInput.value = storedMapsKey;
  }
  if (!storedMapsKey) {
    mapStatus.textContent = "Add a Google Maps API key to load the map.";
    return;
  }
  try {
    mapStatus.textContent = "Loading Google Maps…";
    await loadGoogleMaps(storedMapsKey);
    initGoogleMap();
    mapStatus.textContent = "Google Maps loaded.";
    requestLocation();
  } catch (error) {
    mapStatus.textContent = "Google Maps failed to load. Check your API key.";
  }
}

function resetCapture() {
  noticeState.photos = [];
  noticeState.currentPhotoIndex = 0;
  noticeState.plate = "";
  plateInput.value = "";
  photoPreview.src = "";
  photoPreview.alt = "Captured preview";
  plateConfirm.classList.add("hidden");
  plateGuide.classList.remove("camera-active", "photo-captured");
  cameraPreview.srcObject = null;
  capturePrompt.textContent = "Photo 1 of 3 — Align the plate within the frame.";
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraPreview.srcObject = null;
  plateGuide.classList.remove("camera-active");
}

async function readPlateWithGemini(dataUrl) {
  const apiKey = localStorage.getItem("nzes.geminiKey");
  if (!apiKey || !navigator.onLine) {
    plateHelper.textContent =
      "Offline or missing Gemini API key. Enter the registration manually.";
    return;
  }
  plateHelper.textContent = "Reading plate with Gemini…";
  const base64 = dataUrl.split(",")[1];
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Read the vehicle registration plate from this image. " +
                    "Respond with only the plate text, no punctuation or extra words.",
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );
    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (text) {
      plateInput.value = text.replace(/\\s+/g, "").toUpperCase();
      plateHelper.textContent = `Detected plate: ${plateInput.value}`;
    } else {
      plateHelper.textContent =
        "Unable to detect the plate. Please enter it manually.";
    }
  } catch (error) {
    plateHelper.textContent =
      "Gemini failed to read the plate. Please enter it manually.";
  }
}

function handlePhoto(file) {
  const reader = new FileReader();
  reader.onload = () => {
    noticeState.photos[noticeState.currentPhotoIndex] = reader.result;
    photoPreview.src = reader.result;
    plateGuide.classList.add("photo-captured");
    stopCamera();

    if (noticeState.currentPhotoIndex === 0) {
      const online = navigator.onLine;
      plateConfirm.classList.remove("hidden");
      if (online) {
        readPlateWithGemini(reader.result);
      } else {
        plateHelper.textContent =
          "Offline mode: enter the vehicle registration manually.";
      }
    } else {
      moveToNextPhoto();
    }
  };
  reader.readAsDataURL(file);
}

function moveToNextPhoto() {
  if (noticeState.currentPhotoIndex < 2) {
    noticeState.currentPhotoIndex += 1;
    capturePrompt.textContent = `Photo ${noticeState.currentPhotoIndex + 1} of 3 — Capture the vehicle context.`;
    plateConfirm.classList.add("hidden");
    plateGuide.classList.remove("camera-active", "photo-captured");
    photoInput.value = "";
    photoPreview.src = "";
  } else {
    showScreen(reasonScreen);
  }
}

startNoticeBtn.addEventListener("click", () => {
  resetCapture();
  showScreen(captureScreen);
  cameraStatus.textContent =
    "If the camera does not open, ensure this page is served over HTTPS or from a local server (not a file viewer).";
});

openCameraBtn.addEventListener("click", async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent =
      "Camera access requires HTTPS or a local server. File viewers often block camera access.";
    photoInput.click();
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    cameraPreview.srcObject = cameraStream;
    plateGuide.classList.add("camera-active");
    plateGuide.classList.remove("photo-captured");
    cameraStatus.textContent = "Camera ready. Tap Capture Photo.";
  } catch (error) {
    cameraStatus.textContent =
      "Camera permission denied. Allow camera access to capture photos.";
    photoInput.click();
  }
});

capturePhotoBtn.addEventListener("click", () => {
  if (!cameraStream) {
    cameraStatus.textContent = "Camera is not active. Tap Open Camera first.";
    return;
  }
  const video = cameraPreview;
  const canvas = captureCanvas;
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const blob = dataURLtoBlob(dataUrl);
  handlePhoto(blob);
});

photoInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) {
    handlePhoto(file);
  }
});

retakeBtn.addEventListener("click", () => {
  photoInput.value = "";
  photoPreview.src = "";
  plateGuide.classList.remove("camera-active", "photo-captured");
  stopCamera();
});

confirmPlateBtn.addEventListener("click", () => {
  if (!plateInput.value.trim()) {
    plateHelper.textContent = "Please confirm the vehicle registration.";
    return;
  }
  noticeState.plate = plateInput.value.trim().toUpperCase();
  plateConfirm.classList.add("hidden");
  moveToNextPhoto();
});

reasonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(reasonForm);
  const reason = formData.get("reason");
  if (!reason) {
    alert("Please select a reason for the infringement.");
    return;
  }
  noticeState.reason = reason;
  noticeState.otherReason = reason === "Other" ? reasonOther.value.trim() : "";
  showReview();
});

function showReview() {
  const location = {
    lat: -36.8485,
    lng: 174.7633,
  };
  const nearest = getNearestCarpark(location);
  noticeState.carpark = nearest.park;
  noticeState.amount = nearest.park.defaultAmount;

  reviewPhotos.innerHTML = "";
  noticeState.photos.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Photo ${index + 1}`;
    reviewPhotos.appendChild(img);
  });

  reviewDetails.innerHTML = `
    <li><strong>Carpark:</strong> ${nearest.park.name}</li>
    <li><strong>Address:</strong> ${nearest.park.address}</li>
    <li><strong>Vehicle Registration:</strong> ${noticeState.plate}</li>
    <li><strong>Reason:</strong> ${noticeState.reason}</li>
    ${noticeState.otherReason ? `<li><strong>Additional detail:</strong> ${noticeState.otherReason}</li>` : ""}
    <li><strong>Infringement Amount:</strong> $${noticeState.amount}</li>
    <li><strong>Matched via GPS:</strong> ${nearest.distance.toFixed(2)} km away</li>
  `;

  showScreen(reviewScreen);
}

confirmDetailsBtn.addEventListener("click", () => {
  renderNotice();
  showScreen(printScreen);
});

function renderNotice() {
  noticeBody.innerHTML = `
    <p><strong>Carpark:</strong> ${noticeState.carpark.name}</p>
    <p><strong>Address:</strong> ${noticeState.carpark.address}</p>
    <p><strong>Vehicle Registration:</strong> ${noticeState.plate}</p>
    <p><strong>Reason:</strong> ${noticeState.reason}${
      noticeState.otherReason ? ` — ${noticeState.otherReason}` : ""
    }</p>
    <p><strong>Infringement Amount:</strong> $${noticeState.amount}</p>
    <p><strong>Notice Issued:</strong> ${new Date().toLocaleString()}</p>
  `;

  QRCode.toCanvas(payQr, "https://payments.nzenforcement.co.nz", {
    width: 120,
    margin: 1,
  });
  QRCode.toCanvas(appealQr, "https://appeals.nzenforcement.co.nz", {
    width: 120,
    margin: 1,
  });
}

printNoticeBtn.addEventListener("click", () => {
  noticeState.noticeAttached = false;
  showScreen(attachScreen);
});

confirmAttachedBtn.addEventListener("click", () => {
  noticeState.noticeAttached = true;
  showScreen(homeScreen);
});

reprintBtn.addEventListener("click", () => {
  showScreen(printScreen);
});

saveApiKeysBtn.addEventListener("click", () => {
  const mapsKey = mapsApiKeyInput.value.trim();
  const geminiKey = geminiApiKeyInput.value.trim();
  if (mapsKey) {
    localStorage.setItem("nzes.mapsKey", mapsKey);
  }
  if (geminiKey) {
    localStorage.setItem("nzes.geminiKey", geminiKey);
  }
  mapStatus.textContent = "Keys saved. Reloading map…";
  loadMap();
});

const storedGeminiKey = localStorage.getItem("nzes.geminiKey");
if (storedGeminiKey) {
  geminiApiKeyInput.value = storedGeminiKey;
}

loadMap();

})();
