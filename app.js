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

function loadMap() {
  const defaultPosition = { lat: -36.8485, lng: 174.7633 };
  const map = L.map("map").setView([defaultPosition.lat, defaultPosition.lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  mockCarparks.forEach((park) => {
    L.marker([park.lat, park.lng]).addTo(map).bindPopup(
      `<strong>${park.name}</strong><br />${park.address}`
    );
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setView([coords.lat, coords.lng], 16);
        L.circleMarker([coords.lat, coords.lng], {
          radius: 8,
          color: "#1c4fd7",
          fillColor: "#1c4fd7",
          fillOpacity: 0.8,
        })
          .addTo(map)
          .bindPopup("Current location")
          .openPopup();
      },
      () => {
        map.setView([defaultPosition.lat, defaultPosition.lng], 14);
      }
    );
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
  plateGuide.classList.remove("active");
  capturePrompt.textContent = "Photo 1 of 3 — Align the plate within the frame.";
}

function handlePhoto(file) {
  const reader = new FileReader();
  reader.onload = () => {
    noticeState.photos[noticeState.currentPhotoIndex] = reader.result;
    photoPreview.src = reader.result;
    plateGuide.classList.add("active");

    if (noticeState.currentPhotoIndex === 0) {
      const online = navigator.onLine;
      plateConfirm.classList.remove("hidden");
      if (online) {
        plateHelper.textContent =
          "Processing plate via Gemini… please verify the detected plate.";
        setTimeout(() => {
          plateInput.value = "NZE123";
          plateHelper.textContent = "Detected plate: NZE123";
        }, 1200);
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
    plateGuide.classList.remove("active");
    photoInput.value = "";
    photoPreview.src = "";
  } else {
    showScreen(reasonScreen);
  }
}

startNoticeBtn.addEventListener("click", () => {
  resetCapture();
  showScreen(captureScreen);
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
  plateGuide.classList.remove("active");
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

loadMap();
